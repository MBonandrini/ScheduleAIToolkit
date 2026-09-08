
import assert from "node:assert/strict";
import {performance} from "node:perf_hooks";
import {parseXER,parseXERTables} from "../src/parsers/xer.js";
import {syntheticXER} from "./helpers.js";
import {scheduleHealth} from "../src/analysis/health.js";
import {compareSchedules} from "../src/analysis/comparison.js";
import {runMonteCarlo} from "../src/analysis/risk.js";
import {createSchedule} from "../src/core/model.js";
import {detectCycles,longestPath} from "../src/analysis/network.js";

export async function run(){
  const results={};

  // 3,000 randomized malformed XER inputs.
  let t0=performance.now();
  for(let i=0;i<3000;i++){
    const lines=[],n=Math.floor(Math.random()*45);
    for(let j=0;j<n;j++){
      const kind=["%T","%F","%R","ERMHDR","junk",""][Math.floor(Math.random()*6)];
      lines.push(`${kind}\t${Math.random().toString(36).slice(2)}\t${Math.random().toString(36).slice(2)}\t${Math.random().toString(36).slice(2)}`);
    }
    assert.doesNotThrow(()=>parseXERTables(lines.join("\n")));
  }
  results.fuzz3000Ms=performance.now()-t0;

  // 50k / 200k large programme.
  t0=performance.now();
  const largeText=syntheticXER(50000,200000);
  const large=parseXER(largeText,"50k-200k.xer").schedules[0];
  results.parse50k200kMs=performance.now()-t0;
  assert.equal(large.activities.length,50000);
  assert.equal(large.relationships.length,200000);

  t0=performance.now();
  const health=scheduleHealth(large);
  results.health50k200kMs=performance.now()-t0;
  assert.ok(health.score>=0&&health.score<=100);
  assert.ok(results.parse50k200kMs<30000);
  assert.ok(results.health50k200kMs<30000);

  // 10k revision comparison with deterministic movement and scope change.
  const makeRevision=(shift=0,extra=0)=>{
    const base=parseXER(syntheticXER(10000,40000),`rev-${shift}.xer`).schedules[0];
    base.id=`rev-${shift}`;base.dataDate=new Date(Date.UTC(2026,7,1+shift)).toISOString();
    for(let i=0;i<base.activities.length;i+=20){
      const a=base.activities[i],d=new Date(a.currentFinish);d.setUTCDate(d.getUTCDate()+shift);a.currentFinish=d.toISOString();a.finish=a.currentFinish;a.totalFloat-=shift;
    }
    for(let i=0;i<extra;i++)base.activities.push({...base.activities[0],id:`EXTRA-${i}`,uid:`EXTRA-${i}`,name:`Extra ${i}`});
    return base;
  };
  const r1=makeRevision(0,0),r2=makeRevision(7,100);
  t0=performance.now();
  const comp=compareSchedules(r1,r2);
  results.compare10kMs=performance.now()-t0;
  assert.equal(comp.added.length,100);
  assert.ok(comp.changed.length>0);
  assert.ok(results.compare10kMs<10000);

  // Deep chain 20,000 activities: stack-safe network algorithms.
  const acts=[],rels=[];
  for(let i=0;i<20000;i++){
    acts.push({id:`N${i}`,name:`Node ${i}`,originalDuration:1,remainingDuration:1,start:"2026-01-01",finish:"2026-01-02",totalFloat:0,percent:0});
    if(i)rels.push({predId:`N${i-1}`,succId:`N${i}`,type:"FS",lag:0});
  }
  const chain=createSchedule({name:"Deep chain",activities:acts,relationships:rels});
  t0=performance.now();
  assert.equal(detectCycles(chain).length,0);
  const lp=longestPath(chain,"N19999");
  results.deepChainMs=performance.now()-t0;
  assert.equal(lp.path.length,20000);
  assert.ok(results.deepChainMs<15000);

  // 5,000-iteration deterministic Monte Carlo.
  const mcSchedule=createSchedule({
    name:"MC",
    activities:[
      {id:"A",name:"A",remainingDuration:5,totalFloat:0},
      {id:"B",name:"B",remainingDuration:8,totalFloat:0},
      {id:"C",name:"C",remainingDuration:3,totalFloat:0}
    ],
    relationships:[{predId:"A",succId:"B",type:"FS",lag:0},{predId:"B",succId:"C",type:"FS",lag:0}]
  });
  t0=performance.now();
  const mc1=runMonteCarlo(mcSchedule,{iterations:5000,seed:20260908,uncertainty:.25,targetId:"C"});
  const mc2=runMonteCarlo(mcSchedule,{iterations:5000,seed:20260908,uncertainty:.25,targetId:"C"});
  results.monte5000Ms=performance.now()-t0;
  assert.equal(mc1.p80,mc2.p80);
  assert.ok(mc1.p90>=mc1.p80&&mc1.p80>=mc1.p50&&mc1.p50>=mc1.p10);

  return results;
}
