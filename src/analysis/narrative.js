import {scheduleSummary} from "../core/model.js";
import {compareSchedules} from "./comparison.js";
import {fourWeekLookahead} from "./timeseries.js";
import {scheduleHealth} from "./health.js";
import {networkHealth} from "./network.js";
import {parseDate,daysBetween} from "../core/utils.js";

function topBand(path){return String(path||"Unassigned").split(" / ")[0]||"Unassigned"}
function phaseRows(schedule){
  const groups=new Map();
  for(const a of schedule.activities||[]){const k=topBand(a.wbsPath);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a)}
  return [...groups.entries()].map(([name,acts])=>{
    const starts=acts.map(a=>parseDate(a.currentStart||a.start)).filter(Boolean),finishes=acts.map(a=>parseDate(a.currentFinish||a.finish)).filter(Boolean);
    return {name,activities:acts.length,progress:acts.length?acts.reduce((n,a)=>n+Number(a.percent||0),0)/acts.length:0,critical:acts.filter(a=>a.critical||a.totalFloat<=0).length,negative:acts.filter(a=>a.totalFloat<0).length,start:starts.length?new Date(Math.min(...starts.map(d=>d.getTime()))):null,finish:finishes.length?new Date(Math.max(...finishes.map(d=>d.getTime()))):null,budgetUnits:acts.reduce((n,a)=>n+Number(a.budgetUnits||0),0),remainingUnits:acts.reduce((n,a)=>n+Number(a.remainingUnits||0),0)};
  }).sort((a,b)=>(a.start?.getTime()||0)-(b.start?.getTime()||0));
}
function resourceRows(schedule){
  const rows=[];
  for(const r of schedule.resources||[]){
    const xs=(schedule.assignments||[]).filter(x=>String(x.resourceId)===String(r.id));
    const budget=xs.reduce((n,x)=>n+Number(x.target_qty||x.budgetUnits||0),0),actual=xs.reduce((n,x)=>n+Number(x.act_reg_qty||x.actualUnits||0),0),remaining=xs.reduce((n,x)=>n+Number(x.remain_qty||x.remainingUnits||0),0);
    if(budget||actual||remaining)rows.push({name:r.name||r.id,budget,actual,remaining});
  }
  return rows.sort((a,b)=>(b.remaining+b.actual)-(a.remaining+a.actual)).slice(0,8);
}
export function scheduleNarrative(current,previous=null){
  const s=scheduleSummary(current),h=scheduleHealth(current),look=fourWeekLookahead(current),comp=previous?compareSchedules(previous,current):null,net=networkHealth(current),phases=phaseRows(current),resources=resourceRows(current);
  const totalBudget=current.activities.reduce((n,a)=>n+Number(a.budgetUnits||0),0),totalActual=current.activities.reduce((n,a)=>n+Number(a.actualUnits||0),0),totalRemaining=current.activities.reduce((n,a)=>n+Number(a.remainingUnits||0),0);
  const totalBudgetCost=current.activities.reduce((n,a)=>n+Number(a.budgetCost||0),0),totalActualCost=current.activities.reduce((n,a)=>n+Number(a.actualCost||0),0),totalRemainingCost=current.activities.reduce((n,a)=>n+Number(a.remainingCost||0),0);
  const constraints=current.activities.filter(a=>a.constraintType).length,missedStarts=current.activities.filter(a=>Number(a.percent||0)<=0&&parseDate(a.currentStart||a.start)&&parseDate(a.currentStart||a.start)<parseDate(current.dataDate)).length;
  const paragraphs=[
    `As at ${s.dataDate||"the current data date"}, the programme contains ${s.activities} activities and is ${s.progress.toFixed(1)}% complete on an activity-weighted basis. Forecast completion is ${s.forecastFinish||"not available"}. The schedule currently contains ${s.critical} critical/zero-float activities and ${s.negativeFloat} activities in negative float.`,
    `Schedule health is ${h.score}/100 (${h.label}). Logic density is ${net.logicDensity.toFixed(2)} relationships per activity, with ${net.openStarts} open starts, ${net.openFinishes} open finishes, ${net.leads} leads, ${net.lags} lags and ${net.cycles} detected logic cycle(s). ${constraints} activities carry constraints and ${missedStarts} not-started activities are forecast before the data date.`,
  ];
  if(phases.length){
    const phaseText=phases.slice(0,8).map(p=>`${p.name}: ${p.activities} activities, ${p.progress.toFixed(1)}% complete, ${p.critical} critical, ${p.negative} negative-float`).join("; ");
    paragraphs.push(`Phase/WBS position — ${phaseText}. This identifies where programme density and near-term management attention are concentrated.`);
  }
  if(totalBudget||totalActual||totalRemaining)paragraphs.push(`Loaded quantity/resource units total ${totalBudget.toFixed(1)} budget, ${totalActual.toFixed(1)} actual and ${totalRemaining.toFixed(1)} remaining. These values are taken directly from imported assignment/activity data and should be interpreted according to the source schedule's unit conventions.`);
  if(totalBudgetCost||totalActualCost||totalRemainingCost)paragraphs.push(`Loaded cost values total ${totalBudgetCost.toFixed(0)} budget, ${totalActualCost.toFixed(0)} actual and ${totalRemainingCost.toFixed(0)} remaining, giving an indicative forecast of ${(totalActualCost+totalRemainingCost).toFixed(0)} where the source data is populated.`);
  if(resources.length)paragraphs.push(`The largest loaded resource positions are ${resources.map(r=>`${r.name} (${r.actual.toFixed(1)} actual / ${r.remaining.toFixed(1)} remaining)`).join("; ")}. Because the imported schedule does not necessarily contain time-phased resource curves, this is a workload indication rather than a peak manpower forecast.`);
  if(comp)paragraphs.push(`Compared with ${previous.projectName||previous.name||"the selected comparison schedule"}, overall progress moved ${comp.summary.progressPoints>=0?"+":""}${comp.summary.progressPoints.toFixed(1)} percentage points and forecast completion moved ${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays} days. ${comp.summary.addedActivities} activities were added, ${comp.summary.deletedActivities} were removed, ${comp.summary.addedRelationships} relationships were added and ${comp.summary.deletedRelationships} were removed. ${comp.summary.enteredCritical} activities entered the critical path and ${comp.summary.leftCritical} left it.`);
  const totalStarts=look.reduce((n,w)=>n+w.starts.length,0),totalFin=look.reduce((n,w)=>n+w.finishes.length,0),critStarts=look.reduce((n,w)=>n+w.criticalStarts.length,0);
  const nearTerm=look.flatMap(w=>w.starts).filter((a,i,arr)=>arr.findIndex(x=>x.id===a.id)===i).slice(0,12);
  paragraphs.push(`The next four weeks contain ${totalStarts} forecast starts and ${totalFin} forecast finishes, including ${critStarts} critical starts. Key near-term starts include ${nearTerm.length?nearTerm.map(a=>`${a.id} ${a.name}`).join("; "):"none identified"}.`);
  const roadblocks=[];if(s.negativeFloat)roadblocks.push(`${s.negativeFloat} negative-float activities`);if(net.openStarts||net.openFinishes)roadblocks.push(`${net.openStarts+net.openFinishes} open-ended logic conditions`);if(constraints)roadblocks.push(`${constraints} constrained activities`);if(missedStarts)roadblocks.push(`${missedStarts} missed/not-started forecast starts`);if(comp&&comp.summary.forecastFinishDays>0)roadblocks.push(`${comp.summary.forecastFinishDays} days of project finish slippage versus the selected comparison`);
  paragraphs.push(`Potential roadblocks / management checks: ${roadblocks.length?roadblocks.join("; "):"no major deterministic roadblocks were identified from the loaded schedule fields"}. These are schedule signals rather than contractual conclusions and should be reconciled with site status, procurement, design, commissioning and change records.`);
  return {paragraphs,lookahead:look,summary:s,health:h,comparison:comp,phases,resources,totals:{budgetUnits:totalBudget,actualUnits:totalActual,remainingUnits:totalRemaining,budgetCost:totalBudgetCost,actualCost:totalActualCost,remainingCost:totalRemainingCost}};
}
