
import assert from "node:assert/strict";
import {sampleSchedule} from "./helpers.js";
import {buildNetwork,openEnds,logicDensity,detectCycles,longestPath,drivingChain,traceToMilestone,criticalPathMigration} from "../src/analysis/network.js";
export async function run(){
  const s=sampleSchedule(),g=buildNetwork(s);assert.equal(g.activities.size,6);assert.equal(g.incoming.get("A300").length,1);
  const oe=openEnds(s);assert.equal(oe.starts.length,0);assert.equal(oe.finishes.length,1);
  assert.ok(logicDensity(s)>.7);
  assert.equal(detectCycles(s).length,0);
  const lp=longestPath(s,"M600");assert.equal(lp.acyclic,true);assert.ok(lp.path.length>=5);assert.equal(lp.path.at(-1).id,"M600");
  const chain=drivingChain(s,"M400");assert.deepEqual(chain.map(a=>a.id),["A100","A200","A300","M400"]);
  const trace=traceToMilestone(s,"M600");assert.equal(trace.target.id,"M600");assert.ok(trace.longestPath.length>=5);
  const cyc=sampleSchedule();cyc.relationships.push({predId:"M600",succId:"A100",type:"FS",lag:0});assert.ok(detectCycles(cyc).length>=1);
  const m=criticalPathMigration(sampleSchedule(),sampleSchedule({shift:2}));assert.ok(Array.isArray(m.entered));
  return "network";
}
