
import {currentProject,projects,newProject,switchProject,restoreFolderHandles,renameProject,addFiles,listFiles,listSchedules,setFileChecked,removeFile,linkFolder,importFolderFallback,selectedContext,saveRisk,listRisks,saveClaim,listClaims} from "../repository/repository.js?v=1.2.0";
import {preferredAI,setPreferredAI,askAI,aiLabel,AI_CATALOG,aiEntry,aiCompatibility,catalogueGroups,testSelectedAI} from "../ai/runtime.js?v=1.2.0";
import {ollamaConfig,saveOllamaConfig,inspectModels,testOllama,probeOllama} from "../ai/ollama.js?v=1.2.0";
import {scheduleSummary} from "../core/model.js?v=1.2.0";
import {esc,isoDate,parseDate,daysBetween,toCSV,downloadBlob,uid,addDays} from "../core/utils.js?v=1.2.0";
import {metric,table,lineChart,barChart,networkGraph,gantt,calendarMonth,badge} from "./render.js?v=1.2.0";
import {scheduleHealth,forecastConfidence,plannerInbox} from "../analysis/health.js?v=1.2.0";
import {compareSchedules,whyDidDateMove,avgProgress} from "../analysis/comparison.js?v=1.2.0";
import {networkHealth,openEnds,detectCycles,pathConvergence,drivingChain,longestPath,traceToMilestone} from "../analysis/network.js?v=1.2.0";
import {projectYears,calendarYear} from "../analysis/calendar.js?v=1.2.0";
import {weeklySeries,fourWeekLookahead} from "../analysis/timeseries.js?v=1.2.0";
import {activityHistory,milestoneHistory,revisionLineage} from "../analysis/timemachine.js?v=1.2.0";
import {runMonteCarlo,mapRiskToSchedule} from "../analysis/risk.js?v=1.2.0";
import {buildDelayEventFile} from "../analysis/claims.js?v=1.2.0";
import {dataCentreReadiness,readinessGates} from "../analysis/datacentre.js?v=1.2.0";
import {scheduleNarrative} from "../analysis/narrative.js?v=1.2.0";

const $=id=>document.getElementById(id);
const state={
  view:"dashboard",project:null,files:[],schedules:[],risks:[],claims:[],
  activeScheduleId:null,previousScheduleId:null,assessmentReport:"overview",
  filters:{search:"",wbs:"",status:"",floatMax:""},
  ganttTimescale:"weekly",ganttCompression:"standard",ganttRelationships:false,
  whyActivityId:"",timeActivityId:"",traceActivityId:"",
  monte:null,chats:{},quantityRows:[],builderRows:[],riskEdit:null
};
const roles=["Planner","Forensic Planner","Risk Analyst","Commercial Manager","Contract Analyst","Project Controls Manager","Executive Reviewer"];
const noRepoViews=new Set(["notebook","builder","settings"]);

function renderAIModelOptions(){
  const select=$("aiSelect");if(!select)return;
  const current=preferredAI(),groups=catalogueGroups();
  select.innerHTML=[...groups.entries()].map(([group,entries])=>
    `<optgroup label="${esc(group)}">${entries.map(entry=>{
      const compat=aiCompatibility(entry.value);
      const suffix=!compat.ok&&entry.engine!=="placeholder"?" · unavailable here":"";
      return `<option value="${esc(entry.value)}" ${entry.value===current?"selected":""} ${entry.disabled?"disabled":""}>${esc(entry.label+suffix)}</option>`;
    }).join("")}</optgroup>`
  ).join("");
  if([...select.options].some(o=>o.value===current))select.value=current;
}
function selectedAIInfo(){
  const entry=aiEntry(preferredAI()),compat=aiCompatibility(entry.value);
  return {...entry,compatible:compat.ok,compatibilityMessage:compat.reason};
}

async function init(){
  state.project=await currentProject();
  await restoreFolderHandles();
  state.quantityRows=JSON.parse(localStorage.getItem("pcai.quantities")||"[]");
  state.builderRows=JSON.parse(localStorage.getItem("pcai.builder")||"[]");
  const savedTheme=localStorage.getItem("pcai.theme")||"navy";document.documentElement.dataset.theme=savedTheme;$("themeSelect").value=savedTheme;
  const initialAI=preferredAI(),initialCompat=aiCompatibility(initialAI);
  if(!initialCompat.ok)await setPreferredAI("cpu:qwen2.5-0.5b");
  renderAIModelOptions();
  bindShell();await refreshData();render();
  if(!initialCompat.ok)toast("WebGPU unavailable here — switched to Qwen2.5 0.5B CPU/WASM");
}
function bindShell(){
  $("tabs").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(!b)return;state.view=b.dataset.view;render()});
  $("themeSelect").addEventListener("change",e=>{document.documentElement.dataset.theme=e.target.value;localStorage.setItem("pcai.theme",e.target.value)});
  $("aiSelect").addEventListener("change",async e=>{
    const requested=e.target.value,compat=aiCompatibility(requested);
    if(!compat.ok){alert(compat.reason);renderAIModelOptions();return}
    try{await setPreferredAI(requested);renderAIModelOptions();toast(`Global AI: ${aiLabel(requested)}`)}
    catch(error){alert(error.message||String(error));renderAIModelOptions()}
  });
  $("newProjectBtn").onclick=async()=>{const name=prompt("Project name","New Project");if(!name)return;state.project=await newProject(name);await restoreFolderHandles();await refreshData();render()};
  $("projectSelect").onchange=async e=>{state.project=await switchProject(e.target.value);await restoreFolderHandles();state.activeScheduleId=null;state.previousScheduleId=null;await refreshData();render()};
  $("addFilesBtn").onclick=()=>$("fileInput").click();
  $("fileInput").onchange=async e=>{await withProgress("Importing files",async()=>{await addFiles(e.target.files);await refreshData()});e.target.value=""};
  $("folderFallbackBtn").onclick=()=>$("folderInput").click();
  $("folderInput").onchange=async e=>{await withProgress("Importing folder",async()=>{await importFolderFallback(e.target.files);await refreshData()});e.target.value=""};
  $("linkFolderBtn").onclick=async()=>{try{await withProgress("Linking project folder",async()=>{await linkFolder();await refreshData()})}catch(e){alert(e.message)}};
  $("renameProjectBtn").onclick=async()=>{
    const name=prompt("Project name",state.project?.name||"Untitled Project");if(!name)return;
    state.project=await renameProject(name);await refreshData();render();
  };
  globalThis.addEventListener("pc-progress",e=>updateProgress(e.detail||{}));
}
async function refreshData(){
  state.files=await listFiles();state.schedules=await listSchedules();state.risks=await listRisks();state.claims=await listClaims();
  state.schedules.sort((a,b)=>(parseDate(a.dataDate)?.getTime()||0)-(parseDate(b.dataDate)?.getTime()||0));
  if(!state.activeScheduleId||!state.schedules.some(s=>s.id===state.activeScheduleId))state.activeScheduleId=state.schedules.at(-1)?.id||null;
  const idx=state.schedules.findIndex(s=>s.id===state.activeScheduleId);
  if(!state.previousScheduleId||!state.schedules.some(s=>s.id===state.previousScheduleId))state.previousScheduleId=idx>0?state.schedules[idx-1]?.id:null;
  await renderRepository();
}
function activeSchedule(){return state.schedules.find(s=>s.id===state.activeScheduleId)||null}
function previousSchedule(){return state.schedules.find(s=>s.id===state.previousScheduleId)||null}
function filteredSchedule(){
  const s=activeSchedule();if(!s)return null;
  const f=state.filters,acts=s.activities.filter(a=>{
    if(f.search&&!`${a.id} ${a.name} ${a.wbsPath}`.toLowerCase().includes(f.search.toLowerCase()))return false;
    if(f.wbs&&!a.wbsPath.toLowerCase().includes(f.wbs.toLowerCase()))return false;
    if(f.status&&a.status!==f.status)return false;
    if(f.floatMax!==""&&Number(a.totalFloat)>Number(f.floatMax))return false;
    return true;
  }),ids=new Set(acts.map(a=>a.id));
  return {...s,activities:acts,relationships:s.relationships.filter(r=>ids.has(r.predId)&&ids.has(r.succId))};
}
async function renderRepository(){
  const ps=await projects();
  $("projectSelect").innerHTML=ps.map(p=>`<option value="${p.id}" ${p.id===state.project?.id?"selected":""}>${esc(p.name)}</option>`).join("");
  $("repoFiles").innerHTML=state.files.map(f=>`<div class="repo-file">
    <input type="checkbox" data-check="${f.id}" ${f.checked?"checked":""} title="Include in AI context">
    <div title="${esc(f.relativePath)}">${esc(f.name)}<small>${esc(f.category)} · ${Math.round((f.size||0)/1024)} KB${f.parseError?` · parse error: ${esc(f.parseError)}`:""}</small></div>
    <button data-remove="${f.id}" title="Remove reference">×</button></div>`).join("")||`<div class="muted">No project files yet.</div>`;
  $("repoFiles").querySelectorAll("[data-check]").forEach(x=>x.onchange=async()=>{await setFileChecked(x.dataset.check,x.checked)});
  $("repoFiles").querySelectorAll("[data-remove]").forEach(x=>x.onclick=async()=>{if(confirm("Remove this repository reference? Source disk files are not deleted.")){await removeFile(x.dataset.remove);await refreshData();render()}});
  $("scheduleCount").textContent=state.schedules.length;
  $("scheduleList").innerHTML=state.schedules.map(s=>`<div class="schedule-row ${s.id===state.activeScheduleId?"active":""}" data-schedule="${s.id}"><strong>${esc(s.sourceName||s.name)}</strong><small>Data date ${isoDate(s.dataDate)||"—"} · ${s.activities.length} activities</small></div>`).join("")||`<div class="muted">No XER/XML schedules parsed.</div>`;
  $("scheduleList").querySelectorAll("[data-schedule]").forEach(x=>x.onclick=()=>{state.activeScheduleId=x.dataset.schedule;const i=state.schedules.findIndex(s=>s.id===state.activeScheduleId);state.previousScheduleId=i>0?state.schedules[i-1].id:null;renderRepository();render()});
}
function render(){
  document.querySelectorAll("#tabs [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
  $("repositoryPane").style.display=noRepoViews.has(state.view)?"none":"block";
  document.querySelector(".app-shell").style.gridTemplateColumns=noRepoViews.has(state.view)?"1fr":"285px 1fr";
  const map={dashboard:renderDashboard,contracts:renderContracts,drawing:renderDrawing,assessment:renderAssessment,risk:renderRisk,claims:renderClaims,notebook:renderNotebook,builder:renderBuilder,settings:renderSettings};
  map[state.view]?.();
}
function updateProgress(p){
  const hud=$("progressHud"),track=hud.querySelector(".progress-track");hud.hidden=false;
  $("progressTitle").textContent=p.title||"Working";$("progressDetail").textContent=p.detail||"Processing…";
  $("progressPct").textContent=p.indeterminate?"Working…":`${Math.round(Number(p.percent)||0)}%`;
  track.classList.toggle("indeterminate",!!p.indeterminate);$("progressBar").style.width=p.indeterminate?"35%":`${Math.max(0,Math.min(100,Number(p.percent)||0))}%`;
  if(p.done)setTimeout(()=>hud.hidden=true,1400);
}
async function withProgress(title,fn){
  updateProgress({title,detail:"Working…",indeterminate:true});try{return await fn()}finally{updateProgress({title,detail:"Complete",percent:100,done:true})}
}
function toast(text){updateProgress({title:text,detail:"",percent:100,done:true})}
function viewHead(title,subtitle,actions=""){return `<div class="view-head"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="actions">${actions}</div></div>`}
function requireSchedule(){const s=activeSchedule();if(!s){$("workspace").innerHTML=`${viewHead("Schedule Intelligence","Import a Primavera P6 XER or Microsoft Project XML file into the Project Repository.")}<div class="empty-state">No schedule has been loaded.</div>`;return null}return s}
function revisionSelector(id,value){
  return `<select id="${id}"><option value="">No comparison</option>${state.schedules.filter(s=>s.id!==state.activeScheduleId).map(s=>`<option value="${s.id}" ${s.id===value?"selected":""}>${esc(s.sourceName||s.name)} · ${isoDate(s.dataDate)||"—"}</option>`).join("")}</select>`;
}
function filterBar(){
  const s=activeSchedule(),wbs=[...new Set((s?.activities||[]).map(a=>a.wbsPath).filter(Boolean))].slice(0,400);
  return `<div class="filterbar"><input id="fSearch" placeholder="Search ID / activity / WBS" value="${esc(state.filters.search)}"><input id="fWBS" list="wbsList" placeholder="WBS contains…" value="${esc(state.filters.wbs)}"><datalist id="wbsList">${wbs.map(x=>`<option>${esc(x)}</option>`).join("")}</datalist><select id="fStatus"><option value="">All statuses</option>${["Not Started","In Progress","Complete"].map(x=>`<option ${state.filters.status===x?"selected":""}>${x}</option>`).join("")}</select><input id="fFloat" type="number" placeholder="Max float (days)" value="${esc(state.filters.floatMax)}"><button class="btn" id="clearFilters">Clear</button></div>`;
}
function bindFilters(){
  const update=()=>{state.filters={search:$("fSearch")?.value||"",wbs:$("fWBS")?.value||"",status:$("fStatus")?.value||"",floatMax:$("fFloat")?.value??""};render()};
  ["fSearch","fWBS","fStatus","fFloat"].forEach(id=>$(id)?.addEventListener(id==="fSearch"||id==="fWBS"?"change":"change",update));
  $("clearFilters")?.addEventListener("click",()=>{state.filters={search:"",wbs:"",status:"",floatMax:""};render()});
}

function renderDashboard(){
  const s=requireSchedule();if(!s)return;
  const filtered=filteredSchedule(),summary=scheduleSummary(filtered),health=scheduleHealth(filtered),prev=previousSchedule(),inbox=plannerInbox(prev,filtered),conf=forecastConfidence(state.schedules),dc=dataCentreReadiness(filtered),milestones=filtered.activities.filter(a=>a.milestone).slice(0,12);
  $("workspace").innerHTML=`${viewHead("Planner Dashboard","Daily project-controls position, forecast confidence and attention items")}
  ${filterBar()}
  <div class="metrics">${metric("Schedule health",`${health.score}/100`,health.label)}${metric("Progress",`${summary.progress.toFixed(1)}%`,"Activity weighted")}${metric("Forecast finish",summary.forecastFinish||"—","Current programme")}${metric("Critical",summary.critical,"Critical / zero float")}${metric("Negative float",summary.negativeFloat,"Activities")}${metric("Forecast confidence",`${conf.score}%`,conf.label)}</div>
  <div class="grid grid2">
    <section class="panel"><h2>Planner's Inbox</h2><div class="inbox">${inbox.length?inbox.map(x=>`<div class="inbox-item ${x.severity}"><strong>${esc(x.category)}</strong> · ${esc(x.text)}</div>`).join(""):`<div class="muted">No major deterministic alerts.</div>`}</div></section>
    <section class="panel"><h2>Data-centre readiness</h2>${table(["Stage","Activities","Complete","Progress","Critical"],dc.map(x=>[x.stage,x.activities,x.complete,`${x.progress.toFixed(1)}%`,x.critical]))}</section>
    <section class="panel"><h2>Key milestones</h2>${table(["Milestone","Forecast","Float","Status"],milestones.map(a=>[`${esc(a.id)} · ${esc(a.name)}`,isoDate(a.currentFinish||a.finish),a.totalFloat.toFixed(1),badge(a.status,a.critical?"danger":"")]))}</section>
    <section class="panel"><h2>Revision lineage</h2>${table(["Revision","Data date","Gap","Activities"],revisionLineage(state.schedules).slice(-10).map(x=>[esc(x.schedule.sourceName||x.schedule.name),isoDate(x.schedule.dataDate),`${x.dataDateGapDays}d`,x.schedule.activities.length]))}</section>
  </div>`;
  bindFilters();
}

function chatMarkup(key,title,subtitle,defaultRole){
  const hist=state.chats[key]||[];
  return `${viewHead(title,subtitle)}<section class="panel chat"><div class="messages" id="messages">${hist.map(m=>`<div class="msg ${m.role==="user"?"user":""}">${esc(m.content)}${m.sources?.length?`<div style="margin-top:7px;font-size:9px;opacity:.75">Evidence: ${m.sources.slice(0,8).map(s=>esc(s.name)).join(" · ")}${m.structuredTool?` · Tool: ${esc(m.structuredTool)}`:""}</div>`:""}</div>`).join("")||`<div class="muted">Checked Project Repository files are available as context.</div>`}</div><div class="chatbox"><select id="chatRole">${roles.map(r=>`<option ${r===defaultRole?"selected":""}>${r}</option>`).join("")}</select><textarea id="chatInput" placeholder="Ask about the current project…"></textarea><button id="chatSend">Send</button></div></section>`;
}
function bindChat(key,defaultRole){
  $("chatSend").onclick=async()=>{
    const q=$("chatInput").value.trim();if(!q)return;
    const hist=state.chats[key]??=[];hist.push({role:"user",content:q});$("chatInput").value="";render();
    try{
      const out=await askAI({question:q,role:$("chatRole")?.value||defaultRole,current:activeSchedule(),previous:previousSchedule(),revisions:state.schedules,history:hist.slice(0,-1)});
      hist.push({role:"assistant",content:out.text,sources:out.sources||[],structuredTool:out.structuredTool||null});render();
    }catch(e){
      const ollamaHelp=/Ollama/i.test(String(e?.message||""))
        ? `\n\nOpen Settings → Ollama and use “Check Ollama”. If Ollama is not installed, install/start it first. If it is running, verify OLLAMA_ORIGINS allows this GitHub Pages origin.`
        : "";
      hist.push({role:"assistant",content:`AI request failed: ${e.message}${ollamaHelp}`});render()
    }
  };
}
function renderContracts(){
  $("workspace").innerHTML=chatMarkup("contracts","Contract Manager","Evidence-grounded contract and project-controls review using checked repository files.","Contract Analyst");
  bindChat("contracts","Contract Analyst");
}
function renderNotebook(){
  $("workspace").innerHTML=chatMarkup("notebook","NotebookLM+","Project notebook chat across checked repository sources and structured schedule tools.","Project Controls Manager");
  bindChat("notebook","Project Controls Manager");
}

function renderDrawing(){
  $("workspace").innerHTML=`${viewHead("Drawing Measurement","Quantity register, BOQ/schedule allocation and AI-assisted classification",`<button class="btn" id="addQty">Add row</button><button class="btn" id="exportQty">Export CSV</button>`)}
  <section class="panel">${table(["Discipline","Category","Item","Unit","Quantity","BOQ Item","Activity ID","Norm h/unit","Calculated hours",""],state.quantityRows.map((r,i)=>[
    `<input data-q="${i}:discipline" value="${esc(r.discipline||"")}">`,`<input data-q="${i}:category" value="${esc(r.category||"")}">`,`<input data-q="${i}:item" value="${esc(r.item||"")}">`,`<input data-q="${i}:unit" value="${esc(r.unit||"")}">`,
    `<input type="number" data-q="${i}:quantity" value="${r.quantity||0}">`,`<input data-q="${i}:boq" value="${esc(r.boq||"")}">`,`<input data-q="${i}:activityId" value="${esc(r.activityId||"")}">`,`<input type="number" data-q="${i}:norm" value="${r.norm||0}">`,((r.quantity||0)*(r.norm||0)).toFixed(2),`<button data-delq="${i}">×</button>`
  ]))}</section>
  <div style="margin-top:12px">${chatMarkup("drawing","AI Measurement Assistant","Use AI to classify documented quantities, map them to BOQ/schedule activities and identify evidence gaps.","Commercial Manager")}</div>`;
  document.querySelectorAll("[data-q]").forEach(x=>x.onchange=()=>{const [i,k]=x.dataset.q.split(":");state.quantityRows[Number(i)][k]=x.type==="number"?Number(x.value):x.value;localStorage.setItem("pcai.quantities",JSON.stringify(state.quantityRows));renderDrawing()});
  document.querySelectorAll("[data-delq]").forEach(x=>x.onclick=()=>{state.quantityRows.splice(Number(x.dataset.delq),1);localStorage.setItem("pcai.quantities",JSON.stringify(state.quantityRows));renderDrawing()});
  $("addQty").onclick=()=>{state.quantityRows.push({id:uid("qty"),discipline:"Electrical",category:"",item:"",unit:"m",quantity:0,boq:"",activityId:"",norm:0});localStorage.setItem("pcai.quantities",JSON.stringify(state.quantityRows));renderDrawing()};
  $("exportQty").onclick=()=>downloadBlob(new Blob([toCSV(["Discipline","Category","Item","Unit","Quantity","BOQ","Activity ID","Norm","Hours"],state.quantityRows.map(r=>[r.discipline,r.category,r.item,r.unit,r.quantity,r.boq,r.activityId,r.norm,(r.quantity||0)*(r.norm||0)]))],{type:"text/csv"}),"drawing-measurements.csv");
  bindChat("drawing","Commercial Manager");
}

function assessmentNav(){
  const items=[["overview","Overview"],["activities","Activity Register"],["comparison","Schedule Comparison"],["week","Week-on-Week"],["critical","Critical Path"],["logic","Logic & Health"],["dcma","DCMA-style Check"],["whymove","Why Date Moved"],["delay","Delay Analysis"],["forensic","Forensic Review"],["calendar","Calendar Analyser"],["scurve","S-Curve & Histogram"],["forecast","Forecast Confidence"],["narrative","Schedule Narrative"],["gantt","WBS / Gantt"],["network","Nodes & Links"],["timemachine","Time Machine"],["milestones","Milestone Control"],["resources","Resources & EVM"],["cost","Cost Report"],["baseline","Baseline & Lookahead"],["datacentre","Data-Centre Mode"]];
  return `<div class="report-nav">${items.map(([id,l])=>`<button data-report="${id}" class="${state.assessmentReport===id?"active":""}">${l}</button>`).join("")}</div>`;
}
function renderAssessment(){
  const s=requireSchedule();if(!s)return;const fs=filteredSchedule();
  $("workspace").innerHTML=`${viewHead("Schedule Assessment","Primavera P6 / Microsoft Project schedule intelligence, QA, comparison and forensic analysis",`<button class="btn" id="exportReportCsv">Export table CSV</button><button class="btn" id="printReport">Print / PDF</button>`)}${filterBar()}${assessmentNav()}<div id="reportBody">${assessmentReport(fs)}</div>`;
  bindFilters();document.querySelectorAll("[data-report]").forEach(b=>b.onclick=()=>{state.assessmentReport=b.dataset.report;renderAssessment()});$("printReport").onclick=()=>window.print();
  $("exportReportCsv").onclick=()=>exportVisibleTables();
  bindAssessmentControls(fs);
}
function assessmentReport(s){
  const prev=previousSchedule(),h=scheduleHealth(s),comp=prev?compareSchedules(prev,s):null;
  switch(state.assessmentReport){
    case"activities":return `<section class="panel"><h2>Virtualised activity register</h2><div id="virtualActivities" style="height:600px;overflow:auto;position:relative"></div></section>`;
    case"comparison":{
      if(!prev)return `<section class="panel"><h2>Schedule Comparison</h2><p class="muted">Choose/import a comparative programme to analyse revision movement.</p></section>`;
      const changeRows=comp.changed.slice().sort((a,b)=>Math.abs(b.finishDays)-Math.abs(a.finishDays));
      return `<div class="metrics">${metric("Data date interval",`${comp.summary.dataDateDays}d`)}${metric("Forecast movement",`${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays}d`)}${metric("Progress movement",`${comp.summary.progressPoints>=0?"+":""}${comp.summary.progressPoints.toFixed(1)} pts`)}${metric("Added / deleted",`${comp.added.length} / ${comp.deleted.length}`)}${metric("Logic + / -",`${comp.relationshipAdded.length} / ${comp.relationshipDeleted.length}`)}${metric("Critical entered / left",`${comp.migration.entered.length} / ${comp.migration.left.length}`)}</div>
      <section class="panel"><h2>Material Change Register</h2>${table(["Activity","Start Δ","Finish Δ","Duration Δ","Float Δ","Progress Δ","Calendar","Constraint"],changeRows.slice(0,500).map(x=>[`${esc(x.id)} · ${esc(x.name)}`,`${x.startDays>=0?"+":""}${x.startDays}d`,`${x.finishDays>=0?"+":""}${x.finishDays}d`,`${x.durationDays>=0?"+":""}${x.durationDays.toFixed(1)}d`,`${x.floatDays>=0?"+":""}${x.floatDays.toFixed(1)}d`,`${x.progressPoints>=0?"+":""}${x.progressPoints.toFixed(1)} pts`,x.calendarChanged?"Changed":"—",x.constraintChanged?"Changed":"—"]))}</section>
      <div class="grid grid2"><section class="panel"><h2>New / deleted activities</h2>${table(["Type","Activity"],[...comp.added.slice(0,200).map(a=>["Added",`${esc(a.id)} · ${esc(a.name)}`]),...comp.deleted.slice(0,200).map(a=>["Deleted",`${esc(a.id)} · ${esc(a.name)}`])])}</section><section class="panel"><h2>Relationship changes</h2>${table(["Type","Relationship","Lag"],[...comp.relationshipAdded.slice(0,200).map(r=>["Added",`${esc(r.predId)} ${esc(r.type)} ${esc(r.succId)}`,`${r.lag}d`]),...comp.relationshipDeleted.slice(0,200).map(r=>["Deleted",`${esc(r.predId)} ${esc(r.type)} ${esc(r.succId)}`,`${r.lag}d`])])}</section></div>`;
    }
    case"week":{
      if(!prev)return `<section class="panel"><h2>Week-on-Week</h2><p class="muted">A comparative programme is required.</p></section>`;
      const pmap=new Map(prev.activities.map(a=>[a.id,a])),starts=[],finishes=[],progressed=[],slipped=[];
      for(const a of s.activities){const p=pmap.get(a.id);if(!p)continue;if(!p.actualStart&&a.actualStart)starts.push(a);if(Number(p.percent)<100&&Number(a.percent)>=100)finishes.push(a);if(Number(a.percent)>Number(p.percent))progressed.push({a,delta:Number(a.percent)-Number(p.percent)});const mv=daysBetween(p.currentFinish||p.finish,a.currentFinish||a.finish);if(mv>0)slipped.push({a,delta:mv})}
      slipped.sort((a,b)=>b.delta-a.delta);progressed.sort((a,b)=>b.delta-a.delta);
      return `<div class="metrics">${metric("New actual starts",starts.length)}${metric("New completions",finishes.length)}${metric("Activities progressed",progressed.length)}${metric("Activities slipped",slipped.length)}${metric("Progress Δ",`${comp.summary.progressPoints>=0?"+":""}${comp.summary.progressPoints.toFixed(1)} pts`)}${metric("Forecast Δ",`${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays}d`)}</div>
      <div class="grid grid2"><section class="panel"><h2>Top weekly progress</h2>${table(["Activity","Progress Δ","Current %"],progressed.slice(0,150).map(x=>[`${esc(x.a.id)} · ${esc(x.a.name)}`,`+${x.delta.toFixed(1)} pts`,`${x.a.percent.toFixed(1)}%`]))}</section><section class="panel"><h2>Top forecast slippage</h2>${table(["Activity","Finish movement","Current finish"],slipped.slice(0,150).map(x=>[`${esc(x.a.id)} · ${esc(x.a.name)}`,`+${x.delta}d`,isoDate(x.a.currentFinish||x.a.finish)]))}</section></div>`;
    }
    case"dcma":{
      const net=networkHealth(s),checks=h.checks;
      const relCount=Math.max(1,s.relationships.length),actCount=Math.max(1,s.activities.length);
      const dcma=[
        ["Missing logic",`${net.openStarts+net.openFinishes}`,((net.openStarts+net.openFinishes)/actCount*100).toFixed(1)+"%","≤5%"],
        ["Leads",net.leads,(net.leads/relCount*100).toFixed(1)+"%","0%"],
        ["Lags",net.lags,(net.lags/relCount*100).toFixed(1)+"%","≤5%"],
        ["Long durations",s.activities.filter(a=>a.originalDuration>44).length,(s.activities.filter(a=>a.originalDuration>44).length/actCount*100).toFixed(1)+"%","≤5%"],
        ["High float",s.activities.filter(a=>a.totalFloat>44).length,(s.activities.filter(a=>a.totalFloat>44).length/actCount*100).toFixed(1)+"%","≤5%"],
        ["Negative float",s.activities.filter(a=>a.totalFloat<0).length,(s.activities.filter(a=>a.totalFloat<0).length/actCount*100).toFixed(1)+"%","≤2%"],
        ["Constraints",s.activities.filter(a=>a.constraintType).length,(s.activities.filter(a=>a.constraintType).length/actCount*100).toFixed(1)+"%","≤5%"],
        ["Cycles",net.cycles,net.cycles?"Fail":"Pass","0"]
      ];
      return `<div class="metrics">${metric("Schedule health",`${h.score}/100`,h.label)}${metric("Logic density",net.logicDensity.toFixed(2))}${metric("Open starts",net.openStarts)}${metric("Open finishes",net.openFinishes)}${metric("Cycles",net.cycles)}${metric("Duplicate relationships",net.duplicateRelationships)}</div><section class="panel"><h2>DCMA-style quality screen</h2><p class="muted">This is an internal DCMA-style screening report, not an official DCMA certification.</p>${table(["Check","Count","Rate / result","Guideline"],dcma)}</section>`;
    }
    case"delay":{
      if(!prev)return `<section class="panel"><h2>Delay Analysis</h2><p class="muted">Import/select a comparative programme for deterministic delay movement analysis.</p></section>`;
      const slips=comp.changed.filter(x=>x.finishDays>0).sort((a,b)=>b.finishDays-a.finishDays);
      const critSlips=slips.filter(x=>s.activities.find(a=>a.id===x.id)?.critical||s.activities.find(a=>a.id===x.id)?.totalFloat<=0);
      return `<div class="metrics">${metric("Slipped activities",slips.length)}${metric("Critical slipped",critSlips.length)}${metric("Forecast project Δ",`${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays}d`)}${metric("Entered critical",comp.migration.entered.length)}${metric("Logic added",comp.relationshipAdded.length)}${metric("Logic removed",comp.relationshipDeleted.length)}</div><section class="panel"><h2>Delay movement register</h2>${table(["Activity","Finish Δ","Start Δ","Duration Δ","Float Δ","Likely evidence"],slips.slice(0,400).map(x=>{const ev=whyDidDateMove(prev,s,x.id);return[`${esc(x.id)} · ${esc(x.name)}`,`+${x.finishDays}d`,`${x.startDays>=0?"+":""}${x.startDays}d`,`${x.durationDays>=0?"+":""}${x.durationDays.toFixed(1)}d`,`${x.floatDays>=0?"+":""}${x.floatDays.toFixed(1)}d`,esc(ev.evidence.slice(0,3).map(e=>e.cause).join("; "))]}))}</section>`;
    }
    case"forensic":{
      if(!prev)return `<section class="panel"><h2>Forensic Review</h2><p class="muted">A previous schedule revision is required for change attribution.</p></section>`;
      const material=comp.changed.filter(x=>Math.abs(x.finishDays)>=5||Math.abs(x.durationDays)>=3||x.calendarChanged||x.constraintChanged);
      return `<section class="panel"><h2>Forensic Change Attribution</h2><p class="muted">Evidence-ranked analytical review. This does not assert contractual causation or entitlement.</p>${table(["Activity","Material movement","Evidence ranking"],material.slice(0,300).map(x=>{const ev=whyDidDateMove(prev,s,x.id);return[`${esc(x.id)} · ${esc(x.name)}`,`${x.finishDays>=0?"+":""}${x.finishDays}d finish`,ev.evidence.slice(0,4).map(e=>`${esc(e.cause)} (${esc(e.confidence)})`).join("<br>")]}))}</section>`;
    }
    case"critical":{
      const crit=s.activities.filter(a=>a.critical||a.totalFloat<=0);
      return `${gantt(s,{activities:crit,criticalOnly:true,forceRed:true,timescale:state.ganttTimescale,compression:"compact"})}<section class="panel"><h2>Critical / zero-float activities</h2>${table(["Activity","WBS","Finish","TF"],crit.map(a=>[`${esc(a.id)} · ${esc(a.name)}`,esc(a.wbsPath),isoDate(a.currentFinish||a.finish),a.totalFloat.toFixed(1)]))}</section>`;
    }
    case"logic":{
      const n=networkHealth(s),oe=openEnds(s),cycles=detectCycles(s);
      return `<div class="metrics">${metric("Health",`${h.score}/100`,h.label)}${metric("Logic density",n.logicDensity.toFixed(2),"Relationships/activity")}${metric("Open starts",oe.starts.length)}${metric("Open finishes",oe.finishes.length)}${metric("Cycles",cycles.length)}${metric("Leads / lags",`${n.leads} / ${n.lags}`)}</div><div class="grid grid2"><section class="panel"><h2>Health checks</h2>${table(["Check","Value","Penalty"],h.checks.map(x=>[x.name,typeof x.value==="number"?x.value.toFixed(3):x.value,x.penalty.toFixed(1)]))}</section><section class="panel"><h2>Open ends</h2>${table(["Type","Activity"],[...oe.starts.slice(0,100).map(a=>["Open start",`${esc(a.id)} · ${esc(a.name)}`]),...oe.finishes.slice(0,100).map(a=>["Open finish",`${esc(a.id)} · ${esc(a.name)}`])])}</section></div>`;
    }
    case"whymove":{
      const id=state.whyActivityId||s.activities[0]?.id||"",x=prev&&id?whyDidDateMove(prev,s,id):null;
      return `<section class="panel"><h2>Why Did My Date Move?</h2><div class="filterbar"><label>Comparative programme ${revisionSelector("whyPrev",state.previousScheduleId)}</label><label>Activity <select id="whyActivity">${s.activities.slice(0,10000).map(a=>`<option value="${esc(a.id)}" ${a.id===id?"selected":""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select></label></div>${!prev?`<div class="muted">Choose a comparative programme.</div>`:x?`${metric("Finish movement",`${x.finishMovementDays>=0?"+":""}${x.finishMovementDays}d`,"Current vs comparison")} ${table(["Evidence","Impact","Confidence"],x.evidence.map(e=>[esc(e.cause),e.impactDays==null?"—":`${e.impactDays>=0?"+":""}${e.impactDays}d`,badge(e.confidence,e.confidence==="Confirmed"?"good":"warn")]))}`:""}</section>`;
    }
    case"calendar":{
      const years=projectYears(s),used=new Set(s.activities.map(a=>a.calendarId)),cals=s.calendars.filter(c=>used.has(c.id)||s.activities.some(a=>a.calendarName===c.name));
      return `<section class="panel"><h2>Calendar Analyser</h2><p class="muted">Non-work days are shaded red; identifiable calendar exceptions are amber. Raw P6 definitions remain preserved for audit.</p></section>${cals.map(c=>`<section class="panel"><h2>${esc(c.name)}</h2>${years.map(y=>{const cy=calendarYear(c,y);return `<div class="calendar-year"><h3>${y}</h3><div class="calendar-grid">${Array.from({length:12},(_,m)=>calendarMonth(cy,m)).join("")}</div></div>`}).join("")}</section>`).join("")||`<div class="panel muted">No assigned calendars found.</div>`}`;
    }
    case"scurve":{
      const rows=weeklySeries(s),series=[{name:"Planned",values:rows.map((r,i)=>({x:i,y:r.plannedPct}))},{name:"Actual",values:rows.map((r,i)=>({x:i,y:r.actualPct}))},{name:"Forecast",values:rows.map((r,i)=>({x:i,y:r.forecastPct}))}];
      return `<section class="panel"><h2>Weekly S-Curve</h2>${lineChart(series)}</section><section class="panel"><h2>Weekly Histogram</h2>${barChart(rows.map(r=>({...r,label:r.week})),{labelKey:"label",series:[{key:"plannedQty",label:"Planned"},{key:"actualQty",label:"Actual"},{key:"forecastQty",label:"Forecast"}]})}</section><section class="panel"><h2>Weekly copyable data</h2>${table(["Week","Week commencing","Planned qty","Actual qty","Forecast qty","Planned hours","Actual hours","Remaining hours","Planned %","Actual %","Forecast %"],rows.map(r=>[r.week,isoDate(r.start),r.plannedQty,r.actualQty,r.forecastQty,r.plannedHours.toFixed(1),r.actualHours.toFixed(1),r.forecastHours.toFixed(1),`${r.plannedPct.toFixed(1)}%`,`${r.actualPct.toFixed(1)}%`,`${r.forecastPct.toFixed(1)}%`]))}</section>`;
    }
    case"narrative":{
      const n=scheduleNarrative(s,prev);
      const bars=n.lookahead.map(w=>`<div class="metric"><small>Week ${w.week} · ${isoDate(w.start)}</small><strong>${w.starts.length} starts</strong><small>${w.finishes.length} finishes · ${w.criticalStarts.length} critical starts</small></div>`).join("");
      return `<section class="panel"><div class="filterbar"><label>Comparative programme ${revisionSelector("narrativePrev",state.previousScheduleId)}</label></div><h2>Executive Schedule Narrative</h2>${n.paragraphs.map(p=>`<p>${esc(p)}</p>`).join("")}<h3>Next four weeks</h3><div class="grid grid4">${bars}</div>${table(["Week","Period","Starts","Finishes","Critical starts","Key upcoming activities"],n.lookahead.map(w=>[`Week ${w.week}`,`${isoDate(w.start)} – ${isoDate(w.end)}`,w.starts.length,w.finishes.length,w.criticalStarts.length,w.starts.slice(0,5).map(a=>`${esc(a.id)} ${esc(a.name)}`).join("; ")]))}</section>`;
    }
    case"gantt":return gantt(s,{timescale:state.ganttTimescale,compression:state.ganttCompression,showRelationships:state.ganttRelationships});
    case"network":{
      const conv=pathConvergence(s).slice(0,40),lp=longestPath(s);
      return `<section class="panel"><h2>Nodes & Links</h2><p class="muted">Critical/zero-float network subset shown for readability. Hover nodes/links for evidence.</p>${networkGraph(s,{maxNodes:90})}</section><div class="grid grid2"><section class="panel"><h2>Network graph intelligence</h2>${metric("Longest path",`${lp.duration.toFixed(1)}d`,`${lp.path.length} activities`)}${table(["Activity","Incoming","Outgoing"],conv.map(x=>[`${esc(x.activity.id)} · ${esc(x.activity.name)}`,x.incoming,x.outgoing]))}</section><section class="panel"><h2>Trace to milestone / activity</h2><select id="traceActivity">${s.activities.filter(a=>a.milestone||a.critical).slice(0,2000).map(a=>`<option value="${esc(a.id)}" ${a.id===state.traceActivityId?"selected":""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select><div id="traceResult">${renderTrace(s)}</div></section></div>`;
    }
    case"timemachine":{
      const id=state.timeActivityId||s.activities.find(a=>a.milestone)?.id||s.activities[0]?.id||"",hist=activityHistory(state.schedules,id);
      const vals=hist.map((x,i)=>({x:i,y:parseDate(x.finish)?.getTime()/86400000||0}));
      return `<section class="panel"><h2>Schedule Time Machine</h2><select id="timeActivity">${s.activities.slice(0,10000).map(a=>`<option value="${esc(a.id)}" ${a.id===id?"selected":""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select>${lineChart([{name:"Forecast finish",values:vals}])}${table(["Revision","Data date","Start","Finish","TF","Progress","Critical"],hist.map(x=>[esc(x.scheduleName),isoDate(x.dataDate),isoDate(x.start),isoDate(x.finish),Number(x.totalFloat).toFixed(1),`${Number(x.percent).toFixed(1)}%`,x.critical?"Yes":"No"]))}</section>`;
    }
    case"milestones":{
      const ms=s.activities.filter(a=>a.milestone),hist=milestoneHistory(state.schedules);
      return `<section class="panel"><h2>Milestone Control Centre</h2>${table(["Milestone","Forecast","Previous","Movement","Float","Confidence"],ms.map(a=>{const h=hist.find(x=>x.id===a.id)?.history||[],p=h.length>1?h.at(-2):null,move=p?daysBetween(p.finish,a.currentFinish||a.finish):0,conf=forecastConfidence(state.schedules,a.id);return[`${esc(a.id)} · ${esc(a.name)}`,isoDate(a.currentFinish||a.finish),isoDate(p?.finish),p?`${move>=0?"+":""}${move}d`:"—",a.totalFloat.toFixed(1),`${conf.score}% ${conf.label}`]}))}</section>`;
    }
    case"forecast":{
      const ms=s.activities.filter(a=>a.milestone),overall=forecastConfidence(state.schedules);
      const rows=ms.map(a=>{const c=forecastConfidence(state.schedules,a.id);return[`${esc(a.id)} · ${esc(a.name)}`,`${c.score}%`,c.label,c.volatility.toFixed(1),c.avgSlip.toFixed(1),isoDate(a.currentFinish||a.finish)]});
      return `<div class="metrics">${metric("Overall confidence",`${overall.score}%`,overall.label)}${metric("Revision volatility",overall.volatility.toFixed(1),"days std dev")}${metric("Average positive slip",overall.avgSlip.toFixed(1),"days")}${metric("Revisions analysed",overall.rows.length)}${metric("Current critical",s.activities.filter(a=>a.critical||a.totalFloat<=0).length)}${metric("Current negative float",s.activities.filter(a=>a.totalFloat<0).length)}</div><section class="panel"><h2>Milestone Forecast Confidence</h2>${table(["Milestone","Confidence","Band","Volatility","Avg slip","Current forecast"],rows)}</section>`;
    }
    case"cost":{
      const groups=new Map();
      for(const a of s.activities){const key=a.wbsPath||"Unassigned";if(!groups.has(key))groups.set(key,{budget:0,actual:0,remaining:0,units:0});const g=groups.get(key);g.budget+=Number(a.budgetCost||0);g.actual+=Number(a.actualCost||0);g.remaining+=Number(a.remainingCost||0);g.units+=Number(a.budgetUnits||0)}
      const budget=s.activities.reduce((n,a)=>n+Number(a.budgetCost||0),0),actual=s.activities.reduce((n,a)=>n+Number(a.actualCost||0),0),remaining=s.activities.reduce((n,a)=>n+Number(a.remainingCost||0),0);
      return `<div class="metrics">${metric("Budget cost",budget.toFixed(0))}${metric("Actual cost",actual.toFixed(0))}${metric("Remaining cost",remaining.toFixed(0))}${metric("Forecast cost",(actual+remaining).toFixed(0))}${metric("Cost variance",(budget-(actual+remaining)).toFixed(0))}${metric("Cost loaded activities",s.activities.filter(a=>a.budgetCost||a.actualCost||a.remainingCost).length)}</div><section class="panel"><h2>Cost by WBS</h2>${table(["WBS","Budget","Actual","Remaining","Forecast","Variance"],[...groups.entries()].map(([k,g])=>[esc(k),g.budget.toFixed(0),g.actual.toFixed(0),g.remaining.toFixed(0),(g.actual+g.remaining).toFixed(0),(g.budget-(g.actual+g.remaining)).toFixed(0)]))}</section>`;
    }
    case"resources":{
      const assigns=s.assignments||[],resources=s.resources||[];
      const resourceRows=resources.map(r=>{
        const xs=assigns.filter(x=>String(x.resourceId)===String(r.id));
        const budget=xs.reduce((n,x)=>n+Number(x.target_qty||x.budgetUnits||0),0),actual=xs.reduce((n,x)=>n+Number(x.act_reg_qty||x.actualUnits||0),0),remaining=xs.reduce((n,x)=>n+Number(x.remain_qty||x.remainingUnits||0),0);
        return [esc(r.name||r.id),budget.toFixed(1),actual.toFixed(1),remaining.toFixed(1),budget?`${(actual/budget*100).toFixed(1)}%`:"—"];
      });
      const budgetUnits=s.activities.reduce((n,a)=>n+Number(a.budgetUnits||0),0),actualUnits=s.activities.reduce((n,a)=>n+Number(a.actualUnits||0),0),budgetCost=s.activities.reduce((n,a)=>n+Number(a.budgetCost||0),0),actualCost=s.activities.reduce((n,a)=>n+Number(a.actualCost||0),0);
      const pv=budgetUnits?weeklySeries(s).at(-1)?.plannedPct||0:0,ev=avgProgress(s),spi=pv?ev/pv:0,cpi=actualCost?((budgetCost*(ev/100))/actualCost):0;
      return `<div class="metrics">${metric("Budget units",budgetUnits.toFixed(1))}${metric("Actual units",actualUnits.toFixed(1))}${metric("Budget cost",budgetCost.toFixed(0))}${metric("Actual cost",actualCost.toFixed(0))}${metric("SPI",spi?spi.toFixed(2):"—","Indicative")}${metric("CPI",cpi?cpi.toFixed(2):"—","Indicative")}</div><section class="panel"><h2>Resource / EVM view</h2><p class="muted">EVM indicators are shown only from source values available in the imported schedule; they are not a substitute for a cost-management system.</p>${table(["Resource","Budget units","Actual units","Remaining units","Actual / budget"],resourceRows)}</section>`;
    }
    case"baseline":{
      const look=fourWeekLookahead(s),slips=s.activities.filter(a=>a.baselineFinish&&a.currentFinish&&daysBetween(a.baselineFinish,a.currentFinish)>0).sort((a,b)=>daysBetween(b.baselineFinish,b.currentFinish)-daysBetween(a.baselineFinish,a.currentFinish));
      return `<div class="grid grid2"><section class="panel"><h2>Baseline variance</h2>${table(["Activity","Baseline finish","Current finish","Variance"],slips.slice(0,250).map(a=>[`${esc(a.id)} · ${esc(a.name)}`,isoDate(a.baselineFinish),isoDate(a.currentFinish),`+${daysBetween(a.baselineFinish,a.currentFinish)}d`]))}</section><section class="panel"><h2>Four-week lookahead</h2>${table(["Week","Starts","Finishes","Critical starts"],look.map(w=>[`Week ${w.week}`,w.starts.length,w.finishes.length,w.criticalStarts.length]))}</section></div>`;
    }
    case"datacentre":{
      const dc=dataCentreReadiness(s),gates=readinessGates(s);
      return `<div class="grid grid2"><section class="panel"><h2>Data-centre lifecycle readiness</h2>${table(["Stage","Activities","Complete","Progress","Critical"],dc.map(x=>[x.stage,x.activities,x.complete,`${x.progress.toFixed(1)}%`,x.critical]))}</section><section class="panel"><h2>Readiness gates</h2>${table(["Gate","Mapped milestone","Forecast","Float"],gates.map(g=>[g.name,g.activity?`${esc(g.activity.id)} · ${esc(g.activity.name)}`:"Not mapped",isoDate(g.activity?.currentFinish||g.activity?.finish),g.activity?g.activity.totalFloat.toFixed(1):"—"]))}</section></div>`;
    }
    default:{
      const summary=scheduleSummary(s);
      return `<div class="metrics">${metric("Activities",summary.activities)}${metric("Progress",`${summary.progress.toFixed(1)}%`)}${metric("Forecast finish",summary.forecastFinish||"—")}${metric("Health",`${h.score}/100`,h.label)}${metric("Critical",summary.critical)}${metric("Negative float",summary.negativeFloat)}</div>${prev?`<section class="panel"><h2>What changed?</h2>${table(["Indicator","Movement"],Object.entries(comp.summary).map(([k,v])=>[esc(k),typeof v==="number"?v.toFixed(1):esc(v)]))}</section>`:`<section class="panel muted">Import/select a comparative revision to unlock change attribution.</section>`}`;
    }
  }
}
function renderTrace(s){
  const id=state.traceActivityId||s.activities.find(a=>a.milestone)?.id||"";if(!id)return `<div class="muted">Select an activity.</div>`;
  const x=traceToMilestone(s,id);return table(["Sequence","Activity","Finish","TF"],x.drivingChain.map((a,i)=>[i+1,`${esc(a.id)} · ${esc(a.name)}`,isoDate(a.currentFinish||a.finish),a.totalFloat.toFixed(1)]));
}
function bindAssessmentControls(s){
  if(state.assessmentReport==="activities")mountVirtualActivities($("virtualActivities"),s.activities);
  if(state.assessmentReport==="whymove"){
    $("whyActivity")?.addEventListener("change",e=>{state.whyActivityId=e.target.value;renderAssessment()});
    $("whyPrev")?.addEventListener("change",e=>{state.previousScheduleId=e.target.value||null;renderAssessment()});
  }
  if(state.assessmentReport==="narrative")$("narrativePrev")?.addEventListener("change",e=>{state.previousScheduleId=e.target.value||null;renderAssessment()});
  if(state.assessmentReport==="gantt"||state.assessmentReport==="critical"){
    $("ganttTimescale")?.addEventListener("change",e=>{state.ganttTimescale=e.target.value;renderAssessment()});
    $("ganttCompression")?.addEventListener("change",e=>{state.ganttCompression=e.target.value;renderAssessment()});
    $("ganttRelationships")?.addEventListener("change",e=>{state.ganttRelationships=e.target.checked;renderAssessment()});
  }
  if(state.assessmentReport==="network")$("traceActivity")?.addEventListener("change",e=>{state.traceActivityId=e.target.value;renderAssessment()});
  if(state.assessmentReport==="timemachine")$("timeActivity")?.addEventListener("change",e=>{state.timeActivityId=e.target.value;renderAssessment()});
}
function mountVirtualActivities(container,activities){
  if(!container)return;const rowH=32,headerH=32,total=activities.length;
  container.innerHTML=`<div style="height:${headerH+total*rowH}px;position:relative"><div style="position:sticky;top:0;height:${headerH}px;background:var(--panel);z-index:2;display:grid;grid-template-columns:120px 1fr 160px 100px 100px 70px 70px;padding:6px"><strong>ID</strong><strong>Activity</strong><strong>WBS</strong><strong>Start</strong><strong>Finish</strong><strong>TF</strong><strong>%</strong></div><div id="virtualRows"></div></div>`;
  const rows=$("virtualRows");const paint=()=>{
    const top=container.scrollTop,from=Math.max(0,Math.floor((top-headerH)/rowH)-8),count=Math.ceil(container.clientHeight/rowH)+16,to=Math.min(total,from+count);
    rows.innerHTML=activities.slice(from,to).map((a,i)=>`<div style="position:absolute;top:${headerH+(from+i)*rowH}px;left:0;right:0;height:${rowH}px;display:grid;grid-template-columns:120px 1fr 160px 100px 100px 70px 70px;padding:6px;border-bottom:1px solid var(--border)"><span>${esc(a.id)}</span><span title="${esc(a.name)}">${esc(a.name)}</span><span>${esc(a.wbsPath)}</span><span>${isoDate(a.currentStart||a.start)}</span><span>${isoDate(a.currentFinish||a.finish)}</span><span>${a.totalFloat.toFixed(1)}</span><span>${a.percent.toFixed(1)}</span></div>`).join("");
  };container.onscroll=paint;paint();
}

function exportVisibleTables(){
  const tables=[...$("workspace").querySelectorAll("table")];
  if(!tables.length){alert("This report does not contain a table to export.");return}
  const blocks=tables.map((tbl,ti)=>{
    const rows=[...tbl.querySelectorAll("tr")].map(tr=>[...tr.children].map(td=>td.innerText.trim()));
    return [`Report Table ${ti+1}`,...rows.map(r=>r.map(v=>String(v).replace(/\t/g," ")).join("\t"))].join("\n");
  });
  downloadBlob(new Blob([blocks.join("\n\n")],{type:"text/tab-separated-values"}),`${state.assessmentReport}-report.tsv`);
}

function renderRisk(){
  const s=requireSchedule();if(!s)return;
  const risks=state.risks.map(r=>mapRiskToSchedule(r,s));
  $("workspace").innerHTML=`${viewHead("Risk Analysis","Risk register, schedule mapping, QSRA, criticality and mitigation",`<button class="btn primary" id="runMonte">Run Monte Carlo</button>`)}
  <div class="grid grid2"><section class="panel"><h2>Risk Register</h2>${table(["ID","Risk","Probability","Impact days","Mapped activities","Mitigation"],risks.map(r=>[esc(r.code||r.id),esc(r.title),`${Number(r.probability||0)}%`,Number(r.impactDays||0),r.activities.map(a=>esc(a.id)).join(", "),esc(r.mitigation||"")]))}
  <form id="riskForm" class="form"><label>Risk title<input name="title" required></label><label>Probability %<input name="probability" type="number" min="0" max="100" value="30"></label><label>Impact days<input name="impactDays" type="number" value="10"></label><label>Activity IDs (comma separated)<input name="activityIds"></label><label>Mitigation<textarea name="mitigation"></textarea></label><button class="btn primary">Add Risk</button></form></section>
  <section class="panel"><h2>Quantitative Schedule Risk Analysis</h2>${state.monte?renderMonte(state.monte):`<div class="muted">Run Monte Carlo to calculate P10/P50/P80/P90 and criticality.</div>`}</section></div>
  <div style="margin-top:12px">${chatMarkup("risk","AI Risk Review","Review schedule risk, mapped risk events and mitigation using the shared project evidence.","Risk Analyst")}</div>`;
  $("riskForm").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);await saveRisk({code:`R-${String(state.risks.length+1).padStart(3,"0")}`,title:fd.get("title"),probability:Number(fd.get("probability")),impactDays:Number(fd.get("impactDays")),activityIds:String(fd.get("activityIds")||"").split(",").map(x=>x.trim()).filter(Boolean),mitigation:fd.get("mitigation")});await refreshData();renderRisk()};
  $("runMonte").onclick=async()=>{await withProgress("Running Monte Carlo",async()=>{state.monte=await runMonteWorker(s,{iterations:2000,seed:42,uncertainty:.2})});renderRisk()};
  bindChat("risk","Risk Analyst");
}
function renderMonte(m){
  if(m.error)return `<div class="badge danger">${esc(m.error)}</div>`;
  return `<div class="metrics" style="grid-template-columns:repeat(4,1fr)">${metric("P10",`${m.p10.toFixed(1)}d`)}${metric("P50",`${m.p50.toFixed(1)}d`)}${metric("P80",`${m.p80.toFixed(1)}d`)}${metric("P90",`${m.p90.toFixed(1)}d`)}</div>${table(["Activity","Criticality"],m.criticality.slice(0,30).map(x=>[esc(x.id),`${x.probability.toFixed(1)}%`]))}`;
}
async function runMonteWorker(schedule,options){
  if(typeof Worker==="undefined")return runMonteCarlo(schedule,options);
  return await new Promise((resolve,reject)=>{
    const w=new Worker(new URL("../workers/montecarlo-worker.js?v=1.2.0",import.meta.url),{type:"module"}),id=uid("mc");
    w.onmessage=e=>{if(e.data.id!==id)return;w.terminate();e.data.ok?resolve(e.data.result):reject(new Error(e.data.error))};w.onerror=e=>{w.terminate();reject(e.error||new Error(e.message))};w.postMessage({id,schedule,options});
  });
}

function renderClaims(){
  const s=requireSchedule();if(!s)return;
  $("workspace").innerHTML=`${viewHead("Claims & Forensics","Delay-event chronology, schedule evidence, notices and forensic evidence packs")}
  <div class="grid grid2"><section class="panel"><h2>Delay / Change Events</h2>${table(["ID","Event","Date","Activities","Notice"],state.claims.map(c=>[esc(c.code||c.id),esc(c.title),esc(c.date||""),esc((c.activityIds||[]).join(", ")),esc(c.notice||"")]))}
  <form id="claimForm" class="form"><label>Event title<input name="title" required></label><label>Event date<input name="date" type="date"></label><label>Description<textarea name="description"></textarea></label><label>Affected activity IDs<input name="activityIds" placeholder="A100, A200"></label><label>Milestone ID<input name="milestoneId"></label><label>Notice / correspondence ref<input name="notice"></label><label>Instruction ref<input name="instruction"></label><button class="btn primary">Add Event</button></form></section>
  <section class="panel"><h2>Evidence Pack Generator</h2><select id="claimSelect"><option value="">Select event</option>${state.claims.map(c=>`<option value="${c.id}">${esc(c.code||c.id)} · ${esc(c.title)}</option>`).join("")}</select><button class="btn" id="buildClaim">Generate Delay Event File</button><div id="claimResult" style="margin-top:10px"></div></section></div>
  <div style="margin-top:12px">${chatMarkup("claims","Forensic Planning Assistant","Analyse chronology, programme movement and evidence without inventing entitlement.","Forensic Planner")}</div>`;
  $("claimForm").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);await saveClaim({code:`CE-${String(state.claims.length+1).padStart(3,"0")}`,title:fd.get("title"),date:fd.get("date"),description:fd.get("description"),activityIds:String(fd.get("activityIds")||"").split(",").map(x=>x.trim()).filter(Boolean),milestoneId:fd.get("milestoneId"),notice:fd.get("notice"),instruction:fd.get("instruction")});await refreshData();renderClaims()};
  $("buildClaim").onclick=async()=>{const c=state.claims.find(x=>x.id===$("claimSelect").value);if(!c)return;const pack=buildDelayEventFile({event:c,current:s,previous:previousSchedule(),documents:state.files});$("claimResult").innerHTML=`<pre style="white-space:pre-wrap">${esc(JSON.stringify(pack,null,2).slice(0,30000))}</pre><button class="btn" id="downloadPack">Download JSON</button>`;$("downloadPack").onclick=()=>downloadBlob(new Blob([JSON.stringify(pack,null,2)],{type:"application/json"}),`${c.code||"delay-event"}.json`)};
  bindChat("claims","Forensic Planner");
}

function renderBuilder(){
  $("workspace").innerHTML=`${viewHead("Schedule Builder","Independent planning workspace with editable activities, logic and AI schedule drafting",`<button class="btn" id="builderAdd">Add activity</button><button class="btn" id="builderExport">Export CSV</button>`)}
  <section class="panel">${table(["ID","Activity","Duration d","Predecessors","Milestone",""],state.builderRows.map((r,i)=>[
    `<input data-b="${i}:id" value="${esc(r.id||"")}">`,`<input data-b="${i}:name" value="${esc(r.name||"")}">`,`<input type="number" data-b="${i}:duration" value="${r.duration||0}">`,`<input data-b="${i}:predecessors" value="${esc(r.predecessors||"")}">`,`<input type="checkbox" data-b="${i}:milestone" ${r.milestone?"checked":""}>`,`<button data-delb="${i}">×</button>`
  ]))}</section>
  <div style="margin-top:12px">${chatMarkup("builder","AI Schedule Builder","Draft activities, milestones, logic and assumptions from checked project repository files.","Planner")}</div>`;
  document.querySelectorAll("[data-b]").forEach(x=>x.onchange=()=>{const [i,k]=x.dataset.b.split(":");state.builderRows[Number(i)][k]=x.type==="checkbox"?x.checked:x.type==="number"?Number(x.value):x.value;localStorage.setItem("pcai.builder",JSON.stringify(state.builderRows));renderBuilder()});
  document.querySelectorAll("[data-delb]").forEach(x=>x.onclick=()=>{state.builderRows.splice(Number(x.dataset.delb),1);localStorage.setItem("pcai.builder",JSON.stringify(state.builderRows));renderBuilder()});
  $("builderAdd").onclick=()=>{state.builderRows.push({id:`A${String(state.builderRows.length+1).padStart(4,"0")}`,name:"New Activity",duration:5,predecessors:"",milestone:false});localStorage.setItem("pcai.builder",JSON.stringify(state.builderRows));renderBuilder()};
  $("builderExport").onclick=()=>downloadBlob(new Blob([toCSV(["ID","Activity","Duration","Predecessors","Milestone"],state.builderRows.map(r=>[r.id,r.name,r.duration,r.predecessors,r.milestone]))],{type:"text/csv"}),"schedule-builder.csv");
  bindChat("builder","Planner");
}

function renderSettings(){
  const c=ollamaConfig();
  $("workspace").innerHTML=`${viewHead("Settings","Global AI configuration, browser model diagnostics, Ollama and GitHub Pages deployment")}
  <div class="grid grid2 settings-grid">
    <section class="panel"><h2>Global AI Model</h2>
      <p class="muted">Select the model once in the suite header. Contract Manager, Schedule Assessment, Risk, Claims, NotebookLM+ and Schedule Builder all use the same selection.</p>
      <div id="selectedAiCard" class="ai-config-card"></div>
      <div class="actions" style="margin-top:10px"><button class="btn primary" id="testSelectedAI">Test selected browser AI</button></div>
      <div id="browserAiDiag" class="muted" style="margin-top:8px">Browser models download on first test/use and are cached by the browser.</div>
      <h3 style="margin-top:18px">Available browser models</h3>
      ${table(["Model","Engine","Memory","Compatibility"],AI_CATALOG.filter(x=>x.engine!=="ollama"&&!x.disabled).map(entry=>{
        const cp=aiCompatibility(entry.value);
        return [esc(entry.label),esc(entry.engine==="cpu"?"CPU / WASM":entry.engine==="gpu-transformers"?"WebGPU / Transformers.js":"WebGPU / WebLLM"),esc(entry.memory),cp.ok?badge("Available","good"):badge("Unavailable in this browser","warn")];
      }))}
    </section>
    <section class="panel"><h2>Ollama</h2><div class="form"><label>Host<input id="ollamaHost" value="${esc(c.baseUrl)}"></label><label>Chat model<select id="ollamaModel"><option value="${esc(c.model)}">${esc(c.model||"Detect installed models")}</option></select></label><label>Embedding model<select id="embedModel"><option value="${esc(c.embeddingModel||"")}">${esc(c.embeddingModel||"Keyword-only")}</option></select></label><label>Keep alive<select id="keepAlive">${["default","0","5m","15m","30m","1h","2h","4h"].map(x=>`<option ${c.keepAlive===x?"selected":""}>${x}</option>`).join("")}</select></label><label>Reasoning<select id="thinking">${["off","auto","on"].map(x=>`<option ${c.thinking===x?"selected":""}>${x}</option>`).join("")}</select></label><div class="actions"><button class="btn" id="checkOllama">Check Ollama</button><button class="btn" id="detectOllama">Detect & classify</button><button class="btn primary" id="testOllama">Test & Save</button></div><div id="ollamaDiag" class="muted">Expected local API: http://localhost:11434</div><div id="ollamaHelp" class="ollama-help" hidden></div></div></section>
    <section class="panel"><h2>Project Controls Profile</h2><div class="form"><label>Specialism<select id="profile"><option>General Project Controls</option><option selected>Data Centre</option><option>Life Sciences / Pharma</option><option>Industrial / Process</option></select></label><div class="muted">The profile changes terminology and readiness reporting, not the AI model.</div></div></section>
    <section class="panel"><h2>GitHub Pages deployment</h2><ol class="muted"><li>This toolkit remains fully static and GitHub Pages compatible.</li><li>Browser AI models are downloaded directly by the user's browser and cached locally.</li><li>For Ollama, allow the deployed origin using <code>OLLAMA_ORIGINS</code> and restart Ollama.</li><li>Do not place paid-provider secrets in frontend JavaScript.</li></ol></section>
  </div>`;

  const selected=selectedAIInfo();
  $("selectedAiCard").innerHTML=`<div class="ai-config-title">${esc(aiLabel())}</div>
    <div class="ai-config-meta"><span>${esc(selected.engine==="ollama"?"Ollama":selected.engine==="cpu"?"CPU / WASM":selected.engine==="gpu-transformers"?"WebGPU / Transformers.js":"WebGPU / WebLLM")}</span><span>${esc(selected.memory||"")}</span></div>
    <div class="${selected.compatible?"ai-ok":"ai-warning"}">${selected.compatible?"Compatible with this browser.":esc(selected.compatibilityMessage)}</div>`;
  $("testSelectedAI").disabled=selected.engine==="ollama"||!selected.compatible;
  $("testSelectedAI").title=selected.engine==="ollama"?"Use Test & Save in the Ollama panel.":selected.compatibilityMessage||"Download/load the selected browser model and run a short inference test.";
  $("testSelectedAI").onclick=async()=>{
    const d=$("browserAiDiag");d.textContent=`Testing ${aiLabel()}…`;
    const result=await testSelectedAI();
    d.textContent=result.ok?`✓ ${result.message}`:`✕ ${result.message}`;
  };

  const showOllamaHelp=(resultOrError)=>{
    const box=$("ollamaHelp"),diag=$("ollamaDiag");
    const result=resultOrError?.help?resultOrError:{
      ok:false,
      message:String(resultOrError?.message||resultOrError||"Ollama connection failed"),
      help:[
        "Install Ollama if it is not installed.",
        "Start Ollama and confirm it is running.",
        `Check ${$("ollamaHost").value||"http://localhost:11434"} locally.`,
        "For GitHub Pages, allow this site's origin using OLLAMA_ORIGINS and restart Ollama.",
        "Return here and click Check Ollama."
      ]
    };
    diag.textContent=`✕ ${result.message}`;
    box.hidden=false;
    box.innerHTML=`<strong>Ollama connection help</strong><ol>${result.help.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>
      <div class="muted">The browser cannot always distinguish “not installed” from “not running” or a blocked local-origin request, so the toolkit checks all three possibilities instead of showing a misleading error.</div>`;
  };
  $("checkOllama").onclick=async()=>{
    const d=$("ollamaDiag"),box=$("ollamaHelp");box.hidden=true;d.textContent="Checking Ollama…";
    saveOllamaConfig({baseUrl:$("ollamaHost").value});
    const r=await probeOllama({baseUrl:$("ollamaHost").value});
    if(r.ok){d.textContent=`✓ ${r.message} at ${r.baseUrl}`;box.hidden=true}
    else showOllamaHelp(r);
  };
  $("detectOllama").onclick=async()=>{const d=$("ollamaDiag"),box=$("ollamaHelp");box.hidden=true;d.textContent="Detecting…";try{saveOllamaConfig({baseUrl:$("ollamaHost").value});const models=await inspectModels(),chat=models.filter(x=>x.supportsChat),embed=models.filter(x=>x.supportsEmbedding);$("ollamaModel").innerHTML=chat.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("")||`<option value="">No chat-capable models</option>`;$("embedModel").innerHTML=`<option value="">Keyword-only</option>`+embed.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join("");if(chat.some(x=>x.name===c.model))$("ollamaModel").value=c.model;d.textContent=`✓ ${models.length} installed · ${chat.length} chat · ${embed.length} embedding`}catch(e){showOllamaHelp(e)}};
  $("testOllama").onclick=async()=>{const d=$("ollamaDiag"),box=$("ollamaHelp");box.hidden=true;d.textContent="Testing Ollama…";try{saveOllamaConfig({baseUrl:$("ollamaHost").value,model:$("ollamaModel").value,embeddingModel:$("embedModel").value,keepAlive:$("keepAlive").value,thinking:$("thinking").value});const r=await testOllama({model:$("ollamaModel").value});d.textContent=r.ok?`✓ Ollama ready: ${r.selectedModel}`:`✕ ${r.message}`;if(r.ok){await setPreferredAI("ollama:auto");renderAIModelOptions()}else showOllamaHelp(r)}catch(e){showOllamaHelp(e)}};
}

init().catch(e=>{$("workspace").innerHTML=`<div class="panel"><h2>Startup error</h2><pre>${esc(e.stack||e.message)}</pre></div>`});
