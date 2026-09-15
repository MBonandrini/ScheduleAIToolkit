/**
 * DCMA-style 14-point schedule assessment.
 *
 * The implementation follows the conventional 14 metric definitions used in
 * NASA/DCMA schedule-health guidance.  Metrics that fundamentally depend on
 * baseline/resource data report N/A when the imported schedule cannot support a
 * defensible calculation instead of silently returning a false pass.
 *
 * The Critical Path Test uses a deterministic network-recalculation proxy: a
 * 600-day delay is added to an eligible zero/lowest-float activity and the
 * normalized logic network is forward-calculated.  Calendar/constraint engines
 * are not re-run, so the UI clearly labels the result as a network proxy.
 */
import { parseDate, isoDate } from "../core/utils.js";

const EPS = 1e-9;
const DAY_MS = 86400000;
const num = v => Number(v || 0);
const dateOnly = v => parseDate(v);
const isComplete = a => num(a?.percent) >= 100 || !!a?.actualFinish;
const positiveDuration = a => !a?.milestone && num(a?.originalDuration) > 0;
const hasBaseline = a => !!(a?.baselineStart || a?.baselineFinish);
const activityText = a => `${a?.id || ""} · ${a?.name || ""}`.trim();
const pct = (n, d) => d ? n / d * 100 : 0;

function result({ number, id, name, status, count = 0, denominator = 0, value = null,
  rate = null, threshold = "", criterion = "", details = [], note = "" }) {
  return { number, id, name, status, count, denominator, value, rate, threshold, criterion, details, note };
}

function hardConstraint(a) {
  const values = [a?.constraintType, a?.secondaryConstraintType]
    .map(x => String(x || "").toUpperCase().replace(/[^A-Z0-9]+/g, "_"));
  return values.some(v => /(^|_)(CS_)?(MSO|MFO|SNLT|FNLT)($|_)/.test(v)
    || /MUST_(START|FINISH)/.test(v)
    || /(START|FINISH)_NO_LATER/.test(v)
    || /MANDATORY_(START|FINISH)/.test(v));
}

function relationshipPopulation(schedule, eligibleIds) {
  return (schedule.relationships || []).filter(r => eligibleIds.has(String(r.predId)) || eligibleIds.has(String(r.succId)));
}

function networkForward(schedule, delayActivityId = "", delayDays = 0) {
  const activities = schedule.activities || [];
  if (!activities.length) return null;
  const byId = new Map(activities.map(a => [String(a.id), a]));
  const incoming = new Map(activities.map(a => [String(a.id), 0]));
  const outgoing = new Map(activities.map(a => [String(a.id), []]));
  for (const r of schedule.relationships || []) {
    const p = String(r.predId), s = String(r.succId);
    if (!byId.has(p) || !byId.has(s)) continue;
    incoming.set(s, (incoming.get(s) || 0) + 1);
    outgoing.get(p).push(r);
  }
  const queue = activities.filter(a => (incoming.get(String(a.id)) || 0) === 0).map(a => String(a.id));
  const start = new Map(activities.map(a => [String(a.id), 0]));
  let visited = 0;
  const duration = id => {
    const a = byId.get(String(id));
    const base = Math.max(0, num(a?.remainingDuration || a?.originalDuration));
    return base + (String(id) === String(delayActivityId) ? delayDays : 0);
  };
  while (queue.length) {
    const pred = queue.shift();
    visited++;
    const predStart = start.get(pred) || 0;
    const predDur = duration(pred);
    for (const r of outgoing.get(pred) || []) {
      const succ = String(r.succId), succDur = duration(succ), lag = num(r.lag);
      let candidate;
      switch (String(r.type || "FS").toUpperCase()) {
        case "SS": candidate = predStart + lag; break;
        case "FF": candidate = predStart + predDur + lag - succDur; break;
        case "SF": candidate = predStart + lag - succDur; break;
        default: candidate = predStart + predDur + lag;
      }
      start.set(succ, Math.max(start.get(succ) || 0, candidate));
      incoming.set(succ, (incoming.get(succ) || 0) - 1);
      if (incoming.get(succ) === 0) queue.push(succ);
    }
  }
  if (visited !== activities.length) return { cycle: true, projectDuration: null, starts: start };
  let projectDuration = 0, finishId = "";
  for (const a of activities) {
    const id = String(a.id), finish = (start.get(id) || 0) + duration(id);
    if (finish >= projectDuration) { projectDuration = finish; finishId = id; }
  }
  return { cycle: false, projectDuration, finishId, starts: start };
}

function baselineCoverage(activities) {
  const eligible = activities.filter(positiveDuration);
  const baseline = eligible.filter(hasBaseline);
  return { eligible: eligible.length, baseline: baseline.length, rate: pct(baseline.length, eligible.length) };
}

export function dcma14(schedule, { profile = null } = {}) {
  const t = profile?.thresholds || {
    logicMissingPctMax: 5, leadPctMax: 0, lagPctMax: 5, fsPctMin: 90, sfCountMax: 0,
    hardConstraintPctMax: 5, highFloatPctMax: 5, negativeFloatPctMax: 0,
    highDurationPctMax: 5, invalidDateCountMax: 0, resourceMissingPctMax: 0,
    missedTaskPctMax: 5, cpliMin: 1, beiMin: 0.95, durationLimitDays: 44,
    highFloatLimitDays: 44
  };
  const activities = schedule?.activities || [];
  const relationships = schedule?.relationships || [];
  const dataDate = dateOnly(schedule?.dataDate);
  const coverage = baselineCoverage(activities);

  // NASA/DCMA guidance focuses on baselined positive-duration tasks.  If an
  // import carries no baseline dates at all, use positive-duration tasks for
  // structural metrics and explicitly report the fallback in the metadata.
  const baselineAvailable = coverage.baseline > 0;
  const scope = activities.filter(a => positiveDuration(a) && (!baselineAvailable || hasBaseline(a)));
  const incomplete = scope.filter(a => !isComplete(a));
  const incompleteIds = new Set(incomplete.map(a => String(a.id)));
  const scopeIds = new Set(scope.map(a => String(a.id)));
  const scopedRelationships = relationshipPopulation(schedule, incompleteIds);

  const preds = new Map(activities.map(a => [String(a.id), 0]));
  const succs = new Map(activities.map(a => [String(a.id), 0]));
  for (const r of relationships) {
    preds.set(String(r.succId), (preds.get(String(r.succId)) || 0) + 1);
    succs.set(String(r.predId), (succs.get(String(r.predId)) || 0) + 1);
  }

  // 1 Logic
  const missing = incomplete.filter(a => (preds.get(String(a.id)) || 0) === 0 || (succs.get(String(a.id)) || 0) === 0);
  const missingRate = pct(missing.length, incomplete.length);
  const checks = [result({
    number: 1, id: "logic", name: "Logic", status: missingRate <= t.logicMissingPctMax ? "PASS" : "FAIL",
    count: missing.length, denominator: incomplete.length, rate: missingRate, threshold: `≤ ${t.logicMissingPctMax}% missing logic`,
    criterion: "Incomplete tasks missing a predecessor and/or successor.",
    details: missing.map(a => ({ activity: activityText(a), wbs: a.wbsPath || "", issue: `${(preds.get(String(a.id)) || 0) === 0 ? "No predecessor" : ""}${(preds.get(String(a.id)) || 0) === 0 && (succs.get(String(a.id)) || 0) === 0 ? " + " : ""}${(succs.get(String(a.id)) || 0) === 0 ? "No successor" : ""}` }))
  })];

  // 2 Leads / 3 Lags
  const leads = scopedRelationships.filter(r => num(r.lag) < 0);
  const lags = scopedRelationships.filter(r => num(r.lag) > 0);
  const relDen = scopedRelationships.length;
  checks.push(result({ number: 2, id: "leads", name: "Leads", status: pct(leads.length, relDen) <= t.leadPctMax ? "PASS" : "FAIL", count: leads.length, denominator: relDen,
    rate: pct(leads.length, relDen), threshold: `≤ ${t.leadPctMax}%`, criterion: "Negative lag/lead relationships should remain within the selected QA profile threshold.",
    details: leads.map(r => ({ relationship: `${r.predId} → ${r.succId}`, type: r.type, lag: `${num(r.lag)}d` })) }));
  const lagRate = pct(lags.length, relDen);
  checks.push(result({ number: 3, id: "lags", name: "Lags", status: lagRate <= t.lagPctMax ? "PASS" : "FAIL", count: lags.length, denominator: relDen,
    rate: lagRate, threshold: `≤ ${t.lagPctMax}%`, criterion: "Positive-lag relationships should remain within the selected QA profile threshold.",
    details: lags.map(r => ({ relationship: `${r.predId} → ${r.succId}`, type: r.type, lag: `${num(r.lag)}d` })) }));

  // 4 Relationship types
  const typeCounts = { FS: 0, SS: 0, FF: 0, SF: 0 };
  scopedRelationships.forEach(r => { const t = String(r.type || "FS").toUpperCase(); typeCounts[t] = (typeCounts[t] || 0) + 1; });
  const fsRate = pct(typeCounts.FS, relDen), relPass = relDen === 0 ? false : fsRate >= t.fsPctMin && typeCounts.SF <= t.sfCountMax;
  checks.push(result({ number: 4, id: "relationship-types", name: "Relationship Types", status: relDen ? (relPass ? "PASS" : "FAIL") : "N/A",
    count: relDen - typeCounts.FS, denominator: relDen, rate: fsRate, threshold: `≥ ${t.fsPctMin}% FS; SF ≤ ${t.sfCountMax}`, criterion: "Finish-to-Start should dominate detailed logic and Start-to-Finish should be avoided.",
    details: Object.entries(typeCounts).map(([type, count]) => ({ type, count, percentage: `${pct(count, relDen).toFixed(1)}%` })), note: relDen ? "Rate shown is the FS percentage." : "No eligible relationships." }));

  // 5 Hard constraints
  const hard = incomplete.filter(hardConstraint), hardRate = pct(hard.length, incomplete.length);
  checks.push(result({ number: 5, id: "hard-constraints", name: "Hard Constraints", status: hardRate <= t.hardConstraintPctMax ? "PASS" : "FAIL", count: hard.length, denominator: incomplete.length,
    rate: hardRate, threshold: `≤ ${t.hardConstraintPctMax}%`, criterion: "Hard constraints on incomplete tasks should be used sparingly.",
    details: hard.map(a => ({ activity: activityText(a), constraint: a.constraintType || a.secondaryConstraintType, date: isoDate(a.constraintDate || a.secondaryConstraintDate) || "" })) }));

  // 6 High float / 7 Negative float / 8 High duration
  const highFloat = incomplete.filter(a => num(a.totalFloat) > t.highFloatLimitDays), highFloatRate = pct(highFloat.length, incomplete.length);
  checks.push(result({ number: 6, id: "high-float", name: "High Float", status: highFloatRate <= t.highFloatPctMax ? "PASS" : "FAIL", count: highFloat.length, denominator: incomplete.length,
    rate: highFloatRate, threshold: `≤ ${t.highFloatPctMax}% (>${t.highFloatLimitDays}d)`, criterion: `Incomplete tasks with total float greater than ${t.highFloatLimitDays} working days.`,
    details: highFloat.map(a => ({ activity: activityText(a), totalFloat: `${num(a.totalFloat).toFixed(1)}d`, wbs: a.wbsPath || "" })) }));
  const negative = incomplete.filter(a => num(a.totalFloat) < 0), negativeRate = pct(negative.length, incomplete.length);
  checks.push(result({ number: 7, id: "negative-float", name: "Negative Float", status: negativeRate <= t.negativeFloatPctMax ? "PASS" : "FAIL", count: negative.length, denominator: incomplete.length,
    rate: negativeRate, threshold: `≤ ${t.negativeFloatPctMax}%`, criterion: "Incomplete tasks should not carry material negative total float.",
    details: negative.map(a => ({ activity: activityText(a), totalFloat: `${num(a.totalFloat).toFixed(1)}d`, finish: isoDate(a.currentFinish || a.finish) || "" })) }));
  const long = incomplete.filter(a => num(a.originalDuration) > t.durationLimitDays), longRate = pct(long.length, incomplete.length);
  checks.push(result({ number: 8, id: "high-duration", name: "High Duration", status: longRate <= t.highDurationPctMax ? "PASS" : "FAIL", count: long.length, denominator: incomplete.length,
    rate: longRate, threshold: `≤ ${t.highDurationPctMax}% (>${t.durationLimitDays}d)`, criterion: `Incomplete baseline/original durations over ${t.durationLimitDays} working days should be limited.`,
    details: long.map(a => ({ activity: activityText(a), duration: `${num(a.originalDuration).toFixed(1)}d`, wbs: a.wbsPath || "" })) }));

  // 9 Invalid dates
  const invalid = [];
  if (dataDate) {
    for (const a of activities) {
      const forecastStart = dateOnly(a.currentStart || a.start), forecastFinish = dateOnly(a.currentFinish || a.finish), actualStart = dateOnly(a.actualStart), actualFinish = dateOnly(a.actualFinish);
      if (!isComplete(a) && forecastStart && forecastStart < dataDate && !actualStart) invalid.push({ activity: activityText(a), issue: "Forecast start before data date", date: isoDate(forecastStart) });
      if (!isComplete(a) && forecastFinish && forecastFinish < dataDate && !actualFinish) invalid.push({ activity: activityText(a), issue: "Forecast finish before data date", date: isoDate(forecastFinish) });
      if (actualStart && actualStart > dataDate) invalid.push({ activity: activityText(a), issue: "Actual start after data date", date: isoDate(actualStart) });
      if (actualFinish && actualFinish > dataDate) invalid.push({ activity: activityText(a), issue: "Actual finish after data date", date: isoDate(actualFinish) });
    }
  }
  checks.push(result({ number: 9, id: "invalid-dates", name: "Invalid Dates", status: dataDate ? (invalid.length <= t.invalidDateCountMax ? "PASS" : "FAIL") : "N/A", count: invalid.length, denominator: activities.length,
    rate: pct(invalid.length, activities.length), threshold: `≤ ${t.invalidDateCountMax} invalid dates`, criterion: "No future actuals and no unactualised forecast dates in the past.", details: invalid,
    note: dataDate ? "" : "Schedule data date is unavailable." }));

  // 10 Resources
  const anyLoading = (schedule.assignments || []).length > 0 || activities.some(a => num(a.budgetUnits) || num(a.actualUnits) || num(a.remainingUnits) || num(a.budgetCost) || num(a.actualCost) || num(a.remainingCost));
  const resourceScope = incomplete.filter(positiveDuration);
  const missingResource = resourceScope.filter(a => !(a.assignments?.length || num(a.budgetUnits) || num(a.actualUnits) || num(a.remainingUnits) || num(a.budgetCost) || num(a.actualCost) || num(a.remainingCost)));
  checks.push(result({ number: 10, id: "resources", name: "Resources", status: !anyLoading ? "N/A" : (pct(missingResource.length, resourceScope.length) <= t.resourceMissingPctMax ? "PASS" : "FAIL"), count: missingResource.length, denominator: resourceScope.length,
    rate: pct(missingResource.length, resourceScope.length), threshold: `≤ ${t.resourceMissingPctMax}% missing when resource/cost loaded`, criterion: "Positive-duration incomplete tasks should carry hours or currency when the IMS is resource/cost loaded.",
    details: missingResource.map(a => ({ activity: activityText(a), wbs: a.wbsPath || "", issue: "No resource/cost loading" })), note: anyLoading ? "" : "Schedule does not appear to be resource/cost loaded; metric is N/A." }));

  // 11 Missed tasks
  const due = scope.filter(a => dataDate && dateOnly(a.baselineFinish) && dateOnly(a.baselineFinish) <= dataDate);
  const missed = due.filter(a => {
    const baseline = dateOnly(a.baselineFinish), actual = dateOnly(a.actualFinish), forecast = dateOnly(a.currentFinish || a.finish);
    if (actual) return actual > baseline;
    return !isComplete(a) || (forecast && forecast > baseline);
  });
  const missedRate = pct(missed.length, due.length);
  checks.push(result({ number: 11, id: "missed-tasks", name: "Missed Tasks", status: due.length ? (missedRate <= t.missedTaskPctMax ? "PASS" : "FAIL") : "N/A", count: missed.length, denominator: due.length,
    rate: missedRate, threshold: `≤ ${t.missedTaskPctMax}%`, criterion: "Tasks due by the data date that finished/forecast later than baseline.",
    details: missed.map(a => ({ activity: activityText(a), baselineFinish: isoDate(a.baselineFinish) || "", currentFinish: isoDate(a.actualFinish || a.currentFinish || a.finish) || "" })),
    note: due.length ? "" : "No baselined tasks are due by the data date." }));

  // 12 Critical Path Test — 600-day network proxy.
  const forwardBase = networkForward(schedule);
  const criticalCandidates = incomplete.filter(a => num(a.totalFloat) <= 0 && positiveDuration(a));
  criticalCandidates.sort((a, b) => num(a.totalFloat) - num(b.totalFloat) || num(b.remainingDuration || b.originalDuration) - num(a.remainingDuration || a.originalDuration));
  const testActivity = criticalCandidates[0] || null;
  let cpStatus = "N/A", cpDelta = null, cpDetails = [], cpNote = "";
  if (forwardBase?.cycle) {
    cpStatus = "FAIL"; cpNote = "Network contains a cycle; deterministic critical-path recalculation is not possible.";
  } else if (forwardBase && testActivity) {
    const delayed = networkForward(schedule, testActivity.id, 600);
    cpDelta = delayed?.projectDuration != null ? delayed.projectDuration - forwardBase.projectDuration : null;
    cpStatus = cpDelta != null && Math.abs(cpDelta - 600) <= 1 ? "PASS" : "FAIL";
    cpDetails = [{ activity: activityText(testActivity), injectedDelay: "600d", calculatedProjectDelay: cpDelta == null ? "—" : `${cpDelta.toFixed(1)}d` }];
    cpNote = "Static network proxy; calendars and P6 constraint recalculation are not simulated.";
  } else cpNote = "No eligible critical/zero-float positive-duration activity was found.";
  checks.push(result({ number: 12, id: "critical-path-test", name: "Critical Path Test", status: cpStatus, count: cpStatus === "FAIL" ? 1 : 0, denominator: testActivity ? 1 : 0,
    value: cpDelta, threshold: "600d injected ≈ 600d project delay", criterion: "A large delay on a critical task should propagate proportionally to project completion.", details: cpDetails, note: cpNote }));

  // 13 CPLI
  const projectFinishActivity = activities.reduce((best, a) => {
    const d = dateOnly(a.currentFinish || a.finish); if (!d) return best;
    if (!best) return a; const bd = dateOnly(best.currentFinish || best.finish); return !bd || d > bd ? a : best;
  }, null);
  const criticalPathLength = forwardBase?.projectDuration || 0;
  const finishFloat = num(projectFinishActivity?.totalFloat);
  const cpli = criticalPathLength > EPS ? (criticalPathLength + finishFloat) / criticalPathLength : null;
  checks.push(result({ number: 13, id: "cpli", name: "CPLI", status: cpli == null ? "N/A" : (cpli >= t.cpliMin ? "PASS" : "FAIL"), count: cpli != null && cpli < 1 ? 1 : 0, denominator: cpli == null ? 0 : 1,
    value: cpli, threshold: `≥ ${Number(t.cpliMin).toFixed(2)}`, criterion: "(Critical Path Length + project-end total float) / Critical Path Length.",
    details: cpli == null ? [] : [{ criticalPathLength: `${criticalPathLength.toFixed(1)}d`, projectFinishFloat: `${finishFloat.toFixed(1)}d`, cpli: cpli.toFixed(3) }],
    note: "Uses the normalized static logic-network critical-path length." }));

  // 14 BEI
  const beiDen = scope.filter(a => dataDate && dateOnly(a.baselineFinish) && dateOnly(a.baselineFinish) <= dataDate);
  const beiNum = beiDen.filter(a => {
    const actual = dateOnly(a.actualFinish), baseline = dateOnly(a.baselineFinish);
    return actual && baseline && actual <= baseline;
  });
  const bei = beiDen.length ? beiNum.length / beiDen.length : null;
  checks.push(result({ number: 14, id: "bei", name: "BEI", status: bei == null ? "N/A" : (bei >= t.beiMin ? "PASS" : "FAIL"), count: beiNum.length, denominator: beiDen.length,
    value: bei, rate: bei == null ? null : bei * 100, threshold: `≥ ${Number(t.beiMin).toFixed(2)}`, criterion: "Baseline tasks completed on/before baseline finish ÷ baseline tasks planned complete by data date.",
    details: beiDen.filter(a => !beiNum.includes(a)).map(a => ({ activity: activityText(a), baselineFinish: isoDate(a.baselineFinish) || "", actualFinish: isoDate(a.actualFinish) || "Not complete" })),
    note: bei == null ? "No baseline completions are due by the data date." : "" }));

  const pass = checks.filter(c => c.status === "PASS").length;
  const fail = checks.filter(c => c.status === "FAIL").length;
  const na = checks.filter(c => c.status === "N/A").length;
  const assessed = pass + fail;
  return {
    checks,
    summary: { pass, fail, na, assessed, total: 14, scorePct: assessed ? pass / assessed * 100 : 0, overall: fail ? "FAIL" : assessed ? "PASS" : "N/A" },
    metadata: { dataDate: isoDate(schedule?.dataDate) || "", baselineAvailable, baselineCoverage: coverage.rate, baselineTasks: coverage.baseline, positiveDurationTasks: coverage.eligible, scopedActivities: scope.length, profileId: profile?.id || "dcma-standard", profileName: profile?.name || "DCMA / NASA-style" }
  };
}
