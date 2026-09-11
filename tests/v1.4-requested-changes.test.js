import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {compareSchedules} from "../src/analysis/comparison.js";
import {gantt} from "../src/ui/render.js";
import {AI_CATALOG} from "../src/ai/catalog.js";

const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const day=n=>new Date(Date.UTC(2026,0,5+n)).toISOString();
function schedule(id,{later=false}={}){
  return {id,name:id,projectName:"Project A",sourceName:`${id}.xer`,dataDate:day(later?14:7),activities:[
    {id:"A1",name:"Design",wbsPath:"Design",status:later?"Complete":"In Progress",currentStart:day(0),currentFinish:day(later?8:7),start:day(0),finish:day(later?8:7),originalDuration:5,remainingDuration:later?0:2,totalFloat:later?0:3,percent:later?100:70,critical:later,milestone:false,calendarId:later?"C2":"C1",budgetUnits:100,actualUnits:later?100:70,remainingUnits:later?0:30},
    ...(!later?[{id:"DEL",name:"Deleted activity",wbsPath:"Build",status:"Not Started",currentStart:day(10),currentFinish:day(15),start:day(10),finish:day(15),originalDuration:5,remainingDuration:5,totalFloat:5,percent:0,critical:false,milestone:false,calendarId:"C1"}]:[]),
    ...(later?[{id:"NEW",name:"New activity",wbsPath:"Build",status:"Not Started",currentStart:day(10),currentFinish:day(16),start:day(10),finish:day(16),originalDuration:6,remainingDuration:6,totalFloat:2,percent:0,critical:false,milestone:false,calendarId:"C2"}]:[])
  ],relationships:later?[{predId:"A1",succId:"NEW",type:"FS",lag:0}]:[{predId:"A1",succId:"DEL",type:"FS",lag:0}],
  calendars:later?[{id:"C2",name:"6 Day",hoursPerDay:10,hoursPerWeek:60,raw:{clndr_data:"new"}}]:[{id:"C1",name:"5 Day",hoursPerDay:8,hoursPerWeek:40,raw:{clndr_data:"old"}}],
  resources:later?[{id:"R2",name:"New Crew",type:"labor",maxUnits:8,raw:{price_per_unit:80}}]:[{id:"R1",name:"Old Crew",type:"labor",maxUnits:6,raw:{price_per_unit:70}}],
  assignments:later?[{activityId:"A1",resourceId:"R2",target_qty:120,act_reg_qty:100,remain_qty:20}]:[{activityId:"A1",resourceId:"R1",target_qty:100,act_reg_qty:70,remain_qty:30}],wbs:[]};
}
export async function run(){
  const app=read("src/ui/app.js"),css=read("assets/app.css"),cloud=read("src/ai/cloud.js"),render=read("src/ui/render.js");
  const a=schedule("A"),b=schedule("B",{later:true}),c=compareSchedules(a,b);
  assert.equal(c.calendars.added.length,1);assert.equal(c.calendars.deleted.length,1);
  assert.equal(c.resources.added.length,1);assert.equal(c.resources.deleted.length,1);
  assert.equal(c.resourceAssignments.added.length,1);assert.equal(c.resourceAssignments.deleted.length,1);
  assert.ok(app.includes("Calendar changes")&&app.includes("Resource master changes")&&app.includes("resourceAssignments"));
  assert.ok(app.includes("deletedText")&&css.includes(".deleted-change")&&css.includes("color:var(--danger)"));

  const gh=gantt(b,{timescale:"weekly",startDate:"2026-01-01",endDate:"2027-01-01",showRelationships:true,leftWidth:480});
  assert.ok(gh.includes('id="ganttStartDate"')&&gh.includes('id="ganttFinishDate"')&&gh.includes('id="ganttResetRange"'));
  assert.ok(gh.includes("scale-vertical"),"narrow timescale segments should rotate labels");
  assert.ok(css.includes("rotate(90deg)")&&css.includes("gantt-link.p6-link")&&app.includes(" H${bend.toFixed(1)} V${y2.toFixed(1)} H${x2.toFixed(1)}"));
  assert.ok(render.includes("Timescale start")&&render.includes("Timescale finish"));

  assert.ok(app.includes("Threshold graphics")&&app.includes("threshold-marker")&&app.includes("Actual ${actual"));
  assert.ok(css.includes(".threshold-card")&&css.includes(".threshold-marker")&&css.includes(".threshold-actual"));
  assert.ok(app.includes("narrative-activity-detail")&&app.includes("critical-text")&&css.includes(".narrative-activity-detail"));

  assert.ok(app.includes("notebook-output-pane")&&app.includes('window.prompt(`Customise this ${type} output:')&&app.includes('data-nb-create="${type}"'));
  assert.ok(!app.includes('data-notebook-tab="outputs"'),"Notebook outputs must not be a separate tab");
  assert.ok(css.includes(".workspace.workspace-fixed")&&css.includes(".notebook-layout")&&css.includes(".notebook-chat .chatbox"));

  const gem=AI_CATALOG.find(x=>x.engine==="gemini"),grok=AI_CATALOG.find(x=>x.engine==="grok");
  assert.ok(gem&&grok);assert.equal(gem.model,"gemini-3.8-flash");assert.equal(grok.model,"grok-4.6");
  assert.ok(app.includes("Gemini & Grok API keys")&&app.includes('type="password"')&&app.includes("saveCloudConfig")&&app.includes("testCloudAI"));
  assert.ok(cloud.includes("localStorage")&&cloud.includes("generativelanguage.googleapis.com/v1beta/models/")&&cloud.includes("https://api.x.ai/v1/chat/completions"));

  const oldStorage=globalThis.localStorage,oldFetch=globalThis.fetch;
  const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
  const mod=await import(`../src/ai/cloud.js?test=${Date.now()}`);
  mod.saveCloudConfig("gemini",{apiKey:"gem-key",model:"gemini-3.8-flash"});
  assert.equal(mod.cloudConfig("gemini").apiKey,"gem-key");
  globalThis.fetch=async(url,opt)=>({ok:true,status:200,statusText:"OK",text:async()=>JSON.stringify(String(url).includes("googleapis")?{candidates:[{content:{parts:[{text:"OK"}]}}]}:{choices:[{message:{content:"OK"}}]})});
  const g1=await mod.cloudChat("gemini",[{role:"user",content:"test"}]);assert.equal(g1.text,"OK");
  mod.saveCloudConfig("grok",{apiKey:"grok-key",model:"grok-4.6"});const g2=await mod.cloudChat("grok",[{role:"user",content:"test"}]);assert.equal(g2.text,"OK");
  mod.clearCloudKey("gemini");assert.equal(mod.cloudConfig("gemini").apiKey,"");
  if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;if(oldFetch===undefined)delete globalThis.fetch;else globalThis.fetch=oldFetch;
  return "v1.4 requested changes";
}
