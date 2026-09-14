import {compareSchedules} from "./comparison.js";
import {isoDate} from "../core/utils.js";

const relKey=r=>`${r.predId}|${r.succId}`;
function relationChangesForActivity(comp,id){
  const added=(comp.relationshipAdded||[]).filter(r=>r.predId===id||r.succId===id),deleted=(comp.relationshipDeleted||[]).filter(r=>r.predId===id||r.succId===id);
  return {added,deleted};
}
function activityMap(s){return new Map((s?.activities||[]).map(a=>[String(a.id),a]))}
function changeSentence(label,value){return value?`${label}: ${value}`:""}

export function identifyDelayEvents(previous,current){
  if(!previous||!current)return [];
  const comp=compareSchedules(previous,current),p=activityMap(previous),c=activityMap(current),events=[];
  for(const x of comp.changed||[]){
    const before=p.get(String(x.id)),after=c.get(String(x.id));if(!before||!after)continue;
    const categories=[],evidence=[];
    if(Number(x.startDays)>0){categories.push("Later start");evidence.push(changeSentence("Start moved",`+${Number(x.startDays).toFixed(0)}d`))}
    if(Number(x.finishDays)>0){categories.push("Later finish");evidence.push(changeSentence("Finish moved",`+${Number(x.finishDays).toFixed(0)}d`))}
    if(Number(x.durationDays)>0){categories.push("Duration increase");evidence.push(changeSentence("Original duration",`+${Number(x.durationDays).toFixed(1)}d`))}
    if(x.calendarChanged){categories.push("Calendar change");evidence.push(changeSentence("Calendar",`${before.calendarName||before.calendarId||"—"} → ${after.calendarName||after.calendarId||"—"}`))}
    if(x.resourceChanged){categories.push("Resource change");evidence.push("Resource assignment/loading changed")}
    if(x.constraintChanged){categories.push("Constraint change");evidence.push("Constraint type/date changed")}
    const logic=relationChangesForActivity(comp,String(x.id));
    if(logic.added.length||logic.deleted.length){categories.push("Logic change");evidence.push(`Logic +${logic.added.length} / -${logic.deleted.length}`)}
    if(!categories.length)continue;
    const impact=Math.max(0,Number(x.finishDays)||0,Number(x.startDays)||0,Number(x.durationDays)||0);
    events.push({
      candidateId:`ACT:${x.id}`,
      selected:true,
      category:categories.join("; "),
      title:`${x.id} · ${categories[0]}${categories.length>1?` +${categories.length-1} change(s)`:""}`,
      date:isoDate(current.dataDate)||isoDate(after.currentStart||after.start)||"",
      activityIds:[String(x.id)],
      impactDays:impact,
      description:`${after.name||x.name||x.id}. ${evidence.filter(Boolean).join("; ")}.`,
      source:"Activity comparison"
    });
  }
  for(const a of comp.added||[])events.push({candidateId:`ADD:${a.id}`,selected:true,category:"Activity added",title:`${a.id} · Activity added`,date:isoDate(current.dataDate)||"",activityIds:[String(a.id)],impactDays:0,description:`Activity added in the later schedule: ${a.name||a.id}.`,source:"Activity comparison"});
  for(const a of comp.deleted||[])events.push({candidateId:`DEL:${a.id}`,selected:true,category:"Activity removed",title:`${a.id} · Activity removed`,date:isoDate(current.dataDate)||"",activityIds:[String(a.id)],impactDays:0,description:`Activity removed from the later schedule: ${a.name||a.id}.`,source:"Activity comparison"});
  const activityIds=new Set(events.flatMap(e=>e.activityIds));
  for(const r of comp.relationshipAdded||[]){const id=String(r.succId||r.predId||"");if(activityIds.has(id))continue;events.push({candidateId:`RELADD:${relKey(r)}:${r.type||"FS"}`,selected:true,category:"Logic added",title:`Logic added · ${r.predId} ${r.type||"FS"} ${r.succId}`,date:isoDate(current.dataDate)||"",activityIds:[String(r.predId),String(r.succId)].filter(Boolean),impactDays:0,description:`Relationship added: ${r.predId} ${r.type||"FS"} ${r.succId}${Number(r.lag||0)?` with ${Number(r.lag)}d lag`:""}.`,source:"Relationship comparison"})}
  for(const r of comp.relationshipDeleted||[]){const id=String(r.succId||r.predId||"");if(activityIds.has(id))continue;events.push({candidateId:`RELDEL:${relKey(r)}:${r.type||"FS"}`,selected:true,category:"Logic removed",title:`Logic removed · ${r.predId} ${r.type||"FS"} ${r.succId}`,date:isoDate(current.dataDate)||"",activityIds:[String(r.predId),String(r.succId)].filter(Boolean),impactDays:0,description:`Relationship removed: ${r.predId} ${r.type||"FS"} ${r.succId}${Number(r.lag||0)?` with ${Number(r.lag)}d lag`:""}.`,source:"Relationship comparison"})}
  return events.sort((a,b)=>Number(b.impactDays||0)-Number(a.impactDays||0)||String(a.title).localeCompare(String(b.title)));
}
