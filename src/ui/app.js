
import {currentProject,projects,newProject,switchProject,restoreFolderHandles,renameProject,addFiles,listFiles,listSchedules,setFileChecked,removeFile,linkFolder,importFolderFallback,selectedContext,saveRisk,listRisks,saveClaim,listClaims} from "../repository/repository.js";
import {preferredAI,setPreferredAI,askAI,aiLabel,AI_CATALOG,aiEntry,aiCompatibility,catalogueGroups,testSelectedAI} from "../ai/runtime.js";
import {ollamaConfig,saveOllamaConfig,inspectModels,testOllama,probeOllama} from "../ai/ollama.js";
import {cloudConfig,saveCloudConfig,clearCloudKey,testCloudAI} from "../ai/cloud.js";
import {scheduleSummary,hydrateSchedule,isMilestoneActivity} from "../core/model.js";
import {esc,isoDate,parseDate,daysBetween,toCSV,downloadBlob,uid,addDays} from "../core/utils.js";
import {metric,table,lineChart,barChart,networkGraph,gantt,calendarMonth,badge} from "./render.js";
import {scheduleHealth,forecastConfidence,plannerInbox} from "../analysis/health.js";
import {compareSchedules,whyDidDateMove,avgProgress} from "../analysis/comparison.js";
import {networkHealth,openEnds,detectCycles,pathConvergence,drivingChain,longestPath,traceToMilestone} from "../analysis/network.js";
import {projectYears,calendarYear} from "../analysis/calendar.js";
import {weeklySeries,fourWeekLookahead,curveSeries} from "../analysis/timeseries.js";
import {activityHistory,milestoneHistory,revisionLineage} from "../analysis/timemachine.js";
import {runMonteCarlo,mapRiskToSchedule} from "../analysis/risk.js";
import {buildDelayEventFile} from "../analysis/claims.js";
import {dataCentreReadiness,readinessGates} from "../analysis/datacentre.js";
import {scheduleNarrative} from "../analysis/narrative.js";
import {mppBridgeUrl,setMppBridgeUrl,probeMppBridge} from "../parsers/index.js";

const $=id=>document.getElementById(id);
const state={
  view:"dashboard",project:null,files:[],schedules:[],risks:[],claims:[],
  activeScheduleId:null,previousScheduleId:null,assessmentReport:"overview",
  filters:{search:"",wbs:"",status:"",floatMax:""},
  ganttTimescale:"weekly",ganttCompression:"standard",ganttRelationships:true,ganttLeftWidth:410,criticalLeftWidth:410,
  ganttStartDate:"",ganttFinishDate:"",criticalStartDate:"",criticalFinishDate:"",
  whyActivityId:"",timeActivityId:"",traceActivityId:"",
  dashboardLineageIds:["","","","",""],comparisonAId:"",comparisonBId:"",weekAId:"",weekBId:"",
  delayAId:"",delayBId:"",forensicScheduleIds:Array(10).fill(""),baselineCurrentId:"",baselineCompareId:"",
  timeMachineScheduleIds:Array(8).fill(""),scurveBasis:"activities",scurveResourceId:"",notebookOutputs:{},
  monte:null,chats:{},quantityRows:[],builderRows:[],riskEdit:null,profile:"Data Centre"
};
const roles=["Planner","Forensic Planner","Risk Analyst","Commercial Manager","Contract Analyst","Project Controls Manager","Executive Reviewer"];
const noRepoViews=new Set(["notebook","builder","settings"]);

function renderAIModelDisplay(){
  const display=$("aiDisplay");if(display)display.value=aiLabel(preferredAI());
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
  state.profile=localStorage.getItem("pcai.profile")||"Data Centre";
  state.ganttLeftWidth=Number(localStorage.getItem("pcai.ganttLeftWidth")||410);state.criticalLeftWidth=Number(localStorage.getItem("pcai.criticalLeftWidth")||410);
  const savedTheme=localStorage.getItem("pcai.theme")||"navy";document.documentElement.dataset.theme=savedTheme;$("themeSelect").value=savedTheme;
  renderAIModelDisplay();
  bindShell();await refreshData();render();
}
function bindShell(){
  $("tabs").addEventListener("click",e=>{const b=e.target.closest("[data-view]");if(!b)return;state.view=b.dataset.view;render()});
  $("themeSelect").addEventListener("change",e=>{document.documentElement.dataset.theme=e.target.value;localStorage.setItem("pcai.theme",e.target.value)});
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
  state.files=await listFiles();state.schedules=(await listSchedules()).map(hydrateSchedule);state.risks=await listRisks();state.claims=await listClaims();
  state.schedules.sort((a,b)=>(parseDate(a.dataDate)?.getTime()||0)-(parseDate(b.dataDate)?.getTime()||0));
  if(!state.activeScheduleId||!state.schedules.some(s=>s.id===state.activeScheduleId))state.activeScheduleId=state.schedules.at(-1)?.id||null;
  const idx=state.schedules.findIndex(s=>s.id===state.activeScheduleId);
  if(!state.previousScheduleId||!state.schedules.some(s=>s.id===state.previousScheduleId))state.previousScheduleId=idx>0?state.schedules[idx-1]?.id:null;
  await renderRepository();
}
function scheduleById(id){return state.schedules.find(s=>s.id===id)||null}
function activeSchedule(){return scheduleById(state.activeScheduleId)}
function previousSchedule(){return scheduleById(state.previousScheduleId)}
function scheduleLabel(s){return [s?.projectName||s?.name||"Schedule",s?.sourceName&&s.sourceName!==(s?.projectName||s?.name)?s.sourceName:"",isoDate(s?.dataDate)||"No data date"].filter(Boolean).join(" · ")}
function scheduleSelector(id,value,{blank="Select schedule…",className=""}={}){
  return `<select id="${id}" class="${className}"><option value="">${esc(blank)}</option>${state.schedules.map(s=>`<option value="${s.id}" ${s.id===value?"selected":""}>${esc(scheduleLabel(s))}</option>`).join("")}</select>`;
}
function scheduleSlots(prefix,values,count,{label="Revision",blank="Not selected"}={}){
  return `<div class="schedule-slot-grid">${Array.from({length:count},(_,i)=>`<label>${esc(label)} ${i+1}${scheduleSelector(`${prefix}${i}`,values[i]||"",{blank})}</label>`).join("")}</div>`;
}
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
  $("scheduleList").innerHTML=state.schedules.map(s=>`<div class="schedule-row ${s.id===state.activeScheduleId?"active":""}" data-schedule="${s.id}"><strong>${esc(s.sourceName||s.name)}</strong><small>Data date ${isoDate(s.dataDate)||"—"} · ${s.activities.length} activities</small></div>`).join("")||`<div class="muted">No XER/XML/MPP schedules parsed.</div>`;
  $("scheduleList").querySelectorAll("[data-schedule]").forEach(x=>x.onclick=()=>{state.activeScheduleId=x.dataset.schedule;const i=state.schedules.findIndex(s=>s.id===state.activeScheduleId);state.previousScheduleId=i>0?state.schedules[i-1].id:null;renderRepository();render()});
}
function render(){
  document.querySelectorAll("#tabs [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
  $("repositoryPane").style.display=noRepoViews.has(state.view)?"none":"block";
  $("workspace").classList.toggle("workspace-fixed",state.view==="notebook");
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
function requireSchedule(){const s=activeSchedule();if(!s){$("workspace").innerHTML=`${viewHead("Schedule Intelligence","Import a Primavera P6 XER, Microsoft Project XML, or MPP file into the Project Repository.")}<div class="empty-state">No schedule has been loaded.</div>`;return null}return s}
function revisionSelector(id,value){return scheduleSelector(id,value,{blank:"No comparison"})}
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
  const s=activeSchedule();
  if(!s){
    $("workspace").innerHTML=`${viewHead("Planner Dashboard","Select or import a schedule. Uploaded schedules are treated as independent unless you explicitly group them.")}<section class="panel"><h2>Revision lineage</h2><p class="muted">Choose schedules below only when you want to treat them as a revision chain. No relationship between uploaded schedules is assumed.</p>${scheduleSlots("dashLineage",state.dashboardLineageIds,5,{label:"Schedule"})}</section>`;
    bindDashboardLineage();return;
  }
  const filtered=filteredSchedule(),summary=scheduleSummary(filtered),health=scheduleHealth(filtered),inbox=plannerInbox(null,filtered),dc=dataCentreReadiness(filtered),milestones=filtered.activities.filter(a=>a.milestone).slice(0,12);
  const lineageSchedules=state.dashboardLineageIds.map(scheduleById).filter(Boolean),confidenceSchedules=lineageSchedules.length?lineageSchedules:[filtered],conf=forecastConfidence(confidenceSchedules);
  const lineageRows=lineageSchedules.map((x,i)=>[esc(scheduleLabel(x)),isoDate(x.dataDate),i?`${daysBetween(lineageSchedules[i-1].dataDate,x.dataDate)}d`:"—",x.activities.length,`${scheduleSummary(x).progress.toFixed(1)}%`,scheduleSummary(x).forecastFinish||"—"]);
  $("workspace").innerHTML=`${viewHead("Planner Dashboard","Daily project-controls position, forecast confidence and attention items")}
  ${filterBar()}
  <div class="metrics">${metric("Schedule health",`${health.score}/100`,health.label)}${metric("Progress",`${summary.progress.toFixed(1)}%`,"Activity weighted")}${metric("Forecast finish",summary.forecastFinish||"—","Current programme")}${metric("Critical",summary.critical,"Critical / zero float")}${metric("Negative float",summary.negativeFloat,"Activities")}${metric("Forecast confidence",`${conf.score}%`,conf.label,"Confidence uses only the schedules explicitly selected in Revision Lineage. If none are selected, only the active schedule is used.")}</div>
  <div class="grid grid2">
    <section class="panel"><h2>Planner's Inbox</h2><div class="inbox">${inbox.length?inbox.map(x=>`<div class="inbox-item ${x.severity}"><strong>${esc(x.category)}</strong> · ${esc(x.text)}</div>`).join(""):`<div class="muted">No major deterministic alerts.</div>`}</div></section>
    <section class="panel"><h2>Readiness</h2>${table(["Stage","Activities","Complete","Progress","Critical"],dc.map(x=>[x.stage,x.activities,x.complete,`${x.progress.toFixed(1)}%`,x.critical]))}</section>
    <section class="panel"><h2>Key milestones</h2>${table(["Milestone","Forecast","Float","Status"],milestones.map(a=>[`${esc(a.id)} · ${esc(a.name)}`,isoDate(a.currentFinish||a.finish),a.totalFloat.toFixed(1),badge(a.status,a.critical?"danger":"")]))}</section>
    <section class="panel"><h2>Revision Lineage</h2><p class="muted">Each slot is independent. Select only schedules that you intentionally want to analyse as one revision sequence; files from different projects can remain unselected.</p>${scheduleSlots("dashLineage",state.dashboardLineageIds,5,{label:"Schedule"})}<div style="margin-top:10px">${table(["Selected revision","Data date","Gap from prior","Activities","Progress","Forecast finish"],lineageRows)}</div></section>
  </div>`;
  bindFilters();bindDashboardLineage();
}
function bindDashboardLineage(){
  state.dashboardLineageIds.forEach((_,i)=>$("dashLineage"+i)?.addEventListener("change",e=>{state.dashboardLineageIds[i]=e.target.value;renderDashboard()}));
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
  $("chatInput").addEventListener("keydown",e=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chatSend").click()}
  });
}
function renderContracts(){
  $("workspace").innerHTML=chatMarkup("contracts","Contract Manager","Evidence-grounded contract and project-controls review using checked repository files.","Contract Analyst");
  bindChat("contracts","Contract Analyst");
}
function notebookChatPanel(){
  const hist=state.chats.notebook||[];
  return `<section class="panel chat notebook-chat"><div class="messages" id="messages">${hist.map(m=>`<div class="msg ${m.role==="user"?"user":""}">${esc(m.content)}${m.sources?.length?`<div style="margin-top:7px;font-size:9px;opacity:.75">Evidence: ${m.sources.slice(0,8).map(s=>esc(s.name)).join(" · ")}${m.structuredTool?` · Tool: ${esc(m.structuredTool)}`:""}</div>`:""}</div>`).join("")||`<div class="muted">Checked Project Repository files are available as context.</div>`}</div><div class="chatbox"><select id="chatRole">${roles.map(r=>`<option ${r==="Project Controls Manager"?"selected":""}>${r}</option>`).join("")}</select><textarea id="chatInput" placeholder="Ask about the current project…"></textarea><button id="chatSend">Send</button></div></section>`;
}
function notebookReportMarkup(customPrompt="",aiText=""){
  const s=activeSchedule(),files=state.files.filter(f=>f.checked),summary=s?scheduleSummary(s):null,n=s?scheduleNarrative(s,null):null;
  return `<h1>Project Controls Notebook Report</h1><p>Generated ${new Date().toLocaleString()}</p>${customPrompt?`<p><strong>Requested focus:</strong> ${esc(customPrompt)}</p>`:""}<h2>Source set</h2><p>${files.length} checked repository file(s)${s?` and schedule <strong>${esc(scheduleLabel(s))}</strong>`:""}.</p>${s?`<h2>Schedule overview</h2><ul><li>Activities: ${summary.activities}</li><li>Progress: ${summary.progress.toFixed(1)}%</li><li>Forecast finish: ${esc(summary.forecastFinish||"—")}</li><li>Critical / zero float: ${summary.critical}</li><li>Negative float: ${summary.negativeFloat}</li></ul><h2>Schedule narrative</h2>${n.paragraphs.map(x=>`<p>${esc(x)}</p>`).join("")}`:`<p>No active schedule is selected.</p>`}${aiText?`<h2>Custom analysis</h2>${String(aiText).split(/\n{2,}/).map(x=>`<p>${esc(x)}</p>`).join("")}`:""}<h2>Repository files</h2><ul>${files.map(f=>`<li>${esc(f.name)} · ${esc(f.category)} · ${Math.round((f.size||0)/1024)} KB</li>`).join("")||"<li>No checked files.</li>"}</ul>`;
}
function notebookGraphicSvg(customPrompt=""){
  const s=activeSchedule(),sum=s?scheduleSummary(s):null,h=s?scheduleHealth(s):null,q=String(customPrompt||"").toLowerCase();
  let vals,labels,title="Project Controls Summary",suffix="%",max=100;
  if(s&&/(cost|budget|earned value|evm)/.test(q)){
    const a=s.activities||[],budget=a.reduce((n,x)=>n+(Number(x.budgetCost)||0),0),actual=a.reduce((n,x)=>n+(Number(x.actualCost)||0),0),remaining=a.reduce((n,x)=>n+(Number(x.remainingCost)||0),0);
    vals=[budget,actual,remaining];labels=["Budget cost","Actual cost","Remaining cost"];title="Cost Summary";suffix="";max=Math.max(1,...vals);
  }else if(s&&/(resource|man.?hour|unit|labour|labor)/.test(q)){
    const a=s.activities||[],budget=a.reduce((n,x)=>n+(Number(x.budgetUnits)||0),0),actual=a.reduce((n,x)=>n+(Number(x.actualUnits)||0),0),remaining=a.reduce((n,x)=>n+(Number(x.remainingUnits)||0),0);
    vals=[budget,actual,remaining];labels=["Budget units","Actual units","Remaining units"];title="Resource / Unit Summary";suffix="";max=Math.max(1,...vals);
  }else{
    vals=sum?[sum.progress,Math.min(100,h.score),Math.min(100,sum.activities?sum.critical/sum.activities*100:0),Math.min(100,sum.activities?sum.negativeFloat/sum.activities*100:0)]:[0,0,0,0];
    labels=["Progress","Health","Critical %","Negative float %"];
  }
  const w=900,hg=360,count=Math.max(1,vals.length),gap=46,bw=Math.min(150,(760-gap*(count-1))/count);
  const bars=vals.map((v,i)=>{const x=80+i*(bw+gap),bh=Math.max(2,Number(v||0)/max*210),y=285-bh,display=suffix?`${Number(v||0).toFixed(1)}${suffix}`:Number(v||0).toLocaleString(undefined,{maximumFractionDigits:1});return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="currentColor" opacity="${Math.max(.45,.95-i*.12)}"/><text x="${x+bw/2}" y="${y-10}" text-anchor="middle" fill="currentColor" font-size="16">${esc(display)}</text><text x="${x+bw/2}" y="322" text-anchor="middle" fill="currentColor" font-size="14">${esc(labels[i])}</text>`}).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hg}" width="${w}" height="${hg}"><rect width="100%" height="100%" fill="white"/><g color="#173b57"><text x="40" y="40" font-family="Segoe UI,Arial" font-size="24" font-weight="700" fill="currentColor">${esc(title)}</text><text x="40" y="66" font-family="Segoe UI,Arial" font-size="12" fill="currentColor">${esc(s?scheduleLabel(s):"No active schedule")}${customPrompt?` · Focus: ${esc(customPrompt)}`:""}</text>${bars}</g></svg>`;
}
function notebookAudioScript(customPrompt="",aiText=""){
  const s=activeSchedule();if(!s)return "No active schedule is selected. Select a schedule to generate an audio brief.";
  if(aiText)return String(aiText);
  const n=scheduleNarrative(s,null);return `Project controls audio brief${customPrompt?` focused on ${customPrompt}`:""}. ${n.paragraphs.join(" ")}`;
}
function notebookDataCsv(customPrompt=""){
  const s=activeSchedule(),q=String(customPrompt||"").toLowerCase();let acts=[...(s?.activities||[])];
  if(/critical|zero float/.test(q))acts=acts.filter(a=>a.critical||Number(a.totalFloat)<=0);
  if(/negative float/.test(q))acts=acts.filter(a=>Number(a.totalFloat)<0);
  if(/in progress/.test(q))acts=acts.filter(a=>a.status==="In Progress");
  if(/not started/.test(q))acts=acts.filter(a=>a.status==="Not Started");
  if(/complete/.test(q)&&!/not complete/.test(q))acts=acts.filter(a=>a.status==="Complete");
  const m=customPrompt.match(/wbs\s*:\s*([^,;]+)/i);if(m)acts=acts.filter(a=>String(a.wbsPath||"").toLowerCase().includes(m[1].trim().toLowerCase()));
  const rows=acts.map(a=>[a.id,a.name,a.wbsPath,a.status,isoDate(a.currentStart||a.start),isoDate(a.currentFinish||a.finish),a.originalDuration,a.remainingDuration,a.totalFloat,a.percent,a.budgetUnits,a.actualUnits,a.remainingUnits,a.budgetCost,a.actualCost,a.remainingCost]);
  return toCSV(["ID","Activity","WBS","Status","Start","Finish","Original duration","Remaining duration","Total float","Percent","Budget units","Actual units","Remaining units","Budget cost","Actual cost","Remaining cost"],rows);
}
function notebookOutputCard(type,title,description,actions=""){
  const out=state.notebookOutputs?.[type],preview=out?.preview||"";
  return `<section class="notebook-output-card" data-output-card="${type}"><div class="output-card-head"><div><strong>${esc(title)}</strong><small>${esc(description)}</small></div><button class="btn primary compact" data-nb-create="${type}">Create / customise</button></div>${actions}<div class="output-card-preview" id="nb-${type}-preview">${preview}</div></section>`;
}
async function generateNotebookOutput(type){
  const defaults={report:"Focus the report on the most important schedule health, progress, forecast and management issues.",graphic:"Show the most useful project-controls summary graphic.",data:"Export the activities most useful for the current review. You can use terms such as critical, negative float, in progress, or WBS: <name>.",audio:"Create a concise executive audio briefing covering status, forecast, risks and next actions."};
  const promptText=window.prompt(`Customise this ${type} output:`,state.notebookOutputs?.[type]?.prompt||defaults[type]||"");
  if(promptText===null)return;
  state.notebookOutputs??={};
  let aiText="";
  if((type==="report"||type==="audio")&&preferredAI()!=="none"){
    try{
      const request=type==="report"?`Create a professional project-controls report section. Custom instruction: ${promptText}`:`Create a concise spoken project-controls briefing. Custom instruction: ${promptText}`;
      const out=await askAI({question:request,role:"Project Controls Manager",current:activeSchedule(),previous:null,revisions:state.schedules,history:[]});aiText=out.text||"";
    }catch(e){aiText=`AI customisation was unavailable (${e.message}). Deterministic schedule content is shown instead.`}
  }
  if(type==="report"){
    const body=notebookReportMarkup(promptText,aiText),html=`<!doctype html><html><head><meta charset="utf-8"><title>Project Controls Notebook Report</title><style>body{font-family:Segoe UI,Arial;max-width:1100px;margin:40px auto;padding:0 24px;line-height:1.5}</style></head><body>${body}</body></html>`;
    state.notebookOutputs.report={prompt:promptText,content:html,preview:`<div class="output-preview report-mini">${body}</div>`};
  }else if(type==="graphic"){
    const svg=notebookGraphicSvg(promptText);state.notebookOutputs.graphic={prompt:promptText,content:svg,preview:`<div class="output-preview graphic-mini">${svg}</div>`};
  }else if(type==="data"){
    const csv=notebookDataCsv(promptText),lines=csv.split(/\r?\n/).filter(Boolean);state.notebookOutputs.data={prompt:promptText,content:csv,preview:`<div class="output-preview"><strong>${Math.max(0,lines.length-1)} activity rows</strong><small>${esc(promptText)}</small></div>`};
  }else if(type==="audio"){
    const text=notebookAudioScript(promptText,aiText);state.notebookOutputs.audio={prompt:promptText,content:text,preview:`<div class="output-preview"><pre>${esc(text)}</pre></div>`};
  }
  renderNotebook();
}
function renderNotebook(){
  const reportActions=state.notebookOutputs?.report?`<div class="output-actions"><button class="btn" data-nb-download="report">Download HTML</button></div>`:"";
  const graphicActions=state.notebookOutputs?.graphic?`<div class="output-actions"><button class="btn" data-nb-download="graphic">Download SVG</button></div>`:"";
  const dataActions=state.notebookOutputs?.data?`<div class="output-actions"><button class="btn" data-nb-download="data">Download CSV</button></div>`:"";
  const audioActions=state.notebookOutputs?.audio?`<div class="output-actions"><button class="btn" id="nbListenAudio">Listen</button><button class="btn" data-nb-download="audio">Download script</button></div>`:"";
  $("workspace").innerHTML=`${viewHead("NotebookLM+","Chat with project context while creating customised downloadable outputs in the right-hand studio.")}<div class="notebook-layout"><div class="notebook-chat-column">${notebookChatPanel()}</div><aside class="notebook-output-pane"><div class="output-pane-head"><h2>Outputs</h2><p>Click an output and describe exactly what you want it to contain.</p></div>${notebookOutputCard("report","Report","Customisable project-controls HTML report",reportActions)}${notebookOutputCard("graphic","Graphic","Prompt-directed SVG project graphic",graphicActions)}${notebookOutputCard("data","Data extract","Filtered activity data for further analysis",dataActions)}${notebookOutputCard("audio","Audio brief","Customisable briefing script with local playback",audioActions)}</aside></div>`;
  bindChat("notebook","Project Controls Manager");
  document.querySelectorAll("[data-nb-create]").forEach(b=>b.onclick=()=>generateNotebookOutput(b.dataset.nbCreate));
  document.querySelectorAll("[data-nb-download]").forEach(b=>b.onclick=()=>{const type=b.dataset.nbDownload,out=state.notebookOutputs?.[type];if(!out)return;const cfg={report:["text/html","notebook-project-controls-report.html"],graphic:["image/svg+xml","notebook-project-graphic.svg"],data:["text/csv","notebook-activity-data.csv"],audio:["text/plain","notebook-audio-brief.txt"]}[type];downloadBlob(new Blob([out.content],{type:cfg[0]}),cfg[1])});
  $("nbListenAudio")?.addEventListener("click",()=>{if(!("speechSynthesis" in window)){alert("This browser does not expose speech synthesis.");return}speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(state.notebookOutputs?.audio?.content||""))});
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
  const items=[["overview","Overview"],["activities","Activity Register"],["comparison","Schedule Comparison"],["week","Week-on-Week"],["critical","Critical Path"],["logic","Logic & Health"],["dcma","DCMA-style Check"],["whymove","Why Date Moved"],["delay","Delay Analysis"],["forensic","Forensic Review"],["calendar","Calendar Analyser"],["scurve","S-Curve & Histogram"],["forecast","Forecast Confidence"],["narrative","Schedule Narrative"],["gantt","WBS / Gantt"],["network","Nodes"],["timemachine","Time Machine"],["milestones","Milestone Control"],["resources","Resources & EVM"],["cost","Cost Report"],["baseline","Baseline & Lookahead"],["datacentre","Data-Centre Mode"]];
  return `<div class="report-nav">${items.map(([id,l])=>`<button data-report="${id}" class="${state.assessmentReport===id?"active":""}">${l}</button>`).join("")}</div>`;
}
function renderAssessment(){
  const fs=filteredSchedule(),independent=new Set(["comparison","week","delay","forensic","baseline","timemachine"]).has(state.assessmentReport);
  const filterMarkup=independent?"":fs?filterBar():`<div class="filterbar muted">No active schedule is selected. Comparison-oriented reports still work once schedules are selected in their own dropdowns.</div>`;
  $("workspace").innerHTML=`${viewHead("Schedule Assessment","Primavera P6 / Microsoft Project schedule intelligence, QA, comparison and forensic analysis",`<button class="btn" id="exportReportCsv">Export table CSV</button><button class="btn" id="printReport">Print / PDF</button>`)}${filterMarkup}${assessmentNav()}<div id="reportBody">${assessmentReport(fs)}</div>`;
  if(fs&&!independent)bindFilters();document.querySelectorAll("[data-report]").forEach(b=>b.onclick=()=>{state.assessmentReport=b.dataset.report;renderAssessment()});$("printReport").onclick=()=>window.print();$("exportReportCsv").onclick=()=>exportVisibleTables();bindAssessmentControls(fs);
}
function pairToolbar(prefix,a,b,{labelA="Schedule A / reference",labelB="Schedule B / comparison"}={}){
  return `<div class="filterbar comparison-selectors"><label>${esc(labelA)} ${scheduleSelector(prefix+"A",a,{blank:"Select schedule A…"})}</label><label>${esc(labelB)} ${scheduleSelector(prefix+"B",b,{blank:"Select schedule B…"})}</label></div>`;
}
function scheduleSelectionMessage(text="Select the schedules to analyse. No relationship between uploaded files is assumed."){return `<div class="empty-state">${esc(text)}</div>`}
function deletedText(value){return `<span class="deleted-change">${esc(value)}</span>`}
function calendarLabel(c){return [c?.name||c?.id,c?.hoursPerDay?`${Number(c.hoursPerDay).toFixed(1)}h/day`:"",c?.hoursPerWeek?`${Number(c.hoursPerWeek).toFixed(1)}h/week`:""].filter(Boolean).join(" · ")}
function resourceLabel(r){return [r?.name||r?.id,r?.type||r?.raw?.rsrc_type].filter(Boolean).join(" · ")}
function topBand(path){return String(path||"Unassigned WBS").split(" / ")[0]||"Unassigned WBS"}
function healthDefinition(name){
  const defs={
    "Missing logic":"Share of activities with no predecessor and/or no successor. Excessive open ends weaken CPM integrity and can hide the real driving path.",
    "Logic density":"Average relationships per activity. Very low density can indicate under-developed logic; unusually high density can make the network difficult to maintain.",
    "Hard/soft constraints":"Share of activities carrying date constraints. Constraints can override network logic and should be justified and controlled.",
    "Long durations":"Share of activities with original durations greater than 44 days. Long activities reduce control granularity and can conceal slippage.",
    "High float":"Share of activities with more than 44 days total float. High float can indicate weak logic, broad calendars or disconnected work.",
    "Negative float":"Share of activities with total float below zero, indicating dates later than a required/contractual constraint or other schedule pressure.",
    "Leads":"Relationships with negative lag. Leads can obscure logic intent and are discouraged in robust CPM schedules.",
    "Lags":"Relationships with positive lag. Excessive lag can hide work that is better modelled as an activity.",
    "Cycles":"Circular logic loops. CPM networks should be acyclic; a cycle prevents a clean forward/backward pass."
  };return defs[name]||"Schedule health diagnostic.";
}
function resourceChangeSummary(previous,current){
  const sig=s=>{const m=new Map();for(const x of s?.assignments||[]){const k=`${x.activityId}|${x.resourceId}`,v={budget:Number(x.target_qty||x.budgetUnits||0),actual:Number(x.act_reg_qty||x.actualUnits||0),remaining:Number(x.remain_qty||x.remainingUnits||0),cost:Number(x.target_cost||x.budgetCost||0)};const old=m.get(k)||{budget:0,actual:0,remaining:0,cost:0};m.set(k,{budget:old.budget+v.budget,actual:old.actual+v.actual,remaining:old.remaining+v.remaining,cost:old.cost+v.cost})}return m},p=sig(previous),c=sig(current);let added=0,removed=0,changed=0;const details=[];
  for(const [k,v] of c){if(!p.has(k)){added++;details.push({type:"Added",key:k})}else{const o=p.get(k);if(["budget","actual","remaining","cost"].some(f=>Math.abs((v[f]||0)-(o[f]||0))>1e-9)){changed++;details.push({type:"Changed",key:k})}}}for(const [k] of p)if(!c.has(k)){removed++;details.push({type:"Removed",key:k})}
  return {added,removed,changed,details};
}
function dcmaVisualCard(c,index){
  const isCount=c.name==="Cycles",actual=isCount?Number(c.count||0):Number(c.rateNum||0),threshold=isCount?0:Number(c.limitNum||0);
  const scaleMax=isCount?Math.max(5,actual*1.25,1):Math.min(100,Math.max(10,actual*1.2,threshold*2.2,threshold+5));
  const actualPct=Math.max(0,Math.min(100,actual/Math.max(scaleMax,.0001)*100)),thresholdPct=Math.max(0,Math.min(100,threshold/Math.max(scaleMax,.0001)*100));
  const unit=isCount?"":"%",direction=isCount?"Target 0 cycles":`Threshold ≤ ${Number(threshold).toFixed(threshold<1?2:1)}%`;
  return `<div class="quality-card threshold-card" title="${esc(c.definition)}"><div><strong>${esc(c.name)}</strong>${c.pass?badge("PASS","good"):badge("FAIL","danger")}</div><div class="threshold-chart" aria-label="${esc(c.name)} actual versus threshold"><div class="threshold-track"><span class="threshold-safe" style="width:${thresholdPct}%"></span><span class="threshold-actual ${c.pass?"pass":"fail"}" style="left:${actualPct}%"></span><i class="threshold-marker" style="left:${thresholdPct}%" title="Threshold ${threshold}${unit}"></i></div><div class="threshold-labels"><span>0${unit}</span><strong>Actual ${actual.toFixed(isCount?0:1)}${unit}</strong><span>${scaleMax.toFixed(isCount?0:1)}${unit}</span></div></div><small>${esc(direction)} · ${esc(c.definition)}</small></div>`;
}
function wbsDelayRows(comp,current){
  const map=new Map();for(const x of comp.changed.filter(x=>x.finishDays>0)){const a=current.activities.find(a=>a.id===x.id),k=topBand(a?.wbsPath);if(!map.has(k))map.set(k,{label:k,count:0,totalSlip:0,maxSlip:0});const r=map.get(k);r.count++;r.totalSlip+=x.finishDays;r.maxSlip=Math.max(r.maxSlip,x.finishDays)}return [...map.values()].sort((a,b)=>b.totalSlip-a.totalSlip);
}
function lookaheadDetailMarkup(schedule){
  const look=fourWeekLookahead(schedule),dd=parseDate(schedule.dataDate)||new Date(),end=addDays(dd,28),acts=(schedule.activities||[]).filter(a=>{const st=parseDate(a.currentStart||a.start),fn=parseDate(a.currentFinish||a.finish);return Number(a.percent||0)<100&&((st&&st>=dd&&st<=end)||(fn&&fn>=dd&&fn<=end))});const groups=new Map();for(const a of acts){const k=a.wbsPath||"Unassigned WBS";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a)}
  const details=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([wbs,list])=>`<details class="lookahead-wbs" open><summary>${esc(wbs)} <small>${list.length} activities</small></summary>${table(["Activity","Status","Start","Finish","TF","Progress","Critical"],list.sort((a,b)=>(parseDate(a.currentStart||a.start)?.getTime()||0)-(parseDate(b.currentStart||b.start)?.getTime()||0)).map(a=>[`${esc(a.id)} · ${esc(a.name)}`,esc(a.status),isoDate(a.currentStart||a.start),isoDate(a.currentFinish||a.finish),Number(a.totalFloat||0).toFixed(1),`${Number(a.percent||0).toFixed(1)}%`,a.critical||a.totalFloat<=0?badge("Yes","danger"):"No"]))}</details>`).join("");
  return `<div class="metrics">${look.map(w=>metric(`Week ${w.week}`,`${w.starts.length} starts`,`${w.finishes.length} finishes · ${w.criticalStarts.length} critical starts`)).join("")}</div>${details||`<div class="empty-state">No incomplete activities fall within the next four weeks.</div>`}`;
}
function narrativeActivityDetailMarkup(schedule){
  const acts=[...(schedule?.activities||[])].sort((a,b)=>String(a.wbsPath||"").localeCompare(String(b.wbsPath||""))||String(a.id).localeCompare(String(b.id)));
  const cell=(value,critical)=>critical?`<span class="critical-text">${value}</span>`:value;
  const rows=acts.map(a=>{const critical=Boolean(a.critical||Number(a.totalFloat)<=0),vals=[`${esc(a.id)} · ${esc(a.name)}`,esc(a.wbsPath||"—"),esc(a.status||"—"),isoDate(a.currentStart||a.start)||"—",isoDate(a.currentFinish||a.finish)||"—",Number(a.originalDuration||0).toFixed(1),Number(a.remainingDuration||0).toFixed(1),Number(a.totalFloat||0).toFixed(1),`${Number(a.percent||0).toFixed(1)}%`,Number(a.budgetUnits||0).toFixed(1),Number(a.remainingUnits||0).toFixed(1)];return vals.map(v=>cell(v,critical))});
  return `<details class="narrative-activity-detail"><summary>Activity detail · ${acts.length} activities <span class="muted">(critical / zero-float activities are red)</span></summary>${table(["Activity","WBS","Status","Start","Finish","OD","RD","TF","Progress","Budget units","Remaining units"],rows)}</details>`;
}
function assessmentNeedsSchedule(){return !new Set(["comparison","week","delay","forensic","baseline","timemachine"]).has(state.assessmentReport)}
function assessmentReport(s){
  if(!s&&assessmentNeedsSchedule())return `<section class="panel"><h2>${esc(state.assessmentReport==="overview"?"Schedule Assessment":"Select a schedule")}</h2><p class="muted">Choose a parsed schedule in the left pane. Schedule Comparison, Week-on-Week, Delay Analysis, Forensic Review and Baseline & Lookahead have their own independent schedule selectors and can be opened without an active schedule.</p></section>`;
  const h=s?scheduleHealth(s):null;
  switch(state.assessmentReport){
    case"activities":return `<section class="panel"><h2>Virtualised activity register</h2><p class="muted">Drag the vertical dividers in the column headings to resize each column. Widths are remembered on this browser. Imported XER/XML/MPP data can be copied into the editable Schedule Builder.</p><div class="actions" style="margin-bottom:9px"><button class="btn" id="copyToBuilder">Edit this schedule in Schedule Builder</button></div><div id="virtualActivities" style="height:600px;overflow:auto;position:relative"></div></section>`;
    case"comparison":{
      const a=scheduleById(state.comparisonAId),b=scheduleById(state.comparisonBId),toolbar=pairToolbar("comparison",state.comparisonAId,state.comparisonBId,{labelA:"Reference schedule",labelB:"Comparison schedule"});
      if(!a||!b)return `<section class="panel"><h2>Schedule Comparison</h2><p class="muted">Select the two schedules explicitly. They may be unrelated projects; the toolkit will not infer a revision relationship.</p>${toolbar}${scheduleSelectionMessage()}</section>`;
      if(a.id===b.id)return `<section class="panel"><h2>Schedule Comparison</h2>${toolbar}<div class="empty-state">Choose two different schedules.</div></section>`;
      const comp=compareSchedules(a,b),changeRows=comp.changed.slice().sort((x,y)=>Math.abs(y.finishDays)-Math.abs(x.finishDays)),projectWarning=(a.projectName&&b.projectName&&a.projectName!==b.projectName)?`<div class="analysis-warning">The selected schedules report different project names: <strong>${esc(a.projectName)}</strong> and <strong>${esc(b.projectName)}</strong>. Comparison is still allowed because you selected them explicitly.</div>`:"";
      const resourceName=(schedule,id)=>schedule.resources?.find(r=>String(r.id)===String(id))?.name||id||"Unassigned resource";
      const assignmentLabel=(schedule,x)=>`${esc(x.activityId||"—")} · ${esc(resourceName(schedule,x.resourceId))}`;
      const assignmentValue=x=>`B ${Number(x.budget||0).toFixed(1)} · A ${Number(x.actual||0).toFixed(1)} · R ${Number(x.remaining||0).toFixed(1)}`;
      const activityRows=[...comp.added.slice(0,250).map(x=>["Added",`${esc(x.id)} · ${esc(x.name)}`]),...comp.deleted.slice(0,250).map(x=>[deletedText("Deleted"),deletedText(`${x.id} · ${x.name}`)])];
      const relationshipRows=[...comp.relationshipAdded.slice(0,250).map(r=>["Added",`${esc(r.predId)} ${esc(r.type)} ${esc(r.succId)}`,`${Number(r.lag||0).toFixed(1)}d`]),...comp.relationshipDeleted.slice(0,250).map(r=>[deletedText("Deleted"),deletedText(`${r.predId} ${r.type} ${r.succId}`),deletedText(`${Number(r.lag||0).toFixed(1)}d`)])];
      const calendarRows=[...comp.calendars.added.map(c=>["Added",esc(c.name||c.id),"—",esc(calendarLabel(c))]),...comp.calendars.changed.map(x=>["Changed",esc(x.after.name||x.after.id),esc(calendarLabel(x.before)),esc(calendarLabel(x.after))]),...comp.calendars.deleted.map(c=>[deletedText("Deleted"),deletedText(c.name||c.id),deletedText(calendarLabel(c)),deletedText("—")])];
      const resourceRows=[...comp.resources.added.map(r=>["Added",esc(r.name||r.id),"—",esc(resourceLabel(r))]),...comp.resources.changed.map(x=>["Changed",esc(x.after.name||x.after.id),esc(resourceLabel(x.before)),esc(resourceLabel(x.after))]),...comp.resources.deleted.map(r=>[deletedText("Deleted"),deletedText(r.name||r.id),deletedText(resourceLabel(r)),deletedText("—")])];
      const assignmentRows=[...comp.resourceAssignments.added.map(x=>["Added",assignmentLabel(b,x),"—",assignmentValue(x)]),...comp.resourceAssignments.changed.map(x=>["Changed",assignmentLabel(b,x.after),assignmentValue(x.before),assignmentValue(x.after)]),...comp.resourceAssignments.deleted.map(x=>[deletedText("Deleted"),deletedText(`${x.activityId} · ${resourceName(a,x.resourceId)}`),deletedText(assignmentValue(x)),deletedText("—")])];
      return `<section class="panel"><h2>Schedule Comparison</h2>${toolbar}${projectWarning}<p class="muted">Comparison includes activities, relationships, calendar definitions/assignments, resource master data and activity-resource loading. Deleted items are shown in red.</p></section>
      <div class="metrics">${metric("Data date interval",`${comp.summary.dataDateDays}d`)}${metric("Forecast movement",`${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays}d`)}${metric("Progress movement",`${comp.summary.progressPoints>=0?"+":""}${comp.summary.progressPoints.toFixed(1)} pts`)}${metric("Activities + / -",`${comp.added.length} / ${comp.deleted.length}`)}${metric("Logic + / -",`${comp.relationshipAdded.length} / ${comp.relationshipDeleted.length}`)}${metric("Calendars + / Δ / -",`${comp.calendars.added.length} / ${comp.calendars.changed.length} / ${comp.calendars.deleted.length}`)}${metric("Resources + / Δ / -",`${comp.resources.added.length} / ${comp.resources.changed.length} / ${comp.resources.deleted.length}`)}${metric("Assignments + / Δ / -",`${comp.resourceAssignments.added.length} / ${comp.resourceAssignments.changed.length} / ${comp.resourceAssignments.deleted.length}`)}${metric("Critical entered / left",`${comp.migration.entered.length} / ${comp.migration.left.length}`)}</div>
      <section class="panel"><h2>Material Change Register</h2>${table(["Activity","Start Δ","Finish Δ","Duration Δ","Float Δ","Progress Δ","Calendar","Resources","Constraint"],changeRows.slice(0,750).map(x=>[`${esc(x.id)} · ${esc(x.name)}`,`${x.startDays>=0?"+":""}${x.startDays}d`,`${x.finishDays>=0?"+":""}${x.finishDays}d`,`${x.durationDays>=0?"+":""}${x.durationDays.toFixed(1)}d`,`${x.floatDays>=0?"+":""}${x.floatDays.toFixed(1)}d`,`${x.progressPoints>=0?"+":""}${x.progressPoints.toFixed(1)} pts`,x.calendarChanged?"Changed":"—",x.resourceChanged?"Changed":"—",x.constraintChanged?"Changed":"—"]))}</section>
      <div class="grid grid2"><section class="panel"><h2>New / deleted activities</h2>${table(["Type","Activity"],activityRows)}</section><section class="panel"><h2>Relationship changes</h2>${table(["Type","Relationship","Lag"],relationshipRows)}</section></div>
      <div class="grid grid2"><section class="panel"><h2>Calendar changes</h2><p class="muted">Detects added/deleted calendars and changes to working-hour/calendar-definition fields available in the imported source.</p>${table(["Type","Calendar","Reference","Comparison"],calendarRows)}</section><section class="panel"><h2>Resource master changes</h2><p class="muted">Detects additions, deletions and changes in imported resource master data.</p>${table(["Type","Resource","Reference","Comparison"],resourceRows)}</section></div>
      <section class="panel"><h2>Activity-resource assignment / loading changes</h2><p class="muted">B = budget/target units, A = actual units, R = remaining units.</p>${table(["Type","Activity · Resource","Reference","Comparison"],assignmentRows.slice(0,1000))}</section>`;
    }
    case"week":{
      const a=scheduleById(state.weekAId),b=scheduleById(state.weekBId),toolbar=pairToolbar("week",state.weekAId,state.weekBId,{labelA:"Earlier / reference schedule",labelB:"Later / status schedule"});if(!a||!b)return `<section class="panel"><h2>Week-on-Week</h2><p class="muted">Select the two status files you intend to compare. Nothing is inferred from upload order.</p>${toolbar}${scheduleSelectionMessage()}</section>`;if(a.id===b.id)return `<section class="panel"><h2>Week-on-Week</h2>${toolbar}<div class="empty-state">Choose two different schedules.</div></section>`;
      const comp=compareSchedules(a,b),pmap=new Map(a.activities.map(x=>[x.id,x])),starts=[],finishes=[],progressed=[],slipped=[];for(const x of b.activities){const p=pmap.get(x.id);if(!p)continue;if(!p.actualStart&&x.actualStart)starts.push(x);if(Number(p.percent)<100&&Number(x.percent)>=100)finishes.push(x);if(Number(x.percent)>Number(p.percent))progressed.push({a:x,delta:Number(x.percent)-Number(p.percent)});const mv=daysBetween(p.currentFinish||p.finish,x.currentFinish||x.finish);if(mv>0)slipped.push({a:x,delta:mv})}slipped.sort((x,y)=>y.delta-x.delta);progressed.sort((x,y)=>y.delta-x.delta);
      return `<section class="panel"><h2>Week-on-Week</h2>${toolbar}</section><div class="metrics">${metric("New actual starts",starts.length)}${metric("New completions",finishes.length)}${metric("Activities progressed",progressed.length)}${metric("Activities slipped",slipped.length)}${metric("Progress Δ",`${comp.summary.progressPoints>=0?"+":""}${comp.summary.progressPoints.toFixed(1)} pts`)}${metric("Forecast Δ",`${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays}d`)}</div><div class="grid grid2"><section class="panel"><h2>Top progress movement</h2>${table(["Activity","Progress Δ","Current %"],progressed.slice(0,150).map(x=>[`${esc(x.a.id)} · ${esc(x.a.name)}`,`+${x.delta.toFixed(1)} pts`,`${x.a.percent.toFixed(1)}%`]))}</section><section class="panel"><h2>Top forecast slippage</h2>${table(["Activity","Finish movement","Current finish"],slipped.slice(0,150).map(x=>[`${esc(x.a.id)} · ${esc(x.a.name)}`,`+${x.delta}d`,isoDate(x.a.currentFinish||x.a.finish)]))}</section></div>`;
    }
    case"critical":{
      const crit=s.activities.filter(a=>a.critical||a.totalFloat<=0);return `${gantt(s,{activities:crit,criticalOnly:true,forceRed:true,timescale:state.ganttTimescale,compression:"compact",showRelationships:state.ganttRelationships,leftWidth:state.criticalLeftWidth,resizeKey:"criticalLeftWidth",startDate:state.criticalStartDate,endDate:state.criticalFinishDate})}<section class="panel"><h2>Critical / zero-float activities</h2><p class="muted">Drag the vertical dividers in the headings to resize the table columns. The Gantt's WBS/Activity divider can also be dragged wider or narrower.</p>${table(["Activity","WBS","Finish","TF"],crit.map(a=>[`${esc(a.id)} · ${esc(a.name)}`,esc(a.wbsPath),isoDate(a.currentFinish||a.finish),a.totalFloat.toFixed(1)]),{resizable:true,resizeKey:"criticalPath"})}</section>`;
    }
    case"logic":{
      const n=networkHealth(s),oe=openEnds(s),cycles=detectCycles(s);return `<div class="metrics">${metric("Health",`${h.score}/100`,h.label,"Overall deterministic health score based on the checks shown below.")}${metric("Logic density",n.logicDensity.toFixed(2),"Relationships/activity",healthDefinition("Logic density"))}${metric("Open starts",oe.starts.length,"",healthDefinition("Missing logic"))}${metric("Open finishes",oe.finishes.length,"",healthDefinition("Missing logic"))}${metric("Cycles",cycles.length,"",healthDefinition("Cycles"))}${metric("Leads / lags",`${n.leads} / ${n.lags}`,"",`${healthDefinition("Leads")} ${healthDefinition("Lags")}`)}</div><div class="grid grid2"><section class="panel"><h2>Health checks</h2><p class="muted">Hover a check name for its definition.</p>${table(["Check","Value","Penalty"],h.checks.map(x=>[`<span class="help-term" title="${esc(healthDefinition(x.name))}">${esc(x.name)} <span class="help-dot">?</span></span>`,typeof x.value==="number"?x.value.toFixed(3):x.value,x.penalty.toFixed(1)]))}</section><section class="panel"><h2>Open ends</h2>${table(["Type","Activity"],[...oe.starts.slice(0,100).map(a=>["Open start",`${esc(a.id)} · ${esc(a.name)}`]),...oe.finishes.slice(0,100).map(a=>["Open finish",`${esc(a.id)} · ${esc(a.name)}`])])}</section></div>`;
    }
    case"dcma":{
      const net=networkHealth(s),relCount=Math.max(1,s.relationships.length),actCount=Math.max(1,s.activities.length),missingRate=(net.openStarts+net.openFinishes)/actCount*100,leadRate=net.leads/relCount*100,lagRate=net.lags/relCount*100,longCount=s.activities.filter(a=>a.originalDuration>44).length,longRate=longCount/actCount*100,highCount=s.activities.filter(a=>a.totalFloat>44).length,highRate=highCount/actCount*100,negCount=s.activities.filter(a=>a.totalFloat<0).length,negRate=negCount/actCount*100,conCount=s.activities.filter(a=>a.constraintType).length,conRate=conCount/actCount*100;
      const mk=(name,count,rateNum,guideline,limitNum,pass)=>({name,count,rateNum,rate:Number.isFinite(rateNum)?`${rateNum.toFixed(1)}%`:(pass?"Pass":"Fail"),guideline,limitNum,pass,definition:healthDefinition(name==="Constraints"?"Hard/soft constraints":name)}),checks=[mk("Missing logic",net.openStarts+net.openFinishes,missingRate,"≤5%",5,missingRate<=5),mk("Leads",net.leads,leadRate,"0%",.01,net.leads===0),mk("Lags",net.lags,lagRate,"≤5%",5,lagRate<=5),mk("Long durations",longCount,longRate,"≤5%",5,longRate<=5),mk("High float",highCount,highRate,"≤5%",5,highRate<=5),mk("Negative float",negCount,negRate,"≤2%",2,negRate<=2),mk("Constraints",conCount,conRate,"≤5%",5,conRate<=5),{name:"Cycles",count:net.cycles,rateNum:net.cycles?100:0,rate:net.cycles?"Fail":"Pass",guideline:"0",limitNum:.01,pass:net.cycles===0,definition:healthDefinition("Cycles")}];
      const rows=checks.map(c=>[c.name,c.count,c.rate,c.guideline,c.pass?badge("PASS","good"):badge("FAIL","danger")]);return `<div class="metrics">${metric("Schedule health",`${h.score}/100`,h.label)}${metric("Logic density",net.logicDensity.toFixed(2))}${metric("Open starts",net.openStarts)}${metric("Open finishes",net.openFinishes)}${metric("Cycles",net.cycles)}${metric("Duplicate relationships",net.duplicateRelationships)}</div><section class="panel"><h2>DCMA-style quality screen</h2><p class="muted">Internal DCMA-style screening, not an official DCMA certification.</p>${table(["Check","Count","Rate / result","Guideline","Pass / Fail"],rows)}</section><section class="panel"><h2>Threshold graphics</h2><p class="muted">Each visual plots the actual rate/count against the applicable acceptance threshold. The marker is the threshold; the bar is the measured result. This avoids decorative chart types that can obscure whether the schedule actually passes the check.</p><div class="quality-grid">${checks.map(dcmaVisualCard).join("")}</div></section>`;
    }
    case"delay":{
      const a=scheduleById(state.delayAId),b=scheduleById(state.delayBId),toolbar=pairToolbar("delay",state.delayAId,state.delayBId,{labelA:"Earlier / reference schedule",labelB:"Later / impact schedule"});if(!a||!b)return `<section class="panel"><h2>Delay Analysis</h2><p>This view is intended to identify where forecast dates moved between two specifically selected schedules, then rank the movement by activity/WBS and show deterministic schedule evidence such as duration, float, logic, calendar and constraint changes.</p>${toolbar}${scheduleSelectionMessage("Choose two schedules to begin. They can be unrelated, although delay conclusions are only meaningful when the activity coding is comparable.")}</section>`;if(a.id===b.id)return `<section class="panel"><h2>Delay Analysis</h2>${toolbar}<div class="empty-state">Choose two different schedules.</div></section>`;
      const comp=compareSchedules(a,b),slips=comp.changed.filter(x=>x.finishDays>0).sort((x,y)=>y.finishDays-x.finishDays),critSlips=slips.filter(x=>b.activities.find(a=>a.id===x.id)?.critical||b.activities.find(a=>a.id===x.id)?.totalFloat<=0),wbs=wbsDelayRows(comp,b);
      return `<section class="panel"><h2>Delay Analysis</h2><p class="muted">Recommended use: select a known earlier update and a later update, review project/WBS slippage, then drill into the evidence column. This is schedule movement analysis, not a contractual delay determination.</p>${toolbar}</section><div class="metrics">${metric("Slipped activities",slips.length)}${metric("Critical slipped",critSlips.length)}${metric("Forecast project Δ",`${comp.summary.forecastFinishDays>=0?"+":""}${comp.summary.forecastFinishDays}d`)}${metric("Entered critical",comp.migration.entered.length)}${metric("Logic added",comp.relationshipAdded.length)}${metric("Logic removed",comp.relationshipDeleted.length)}</div><div class="grid grid2"><section class="panel"><h2>Delay by WBS band</h2>${barChart(wbs.slice(0,20),{labelKey:"label",series:[{key:"totalSlip",label:"Total slipped days"}],xLabels:wbs.slice(0,20).map(x=>x.label),rotateLabels:true})}${table(["WBS band","Slipped activities","Total movement","Maximum activity movement"],wbs.map(x=>[esc(x.label),x.count,`${x.totalSlip}d`,`${x.maxSlip}d`]))}</section><section class="panel"><h2>Interpretation guide</h2><p>Focus first on project-finish movement and critical-path migration, then WBS concentrations, then individual activities. Large activity movements with no duration change often point toward predecessor, calendar, constraint or progress effects; duration changes are direct evidence of revised planning assumptions.</p><p class="muted">For a formal forensic assessment, reconcile these results against contemporaneous progress, change instructions, access constraints, procurement records and the contract.</p></section></div><section class="panel"><h2>Delay movement register</h2>${table(["Activity","Finish Δ","Start Δ","Duration Δ","Float Δ","Likely schedule evidence"],slips.slice(0,500).map(x=>{const ev=whyDidDateMove(a,b,x.id);return[`${esc(x.id)} · ${esc(x.name)}`,`+${x.finishDays}d`,`${x.startDays>=0?"+":""}${x.startDays}d`,`${x.durationDays>=0?"+":""}${x.durationDays.toFixed(1)}d`,`${x.floatDays>=0?"+":""}${x.floatDays.toFixed(1)}d`,esc(ev.evidence.slice(0,4).map(e=>e.cause).join("; "))]}))}</section>`;
    }
    case"forensic":{
      const selected=state.forensicScheduleIds.map(scheduleById).filter(Boolean),ordered=[...new Map(selected.map(x=>[x.id,x])).values()].sort((a,b)=>(parseDate(a.dataDate)?.getTime()||0)-(parseDate(b.dataDate)?.getTime()||0));
      const selectors=scheduleSlots("forensicSlot",state.forensicScheduleIds,10,{label:"Schedule",blank:"Not selected"});if(ordered.length<2)return `<section class="panel"><h2>Forensic Review</h2><p class="muted">Select between 2 and 10 schedules. Only the schedules you choose are included; they are then reviewed in data-date order. Use this for a revision series, not as an assumption that every uploaded XER belongs to the same project.</p>${selectors}${scheduleSelectionMessage("Select at least two schedules.")}</section>`;
      const transitions=[];const detail=[];for(let i=1;i<ordered.length;i++){const p=ordered[i-1],c=ordered[i],comp=compareSchedules(p,c),res=resourceChangeSummary(p,c);transitions.push({label:`${isoDate(p.dataDate)||i} → ${isoDate(c.dataDate)||i+1}`,from:p,to:c,addedActivities:comp.added.length,deletedActivities:comp.deleted.length,changedActivities:comp.changed.length,logicAdded:comp.relationshipAdded.length,logicRemoved:comp.relationshipDeleted.length,resourceChanges:res.added+res.removed+res.changed,finishMove:comp.summary.forecastFinishDays,criticalEntered:comp.migration.entered.length});for(const x of comp.changed.filter(x=>Math.abs(x.finishDays)>=3||Math.abs(x.durationDays)>=1||x.calendarChanged||x.constraintChanged).slice(0,150))detail.push([`${isoDate(p.dataDate)} → ${isoDate(c.dataDate)}`,`${esc(x.id)} · ${esc(x.name)}`,`${x.finishDays>=0?"+":""}${x.finishDays}d`,`${x.durationDays>=0?"+":""}${x.durationDays.toFixed(1)}d`,x.calendarChanged?"Yes":"No",x.constraintChanged?"Yes":"No"])}
      const mixed=[...new Set(ordered.map(x=>x.projectName).filter(Boolean))].length>1?`<div class="analysis-warning">You selected schedules with different project names. The tool will still compare them because the selection was explicit; interpret ID-based change results carefully.</div>`:"";
      return `<section class="panel"><h2>Forensic Review · up to 10 schedules</h2><p class="muted">The selected schedules are sorted by their data date and each adjacent pair is compared for activities, logic, resource assignments, critical-path migration and forecast movement.</p>${selectors}${mixed}</section><section class="panel"><h2>Change profile across revisions</h2>${barChart(transitions,{labelKey:"label",series:[{key:"addedActivities",label:"Activities added"},{key:"deletedActivities",label:"Activities removed"},{key:"logicAdded",label:"Logic added"},{key:"logicRemoved",label:"Logic removed"},{key:"resourceChanges",label:"Resource changes"}],xLabels:transitions.map(x=>x.label),rotateLabels:true})}</section><section class="panel"><h2>Revision-to-revision summary</h2>${table(["Transition","Finish Δ","Added activities","Removed activities","Changed activities","Logic + / -","Resource changes","Entered critical"],transitions.map(x=>[esc(x.label),`${x.finishMove>=0?"+":""}${x.finishMove}d`,x.addedActivities,x.deletedActivities,x.changedActivities,`${x.logicAdded} / ${x.logicRemoved}`,x.resourceChanges,x.criticalEntered]))}</section><section class="panel"><h2>Material activity changes</h2>${table(["Transition","Activity","Finish Δ","Duration Δ","Calendar changed","Constraint changed"],detail.slice(0,1000))}</section>`;
    }
    case"whymove":{
      const prev=previousSchedule(),id=state.whyActivityId||s.activities[0]?.id||"",x=prev&&id?whyDidDateMove(prev,s,id):null;return `<section class="panel"><h2>Why Did My Date Move?</h2><div class="filterbar"><label>Comparative programme ${revisionSelector("whyPrev",state.previousScheduleId)}</label><label>Activity <select id="whyActivity">${s.activities.slice(0,10000).map(a=>`<option value="${esc(a.id)}" ${a.id===id?"selected":""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select></label></div>${!prev?`<div class="muted">Choose a comparative programme.</div>`:x?`${metric("Finish movement",`${x.finishMovementDays>=0?"+":""}${x.finishMovementDays}d`,"Current vs comparison")} ${table(["Evidence","Impact","Confidence"],x.evidence.map(e=>[esc(e.cause),e.impactDays==null?"—":`${e.impactDays>=0?"+":""}${e.impactDays}d`,badge(e.confidence,e.confidence==="Confirmed"?"good":"warn")]))}`:""}</section>`;
    }
    case"calendar":{
      const years=projectYears(s),used=new Set(s.activities.map(a=>a.calendarId)),cals=s.calendars.filter(c=>used.has(c.id)||s.activities.some(a=>a.calendarName===c.name));return `<section class="panel"><h2>Calendar Analyser</h2><p class="muted">Non-work days are shaded red; identifiable calendar exceptions are amber. Raw P6 definitions remain preserved for audit.</p></section>${cals.map(c=>`<section class="panel"><h2>${esc(c.name)}</h2>${years.map(y=>{const cy=calendarYear(c,y);return `<div class="calendar-year"><h3>${y}</h3><div class="calendar-grid">${Array.from({length:12},(_,m)=>calendarMonth(cy,m)).join("")}</div></div>`}).join("")}</section>`).join("")||`<div class="panel muted">No assigned calendars found.</div>`}`;
    }
    case"scurve":{
      const resources=s.resources||[];if(state.scurveBasis==="resource"&&!state.scurveResourceId)state.scurveResourceId=resources[0]?.id||"";const rows=curveSeries(s,{basis:state.scurveBasis,resourceId:state.scurveResourceId}),xLabels=rows.map(r=>isoDate(r.friday)),basisLabel=state.scurveBasis==="activities"?"Activities":state.scurveBasis==="cost"?"Cost":state.scurveBasis==="resource"?`Resource: ${resources.find(r=>String(r.id)===String(state.scurveResourceId))?.name||state.scurveResourceId}`:"Loaded units / man-hours";
      const series=[{name:"Planned cumulative",values:rows.map((r,i)=>({x:i,y:r.plannedCum}))},{name:"Actual cumulative",values:rows.map((r,i)=>({x:i,y:r.actualCum}))},{name:"Forecast cumulative",values:rows.map((r,i)=>({x:i,y:r.forecastCum}))}];return `<section class="panel"><h2>S-Curve & Histogram</h2><div class="filterbar"><label>Basis <select id="scurveBasis"><option value="activities" ${state.scurveBasis==="activities"?"selected":""}>Activity count</option><option value="units" ${state.scurveBasis==="units"?"selected":""}>Loaded units / man-hours</option><option value="cost" ${state.scurveBasis==="cost"?"selected":""}>Cost</option><option value="resource" ${state.scurveBasis==="resource"?"selected":""}>Individual resource</option></select></label>${state.scurveBasis==="resource"?`<label>Resource <select id="scurveResource">${resources.map(r=>`<option value="${esc(r.id)}" ${String(r.id)===String(state.scurveResourceId)?"selected":""}>${esc(r.name||r.id)}</option>`).join("")}</select></label>`:""}<span class="muted">${esc(basisLabel)} · hover points/bars for exact values · X-axis dates are Fridays</span></div></section><section class="panel"><h2>Weekly S-Curve · ${esc(basisLabel)}</h2>${lineChart(series,{xLabels,rotateLabels:true})}</section><section class="panel"><h2>Weekly Histogram · ${esc(basisLabel)}</h2>${barChart(rows,{labelKey:"week",series:[{key:"plannedWeekly",label:"Planned"},{key:"actualWeekly",label:"Actual"},{key:"forecastWeekly",label:"Forecast"}],xLabels,rotateLabels:true})}</section><section class="panel"><h2>Weekly copyable data</h2>${table(["Week","Friday","Planned weekly","Actual weekly","Forecast weekly","Planned cumulative","Actual cumulative","Forecast cumulative"],rows.map(r=>[r.week,isoDate(r.friday),r.plannedWeekly.toFixed(2),r.actualWeekly.toFixed(2),r.forecastWeekly.toFixed(2),r.plannedCum.toFixed(2),r.actualCum.toFixed(2),r.forecastCum.toFixed(2)]))}</section>`;
    }
    case"narrative":{
      const prev=previousSchedule(),n=scheduleNarrative(s,prev),bars=n.lookahead.map(w=>`<div class="metric"><small>Week ${w.week} · ${isoDate(w.start)}</small><strong>${w.starts.length} starts</strong><small>${w.finishes.length} finishes · ${w.criticalStarts.length} critical starts</small></div>`).join("");return `<section class="panel"><div class="filterbar"><label>Optional comparison schedule ${revisionSelector("narrativePrev",state.previousScheduleId)}</label></div><h2>Executive Schedule Narrative</h2>${n.paragraphs.map(p=>`<p>${esc(p)}</p>`).join("")}<h3>Phase / WBS position</h3>${table(["Phase / top WBS","Activities","Progress","Critical","Negative float","Budget units","Remaining units"],n.phases.map(p=>[esc(p.name),p.activities,`${p.progress.toFixed(1)}%`,p.critical,p.negative,p.budgetUnits.toFixed(1),p.remainingUnits.toFixed(1)]))}<h3>Next four weeks</h3><div class="grid grid4">${bars}</div>${table(["Week","Period","Starts","Finishes","Critical starts","Key upcoming activities"],n.lookahead.map(w=>[`Week ${w.week}`,`${isoDate(w.start)} – ${isoDate(w.end)}`,w.starts.length,w.finishes.length,w.criticalStarts.length,w.starts.slice(0,8).map(a=>`${esc(a.id)} ${esc(a.name)}`).join("; ")]))}${narrativeActivityDetailMarkup(s)}</section>`;
    }
    case"gantt":return gantt(s,{timescale:state.ganttTimescale,compression:state.ganttCompression,showRelationships:state.ganttRelationships,leftWidth:state.ganttLeftWidth,resizeKey:"ganttLeftWidth",startDate:state.ganttStartDate,endDate:state.ganttFinishDate});
    case"network":{
      const conv=pathConvergence(s).slice(0,40),lp=longestPath(s);return `<section class="panel"><h2>Nodes</h2><p class="muted">The network is laid out by logical depth. Hover any node for dates, float, incoming/outgoing relationships and detected issues. Use − / + / Reset to zoom.</p>${networkGraph(s,{maxNodes:120})}</section><div class="grid grid2"><section class="panel"><h2>Network graph intelligence</h2>${metric("Longest path",`${lp.duration.toFixed(1)}d`,`${lp.path.length} activities`)}${table(["Activity","Incoming","Outgoing"],conv.map(x=>[`${esc(x.activity.id)} · ${esc(x.activity.name)}`,x.incoming,x.outgoing]))}</section><section class="panel"><h2>Trace to milestone / activity</h2><select id="traceActivity">${s.activities.filter(a=>a.milestone||a.critical).slice(0,2000).map(a=>`<option value="${esc(a.id)}" ${a.id===state.traceActivityId?"selected":""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select><div id="traceResult">${renderTrace(s)}</div></section></div>`;
    }
    case"timemachine":{
      const selected=state.timeMachineScheduleIds.map(scheduleById).filter(Boolean),ordered=[...new Map(selected.map(x=>[x.id,x])).values()].sort((a,b)=>(parseDate(a.dataDate)?.getTime()||0)-(parseDate(b.dataDate)?.getTime()||0)),source=ordered.at(-1)||null,id=state.timeActivityId||source?.activities.find(a=>a.milestone)?.id||source?.activities[0]?.id||"",hist=ordered.length&&id?activityHistory(ordered,id):[],vals=hist.map((x,i)=>({x:i,y:parseDate(x.finish)?.getTime()/86400000||0}));
      return `<section class="panel"><h2>Schedule Time Machine</h2><p><strong>Purpose:</strong> track one activity or milestone through a revision sequence to see how its forecast start, finish, float, progress and critical status changed over time. The tool uses only the schedules you explicitly select below, so unrelated projects are never automatically mixed.</p>${scheduleSlots("timeSlot",state.timeMachineScheduleIds,8,{label:"Revision",blank:"Not selected"})}${source?`<div class="filterbar" style="margin-top:10px"><label>Activity <select id="timeActivity">${source.activities.slice(0,10000).map(a=>`<option value="${esc(a.id)}" ${a.id===id?"selected":""}>${esc(a.id)} · ${esc(a.name)}</option>`).join("")}</select></label></div>${lineChart([{name:"Forecast finish (serial day)",values:vals}],{xLabels:hist.map(x=>isoDate(x.dataDate)),rotateLabels:true})}${table(["Revision","Data date","Start","Finish","TF","Progress","Critical"],hist.map(x=>[esc(x.scheduleName),isoDate(x.dataDate),isoDate(x.start),isoDate(x.finish),Number(x.totalFloat).toFixed(1),`${Number(x.percent).toFixed(1)}%`,x.critical?"Yes":"No"]))}`:scheduleSelectionMessage("Select one or more schedules; two or more are recommended for trend analysis.")}</section>`;
    }
    case"milestones":{
      const revisionSet=state.dashboardLineageIds.map(scheduleById).filter(Boolean),revs=revisionSet.length?revisionSet:[s],ms=s.activities.filter(isMilestoneActivity),hist=milestoneHistory(revs);return `<section class="panel"><h2>Milestone Control Centre</h2><p class="muted">Movement/confidence uses the explicit Dashboard Revision Lineage selection when present; otherwise it uses only the active schedule.</p>${table(["Milestone","Forecast","Previous","Movement","Float","Confidence"],ms.map(a=>{const hh=hist.find(x=>x.id===a.id)?.history||[],p=hh.length>1?hh.at(-2):null,move=p?daysBetween(p.finish,a.currentFinish||a.finish):0,conf=forecastConfidence(revs,a.id);return[`${esc(a.id)} · ${esc(a.name)}`,isoDate(a.currentFinish||a.finish),isoDate(p?.finish),p?`${move>=0?"+":""}${move}d`:"—",a.totalFloat.toFixed(1),`${conf.score}% ${conf.label}`]}))}</section>`;
    }
    case"forecast":{
      const selected=state.dashboardLineageIds.map(scheduleById).filter(Boolean),revs=selected.length?selected:[s],ms=s.activities.filter(a=>a.milestone),overall=forecastConfidence(revs),rows=ms.map(a=>{const c=forecastConfidence(revs,a.id);return[`${esc(a.id)} · ${esc(a.name)}`,`<span title="Confidence combines schedule health, revision volatility, average positive slip and available float.">${c.score}%</span>`,c.label,`<span title="Standard deviation of finish-date movement across the explicitly selected revision set.">${c.volatility.toFixed(1)}</span>`,`<span title="Average positive finish-date movement (slippage) across the selected revisions.">${c.avgSlip.toFixed(1)}</span>`,isoDate(a.currentFinish||a.finish)]});
      return `<p class="muted">Hover the confidence statistics for definitions. Revision-based calculations use the schedules explicitly selected in Dashboard → Revision Lineage; if none are selected, only the active schedule is used.</p><div class="metrics">${metric("Overall confidence",`${overall.score}%`,overall.label,"Derived from schedule health, revision volatility, average positive slippage and target float where applicable.")}${metric("Revision volatility",overall.volatility.toFixed(1),"days std dev","Standard deviation of finish movement between selected revisions. Higher volatility reduces confidence.")}${metric("Average positive slip",overall.avgSlip.toFixed(1),"days","Average positive movement in forecast finish between selected revisions; negative/early movement is not counted as slip.")}${metric("Revisions analysed",overall.rows.length,"","Number of explicitly selected schedules containing a usable target/project finish date.")}${metric("Current critical",s.activities.filter(a=>a.critical||a.totalFloat<=0).length,"","Activities currently critical or at zero/negative total float.")}${metric("Current negative float",s.activities.filter(a=>a.totalFloat<0).length,"","Activities whose total float is below zero, indicating schedule pressure against required dates or constraints.")}</div><section class="panel"><h2>Milestone Forecast Confidence</h2>${table(["Milestone","Confidence","Band","Volatility","Avg slip","Current forecast"],rows)}</section>`;
    }
    case"cost":{
      const budget=s.activities.reduce((n,a)=>n+Number(a.budgetCost||0),0),actual=s.activities.reduce((n,a)=>n+Number(a.actualCost||0),0),remaining=s.activities.reduce((n,a)=>n+Number(a.remainingCost||0),0);return `<div class="metrics">${metric("Budget cost",budget.toFixed(0))}${metric("Actual cost",actual.toFixed(0))}${metric("Remaining cost",remaining.toFixed(0))}${metric("Forecast cost",(actual+remaining).toFixed(0))}${metric("Cost variance",(budget-(actual+remaining)).toFixed(0))}${metric("Cost loaded activities",s.activities.filter(a=>a.budgetCost||a.actualCost||a.remainingCost).length)}</div><section class="panel"><h2>Cost by WBS</h2><p class="muted">WBS headings follow the imported schedule hierarchy. Expand a WBS to see child WBS elements and activities.</p>${costTreeMarkup(s)}</section>`;
    }
    case"resources":{
      const assigns=s.assignments||[],resources=s.resources||[],resourceRows=resources.map(r=>{const xs=assigns.filter(x=>String(x.resourceId)===String(r.id)),budget=xs.reduce((n,x)=>n+Number(x.target_qty||x.budgetUnits||0),0),actual=xs.reduce((n,x)=>n+Number(x.act_reg_qty||x.actualUnits||0),0),remaining=xs.reduce((n,x)=>n+Number(x.remain_qty||x.remainingUnits||0),0);return[esc(r.name||r.id),budget.toFixed(1),actual.toFixed(1),remaining.toFixed(1),budget?`${(actual/budget*100).toFixed(1)}%`:"—"]}),budgetUnits=s.activities.reduce((n,a)=>n+Number(a.budgetUnits||0),0),actualUnits=s.activities.reduce((n,a)=>n+Number(a.actualUnits||0),0),budgetCost=s.activities.reduce((n,a)=>n+Number(a.budgetCost||0),0),actualCost=s.activities.reduce((n,a)=>n+Number(a.actualCost||0),0),pv=budgetUnits?weeklySeries(s).at(-1)?.plannedPct||0:0,ev=avgProgress(s),spi=pv?ev/pv:0,cpi=actualCost?((budgetCost*(ev/100))/actualCost):0;return `<div class="metrics">${metric("Budget units",budgetUnits.toFixed(1))}${metric("Actual units",actualUnits.toFixed(1))}${metric("Budget cost",budgetCost.toFixed(0))}${metric("Actual cost",actualCost.toFixed(0))}${metric("SPI",spi?spi.toFixed(2):"—","Indicative")}${metric("CPI",cpi?cpi.toFixed(2):"—","Indicative")}</div><section class="panel"><h2>Resource / EVM view</h2><p class="muted">EVM indicators are shown only from source values available in the imported schedule; they are not a substitute for a cost-management system.</p>${table(["Resource","Budget units","Actual units","Remaining units","Actual / budget"],resourceRows)}</section>`;
    }
    case"baseline":{
      const current=scheduleById(state.baselineCurrentId),compare=scheduleById(state.baselineCompareId),toolbar=pairToolbar("baseline",state.baselineCurrentId,state.baselineCompareId,{labelA:"Schedule for lookahead / current",labelB:"Optional comparison schedule"});if(!current)return `<section class="panel"><h2>Baseline & Lookahead</h2><p class="muted">Choose the schedule to analyse. The optional second dropdown can be another imported schedule; nothing is inferred from upload order.</p>${toolbar}${scheduleSelectionMessage("Select the current/status schedule.")}</section>`;
      let varianceRows=[];if(compare&&compare.id!==current.id){const comp=compareSchedules(compare,current);varianceRows=comp.changed.filter(x=>x.finishDays!==0).sort((a,b)=>Math.abs(b.finishDays)-Math.abs(a.finishDays)).map(x=>[`${esc(x.id)} · ${esc(x.name)}`,isoDate(compare.activities.find(a=>a.id===x.id)?.currentFinish||compare.activities.find(a=>a.id===x.id)?.finish),isoDate(current.activities.find(a=>a.id===x.id)?.currentFinish||current.activities.find(a=>a.id===x.id)?.finish),`${x.finishDays>=0?"+":""}${x.finishDays}d`])}else varianceRows=current.activities.filter(a=>a.baselineFinish&&a.currentFinish&&daysBetween(a.baselineFinish,a.currentFinish)!==0).sort((a,b)=>Math.abs(daysBetween(b.baselineFinish,b.currentFinish))-Math.abs(daysBetween(a.baselineFinish,a.currentFinish))).map(a=>[`${esc(a.id)} · ${esc(a.name)}`,isoDate(a.baselineFinish),isoDate(a.currentFinish),`${daysBetween(a.baselineFinish,a.currentFinish)>=0?"+":""}${daysBetween(a.baselineFinish,a.currentFinish)}d`]);
      return `<section class="panel"><h2>Baseline & Lookahead</h2>${toolbar}<p class="muted">If a comparison schedule is selected, variance is measured against that schedule. Otherwise the embedded baseline dates in the selected current schedule are used.</p></section><section class="panel"><h2>Finish variance</h2>${table(["Activity","Reference finish","Current finish","Variance"],varianceRows.slice(0,500))}</section><section class="panel"><h2>Next four weeks · detailed by WBS</h2>${lookaheadDetailMarkup(current)}</section>`;
    }
    case"datacentre":{
      const dc=dataCentreReadiness(s),gates=readinessGates(s);return `<div class="grid grid2"><section class="panel"><h2>Data-centre lifecycle readiness</h2>${table(["Stage","Activities","Complete","Progress","Critical"],dc.map(x=>[x.stage,x.activities,x.complete,`${x.progress.toFixed(1)}%`,x.critical]))}</section><section class="panel"><h2>Readiness gates</h2>${table(["Gate","Mapped milestone","Forecast","Float"],gates.map(g=>[g.name,g.activity?`${esc(g.activity.id)} · ${esc(g.activity.name)}`:"Not mapped",isoDate(g.activity?.currentFinish||g.activity?.finish),g.activity?g.activity.totalFloat.toFixed(1):"—"]))}</section></div>`;
    }
    default:{
      const summary=scheduleSummary(s);return `<div class="metrics">${metric("Activities",summary.activities)}${metric("Progress",`${summary.progress.toFixed(1)}%`)}${metric("Forecast finish",summary.forecastFinish||"—")}${metric("Health",`${h.score}/100`,h.label)}${metric("Critical",summary.critical)}${metric("Negative float",summary.negativeFloat)}</div><section class="panel"><h2>Assessment overview</h2><p class="muted">Use the report tabs above. Comparison-style reports now require explicit schedule selections so unrelated uploaded projects are never treated as revisions by default.</p></section>`;
    }
  }
}

function renderTrace(s){
  const id=state.traceActivityId||s.activities.find(a=>a.milestone)?.id||"";if(!id)return `<div class="muted">Select an activity.</div>`;
  const x=traceToMilestone(s,id);return table(["Sequence","Activity","Finish","TF"],x.drivingChain.map((a,i)=>[i+1,`${esc(a.id)} · ${esc(a.name)}`,isoDate(a.currentFinish||a.finish),a.totalFloat.toFixed(1)]));
}
function bindResizableTables(root=document){
  root.querySelectorAll(".table-wrap.resizable-wrap").forEach(wrap=>{
    const table=wrap.querySelector("table.resizable-table"),headers=[...table?.querySelectorAll("thead th")||[]],cols=[...table?.querySelectorAll("colgroup col")||[]];
    if(!table||!headers.length||cols.length!==headers.length)return;
    const key=wrap.dataset.resizeKey?`pcai.tableWidths.${wrap.dataset.resizeKey}`:"";
    let saved=[];try{saved=key?JSON.parse(localStorage.getItem(key)||"[]"):[]}catch(_){saved=[]}
    const measured=headers.map((th,i)=>Math.max(60,Number(saved[i])||Math.round(th.getBoundingClientRect().width)||100));
    const apply=widths=>{
      widths.forEach((w,i)=>{if(cols[i])cols[i].style.width=`${Math.max(60,Math.round(w))}px`});
      table.style.tableLayout="fixed";table.style.width=`${widths.reduce((n,w)=>n+Math.max(60,Math.round(w)),0)}px`;table.style.minWidth="100%";
    };
    apply(measured);
    headers.forEach((th,i)=>{
      const handle=th.querySelector(".col-resizer");if(!handle)return;
      handle.onpointerdown=e=>{
        if(e.button!=null&&e.button!==0)return;e.preventDefault();e.stopPropagation();
        const widths=cols.map((c,j)=>parseFloat(c.style.width)||measured[j]||headers[j].getBoundingClientRect().width),startX=e.clientX,startW=widths[i];
        handle.setPointerCapture?.(e.pointerId);document.documentElement.classList.add("resizing-column");
        const move=ev=>{widths[i]=Math.max(60,startW+ev.clientX-startX);apply(widths)};
        const up=()=>{document.documentElement.classList.remove("resizing-column");if(key)localStorage.setItem(key,JSON.stringify(widths.map(Math.round)));window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up)};
        window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);window.addEventListener("pointercancel",up);
      };
    });
  });
}
function money(v){return Number(v||0).toFixed(0)}
function costTreeMarkup(schedule){
  const nodes=new Map((schedule.wbs||[]).map(w=>[String(w.id),{...w,children:[],activities:[]}])) , roots=[];
  for(const n of nodes.values()){const p=nodes.get(String(n.parentId||""));if(p)p.children.push(n);else roots.push(n)}
  const unassigned=[];for(const a of schedule.activities||[]){const n=nodes.get(String(a.wbsId||""));(n?n.activities:unassigned).push(a)}
  const sumActivity=a=>({budget:Number(a.budgetCost||0),actual:Number(a.actualCost||0),remaining:Number(a.remainingCost||0)});
  const add=(x,y)=>({budget:x.budget+y.budget,actual:x.actual+y.actual,remaining:x.remaining+y.remaining});
  const total=n=>{let t={budget:0,actual:0,remaining:0};for(const a of n.activities)t=add(t,sumActivity(a));for(const c of n.children)t=add(t,total(c));n._total=t;return t};roots.forEach(total);
  const vals=t=>`<span>${money(t.budget)}</span><span>${money(t.actual)}</span><span>${money(t.remaining)}</span><span>${money(t.actual+t.remaining)}</span><span>${money(t.budget-(t.actual+t.remaining))}</span>`;
  const activity=a=>{const t=sumActivity(a);return `<div class="cost-row cost-activity"><span class="cost-name">${esc(a.id)} · ${esc(a.name)}</span>${vals(t)}</div>`};
  const renderNode=(n,depth=0)=>`<details class="cost-node" ${depth<1?"open":""}><summary class="cost-row" style="--cost-depth:${depth}"><span class="cost-name"><strong>${esc(n.code||n.name||n.id)}</strong>${n.name&&n.code?` · ${esc(n.name)}`:""}</span>${vals(n._total||{budget:0,actual:0,remaining:0})}</summary><div class="cost-children">${n.children.sort((a,b)=>String(a.code||a.name).localeCompare(String(b.code||b.name))).map(c=>renderNode(c,depth+1)).join("")}${n.activities.sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(activity).join("")}</div></details>`;
  const unassignedMarkup=unassigned.length?`<details class="cost-node"><summary class="cost-row"><span class="cost-name"><strong>Unassigned WBS</strong></span>${vals(unassigned.map(sumActivity).reduce(add,{budget:0,actual:0,remaining:0}))}</summary><div class="cost-children">${unassigned.map(activity).join("")}</div></details>`:"";
  if(!roots.length&&unassigned.length)return `<div class="cost-tree"><div class="cost-row cost-header"><span>WBS / Activity</span><span>Budget</span><span>Actual</span><span>Remaining</span><span>Forecast</span><span>Variance</span></div>${unassignedMarkup}</div>`;
  return `<div class="cost-tree"><div class="cost-row cost-header"><span>WBS / Activity</span><span>Budget</span><span>Actual</span><span>Remaining</span><span>Forecast</span><span>Variance</span></div>${roots.sort((a,b)=>String(a.code||a.name).localeCompare(String(b.code||b.name))).map(n=>renderNode(n)).join("")}${unassignedMarkup}</div>`;
}
function bindGanttInteractions(schedule){
  const panel=document.querySelector('[data-gantt-panel]'),g=panel?.querySelector('.gantt');if(!panel||!g||!schedule)return;
  const key=panel.dataset.resizeKey||"ganttLeftWidth",divider=panel.querySelector('.gantt-divider'),overlay=panel.querySelector('.gantt-rel-overlay');
  const saveWidth=w=>{const value=Math.max(220,Math.min(1000,Math.round(w)));g.style.setProperty('--gantt-left',`${value}px`);if(key in state)state[key]=value;localStorage.setItem(`pcai.${key}`,String(value));return value};
  let redrawTimer=0;
  const drawLinks=()=>{
    if(!overlay)return;overlay.innerHTML="";if(g.dataset.showRelationships!=="1")return;
    const gr=g.getBoundingClientRect(),width=Math.max(g.scrollWidth,g.clientWidth),height=Math.max(g.scrollHeight,g.clientHeight);overlay.setAttribute('viewBox',`0 0 ${width} ${height}`);overlay.setAttribute('width',String(width));overlay.setAttribute('height',String(height));
    const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');marker.setAttribute('id','ganttArrow');marker.setAttribute('viewBox','0 0 6 6');marker.setAttribute('refX','5.7');marker.setAttribute('refY','3');marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto');const tip=document.createElementNS(ns,'path');tip.setAttribute('d','M0,0 L0,6 L6,3 z');tip.setAttribute('class','gantt-link-arrow');marker.appendChild(tip);defs.appendChild(marker);overlay.appendChild(defs);
    const rows=new Map([...g.querySelectorAll('.gantt-row[data-activity-id]')].map(r=>[r.dataset.activityId,r]));
    for(const rel of schedule.relationships||[]){
      const pr=rows.get(String(rel.predId)),sr=rows.get(String(rel.succId));if(!pr||!sr||pr.offsetParent===null||sr.offsetParent===null)continue;
      const pb=pr.querySelector('.bar,.milestone'),sb=sr.querySelector('.bar,.milestone');if(!pb||!sb)continue;
      const a=pb.getBoundingClientRect(),b=sb.getBoundingClientRect(),type=String(rel.type||'FS').toUpperCase(),predFinish=type[0]!=="S",succFinish=type[1]==="F";
      const x1=(predFinish?a.right:a.left)-gr.left+g.scrollLeft,y1=a.top+a.height/2-gr.top+g.scrollTop,x2=(succFinish?b.right:b.left)-gr.left+g.scrollLeft,y2=b.top+b.height/2-gr.top+g.scrollTop;
      let bend;if(x2>x1+18)bend=x1+(x2-x1)/2;else bend=Math.max(x1,x2)+26;
      const path=document.createElementNS(ns,'path');path.setAttribute('d',`M${x1.toFixed(1)} ${y1.toFixed(1)} H${bend.toFixed(1)} V${y2.toFixed(1)} H${x2.toFixed(1)}`);path.setAttribute('class','gantt-link p6-link');path.setAttribute('marker-end','url(#ganttArrow)');const title=document.createElementNS(ns,'title');title.textContent=`${rel.predId} ${type} ${rel.succId}${Number(rel.lag||0)?` · lag ${Number(rel.lag).toFixed(1)}d`:''}`;path.appendChild(title);overlay.appendChild(path);
    }
  };
  const scheduleRedraw=()=>{clearTimeout(redrawTimer);redrawTimer=setTimeout(drawLinks,20)};
  if(divider)divider.onpointerdown=e=>{if(e.button!=null&&e.button!==0)return;e.preventDefault();const start=e.clientX,startW=parseFloat(getComputedStyle(g).getPropertyValue('--gantt-left'))||410;document.documentElement.classList.add('resizing-column');divider.setPointerCapture?.(e.pointerId);const move=ev=>{saveWidth(startW+ev.clientX-start);scheduleRedraw()},up=()=>{document.documentElement.classList.remove('resizing-column');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);drawLinks()};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up)};
  panel.querySelectorAll('.gantt-group').forEach(d=>d.addEventListener('toggle',scheduleRedraw));
  g.closest('.gantt-wrap')?.addEventListener('scroll',scheduleRedraw,{passive:true});window.addEventListener('resize',scheduleRedraw,{once:true});requestAnimationFrame(drawLinks);
}
function bindNetworkZoom(){
  const widget=document.querySelector('[data-network-widget]');if(!widget)return;const canvas=widget.querySelector('.network-canvas'),svg=canvas?.querySelector('svg'),label=widget.querySelector('.network-zoom-label');if(!canvas||!svg)return;
  const baseW=parseFloat(canvas.style.width)||900,baseH=parseFloat(canvas.style.height)||500;let zoom=Number(widget.dataset.zoom||1);
  const apply=()=>{zoom=Math.max(.4,Math.min(2.5,zoom));widget.dataset.zoom=String(zoom);canvas.style.width=`${baseW*zoom}px`;canvas.style.height=`${baseH*zoom}px`;svg.style.transform=`scale(${zoom})`;svg.style.transformOrigin='0 0';if(label)label.textContent=`${Math.round(zoom*100)}%`};
  widget.querySelectorAll('[data-net-zoom]').forEach(b=>b.onclick=()=>{const action=b.dataset.netZoom;zoom=action==='in'?zoom+.15:action==='out'?zoom-.15:1;apply()});apply();
}
function bindAssessmentControls(s){
  bindResizableTables($("reportBody"));
  if(state.assessmentReport==="activities"&&s){
    mountVirtualActivities($("virtualActivities"),s.activities);
    $("copyToBuilder")?.addEventListener("click",()=>{const bySucc=new Map();for(const r of s.relationships||[]){if(!bySucc.has(r.succId))bySucc.set(r.succId,[]);bySucc.get(r.succId).push(r)}state.builderRows=s.activities.map(a=>({id:a.id,name:a.name,wbs:a.wbsPath||"",start:isoDate(a.currentStart||a.start),finish:isoDate(a.currentFinish||a.finish),duration:Number(a.originalDuration||0),predecessors:(bySucc.get(a.id)||[]).map(r=>`${r.predId}:${r.type||"FS"}${Number(r.lag||0)?`${Number(r.lag)>0?"+":""}${Number(r.lag)}d`:""}`).join(", "),milestone:isMilestoneActivity(a)}));localStorage.setItem("pcai.builder",JSON.stringify(state.builderRows));state.view="builder";render();toast(`Loaded ${state.builderRows.length} activities into Schedule Builder`)})
  }
  const pair=(prefix,aKey,bKey)=>{$(`${prefix}A`)?.addEventListener('change',e=>{state[aKey]=e.target.value;renderAssessment()});$(`${prefix}B`)?.addEventListener('change',e=>{state[bKey]=e.target.value;renderAssessment()})};
  if(state.assessmentReport==="comparison")pair('comparison','comparisonAId','comparisonBId');
  if(state.assessmentReport==="week")pair('week','weekAId','weekBId');
  if(state.assessmentReport==="delay")pair('delay','delayAId','delayBId');
  if(state.assessmentReport==="baseline")pair('baseline','baselineCurrentId','baselineCompareId');
  if(state.assessmentReport==="forensic")state.forensicScheduleIds.forEach((_,i)=>$(`forensicSlot${i}`)?.addEventListener('change',e=>{state.forensicScheduleIds[i]=e.target.value;renderAssessment()}));
  if(state.assessmentReport==="timemachine")state.timeMachineScheduleIds.forEach((_,i)=>$(`timeSlot${i}`)?.addEventListener('change',e=>{state.timeMachineScheduleIds[i]=e.target.value;renderAssessment()}));
  if(state.assessmentReport==="scurve"){$("scurveBasis")?.addEventListener('change',e=>{state.scurveBasis=e.target.value;renderAssessment()});$("scurveResource")?.addEventListener('change',e=>{state.scurveResourceId=e.target.value;renderAssessment()})}
  if(state.assessmentReport==="whymove"){
    $("whyActivity")?.addEventListener("change",e=>{state.whyActivityId=e.target.value;renderAssessment()});
    $("whyPrev")?.addEventListener("change",e=>{state.previousScheduleId=e.target.value||null;renderAssessment()});
  }
  if(state.assessmentReport==="narrative")$("narrativePrev")?.addEventListener("change",e=>{state.previousScheduleId=e.target.value||null;renderAssessment()});
  if((state.assessmentReport==="gantt"||state.assessmentReport==="critical")&&s){
    $("ganttTimescale")?.addEventListener("change",e=>{state.ganttTimescale=e.target.value;renderAssessment()});
    $("ganttCompression")?.addEventListener("change",e=>{state.ganttCompression=e.target.value;renderAssessment()});
    $("ganttRelationships")?.addEventListener("change",e=>{state.ganttRelationships=e.target.checked;renderAssessment()});
    const startKey=state.assessmentReport==="critical"?"criticalStartDate":"ganttStartDate",finishKey=state.assessmentReport==="critical"?"criticalFinishDate":"ganttFinishDate";
    $("ganttStartDate")?.addEventListener("change",e=>{state[startKey]=e.target.value;if(state[finishKey]&&state[startKey]>state[finishKey])state[finishKey]=state[startKey];renderAssessment()});
    $("ganttFinishDate")?.addEventListener("change",e=>{state[finishKey]=e.target.value;if(state[startKey]&&state[finishKey]<state[startKey])state[startKey]=state[finishKey];renderAssessment()});
    $("ganttResetRange")?.addEventListener("click",()=>{state[startKey]="";state[finishKey]="";renderAssessment()});
    bindGanttInteractions(s);
  }
  if(state.assessmentReport==="network"){$("traceActivity")?.addEventListener("change",e=>{state.traceActivityId=e.target.value;renderAssessment()});bindNetworkZoom()}
  if(state.assessmentReport==="timemachine")$("timeActivity")?.addEventListener("change",e=>{state.timeActivityId=e.target.value;renderAssessment()});
}

function mountVirtualActivities(container,activities){
  if(!container)return;const rowH=32,headerH=32,total=activities.length,key="pcai.activityRegisterWidths",defaults=[120,320,180,110,110,75,75];
  let saved=[];try{saved=JSON.parse(localStorage.getItem(key)||"[]")}catch(_){saved=[]}
  const cols=defaults.map((w,i)=>Math.max(60,Number(saved[i])||w));container.style.setProperty("--va-cols",cols.map(x=>`${x}px`).join(" "));
  const labels=["ID","Activity","WBS","Start","Finish","TF","%"];
  const totalWidth=()=>cols.reduce((a,b)=>a+b,0),apply=()=>{container.style.setProperty("--va-cols",cols.map(x=>`${Math.round(x)}px`).join(" "));if(container.firstElementChild)container.firstElementChild.style.minWidth=`${totalWidth()}px`};
  container.innerHTML=`<div style="height:${headerH+total*rowH}px;position:relative;min-width:${totalWidth()}px"><div class="virtual-header">${labels.map((x,i)=>`<strong>${x}<span class="virtual-resizer" data-vcol="${i}" role="separator" aria-orientation="vertical" aria-label="Resize ${esc(x)} column" title="Drag to resize column"></span></strong>`).join("")}</div><div id="virtualRows"></div></div>`;
  const rows=container.querySelector("#virtualRows");const paint=()=>{
    const top=container.scrollTop,from=Math.max(0,Math.floor((top-headerH)/rowH)-8),count=Math.ceil(container.clientHeight/rowH)+16,to=Math.min(total,from+count);
    rows.innerHTML=activities.slice(from,to).map((a,i)=>`<div class="virtual-row" style="top:${headerH+(from+i)*rowH}px"><span>${esc(a.id)}</span><span title="${esc(a.name)}">${esc(a.name)}</span><span title="${esc(a.wbsPath)}">${esc(a.wbsPath)}</span><span>${isoDate(a.currentStart||a.start)}</span><span>${isoDate(a.currentFinish||a.finish)}</span><span>${a.totalFloat.toFixed(1)}</span><span>${a.percent.toFixed(1)}</span></div>`).join("");
  };
  container.querySelectorAll(".virtual-resizer").forEach(handle=>handle.onpointerdown=e=>{
    if(e.button!=null&&e.button!==0)return;e.preventDefault();e.stopPropagation();const i=Number(handle.dataset.vcol),startX=e.clientX,startW=cols[i];
    handle.setPointerCapture?.(e.pointerId);document.documentElement.classList.add("resizing-column");
    const move=ev=>{cols[i]=Math.max(60,startW+ev.clientX-startX);apply()};
    const up=()=>{document.documentElement.classList.remove("resizing-column");localStorage.setItem(key,JSON.stringify(cols.map(Math.round)));window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up)};
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);window.addEventListener("pointercancel",up)
  });
  container.onscroll=paint;paint();
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
    const w=new Worker(new URL("../workers/montecarlo-worker.js",import.meta.url),{type:"module"}),id=uid("mc");
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
  $("workspace").innerHTML=`${viewHead("Schedule Builder","Independent editable planning workspace. Imported XER/XML/MPP schedules can be copied here from Schedule Assessment → Activity Register.",`<button class="btn" id="builderAdd">Add activity</button><button class="btn" id="builderExport">Export CSV</button>`)}
  <section class="panel"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Activity</th><th>WBS</th><th>Start</th><th>Finish</th><th>Duration d</th><th>Predecessors</th><th>Milestone</th><th></th></tr></thead><tbody>${state.builderRows.map((r,i)=>`<tr>
    <td><input data-b="${i}:id" value="${esc(r.id||"")}"></td><td><input data-b="${i}:name" value="${esc(r.name||"")}"></td><td><input data-b="${i}:wbs" value="${esc(r.wbs||"")}"></td><td><input type="date" data-b="${i}:start" value="${esc(r.start||"")}"></td><td><input type="date" data-b="${i}:finish" value="${esc(r.finish||"")}"></td><td><input type="number" data-b="${i}:duration" value="${r.duration||0}"></td><td><input data-b="${i}:predecessors" value="${esc(r.predecessors||"")}"></td><td><input type="checkbox" data-b="${i}:milestone" ${r.milestone?"checked":""}></td><td><button data-delb="${i}">×</button></td></tr>`).join("")||`<tr><td colspan="9" class="muted">No editable activities yet. Add one here or load an imported schedule from Schedule Assessment → Activity Register.</td></tr>`}</tbody></table></div></section>
  <div style="margin-top:12px">${chatMarkup("builder","AI Schedule Builder","Draft activities, milestones, logic and assumptions from checked project repository files.","Planner")}</div>`;
  document.querySelectorAll("[data-b]").forEach(x=>x.onchange=()=>{const [i,k]=x.dataset.b.split(":");state.builderRows[Number(i)][k]=x.type==="checkbox"?x.checked:x.type==="number"?Number(x.value):x.value;localStorage.setItem("pcai.builder",JSON.stringify(state.builderRows));renderBuilder()});
  document.querySelectorAll("[data-delb]").forEach(x=>x.onclick=()=>{state.builderRows.splice(Number(x.dataset.delb),1);localStorage.setItem("pcai.builder",JSON.stringify(state.builderRows));renderBuilder()});
  $("builderAdd").onclick=()=>{state.builderRows.push({id:`A${String(state.builderRows.length+1).padStart(4,"0")}`,name:"New Activity",wbs:"",start:"",finish:"",duration:5,predecessors:"",milestone:false});localStorage.setItem("pcai.builder",JSON.stringify(state.builderRows));renderBuilder()};
  $("builderExport").onclick=()=>downloadBlob(new Blob([toCSV(["ID","Activity","WBS","Start","Finish","Duration","Predecessors","Milestone"],state.builderRows.map(r=>[r.id,r.name,r.wbs,r.start,r.finish,r.duration,r.predecessors,r.milestone]))],{type:"text/csv"}),"schedule-builder.csv");
  bindChat("builder","Planner");
}

function renderSettings(){
  const c=ollamaConfig(),selectedValue=preferredAI(),gemini=cloudConfig("gemini"),grok=cloudConfig("grok");
  $("workspace").innerHTML=`${viewHead("Settings","AI model selection, project-controls profile and local Ollama setup")}
  <div class="grid grid2 settings-grid">
    <section class="panel"><h2>Global AI Model</h2>
      <p class="muted"><strong>No AI is the default.</strong> Nothing is downloaded or invoked until you explicitly select and apply a model here.</p>
      <div class="form"><label>Selected model<select id="settingsAiSelect">${[...catalogueGroups().entries()].map(([group,entries])=>`<optgroup label="${esc(group)}">${entries.map(entry=>{const cp=aiCompatibility(entry.value);return `<option value="${esc(entry.value)}" ${entry.value===selectedValue?"selected":""} ${entry.disabled?"disabled":""}>${esc(entry.label)}${!cp.ok&&!entry.disabled?" · unavailable here":""}</option>`}).join("")}</optgroup>`).join("")}</select></label><div class="actions"><button class="btn primary" id="applyAiModel">Apply model</button><button class="btn" id="testSelectedAI">Test selected AI</button></div></div>
      <div id="selectedAiCard" class="ai-config-card" style="margin-top:10px"></div>
      <div id="browserAiDiag" class="muted" style="margin-top:8px">Browser models download only after selection and first test/use.</div>
    </section>
    <section class="panel cloud-ai-panel"><h2>Gemini & Grok API keys</h2>
      <p class="muted">Keys are saved only in this browser's local storage on this computer; they are never written into the GitHub repository. Because this is a static GitHub Pages site, browser-stored API keys are convenient but are not equivalent to server-side secrets.</p>
      <div class="cloud-provider">
        <div class="cloud-provider-head"><strong>Google Gemini</strong><span>Direct browser API</span></div>
        <div class="form"><label>Gemini API key<input id="geminiApiKey" type="password" autocomplete="off" placeholder="Paste Gemini API key" value="${esc(gemini.apiKey)}"></label><label>Gemini model<input id="geminiModel" value="${esc(gemini.model)}" placeholder="gemini-3.8-flash"></label><div class="actions"><button class="btn primary" id="saveGemini">Save locally</button><button class="btn" id="testGemini">Test Gemini</button><button class="btn" id="clearGemini">Clear key</button></div><div id="geminiDiag" class="muted">${gemini.apiKey?"API key is stored locally in this browser.":"No Gemini API key stored."}</div></div>
      </div>
      <div class="cloud-provider">
        <div class="cloud-provider-head"><strong>xAI Grok</strong><span>Direct browser API</span></div>
        <div class="form"><label>Grok / xAI API key<input id="grokApiKey" type="password" autocomplete="off" placeholder="Paste xAI API key" value="${esc(grok.apiKey)}"></label><label>Grok model<input id="grokModel" value="${esc(grok.model)}" placeholder="grok-4.6"></label><div class="actions"><button class="btn primary" id="saveGrok">Save locally</button><button class="btn" id="testGrok">Test Grok</button><button class="btn" id="clearGrok">Clear key</button></div><div id="grokDiag" class="muted">${grok.apiKey?"API key is stored locally in this browser.":"No Grok API key stored."}</div></div>
      </div>
      <p class="muted cloud-key-warning">For a public/production deployment, a small backend or Worker that keeps long-lived keys off the page is safer. This local-storage option is provided because you specifically want the key to remain available on the user's own machine.</p>
    </section>
    <section class="panel"><h2>Ollama</h2><div class="form"><label>Host<input id="ollamaHost" value="${esc(c.baseUrl)}"></label><label>Chat model<select id="ollamaModel"><option value="${esc(c.model)}">${esc(c.model||"Detect installed models")}</option></select></label><label>Embedding model<select id="embedModel"><option value="${esc(c.embeddingModel||"")}">${esc(c.embeddingModel||"Keyword-only")}</option></select></label><label>Keep alive<select id="keepAlive">${["default","0","5m","15m","30m","1h","2h","4h"].map(x=>`<option ${c.keepAlive===x?"selected":""}>${x}</option>`).join("")}</select></label><label>Reasoning<select id="thinking">${["off","auto","on"].map(x=>`<option ${c.thinking===x?"selected":""}>${x}</option>`).join("")}</select><div class="actions"><button class="btn" id="checkOllama">Check Ollama</button><button class="btn" id="detectOllama">Detect & classify</button><button class="btn primary" id="testOllama">Test & Save</button></div><div id="ollamaDiag" class="muted">Expected local API: http://localhost:11434</div><div id="ollamaHelp" class="ollama-help" hidden></div></div></section>
    <section class="panel"><h2>Project Controls Profile</h2><div class="form"><label>Specialism<select id="profile">${["General Project Controls","Data Centre","Life Sciences / Pharma","Industrial / Process"].map(x=>`<option ${state.profile===x?"selected":""}>${x}</option>`).join("")}</select></label><div class="actions"><button class="btn primary" id="applyProfile">Apply profile</button></div><div id="profileDiag" class="muted">Current profile: ${esc(state.profile)}</div></div></section>
    <section class="panel"><h2>Set up Ollama on Windows</h2><ol class="muted"><li>Download <code>setup-ollama.bat</code> from this site/repository.</li><li>Right-click it and choose <strong>Run as administrator</strong>.</li><li>Enter this GitHub Pages origin when prompted, for example <code>https://your-name.github.io</code>.</li><li>The script installs Ollama with Windows Package Manager when needed, configures <code>OLLAMA_ORIGINS</code>, starts Ollama and pulls a small default model.</li><li>Return here, click <strong>Check Ollama</strong>, then <strong>Detect & classify</strong>, select a chat model, and use <strong>Test & Save</strong>.</li></ol><a class="btn" href="./setup-ollama.bat" download>Download setup-ollama.bat</a><p class="muted" style="margin-top:10px">The website remains static on GitHub Pages. Ollama runs locally on the user's Windows computer; no paid AI service is required.</p></section>
    <section class="panel"><h2>Local Microsoft Project (.mpp) Parser</h2><p class="muted">GitHub Pages cannot execute a native MPP parser itself. This helper runs only on the user's PC, converts MPP to MSPDI XML locally, and returns the XML to this page so it can be normalised into the same editable internal schedule model as XER/XML.</p><ol class="muted"><li>Download <code>setup-mpp-bridge.bat</code> together with the <code>tools</code> folder from this build.</li><li>Double-click the BAT file. It installs Node.js LTS if needed, installs the MPP parser, and starts <code>127.0.0.1:8765</code>.</li><li>Leave that window open while importing or linking <code>.mpp</code> files.</li><li>Use <strong>Test MPP parser</strong> below. Then import the MPP from the left repository pane.</li></ol><div class="form"><label>Local parser URL<input id="mppBridgeUrl" value="${esc(mppBridgeUrl())}"></label><div class="actions"><button class="btn" id="testMppBridge">Test MPP parser</button><a class="btn" href="./setup-mpp-bridge.bat" download>Download MPP setup BAT</a></div><div id="mppBridgeDiag" class="muted">Expected local API: http://127.0.0.1:8765</div></div></section>
  </div>`;
  const refreshSelectedCard=()=>{
    const selected=selectedAIInfo();
    $("selectedAiCard").innerHTML=`<div class="ai-config-title">${esc(aiLabel())}</div><div class="ai-config-meta"><span>${esc(selected.engine==="none"?"Disabled":selected.engine==="ollama"?"Ollama":selected.engine==="gemini"?"Google Gemini API":selected.engine==="grok"?"xAI Grok API":selected.engine==="cpu"?"CPU / WASM":selected.engine==="gpu-transformers"?"WebGPU / Transformers.js":"WebGPU / WebLLM")}</span><span>${esc(selected.memory||"")}</span></div><div class="${selected.compatible?"ai-ok":"ai-warning"}">${selected.engine==="none"?"No AI calls will be made.":selected.compatible?"Compatible with this browser.":esc(selected.compatibilityMessage)}</div>`;
    $("testSelectedAI").disabled=selected.engine==="none"||selected.engine==="ollama"||!selected.compatible;
  };
  refreshSelectedCard();
  $("applyAiModel").onclick=async()=>{
    const requested=$("settingsAiSelect").value,compat=aiCompatibility(requested);if(!compat.ok){alert(compat.reason);return}
    try{await setPreferredAI(requested);renderAIModelDisplay();refreshSelectedCard();toast(`AI model: ${aiLabel(requested)}`)}catch(error){alert(error.message||String(error))}
  };
  $("testSelectedAI").onclick=async()=>{const d=$("browserAiDiag");d.textContent=`Testing ${aiLabel()}…`;const result=await testSelectedAI();d.textContent=result.ok?`✓ ${result.message}`:`✕ ${result.message}`};
  $("applyProfile").onclick=()=>{state.profile=$("profile").value;localStorage.setItem("pcai.profile",state.profile);$("profileDiag").textContent=`Applied: ${state.profile}`;toast(`Profile applied: ${state.profile}`)};
  const bindCloudProvider=(provider)=>{
    const cap=provider[0].toUpperCase()+provider.slice(1),keyEl=$(provider+"ApiKey"),modelEl=$(provider+"Model"),diag=$(provider+"Diag");
    $("save"+cap).onclick=()=>{const cfg=saveCloudConfig(provider,{apiKey:keyEl.value,model:modelEl.value});diag.textContent=`✓ ${cap} settings saved locally · ${cfg.model}`;renderAIModelDisplay();refreshSelectedCard();toast(`${cap} API settings saved locally`)};
    $("clear"+cap).onclick=()=>{clearCloudKey(provider);keyEl.value="";diag.textContent=`${cap} API key cleared from this browser.`;renderAIModelDisplay();refreshSelectedCard()};
    $("test"+cap).onclick=async()=>{saveCloudConfig(provider,{apiKey:keyEl.value,model:modelEl.value});diag.textContent=`Testing ${cap}…`;const r=await testCloudAI(provider);diag.textContent=r.ok?`✓ ${r.message}`:`✕ ${r.message}`};
  };
  bindCloudProvider("gemini");bindCloudProvider("grok");

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
  $("testOllama").onclick=async()=>{const d=$("ollamaDiag"),box=$("ollamaHelp");box.hidden=true;d.textContent="Testing Ollama…";try{saveOllamaConfig({baseUrl:$("ollamaHost").value,model:$("ollamaModel").value,embeddingModel:$("embedModel").value,keepAlive:$("keepAlive").value,thinking:$("thinking").value});const r=await testOllama({model:$("ollamaModel").value});d.textContent=r.ok?`✓ Ollama ready: ${r.selectedModel}`:`✕ ${r.message}`;if(r.ok){await setPreferredAI("ollama:auto");renderAIModelDisplay()}else showOllamaHelp(r)}catch(e){showOllamaHelp(e)}};
  $("testMppBridge").onclick=async()=>{const d=$("mppBridgeDiag"),url=setMppBridgeUrl($("mppBridgeUrl").value);d.textContent="Checking local MPP parser…";const r=await probeMppBridge(url);d.textContent=r.ok?`✓ ${r.message}${r.version?` · v${r.version}`:""}`:`✕ ${r.message} Run setup-mpp-bridge.bat and leave its window open.`};
}

init().catch(e=>{$("workspace").innerHTML=`<div class="panel"><h2>Startup error</h2><pre>${esc(e.stack||e.message)}</pre></div>`});
