
import {scheduleSummary} from "../core/model.js?v=1.2.0";
import {compareSchedules} from "./comparison.js?v=1.2.0";
import {fourWeekLookahead} from "./timeseries.js?v=1.2.0";
import {scheduleHealth} from "./health.js?v=1.2.0";
export function scheduleNarrative(current,previous=null){
  const s=scheduleSummary(current),h=scheduleHealth(current),look=fourWeekLookahead(current),comp=previous?compareSchedules(previous,current):null;
  const paragraphs=[
    `As at ${s.dataDate||"the current data date"}, the programme contains ${s.activities} activities and is ${s.progress.toFixed(1)}% complete on an activity-weighted basis. Forecast completion is ${s.forecastFinish||"not available"}.`,
    `Schedule health is ${h.score}/100 (${h.label}), with ${s.critical} critical/zero-float activities and ${s.negativeFloat} activities in negative float.`,
  ];
  if(comp)paragraphs.push(`Compared with ${previous.name}, overall progress moved ${comp.summary.progressPoints>=0?"+":""}${comp.summary.progressPoints.toFixed(1)} percentage points and forecast completion moved ${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays} days. ${comp.summary.enteredCritical} activities entered the critical path and ${comp.summary.leftCritical} left it.`);
  const totalStarts=look.reduce((n,w)=>n+w.starts.length,0),totalFin=look.reduce((n,w)=>n+w.finishes.length,0),critStarts=look.reduce((n,w)=>n+w.criticalStarts.length,0);
  paragraphs.push(`The next four weeks contain ${totalStarts} forecast starts and ${totalFin} forecast finishes, including ${critStarts} critical starts. Management attention should focus on critical-path churn, negative float, missed starts and material forecast movement.`);
  return {paragraphs,lookahead:look,summary:s,health:h,comparison:comp};
}
