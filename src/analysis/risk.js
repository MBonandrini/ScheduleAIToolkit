/**
 * Schedule risk mapping and Monte Carlo simulation.
 *
 * The simulation is deliberately assumption-led: users choose the duration
 * distribution, uncertainty range, iteration count and whether mapped register
 * risks are included.  Results describe schedule uncertainty, not contractual
 * entitlement or a guaranteed completion date.
 */
import {
  seededRandom,
  mean,
  median,
  stddev,
  parseDate,
  daysBetween,
  isoDate,
} from "../core/utils.js";
import {
  buildNetwork,
  topologicalOrder,
} from "./network.js";

function triangular(rng, min, mode, max) {
  const u = rng();
  const f = (mode - min) / (max - min || 1);
  return u < f
    ? min + Math.sqrt(u * (max - min) * (mode - min))
    : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function uniform(rng, min, max) {
  return min + rng() * (max - min);
}

function normal(rng, meanValue, sigma, min, max) {
  // Box-Muller transform with bounds to avoid impossible negative durations.
  const u1 = Math.max(Number.EPSILON, rng());
  const u2 = Math.max(Number.EPSILON, rng());
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(min, Math.min(max, meanValue + z * sigma));
}

function gamma(rng, shape) {
  if (shape < 1) {
    return gamma(rng, shape + 1) * Math.pow(Math.max(Number.EPSILON, rng()), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x;
    let v;
    do {
      const u1 = Math.max(Number.EPSILON, rng());
      const u2 = Math.max(Number.EPSILON, rng());
      x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v **= 3;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

function pert(rng, min, mode, max, lambda = 4) {
  if (max <= min) return min;
  const alpha = 1 + lambda * (mode - min) / (max - min);
  const beta = 1 + lambda * (max - mode) / (max - min);
  const x = gamma(rng, alpha);
  const y = gamma(rng, beta);
  const sample = x / (x + y || 1);
  return min + sample * (max - min);
}

function sampledDuration(rng, base, uncertainty, distribution) {
  if (base <= 0) return 0;
  const min = Math.max(0.05, base * (1 - uncertainty));
  const max = Math.max(min, base * (1 + uncertainty));
  switch (distribution) {
    case "uniform":
      return uniform(rng, min, max);
    case "normal":
      return normal(rng, base, Math.max(0.01, base * uncertainty / 2), min, max);
    case "pert":
      return pert(rng, min, base, max);
    case "triangular":
    default:
      return triangular(rng, min, base, max);
  }
}

function baseRemainingDuration(activity, remainingOnly) {
  const original = Math.max(0, Number(activity.originalDuration || 0));
  if (!remainingOnly) return original || Math.max(0, Number(activity.remainingDuration || 0));
  if (Number(activity.percent || 0) >= 100) return 0;
  if (activity.remainingDuration !== null && activity.remainingDuration !== undefined && Number.isFinite(Number(activity.remainingDuration))) {
    const remaining = Math.max(0, Number(activity.remainingDuration));
    // Some import formats normalise a missing remaining-duration field to zero.
    // For incomplete activities, fall back to the progress-adjusted original
    // duration rather than treating all remaining work as already complete.
    if (remaining > 0 || original <= 0) return remaining;
  }
  return original * Math.max(0, 1 - Number(activity.percent || 0) / 100);
}

function quantile(sorted, probability) {
  if (!sorted.length) return 0;
  const p = Math.max(0, Math.min(1, Number(probability) || 0));
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index];
}

function histogram(values, bucketCount) {
  if (!values.length) return [];
  const min = values[0];
  const observedMax = values.at(-1);
  const max = observedMax > min ? observedMax : min + 1;
  const count = Math.max(6, Math.min(60, Math.round(Number(bucketCount) || 20)));
  const width = Math.max(0.01, (max - min) / count);
  const buckets = Array.from({ length: count }, (_, index) => ({
    from: min + width * index,
    to: index === count - 1 ? max : min + width * (index + 1),
    count: 0,
  }));
  for (const value of values) {
    const index = Math.min(count - 1, Math.max(0, Math.floor((value - min) / width)));
    buckets[index].count += 1;
  }
  return buckets.map((bucket) => ({
    ...bucket,
    mid: (bucket.from + bucket.to) / 2,
    probability: bucket.count / values.length * 100,
  }));
}

function scheduleEnvelope(schedule) {
  const starts = schedule.activities.map((a) => parseDate(a.start)).filter(Boolean);
  const finishes = schedule.activities.map((a) => parseDate(a.finish)).filter(Boolean);
  const start = starts.length ? new Date(Math.min(...starts.map(Number))) : null;
  const finish = finishes.length ? new Date(Math.max(...finishes.map(Number))) : null;
  return {
    start,
    finish,
    plannedDuration: start && finish ? Math.max(0, daysBetween(start, finish)) : 0,
  };
}

export function runMonteCarlo(schedule, {
  iterations = 2000,
  seed = 42,
  uncertainty = 0.2,
  distribution = "triangular",
  targetId = null,
  targetDate = "",
  customPercentile = 75,
  histogramBuckets = 20,
  includeRisks = false,
  risks = [],
  remainingOnly = true,
} = {}) {
  const topo = topologicalOrder(schedule);
  if (!topo.acyclic) {
    return {
      error: "Cycles prevent network simulation",
      iterations: 0,
    };
  }

  const g = buildNetwork(schedule);
  const rng = seededRandom(seed);
  const finishes = [];
  const criticality = new Map();
  const topoIndex = new Map(topo.order.map((id, index) => [id, index]));
  const activityIds = new Set(topo.order);
  const envelope = scheduleEnvelope(schedule);
  const targetDateValue = parseDate(targetDate);
  const targetDays = envelope.start && targetDateValue ? Math.max(0, daysBetween(envelope.start, targetDateValue)) : null;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const finish = new Map();
    const parent = new Map();
    const riskImpactById = new Map();
    let globalRiskImpact = 0;

    if (includeRisks) {
      for (const risk of risks || []) {
        const probability = Math.max(0, Math.min(100, Number(risk.probability || 0))) / 100;
        if (rng() > probability) continue;
        const impact = Math.max(0, Number(risk.impactDays || 0));
        const mapped = (risk.activityIds || [])
          .filter((id) => activityIds.has(id))
          .sort((a, b) => (topoIndex.get(a) || 0) - (topoIndex.get(b) || 0));
        if (mapped.length) {
          const id = mapped.at(-1);
          riskImpactById.set(id, (riskImpactById.get(id) || 0) + impact);
        } else {
          globalRiskImpact += impact;
        }
      }
    }

    for (const id of topo.order) {
      const activity = g.activities.get(id);
      const base = baseRemainingDuration(activity, remainingOnly);
      const sampled = sampledDuration(rng, base, Math.max(0, Number(uncertainty) || 0), distribution);
      const duration = sampled + (riskImpactById.get(id) || 0);
      let start = 0;
      let bestPred = null;
      for (const rel of g.incoming.get(id) || []) {
        const candidate = (finish.get(rel.predId) || 0) + Math.max(0, Number(rel.lag || 0));
        if (candidate > start) {
          start = candidate;
          bestPred = rel.predId;
        }
      }
      finish.set(id, start + duration);
      if (bestPred) parent.set(id, bestPred);
    }

    const end = targetId && finish.has(targetId)
      ? targetId
      : [...finish.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const outcome = (finish.get(end) || 0) + globalRiskImpact;
    finishes.push(outcome);

    let current = end;
    const seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      criticality.set(current, (criticality.get(current) || 0) + 1);
      current = parent.get(current);
    }
  }

  finishes.sort((a, b) => a - b);
  const customProbability = Math.max(1, Math.min(99, Number(customPercentile) || 75));
  const targetProbability = targetDays === null
    ? null
    : finishes.filter((value) => value <= targetDays).length / Math.max(1, finishes.length) * 100;

  return {
    iterations,
    seed,
    distribution,
    uncertainty,
    targetId,
    targetDate: targetDateValue ? isoDate(targetDateValue) : "",
    targetDays,
    targetProbability,
    customPercentile: customProbability,
    customValue: quantile(finishes, customProbability / 100),
    p10: quantile(finishes, 0.1),
    p50: quantile(finishes, 0.5),
    p80: quantile(finishes, 0.8),
    p90: quantile(finishes, 0.9),
    mean: mean(finishes),
    median: median(finishes),
    stddev: stddev(finishes),
    projectStart: envelope.start ? isoDate(envelope.start) : "",
    plannedFinish: envelope.finish ? isoDate(envelope.finish) : "",
    plannedDuration: envelope.plannedDuration,
    histogram: histogram(finishes, histogramBuckets),
    criticality: [...criticality.entries()]
      .map(([id, n]) => ({ id, probability: n / iterations * 100 }))
      .sort((a, b) => b.probability - a.probability),
  };
}

export function mapRiskToSchedule(risk, schedule) {
  const ids = new Set(risk.activityIds || []);
  const activities = schedule.activities.filter((activity) => ids.has(activity.id));
  return {
    ...risk,
    activities,
  };
}
