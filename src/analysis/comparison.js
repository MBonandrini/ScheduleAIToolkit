
import {daysBetween,parseDate} from "../core/utils.js";
import {criticalPathMigration,drivingChain} from "./network.js";

const amap=s=>new Map((s?.activities||[]).map(a=>[a.id,a]));
const rkey=r=>`${r.predId}|${r.succId}|${r.type}|${Number(r.lag||0).toFixed(3)}`;

export function compareSchedules(previous,current){
  if(!current)throw new Error("Current schedule required");
  if(!previous)return {previous:null,current,added:current.activities||[],deleted:[],changed:[],relationshipAdded:current.relationships||[],relationshipDeleted:[],summary:{}};
  const p=amap(previous),c=amap(current),added=[],deleted=[],changed=[];
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
      statusChanged:old.status!==a.status
    };
    if(Object.values(delta).some((v,i)=>i>2&&(typeof v==="boolean"?v:Number(v)!==0)))changed.push(delta);
  }
  for(const a of previous.activities||[])if(!c.has(a.id))deleted.push(a);
  const pr=new Map((previous.relationships||[]).map(r=>[rkey(r),r])),cr=new Map((current.relationships||[]).map(r=>[rkey(r),r]));
  const relationshipAdded=[...cr].filter(([k])=>!pr.has(k)).map(([,v])=>v);
  const relationshipDeleted=[...pr].filter(([k])=>!cr.has(k)).map(([,v])=>v);
  const pFinish=Math.max(...(previous.activities||[]).map(a=>parseDate(a.currentFinish||a.finish)?.getTime()||0),0);
  const cFinish=Math.max(...(current.activities||[]).map(a=>parseDate(a.currentFinish||a.finish)?.getTime()||0),0);
  const migration=criticalPathMigration(previous,current);
  return {
    previous,current,added,deleted,changed,relationshipAdded,relationshipDeleted,migration,
    summary:{
      dataDateDays:daysBetween(previous.dataDate,current.dataDate),
      forecastFinishDays:pFinish&&cFinish?Math.round((cFinish-pFinish)/86400000):0,
      progressPoints:comparableProgress(previous,current),
      addedActivities:added.length,deletedActivities:deleted.length,changedActivities:changed.length,
      addedRelationships:relationshipAdded.length,deletedRelationships:relationshipDeleted.length,
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
