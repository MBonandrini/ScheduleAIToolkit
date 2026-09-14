/**
 * Schedule Builder post-generation pipeline.
 *
 * AI providers create an initial schedule draft.  This module then applies a
 * deterministic nine-stage project-controls pipeline so the user can see what
 * the toolkit is doing and so important controls do not depend on model output.
 * The functions are intentionally DOM-free and can be exercised in Node tests.
 */
import { addDays, isoDate, parseDate } from "../core/utils.js";
import { addWorkingDays, calendarHolidaySet } from "../analysis/holidays.js";

export const BUILDER_PIPELINE_STEPS = [
  "Build WBS",
  "Build Calendars",
  "Create Activities",
  "Assign Calendars",
  "Assign Durations",
  "Assign links and logic",
  "Ensure works fit within milestones",
  "Run logic tests",
  "Run detailed checks and apply changes",
];

const RESPONSIBILITY_CODES = new Map([
  ["client", "CL"],
  ["project manager", "PM"],
  ["designer / consultant", "DES"],
  ["main contractor", "MC"],
  ["subcontractor", "SC"],
  ["vendor / oem", "VEN"],
  ["commissioning agent", "CX"],
  ["other", "OTH"],
]);

const DISCIPLINE_CODES = new Map([
  ["project / general", "GEN"],
  ["civil / structural", "CSA"],
  ["architectural", "ARC"],
  ["mechanical", "MEC"],
  ["electrical", "ELE"],
  ["instrumentation & controls", "IC"],
  ["process", "PRO"],
  ["fire protection", "FIR"],
  ["ict / elv", "ICT"],
  ["security", "SEC"],
  ["commissioning", "CXM"],
]);

function compactCode(value, length = 3) {
  const clean = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .trim();
  if (!clean) return "GEN".slice(0, length);
  const words = clean.split(/\s+/).filter(Boolean);
  const initials = words.map((x) => x[0]).join("");
  return (initials.length >= 2 ? initials : clean.replace(/\s+/g, "")).slice(0, length);
}

function responsibilityCode(value) {
  const key = String(value || "").trim().toLowerCase();
  return RESPONSIBILITY_CODES.get(key) || compactCode(value, 3);
}

function disciplineCode(value) {
  const key = String(value || "").trim().toLowerCase();
  return DISCIPLINE_CODES.get(key) || compactCode(value, 3);
}

function wbsParts(row) {
  return String(row.wbs || row.wbsPath || "")
    .split(/\s*\/\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function inferArea(row) {
  if (row.area) return String(row.area);
  const parts = wbsParts(row);
  const candidate = parts.find((x) => /area|zone|room|building|block|module|sector/i.test(x));
  return candidate || parts.at(-1) || "Project";
}

function inferElevation(row) {
  if (row.elevation || row.level) return String(row.elevation || row.level);
  const parts = wbsParts(row);
  return parts.find((x) => /(^|\b)(level|lvl|floor|fl|roof|basement|ground|mezz|l\d+)/i.test(x)) || "General";
}

function inferService(row) {
  if (row.service) return String(row.service);
  return String(row.discipline || "General");
}

function activityStep(row) {
  if (row.step) return String(row.step);
  const name = String(row.name || "Activity").trim();
  const parts = name.split(/\s+-\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.length >= 5 ? parts.slice(4).join(" - ") : name;
}

function structuredName(row) {
  const existing = String(row.name || "").split(/\s+-\s+/).filter(Boolean);
  if (existing.length >= 5) return String(row.name).trim();
  return [inferArea(row), inferElevation(row), row.discipline || "General", inferService(row), activityStep(row)]
    .map((x) => String(x || "General").trim())
    .join(" - ");
}

function calendarYears(wizard) {
  const dates = [wizard.projectStart, ...(wizard.milestones || []).map((m) => m.date)]
    .map(parseDate)
    .filter(Boolean);
  const min = dates.length ? Math.min(...dates.map((d) => d.getFullYear())) : new Date().getFullYear();
  const max = dates.length ? Math.max(...dates.map((d) => d.getFullYear())) : min + 3;
  const years = [];
  for (let year = min - 1; year <= max + 4; year += 1) years.push(year);
  return years;
}

function calendarOptions(calendar, wizard) {
  const customDates = String(calendar.customHolidays || "")
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return {
    workingDays: calendar.workingDays || [1, 2, 3, 4, 5],
    holidaySet: calendarHolidaySet({
      country: calendar.includePublicHolidays ? calendar.country : "NONE",
      years: calendarYears(wizard),
      customDates,
    }),
  };
}

function chooseCalendar(row, calendars) {
  if (!calendars.length) return null;
  const explicit = calendars.find((c) => c.name === row.calendar);
  if (explicit) return explicit;
  const haystack = `${row.phase || ""} ${row.discipline || ""} ${row.wbs || ""}`.toLowerCase();
  const matched = calendars.find((c) => {
    const rule = String(c.appliesTo || "").trim().toLowerCase();
    return rule && !/^(all|all disciplines|all disciplines \/ phases)$/.test(rule) && haystack.includes(rule);
  });
  return matched || calendars.find((c) => /^(all|all disciplines|all disciplines \/ phases)$/i.test(String(c.appliesTo || ""))) || calendars[0];
}

function predecessorTokens(value) {
  return String(value || "")
    .split(/[;,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/^([^:]+)(?::(FS|SS|FF|SF))?(?:\s*([+-]\s*\d+(?:\.\d+)?)\s*d?)?$/i);
      if (!match) return { raw, id: raw, type: "FS", lag: 0 };
      return {
        raw,
        id: match[1].trim(),
        type: (match[2] || "FS").toUpperCase(),
        lag: Number(String(match[3] || "0").replace(/\s+/g, "")) || 0,
      };
    });
}

function predecessorString(tokens) {
  return tokens.map((token) => `${token.id}:${token.type}${token.lag ? `${token.lag > 0 ? "+" : ""}${token.lag}d` : ""}`).join(", ");
}

function cycleNodes(rows) {
  const ids = new Set(rows.map((row) => row.id));
  const incoming = new Map(rows.map((row) => [row.id, 0]));
  const outgoing = new Map(rows.map((row) => [row.id, []]));
  for (const row of rows) {
    for (const pred of predecessorTokens(row.predecessors)) {
      if (!ids.has(pred.id) || pred.id === row.id) continue;
      incoming.set(row.id, (incoming.get(row.id) || 0) + 1);
      outgoing.get(pred.id)?.push(row.id);
    }
  }
  const queue = [...incoming.entries()].filter(([, n]) => n === 0).map(([id]) => id);
  const visited = [];
  while (queue.length) {
    const id = queue.shift();
    visited.push(id);
    for (const next of outgoing.get(id) || []) {
      const n = (incoming.get(next) || 0) - 1;
      incoming.set(next, n);
      if (n === 0) queue.push(next);
    }
  }
  return visited.length === rows.length ? [] : [...incoming.entries()].filter(([, n]) => n > 0).map(([id]) => id);
}

function stageBuildWbs(rows) {
  let changed = 0;
  for (const row of rows) {
    if (!row.wbs) {
      row.wbs = [row.phase || "Project", row.discipline || "General", row.area || "General"]
        .filter(Boolean)
        .join(" / ");
      changed += 1;
    }
  }
  return `${rows.length} activities mapped to WBS paths; ${changed} missing WBS path(s) created.`;
}

function stageBuildCalendars(rows, wizard, context) {
  const calendars = (wizard.calendars || []).filter((c) => c?.name);
  context.calendars = calendars;
  context.calendarOptions = new Map(calendars.map((c) => [c.name, calendarOptions(c, wizard)]));
  return `${calendars.length} project calendar(s) prepared with working-week and holiday rules.`;
}

function stageCreateActivities(rows, wizard, context) {
  const oldToNew = new Map();
  const used = new Set();
  let sequence = 10;
  for (const row of rows) {
    const oldId = String(row.id || "").trim();
    row.area = inferArea(row);
    row.elevation = inferElevation(row);
    row.service = inferService(row);
    row.step = activityStep(row);
    row.name = structuredName(row);
    const prefix = `${row.milestone ? "M" : "A"}-${responsibilityCode(row.responsible)}-${disciplineCode(row.discipline)}`;
    let id = `${prefix}-${String(sequence).padStart(4, "0")}`;
    while (used.has(id)) {
      sequence += 10;
      id = `${prefix}-${String(sequence).padStart(4, "0")}`;
    }
    used.add(id);
    row.id = id;
    if (oldId) oldToNew.set(oldId, id);
    sequence += 10;
  }
  context.oldToNew = oldToNew;
  for (const row of rows) {
    const rewritten = predecessorTokens(row.predecessors).map((token) => ({
      ...token,
      id: oldToNew.get(token.id) || token.id,
    }));
    row.predecessors = predecessorString(rewritten);
  }
  return `${rows.length} structured activity names and responsibility-aware smart IDs created.`;
}

function stageAssignCalendars(rows, wizard, context) {
  let assigned = 0;
  for (const row of rows) {
    const calendar = chooseCalendar(row, context.calendars || []);
    if (calendar) {
      row.calendar = calendar.name;
      assigned += 1;
    }
  }
  return `${assigned} activity calendar assignment(s) validated/applied.`;
}

function defaultDuration(row, wizard) {
  if (row.milestone) return 0;
  const level = wizard.detailLevel === "Level 5" ? 3 : wizard.detailLevel === "Level 4" ? 5 : 10;
  if (/review|approve|inspect|test/i.test(row.step || row.name || "")) return Math.max(1, Math.round(level * 0.6));
  return level;
}

function stageAssignDurations(rows, wizard) {
  let defaulted = 0;
  for (const row of rows) {
    if (row.milestone) {
      row.duration = 0;
      continue;
    }
    const duration = Number(row.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      row.duration = defaultDuration(row, wizard);
      defaulted += 1;
    } else {
      row.duration = Math.max(1, Math.round(duration * 10) / 10);
    }
  }
  return `${rows.length} duration(s) checked; ${defaulted} missing/invalid duration(s) defaulted.`;
}

function stageAssignLogic(rows) {
  const ids = new Set(rows.map((row) => row.id));
  const lastByStream = new Map();
  let repaired = 0;
  let added = 0;
  for (const row of rows) {
    const clean = [];
    const seen = new Set();
    for (const pred of predecessorTokens(row.predecessors)) {
      if (!ids.has(pred.id) || pred.id === row.id || seen.has(`${pred.id}|${pred.type}|${pred.lag}`)) {
        repaired += 1;
        continue;
      }
      seen.add(`${pred.id}|${pred.type}|${pred.lag}`);
      clean.push(pred);
    }
    const stream = `${row.phase || ""}|${row.discipline || ""}|${row.wbs || ""}`;
    if (!clean.length && lastByStream.has(stream) && !row.milestone) {
      clean.push({ id: lastByStream.get(stream), type: "FS", lag: 0 });
      added += 1;
    }
    row.predecessors = predecessorString(clean);
    lastByStream.set(stream, row.id);
  }
  return `${repaired} invalid/duplicate logic reference(s) removed; ${added} missing stream link(s) added.`;
}

function recalculateDates(rows, wizard, context) {
  const startFallback = parseDate(wizard.projectStart) || new Date();
  const byId = new Map(rows.map((row) => [row.id, row]));
  const finishById = new Map();
  for (const row of rows) {
    const calendar = context.calendars?.find((c) => c.name === row.calendar) || context.calendars?.[0];
    const options = context.calendarOptions?.get(calendar?.name) || { workingDays: [1, 2, 3, 4, 5], holidaySet: new Map() };
    let start = parseDate(row.start) || startFallback;
    for (const pred of predecessorTokens(row.predecessors)) {
      const predFinish = finishById.get(pred.id) || parseDate(byId.get(pred.id)?.finish);
      if (predFinish && pred.type === "FS") {
        const candidate = addWorkingDays(predFinish, Math.max(1, pred.lag + 1), options);
        if (candidate > start) start = candidate;
      }
    }
    row.start = isoDate(start);
    const finish = row.milestone || Number(row.duration) === 0
      ? start
      : addWorkingDays(addDays(start, -1), Math.max(1, Math.round(Number(row.duration) || 1)), options);
    row.finish = isoDate(finish);
    finishById.set(row.id, finish);
  }
}

function stageFitMilestones(rows, wizard, context) {
  const milestones = (wizard.milestones || [])
    .filter((m) => m.name && parseDate(m.date))
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const rowMilestones = rows.filter((row) => row.milestone);
  for (const target of milestones) {
    const match = rowMilestones.find((row) => String(row.step || row.name).toLowerCase().includes(String(target.name).toLowerCase()));
    if (match) {
      match.start = target.date;
      match.finish = target.date;
      match.duration = 0;
    }
  }
  recalculateDates(rows, wizard, context);
  const finalMilestone = milestones.at(-1);
  if (!finalMilestone) return "No fixed milestone dates supplied; network dates recalculated without a final date constraint.";
  const limit = parseDate(finalMilestone.date);
  const overruns = rows.filter((row) => !row.milestone && parseDate(row.finish) > limit);
  if (overruns.length) {
    context.warnings.push(`${overruns.length} activity/activities currently extend beyond ${finalMilestone.name} (${finalMilestone.date}).`);
  }
  return overruns.length
    ? `${overruns.length} activity/activities flagged beyond the latest fixed milestone; dates retained for planner review rather than silently compressing scope.`
    : `All generated work currently completes within the latest fixed milestone (${finalMilestone.date}).`;
}

function stageLogicTests(rows, context) {
  const ids = new Set(rows.map((row) => row.id));
  let invalid = 0;
  for (const row of rows) {
    for (const pred of predecessorTokens(row.predecessors)) {
      if (!ids.has(pred.id) || pred.id === row.id) invalid += 1;
    }
  }
  let cycles = cycleNodes(rows);
  let broken = 0;
  let guard = 0;
  while (cycles.length && guard++ < rows.length) {
    const row = rows.find((x) => x.id === cycles[0]);
    const preds = predecessorTokens(row?.predecessors);
    if (!row || !preds.length) break;
    preds.pop();
    row.predecessors = predecessorString(preds);
    broken += 1;
    cycles = cycleNodes(rows);
  }
  if (invalid) context.warnings.push(`${invalid} invalid relationship reference(s) remained after logic normalisation.`);
  if (broken) context.warnings.push(`${broken} relationship(s) removed to break circular logic.`);
  return `Logic test complete: ${invalid} invalid reference(s), ${broken} cycle-breaking repair(s), ${cycles.length ? cycles.length : 0} unresolved cycle node(s).`;
}

function stageDetailedChecks(rows, wizard, context) {
  const seen = new Set();
  let fixes = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.id || seen.has(row.id)) {
      row.id = `A-GEN-${String((i + 1) * 10).padStart(4, "0")}`;
      fixes += 1;
    }
    seen.add(row.id);
    if (!row.name) {
      row.name = structuredName(row);
      fixes += 1;
    }
    if (!row.calendar && context.calendars?.[0]) {
      row.calendar = context.calendars[0].name;
      fixes += 1;
    }
    if (row.milestone && Number(row.duration) !== 0) {
      row.duration = 0;
      fixes += 1;
    }
  }
  recalculateDates(rows, wizard, context);
  const openStart = rows.filter((row) => !row.milestone && !String(row.predecessors || "").trim()).length;
  if (openStart > 1) context.warnings.push(`${openStart} non-milestone activities have no predecessors and may represent open starts.`);
  return `${fixes} final consistency repair(s) applied. ${openStart} non-milestone open-start candidate(s) remain for planner review.`;
}

const STAGES = [
  stageBuildWbs,
  stageBuildCalendars,
  stageCreateActivities,
  stageAssignCalendars,
  stageAssignDurations,
  stageAssignLogic,
  stageFitMilestones,
  stageLogicTests,
  stageDetailedChecks,
];

/**
 * Run the nine schedule-construction stages in order.
 * `onStep` is called before and after each stage so the UI can animate genuine
 * progress without artificial timers.  Returning warnings separately keeps
 * automated fixes distinguishable from items that still require planner review.
 */
export async function runBuilderPipeline(inputRows, wizard, { onStep } = {}) {
  const rows = (inputRows || []).map((row) => ({ ...row }));
  const context = { warnings: [], calendars: [], calendarOptions: new Map(), oldToNew: new Map() };
  const results = [];
  for (let index = 0; index < STAGES.length; index += 1) {
    const label = BUILDER_PIPELINE_STEPS[index];
    await onStep?.({ index, label, status: "running", rows, context });
    const detail = STAGES[index](rows, wizard, context);
    results.push({ index, label, detail });
    await onStep?.({ index, label, status: "done", detail, rows, context });
  }
  return { rows, results, warnings: [...new Set(context.warnings)] };
}
