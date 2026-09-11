
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

function assignmentValueMap(schedule,resourceId,field){
  const out=new Map();
  for(const x of schedule.assignments||[]){
    if(resourceId&&String(x.resourceId)!==String(resourceId))continue;
    const id=String(x.activityId||""),v=Number(x[field]??0)||0;out.set(id,(out.get(id)||0)+v);
  }
  return out;
}
export function curveSeries(schedule,{basis="activities",resourceId=""}={}){
  const acts=schedule.activities||[];
  if(!acts.length)return [];
  const targetMap=basis==="resource"?assignmentValueMap(schedule,resourceId,"target_qty"):null;
  const actualMap=basis==="resource"?assignmentValueMap(schedule,resourceId,"act_reg_qty"):null;
  const remainMap=basis==="resource"?assignmentValueMap(schedule,resourceId,"remain_qty"):null;
  const valueFor=(a,kind)=>{
    if(basis==="activities")return 1;
    if(basis==="cost")return Number(kind==="planned"?a.budgetCost:kind==="actual"?a.actualCost:(Number(a.actualCost||0)+Number(a.remainingCost||0)))||0;
    if(basis==="resource"){
      const keys=[String(a.uid||""),String(a.id||"")],map=kind==="planned"?targetMap:kind==="actual"?actualMap:null;
      if(kind==="forecast")return keys.reduce((n,k)=>Math.max(n,(actualMap?.get(k)||0)+(remainMap?.get(k)||0),targetMap?.get(k)||0),0);
      return keys.reduce((n,k)=>Math.max(n,map?.get(k)||0),0);
    }
    return Number(kind==="planned"?a.budgetUnits:kind==="actual"?a.actualUnits:(Number(a.actualUnits||0)+Number(a.remainingUnits||0)))||0;
  };
  const dates=acts.flatMap(a=>[a.baselineFinish,a.actualFinish,a.currentFinish||a.finish]).map(parseDate).filter(Boolean);
  if(!dates.length)return [];
  let cursor=startOfWeek(new Date(Math.min(...dates.map(d=>d.getTime())))),end=new Date(Math.max(...dates.map(d=>d.getTime()))),rows=[],guard=0,plannedCum=0,actualCum=0,forecastCum=0;
  while(cursor<=end&&guard++<520){
    const next=addDays(cursor,7),inWeek=v=>{const d=parseDate(v);return d&&d>=cursor&&d<next};
    const plannedWeekly=acts.filter(a=>inWeek(a.baselineFinish)).reduce((n,a)=>n+valueFor(a,"planned"),0);
    const actualWeekly=acts.filter(a=>a.percent>=100&&inWeek(a.actualFinish||a.currentFinish||a.finish)).reduce((n,a)=>n+valueFor(a,"actual"),0);
    const forecastWeekly=acts.filter(a=>inWeek(a.currentFinish||a.finish)).reduce((n,a)=>n+valueFor(a,"forecast"),0);
    plannedCum+=plannedWeekly;actualCum+=actualWeekly;forecastCum+=forecastWeekly;
    rows.push({week:`W${isoWeek(cursor)} ${cursor.getFullYear()}`,start:new Date(cursor),friday:addDays(cursor,4),end:addDays(next,-1),plannedWeekly,actualWeekly,forecastWeekly,plannedCum,actualCum,forecastCum});cursor=next;
  }
  return rows;
}
