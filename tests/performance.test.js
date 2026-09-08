
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {parseXER} from "../src/parsers/xer.js";
import {syntheticXER} from "./helpers.js";
import {scheduleHealth} from "../src/analysis/health.js";
export async function run({quick=false}={}){
  const cases=quick?[[2000,8000]]:[[10000,50000],[25000,100000]];
  const results=[];
  for(const [a,r] of cases){
    const text=syntheticXER(a,r),t=performance.now(),s=parseXER(text,`perf-${a}.xer`).schedules[0],parseMs=performance.now()-t;
    assert.equal(s.activities.length,a);assert.equal(s.relationships.length,r);
    const h0=performance.now(),health=scheduleHealth(s),healthMs=performance.now()-h0;
    assert.ok(health.score>=0&&health.score<=100);
    results.push({a,r,parseMs,healthMs});
    // generous CI-safe guardrails; intended to detect accidental O(n²) regressions.
    assert.ok(parseMs<15000,`parse too slow ${parseMs}ms`);
    assert.ok(healthMs<15000,`health too slow ${healthMs}ms`);
  }
  return results;
}
