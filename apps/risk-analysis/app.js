"use strict";
const Core=window.parent.ProjectControlsCore;
const workspace=document.getElementById("riskWorkspace");
const statusNode=document.getElementById("riskStatus");
let view="overview";
let schedule=null;
let scheduleFileName="";
let monte=null;
let monteSettings={iterations:5000,scope:"critical",nearCriticalFloat:10,optimisticPct:80,mostLikelyPct:100,pessimisticPct:140,correlation:0.15,seed:12345};
let register=loadJson("pcRiskRegister",[]);
let scenarios=loadJson("pcRiskScenarios",[]);
let mitigations=loadJson("pcRiskMitigations",[]);
let history=loadJson("pcRiskHistory",[]);
function loadJson(k,f){try{return JSON.parse(localStorage.getItem(k)||"null")||f}catch(_){return f}}
function saveJson(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function dt(v){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"})}
function day(v){return v?new Date(v).getTime()/86400000:NaN}
function days(a,b){const x=day(a),y=day(b);return Number.isFinite(x)&&Number.isFinite(y)?Math.round(y-x):0}
function maxFinish(){if(!schedule)return null;return schedule.activities.map(a=>a.currentFinish||a.finish||a.actualFinish).filter(Boolean).sort((a,b)=>new Date(b)-new Date(a))[0]||schedule.plannedFinish}
function activityScore(a){
 let s=0,reasons=[];
 const tf=Number(a.totalFloat);
 const dur=Number(a.remainingDuration??a.duration??0);
 if(a.critical||tf<=0){s+=35;reasons.push("critical/zero float")}
 else if(tf<=5){s+=27;reasons.push("≤5d float")}
 else if(tf<=10){s+=18;reasons.push("near-critical")}
 if(dur>=40){s+=20;reasons.push("long remaining duration")}else if(dur>=20){s+=12;reasons.push("material duration")}
 if(!a.predecessors?.length&&Number(a.percent)<100){s+=12;reasons.push("open start")}
 if(!a.successors?.length&&Number(a.percent)<100){s+=12;reasons.push("open finish")}
 if(a.constraintType||a.constraintDate){s+=10;reasons.push("constraint")}
 if(Number(a.percent)>0&&Number(a.percent)<100&&dur>0){s+=5;reasons.push("in progress")}
 return {score:Math.min(100,s),reasons};
}
function riskRows(){
 if(!schedule)return[];
 return schedule.activities.filter(a=>Number(a.percent)<100).map(a=>({...a,...activityScore(a)})).sort((a,b)=>b.score-a.score);
}
function level(score){return score>=75?["HIGH","high"]:score>=45?["MEDIUM","medium"]:["LOW","low"]}
function overallScore(){const r=riskRows().slice(0,50);return r.length?Math.round(r.reduce((x,y)=>x+y.score,0)/r.length):0}
function criticalCount(){return schedule?schedule.activities.filter(a=>a.critical&&Number(a.percent)<100).length:0}
function nearCritical(){return schedule?schedule.activities.filter(a=>!a.critical&&Number(a.percent)<100&&Number(a.totalFloat)<=10).length:0}
function pDate(k){if(!monte?.probabilities?.[k])return null;return new Date(monte.probabilities[k]*86400000)}
function exposure(k){const p=pDate(k),d=maxFinish();return p&&d?Math.round((p-new Date(d))/86400000):0}
function approxConfidence(target){
 if(!monte||!target)return null;
 const pts=[["p10",10],["p20",20],["p50",50],["p80",80],["p90",90],["p95",95]].map(([k,p])=>[monte.probabilities[k],p]).sort((a,b)=>a[0]-b[0]);
 const t=day(target);if(!Number.isFinite(t))return null;
 if(t<=pts[0][0])return Math.max(1,Math.round(pts[0][1]*(t/pts[0][0])));
 for(let i=1;i<pts.length;i++){if(t<=pts[i][0]){const [x0,p0]=pts[i-1],[x1,p1]=pts[i];return Math.round(p0+(p1-p0)*(t-x0)/(x1-x0))}}
 return 98;
}
function heading(title,sub,actions=""){return `<div class="page-title"><div><h2>${title}</h2><p>${sub}</p></div><div class="action-row">${actions}</div></div>`}
function kpi(label,value,note=""){return `<div class="kpi"><label>${label}</label><strong>${value}</strong><small>${note}</small></div>`}
function noSchedule(){return `<div class="empty"><strong>No schedule selected.</strong><br>Use the shared project repository on the left and click <b>Use</b> on a P6 XER or Microsoft Project XML schedule.</div>`}
document.querySelectorAll("#riskTabs button").forEach(b=>b.addEventListener("click",()=>{view=b.dataset.view;document.querySelectorAll("#riskTabs button").forEach(x=>x.classList.toggle("active",x===b));render()}));
window.addEventListener("pc-shared-file",async e=>loadSchedule(e.detail.file));
async function loadSchedule(file){
 const ext=file.name.split(".").pop().toLowerCase();
 if(!["xer","xml"].includes(ext)){statusNode.textContent="Risk Analysis requires an XER or Microsoft Project XML schedule";return}
 statusNode.textContent=`Parsing ${file.name}…`;
 try{
  const text=await file.text();
  const parsed=Core.schedule.parse(file,text);
  if(!parsed.schedules.length)throw new Error("No project schedule was found in the file.");
  schedule=parsed.schedules[0];scheduleFileName=file.name;monte=null;
  statusNode.textContent=`${schedule.name||file.name} · ${schedule.activities.length.toLocaleString()} activities`;
  render();
 }catch(error){statusNode.textContent=error.message||"Schedule parsing failed"}
}
window.handleFiles=async files=>{if(files?.[0])await loadSchedule(files[0])};
function render(){
 if(!schedule){workspace.innerHTML=heading("Risk Analysis","Quantitative and qualitative schedule risk intelligence")+noSchedule();return}
 const map={overview:renderOverview,schedule:renderScheduleRisk,register:renderRegister,quant:renderQuant,criticality:renderCriticality,scenarios:renderScenarios,mitigation:renderMitigation,ai:renderAI};
 workspace.innerHTML=(map[view]||renderOverview)();
 bindView();
}
function renderOverview(){
 const score=overallScore(),[lab,cls]=level(score),target=schedule.plannedFinish||maxFinish(),conf=approxConfidence(target);
 return heading("Risk Overview","What is threatening the programme, why, and how much exposure exists.")+
 `<div class="kpis">${kpi("Overall Schedule Risk",`<span class="badge ${cls}">${lab}</span>`,`Risk score ${score}/100`)}${kpi("Deterministic Finish",dt(maxFinish()),"Current schedule")}${kpi("P50 Finish",monte?dt(pDate("p50")):"Not run","Quantitative risk")}${kpi("P80 Finish",monte?dt(pDate("p80")):"Not run",monte?`${exposure("p80")>=0?"+":""}${exposure("p80")}d exposure`:"Run QSRA")}${kpi("Critical Activities",criticalCount().toLocaleString(),"Incomplete critical")}${kpi("Near Critical",nearCritical().toLocaleString(),"TF ≤ 10d")}</div>
 <div class="grid2"><div class="card"><div class="card-head"><span>Project Completion Confidence</span><span>${conf===null?"Run QSRA":`≈ ${conf}% by target`}</span></div><div class="card-body">${probabilityLine()}</div></div><div class="card"><div class="card-head">Top Risk Drivers</div><div class="card-body">${riskRows().slice(0,7).map(r=>`<div class="tornado-row"><span>${esc(r.id)} · ${esc(r.name)}</span><div class="tornado-track"><div class="tornado-fill" style="width:${r.score}%"></div></div><b>${r.score}</b></div>`).join("")}</div></div></div>
 <div class="grid2"><div class="card"><div class="card-head">Risk by WBS</div><div class="card-body">${wbsRisk()}</div></div><div class="card"><div class="card-head">Week-on-Week Risk Trend</div><div class="card-body">${riskTrend()}</div></div></div>
 <div class="card"><div class="card-head">Risk-adjusted Gantt — highest exposure activities</div><div class="card-body">${riskGantt()}</div></div>`;
}
function probabilityLine(){
 if(!monte)return `<div class="empty">Run Quantitative Risk to generate P10–P95 completion confidence.</div>`;
 const vals=[["P10","p10",12],["P20","p20",23],["P50","p50",48],["P80","p80",72],["P90","p90",84],["P95","p95",92]];
 return `<div class="prob-line"><div class="prob-track"></div><div class="prob-segment"></div>${vals.map(([l,k,x])=>`<div class="prob-mark" style="left:${x}%"><b>${l}</b>${dt(pDate(k))}</div>`).join("")}</div>`;
}
function wbsRisk(){
 const map=new Map();
 riskRows().forEach(a=>{const key=a.wbsPath||"Unassigned WBS";const x=map.get(key)||{sum:0,n:0};x.sum+=a.score;x.n++;map.set(key,x)});
 const rows=[...map].map(([name,x])=>({name,score:Math.round(x.sum/x.n)})).sort((a,b)=>b.score-a.score).slice(0,10);
 return rows.length?rows.map(r=>`<div class="wbs-row"><span>${esc(r.name)}</span><b>${r.score}</b><div class="bar"><span style="width:${r.score}%"></span></div></div>`).join(""):`<div class="empty">No WBS risk data available.</div>`;
}
function riskTrend(){
 const rows=history.slice(-8);if(!rows.length)return `<div class="empty">The risk trend will build each time a quantitative risk run is saved.</div>`;
 const max=Math.max(...rows.map(x=>x.score),1);
 return rows.map(x=>`<div class="wbs-row"><span>${dt(x.date)}</span><b>${x.score}</b><div class="bar"><span style="width:${100*x.score/max}%"></span></div></div>`).join("");
}
function riskGantt(){
 const rows=riskRows().slice(0,12);if(!rows.length)return "";
 const max=Math.max(...rows.map(r=>Number(r.remainingDuration??r.duration??1)),1);
 return rows.map((r,i)=>{const d=Number(r.remainingDuration??r.duration??1);const base=Math.max(4,65*d/max);const envelope=Math.min(95,base*(monteSettings.pessimisticPct/100));return `<div class="gantt-risk-row"><span>${esc(r.id)} · ${esc(r.name)}</span><div class="gantt-risk-track"><div class="gantt-envelope" style="left:4%;width:${envelope}%"></div><div class="gantt-base" style="width:${base}%"></div></div></div>`}).join("");
}
function renderScheduleRisk(){
 const rows=riskRows();
 return heading("Schedule Risk","Deterministic screening of float, durations, open ends, constraints and path exposure.")+
 `<div class="kpis">${kpi("High Risk",rows.filter(r=>r.score>=75).length,"Score ≥ 75")}${kpi("Medium Risk",rows.filter(r=>r.score>=45&&r.score<75).length,"Score 45–74")}${kpi("Negative / Zero Float",rows.filter(r=>Number(r.totalFloat)<=0).length,"Incomplete")}${kpi("Open Starts",rows.filter(r=>!r.predecessors?.length).length,"Incomplete")}${kpi("Open Finishes",rows.filter(r=>!r.successors?.length).length,"Incomplete")}${kpi("Long Remaining",rows.filter(r=>Number(r.remainingDuration??r.duration)>=40).length,"≥ 40 days")}</div>
 <div class="card"><div class="card-head"><span>Activity Risk Register</span><span>${rows.length.toLocaleString()} incomplete activities</span></div><div class="card-body table-wrap"><table class="risk-table"><thead><tr><th>Activity</th><th>WBS</th><th>Risk</th><th>Score</th><th>TF</th><th>Remaining</th><th>Drivers</th></tr></thead><tbody>${rows.slice(0,750).map(r=>{const [l,c]=level(r.score);return `<tr><td><b>${esc(r.id)}</b> · ${esc(r.name)}</td><td>${esc(r.wbsPath||"—")}</td><td><span class="badge ${c}">${l}</span></td><td>${r.score}</td><td>${Number.isFinite(Number(r.totalFloat))?Number(r.totalFloat).toFixed(1):"—"}</td><td>${Number(r.remainingDuration??r.duration??0).toFixed(1)}d</td><td>${esc(r.reasons.join(", "))}</td></tr>`}).join("")}</tbody></table></div></div>`;
}
function renderRegister(){
 return heading("Project Risk Register","Link discrete project risks to schedule activities.",`<button class="btn primary" id="addRisk">＋ Risk</button>`)+
 `<div class="grid2"><div class="card"><div class="card-head">Risk Register</div><div class="card-body table-wrap">${riskRegisterTable()}</div></div><div class="card"><div class="card-head">Probability × Consequence Heatmap</div><div class="card-body">${heatmap()}</div></div></div>`;
}
function riskRegisterTable(){
 if(!register.length)return `<div class="empty">No discrete risks entered yet.</div>`;
 return `<table class="risk-table"><thead><tr><th>ID</th><th>Risk</th><th>Prob.</th><th>Min</th><th>ML</th><th>Max</th><th>Activities</th><th></th></tr></thead><tbody>${register.map((r,i)=>`<tr><td>${esc(r.id)}</td><td>${esc(r.title)}</td><td>${r.probability}%</td><td>${r.min}d</td><td>${r.ml}d</td><td>${r.max}d</td><td>${esc(r.activities||"—")}</td><td><button class="btn" data-del-risk="${i}">×</button></td></tr>`).join("")}</tbody></table>`;
}
function heatmap(){
 let html='<div class="heatmap"><div class="cell axis"></div>'+[1,2,3,4,5].map(x=>`<div class="cell axis">C${x}</div>`).join("");
 for(let p=5;p>=1;p--){html+=`<div class="cell axis">P${p}</div>`;for(let c=1;c<=5;c++){const val=p*c,cl=val>=15?"heat-high":val>=7?"heat-med":"heat-low";const count=register.filter(r=>Math.max(1,Math.min(5,Math.ceil(r.probability/20)))===p&&Math.max(1,Math.min(5,Math.ceil((r.max||0)/10)))===c).length;html+=`<div class="cell ${cl}">${count?`${count} risk${count>1?"s":""}`:""}</div>`}}return html+"</div>";
}
function renderQuant(){
 return heading("Quantitative Risk Analysis","Network-based Monte Carlo using the shared CPM model.",`<button class="btn primary" id="runMonte">▶ Run simulation</button>`)+
 `<div class="card" style="margin-bottom:9px"><div class="card-head">Simulation Settings</div><div class="card-body"><div class="form-grid">
 ${field("Iterations","iterations",monteSettings.iterations,"number")}${selectField("Scope","scope",monteSettings.scope,[["critical","Critical + near-critical"],["all","All incomplete activities"]])}${field("Near-critical TF","nearCriticalFloat",monteSettings.nearCriticalFloat,"number")}${field("Optimistic %","optimisticPct",monteSettings.optimisticPct,"number")}${field("Most likely %","mostLikelyPct",monteSettings.mostLikelyPct,"number")}${field("Pessimistic %","pessimisticPct",monteSettings.pessimisticPct,"number")}
 </div></div></div>
 <div class="grid2"><div class="card"><div class="card-head">Completion Probability</div><div class="card-body">${probabilityLine()}</div></div><div class="card"><div class="card-head">Confidence Table</div><div class="card-body">${percentileTable()}</div></div></div>
 <div class="grid2"><div class="card"><div class="card-head">Quantitative Summary</div><div class="card-body">${monte?`<div class="metric-list">${["p50","p80","p90","p95"].map(k=>`<div class="wbs-row"><span>${k.toUpperCase()}</span><b>${dt(pDate(k))}</b><span>${exposure(k)>=0?"+":""}${exposure(k)}d vs deterministic</span></div>`).join("")}</div>`:`<div class="empty">Run the simulation to calculate risk-adjusted completion.</div>`}</div></div><div class="card"><div class="card-head">Risk Register Integration</div><div class="card-body"><div class="empty">${register.length} discrete project risk(s) recorded. Activity-duration uncertainty is simulated by the current network engine; discrete event-risk injection is kept visible separately until linked-event simulation is enabled.</div></div></div></div>`;
}
function field(label,id,value,type="text"){return `<div class="field"><label>${label}</label><input id="${id}" type="${type}" value="${esc(value)}"></div>`}
function selectField(label,id,value,options){return `<div class="field"><label>${label}</label><select id="${id}">${options.map(([v,l])=>`<option value="${v}" ${v===value?"selected":""}>${l}</option>`).join("")}</select></div>`}
function percentileTable(){
 if(!monte)return `<div class="empty">No simulation results yet.</div>`;
 return `<table class="risk-table"><thead><tr><th>Confidence</th><th>Completion</th><th>Exposure</th></tr></thead><tbody>${["p10","p20","p50","p80","p90","p95"].map(k=>`<tr><td>${k.toUpperCase()}</td><td>${dt(pDate(k))}</td><td>${exposure(k)>=0?"+":""}${exposure(k)}d</td></tr>`).join("")}</tbody></table>`;
}
function renderCriticality(){
 const rows=monte?.riskRows||[];
 return heading("Criticality & Sensitivity","Which activities most often control simulated completion and most influence finish variation.")+
 `<div class="grid2"><div class="card"><div class="card-head">Criticality Index</div><div class="card-body">${rows.length?rows.slice(0,20).map(r=>`<div class="tornado-row"><span>${esc(r.id)} · ${esc(r.name)}</span><div class="tornado-track"><div class="tornado-fill" style="width:${Math.round(r.criticality*100)}%"></div></div><b>${Math.round(r.criticality*100)}%</b></div>`).join(""):`<div class="empty">Run Quantitative Risk first.</div>`}</div></div><div class="card"><div class="card-head">Finish Sensitivity</div><div class="card-body">${rows.length?rows.slice().sort((a,b)=>Math.abs(b.sensitivity)-Math.abs(a.sensitivity)).slice(0,20).map(r=>`<div class="tornado-row"><span>${esc(r.id)} · ${esc(r.name)}</span><div class="tornado-track"><div class="tornado-fill" style="width:${Math.round(Math.abs(r.sensitivity)*100)}%"></div></div><b>${r.sensitivity.toFixed(2)}</b></div>`).join(""):`<div class="empty">Run Quantitative Risk first.</div>`}</div></div></div>`;
}
function renderScenarios(){
 return heading("Scenario Analysis","Compare schedule interventions and risk assumptions before committing to a mitigation plan.",`<button class="btn primary" id="addScenario">＋ Scenario</button>`)+
 `<div class="card"><div class="card-head">Scenario Comparison</div><div class="card-body table-wrap"><table class="risk-table"><thead><tr><th>Scenario</th><th>Finish adjustment</th><th>P80 proxy</th><th>Contract-date confidence</th><th>Notes</th><th></th></tr></thead><tbody><tr><td><b>Current Plan</b></td><td>0d</td><td>${monte?dt(pDate("p80")):"Run QSRA"}</td><td>${approxConfidence(schedule.plannedFinish)??"—"}${monte?"%":""}</td><td>Current schedule</td><td></td></tr>${scenarios.map((x,i)=>`<tr><td>${esc(x.name)}</td><td>${x.days>=0?"+":""}${x.days}d</td><td>${monte?dt(new Date(pDate("p80").getTime()+x.days*86400000)):"—"}</td><td>Scenario</td><td>${esc(x.notes)}</td><td><button class="btn" data-del-scenario="${i}">×</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
function renderMitigation(){
 const before=monte?exposure("p80"):null,total=mitigations.reduce((a,m)=>a+Number(m.days||0),0),after=before===null?null:Math.max(0,before-total);
 return heading("Mitigation Analysis","Convert risk findings into measurable schedule interventions.",`<button class="btn primary" id="addMitigation">＋ Mitigation</button>`)+
 `<div class="kpis">${kpi("Current P80 Exposure",before===null?"Run QSRA":`${before}d`,"Before mitigation")}${kpi("Planned Recovery",`${total}d`,"Entered mitigations")}${kpi("Residual Exposure",after===null?"—":`${after}d`,"Screened estimate")}${kpi("Mitigations",mitigations.length,"Active actions")}${kpi("Highest Risk Activity",riskRows()[0]?esc(riskRows()[0].id):"—","Deterministic screening")}${kpi("Risk Trend",history.length?history.at(-1).score:"—","Latest saved score")}</div>
 <div class="card"><div class="card-head">Mitigation Options</div><div class="card-body table-wrap">${mitigations.length?`<table class="risk-table"><thead><tr><th>Action</th><th>Target</th><th>P80 gain</th><th>Confidence</th><th>Owner</th><th></th></tr></thead><tbody>${mitigations.map((m,i)=>`<tr><td>${esc(m.action)}</td><td>${esc(m.target)}</td><td>${m.days}d</td><td>${esc(m.confidence)}</td><td>${esc(m.owner)}</td><td><button class="btn" data-del-mit="${i}">×</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No mitigation actions entered yet.</div>`}</div></div>`;
}
function renderAI(){
 return heading("AI Risk Review","OmniRoute interprets calculated risk evidence; it does not calculate or invent schedule metrics.",`<button class="btn primary" id="runAIReview">✦ Generate risk review</button>`)+
 `<div class="card"><div class="card-head"><span>Evidence-grounded Risk Review</span><span>OmniRoute</span></div><div class="card-body"><div id="aiOutput" class="ai-output">The AI review will summarise the deterministic risk screen, Monte Carlo results, criticality, WBS concentration, registered risks and mitigation opportunities. Unsupported claims should be identified as evidence gaps.</div></div></div>`;
}
function bindView(){
 document.querySelectorAll("[data-del-risk]").forEach(b=>b.onclick=()=>{register.splice(+b.dataset.delRisk,1);saveJson("pcRiskRegister",register);render()});
 document.querySelectorAll("[data-del-scenario]").forEach(b=>b.onclick=()=>{scenarios.splice(+b.dataset.delScenario,1);saveJson("pcRiskScenarios",scenarios);render()});
 document.querySelectorAll("[data-del-mit]").forEach(b=>b.onclick=()=>{mitigations.splice(+b.dataset.delMit,1);saveJson("pcRiskMitigations",mitigations);render()});
 document.getElementById("addRisk")?.addEventListener("click",()=>{const title=prompt("Risk description:");if(!title)return;const probability=+prompt("Probability %:","40")||0;const ml=+prompt("Most likely impact (days):","10")||0;const max=+prompt("Maximum impact (days):","20")||0;const activities=prompt("Impacted Activity IDs (optional):","")||"";register.push({id:`R${String(register.length+1).padStart(3,"0")}`,title,probability,min:0,ml,max,activities});saveJson("pcRiskRegister",register);render()});
 document.getElementById("runMonte")?.addEventListener("click",runMonte);
 document.getElementById("addScenario")?.addEventListener("click",()=>{const name=prompt("Scenario name:");if(!name)return;const days=+prompt("Finish adjustment in days (negative = recovery):","-10")||0;const notes=prompt("Scenario notes:","")||"";scenarios.push({name,days,notes});saveJson("pcRiskScenarios",scenarios);render()});
 document.getElementById("addMitigation")?.addEventListener("click",()=>{const action=prompt("Mitigation action:");if(!action)return;const target=prompt("Target activity / WBS:","")||"";const days=+prompt("Expected P80 recovery (days):","5")||0;const confidence=prompt("Confidence (High / Medium / Low):","Medium")||"Medium";const owner=prompt("Owner:","")||"";mitigations.push({action,target,days,confidence,owner});saveJson("pcRiskMitigations",mitigations);render()});
 document.getElementById("runAIReview")?.addEventListener("click",runAIReview);
}
async function runMonte(){
 for(const key of ["iterations","nearCriticalFloat","optimisticPct","mostLikelyPct","pessimisticPct"]){const el=document.getElementById(key);if(el)monteSettings[key]=+el.value||monteSettings[key]}
 const scope=document.getElementById("scope");if(scope)monteSettings.scope=scope.value;
 statusNode.textContent="Running network Monte Carlo…";
 try{
  monte=await Core.risk.runMonteCarlo(schedule,monteSettings,m=>{if(m.progress)statusNode.textContent=`Monte Carlo ${Math.round(m.progress*100)}%`});
  const score=overallScore();history.push({date:new Date().toISOString(),score,p80:monte.probabilities.p80});history=history.slice(-52);saveJson("pcRiskHistory",history);
  statusNode.textContent=`Monte Carlo complete · P80 ${dt(pDate("p80"))}`;render();
 }catch(error){statusNode.textContent=error.message||"Monte Carlo failed"}
}
async function runAIReview(){
 const out=document.getElementById("aiOutput");if(!out)return;out.textContent="Analysing calculated risk evidence…";
 try{
  const select=document.getElementById("modelSelect");const model=select?.value||"omniroute:auto";await Core.ai.ensure(model);
  const evidence={project:schedule.name,file:scheduleFileName,deterministicFinish:dt(maxFinish()),plannedFinish:dt(schedule.plannedFinish),overallRiskScore:overallScore(),criticalActivities:criticalCount(),nearCriticalActivities:nearCritical(),topActivities:riskRows().slice(0,15).map(r=>({id:r.id,name:r.name,wbs:r.wbsPath,score:r.score,totalFloat:r.totalFloat,reasons:r.reasons})),monteCarlo:monte?{p50:dt(pDate("p50")),p80:dt(pDate("p80")),p90:dt(pDate("p90")),p80ExposureDays:exposure("p80"),topCriticality:monte.riskRows?.slice(0,12)}:null,registeredRisks:register,mitigations};
  const response=await Core.ai.run([{role:"system",content:"You are a senior project-controls schedule-risk analyst. Interpret only the supplied calculated evidence. Do not invent schedule facts, probabilities, contractual dates, causes or mitigation benefits. Distinguish calculated facts, reasonable interpretation and missing information. Structure the response as Executive Risk Position, Primary Drivers, Quantitative Exposure, WBS Concentration, Mitigation Priorities, Evidence Gaps and Recommended Actions."},{role:"user",content:JSON.stringify(evidence)}],{temperature:.15,max_tokens:1600});
  out.textContent=response?.choices?.[0]?.message?.content||response?.content||"No response returned.";
 }catch(error){out.textContent=`AI review unavailable: ${error.message||error}`}
}
render();
