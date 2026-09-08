
import assert from "node:assert/strict";
import {comparisonPair} from "./helpers.js";
import {compareSchedules,whyDidDateMove} from "../src/analysis/comparison.js";
export async function run(){
  const {previous,current}=comparisonPair(),c=compareSchedules(previous,current);
  assert.equal(c.summary.addedActivities,1);assert.equal(c.summary.addedRelationships,1);
  assert.ok(c.changed.some(x=>x.id==="A300"&&x.durationDays===3));
  assert.ok(c.summary.progressPoints>0);
  const why=whyDidDateMove(previous,current,"A300");
  assert.equal(why.found,true);assert.ok(why.evidence.some(x=>x.cause==="Duration change"));assert.ok(why.finishMovementDays>0);
  return "comparison";
}
