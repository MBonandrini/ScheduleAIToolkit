"use strict";

const TOOL_CONFIG = {
    contracts: { name: "Contract Manager", url: "./apps/contract-manager/index.html?sharedPane=1" },
    drawing: { name: "Drawing Measurement", url: "./apps/drawing-measurement/index.html?sharedPane=1" },
    assessment: { name: "Schedule Assessment", url: "./apps/schedule-assessment/index.html?sharedPane=1" },
    risk: { name: "Risk Analysis", url: "./apps/risk-analysis/index.html?sharedPane=1" },
    claims: { name: "Claims & Forensics", url: "./apps/claims-forensics/index.html?sharedPane=1" },
    notebook: { name: "NotebookLM+", url: "./apps/notebooklmplus/index.html" },
    settings: { name: "Settings", url: "./apps/settings/index.html" },
    builder: { name: "Schedule Builder", url: "./apps/schedule-builder/index.html" }
};

const host = document.getElementById("host");
const loading = document.getElementById("loading");
const statusNode = document.getElementById("status");
const globalModelSelect = document.getElementById("globalModelSelect");
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
    document.getElementById("workspaceShell")?.classList.toggle("builder-mode",key==="builder" || key==="notebook" || key==="settings");
    loading.hidden = false;
    loading.textContent = `Opening ${config.name}…`;
    if(statusNode) statusNode.textContent = `${ProjectControlsCore.ai.preferredLabel()} · switching tool`;
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
        if(statusNode) statusNode.textContent = ProjectControlsCore.ai.status().label === "AI idle" ? `${ProjectControlsCore.ai.preferredLabel()} · AI on demand` : ProjectControlsCore.ai.status().label;
        syncGlobalModelSelect();
        try{next.contentWindow.postMessage({type:"pc-theme",theme:document.documentElement.dataset.theme||"light"},"*")}catch(_){}
    }, { once: true });
    next.addEventListener("error", () => {
        if (run !== token) return;
        loading.hidden = false;
        loading.textContent = `Could not open ${config.name}. Check that ${config.url} exists in the deployed site.`;
        if(statusNode) statusNode.textContent = "Module failed to load";
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

function populateGlobalModelSelect(){
    if(!globalModelSelect) return;
    const groups=new Map();
    ProjectControlsCore.ai.catalog.filter(x=>!x.disabled).forEach(item=>{
        const key=item.engine==="omniroute"?"OmniRoute":item.engine==="ollama"?"Ollama":item.engine==="mlc"?"Browser WebGPU":"Browser CPU / WASM";
        if(!groups.has(key)) groups.set(key,[]); groups.get(key).push(item);
    });
    globalModelSelect.innerHTML=[...groups.entries()].map(([label,items])=>`<optgroup label="${label}">${items.map(item=>`<option value="${item.value}">${item.label}</option>`).join("")}</optgroup>`).join("");
    syncGlobalModelSelect();
}
function syncGlobalModelSelect(){ if(globalModelSelect) globalModelSelect.value=ProjectControlsCore.ai.preferred(); }
async function setGlobalModel(value){
    try{
        ProjectControlsCore.ai.setPreferred(value);
        await ProjectControlsCore.ai.release();
        syncGlobalModelSelect();
        document.querySelectorAll("iframe.tool-frame").forEach(f=>{try{f.contentWindow.postMessage({type:"pc-ai-config-changed",value},"*")}catch(_){}});
    }catch(error){ console.error("Could not change global AI model",error); syncGlobalModelSelect(); }
}
globalModelSelect?.addEventListener("change",e=>setGlobalModel(e.target.value));
populateGlobalModelSelect();

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
const bulkFolderList=document.getElementById("bulkFolderList");
const bulkFolderCount=document.getElementById("bulkFolderCount");
const bulkLinkFolder=document.getElementById("bulkLinkFolder");
const bulkFolderFallbackInput=document.getElementById("bulkFolderFallbackInput");
const SHARED_DB="ProjectControlsSharedRepositoryDB";
const SHARED_DB_VERSION=2;
let sharedFiles=[];
let sharedFolders=[];
let sharedProject="Untitled project";
function sharedDb(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(SHARED_DB,SHARED_DB_VERSION);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("files"))db.createObjectStore("files",{keyPath:"id"});if(!db.objectStoreNames.contains("meta"))db.createObjectStore("meta",{keyPath:"key"});if(!db.objectStoreNames.contains("folders"))db.createObjectStore("folders",{keyPath:"id"})};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
async function sharedGetAll(store){
 const db=await sharedDb();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(store,"readonly");
   const r=tx.objectStore(store).getAll();
   r.onsuccess=()=>resolve(r.result||[]);
   r.onerror=()=>reject(r.error);
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close()}
}
async function sharedPut(store,value){
 const db=await sharedDb();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(store,"readwrite");
   tx.objectStore(store).put(value);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close()}
}
async function sharedPutMany(store,values){
 if(!values.length)return;
 const db=await sharedDb();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(store,"readwrite");
   const objectStore=tx.objectStore(store);
   for(const value of values)objectStore.put(value);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
   tx.onabort=()=>reject(tx.error||new Error("Bulk repository transaction was aborted."));
  });
 }finally{db.close()}
}
async function sharedDelete(store,key){
 const db=await sharedDb();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(store,"readwrite");
   tx.objectStore(store).delete(key);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close()}
}
async function sharedDeleteFolderFiles(folderId){
 const db=await sharedDb();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction("files","readwrite");
   const store=tx.objectStore("files");
   const request=store.openCursor();
   request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;if(cursor.value?.bulkFolderId===folderId)cursor.delete();cursor.continue()};
   request.onerror=()=>reject(request.error);
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close()}
}
async function sharedClear(){
 const db=await sharedDb();
 try{
  return await new Promise((resolve,reject)=>{
   const tx=db.transaction(["files","meta","folders"],"readwrite");
   tx.objectStore("files").clear();
   tx.objectStore("meta").clear();
   tx.objectStore("folders").clear();
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close()}
}
function sharedCategory(name){
 const ext=(name.split(".").pop()||"").toLowerCase();
 if(["xer","xml"].includes(ext))return "Schedules";
 if(["pdf","docx","txt","md"].includes(ext))return "Contracts & Claims";
 if(["xlsx","xls","csv"].includes(ext))return "Drawings & Quantity";
 return "Other Evidence";
}
function sharedIcon(name){const e=(name.split(".").pop()||"").toLowerCase();if(e==="xer")return"P6";if(e==="xml")return"XML";if(e==="pdf")return"PDF";if(["xlsx","xls","csv"].includes(e))return"≣";return"□"}
function bytes(v){if(v<1024)return`${v} B`;if(v<1048576)return`${(v/1024).toFixed(1)} KB`;return`${(v/1048576).toFixed(1)} MB`}
function escapeShellHTML(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]))}
function renderSharedRepo(){
 sharedProjectName.value=sharedProject;
 sharedCount.textContent=String(sharedFiles.length);
 const groups=["Schedules","Contracts & Claims","Drawings & Quantity","Other Evidence"];
 sharedRepoList.innerHTML=groups.map(group=>{
  const files=sharedFiles.filter(f=>f.category===group&&!f.bulkFolderId);
  const safeGroup=escapeShellHTML(group);
  return `<section class="shared-section"><div class="shared-section-title"><span>${safeGroup}</span><span>${files.length}</span></div>${files.length?files.map(f=>{const safeName=escapeShellHTML(f.name);const safeId=escapeShellHTML(f.id);return `<div class="shared-file"><div class="shared-file-icon">${escapeShellHTML(sharedIcon(f.name))}</div><div><div class="shared-file-name" title="${safeName}">${safeName}</div><div class="shared-file-meta">${bytes(f.size||0)}</div></div><button class="shared-use" data-shared-use="${safeId}" type="button">Use</button></div>`}).join(""):`<div class="shared-empty">No ${safeGroup.toLowerCase()} files</div>`}</section>`;
 }).join("");
 sharedRepoList.querySelectorAll("[data-shared-use]").forEach(button=>button.addEventListener("click",()=>useSharedFile(button.dataset.sharedUse)));
}
function bulkTree(records){
 const root={dirs:new Map(),files:[]};
 for(const record of records){
  const parts=String(record.relativePath||record.name||"").split("/").filter(Boolean);
  const fileName=parts.pop()||record.name;
  let node=root;
  for(const part of parts){if(!node.dirs.has(part))node.dirs.set(part,{dirs:new Map(),files:[]});node=node.dirs.get(part)}
  node.files.push({...record,displayName:fileName});
 }
 return root;
}
function renderBulkNode(node){
 const dirs=[...node.dirs.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,child])=>`<details class="bulk-tree-dir"><summary>${escapeShellHTML(name)}</summary><div class="bulk-tree-children">${renderBulkNode(child)}</div></details>`).join("");
 const files=node.files.sort((a,b)=>a.displayName.localeCompare(b.displayName)).map(f=>`<div class="bulk-file"><div class="bulk-file-icon">${escapeShellHTML(sharedIcon(f.name))}</div><div class="bulk-file-name" title="${escapeShellHTML(f.relativePath||f.name)}">${escapeShellHTML(f.displayName)}</div><button class="shared-use" data-bulk-use="${escapeShellHTML(f.id)}" type="button">Use</button></div>`).join("");
 return dirs+files;
}
function renderBulkFolders(){
 if(!bulkFolderList)return;
 bulkFolderCount.textContent=String(sharedFolders.length);
 if(!sharedFolders.length){bulkFolderList.innerHTML='<div class="bulk-empty">No linked folders yet. Link a project folder to make its files available across the shared tools.</div>';return}
 bulkFolderList.innerHTML=sharedFolders.map(folder=>{
  const records=sharedFiles.filter(f=>f.bulkFolderId===folder.id);
  const tree=bulkTree(records);
  const mode=folder.handle?"linked":"local snapshot";
  return `<details class="bulk-folder" data-bulk-folder="${escapeShellHTML(folder.id)}"><summary><span class="bulk-folder-name" title="${escapeShellHTML(folder.name)}">${escapeShellHTML(folder.name)}</span><span class="bulk-folder-meta">${records.length} · ${mode}</span></summary><div class="bulk-folder-body">${renderBulkNode(tree)}<div class="bulk-folder-tools">${folder.handle?`<button type="button" data-bulk-refresh="${escapeShellHTML(folder.id)}">↻ Refresh</button>`:""}<button type="button" data-bulk-unlink="${escapeShellHTML(folder.id)}">Unlink</button></div></div></details>`;
 }).join("");
 bulkFolderList.querySelectorAll('[data-bulk-use]').forEach(button=>button.addEventListener('click',()=>useSharedFile(button.dataset.bulkUse)));
 bulkFolderList.querySelectorAll('[data-bulk-refresh]').forEach(button=>button.addEventListener('click',()=>refreshBulkFolder(button.dataset.bulkRefresh)));
 bulkFolderList.querySelectorAll('[data-bulk-unlink]').forEach(button=>button.addEventListener('click',()=>unlinkBulkFolder(button.dataset.bulkUnlink)));
}
async function collectDirectoryHandle(handle,folderId,pathPrefix=""){
 const records=[];
 for await(const [name,entry] of handle.entries()){
  if(name.startsWith('.'))continue;
  const relativePath=pathPrefix?`${pathPrefix}/${name}`:name;
  if(entry.kind==='directory') records.push(...await collectDirectoryHandle(entry,folderId,relativePath));
  else if(entry.kind==='file'){
   const file=await entry.getFile();
   records.push({id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,lastModified:file.lastModified,category:sharedCategory(file.name),bulkFolderId:folderId,relativePath,sourceKind:'directory-handle'});
  }
 }
 return records;
}
async function replaceBulkFolderRecords(folderId,records){
 await sharedDeleteFolderFiles(folderId);
 sharedFiles=sharedFiles.filter(f=>f.bulkFolderId!==folderId);
 await sharedPutMany('files',records);
 sharedFiles.push(...records);
 renderBulkFolders();renderSharedRepo();
}
async function linkDirectoryHandle(){
 const handle=await window.showDirectoryPicker({mode:'read'});
 const folder={id:crypto.randomUUID(),name:handle.name,handle,linkedAt:Date.now(),sourceKind:'directory-handle'};
 let records=await collectDirectoryHandle(handle,folder.id);
 if(records.length>5000&&!confirm(`${handle.name} contains ${records.length} files. Indexing very large folder trees may slow the left pane. Link it anyway?`))return;
 try{await sharedPut('folders',folder)}catch(error){
  console.warn('Directory handle could not be persisted; using local snapshot fallback.',error);
  throw error;
 }
 sharedFolders.push(folder);
 await replaceBulkFolderRecords(folder.id,records);
}
async function refreshBulkFolder(folderId){
 const folder=sharedFolders.find(f=>f.id===folderId);if(!folder?.handle)return;
 try{
  let permission=await folder.handle.queryPermission?.({mode:'read'});
  if(permission!=='granted')permission=await folder.handle.requestPermission?.({mode:'read'});
  if(permission!=='granted')throw new Error('Folder permission was not granted.');
  const records=await collectDirectoryHandle(folder.handle,folder.id);
  folder.linkedAt=Date.now();await sharedPut('folders',folder);await replaceBulkFolderRecords(folder.id,records);
 }catch(error){alert(`Could not refresh ${folder.name}: ${error.message||error}`)}
}
async function unlinkBulkFolder(folderId){
 const folder=sharedFolders.find(f=>f.id===folderId);if(!folder)return;
 if(!confirm(`Unlink ${folder.name} from Bulk Information? No files on your computer will be deleted.`))return;
 await sharedDeleteFolderFiles(folderId);await sharedDelete('folders',folderId);
 sharedFiles=sharedFiles.filter(f=>f.bulkFolderId!==folderId);sharedFolders=sharedFolders.filter(f=>f.id!==folderId);
 renderBulkFolders();renderSharedRepo();
}
async function addBulkFallbackFiles(fileList){
 const files=[...fileList];if(!files.length)return;
 const firstPath=files[0].webkitRelativePath||files[0].name;
 const folderName=firstPath.split('/')[0]||'Selected folder';
 const folder={id:crypto.randomUUID(),name:folderName,linkedAt:Date.now(),sourceKind:'folder-snapshot'};
 let total=files.reduce((sum,f)=>sum+(f.size||0),0);
 if(total>250*1024*1024&&!confirm(`${folderName} is approximately ${bytes(total)}. This browser fallback stores a local snapshot and may use substantial storage. Continue?`))return;
 await sharedPut('folders',folder);sharedFolders.push(folder);
 const records=[];
 for(const file of files){
  const relative=(file.webkitRelativePath||file.name).split('/').slice(1).join('/')||file.name;
  records.push({id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,lastModified:file.lastModified,category:sharedCategory(file.name),bulkFolderId:folder.id,relativePath:relative,sourceKind:'folder-snapshot',blob:file});
 }
 await replaceBulkFolderRecords(folder.id,records);
}
async function resolveBulkFile(record){
 if(record.blob)return record.blob;
 const folder=sharedFolders.find(f=>f.id===record.bulkFolderId);if(!folder?.handle)throw new Error('The linked folder is no longer available. Relink or refresh it under Bulk Information.');
 let permission=await folder.handle.queryPermission?.({mode:'read'});
 if(permission!=='granted')permission=await folder.handle.requestPermission?.({mode:'read'});
 if(permission!=='granted')throw new Error('Permission to this folder is required. Select the linked folder and allow read access, or refresh/relink it.');
 let handle=folder.handle;
 const parts=String(record.relativePath||record.name).split('/').filter(Boolean);
 const fileName=parts.pop();
 for(const part of parts)handle=await handle.getDirectoryHandle(part);
 const fileHandle=await handle.getFileHandle(fileName);
 return await fileHandle.getFile();
}
async function loadSharedRepo(){
 try{
  sharedFiles=await sharedGetAll("files");
  sharedFolders=await sharedGetAll("folders");
  const meta=await sharedGetAll("meta");
  sharedProject=meta.find(x=>x.key==="projectName")?.value||"Untitled project";
 }catch(error){console.warn("Shared repository unavailable",error);sharedFiles=[];sharedFolders=[]}
 renderSharedRepo();
 renderBulkFolders();
}
async function addSharedFiles(fileList){
 for(const file of [...fileList]){
  const existing=sharedFiles.find(x=>x.name===file.name&&x.size===file.size&&x.lastModified===file.lastModified);
  if(existing)continue;
  if(file.size>75*1024*1024 && !confirm(`${file.name} is ${bytes(file.size)}. Very large browser-held files can increase RAM use and slow the suite. Add it anyway?`))continue;
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
 try{
  const payload=record.bulkFolderId?{...record,blob:await resolveBulkFile(record)}:record;
  frame.contentWindow.postMessage({type:"pc-use-shared-file",file:payload},"*");
  if(statusNode) statusNode.textContent=`Sent ${record.name} to ${TOOL_CONFIG[activeTool]?.name||"active tool"}`;
 }catch(error){alert(`Could not open ${record.name}: ${error.message||error}`)}
}
sharedFileInput?.addEventListener("change",async()=>{await addSharedFiles(sharedFileInput.files);sharedFileInput.value=""});
sharedProjectName?.addEventListener("change",async()=>{sharedProject=sharedProjectName.value.trim()||"Untitled project";await sharedPut("meta",{key:"projectName",value:sharedProject})});
sharedNewProject?.addEventListener("click",async()=>{if(!confirm("Clear the shared repository and start a new shared project?"))return;await sharedClear();sharedFiles=[];sharedFolders=[];sharedProject="Untitled project";renderSharedRepo();renderBulkFolders()});
bulkLinkFolder?.addEventListener("click",async()=>{
 if("showDirectoryPicker" in window){
  try{await linkDirectoryHandle();return}catch(error){if(error?.name==="AbortError")return;console.warn("Folder handle link failed; falling back to directory selection.",error)}
 }
 bulkFolderFallbackInput?.click();
});
bulkFolderFallbackInput?.addEventListener("change",async()=>{try{await addBulkFallbackFiles(bulkFolderFallbackInput.files)}finally{bulkFolderFallbackInput.value=""}});
window.ProjectControlsSharedRepository={
 getSnapshot:()=>({projectName:sharedProject,files:sharedFiles.slice(),folders:sharedFolders.map(({handle,...folder})=>folder)}),
 useFile:useSharedFile
};
loadSharedRepo();

document.addEventListener("pc-theme-change",event=>{try{if(frame&&frame.contentWindow)frame.contentWindow.postMessage({type:"pc-theme",theme:event.detail.theme},"*")}catch(_){}});
window.addEventListener("message",event=>{if(event.data&&event.data.type==="pc-theme"){try{if(frame&&frame.contentWindow&&event.source!==frame.contentWindow)frame.contentWindow.postMessage(event.data,"*")}catch(_){}}});

window.addEventListener("unhandledrejection",event=>{
    const message=event.reason?.message||String(event.reason||"");
    if(message && /OmniRoute|AI|fetch|network/i.test(message) && statusNode) statusNode.textContent="AI connection issue · open Settings";
});

window.addEventListener("message",event=>{
    if(event.data&&event.data.type==="pc-open-settings") activateTool("settings");
    if(event.data&&event.data.type==="pc-ai-config-changed"){ if(statusNode) statusNode.textContent=`${ProjectControlsCore.ai.preferredLabel()} · configured`; syncGlobalModelSelect(); }
    if(event.data&&event.data.type==="pc-notebook-performance-changed" && frame?.contentWindow) frame.contentWindow.postMessage(event.data,"*");
});
