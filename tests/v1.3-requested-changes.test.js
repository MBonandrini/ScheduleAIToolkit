import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {gantt,networkGraph,lineChart,barChart} from "../src/ui/render.js";
import {curveSeries} from "../src/analysis/timeseries.js";
import {scheduleNarrative} from "../src/analysis/narrative.js";
const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const day=n=>new Date(Date.UTC(2026,0,5+n)).toISOString();
const schedule={id:"s1",name:"Project A",projectName:"Project A",sourceName:"A.xer",dataDate:day(14),activities:[
  {id:"A1",uid:"1",name:"Design",wbsPath:"01 Design",status:"Complete",start:day(0),finish:day(7),currentStart:day(0),currentFinish:day(7),baselineFinish:day(6),actualFinish:day(7),originalDuration:5,remainingDuration:0,totalFloat:0,percent:100,critical:true,milestone:false,budgetUnits:100,actualUnits:100,remainingUnits:0,budgetCost:1000,actualCost:1100,remainingCost:0},
  {id:"A2",uid:"2",name:"Install",wbsPath:"02 Build",status:"In Progress",start:day(8),finish:day(28),currentStart:day(8),currentFinish:day(28),baselineFinish:day(24),actualStart:day(8),originalDuration:15,remainingDuration:9,totalFloat:-2,percent:40,critical:true,milestone:false,budgetUnits:200,actualUnits:80,remainingUnits:120,budgetCost:3000,actualCost:1200,remainingCost:1900},
  {id:"M1",uid:"3",name:"Ready",wbsPath:"03 Handover",status:"Not Started",start:day(29),finish:day(29),currentStart:day(29),currentFinish:day(29),baselineFinish:day(27),originalDuration:0,remainingDuration:0,totalFloat:-2,percent:0,critical:true,milestone:true,budgetUnits:0,actualUnits:0,remainingUnits:0,budgetCost:0,actualCost:0,remainingCost:0}
],relationships:[{predId:"A1",succId:"A2",type:"FS",lag:0},{predId:"A2",succId:"M1",type:"FS",lag:0}],resources:[{id:"R1",name:"Electricians"}],assignments:[{activityId:"2",resourceId:"R1",target_qty:200,act_reg_qty:80,remain_qty:120}],wbs:[],calendars:[]};
export async function run(){
  const app=read("src/ui/app.js"),css=read("assets/app.css"),html=read("index.html"),repo=read("src/repository/repository.js"),parser=read("src/parsers/index.js"),bridge=read("tools/mpp-bridge.mjs");
  assert.ok(app.includes('<h2>Readiness</h2>')&&!app.includes('<h2>Data-Centre Readiness</h2>'));
  for(const id of ["dashLineage","forensicSlot","timeSlot"])assert.ok(app.includes(id),`missing selector ${id}`);
  for(const prefix of ["comparison","week","delay","baseline"])assert.ok(app.includes(`pairToolbar("${prefix}"`),`missing ${prefix} pair selector`);
  assert.ok(app.includes("Array(10).fill")&&app.includes("up to 10 schedules"));
  assert.ok(app.includes("resourceChangeSummary")&&app.includes("logicAdded")&&app.includes("logicRemoved"));
  assert.ok(app.includes("healthDefinition")&&app.includes("help-term"));
  assert.ok(app.includes("Quality graphics")&&app.includes("quality-grid"));
  assert.ok(app.includes("Basis <select id=\"scurveBasis\"")&&app.includes("Individual resource"));
  assert.ok(app.includes("X-axis dates are Fridays")&&app.includes("rotateLabels:true"));
  assert.ok(app.includes("Schedule Time Machine")&&app.includes("<strong>Purpose:</strong>"));
  assert.ok(app.includes("Next four weeks · detailed by WBS")&&app.includes("lookahead-wbs"));
  assert.ok(app.includes("NotebookLM+")&&app.includes("data-notebook-tab=\"outputs\"")&&app.includes("Download SVG")&&app.includes("Download activity CSV")&&app.includes("Download script"));
  assert.ok(css.includes("grid-template-columns:repeat(auto-fit")&&css.includes(".workspace,.workspace>*{min-width:0"));
  assert.ok(css.includes(".gantt-divider")&&css.includes(".gantt-rel-overlay")&&css.includes(".network-viewport")&&css.includes(".network-zoom-label"));
  const gh=gantt(schedule,{timescale:"weekly",showRelationships:true,leftWidth:450});assert.ok(gh.includes("Weeks")&&gh.includes("Months")&&gh.includes("Quarters")&&gh.includes("Years"));assert.ok(gh.includes("gantt-divider")&&gh.includes("gantt-rel-overlay")&&gh.includes("WBS / Activity"));assert.ok(/2026-01-0?9/.test(gh),"weekly Gantt should show a Friday scale label");
  const net=networkGraph(schedule);assert.ok(net.includes('data-net-zoom="in"')&&net.includes('data-net-zoom="out"')&&net.includes("Incoming:")&&net.includes("Outgoing:"));
  const curve=curveSeries(schedule,{basis:"units"});assert.ok(curve.length&&curve.every(x=>x.friday instanceof Date));assert.equal(curve[0].friday.getUTCDay(),5);
  const resource=curveSeries(schedule,{basis:"resource",resourceId:"R1"});assert.ok(resource.some(x=>x.forecastWeekly>0));
  const chart=lineChart([{name:"A",values:[{x:0,y:1},{x:1,y:2}]}],{xLabels:["2026-01-09","2026-01-16"],rotateLabels:true});assert.ok(chart.includes("<title>")&&chart.includes("rotate(90"));
  const bars=barChart([{label:"x",v:4}],{series:[{key:"v",label:"Value"}],xLabels:["2026-01-09"],rotateLabels:true});assert.ok(bars.includes("<title>")&&bars.includes("2026-01-09"));
  const narrative=scheduleNarrative(schedule,null);assert.ok(narrative.paragraphs.length>=4&&Array.isArray(narrative.phases)&&Array.isArray(narrative.resources));
  assert.ok(repo.includes("xer|xml|mpp")&&repo.includes('ext==="mpp"'));
  assert.ok(parser.includes('ext==="mpp"')&&parser.includes("parseMPPViaLocalBridge")&&parser.includes("parseMSProjectXML"));
  assert.ok(bridge.includes("@byteink/mppjs")&&bridge.includes("await convert")&&bridge.includes("Access-Control-Allow-Private-Network"));
  assert.ok(fs.existsSync(path.join(root,"setup-mpp-bridge.bat"))&&fs.existsSync(path.join(root,"tools/package.json")));
  assert.ok(html.includes("MPP setup")&&app.includes("Edit this schedule in Schedule Builder")&&app.includes("Loaded ${state.builderRows.length} activities into Schedule Builder"));
  return "v1.3 requested changes";
}
