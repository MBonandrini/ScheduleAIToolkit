import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createSchedule} from "../src/core/model.js";
import {buildForensicEvidence} from "../src/analysis/forensics.js";

const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");
function schedules(){
  const previous=createSchedule({id:"P",name:"Rev A",projectName:"Project",dataDate:"2026-01-02",calendars:[{id:"C1",name:"5 Day",hoursPerDay:8,hoursPerWeek:40},{id:"C2",name:"7 Day",hoursPerDay:8,hoursPerWeek:56}],resources:[{id:"R1",name:"Electricians",maxUnits:10},{id:"R2",name:"Fitters"}],activities:[
    {id:"A1",uid:"1",name:"Install containment",wbsPath:"Construction / Electrical",percent:20,actualStart:null,calendarId:"C1",start:"2026-01-05",finish:"2026-01-12"},
    {id:"A2",uid:"2",name:"Pull cables",wbsPath:"Construction / Electrical",percent:100,actualStart:"2026-01-06",actualFinish:"2026-01-10",calendarId:"C1",start:"2026-01-06",finish:"2026-01-10"},
    {id:"A4",uid:"4",name:"Temporary works",wbsPath:"Construction",percent:0,calendarId:"C2",start:"2026-01-05",finish:"2026-01-08"}
  ],relationships:[{predId:"A1",succId:"A2",type:"FS",lag:0},{predId:"A4",succId:"A2",type:"SS",lag:0}],assignments:[{activityId:"1",resourceId:"R1",target_qty:100,act_reg_qty:20,remain_qty:80},{activityId:"4",resourceId:"R2",target_qty:40,act_reg_qty:0,remain_qty:40}]});
  const current=createSchedule({id:"C",name:"Rev B",projectName:"Project",dataDate:"2026-01-09",calendars:[{id:"C1",name:"5 Day",hoursPerDay:10,hoursPerWeek:50},{id:"C3",name:"6 Day",hoursPerDay:8,hoursPerWeek:48}],resources:[{id:"R1",name:"Electricians",maxUnits:16},{id:"R3",name:"Commissioning"}],activities:[
    {id:"A1",uid:"1",name:"Install containment",wbsPath:"Construction / Electrical",percent:50,actualStart:"2026-01-05",calendarId:"C3",start:"2026-01-05",finish:"2026-01-13"},
    {id:"A2",uid:"2",name:"Pull cables",wbsPath:"Construction / Electrical",percent:100,actualStart:"2026-01-06",actualFinish:null,calendarId:"C1",start:"2026-01-06",finish:"2026-01-10"},
    {id:"A3",uid:"3",name:"Testing",wbsPath:"Commissioning",percent:0,calendarId:"C1",start:"2026-01-14",finish:"2026-01-16"}
  ],relationships:[{predId:"A1",succId:"A2",type:"SS",lag:2},{predId:"A3",succId:"A2",type:"FS",lag:0}],assignments:[{activityId:"1",resourceId:"R1",target_qty:100,act_reg_qty:50,remain_qty:60},{activityId:"3",resourceId:"R3",target_qty:30,act_reg_qty:5,remain_qty:25}]});
  return {previous,current};
}
export async function run(){
  const {previous,current}=schedules(),e=buildForensicEvidence([previous,current]);
  assert.equal(e.activities.added,1);assert.equal(e.activities.removed,1);assert.ok(e.activities.rows.some(x=>x.id==="A3"&&x.type==="Added"));assert.ok(e.activities.rows.some(x=>x.id==="A4"&&x.type==="Removed"));
  assert.ok(e.progress.rows.some(x=>x.activity.startsWith("A1")&&x.field==="Progress"));assert.ok(e.progress.rows.some(x=>x.activity.startsWith("A1")&&x.type==="Actual date added"));assert.ok(e.progress.rows.some(x=>x.activity.startsWith("A2")&&x.type==="Actual date removed"));
  assert.ok(e.resourcing.totals.length===2);assert.ok(e.resourcing.masterRows.some(x=>x.type==="Resource added"));assert.ok(e.resourcing.masterRows.some(x=>x.type==="Resource removed"));assert.ok(e.resourcing.rows.some(x=>x.type==="Loading / actuals changed"&&x.actualDelta===30&&x.atCompletionDelta===10));
  assert.ok(e.calendars.definitionRows.some(x=>x.type==="Calendar added"));assert.ok(e.calendars.definitionRows.some(x=>x.type==="Calendar removed"));assert.ok(e.calendars.definitionRows.some(x=>x.type==="Calendar definition changed"));assert.ok(e.calendars.assignmentRows.some(x=>x.activity.startsWith("A1")));
  assert.equal(e.relationships.changed,1);assert.equal(e.relationships.added,1);assert.equal(e.relationships.removed,1);assert.ok(e.relationships.rows.some(x=>x.type==="Changed"&&x.before.includes("FS")&&x.after.includes("SS")));
  const app=read("src/ui/app.js"),forensics=read("src/analysis/forensics.js"),css=read("assets/app.css");
  for(const label of ["Forensic evidence detail","Activities","Progress","Resourcing","Calendars","Relationships"])assert.ok(app.includes(label),`missing forensic panel ${label}`);
  assert.ok(app.includes("At Completion")&&forensics.includes("Actual date added")&&forensics.includes("Calendar definition changed"));
  assert.ok(css.includes(".forensic-evidence-box")&&css.includes(".forensic-evidence-body"));
  return "v2.0.0 forensic evidence detail";
}
