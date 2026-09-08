
import {createSchedule} from "../core/model.js";
import {parseNum} from "../core/utils.js";

function splitLine(line){return line.split("\t")}
export function parseXERTables(text){
  const tables={},fields={},diagnostics={warnings:[],errors:[],malformedRows:0};
  let table=null;
  const lines=String(text||"").replace(/\r/g,"").split("\n");
  for(let lineNo=0;lineNo<lines.length;lineNo++){
    const line=lines[lineNo];if(!line.trim())continue;
    const parts=splitLine(line);
    if(parts[0]==="%T"){table=parts[1]||"";tables[table]??=[];continue}
    if(parts[0]==="%F"){if(!table){diagnostics.warnings.push(`%F before %T at line ${lineNo+1}`);continue}fields[table]=parts.slice(1);continue}
    if(parts[0]==="%R"){
      if(!table){diagnostics.warnings.push(`%R before %T at line ${lineNo+1}`);continue}
      const f=fields[table]||[];const vals=parts.slice(1),row={};
      if(f.length&&vals.length!==f.length){diagnostics.malformedRows++;diagnostics.warnings.push(`Field count mismatch in ${table} line ${lineNo+1}`)}
      for(let i=0;i<Math.max(f.length,vals.length);i++)row[f[i]||`field_${i+1}`]=vals[i]??"";
      tables[table].push(row);continue;
    }
  }
  return {tables,fields,diagnostics};
}
function byId(rows,key){return new Map((rows||[]).map(x=>[String(x[key]||""),x]))}
function statusName(v){
  const s=String(v||"").toUpperCase();
  if(s.includes("CMPLT")||s.includes("COMPLETE"))return "Complete";
  if(s.includes("ACTIVE")||s.includes("PROGRESS"))return "In Progress";
  return "Not Started";
}
export function parseXER(text,sourceName="schedule.xer"){
  const {tables,diagnostics}=parseXERTables(text);
  const project=(tables.PROJECT||[])[0]||{};
  const wbs=(tables.PROJWBS||[]).map(x=>({id:x.wbs_id,parentId:x.parent_wbs_id,code:x.wbs_short_name,name:x.wbs_name,raw:x}));
  const calendars=(tables.CALENDAR||[]).map(x=>({
    id:x.clndr_id,name:x.clndr_name,type:x.clndr_type,
    hoursPerDay:parseNum(x.day_hr_cnt)||8,hoursPerWeek:parseNum(x.week_hr_cnt)||40,raw:x
  }));
  const activities=(tables.TASK||[]).map(x=>({
    id:x.task_code||x.task_id,uid:x.task_id,name:x.task_name,wbsId:x.wbs_id,status:statusName(x.status_code),
    activityType:x.task_type,
    start:x.act_start_date||x.restart_date||x.early_start_date||x.target_start_date,
    finish:x.act_end_date||x.reend_date||x.early_end_date||x.target_end_date,
    currentStart:x.act_start_date||x.restart_date||x.early_start_date||x.target_start_date,
    currentFinish:x.act_end_date||x.reend_date||x.early_end_date||x.target_end_date,
    baselineStart:x.target_start_date,baselineFinish:x.target_end_date,
    actualStart:x.act_start_date,actualFinish:x.act_end_date,
    originalDuration:parseNum(x.target_drtn_hr_cnt)/24,remainingDuration:parseNum(x.remain_drtn_hr_cnt)/24,
    totalFloat:parseNum(x.total_float_hr_cnt)/24,freeFloat:parseNum(x.free_float_hr_cnt)/24,
    percent:parseNum(x.phys_complete_pct||x.complete_pct),calendarId:x.clndr_id,
    constraintType:x.cstr_type,constraintDate:x.cstr_date,secondaryConstraintType:x.cstr_type2,secondaryConstraintDate:x.cstr_date2,
    critical:parseNum(x.total_float_hr_cnt)<=0,raw:x
  }));
  const taskByUid=new Map(activities.map(a=>[a.uid,a]));
  const relationships=(tables.TASKPRED||[]).map(x=>({
    id:x.task_pred_id,predId:taskByUid.get(String(x.pred_task_id))?.id||x.pred_task_id,
    succId:taskByUid.get(String(x.task_id))?.id||x.task_id,type:String(x.pred_type||"FS").replace("PR_",""),
    lag:parseNum(x.lag_hr_cnt)/24,raw:x
  })).filter(r=>r.predId&&r.succId);
  const resources=(tables.RSRC||[]).map(x=>({id:x.rsrc_id,name:x.rsrc_name,type:x.rsrc_type,raw:x}));
  const assignments=(tables.TASKRSRC||[]).map(x=>({...x,activityId:taskByUid.get(String(x.task_id))?.id||x.task_id,resourceId:x.rsrc_id}));
  const schedule=createSchedule({
    id:`xer-${project.proj_id||sourceName}`,projectId:project.proj_id,projectName:project.proj_short_name||project.proj_name||sourceName,
    name:project.proj_short_name||project.proj_name||sourceName,sourceName,dataDate:project.last_recalc_date||project.data_date||project.plan_start_date,
    activities,relationships,wbs,calendars,resources,assignments,rawTables:tables,diagnostics
  });
  return {schedules:[schedule],tables,diagnostics};
}
export function parseXERFile(file,text){return parseXER(text,file?.name||"schedule.xer")}
