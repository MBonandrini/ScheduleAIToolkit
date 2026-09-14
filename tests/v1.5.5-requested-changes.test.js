import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {sampleSchedule} from "./helpers.js";
import {gantt} from "../src/ui/render.js";
import {identifyDelayEvents} from "../src/analysis/delay-events.js";

export async function run(){
  const s=sampleSchedule();
  const html=gantt(s,{activities:s.activities,layoutKey:"wbs",fields:["id","name","wbs"],collapsedWbsIds:["W2"]});
  assert.match(html,/data-wbs-id="W1"/,"parent WBS band should render");
  assert.match(html,/data-wbs-id="W2"/,"child WBS band should render");
  assert.match(html,/Electrical \/ Energisation/,"full WBS ancestry should be used for activity WBS field/tooltips");
  assert.match(html,/gantt-wbs-node collapsed[^>]*data-wbs-id="W2"|data-wbs-id="W2"[^>]*collapsed/,"collapsed WBS state should render");
  assert.match(html,/Double-click any WBS band/i,"Gantt should explain collapse interaction");

  const previous=sampleSchedule({name:"Earlier",dataDate:"2026-08-01",shift:0});
  const current=sampleSchedule({name:"Later",dataDate:"2026-08-08",shift:4});
  previous.resources=[{id:"R1",name:"Electrician"}];current.resources=[{id:"R1",name:"Electrician"},{id:"R2",name:"Supervisor"}];
  previous.assignments=[{activityId:"A300",resourceId:"R1",target_qty:80}];current.assignments=[{activityId:"A300",resourceId:"R2",target_qty:100}];
  current.calendars.push({id:"C2",name:"7 Day",hoursPerDay:10,hoursPerWeek:70});
  const a300=current.activities.find(a=>a.id==="A300");a300.originalDuration=9;a300.calendarId="C2";a300.calendarName="7 Day";
  current.relationships.push({predId:"A100",succId:"A300",type:"FS",lag:0});
  const events=identifyDelayEvents(previous,current),ev=events.find(e=>e.activityIds.includes("A300"));
  assert.ok(ev,"A300 candidate should be identified");
  for(const category of ["Later start","Later finish","Duration increase","Calendar change","Resource change","Logic change"])assert.match(ev.category,new RegExp(category),`missing ${category}`);
  assert.ok(ev.impactDays>0,"delay candidate should carry schedule movement");

  const app=await fs.readFile(new URL("../src/ui/app.js",import.meta.url),"utf8"),css=await fs.readFile(new URL("../assets/app.css",import.meta.url),"utf8");
  const riskStart=app.indexOf("function renderRisk()"),riskEnd=app.indexOf("function renderMonte",riskStart),riskBlock=app.slice(riskStart,riskEnd);
  assert.ok(!riskBlock.includes('chatMarkup("risk"'),"Risk Analysis chat must be removed");
  assert.ok(!riskBlock.includes('bindChat("risk"'),"Risk Analysis chat binding must be removed");
  const claimsStart=app.indexOf("function renderClaims()"),claimsEnd=app.indexOf("const BUILDER_STEPS",claimsStart),claimsBlock=app.slice(claimsStart,claimsEnd);
  assert.ok(!claimsBlock.includes('chatMarkup("claims"'),"Claims chat must be removed");
  assert.ok(!claimsBlock.includes('bindChat("claims"'),"Claims chat binding must be removed");
  assert.match(claimsBlock,/Identify Delay Events/);
  assert.match(claimsBlock,/identifyDelayEvents\(p,c\)/);
  assert.match(app,/Add selected to Delay Event Register/);
  assert.match(app,/data-wbs-summary/);
  assert.match(app,/addEventListener\('dblclick'/,"WBS double-click collapse must be bound");
  assert.match(css,/settings-grid\{display:block!important;columns:440px 2/,"Settings cards should use packed columns");
  assert.match(css,/gantt-wbs-node\.collapsed>\.gantt-wbs-children\{display:none\}/,"collapsed WBS must hide descendant activities/bars");
  return {events:events.length};
}
