
import {parseDate,daysBetween} from "../core/utils.js";
export function activityHistory(revisions,activityId){
  return (revisions||[]).map(s=>{
    const a=s.activities.find(x=>x.id===activityId);if(!a)return null;
    return {scheduleId:s.id,scheduleName:s.name,dataDate:s.dataDate,activityId:a.id,name:a.name,start:a.currentStart||a.start,finish:a.currentFinish||a.finish,totalFloat:a.totalFloat,percent:a.percent,critical:a.critical};
  }).filter(Boolean);
}
export function milestoneHistory(revisions){
  const ids=new Set();for(const s of revisions||[])for(const a of s.activities||[])if(a.milestone)ids.add(a.id);
  return [...ids].map(id=>({id,history:activityHistory(revisions,id)})).filter(x=>x.history.length);
}
export function revisionLineage(revisions){
  const ordered=[...(revisions||[])].sort((a,b)=>(parseDate(a.dataDate)?.getTime()||0)-(parseDate(b.dataDate)?.getTime()||0));
  return ordered.map((s,i)=>({schedule:s,index:i,previous:i?ordered[i-1]:null,dataDateGapDays:i?daysBetween(ordered[i-1].dataDate,s.dataDate):0}));
}
