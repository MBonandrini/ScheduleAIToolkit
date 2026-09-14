
import {startOfWeek,parseDate,addDays,isoWeek} from "../core/utils.js";
export function weeklySeries(schedule){
  const a=schedule.activities||[],dates=a.flatMap(x=>[x.baselineFinish,x.actualFinish,x.currentFinish||x.finish]).map(parseDate).filter(Boolean);
  if(!dates.length)return [];
  let cursor=startOfWeek(new Date(Math.min(...dates.map(d=>d.getTime())))),end=new Date(Math.max(...dates.map(d=>d.getTime()))),rows=[],guard=0;
  while(cursor<=end&&guard++<520){
    const next=addDays(cursor,7);
    const inWeek=(v)=>{const d=parseDate(v);return d&&d>=cursor&&d<next};
    const plannedThis=a.filter(x=>inWeek(x.baselineFinish)),actualThis=a.filter(x=>x.percent>=100&&inWeek(x.actualFinish||x.currentFinish||x.finish)),forecastThis=a.filter(x=>inWeek(x.currentFinish||x.finish));
    const planned=a.filter(x=>parseDate(x.baselineFinish)&&parseDate(x.baselineFinish)<next).length;
    const actual=a.filter(x=>x.percent>=100&&parseDate(x.actualFinish||x.currentFinish||x.finish)<next).length;
    const forecast=a.filter(x=>parseDate(x.currentFinish||x.finish)&&parseDate(x.currentFinish||x.finish)<next).length;
    const n=Math.max(1,a.length);
    rows.push({
      week:`W${isoWeek(cursor)} ${cursor.getFullYear()}`,start:new Date(cursor),end:addDays(next,-1),
      plannedQty:plannedThis.length,actualQty:actualThis.length,forecastQty:forecastThis.length,
      plannedHours:plannedThis.reduce((n,x)=>n+Number(x.budgetUnits||0),0),
      actualHours:actualThis.reduce((n,x)=>n+Number(x.actualUnits||0),0),
      forecastHours:forecastThis.reduce((n,x)=>n+Number(x.remainingUnits||0),0),
      plannedPct:planned/n*100,actualPct:actual/n*100,forecastPct:forecast/n*100,
      planned,actual,forecast
    });
    cursor=next;
  }
  return rows;
}
export function fourWeekLookahead(schedule){
  const dd=startOfWeek(schedule.dataDate||new Date()),rows=[];
  for(let i=0;i<4;i++){
    const start=addDays(dd,i*7),end=addDays(start,7);
    const starts=schedule.activities.filter(a=>a.percent<100&&parseDate(a.currentStart||a.start)>=start&&parseDate(a.currentStart||a.start)<end);
    const finishes=schedule.activities.filter(a=>a.percent<100&&parseDate(a.currentFinish||a.finish)>=start&&parseDate(a.currentFinish||a.finish)<end);
    rows.push({week:i+1,start,end:addDays(end,-1),starts,finishes,criticalStarts:starts.filter(a=>a.critical||a.totalFloat<=0)});
  }
  return rows;
}

function assignmentValueMap(schedule,resourceIds,field){
  const out=new Map(),wanted=new Set((Array.isArray(resourceIds)?resourceIds:[resourceIds]).filter(Boolean).map(String));
  for(const x of schedule.assignments||[]){
    if(wanted.size&&!wanted.has(String(x.resourceId)))continue;
    const id=String(x.activityId||""),v=Number(x[field]??0)||0;out.set(id,(out.get(id)||0)+v);
  }
  return out;
}
function activityResourceSet(schedule,resourceIds){
  const wanted=new Set((resourceIds||[]).filter(Boolean).map(String)),out=new Set();if(!wanted.size)return out;
  for(const x of schedule.assignments||[])if(wanted.has(String(x.resourceId)))out.add(String(x.activityId||""));return out;
}
export function curveSeries(schedule,{basis="activities",resourceId="",resourceIds=[],startDate="",endDate=""}={}){
  const requested=basis==="resource"?[resourceId]:resourceIds,assigned=activityResourceSet(schedule,requested);
  let acts=schedule.activities||[];if(requested.filter(Boolean).length&&basis==="activities")acts=acts.filter(a=>assigned.has(String(a.uid||""))||assigned.has(String(a.id||"")));
  if(!acts.length)return [];
  const useAssignments=basis==="resource"||((basis==="units"||basis==="cost")&&requested.filter(Boolean).length);
  const fields=basis==="cost"?{planned:"target_cost",actual:"act_reg_cost",remaining:"remain_cost"}:{planned:"target_qty",actual:"act_reg_qty",remaining:"remain_qty"};
  const targetMap=useAssignments?assignmentValueMap(schedule,requested,fields.planned):null;
  const actualMap=useAssignments?assignmentValueMap(schedule,requested,fields.actual):null;
  const remainMap=useAssignments?assignmentValueMap(schedule,requested,fields.remaining):null;
  const fromMaps=(a,kind)=>{const keys=[String(a.uid||""),String(a.id||"")];if(kind==="forecast")return keys.reduce((n,k)=>Math.max(n,(actualMap?.get(k)||0)+(remainMap?.get(k)||0),targetMap?.get(k)||0),0);const map=kind==="planned"?targetMap:actualMap;return keys.reduce((n,k)=>Math.max(n,map?.get(k)||0),0)};
  const valueFor=(a,kind)=>{
    if(basis==="activities")return 1;
    if(useAssignments)return fromMaps(a,kind);
    if(basis==="cost")return Number(kind==="planned"?a.budgetCost:kind==="actual"?a.actualCost:(Number(a.actualCost||0)+Number(a.remainingCost||0)))||0;
    return Number(kind==="planned"?a.budgetUnits:kind==="actual"?a.actualUnits:(Number(a.actualUnits||0)+Number(a.remainingUnits||0)))||0;
  };
  const dates=acts.flatMap(a=>[a.baselineFinish,a.actualFinish,a.currentFinish||a.finish]).map(parseDate).filter(Boolean);if(!dates.length)return [];
  let cursor=startOfWeek(new Date(Math.min(...dates.map(d=>d.getTime())))),end=new Date(Math.max(...dates.map(d=>d.getTime()))),rows=[],guard=0,plannedCum=0,actualCum=0,forecastCum=0;
  while(cursor<=end&&guard++<520){
    const next=addDays(cursor,7),inWeek=v=>{const d=parseDate(v);return d&&d>=cursor&&d<next};
    const plannedWeekly=acts.filter(a=>inWeek(a.baselineFinish)).reduce((n,a)=>n+valueFor(a,"planned"),0);
    const actualWeekly=acts.filter(a=>a.percent>=100&&inWeek(a.actualFinish||a.currentFinish||a.finish)).reduce((n,a)=>n+valueFor(a,"actual"),0);
    const forecastWeekly=acts.filter(a=>inWeek(a.currentFinish||a.finish)).reduce((n,a)=>n+valueFor(a,"forecast"),0);
    plannedCum+=plannedWeekly;actualCum+=actualWeekly;forecastCum+=forecastWeekly;
    rows.push({week:`W${isoWeek(cursor)} ${cursor.getFullYear()}`,start:new Date(cursor),friday:addDays(cursor,4),end:addDays(next,-1),plannedWeekly,actualWeekly,forecastWeekly,plannedCum,actualCum,forecastCum});cursor=next;
  }
  const lo=parseDate(startDate),hi=parseDate(endDate);if(lo)rows=rows.filter(r=>r.end>=lo);if(hi)rows=rows.filter(r=>r.start<=hi);return rows;
}
