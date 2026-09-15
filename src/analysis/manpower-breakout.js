/**
 * Manpower breakout analysis.
 *
 * Converts schedule activities into a construction-only, week-ending-Friday
 * presentation model.  The engine is deliberately deterministic: AI may refine
 * the inferred floor/area/discipline labels, but the date/resource arithmetic
 * remains local and auditable.
 */
import { parseDate, isoDate, addDays, daysBetween } from "../core/utils.js";

const num = v => Number(v || 0);
const text = v => String(v ?? "").trim();
const norm = v => text(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const DISCIPLINES = [
  "Civil / Structural", "Architectural", "Mechanical", "Electrical",
  "Fire Protection", "Instrumentation & Controls", "ICT / ELV", "Process",
  "Commissioning", "General"
];

const DISCIPLINE_RULES = [
  ["Electrical", /\b(electrical|electric|cable|cabling|containment|tray|ladder|busbar|switchgear|panel|mcc|transformer|ups|generator|earthing|grounding|lighting|power)\b/i],
  ["Mechanical", /\b(mechanical|pipe|pipework|piping|hvac|duct|ductwork|chiller|pump|valve|fan|ahu|crac|cooling|heating|plumbing|drainage)\b/i],
  ["Fire Protection", /\b(fire|sprinkler|suppression|vesda|alarm)\b/i],
  ["Instrumentation & Controls", /\b(instrument|controls?|bms|ems|scada|plc|sensor|actuator|controls cabling)\b/i],
  ["ICT / ELV", /\b(ict|elv|data cabling|structured cabling|security|cctv|access control|telecom|network)\b/i],
  ["Civil / Structural", /\b(civil|structural|concrete|rebar|steelwork|steel|excavat|foundation|slab|groundworks?|earthworks?|road|drainage)\b/i],
  ["Architectural", /\b(architect|fit ?out|partition|ceiling|floor finish|painting|doors?|walls?|cladding|roofing)\b/i],
  ["Process", /\b(process|clean utility|process utility|gas|chemical|purified water|wfi)\b/i],
  ["Commissioning", /\b(commission|testing|test |test$|energisation|energization|start[- ]?up|integrated systems|ist\b)\b/i]
];

const EXCLUDE_PHASE = /\b(concept|feasibility|design|engineering|procurement|purchase|submittal|approval|tender|bid|manufactur|factory acceptance|fat\b|shipping|delivery only|handover|closeout)\b/i;
const CONSTRUCTION_HINT = /\b(construction|construct|install|installation|erect|pull|terminate|containment|pipework|piping|duct|concrete|rebar|excavat|fit ?out|cable|panel|equipment|slab|steelwork|commission|test|energisation|energization)\b/i;

export function isConstructionActivity(activity) {
  if (!activity || activity.milestone) return false;
  const hay = `${activity.wbsPath || ""} ${activity.name || ""} ${Object.values(activity.codes || {}).join(" ")}`;
  if (/\bconstruction\b/i.test(activity.wbsPath || "")) return true;
  if (CONSTRUCTION_HINT.test(hay)) return true;
  return !EXCLUDE_PHASE.test(hay);
}

function codeValue(activity, re) {
  const codes = activity?.codes || {};
  for (const [k, v] of Object.entries(codes)) if (re.test(String(k))) return text(v);
  return "";
}

export function inferDiscipline(activity, resourceNames = []) {
  const coded = codeValue(activity, /(discipline|trade|service)/i);
  if (coded) {
    const rule = DISCIPLINE_RULES.find(([, re]) => re.test(coded));
    if (rule) return rule[0];
    return coded;
  }
  const hay = `${activity?.wbsPath || ""} ${activity?.name || ""} ${resourceNames.join(" ")}`;
  return DISCIPLINE_RULES.find(([, re]) => re.test(hay))?.[0] || "General";
}

export function inferFloor(activity) {
  const coded = codeValue(activity, /(floor|level|storey|story)/i);
  if (coded) return coded;
  const hay = `${activity?.wbsPath || ""} ${activity?.name || ""}`;
  const named = hay.match(/\b(ground\s*(?:floor|level)?|basement\s*\d*|mezzanine|roof|penthouse)\b/i);
  if (named) return named[1].replace(/\s+/g, " ").trim();
  const level = hay.match(/\b(?:level|floor|lvl|fl|l)\s*[-_.:]?\s*(b?\d{1,2})\b/i);
  if (level) return `Level ${level[1].toUpperCase()}`;
  return "Project / General";
}

const GENERIC_WBS = /^(project|construction|programme|program|schedule|works?|general|overall|phase\s*\d*|level\s*\w+|floor\s*\w+)$/i;
export function inferArea(activity, floor = "") {
  const coded = codeValue(activity, /(area|sub.?area|zone|room|building|block|location)/i);
  if (coded) return coded;
  const segments = String(activity?.wbsPath || "").split(/\s*\/\s*/).map(x => x.trim()).filter(Boolean);
  const floorNorm = norm(floor);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (norm(seg) === floorNorm || GENERIC_WBS.test(seg)) continue;
    if (seg.length > 2) return seg;
  }
  const room = String(activity?.name || "").match(/\b(?:room|area|zone|block|building)\s+[A-Za-z0-9._-]+\b/i);
  return room?.[0] || "General Area";
}

export function weekEndingFriday(value) {
  const d = parseDate(value);
  if (!d) return "";
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (5 - out.getDay() + 7) % 7;
  out.setDate(out.getDate() + diff);
  return isoDate(out);
}

export function fridaySeries(schedule) {
  const dates = (schedule?.activities || []).flatMap(a => [parseDate(a.currentStart || a.start), parseDate(a.currentFinish || a.finish), parseDate(a.actualStart), parseDate(a.actualFinish)]).filter(Boolean);
  if (!dates.length) return [];
  let cursor = parseDate(weekEndingFriday(new Date(Math.min(...dates.map(d => d.getTime())))));
  const end = parseDate(weekEndingFriday(new Date(Math.max(...dates.map(d => d.getTime())))));
  const out = [];
  let guard = 0;
  while (cursor && end && cursor <= end && guard++ < 1000) {
    out.push(isoDate(cursor));
    cursor = addDays(cursor, 7);
  }
  return out;
}

function assignmentResources(schedule) {
  const resource = new Map((schedule?.resources || []).map(r => [String(r.id), r]));
  const byActivity = new Map();
  for (const x of schedule?.assignments || []) {
    const id = String(x.activityId || x.task_id || "");
    if (!byActivity.has(id)) byActivity.set(id, []);
    byActivity.get(id).push({ ...x, _resource: resource.get(String(x.resourceId || x.rsrc_id || "")) || null });
  }
  return byActivity;
}

function laborAssignments(list = []) {
  const explicitlyLabor = list.filter(x => /labor|labour|rt_labor/i.test(`${x._resource?.type || ""} ${x._resource?.raw?.rsrc_type || ""}`));
  return explicitlyLabor.length ? explicitlyLabor : list;
}

function unitSnapshot(activity, assignments, actualMode) {
  const list = laborAssignments(assignments || []);
  if (list.length) {
    const budget = list.reduce((sum, x) => sum + num(x.target_qty ?? x.budgetUnits), 0);
    const actual = list.reduce((sum, x) => sum + num(x.act_reg_qty ?? x.actualUnits), 0);
    const remaining = list.reduce((sum, x) => sum + num(x.remain_qty ?? x.remainingUnits), 0);
    return { budget, actual, remaining, total: actualMode ? actual : (remaining || budget || actual), resourceNames: list.map(x => x._resource?.name).filter(Boolean) };
  }
  return {
    budget: num(activity?.budgetUnits), actual: num(activity?.actualUnits), remaining: num(activity?.remainingUnits),
    total: actualMode ? num(activity?.actualUnits) : (num(activity?.remainingUnits) || num(activity?.budgetUnits) || num(activity?.actualUnits)),
    resourceNames: []
  };
}

function rangeFor(activity, schedule, actualMode) {
  if (actualMode) {
    const start = parseDate(activity.actualStart);
    if (!start) return null;
    const finish = parseDate(activity.actualFinish) || parseDate(schedule?.dataDate) || parseDate(activity.currentFinish || activity.finish) || start;
    return [start, finish < start ? start : finish];
  }
  const start = parseDate(activity.currentStart || activity.start);
  const finish = parseDate(activity.currentFinish || activity.finish) || start;
  return start ? [start, finish < start ? start : finish] : null;
}

function workingWeeks(range) {
  if (!range) return 1;
  const days = Math.max(1, daysBetween(range[0], range[1]) + 1);
  return Math.max(1, Math.ceil(days / 7));
}

function intersectsWeek(range, friday) {
  if (!range) return false;
  const f = parseDate(friday), monday = addDays(f, -4);
  return range[0] <= f && range[1] >= monday;
}

export function classifyActivities(schedule, overrides = {}) {
  const byAssignment = assignmentResources(schedule);
  const out = [];
  for (const a of (schedule?.activities || []).filter(isConstructionActivity)) {
    const assignments = byAssignment.get(String(a.id)) || byAssignment.get(String(a.uid)) || [];
    const resources = assignments.map(x => x._resource?.name).filter(Boolean);
    const override = overrides[String(a.id)] || overrides[String(a.wbsPath || "")] || {};
    const floor = override.floor || inferFloor(a);
    out.push({
      activity: a,
      floor,
      area: override.area || inferArea(a, floor),
      discipline: override.discipline || inferDiscipline(a, resources),
      resourceNames: resources
    });
  }
  return out;
}

export function wbsClassificationPrompt(schedule, limit = 500) {
  const paths = [...new Set((schedule?.activities || []).filter(isConstructionActivity).map(a => a.wbsPath || "Unassigned"))].slice(0, limit);
  return `Classify these CONSTRUCTION WBS paths for a project-controls manpower breakout dashboard.
Return JSON only, no markdown, using this exact shape:
{"mappings":[{"wbs":"exact input WBS path","floor":"floor/level","area":"construction area/zone","discipline":"one of: ${DISCIPLINES.join(", ")}"}]}
Do not invent activity IDs. Keep the input WBS string exactly unchanged. If a floor or area is not explicit, use "Project / General" or "General Area".
WBS paths:\n${paths.map(x => `- ${x}`).join("\n")}`;
}

export function parseClassificationResponse(raw = "") {
  const stripped = String(raw).replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = stripped.indexOf("{"), end = stripped.lastIndexOf("}");
  if (start < 0 || end < start) return {};
  try {
    const data = JSON.parse(stripped.slice(start, end + 1));
    const out = {};
    for (const m of data?.mappings || []) if (m?.wbs) out[String(m.wbs)] = { floor: text(m.floor), area: text(m.area), discipline: text(m.discipline) };
    return out;
  } catch { return {}; }
}

export function buildWeeklyBreakout(schedule, friday, { actualMode = false, overrides = {}, hoursPerPerson = 45 } = {}) {
  const classified = classifyActivities(schedule, overrides);
  const byAssignment = assignmentResources(schedule);
  const rows = [];
  for (const c of classified) {
    const a = c.activity, range = rangeFor(a, schedule, actualMode);
    if (!intersectsWeek(range, friday)) continue;
    const assignments = byAssignment.get(String(a.id)) || byAssignment.get(String(a.uid)) || [];
    const units = unitSnapshot(a, assignments, actualMode);
    const hours = units.total > 0 ? units.total / workingWeeks(range) : 0;
    rows.push({
      id: a.id, name: a.name, wbs: a.wbsPath || "Unassigned", floor: c.floor, area: c.area,
      discipline: c.discipline, start: isoDate(range?.[0]), finish: isoDate(range?.[1]), status: a.status,
      percent: num(a.percent), hours, people: hoursPerPerson > 0 ? hours / hoursPerPerson : 0,
      resourceNames: units.resourceNames
    });
  }
  const areas = new Map();
  for (const row of rows) {
    const key = `${row.floor}|||${row.area}`;
    if (!areas.has(key)) areas.set(key, { floor: row.floor, area: row.area, hours: 0, people: 0, disciplines: new Set(), activities: 0 });
    const x = areas.get(key); x.hours += row.hours; x.people += row.people; x.disciplines.add(row.discipline); x.activities++;
  }
  return {
    friday: isoDate(friday), actualMode, hoursPerPerson,
    rows,
    areas: [...areas.values()].map(x => ({ ...x, disciplines: [...x.disciplines] }))
  };
}

export function matchFloorLabel(scheduleFloor, layoutLabel, layoutCount = 1) {
  if (layoutCount <= 1) return true;
  const a = norm(scheduleFloor), b = norm(layoutLabel);
  if (!b || /^(all|project|general|all project)$/.test(b)) return true;
  return a === b || a.includes(b) || b.includes(a);
}

export function monthsFromFridays(fridays = []) {
  const seen = new Set();
  return fridays.map(x => x.slice(0, 7)).filter(x => x && !seen.has(x) && seen.add(x));
}
