/**
 * Higher-level forensic explorers built on the canonical comparison/network
 * engines. These routines return evidence records only; UI rendering is kept in
 * the application layer so every result remains exportable and testable.
 */
import { compareSchedules } from "./comparison.js";
import { buildForensicEvidence } from "./forensics.js";
import { longestPath, drivingChain, buildNetwork } from "./network.js";
import { daysBetween, isoDate, parseDate } from "../core/utils.js";

const n = v => Number(v || 0);
const key = r => `${r.predId}|${r.succId}`;
const relText = r => r ? `${String(r.type || "FS").toUpperCase()} ${n(r.lag) >= 0 ? "+" : ""}${n(r.lag).toFixed(1)}d` : "—";
const activityLabel = a => `${a?.id || ""} · ${a?.name || ""}`.trim();

export function logicChanges(previous, current) {
  const p = new Map();
  const c = new Map();
  for (const r of previous?.relationships || []) {
    const k = key(r); if (!p.has(k)) p.set(k, []); p.get(k).push(r);
  }
  for (const r of current?.relationships || []) {
    const k = key(r); if (!c.has(k)) c.set(k, []); c.get(k).push(r);
  }
  const added = [], removed = [], changed = [];
  for (const pair of new Set([...p.keys(), ...c.keys()])) {
    const old = [...(p.get(pair) || [])];
    const now = [...(c.get(pair) || [])];
    const used = new Set();
    for (const a of old) {
      const i = now.findIndex((b, idx) => !used.has(idx) && relText(a) === relText(b));
      if (i >= 0) used.add(i);
      else {
        const j = now.findIndex((_, idx) => !used.has(idx));
        if (j >= 0) { used.add(j); changed.push({ before: a, after: now[j], pair }); }
        else removed.push(a);
      }
    }
    now.forEach((r, idx) => { if (!used.has(idx)) added.push(r); });
  }
  return { added, removed, changed };
}

export function calendarDifferences(previous, current) {
  const comp = compareSchedules(previous, current);
  const pActs = new Map((previous?.activities || []).map(a => [String(a.id), a]));
  const assignments = [];
  for (const a of current?.activities || []) {
    const old = pActs.get(String(a.id));
    if (!old) continue;
    const before = old.calendarName || old.calendarId || "";
    const after = a.calendarName || a.calendarId || "";
    if (String(before) !== String(after)) assignments.push({ activityId: String(a.id), activity: activityLabel(a), before, after, wbs: a.wbsPath || "" });
  }
  return { ...comp.calendars, assignments };
}

export function resourceForensics(previous, current) {
  const evidence = buildForensicEvidence([previous, current]);
  const transition = evidence.transitions[0]?.label || `${isoDate(previous?.dataDate)} → ${isoDate(current?.dataDate)}`;
  return {
    transition,
    totals: evidence.resourcing.totals,
    masterRows: evidence.resourcing.masterRows,
    assignmentRows: evidence.resourcing.rows,
    chartRows: evidence.resourcing.chartRows,
    summary: {
      resourcesAdded: evidence.resourcing.added,
      resourcesRemoved: evidence.resourcing.removed,
      resourcesChanged: evidence.resourcing.changed,
      assignmentsChanged: evidence.resourcing.rows.length
    }
  };
}

export function windowsAnalysis(schedules = []) {
  const ordered = schedules.filter(Boolean).slice().sort((a, b) => (parseDate(a.dataDate)?.getTime() || 0) - (parseDate(b.dataDate)?.getTime() || 0));
  const windows = [];
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1], current = ordered[i], comp = compareSchedules(previous, current);
    const adverse = comp.changed.filter(x => n(x.finishDays) > 0 || n(x.startDays) > 0 || n(x.durationDays) > 0 || x.calendarChanged || x.resourceChanged || x.constraintChanged)
      .sort((a, b) => Math.max(n(b.finishDays), n(b.startDays), n(b.durationDays)) - Math.max(n(a.finishDays), n(a.startDays), n(a.durationDays)));
    windows.push({
      index: i,
      label: `${isoDate(previous.dataDate) || previous.name || `Revision ${i}`} → ${isoDate(current.dataDate) || current.name || `Revision ${i + 1}`}`,
      previous,
      current,
      dataDateDays: comp.summary.dataDateDays || 0,
      finishMovementDays: comp.summary.forecastFinishDays || 0,
      progressPoints: comp.summary.progressPoints || 0,
      activitiesAdded: comp.added.length,
      activitiesRemoved: comp.deleted.length,
      logicAdded: comp.relationshipAdded.length,
      logicRemoved: comp.relationshipDeleted.length,
      calendarChanges: comp.calendars.changed.length + comp.calendars.added.length + comp.calendars.deleted.length,
      resourceChanges: comp.resources.changed.length + comp.resources.added.length + comp.resources.deleted.length + comp.resourceAssignments.changed.length + comp.resourceAssignments.added.length + comp.resourceAssignments.deleted.length,
      criticalEntered: comp.migration?.entered?.length || 0,
      criticalLeft: comp.migration?.left?.length || 0,
      adverse
    });
  }
  return { ordered, windows };
}

export function analyticalFloatPaths(schedule, count = 5) {
  const g = buildNetwork(schedule);
  const terminals = [...g.activities.values()].filter(a => (g.outgoing.get(a.id) || []).length === 0);
  const candidates = [];
  for (const end of terminals) {
    const lp = longestPath(schedule, end.id);
    if (!lp.path?.length) continue;
    const signature = lp.path.map(a => a.id).join("|");
    if (!candidates.some(x => x.signature === signature)) candidates.push({
      target: end,
      signature,
      duration: lp.duration,
      path: lp.path,
      minFloat: Math.min(...lp.path.map(a => n(a.totalFloat))),
      maxFloat: Math.max(...lp.path.map(a => n(a.totalFloat)))
    });
  }
  candidates.sort((a, b) => b.duration - a.duration || a.minFloat - b.minFloat);
  const paths = candidates.slice(0, Math.max(1, count)).map((x, i) => ({ ...x, rank: i + 1, name: `Analytical Path ${i + 1}` }));
  const nearCritical = (schedule?.activities || []).filter(a => !a.milestone && n(a.totalFloat) <= 10).sort((a, b) => n(a.totalFloat) - n(b.totalFloat));
  const projectFinish = terminals.slice().sort((a, b) => (parseDate(b.currentFinish || b.finish)?.getTime() || 0) - (parseDate(a.currentFinish || a.finish)?.getTime() || 0))[0];
  const driving = projectFinish ? drivingChain(schedule, projectFinish.id) : [];
  return { paths, nearCritical, projectFinish, driving };
}

export function activityRevisionMatrix(schedules = [], activityIds = null) {
  const ordered = schedules.filter(Boolean).slice().sort((a, b) => (parseDate(a.dataDate)?.getTime() || 0) - (parseDate(b.dataDate)?.getTime() || 0));
  const ids = activityIds?.length ? activityIds : [...new Set(ordered.flatMap(s => (s.activities || []).map(a => String(a.id))))];
  return ids.map(id => ({
    id,
    revisions: ordered.map(s => {
      const a = (s.activities || []).find(x => String(x.id) === id);
      return a ? {
        scheduleId: s.id,
        revision: isoDate(s.dataDate) || s.name || s.sourceName,
        exists: true,
        name: a.name,
        start: isoDate(a.currentStart || a.start),
        finish: isoDate(a.currentFinish || a.finish),
        percent: n(a.percent),
        duration: n(a.originalDuration),
        totalFloat: n(a.totalFloat),
        calendar: a.calendarName || a.calendarId || "",
        status: a.status || ""
      } : { scheduleId: s.id, revision: isoDate(s.dataDate) || s.name || s.sourceName, exists: false };
    })
  }));
}
