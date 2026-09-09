
import assert from "node:assert/strict";
import {comparisonPair} from "./helpers.js";
import {toolRegistry,inferTool} from "../src/ai/tools.js";
export async function run(){
  const {previous,current}=comparisonPair(),reg=toolRegistry({current,previous,revisions:[previous,current]});
  assert.equal(reg.get_activity({id:"A300"}).id,"A300");
  assert.equal(reg.get_predecessors({id:"A300"}).length,1);
  assert.ok(reg.get_critical_path().length>0);
  assert.ok(reg.get_schedule_changes().summary.addedActivities===1);
  assert.equal(reg.why_date_moved({id:"A300"}).found,true);
  assert.equal(inferTool("Why did A300 finish move?",current).name,"why_date_moved");
  assert.equal(inferTool("Show the critical path",current).name,"get_critical_path");
  return "ai-tools";
}
