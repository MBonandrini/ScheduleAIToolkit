import {createSchedule} from "../core/model.js";
function unesc(s){return String(s||"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&")}
function tag(block,name){const m=String(block||"").match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));return m?unesc(m[1].replace(/<[^>]+>/g,"").trim()):""}
function blocks(xml,name){return [...String(xml||"").matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"gi"))].map(m=>m[1])}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function yes(v){return ["1","true","yes"].includes(String(v||"").trim().toLowerCase())}
function durationHours(v){
  const s=String(v||"").trim();if(!s)return 0;
  if(/^[-+]?\d+(?:\.\d+)?$/.test(s))return num(s);
  const sign=s.startsWith("-")?-1:1,m=s.match(/P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?/i);if(!m)return 0;
  return sign*((num(m[1])*24)+num(m[2])+num(m[3])/60+num(m[4])/3600);
}
function constraintName(v){return ({"0":"As Soon As Possible","1":"As Late As Possible","2":"Must Start On","3":"Must Finish On","4":"Start No Earlier Than","5":"Start No Later Than","6":"Finish No Earlier Than","7":"Finish No Later Than"})[String(v)]||String(v||"")}
function typeName(v){return ({"0":"Fixed Units","1":"Fixed Duration","2":"Fixed Work"})[String(v)]||"Task"}
function baselineBlock(task){const bs=blocks(task,"Baseline");return bs.find(x=>tag(x,"Number")==="0")||bs[0]||""}
function parentOutline(outline){const p=String(outline||"").split(".");p.pop();return p.join(".")}
function hoursToDays(hours,hpd){return num(hours)/Math.max(.1,num(hpd)||8)}

export function parseMSProjectXML(text,sourceName="schedule.xml"){
  const xml=String(text||"");if(!/<Project[\s>]/i.test(xml))throw new Error("Invalid Microsoft Project XML");
  const projectName=tag(xml,"Name")||sourceName,dataDate=tag(xml,"StatusDate")||tag(xml,"CurrentDate"),hoursPerDay=Math.max(.1,num(tag(xml,"HoursPerDay"))||8),hoursPerWeek=Math.max(hoursPerDay,num(tag(xml,"HoursPerWeek"))||40);
  const taskBlocks=blocks(xml,"Task"),taskMeta=taskBlocks.map(t=>({block:t,uid:tag(t,"UID"),id:tag(t,"ID")||tag(t,"UID"),name:tag(t,"Name"),outline:tag(t,"OutlineNumber"),outlineLevel:num(tag(t,"OutlineLevel")),summary:yes(tag(t,"Summary"))})).filter(x=>x.uid!=="0");
  const summaryByOutline=new Map(taskMeta.filter(x=>x.summary&&x.outline).map(x=>[x.outline,x]));
  const wbs=taskMeta.filter(x=>x.summary).map(x=>{let po=parentOutline(x.outline),p=null;while(po&&!p){p=summaryByOutline.get(po)||null;po=parentOutline(po)}return {id:`WBS:${x.uid}`,parentId:p?`WBS:${p.uid}`:"",code:tag(x.block,"WBS")||x.outline||x.id,name:x.name||tag(x.block,"WBS")||x.outline||`Summary ${x.id}`,raw:{uid:x.uid,outline:x.outline,summary:true}}});
  const nearestWbs=t=>{let po=parentOutline(t.outline),p=null;while(po&&!p){p=summaryByOutline.get(po)||null;po=parentOutline(po)}return p?`WBS:${p.uid}`:""};
  const normalTasks=taskMeta.filter(x=>!x.summary),uidToId=new Map(normalTasks.map(x=>[x.uid,x.id]));
  const activities=normalTasks.map(t=>{const b=t.block,bl=baselineBlock(b),pct=num(tag(b,"PercentComplete")),duration=durationHours(tag(b,"Duration")),remain=durationHours(tag(b,"RemainingDuration")),work=durationHours(tag(b,"Work")),actualWork=durationHours(tag(b,"ActualWork")),remainingWork=durationHours(tag(b,"RemainingWork")),slackTenths=num(tag(b,"TotalSlack")),freeTenths=num(tag(b,"FreeSlack")),milestone=yes(tag(b,"Milestone"));return {
    id:t.id,uid:t.uid,name:t.name,wbsId:nearestWbs(t),wbsPath:"",status:pct>=100?"Complete":pct>0?"In Progress":"Not Started",activityType:milestone?"Milestone":typeName(tag(b,"Type")),
    start:tag(b,"Start"),finish:tag(b,"Finish"),currentStart:tag(b,"Start"),currentFinish:tag(b,"Finish"),baselineStart:tag(bl,"Start"),baselineFinish:tag(bl,"Finish"),actualStart:tag(b,"ActualStart"),actualFinish:tag(b,"ActualFinish"),percent:pct,
    originalDuration:hoursToDays(duration,hoursPerDay),remainingDuration:hoursToDays(remain,hoursPerDay),totalFloat:slackTenths/(10*60*hoursPerDay),freeFloat:freeTenths/(10*60*hoursPerDay),milestone,critical:yes(tag(b,"Critical"))||slackTenths<=0,
    calendarId:tag(b,"CalendarUID"),constraintType:constraintName(tag(b,"ConstraintType")),constraintDate:tag(b,"ConstraintDate"),
    budgetUnits:work,actualUnits:actualWork,remainingUnits:remainingWork,budgetCost:num(tag(b,"Cost")),actualCost:num(tag(b,"ActualCost")),remainingCost:num(tag(b,"RemainingCost")),
    raw:{uid:t.uid,outlineNumber:t.outline,outlineLevel:t.outlineLevel,type:tag(b,"Type"),summary:false,deadline:tag(b,"Deadline"),percentWorkComplete:num(tag(b,"PercentWorkComplete"))}
  }});
  const relationships=[];for(const t of normalTasks){const succ=uidToId.get(t.uid);if(!succ)continue;for(const p of blocks(t.block,"PredecessorLink")){const pred=uidToId.get(tag(p,"PredecessorUID"));if(!pred)continue;const map={"0":"FF","1":"FS","2":"SF","3":"SS"};relationships.push({predId:pred,succId:succ,type:map[tag(p,"Type")]||"FS",lag:num(tag(p,"LinkLag"))/(10*60*hoursPerDay),raw:{crossProject:tag(p,"CrossProject"),predecessorProjectUID:tag(p,"PredecessorProjectUID")}})}}
  const calendars=blocks(xml,"Calendar").map(c=>({id:tag(c,"UID"),name:tag(c,"Name")||`Calendar ${tag(c,"UID")}`,type:yes(tag(c,"IsBaseCalendar"))?"Base":"Derived",hoursPerDay,hoursPerWeek,raw:{baseCalendarUID:tag(c,"BaseCalendarUID"),weekDays:blocks(c,"WeekDay").map(w=>({dayType:tag(w,"DayType"),dayWorking:tag(w,"DayWorking"),workingTimes:blocks(w,"WorkingTime").map(x=>({from:tag(x,"FromTime"),to:tag(x,"ToTime")}))})),exceptions:blocks(c,"Exception").map(x=>({name:tag(x,"Name"),from:tag(x,"TimePeriod"),working:tag(x,"DayWorking")}))}})).filter(c=>c.id);
  const resources=blocks(xml,"Resource").map(r=>({id:tag(r,"UID"),name:tag(r,"Name")||`Resource ${tag(r,"UID")}`,type:tag(r,"Type"),maxUnits:num(tag(r,"MaxUnits")),standardRate:num(tag(r,"StandardRate")),costPerUse:num(tag(r,"CostPerUse")),group:tag(r,"Group"),code:tag(r,"Code"),raw:{id:tag(r,"ID"),initials:tag(r,"Initials"),materialLabel:tag(r,"MaterialLabel")}})).filter(r=>r.id&&r.id!=="0");
  const knownTaskUids=new Set(normalTasks.map(t=>t.uid)),knownResources=new Set(resources.map(r=>r.id));
  const assignments=blocks(xml,"Assignment").map(a=>{const taskUid=tag(a,"TaskUID"),resourceUid=tag(a,"ResourceUID");return {id:tag(a,"UID"),activityId:taskUid,resourceId:resourceUid,target_qty:durationHours(tag(a,"Work")),act_reg_qty:durationHours(tag(a,"ActualWork")),remain_qty:durationHours(tag(a,"RemainingWork")),target_cost:num(tag(a,"Cost")),act_reg_cost:num(tag(a,"ActualCost")),remain_cost:num(tag(a,"RemainingCost")),start:tag(a,"Start"),finish:tag(a,"Finish"),units:num(tag(a,"Units")),raw:{percentWorkComplete:num(tag(a,"PercentWorkComplete"))}}}).filter(a=>knownTaskUids.has(a.activityId)&&(knownResources.has(a.resourceId)||!a.resourceId||a.resourceId==="0"));
  const schedule=createSchedule({name:projectName,projectName,sourceName,dataDate,wbs,calendars,activities,relationships,resources,assignments,rawTables:{MSPDI:{hoursPerDay,hoursPerWeek}}});
  const warnings=[];if(taskMeta.some(x=>x.summary)&&!wbs.length)warnings.push("Summary-task WBS hierarchy could not be reconstructed.");
  return {schedules:[schedule],diagnostics:{warnings,errors:[]}};
}
