
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
