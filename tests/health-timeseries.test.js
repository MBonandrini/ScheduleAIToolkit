
import assert from "node:assert/strict";
import {sampleSchedule,comparisonPair} from "./helpers.js";
import {scheduleHealth,forecastConfidence,plannerInbox} from "../src/analysis/health.js";
import {weeklySeries,fourWeekLookahead} from "../src/analysis/timeseries.js";
import {scheduleNarrative} from "../src/analysis/narrative.js";
export async function run(){
  const s=sampleSchedule(),h=scheduleHealth(s);assert.ok(h.score>=0&&h.score<=100);assert.ok(h.checks.length>=8);
  const {previous,current}=comparisonPair(),conf=forecastConfidence([previous,current]);assert.ok(conf.score>=0&&conf.score<=100);
  assert.ok(Array.isArray(plannerInbox(previous,current)));
  const w=weeklySeries(s);assert.ok(w.length>=1);assert.ok("plannedHours" in w[0]&&"actualPct" in w[0]);
  const look=fourWeekLookahead(s);assert.equal(look.length,4);
  const n=scheduleNarrative(current,previous);assert.ok(n.paragraphs.length>=3);assert.equal(n.lookahead.length,4);
  return "health-timeseries";
}
