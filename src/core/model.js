
import {parseNum,parseDate,isoDate,uid} from "./utils.js";

export function createSchedule(input={}){
  const s={
    id:input.id||uid("schedule"),
    projectId:String(input.projectId||""),
    projectName:String(input.projectName||input.name||"Untitled Project"),
    name:String(input.name||input.projectName||"Schedule"),
    sourceName:String(input.sourceName||""),
    dataDate:input.dataDate||null,
    baselineName:String(input.baselineName||""),
    importedAt:input.importedAt||new Date().toISOString(),
    activities:[],
    relationships:[],
    wbs:[],
    calendars:[],
    resources:[],
    assignments:[],
    codes:input.codes||[],
    rawTables:input.rawTables||{},
    diagnostics:input.diagnostics||{warnings:[],errors:[]}
  };
  s.activities=(input.activities||[]).map(a=>normalizeActivity(a,s));
  s.relationships=(input.relationships||[]).map(normalizeRelationship);
  s.wbs=(input.wbs||[]).map(normalizeWBS);
  s.calendars=(input.calendars||[]).map(normalizeCalendar);
  s.resources=(input.resources||[]).map(r=>({...r,id:String(r.id||r.rsrc_id||""),name:String(r.name||r.rsrc_name||"")}));
  s.assignments=(input.assignments||[]).map(x=>({...x,activityId:String(x.activityId||x.task_id||""),resourceId:String(x.resourceId||x.rsrc_id||"")}));
  hydrateSchedule(s);
  return s;
}

function isMilestoneType(value){
  const t=String(value||"").trim();
  return /milestone/i.test(t)||/^TT_(?:Start)?Mile$/i.test(t)||/^TT_FinMile$/i.test(t);
}
export function normalizeActivity(a,schedule=null){
  return {
    id:String(a.id||a.task_code||a.task_id||""),
    uid:String(a.uid||a.task_id||a.id||""),
    name:String(a.name||a.task_name||""),
    wbsId:String(a.wbsId||a.wbs_id||""),
    wbsPath:String(a.wbsPath||""),
    status:String(a.status||a.status_code||"Not Started"),
    activityType:String(a.activityType||a.task_type||""),
    start:a.start||a.currentStart||a.act_start_date||a.target_start_date||null,
    finish:a.finish||a.currentFinish||a.act_end_date||a.target_end_date||null,
    currentStart:a.currentStart||a.start||a.act_start_date||a.target_start_date||null,
    currentFinish:a.currentFinish||a.finish||a.act_end_date||a.target_end_date||null,
    baselineStart:a.baselineStart||a.target_start_date||null,
    baselineFinish:a.baselineFinish||a.target_end_date||null,
    actualStart:a.actualStart||a.act_start_date||null,
    actualFinish:a.actualFinish||a.act_end_date||null,
    originalDuration:a.originalDuration!=null?parseNum(a.originalDuration):parseNum(a.target_drtn_hr_cnt)/24,
    remainingDuration:a.remainingDuration!=null?parseNum(a.remainingDuration):parseNum(a.remain_drtn_hr_cnt)/24,
    totalFloat:a.totalFloat!=null?parseNum(a.totalFloat):parseNum(a.total_float_hr_cnt)/24,
    freeFloat:a.freeFloat!=null?parseNum(a.freeFloat):parseNum(a.free_float_hr_cnt)/24,
    percent:parseNum(a.percent??a.phys_complete_pct??a.complete_pct),
    calendarId:String(a.calendarId||a.clndr_id||""),
    calendarName:String(a.calendarName||""),
    constraintType:String(a.constraintType||a.cstr_type||""),
    constraintDate:a.constraintDate||a.cstr_date||null,
    secondaryConstraintType:String(a.secondaryConstraintType||a.cstr_type2||""),
    secondaryConstraintDate:a.secondaryConstraintDate||a.cstr_date2||null,
    critical:Boolean(a.critical)||parseNum(a.totalFloat??a.total_float_hr_cnt)<=0,
    milestone:Boolean(a.milestone)||isMilestoneType(a.activityType||a.task_type),
    budgetUnits:parseNum(a.budgetUnits),
    actualUnits:parseNum(a.actualUnits),
    remainingUnits:parseNum(a.remainingUnits),
    budgetCost:parseNum(a.budgetCost),
    actualCost:parseNum(a.actualCost),
    remainingCost:parseNum(a.remainingCost),
    codes:a.codes||{},
    udf:a.udf||{},
    raw:a.raw||a
  };
}
export function normalizeRelationship(r){
  const type=String(r.type||r.pred_type||"FS").toUpperCase().replace("PR_","");
  return {
    id:String(r.id||r.task_pred_id||uid("rel")),
    predId:String(r.predId||r.pred_task_id||""),
    succId:String(r.succId||r.task_id||""),
    type:["FS","SS","FF","SF"].includes(type)?type:"FS",
    lag:r.lag!=null?parseNum(r.lag):parseNum(r.lag_hr_cnt)/24,
    raw:r.raw||r
  };
}
export function normalizeWBS(w){
  return {
    id:String(w.id||w.wbs_id||""),
    parentId:String(w.parentId||w.parent_wbs_id||""),
    code:String(w.code||w.wbs_short_name||""),
    name:String(w.name||w.wbs_name||w.code||""),
    path:String(w.path||""),
    raw:w.raw||w
  };
}
export function normalizeCalendar(c){
  return {
    id:String(c.id||c.clndr_id||""),
    name:String(c.name||c.clndr_name||""),
    type:String(c.type||c.clndr_type||""),
    hoursPerDay:parseNum(c.hoursPerDay||c.day_hr_cnt||8),
    hoursPerWeek:parseNum(c.hoursPerWeek||c.week_hr_cnt||40),
    raw:c.raw||c
  };
}
export function hydrateSchedule(s){
  const wbsMap=new Map(s.wbs.map(w=>[w.id,w]));
  const calMap=new Map(s.calendars.map(c=>[c.id,c]));
  const pathFor=id=>{
    const parts=[];let cur=wbsMap.get(id),guard=0;
    while(cur&&guard++<100){parts.unshift(cur.name||cur.code);cur=wbsMap.get(cur.parentId)}
    return parts.join(" / ");
  };
  for(const w of s.wbs)w.path=pathFor(w.id);
  for(const a of s.activities){
    a.wbsPath=a.wbsPath||pathFor(a.wbsId);
    a.calendarName=a.calendarName||calMap.get(a.calendarId)?.name||"";
    a.critical=Boolean(a.critical)||Number(a.totalFloat)<=0;
    a.milestone=Boolean(a.milestone)||isMilestoneType(a.activityType||a.task_type);
    a.start=a.currentStart||a.start;a.finish=a.currentFinish||a.finish;
  }
  const byTask=new Map();
  for(const x of s.assignments){
    if(!byTask.has(x.activityId))byTask.set(x.activityId,[]);
    byTask.get(x.activityId).push(x);
  }
  for(const a of s.activities){
    const list=byTask.get(a.uid)||byTask.get(a.id)||[];
    a.assignments=list;
    if(list.length){
      a.budgetUnits=list.reduce((n,x)=>n+parseNum(x.target_qty||x.budgetUnits),0);
      a.actualUnits=list.reduce((n,x)=>n+parseNum(x.act_reg_qty||x.actualUnits),0);
      a.remainingUnits=list.reduce((n,x)=>n+parseNum(x.remain_qty||x.remainingUnits),0);
      a.budgetCost=list.reduce((n,x)=>n+parseNum(x.target_cost||x.budgetCost),0);
      a.actualCost=list.reduce((n,x)=>n+parseNum(x.act_reg_cost||x.actualCost),0);
      a.remainingCost=list.reduce((n,x)=>n+parseNum(x.remain_cost||x.remainingCost),0);
    }
  }
  return s;
}
export function scheduleSummary(s){
  const acts=s.activities||[],complete=acts.filter(a=>a.percent>=100).length,inProgress=acts.filter(a=>a.percent>0&&a.percent<100).length;
  const finishes=acts.map(a=>parseDate(a.currentFinish||a.finish)).filter(Boolean);
  return {
    activities:acts.length,
    relationships:(s.relationships||[]).length,
    complete,
    inProgress,
    notStarted:acts.length-complete-inProgress,
    critical:acts.filter(a=>a.critical||a.totalFloat<=0).length,
    negativeFloat:acts.filter(a=>a.totalFloat<0).length,
    progress:acts.length?acts.reduce((n,a)=>n+a.percent,0)/acts.length:0,
    forecastFinish:finishes.length?isoDate(new Date(Math.max(...finishes.map(d=>d.getTime())))):"",
    dataDate:isoDate(s.dataDate)
  };
}
