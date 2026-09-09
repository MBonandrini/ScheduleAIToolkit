
import {buildNetwork,drivingChain,traceToMilestone,openEnds,longestPath} from "../analysis/network.js?v=1.2.0";
import {compareSchedules,whyDidDateMove} from "../analysis/comparison.js?v=1.2.0";
import {scheduleHealth,forecastConfidence} from "../analysis/health.js?v=1.2.0";
import {activityHistory,milestoneHistory} from "../analysis/timemachine.js?v=1.2.0";
import {fourWeekLookahead} from "../analysis/timeseries.js?v=1.2.0";

const compactActivity=a=>a?({id:a.id,name:a.name,wbs:a.wbsPath,status:a.status,start:a.currentStart||a.start,finish:a.currentFinish||a.finish,float:a.totalFloat,percent:a.percent,critical:a.critical}):null;
export function toolRegistry({current,previous,revisions=[]}){
  const byId=id=>current?.activities?.find(a=>a.id===id);
  return {
    get_activity:({id})=>compactActivity(byId(id)),
    get_predecessors:({id})=>{
      const g=buildNetwork(current);return (g.incoming.get(id)||[]).map(r=>({relationship:r,activity:compactActivity(g.activities.get(r.predId))}));
    },
    get_successors:({id})=>{
      const g=buildNetwork(current);return (g.outgoing.get(id)||[]).map(r=>({relationship:r,activity:compactActivity(g.activities.get(r.succId))}));
    },
    get_critical_path:()=>current.activities.filter(a=>a.critical||a.totalFloat<=0).map(compactActivity),
    get_driving_chain:({id})=>drivingChain(current,id).map(compactActivity),
    trace_to_milestone:({id})=>{const x=traceToMilestone(current,id);return {...x,drivingChain:x.drivingChain.map(compactActivity),longestPath:x.longestPath.map(compactActivity)}},
    get_open_ends:()=>{const x=openEnds(current);return {starts:x.starts.map(compactActivity),finishes:x.finishes.map(compactActivity)}},
    get_longest_path:({id=null}={})=>{const x=longestPath(current,id);return {...x,path:x.path.map(compactActivity)}},
    get_schedule_changes:()=>previous?compareSchedules(previous,current):{message:"No comparative revision selected"},
    why_date_moved:({id})=>previous?whyDidDateMove(previous,current,id):{message:"No comparative revision selected"},
    get_activity_history:({id})=>activityHistory(revisions,id),
    get_milestone_history:()=>milestoneHistory(revisions),
    get_schedule_health:()=>scheduleHealth(current),
    get_forecast_confidence:({id=null}={})=>forecastConfidence(revisions,id),
    get_lookahead:()=>fourWeekLookahead(current).map(w=>({...w,starts:w.starts.map(compactActivity),finishes:w.finishes.map(compactActivity),criticalStarts:w.criticalStarts.map(compactActivity)}))
  };
}
export function inferTool(question,current){
  const q=String(question||"").toLowerCase(),id=(current?.activities||[]).find(a=>q.includes(a.id.toLowerCase()))?.id||null;
  if(/why.*(date|finish|move|slip)/.test(q)&&id)return {name:"why_date_moved",args:{id}};
  if(/driv|trace|predecessor chain/.test(q)&&id)return {name:"get_driving_chain",args:{id}};
  if(/predecessor/.test(q)&&id)return {name:"get_predecessors",args:{id}};
  if(/successor/.test(q)&&id)return {name:"get_successors",args:{id}};
  if(/open end|open start|open finish/.test(q))return {name:"get_open_ends",args:{}};
  if(/critical path/.test(q))return {name:"get_critical_path",args:{}};
  if(/longest path/.test(q))return {name:"get_longest_path",args:id?{id}:{}};
  if(/what changed|change.*schedule|since.*previous/.test(q))return {name:"get_schedule_changes",args:{}};
  if(/health|dcma|quality/.test(q))return {name:"get_schedule_health",args:{}};
  if(/lookahead|next 4|next four/.test(q))return {name:"get_lookahead",args:{}};
  if(/history|time machine/.test(q)&&id)return {name:"get_activity_history",args:{id}};
  if(/confidence|forecast reliability/.test(q))return {name:"get_forecast_confidence",args:id?{id}:{}};
  if(id)return {name:"get_activity",args:{id}};
  return null;
}
