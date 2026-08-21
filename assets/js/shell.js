"use strict";

const TOOL_CONFIG = {
    contracts: { name: "Contract Manager", url: "./apps/contract-manager/index.html?sharedPane=1" },
    drawing: { name: "Drawing Measurement", url: "./apps/drawing-measurement/index.html?sharedPane=1" },
    assessment: { name: "Schedule Assessment", url: "./apps/schedule-assessment/index.html?sharedPane=1" },
    risk: { name: "Risk Analysis", url: "./apps/risk-analysis/index.html?sharedPane=1" },
    claims: { name: "Claims & Forensics", url: "./apps/claims-forensics/index.html?sharedPane=1" },
    builder: { name: "Schedule Builder", url: "./apps/schedule-builder/index.html" }
};

const host = document.getElementById("host");
const loading = document.getElementById("loading");
const statusNode = document.getElementById("status");
let frame = null;
let activeTool = null;
let token = 0;

function setTabs(key) {
    document.querySelectorAll(".suite-tab").forEach(button => {
        const selected = button.dataset.tool === key;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-selected", selected ? "true" : "false");
    });
}

function destroyCurrent() {
    if (frame) {
        try {
            frame.src = "about:blank";
        } catch (_) {}
        frame.remove();
        frame = null;
    }
    const aiState = ProjectControlsCore.ai.status();
    if (aiState.engine === "cpu" || aiState.engine === "mlc") {
        Promise.resolve(ProjectControlsCore.ai.release()).catch(()=>{});
    }
}

async function activateTool(key) {
    const config = TOOL_CONFIG[key];
    if (!config || (key === activeTool && frame)) return;
    const run = ++token;
    activeTool = key;
    setTabs(key);
    document.getElementById("workspaceShell")?.classList.toggle("builder-mode",key==="builder");
    loading.hidden = false;
    loading.textContent = `Opening ${config.name}…`;
    statusNode.textContent = "OmniRoute Auto · switching tool";
    destroyCurrent();
    if (run !== token) return;

    const next = document.createElement("iframe");
    next.className = "tool-frame";
    next.title = config.name;
    next.referrerPolicy = "no-referrer";
    let loaded = false;
    next.addEventListener("load", () => {
        if (run !== token) return;
        loaded = true;
        loading.hidden = true;
        statusNode.textContent = ProjectControlsCore.ai.status().label === "AI idle" ? "OmniRoute Auto · AI on demand" : ProjectControlsCore.ai.status().label;
        try{next.contentWindow.postMessage({type:"pc-theme",theme:document.documentElement.dataset.theme||"light"},"*")}catch(_){}
    }, { once: true });
    next.addEventListener("error", () => {
        if (run !== token) return;
        loading.hidden = false;
        loading.textContent = `Could not open ${config.name}. Check that ${config.url} exists in the deployed site.`;
        statusNode.textContent = "Module failed to load";
    }, { once: true });
    setTimeout(() => {
        if (run !== token || loaded) return;
        loading.hidden = false;
        loading.textContent = `${config.name} is taking longer than expected to open. Check the browser console or confirm the module files were uploaded.`;
    }, 8000);

    frame = next;
    host.appendChild(next);
    next.src = config.url;

    try {
        sessionStorage.setItem("pcai.activeTab", key);
    } catch (_) {}
}

document.querySelectorAll(".suite-tab").forEach(button => {
    button.addEventListener("click", () => activateTool(button.dataset.tool));
});

let initial = "contracts";
try {
    const saved = sessionStorage.getItem("pcai.activeTab");
    if (saved && TOOL_CONFIG[saved]) initial = saved;
} catch (_) {}
activateTool(initial);



const sharedProjectName=document.getElementById("sharedProjectName");
const sharedFileInput=document.getElementById("sharedFileInput");
const sharedRepoList=document.getElementById("sharedRepoList");
const sharedCount=document.getElementById("sharedCount");
const sharedNewProject=document.getElementById("sharedNewProject");
const SHARED_DB="ProjectControlsSharedRepositoryDB";
const SHARED_DB_VERSION=1;
let sharedFiles=[];
let sharedProject="Untitled project";
function sharedDb(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(SHARED_DB,SHARED_DB_VERSION);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("files"))db.createObjectStore("files",{keyPath:"id"});if(!db.objectStoreNames.contains("meta"))db.createObjectStore("meta",{keyPath:"key"})};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function sharedGetAll(store){const db=await sharedDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(store,"readonly");const r=tx.objectStore(store).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
async function sharedPut(store,value){const db=await sharedDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(store,"readwrite");tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function sharedClear(){const db=await sharedDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(["files","meta"],"readwrite");tx.objectStore("files").clear();tx.objectStore("meta").clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function sharedCategory(name){
 const ext=(name.split(".").pop()||"").toLowerCase();
 if(["xer","xml"].includes(ext))return "Schedules";
 if(["pdf","docx","txt","md"].includes(ext))return "Contracts & Claims";
 if(["xlsx","xls","csv"].includes(ext))return "Drawings & Quantity";
 return "Other Evidence";
}
function sharedIcon(name){const e=(name.split(".").pop()||"").toLowerCase();if(e==="xer")return"P6";if(e==="xml")return"XML";if(e==="pdf")return"PDF";if(["xlsx","xls","csv"].includes(e))return"≣";return"□"}
function bytes(v){if(v<1024)return`${v} B`;if(v<1048576)return`${(v/1024).toFixed(1)} KB`;return`${(v/1048576).toFixed(1)} MB`}
function renderSharedRepo(){
 sharedProjectName.value=sharedProject;
 sharedCount.textContent=String(sharedFiles.length);
 const groups=["Schedules","Contracts & Claims","Drawings & Quantity","Other Evidence"];
 sharedRepoList.innerHTML=groups.map(group=>{
  const files=sharedFiles.filter(f=>f.category===group);
  return `<section class="shared-section"><div class="shared-section-title"><span>${group}</span><span>${files.length}</span></div>${files.length?files.map(f=>`<div class="shared-file"><div class="shared-file-icon">${sharedIcon(f.name)}</div><div><div class="shared-file-name" title="${f.name.replace(/"/g,"&quot;")}">${f.name}</div><div class="shared-file-meta">${bytes(f.size||0)}</div></div><button class="shared-use" data-shared-use="${f.id}" type="button">Use</button></div>`).join(""):`<div class="shared-empty">No ${group.toLowerCase()} files</div>`}</section>`;
 }).join("");
 sharedRepoList.querySelectorAll("[data-shared-use]").forEach(button=>button.addEventListener("click",()=>useSharedFile(button.dataset.sharedUse)));
}
async function loadSharedRepo(){
 try{
  sharedFiles=await sharedGetAll("files");
  const meta=await sharedGetAll("meta");
  sharedProject=meta.find(x=>x.key==="projectName")?.value||"Untitled project";
 }catch(error){console.warn("Shared repository unavailable",error);sharedFiles=[]}
 renderSharedRepo();
}
async function addSharedFiles(fileList){
 for(const file of [...fileList]){
  const existing=sharedFiles.find(x=>x.name===file.name&&x.size===file.size&&x.lastModified===file.lastModified);
  if(existing)continue;
  const record={id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,lastModified:file.lastModified,category:sharedCategory(file.name),blob:file};
  await sharedPut("files",record);
  sharedFiles.push(record);
 }
 renderSharedRepo();
}
async function useSharedFile(id){
 const record=sharedFiles.find(x=>x.id===id);
 if(!record||!frame?.contentWindow)return;
 if(activeTool==="builder"){alert("Schedule Builder intentionally uses its own independent repository.");return}
 frame.contentWindow.postMessage({type:"pc-use-shared-file",file:record},"*");
 statusNode.textContent=`Sent ${record.name} to ${TOOL_CONFIG[activeTool]?.name||"active tool"}`;
}
sharedFileInput?.addEventListener("change",async()=>{await addSharedFiles(sharedFileInput.files);sharedFileInput.value=""});
sharedProjectName?.addEventListener("change",async()=>{sharedProject=sharedProjectName.value.trim()||"Untitled project";await sharedPut("meta",{key:"projectName",value:sharedProject})});
sharedNewProject?.addEventListener("click",async()=>{if(!confirm("Clear the shared repository and start a new shared project?"))return;await sharedClear();sharedFiles=[];sharedProject="Untitled project";renderSharedRepo()});
window.ProjectControlsSharedRepository={
 getSnapshot:()=>({projectName:sharedProject,files:sharedFiles.slice()}),
 useFile:useSharedFile
};
loadSharedRepo();

const aiSettingsButton=document.getElementById("aiSettingsButton");
const aiModal=document.getElementById("aiModal");
const aiModalClose=document.getElementById("aiModalClose");
const omniBaseUrl=document.getElementById("omniBaseUrl");
const omniEndpointKey=document.getElementById("omniEndpointKey");
const aiDiagnostics=document.getElementById("aiDiagnostics");
const aiSaveButton=document.getElementById("aiSaveButton");
const aiTestButton=document.getElementById("aiTestButton");
const aiModalStatus=document.getElementById("aiModalStatus");

function openAiSettings(){
    const config=ProjectControlsCore.ai.config();
    omniBaseUrl.value=config.baseUrl;
    omniEndpointKey.value="";
    aiDiagnostics.hidden=true;
    aiDiagnostics.innerHTML="";
    aiModalStatus.textContent="";
    aiModal.hidden=false;
}

function closeAiSettings(){
    aiModal.hidden=true;
}

aiSettingsButton.addEventListener("click",openAiSettings);
aiModalClose.addEventListener("click",closeAiSettings);
aiModal.addEventListener("click",event=>{if(event.target===aiModal) closeAiSettings()});
aiSaveButton.addEventListener("click",()=>{
    ProjectControlsCore.ai.configure({
        baseUrl:omniBaseUrl.value,
        endpointKey:omniEndpointKey.value
    });
    omniEndpointKey.value="";
    aiModalStatus.textContent="OmniRoute settings saved.";
    statusNode.textContent="OmniRoute Auto · configured";
});
aiTestButton.addEventListener("click",async()=>{
    ProjectControlsCore.ai.configure({
        baseUrl:omniBaseUrl.value,
        endpointKey:omniEndpointKey.value
    });
    aiTestButton.disabled=true;
    aiDiagnostics.hidden=false;
    aiDiagnostics.innerHTML='<div class="diag-row working">1. Checking OmniRoute /v1/models…</div><div class="diag-row">2. Testing routed chat completion…</div>';
    aiModalStatus.textContent="Testing OmniRoute…";
    try{
        const result=await ProjectControlsCore.ai.testConnection();
        aiDiagnostics.innerHTML=
            `<div class="diag-row ok">✓ OmniRoute API reachable</div>`+
            `<div class="diag-row ok">✓ /v1/models responded${Number.isFinite(result.modelCount)?` · ${result.modelCount} model route(s)`:""}</div>`+
            `<div class="diag-row ok">✓ Chat routing responded: ${String(result.content||"OK").replace(/[<>&]/g,"")}</div>`+
            `<div class="diag-row info">Endpoint: ${result.baseUrl}</div>`+
            `<div class="diag-row info">Endpoint authentication: ${result.endpointKeyConfigured?"session key supplied":"keyless request"}</div>`;
        aiModalStatus.textContent="OmniRoute is connected and ready.";
        statusNode.textContent="OmniRoute Auto · connected";
    }catch(error){
        const message=error?.message || "OmniRoute connection failed.";
        aiDiagnostics.innerHTML=
            `<div class="diag-row error">✕ ${message.replace(/[<>&]/g,"")}</div>`+
            `<div class="diag-row info">Check that http://localhost:20128 opens in this browser and that at least one provider is connected inside OmniRoute.</div>`;
        aiModalStatus.textContent="Connection test failed.";
        statusNode.textContent="OmniRoute · connection required";
    }finally{
        omniEndpointKey.value="";
        aiTestButton.disabled=false;
    }
});

document.addEventListener("pc-theme-change",event=>{try{if(frame&&frame.contentWindow)frame.contentWindow.postMessage({type:"pc-theme",theme:event.detail.theme},"*")}catch(_){}});
window.addEventListener("message",event=>{if(event.data&&event.data.type==="pc-theme"){try{if(frame&&frame.contentWindow&&event.source!==frame.contentWindow)frame.contentWindow.postMessage(event.data,"*")}catch(_){}}});
