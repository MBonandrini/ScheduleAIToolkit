/**
 * Week-on-week status-change register.
 * Produces one auditable row per activity plus explicit added/deleted rows so the
 * UI can filter status, dates, progress and actual-date movements independently.
 */
import { daysBetween, isoDate } from "../core/utils.js";

const n = v => Number(v || 0);
const s = v => String(v ?? "");
function actualChange(before, after) {
  const b = isoDate(before) || "", a = isoDate(after) || "";
  if (!b && a) return { type: "Added", before: "", after: a, adverse: false };
  if (b && !a) return { type: "Removed", before: b, after: "", adverse: true };
  if (b && a && b !== a) return { type: "Changed", before: b, after: a, adverse: false };
  return { type: "—", before: b, after: a, adverse: false };
}

export function weekOnWeekChanges(previous, current) {
  const p = new Map((previous?.activities || []).map(a => [s(a.id), a]));
  const c = new Map((current?.activities || []).map(a => [s(a.id), a]));
  const rows = [];
  for (const [id, now] of c) {
    const old = p.get(id);
    if (!old) {
      rows.push({ type: "Added", id, name: now.name, wbs: now.wbsPath || "", status: now.status || "", previousPercent: null, currentPercent: n(now.percent), progressDelta: null,
        previousStart: "", currentStart: isoDate(now.currentStart || now.start) || "", startDelta: null, previousFinish: "", currentFinish: isoDate(now.currentFinish || now.finish) || "", finishDelta: null,
        actualStart: actualChange(null, now.actualStart), actualFinish: actualChange(null, now.actualFinish), adverse: false });
      continue;
    }
    const progressDelta = n(now.percent) - n(old.percent);
    const startDelta = daysBetween(old.currentStart || old.start, now.currentStart || now.start);
    const finishDelta = daysBetween(old.currentFinish || old.finish, now.currentFinish || now.finish);
    const actualStart = actualChange(old.actualStart, now.actualStart), actualFinish = actualChange(old.actualFinish, now.actualFinish);
    const changed = Math.abs(progressDelta) > 1e-9 || startDelta !== 0 || finishDelta !== 0 || actualStart.type !== "—" || actualFinish.type !== "—" || old.status !== now.status;
    if (!changed) continue;
    rows.push({ type: "Changed", id, name: now.name, wbs: now.wbsPath || "", status: now.status || "",
      previousPercent: n(old.percent), currentPercent: n(now.percent), progressDelta,
      previousStart: isoDate(old.currentStart || old.start) || "", currentStart: isoDate(now.currentStart || now.start) || "", startDelta,
      previousFinish: isoDate(old.currentFinish || old.finish) || "", currentFinish: isoDate(now.currentFinish || now.finish) || "", finishDelta,
      actualStart, actualFinish,
      adverse: progressDelta < 0 || startDelta > 0 || finishDelta > 0 || actualStart.adverse || actualFinish.adverse });
  }
  for (const [id, old] of p) if (!c.has(id)) rows.push({ type: "Deleted", id, name: old.name, wbs: old.wbsPath || "", status: old.status || "", previousPercent: n(old.percent), currentPercent: null, progressDelta: null,
    previousStart: isoDate(old.currentStart || old.start) || "", currentStart: "", startDelta: null, previousFinish: isoDate(old.currentFinish || old.finish) || "", currentFinish: "", finishDelta: null,
    actualStart: actualChange(old.actualStart, null), actualFinish: actualChange(old.actualFinish, null), adverse: true });

  const summary = {
    rows: rows.length,
    added: rows.filter(r => r.type === "Added").length,
    deleted: rows.filter(r => r.type === "Deleted").length,
    progressed: rows.filter(r => n(r.progressDelta) > 0).length,
    progressReduced: rows.filter(r => n(r.progressDelta) < 0).length,
    slippedStart: rows.filter(r => n(r.startDelta) > 0).length,
    slippedFinish: rows.filter(r => n(r.finishDelta) > 0).length,
    actualStartsAdded: rows.filter(r => r.actualStart?.type === "Added").length,
    actualStartsRemoved: rows.filter(r => r.actualStart?.type === "Removed").length,
    actualFinishesAdded: rows.filter(r => r.actualFinish?.type === "Added").length,
    actualFinishesRemoved: rows.filter(r => r.actualFinish?.type === "Removed").length,
    adverse: rows.filter(r => r.adverse).length
  };
  return { rows, summary };
}
