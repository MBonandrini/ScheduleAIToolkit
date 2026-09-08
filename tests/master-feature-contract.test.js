
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
export async function run(){
  const app=read("src/ui/app.js"),repo=read("src/repository/repository.js"),db=read("src/repository/db.js"),
        tools=read("src/ai/tools.js"),runtime=read("src/ai/runtime.js"),network=read("src/analysis/network.js"),
        comparison=read("src/analysis/comparison.js"),health=read("src/analysis/health.js"),risk=read("src/analysis/risk.js"),
        claims=read("src/analysis/claims.js"),dc=read("src/analysis/datacentre.js"),workers=read("src/workers/client.js"),
        html=read("index.html"),css=read("assets/app.css");
  const requirements=[
    ["central multi-project repository",repo.includes("newProject")&&db.includes("projects")&&db.includes("folders")],
    ["schedule revision lineage",app.includes("Revision lineage")&&app.includes("Schedule Time Machine")],
    ["structured AI schedule tools",tools.includes("get_activity")&&tools.includes("get_predecessors")&&tools.includes("why_date_moved")],
    ["canonical network graph engine",network.includes("buildNetwork")&&network.includes("longestPath")&&network.includes("traceToMilestone")],
    ["Why Did My Date Move",comparison.includes("whyDidDateMove")&&app.includes("Why Did My Date Move?")],
    ["milestone control centre",app.includes("Milestone Control Centre")],
    ["professional Gantt",app.includes("WBS / Gantt")&&css.includes(".gantt-left{position:sticky")&&app.includes("ganttRelationships")],
    ["cross-report filtering",app.includes("filterBar")&&app.includes("filteredSchedule")],
    ["planner daily dashboard",app.includes("Planner Dashboard")],
    ["planner inbox",health.includes("plannerInbox")&&app.includes("Planner's Inbox")],
    ["data-centre mode",dc.includes("dataCentreReadiness")&&app.includes("Data-centre lifecycle readiness")],
    ["forecast confidence scoring",health.includes("forecastConfidence")&&app.includes("Milestone Forecast Confidence")],
    ["Monte Carlo P10/P50/P80/P90",risk.includes("p10")&&risk.includes("p50")&&risk.includes("p80")&&risk.includes("p90")],
    ["risk-register schedule mapping",risk.includes("mapRiskToSchedule")&&app.includes("Activity IDs")],
    ["claims schedule evidence",claims.includes("buildDelayEventFile")&&app.includes("Evidence Pack Generator")],
    ["AI evidence references",runtime.includes("sources:repo.files")&&app.includes("Evidence:")],
    ["specialist AI roles",app.includes("Forensic Planner")&&app.includes("Risk Analyst")&&app.includes("Executive Reviewer")],
    ["Web Workers",workers.includes("new Worker")&&fs.existsSync(path.join(root,"src/workers/schedule-worker.js"))],
    ["large-table virtualisation",app.includes("mountVirtualActivities")],
    ["browser project database",db.includes("indexedDB.open")&&db.includes("schedules")&&db.includes("risks")&&db.includes("claims")],
    ["schedule comparison",app.includes("Material Change Register")],
    ["week-on-week progress",app.includes("Week-on-Week")],
    ["DCMA-style screening",app.includes("DCMA-style quality screen")],
    ["delay analysis",app.includes("Delay movement register")],
    ["forensic review",app.includes("Forensic Change Attribution")],
    ["calendar year views",app.includes("Calendar Analyser")&&app.includes("calendarYear")],
    ["weekly S-curve and histogram",app.includes("Weekly S-Curve")&&app.includes("Weekly Histogram")],
    ["schedule narrative with comparison/lookahead",app.includes("Executive Schedule Narrative")&&app.includes("Comparative programme")],
    ["resources and EVM",app.includes("Resource / EVM view")],
    ["cost report",app.includes("Cost by WBS")],
    ["baseline/lookahead",app.includes("Baseline variance")&&app.includes("Four-week lookahead")],
    ["nodes and links",app.includes("Nodes & Links")],
    ["only one global AI selector",(html.match(/id="aiSelect"/g)||[]).length===1],
    ["GitHub Pages static architecture",fs.existsSync(path.join(root,".nojekyll"))&&!/express|fastify|node:http/.test(app)]
  ];
  for(const [name,ok] of requirements)assert.ok(ok,`Missing master requirement: ${name}`);
  return `master-feature-contract-${requirements.length}`;
}
