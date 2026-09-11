import {daysBetween,parseDate} from "../core/utils.js";
import {criticalPathMigration,drivingChain} from "./network.js";

const amap=s=>new Map((s?.activities||[]).map(a=>[a.id,a]));
const rkey=r=>`${r.predId}|${r.succId}|${r.type}|${Number(r.lag||0).toFixed(3)}`;
const cleanKey=v=>String(v??"").trim();
function stable(value){
  if(value==null)return value;
  if(Array.isArray(value))return value.map(stable);
  if(typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
function eq(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b))}
function entityKey(x){return cleanKey(x?.id)||cleanKey(x?.name)}
function compareEntitySets(previousItems=[],currentItems=[],snapshot=x=>x){
  const p=new Map(previousItems.map(x=>[entityKey(x),x]).filter(([k])=>k)),c=new Map(currentItems.map(x=>[entityKey(x),x]).filter(([k])=>k));
  const added=[],deleted=[],changed=[];
  for(const [k,x] of c){const old=p.get(k);if(!old)added.push(x);else{const before=snapshot(old),after=snapshot(x);if(!eq(before,after))changed.push({key:k,before:old,after:x,beforeSnapshot:before,afterSnapshot:after})}}
  for(const [k,x] of p)if(!c.has(k))deleted.push(x);
  return {added,deleted,changed};
}
function calendarSnapshot(c={}){return {name:c.name||"",type:c.type||"",hoursPerDay:Number(c.hoursPerDay||0),hoursPerWeek:Number(c.hoursPerWeek||0),definition:c.raw?.clndr_data||c.raw?.weekDays||null,exceptions:c.raw?.exceptions||null,base:c.raw?.baseCalendarUID||c.raw?.base_clndr_id||""}}
function resourceSnapshot(r={}){return {name:r.name||"",type:r.type||r.raw?.rsrc_type||"",maxUnits:Number(r.maxUnits||r.raw?.max_qty_per_hr||0),standardRate:Number(r.standardRate||r.raw?.price_per_unit||0),costPerUse:Number(r.costPerUse||0),group:r.group||r.raw?.rsrc_short_name||"",code:r.code||"",calendar:r.calendarId||r.raw?.clndr_id||""}}
function assignmentAggregate(schedule){
  const map=new Map();
  for(const x of schedule?.assignments||[]){
    const activityId=cleanKey(x.activityId||x.task_id),resourceId=cleanKey(x.resourceId||x.rsrc_id);if(!activityId&&!resourceId)continue;
    const key=`${activityId}|${resourceId}`,old=map.get(key)||{activityId,resourceId,budget:0,actual:0,remaining:0,cost:0,actualCost:0,remainingCost:0,units:0};
    old.budget+=Number(x.target_qty||x.budgetUnits||0);old.actual+=Number(x.act_reg_qty||x.actualUnits||0);old.remaining+=Number(x.remain_qty||x.remainingUnits||0);old.cost+=Number(x.target_cost||x.budgetCost||0);old.actualCost+=Number(x.act_reg_cost||x.actualCost||0);old.remainingCost+=Number(x.remain_cost||x.remainingCost||0);old.units+=Number(x.units||0);map.set(key,old);
  }
  return map;
}
function compareAssignments(previous,current){
  const p=assignmentAggregate(previous),c=assignmentAggregate(current),added=[],deleted=[],changed=[];
  for(const [k,x] of c){const old=p.get(k);if(!old)added.push(x);else if(!eq(old,x))changed.push({key:k,before:old,after:x})}
  for(const [k,x] of p)if(!c.has(k))deleted.push(x);
  return {added,deleted,changed};
}
function activityResourceSignature(schedule){
  const map=new Map();for(const x of assignmentAggregate(schedule).values()){if(!map.has(x.activityId))map.set(x.activityId,[]);map.get(x.activityId).push(x)}
  for(const [k,list] of map)map.set(k,JSON.stringify(list.sort((a,b)=>String(a.resourceId).localeCompare(String(b.resourceId)))));return map;
}

export function compareSchedules(previous,current){
  if(!current)throw new Error("Current schedule required");
  if(!previous){
    const calendars={added:current.calendars||[],deleted:[],changed:[]},resources={added:current.resources||[],deleted:[],changed:[]},resourceAssignments={added:[...assignmentAggregate(current).values()],deleted:[],changed:[]};
    return {previous:null,current,added:current.activities||[],deleted:[],changed:[],relationshipAdded:current.relationships||[],relationshipDeleted:[],calendars,resources,resourceAssignments,summary:{}};
  }
  const p=amap(previous),c=amap(current),added=[],deleted=[],changed=[],pRes=activityResourceSignature(previous),cRes=activityResourceSignature(current);
  for(const a of current.activities||[]){
    const old=p.get(a.id);if(!old){added.push(a);continue}
    const delta={
      id:a.id,name:a.name,wbsPath:a.wbsPath,
      startDays:daysBetween(old.currentStart||old.start,a.currentStart||a.start),
      finishDays:daysBetween(old.currentFinish||old.finish,a.currentFinish||a.finish),
      durationDays:Number(a.originalDuration||0)-Number(old.originalDuration||0),
      floatDays:Number(a.totalFloat||0)-Number(old.totalFloat||0),
      progressPoints:Number(a.percent||0)-Number(old.percent||0),
      calendarChanged:(old.calendarId||old.calendarName)!==(a.calendarId||a.calendarName),
      constraintChanged:`${old.constraintType}|${old.constraintDate}`!==`${a.constraintType}|${a.constraintDate}`,
      statusChanged:old.status!==a.status,
      resourceChanged:(pRes.get(String(a.id))||"")!==(cRes.get(String(a.id))||"")
    };
    if(Object.values(delta).some((v,i)=>i>2&&(typeof v==="boolean"?v:Number(v)!==0)))changed.push(delta);
  }
  for(const a of previous.activities||[])if(!c.has(a.id))deleted.push(a);
  const pr=new Map((previous.relationships||[]).map(r=>[rkey(r),r])),cr=new Map((current.relationships||[]).map(r=>[rkey(r),r]));
  const relationshipAdded=[...cr].filter(([k])=>!pr.has(k)).map(([,v])=>v);
  const relationshipDeleted=[...pr].filter(([k])=>!cr.has(k)).map(([,v])=>v);
  const calendars=compareEntitySets(previous.calendars||[],current.calendars||[],calendarSnapshot);
  const resources=compareEntitySets(previous.resources||[],current.resources||[],resourceSnapshot);
  const resourceAssignments=compareAssignments(previous,current);
  const pFinish=Math.max(...(previous.activities||[]).map(a=>parseDate(a.currentFinish||a.finish)?.getTime()||0),0);
  const cFinish=Math.max(...(current.activities||[]).map(a=>parseDate(a.currentFinish||a.finish)?.getTime()||0),0);
  const migration=criticalPathMigration(previous,current);
  return {
    previous,current,added,deleted,changed,relationshipAdded,relationshipDeleted,migration,calendars,resources,resourceAssignments,
    summary:{
      dataDateDays:daysBetween(previous.dataDate,current.dataDate),
      forecastFinishDays:pFinish&&cFinish?Math.round((cFinish-pFinish)/86400000):0,
      progressPoints:comparableProgress(previous,current),
      addedActivities:added.length,deletedActivities:deleted.length,changedActivities:changed.length,
      addedRelationships:relationshipAdded.length,deletedRelationships:relationshipDeleted.length,
      addedCalendars:calendars.added.length,deletedCalendars:calendars.deleted.length,changedCalendars:calendars.changed.length,
      addedResources:resources.added.length,deletedResources:resources.deleted.length,changedResources:resources.changed.length,
      addedAssignments:resourceAssignments.added.length,deletedAssignments:resourceAssignments.deleted.length,changedAssignments:resourceAssignments.changed.length,
      enteredCritical:migration.entered.length,leftCritical:migration.left.length
    }
  };
}
export function avgProgress(schedule){
  const a=schedule?.activities||[];return a.length?a.reduce((n,x)=>n+Number(x.percent||0),0)/a.length:0;
}
export function whyDidDateMove(previous,current,activityId){
  const p=amap(previous).get(activityId),c=amap(current).get(activityId);
  if(!p||!c)return {activityId,found:false,evidence:[]};
  const evidence=[];
  const finish=daysBetween(p.currentFinish||p.finish,c.currentFinish||c.finish);
  const start=daysBetween(p.currentStart||p.start,c.currentStart||c.start);
  const dur=Number(c.originalDuration||0)-Number(p.originalDuration||0);
  const flt=Number(c.totalFloat||0)-Number(p.totalFloat||0);
  if(Math.abs(finish)>0)evidence.push({cause:"Forecast finish movement",impactDays:finish,confidence:"Confirmed"});
  if(Math.abs(start)>0)evidence.push({cause:"Forecast start movement",impactDays:start,confidence:"Confirmed"});
  if(Math.abs(dur)>0)evidence.push({cause:"Duration change",impactDays:dur,confidence:"Confirmed"});
  if((p.calendarId||p.calendarName)!==(c.calendarId||c.calendarName))evidence.push({cause:"Calendar assignment changed",impactDays:null,confidence:"Confirmed"});
  if(`${p.constraintType}|${p.constraintDate}`!==`${c.constraintType}|${c.constraintDate}`)evidence.push({cause:"Constraint changed",impactDays:null,confidence:"Confirmed"});
  const comp=compareSchedules(previous,current);
  const incomingAdded=comp.relationshipAdded.filter(r=>r.succId===activityId),incomingDeleted=comp.relationshipDeleted.filter(r=>r.succId===activityId);
  if(incomingAdded.length)evidence.push({cause:`${incomingAdded.length} predecessor relationship(s) added`,impactDays:null,confidence:"Confirmed"});
  if(incomingDeleted.length)evidence.push({cause:`${incomingDeleted.length} predecessor relationship(s) removed`,impactDays:null,confidence:"Confirmed"});
  const resourceChanged=comp.resourceAssignments.added.some(x=>x.activityId===activityId)||comp.resourceAssignments.deleted.some(x=>x.activityId===activityId)||comp.resourceAssignments.changed.some(x=>x.after?.activityId===activityId||x.before?.activityId===activityId);
  if(resourceChanged)evidence.push({cause:"Resource assignment or loading changed",impactDays:null,confidence:"Confirmed"});
  const pChain=drivingChain(previous,activityId).map(a=>a.id),cChain=drivingChain(current,activityId).map(a=>a.id);
  if(pChain.join("|")!==cChain.join("|"))evidence.push({cause:"Driving predecessor chain changed",impactDays:null,confidence:"Strongly indicated"});
  if(flt<0)evidence.push({cause:"Available float reduced",impactDays:flt,confidence:"Strongly indicated"});
  return {activityId,found:true,activity:c,finishMovementDays:finish,evidence};
}
function comparableProgress(previous,current){
  const p=amap(previous),c=amap(current),ids=[...c.keys()].filter(id=>p.has(id));
  if(!ids.length)return avgProgress(current)-avgProgress(previous);
  const old=ids.reduce((n,id)=>n+Number(p.get(id).percent||0),0)/ids.length;
  const now=ids.reduce((n,id)=>n+Number(c.get(id).percent||0),0)/ids.length;
  return now-old;
}
