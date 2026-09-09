
import {parseDate,daysBetween,mean} from "../core/utils.js?v=1.2.0";

export function buildNetwork(schedule){
  const activities=new Map((schedule.activities||[]).map(a=>[a.id,a]));
  const incoming=new Map(),outgoing=new Map();
  for(const id of activities.keys()){incoming.set(id,[]);outgoing.set(id,[])}
  for(const r of schedule.relationships||[]){
    if(!activities.has(r.predId)||!activities.has(r.succId))continue;
    incoming.get(r.succId).push(r);outgoing.get(r.predId).push(r);
  }
  return {activities,incoming,outgoing};
}
export function openEnds(schedule){
  const g=buildNetwork(schedule),starts=[],finishes=[];
  for(const [id,a] of g.activities){
    if(a.percent<100 && (g.incoming.get(id)?.length||0)===0)starts.push(a);
    if(a.percent<100 && (g.outgoing.get(id)?.length||0)===0)finishes.push(a);
  }
  return {starts,finishes};
}
export function logicDensity(schedule){
  const n=Math.max(1,(schedule.activities||[]).length);
  return (schedule.relationships||[]).length/n;
}
export function duplicateRelationships(schedule){
  const seen=new Set(),dupes=[];
  for(const r of schedule.relationships||[]){
    const k=`${r.predId}|${r.succId}|${r.type}|${r.lag}`;
    if(seen.has(k))dupes.push(r);else seen.add(k);
  }
  return dupes;
}
export function detectCycles(schedule){
  const g=buildNetwork(schedule),color=new Map(),cycles=[],path=[],pathPos=new Map();
  for(const startId of g.activities.keys()){
    if(color.get(startId))continue;
    const stack=[{id:startId,index:0,rels:g.outgoing.get(startId)||[]}];
    color.set(startId,1);pathPos.set(startId,path.length);path.push(startId);
    while(stack.length){
      const top=stack[stack.length-1];
      if(top.index>=top.rels.length){
        color.set(top.id,2);stack.pop();pathPos.delete(top.id);path.pop();continue;
      }
      const r=top.rels[top.index++],to=r.succId,state=color.get(to)||0;
      if(state===0){
        color.set(to,1);pathPos.set(to,path.length);path.push(to);
        stack.push({id:to,index:0,rels:g.outgoing.get(to)||[]});
      }else if(state===1){
        const idx=pathPos.get(to)??0;cycles.push(path.slice(idx).concat(to));
        if(cycles.length>=50)return cycles;
      }
    }
  }
  return cycles;
}
function relationAnchor(pred,succ,r){
  const ps=parseDate(pred.currentStart||pred.start),pf=parseDate(pred.currentFinish||pred.finish);
  const ss=parseDate(succ.currentStart||succ.start),sf=parseDate(succ.currentFinish||succ.finish);
  if(r.type==="SS")return [ps,ss];
  if(r.type==="FF")return [pf,sf];
  if(r.type==="SF")return [ps,sf];
  return [pf,ss];
}
export function relationshipDrivingScore(schedule,r){
  const g=buildNetwork(schedule),p=g.activities.get(r.predId),s=g.activities.get(r.succId);
  if(!p||!s)return -Infinity;
  const [a,b]=relationAnchor(p,s,r);if(!a||!b)return -9999;
  const gap=daysBetween(a,b)-Number(r.lag||0);
  const floatPenalty=Math.max(0,Number(p.totalFloat||0));
  const typeBonus=r.type==="FS"?3:1;
  return 100-Math.abs(gap)*8-floatPenalty*1.5+typeBonus;
}
export function drivingPredecessor(schedule,activityId){
  const g=buildNetwork(schedule),rels=g.incoming.get(activityId)||[];
  if(!rels.length)return null;
  return rels.map(r=>({relationship:r,score:relationshipDrivingScore(schedule,r)})).sort((a,b)=>b.score-a.score)[0]||null;
}
export function drivingChain(schedule,targetId,{maxDepth=100}={}){
  const g=buildNetwork(schedule),chain=[],seen=new Set();let id=targetId;
  for(let i=0;i<maxDepth;i++){
    if(seen.has(id))break;seen.add(id);
    const a=g.activities.get(id);if(!a)break;
    chain.unshift(a);
    const drive=drivingPredecessor(schedule,id);if(!drive)break;
    id=drive.relationship.predId;
  }
  return chain;
}
export function topologicalOrder(schedule){
  const g=buildNetwork(schedule),indegree=new Map([...g.activities.keys()].map(id=>[id,(g.incoming.get(id)||[]).length]));
  const q=[...indegree.entries()].filter(([,d])=>d===0).map(([id])=>id),order=[];
  while(q.length){
    const id=q.shift();order.push(id);
    for(const r of g.outgoing.get(id)||[]){
      const d=indegree.get(r.succId)-1;indegree.set(r.succId,d);if(d===0)q.push(r.succId);
    }
  }
  return {order,acyclic:order.length===g.activities.size};
}
export function longestPath(schedule,targetId=null){
  const g=buildNetwork(schedule),topo=topologicalOrder(schedule);
  if(!topo.acyclic)return {path:[],duration:0,acyclic:false};
  const dist=new Map(),parent=new Map();
  for(const id of topo.order){
    const a=g.activities.get(id),dur=Math.max(0,Number(a.remainingDuration||a.originalDuration||0));
    if(!dist.has(id))dist.set(id,dur);
    for(const r of g.outgoing.get(id)||[]){
      const succ=g.activities.get(r.succId),sd=Math.max(0,Number(succ?.remainingDuration||succ?.originalDuration||0));
      const cand=dist.get(id)+Math.max(0,Number(r.lag||0))+sd;
      if(cand>(dist.get(r.succId)??-Infinity)){dist.set(r.succId,cand);parent.set(r.succId,id)}
    }
  }
  const end=targetId&&g.activities.has(targetId)?targetId:[...dist.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(!end)return {path:[],duration:0,acyclic:true};
  const ids=[];let cur=end;while(cur){ids.unshift(cur);cur=parent.get(cur)}
  return {path:ids.map(id=>g.activities.get(id)),duration:dist.get(end)||0,acyclic:true};
}
export function pathConvergence(schedule){
  const g=buildNetwork(schedule),rows=[];
  for(const [id,a] of g.activities){
    rows.push({activity:a,incoming:(g.incoming.get(id)||[]).length,outgoing:(g.outgoing.get(id)||[]).length});
  }
  return rows.sort((a,b)=>(b.incoming+b.outgoing)-(a.incoming+a.outgoing));
}
export function criticalPathMigration(previous,current){
  if(!previous)return {entered:[],left:[],stayed:[]};
  const p=new Set(previous.activities.filter(a=>a.critical||a.totalFloat<=0).map(a=>a.id));
  const c=new Set(current.activities.filter(a=>a.critical||a.totalFloat<=0).map(a=>a.id));
  return {
    entered:current.activities.filter(a=>c.has(a.id)&&!p.has(a.id)),
    left:previous.activities.filter(a=>p.has(a.id)&&!c.has(a.id)),
    stayed:current.activities.filter(a=>c.has(a.id)&&p.has(a.id))
  };
}
export function traceToMilestone(schedule,targetId){
  const chain=drivingChain(schedule,targetId);
  const lp=longestPath(schedule,targetId);
  return {
    target:schedule.activities.find(a=>a.id===targetId)||null,
    drivingChain:chain,
    longestPath:lp.path,
    longestDuration:lp.duration,
    evidence:chain.slice(0,-1).map((a,i)=>({pred:a.id,succ:chain[i+1]?.id,confidence:"Strongly indicated"}))
  };
}
export function networkHealth(schedule){
  const g=buildNetwork(schedule),oe={starts:[],finishes:[]};
  for(const [id,a] of g.activities){
    if(a.percent<100&&(g.incoming.get(id)?.length||0)===0)oe.starts.push(a);
    if(a.percent<100&&(g.outgoing.get(id)?.length||0)===0)oe.finishes.push(a);
  }
  const cycles=detectCycles(schedule),dupes=duplicateRelationships(schedule);
  return {
    logicDensity:logicDensity(schedule),openStarts:oe.starts.length,openFinishes:oe.finishes.length,
    cycles:cycles.length,duplicateRelationships:dupes.length,
    leads:(schedule.relationships||[]).filter(r=>r.lag<0).length,
    lags:(schedule.relationships||[]).filter(r=>r.lag>0).length,
    avgPreds:mean([...g.activities.keys()].map(id=>(g.incoming.get(id)||[]).length))
  };
}
