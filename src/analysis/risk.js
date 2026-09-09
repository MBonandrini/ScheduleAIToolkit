
import {seededRandom,mean,median} from "../core/utils.js";
import {longestPath,buildNetwork,topologicalOrder} from "./network.js";

function triangular(r,min,mode,max){
  const u=r(),f=(mode-min)/(max-min||1);
  return u<f?min+Math.sqrt(u*(max-min)*(mode-min)):max-Math.sqrt((1-u)*(max-min)*(max-mode));
}
export function runMonteCarlo(schedule,{iterations=1000,seed=42,uncertainty=.2,targetId=null}={}){
  const topo=topologicalOrder(schedule);if(!topo.acyclic)return {error:"Cycles prevent network simulation",iterations:0};
  const g=buildNetwork(schedule),rng=seededRandom(seed),finishes=[],criticality=new Map();
  for(let k=0;k<iterations;k++){
    const finish=new Map(),parent=new Map();
    for(const id of topo.order){
      const a=g.activities.get(id),base=Math.max(.1,Number(a.remainingDuration||a.originalDuration||1));
      const dur=triangular(rng,Math.max(.1,base*(1-uncertainty)),base,base*(1+uncertainty));
      let start=0,bestPred=null;
      for(const rel of g.incoming.get(id)||[]){
        const cand=(finish.get(rel.predId)||0)+Math.max(0,Number(rel.lag||0));
        if(cand>start){start=cand;bestPred=rel.predId}
      }
      finish.set(id,start+dur);if(bestPred)parent.set(id,bestPred);
    }
    const end=targetId&&finish.has(targetId)?targetId:[...finish.entries()].sort((a,b)=>b[1]-a[1])[0][0];
    finishes.push(finish.get(end)||0);
    let cur=end,seen=new Set();while(cur&&!seen.has(cur)){seen.add(cur);criticality.set(cur,(criticality.get(cur)||0)+1);cur=parent.get(cur)}
  }
  finishes.sort((a,b)=>a-b);const q=p=>finishes[Math.min(finishes.length-1,Math.max(0,Math.floor((finishes.length-1)*p)))];
  return {
    iterations,seed,targetId,p10:q(.1),p50:q(.5),p80:q(.8),p90:q(.9),mean:mean(finishes),median:median(finishes),
    criticality:[...criticality.entries()].map(([id,n])=>({id,probability:n/iterations*100})).sort((a,b)=>b.probability-a.probability)
  };
}
export function mapRiskToSchedule(risk,schedule){
  const ids=new Set(risk.activityIds||[]),activities=schedule.activities.filter(a=>ids.has(a.id));
  return {...risk,activities};
}
