
import {networkHealth,openEnds} from "./network.js?v=1.2.0";
import {stddev,mean,daysBetween,parseDate,clamp} from "../core/utils.js?v=1.2.0";

export function scheduleHealth(schedule){
  const a=schedule.activities||[],n=Math.max(1,a.length),net=networkHealth(schedule);
  const constraints=a.filter(x=>x.constraintType).length;
  const longDur=a.filter(x=>Number(x.originalDuration)>44).length;
  const highFloat=a.filter(x=>Number(x.totalFloat)>44).length;
  const neg=a.filter(x=>Number(x.totalFloat)<0).length;
  const leads=(schedule.relationships||[]).filter(r=>r.lag<0).length;
  const lags=(schedule.relationships||[]).filter(r=>r.lag>0).length;
  const checks=[
    {name:"Missing logic",value:(net.openStarts+net.openFinishes)/n,weight:20,limit:.05},
    {name:"Logic density",value:net.logicDensity,weight:12,minimum:1.5},
    {name:"Hard/soft constraints",value:constraints/n,weight:12,limit:.05},
    {name:"Long durations",value:longDur/n,weight:10,limit:.05},
    {name:"High float",value:highFloat/n,weight:8,limit:.05},
    {name:"Negative float",value:neg/n,weight:14,limit:.02},
    {name:"Leads",value:leads/Math.max(1,schedule.relationships.length),weight:8,limit:0},
    {name:"Lags",value:lags/Math.max(1,schedule.relationships.length),weight:8,limit:.05},
    {name:"Cycles",value:net.cycles,weight:8,limit:0}
  ];
  let score=100;
  for(const c of checks){
    let penalty=0;
    if(c.minimum!=null&&c.value<c.minimum)penalty=c.weight*Math.min(1,(c.minimum-c.value)/c.minimum);
    if(c.limit!=null&&c.value>c.limit)penalty=c.weight*Math.min(1,(c.value-c.limit)/Math.max(c.limit||.01,.01));
    c.penalty=penalty;score-=penalty;
  }
  score=Math.round(clamp(score,0,100));
  return {score,label:score>=85?"Good":score>=70?"Watch":score>=50?"Poor":"Critical",checks,network:net};
}
export function forecastConfidence(revisions,targetActivityId=null){
  const rows=[];
  for(const s of revisions||[]){
    const target=targetActivityId?s.activities.find(a=>a.id===targetActivityId):null;
    const date=parseDate(target?.currentFinish||target?.finish)||new Date(Math.max(...s.activities.map(a=>parseDate(a.currentFinish||a.finish)?.getTime()||0),0));
    if(date&&Number.isFinite(date.getTime()))rows.push({schedule:s,date});
  }
  if(!rows.length)return {score:0,label:"Insufficient data",volatility:0,rows:[]};
  const movements=[];for(let i=1;i<rows.length;i++)movements.push(daysBetween(rows[i-1].date,rows[i].date));
  const volatility=stddev(movements),avgSlip=mean(movements.map(x=>Math.max(0,x)));
  const latest=rows.at(-1).schedule,health=scheduleHealth(latest).score;
  const target=targetActivityId?latest.activities.find(a=>a.id===targetActivityId):null;
  const floatPenalty=target?Math.max(0,10-Number(target.totalFloat||0))*2:0;
  const score=Math.round(clamp(health-volatility*2-avgSlip*1.5-floatPenalty,0,100));
  return {score,label:score>=80?"High":score>=60?"Moderate":score>=40?"Low":"Very Low",volatility,avgSlip,rows};
}
export function plannerInbox(previous,current){
  const h=scheduleHealth(current),items=[];
  if(h.network.openStarts)items.push({severity:"warning",category:"Logic",text:`${h.network.openStarts} open starts`});
  if(h.network.openFinishes)items.push({severity:"warning",category:"Logic",text:`${h.network.openFinishes} open finishes`});
  const neg=current.activities.filter(a=>a.totalFloat<0);if(neg.length)items.push({severity:"danger",category:"Float",text:`${neg.length} activities have negative float`});
  const missedStarts=current.activities.filter(a=>a.percent<=0&&parseDate(a.currentStart||a.start)&&parseDate(a.currentStart||a.start)<parseDate(current.dataDate));
  if(missedStarts.length)items.push({severity:"danger",category:"Progress",text:`${missedStarts.length} activities should have started`});
  const stalled=current.activities.filter(a=>a.percent>0&&a.percent<100&&Number(a.remainingDuration||0)<=0);
  if(stalled.length)items.push({severity:"warning",category:"Progress",text:`${stalled.length} activities appear stalled or inconsistent`});
  return items;
}
