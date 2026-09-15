/**
 * Progress-integrity checks for statused schedules.
 *
 * These rules are deterministic data-quality checks. They flag contradictions
 * between status, percent complete, actual dates, data date and remaining
 * duration without pretending to infer contractual responsibility.
 */
import { parseDate, isoDate } from "../core/utils.js";

const n = v => Number(v || 0);
const d = v => parseDate(v);
const label = a => `${a?.id || ""} · ${a?.name || ""}`.trim();

function push(rows, a, category, severity, issue, field = "", value = "") {
  rows.push({
    activityId: String(a?.id || ""),
    activity: label(a),
    wbs: a?.wbsPath || "",
    category,
    severity,
    issue,
    field,
    value
  });
}

export function progressIntegrity(schedule) {
  const rows = [];
  const dataDate = d(schedule?.dataDate);
  for (const a of schedule?.activities || []) {
    const pct = n(a.percent);
    const as = d(a.actualStart);
    const af = d(a.actualFinish);
    const start = d(a.currentStart || a.start);
    const finish = d(a.currentFinish || a.finish);
    const rd = n(a.remainingDuration);
    const raw = a.raw || {};
    const expected = d(raw.expect_end_date || raw.expected_finish || raw.expectedFinish);
    const suspend = d(raw.suspend_date || raw.suspendDate);
    const resume = d(raw.resume_date || raw.resumeDate);

    if (pct > 0 && !as && !a.milestone) push(rows, a, "Progress", "High", "Progress recorded without an Actual Start", "% complete", `${pct.toFixed(1)}%`);
    if (as && pct <= 0 && !a.milestone) push(rows, a, "Progress", "Medium", "Actual Start exists but progress remains 0%", "Actual Start", isoDate(as));
    if (af && pct < 100) push(rows, a, "Completion", "High", "Actual Finish exists but activity is below 100%", "Actual Finish", isoDate(af));
    if (pct >= 100 && !af && !a.milestone) push(rows, a, "Completion", "High", "Activity is 100% complete without an Actual Finish", "% complete", `${pct.toFixed(1)}%`);
    if (pct >= 100 && rd > 0.001) push(rows, a, "Completion", "Medium", "Completed activity retains remaining duration", "Remaining Duration", `${rd.toFixed(1)}d`);
    if (as && af && af < as) push(rows, a, "Actual Dates", "Critical", "Actual Finish is earlier than Actual Start", "Actual dates", `${isoDate(as)} → ${isoDate(af)}`);
    if (dataDate && as && as > dataDate) push(rows, a, "Data Date", "Critical", "Actual Start is after the data date", "Actual Start", isoDate(as));
    if (dataDate && af && af > dataDate) push(rows, a, "Data Date", "Critical", "Actual Finish is after the data date", "Actual Finish", isoDate(af));
    if (dataDate && !as && start && start < dataDate && pct <= 0) push(rows, a, "Forecast", "High", "Not-started activity has a forecast start before the data date", "Forecast Start", isoDate(start));
    if (dataDate && !af && finish && finish < dataDate && pct < 100) push(rows, a, "Forecast", "High", "Incomplete activity has a forecast finish before the data date", "Forecast Finish", isoDate(finish));
    if (expected && finish && Math.abs(expected.getTime() - finish.getTime()) > 86400000) push(rows, a, "Expected Finish", "Medium", "Expected Finish differs from the current forecast finish", "Expected Finish", `${isoDate(expected)} vs ${isoDate(finish)}`);
    if (suspend && resume && resume < suspend) push(rows, a, "Suspend / Resume", "High", "Resume date is earlier than suspend date", "Suspend / Resume", `${isoDate(suspend)} → ${isoDate(resume)}`);
    if (suspend && !resume && pct >= 100) push(rows, a, "Suspend / Resume", "Medium", "Completed activity remains suspended without a resume date", "Suspend", isoDate(suspend));
  }
  const counts = rows.reduce((o, r) => {
    o[r.severity] = (o[r.severity] || 0) + 1;
    o[r.category] = (o[r.category] || 0) + 1;
    return o;
  }, {});
  return {
    rows,
    counts,
    summary: {
      total: rows.length,
      critical: counts.Critical || 0,
      high: counts.High || 0,
      medium: counts.Medium || 0,
      low: counts.Low || 0,
      pass: rows.length === 0
    }
  };
}
