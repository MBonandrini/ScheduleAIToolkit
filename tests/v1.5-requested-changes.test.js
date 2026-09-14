import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {gantt,GANTT_FIELDS} from "../src/ui/render.js";
import {curveSeries} from "../src/analysis/timeseries.js";
import {parseCSV,csvObjects} from "../src/core/utils.js";
import {publicHolidays,calendarHolidaySet,addWorkingDays,isWorkingDate} from "../src/analysis/holidays.js";

const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const D=s=>new Date(`${s}T00:00:00Z`).toISOString();
function profileSchedule(){return {id:"P1",name:"Profile",dataDate:D("2026-01-09"),activities:[
  {uid:"1",id:"A1",name:"Civil",wbsPath:"Construction / Civil",status:"Complete",baselineFinish:D("2026-01-09"),actualFinish:D("2026-01-09"),currentFinish:D("2026-01-09"),finish:D("2026-01-09"),start:D("2026-01-05"),percent:100,budgetUnits:100,actualUnits:100,remainingUnits:0,budgetCost:1000,actualCost:1000,remainingCost:0,totalFloat:0,critical:true},
  {uid:"2",id:"A2",name:"Electrical",wbsPath:"Construction / Electrical",status:"Not Started",baselineFinish:D("2026-01-23"),currentFinish:D("2026-01-30"),finish:D("2026-01-30"),start:D("2026-01-12"),percent:0,budgetUnits:200,actualUnits:0,remainingUnits:200,budgetCost:2000,actualCost:0,remainingCost:2000,totalFloat:5,critical:false}
],resources:[{id:"R1",name:"Civil Crew"},{id:"R2",name:"Electrical Crew"}],assignments:[
  {activityId:"1",resourceId:"R1",target_qty:100,act_reg_qty:100,remain_qty:0,target_cost:1000,act_reg_cost:1000,remain_cost:0},
  {activityId:"2",resourceId:"R2",target_qty:200,act_reg_qty:0,remain_qty:200,target_cost:2000,act_reg_cost:0,remain_cost:2000}
],relationships:[],calendars:[],wbs:[]}}
export async function run(){
  const app=read("src/ui/app.js"),render=read("src/ui/render.js"),css=read("assets/app.css"),repo=read("src/repository/repository.js"),runtime=read("src/ai/runtime.js"),holidays=read("src/analysis/holidays.js");

  assert.ok(Object.keys(GANTT_FIELDS).length>=18,"professional Gantt should expose a broad field catalogue");
  const html=gantt(profileSchedule(),{layoutKey:"critical",fields:["id","name","resource","start","finish","totalFloat"],fieldWidths:{name:260},barSettings:{label:"name",showBaseline:true,showProgress:true,showActual:true,showDataDate:true,groupWbs:true}});
  assert.ok(html.includes("Civil Crew"),"resource field should resolve schedule assignments");
  for(const token of ['id="ganttFieldsAvailable"','id="ganttFieldsDisplayed"','id="ganttFieldAdd"','id="ganttFieldRemove"','id="ganttFieldUp"','id="ganttFieldDown"','id="ganttFieldReset"','gantt-field-resizer','id="ganttApplyStyle"'])assert.ok(html.includes(token),`missing Gantt control ${token}`);
  assert.ok(app.includes("pcai.ganttLayout.critical")||app.includes("pcai.ganttLayout.${kind}"));
  assert.ok(app.includes("pcai.ganttLayout.wbs")||app.includes("pcai.ganttLayout.${kind}"));
  assert.ok(css.includes(".gantt-field-chooser")&&css.includes(".gantt-field-resizer")&&css.includes(".gantt-config-box"));

  const s=profileSchedule(),all=curveSeries(s,{basis:"units"}),r1=curveSeries(s,{basis:"units",resourceIds:["R1"]}),r2=curveSeries(s,{basis:"units",resourceIds:["R2"]});
  assert.ok(all.length>0&&r1.length>0&&r2.length>0);
  assert.equal(Math.max(...r1.map(x=>x.plannedCum)),100);
  assert.equal(Math.max(...r2.map(x=>x.plannedCum)),200);
  const focused=curveSeries(s,{basis:"units",startDate:"2026-01-19",endDate:"2026-02-06"});
  assert.ok(focused.length<all.length,"date filtering should focus the profile window");
  for(const token of ["scurveStartDate","scurveFinishDate","scurveExpand","scurveContract","scurveFullRange","scurvePlanned","scurveActual","scurveForecast","data-scurve-resource"])assert.ok(app.includes(token),`missing S-curve control ${token}`);
  assert.ok(css.includes(".scurve-resource-filter")&&css.includes(".series-filter"));

  const parsed=parseCSV('ID,Risk,Mitigation\nR1,"Delay, weather","Add float"\n');assert.equal(parsed[1][1],"Delay, weather");
  const objects=csvObjects('ID,Event,Description\nC1,Access,"Late, partial"\n');assert.equal(objects[0].Description,"Late, partial");
  for(const token of ["riskImportCsv","riskExportCsv","claimImportCsv","claimExportCsv","importRiskCsv","exportRiskCsv","importClaimCsv","exportClaimCsv"])assert.ok(app.includes(token),`missing CSV feature ${token}`);

  for(const step of ["Schedule Type","Detail Level","Specifications","Disciplines","Phases","Responsibility Matrix","Milestones","Similar Schedules","Reference Documents","Reference Drawings","Calendars","Review & Generate"])assert.ok(app.includes(step),`missing builder wizard step ${step}`);
  for(const token of ["30% Design","5 days · Mon–Fri","6 days · Mon–Sat","7 days · Mon–Sun","Country / national holidays","builderProgressBar","Generate schedule with AI","contextFileIds"])assert.ok(app.includes(token),`missing builder capability ${token}`);
  assert.ok(app.includes("Select and apply a compatible AI engine in Settings first"));
  assert.ok(repo.includes("fileIds")&&runtime.includes("contextFileIds"),"builder references should be explicitly scoped into AI context");
  assert.ok(css.includes(".builder-stepper")&&css.includes(".responsibility-matrix")&&css.includes(".builder-progress"));

  const ie=publicHolidays("IE",2026);assert.ok(ie.some(x=>x.date==="2026-03-17"&&/Patrick/i.test(x.name)));
  const hs=calendarHolidaySet({country:"IE",years:[2026],customDates:["2026-03-18"]});assert.ok(hs.has("2026-03-17")&&hs.has("2026-03-18"));
  assert.equal(isWorkingDate("2026-03-17",{workingDays:[1,2,3,4,5],holidaySet:hs}),false);
  const finish=addWorkingDays("2026-03-16",2,{workingDays:[1,2,3,4,5],holidaySet:hs});assert.equal(finish.toISOString().slice(0,10),"2026-03-20");
  assert.ok(holidays.includes("HOLIDAY_COUNTRIES")&&holidays.includes("customDates"));
  return "v1.5 requested changes";
}
