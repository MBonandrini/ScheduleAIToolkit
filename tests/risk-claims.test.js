
import assert from "node:assert/strict";
import {sampleSchedule,comparisonPair} from "./helpers.js";
import {runMonteCarlo,mapRiskToSchedule} from "../src/analysis/risk.js";
import {buildDelayEventFile} from "../src/analysis/claims.js";
export async function run(){
  const s=sampleSchedule(),m=runMonteCarlo(s,{iterations:500,seed:99,uncertainty:.2,targetId:"M600"});
  assert.equal(m.iterations,500);assert.ok(m.p90>=m.p50&&m.p50>=m.p10);assert.ok(m.criticality.length>0);
  const m2=runMonteCarlo(s,{iterations:500,seed:99,uncertainty:.2,targetId:"M600"});assert.equal(m.p80,m2.p80);
  const risk=mapRiskToSchedule({id:"R1",activityIds:["A200","A300"]},s);assert.equal(risk.activities.length,2);
  const {previous,current}=comparisonPair();
  const pack=buildDelayEventFile({event:{title:"Late switchgear",activityIds:["A200","A300"],milestoneId:"M400",documentIds:["D1"]},current,previous,documents:[{id:"D1",name:"notice.pdf"},{id:"D2",name:"other.pdf"}]});
  assert.equal(pack.impactedActivities.length,2);assert.equal(pack.evidenceDocuments.length,1);assert.ok(pack.drivingTrace);
  return "risk-claims";
}
