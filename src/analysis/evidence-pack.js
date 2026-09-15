/**
 * Build a self-contained forensic evidence ZIP from deterministic schedule
 * analyses. Source hashes are SHA-256 when the browser Web Crypto API is
 * available and a file blob is supplied by the caller.
 */
import { dcma14 } from "./dcma.js";
import { weekOnWeekChanges } from "./week-over-week.js";
import { buildForensicEvidence } from "./forensics.js";
import { progressIntegrity } from "./progress-integrity.js";
import { toCSV, isoDate } from "../core/utils.js";
import { zipBlob } from "../core/zip.js";

async function sha256(blob) {
  if (!blob || !globalThis.crypto?.subtle) return "";
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}
const csv = (headers, rows) => toCSV(headers, rows);

export async function buildEvidencePack({ schedules = [], activeSchedule = null, issues = [], claims = [], sourceBlobs = {}, qaProfile = null } = {}) {
  const ordered = schedules.filter(Boolean);
  const active = activeSchedule || ordered.at(-1) || null;
  if (!active) throw new Error("At least one schedule is required for an evidence pack.");
  const dcma = dcma14(active, qaProfile ? { profile: qaProfile } : undefined);
  const progress = progressIntegrity(active);
  const forensic = ordered.length >= 2 ? buildForensicEvidence(ordered) : null;
  const wow = ordered.length >= 2 ? weekOnWeekChanges(ordered.at(-2), ordered.at(-1)) : null;
  const sources = [];
  for (const s of ordered) sources.push({
    id: s.id,
    name: s.sourceName || s.name || s.id,
    dataDate: isoDate(s.dataDate) || "",
    activities: s.activities?.length || 0,
    relationships: s.relationships?.length || 0,
    sha256: await sha256(sourceBlobs[s.id])
  });
  const manifest = {
    generatedAt: new Date().toISOString(),
    application: "Project Controls AI Suite v3.0.0",
    activeSchedule: active.sourceName || active.name || active.id,
    dataDate: isoDate(active.dataDate) || "",
    sources,
    dcmaSummary: dcma.summary,
    progressIntegrity: progress.summary,
    issueCount: issues.length,
    delayEventCount: claims.length,
    forensicTransitions: forensic?.transitions?.length || 0
  };
  const files = [
    { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    { name: "dcma-14-point.csv", data: csv(["#","Check","Status","Count","Denominator","Rate","Threshold","Criterion"], dcma.checks.map(c => [c.number,c.name,c.status,c.count,c.denominator,c.rate ?? c.value ?? "",c.threshold,c.criterion])) },
    { name: "progress-integrity.csv", data: csv(["Activity ID","Activity","WBS","Category","Severity","Issue","Field","Value"], progress.rows.map(r => [r.activityId,r.activity,r.wbs,r.category,r.severity,r.issue,r.field,r.value])) },
    { name: "issue-register.csv", data: csv(["Severity","Category","Activity / Relationship","Issue","Owner","Status","Comment","Source"], issues.map(r => [r.severity,r.category,r.activity,r.issue,r.owner,r.status,r.comment,r.source])) },
    { name: "delay-events.csv", data: csv(["ID","Event","Date","Category","Impact Days","Activity IDs","Description","Notice","Instruction"], claims.map(r => [r.code || r.id,r.title,r.date,r.category,r.impactDays,(r.activityIds || []).join(";"),r.description,r.notice,r.instruction])) }
  ];
  if (wow) files.push({ name: "week-on-week.csv", data: csv([
    "Type","Activity ID","Activity","WBS","Status","Previous %","Current %","Progress Delta",
    "Previous Start","Current Start","Start Delta Days","Previous Finish","Current Finish","Finish Delta Days",
    "Actual Start Change","Actual Start Previous","Actual Start Current","Actual Finish Change","Actual Finish Previous","Actual Finish Current","Adverse"
  ], wow.rows.map(r => [
    r.type,r.id,r.name,r.wbs,r.status,r.previousPercent ?? "",r.currentPercent ?? "",r.progressDelta ?? "",
    r.previousStart,r.currentStart,r.startDelta ?? "",r.previousFinish,r.currentFinish,r.finishDelta ?? "",
    r.actualStart?.type || "",r.actualStart?.before || "",r.actualStart?.after || "",
    r.actualFinish?.type || "",r.actualFinish?.before || "",r.actualFinish?.after || "",r.adverse ? "Yes" : "No"
  ])) });
  if (forensic) {
    files.push({ name: "forensic-activities.csv", data: csv(["Transition","Change","Activity ID","Activity","WBS","Status"], forensic.activities.rows.map(r => [r.transition,r.type,r.id,r.name,r.wbs,r.status])) });
    files.push({ name: "forensic-progress.csv", data: csv(["Transition","Change","Activity","Field","Previous","Current","Delta"], forensic.progress.rows.map(r => [r.transition,r.type,r.activity,r.field,r.before,r.after,r.delta])) });
    files.push({ name: "forensic-resources.csv", data: csv(["Transition","Change","Activity","Resource","Actual Prev","Actual Curr","Actual Delta","At Completion Prev","At Completion Curr","At Completion Delta","Budget Prev","Budget Curr"], forensic.resourcing.rows.map(r => [r.transition,r.type,r.activity,r.resource,r.actualBefore,r.actualAfter,r.actualDelta,r.atCompletionBefore,r.atCompletionAfter,r.atCompletionDelta,r.budgetBefore,r.budgetAfter])) });
    files.push({ name: "forensic-calendars.csv", data: csv(["Transition","Change","Calendar","Previous","Current"], forensic.calendars.definitionRows.map(r => [r.transition,r.type,r.calendar,r.before,r.after])) });
    files.push({ name: "forensic-relationships.csv", data: csv(["Transition","Change","Predecessor","Successor","Previous","Current"], forensic.relationships.rows.map(r => [r.transition,r.type,r.predecessor,r.successor,r.before,r.after])) });
  }
  return { blob: await zipBlob(files), manifest, files: files.map(f => f.name) };
}
