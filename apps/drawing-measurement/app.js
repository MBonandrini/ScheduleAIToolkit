import {
    createClient
} from "https://esm.sh/@webllm-io/sdk";

import {
    pipeline,
    TextStreamer
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1";

const MODEL_CATALOG = [
    { value:"omniroute:auto", engine:"omniroute", id:"auto", label:"OmniRoute — Auto (default)" },
    { value:"omniroute:auto/smart", engine:"omniroute", id:"auto/smart", label:"OmniRoute — Smart" },
    { value:"omniroute:auto/fast", engine:"omniroute", id:"auto/fast", label:"OmniRoute — Fast" },
    { value:"omniroute:auto/cheap", engine:"omniroute", id:"auto/cheap", label:"OmniRoute — Cheap" },
    { value:"omniroute:auto/coding", engine:"omniroute", id:"auto/coding", label:"OmniRoute — Coding" },
    { value:"omniroute:auto/offline", engine:"omniroute", id:"auto/offline", label:"OmniRoute — Offline/local" },
    { value:"browserlite:onnx-community/Qwen2.5-0.5B-Instruct", engine:"browserlite", id:"onnx-community/Qwen2.5-0.5B-Instruct", label:"Lightweight Browser AI — Qwen2.5 0.5B" },

    { value:"webllmio:high",   engine:"webllmio", tier:"high",   id:"Qwen3-8B-q4f16_1-MLC",              label:"Auto-routed — High quality (Qwen3 8B)" },
    { value:"webllmio:medium", engine:"webllmio", tier:"medium", id:"Qwen2.5-3B-Instruct-q4f16_1-MLC",   label:"Auto-routed — Balanced (Qwen2.5 3B)" },
    { value:"webllmio:low",    engine:"webllmio", tier:"low",    id:"Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label:"Auto-routed — Fast (Qwen2.5 1.5B)" },

    { value:"mlc:Llama-3.2-1B-Instruct-q4f16_1-MLC", engine:"mlc", id:"Llama-3.2-1B-Instruct-q4f16_1-MLC", label:"MLC direct — Fast (Llama 3.2 1B)" },
    { value:"mlc:Llama-3.2-3B-Instruct-q4f16_1-MLC", engine:"mlc", id:"Llama-3.2-3B-Instruct-q4f16_1-MLC", label:"MLC direct — Balanced (Llama 3.2 3B)" },
    { value:"mlc:Phi-3.5-mini-instruct-q4f16_1-MLC", engine:"mlc", id:"Phi-3.5-mini-instruct-q4f16_1-MLC", label:"MLC direct — Higher quality (Phi-3.5 Mini)" },
    { value:"mlc:Llama-3.1-8B-Instruct-q4f16_1-MLC", engine:"mlc", id:"Llama-3.1-8B-Instruct-q4f16_1-MLC", label:"MLC direct — Best quality, largest (Llama 3.1 8B)" },

    { value:"cpu:onnx-community/Qwen2.5-0.5B-Instruct",   engine:"cpu", id:"onnx-community/Qwen2.5-0.5B-Instruct",   label:"CPU / WASM — Fast (Qwen2.5 0.5B)" },
    { value:"cpu:onnx-community/Llama-3.2-1B-Instruct",   engine:"cpu", id:"onnx-community/Llama-3.2-1B-Instruct",   label:"CPU / WASM — Better quality (Llama 3.2 1B)" },
];


const GPU_MODELS = {
    high:   MODEL_CATALOG.find(m => m.engine === "webllmio" && m.tier === "high").id,
    medium: MODEL_CATALOG.find(m => m.engine === "webllmio" && m.tier === "medium").id,
    low:    MODEL_CATALOG.find(m => m.engine === "webllmio" && m.tier === "low").id,
};

const CPU_MAX_SOURCE_CHARS =
    10000;

const CPU_MAX_TOTAL_CONTEXT_CHARS =
    30000;

const CONTRACT_FOLDERS = [
    {id:"contract", name:"Contract Documents", icon:"§"},
    {id:"scope", name:"Scope Documents", icon:"◫"},
    {id:"schedule", name:"Schedule", icon:"▦"},
    {id:"boq", name:"Bill of Quantities", icon:"≣"},
    {id:"drawings", name:"Drawings", icon:"⌗"},
    {id:"cables", name:"Cable Schedules", icon:"⌁"}
]

let client = null;
let mlcClient = null;
let cpuGenerator = null;

let engineMode = null;

let currentModelValue = "browserlite:onnx-community/Qwen2.5-0.5B-Instruct";
let aiReady = false;
let aiBusy = false;

let sources = [];
let conversation = [];

let recommendations = [];
let measurements = [];
let norms = [];

let weeklyFolders = [];

let currentFolder = "contract";
let currentProjectId = null;
let currentProjectName = "Untitled project";

let currentDocument = null;

let saveTimer = null;

const chat =
    document.getElementById("chat");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

function setEngineStatus(
    mode,
    statusText,
    state="loading"
){

    const dot =
        document.getElementById(
            "engineDot"
        );

    const status =
        document.getElementById(
            "engineStatus"
        );

    dot.className =
        `engine-dot ${state}`;

    status.textContent =
        statusText;
}

const DB_NAME =
    "ScheduleContractManagementDB";

const DB_VERSION = 1;

const PROJECT_STORE =
    "projects";

function openDatabase(){

    return new Promise(
        (resolve,reject)=>{

            const request =
                indexedDB.open(
                    DB_NAME,
                    DB_VERSION
                );

            request.onupgradeneeded =
                event=>{

                    const db =
                        event.target.result;

                    if(
                        !db.objectStoreNames
                            .contains(
                                PROJECT_STORE
                            )
                    ){

                        const store =
                            db.createObjectStore(
                                PROJECT_STORE,
                                {
                                    keyPath:"id"
                                }
                            );

                        store.createIndex(
                            "updatedAt",
                            "updatedAt"
                        );
                    }
                };

            request.onsuccess =
                ()=>resolve(
                    request.result
                );

            request.onerror =
                ()=>reject(
                    request.error
                );
        }
    );
}

async function saveProjectToDatabase(){

    if(!currentProjectId){

        currentProjectId =
            crypto.randomUUID();
    }

    const project = {

        id:currentProjectId,

        name:currentProjectName,

        sources:sources,

        conversation:conversation,

        recommendations:recommendations,

        weeklyFolders:weeklyFolders,

        currentFolder:currentFolder,

        updatedAt:Date.now()
    };

    const db =
        await openDatabase();

    return new Promise(
        (resolve,reject)=>{

            const transaction =
                db.transaction(
                    PROJECT_STORE,
                    "readwrite"
                );

            transaction
                .objectStore(
                    PROJECT_STORE
                )
                .put(project);

            transaction.oncomplete =
                ()=>{

                    db.close();

                    resolve();
                };

            transaction.onerror =
                ()=>{

                    db.close();

                    reject(
                        transaction.error
                    );
                };
        }
    );
}

async function getSavedProjects(){

    const db =
        await openDatabase();

    return new Promise(
        (resolve,reject)=>{

            const request =
                db
                    .transaction(
                        PROJECT_STORE,
                        "readonly"
                    )
                    .objectStore(
                        PROJECT_STORE
                    )
                    .getAll();

            request.onsuccess =
                ()=>{

                    db.close();

                    resolve(
                        request.result.sort(
                            (a,b)=>
                                b.updatedAt -
                                a.updatedAt
                        )
                    );
                };

            request.onerror =
                ()=>{

                    db.close();

                    reject(
                        request.error
                    );
                };
        }
    );
}

async function loadProject(id){

    const db =
        await openDatabase();

    return new Promise(
        (resolve,reject)=>{

            const request =
                db
                    .transaction(
                        PROJECT_STORE,
                        "readonly"
                    )
                    .objectStore(
                        PROJECT_STORE
                    )
                    .get(id);

            request.onsuccess =
                ()=>{

                    db.close();

                    resolve(
                        request.result
                    );
                };

            request.onerror =
                ()=>{

                    db.close();

                    reject(
                        request.error
                    );
                };
        }
    );
}

async function deleteProject(id){

    const db =
        await openDatabase();

    return new Promise(
        (resolve,reject)=>{

            const request =
                db
                    .transaction(
                        PROJECT_STORE,
                        "readwrite"
                    )
                    .objectStore(
                        PROJECT_STORE
                    )
                    .delete(id);

            request.onsuccess =
                ()=>{

                    db.close();

                    resolve();
                };

            request.onerror =
                ()=>{

                    db.close();

                    reject(
                        request.error
                    );
                };
        }
    );
}

window.saveCurrentProject =
async function(){

    try{

        updateSaveStatus(
            "Saving..."
        );

        await saveProjectToDatabase();

        updateSaveStatus(
            "Saved locally ✓"
        );

    }catch(error){

        console.error(
            error
        );

        updateSaveStatus(
            "Save failed"
        );
    }
};

function scheduleAutoSave(){

    clearTimeout(
        saveTimer
    );

    updateSaveStatus(
        "Changes pending..."
    );

    saveTimer =
        setTimeout(
            ()=>saveCurrentProject(),
            900
        );
}

function updateSaveStatus(text){

    document
        .getElementById(
            "saveStatus"
        )
        .textContent =
        text;
}

window.setProjectName =
function(name){

    currentProjectName =
        String(
            name || ""
        ).trim() ||
        "Untitled project";

    document
        .getElementById(
            "projectTitle"
        )
        .textContent =
        currentProjectName;

    document
        .getElementById(
            "projectNameInput"
        )
        .value =
        currentProjectName;

    scheduleAutoSave();
};

function renderFolders(){

    const container =
        document.getElementById(
            "folderList"
        );

    container.innerHTML = "";

    CONTRACT_FOLDERS.forEach(
        folder=>{

            const count =
                sources.filter(
                    source =>
                        source.folder ===
                        folder.id
                ).length;

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "folder" +
                (
                    currentFolder ===
                    folder.id
                        ? " active"
                        : ""
                );

            button.innerHTML = `

                <div class="folder-icon">
                    ${folder.icon}
                </div>

                <div class="folder-text">

                    <div class="folder-name">
                        ${escapeHtml(
                            folder.name
                        )}
                    </div>

                </div>

                <div class="folder-count">
                    ${count}
                </div>
            `;

            button.onclick =
                ()=>selectFolder(
                    folder.id
                );

            container.appendChild(
                button
            );
        }
    );

    renderWeeklyFolders();
}

function selectFolder(folderId){

    currentFolder =
        folderId;

    renderFolders();

    updateProjectMeta();

    renderSourcesForSelectedFolder();
}

function getFolderName(folderId){

    const standard =
        CONTRACT_FOLDERS.find(
            folder =>
                folder.id ===
                folderId
        );

    if(standard)
        return standard.name;

    const week =
        weeklyFolders.find(
            item =>
                item.id ===
                folderId
        );

    return week
        ? week.name
        : "Other information";
}

function renderWeeklyFolders(){

    const container =
        document.getElementById(
            "weeklyFolders"
        );

    container.innerHTML = "";

    if(!weeklyFolders.length){

        container.innerHTML = `
            <div style="
                padding:5px 4px 7px;
                color:#aaa;
                font-size:7px;
            ">
                Add folders for weekly reports.
            </div>
        `;

        return;
    }

    weeklyFolders.forEach(
        week=>{

            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.className =
                "week" +
                (
                    week.open
                        ? " open"
                        : ""
                );

            const header =
                document.createElement(
                    "button"
                );

            header.className =
                "week-header";

            const fileCount =
                sources.filter(
                    source =>
                        source.folder ===
                        week.id
                ).length;

            header.innerHTML = `

                <span class="week-arrow">
                    ${week.open ? "▾" : "▸"}
                </span>

                <span class="week-icon">
                    📁
                </span>

                <span class="week-name">
                    ${escapeHtml(
                        week.name
                    )}
                </span>

                <span class="folder-count">
                    ${fileCount}
                </span>
            `;

            header.onclick =
                ()=>{

                    week.open =
                        !week.open;

                    renderWeeklyFolders();
                };

            wrapper.appendChild(
                header
            );

            const files =
                document.createElement(
                    "div"
                );

            files.className =
                "week-files";

            sources
                .filter(
                    source =>
                        source.folder ===
                        week.id
                )
                .forEach(
                    source=>{

                        const button =
                            document.createElement(
                                "button"
                            );

                        button.className =
                            "week-file";

                        button.innerHTML = `

                            <span>
                                ${getFileIcon(
                                    source.name
                                )}
                            </span>

                            <span
                                class="week-file-name"
                                title="${escapeHtml(
                                    source.name
                                )}"
                            >
                                ${escapeHtml(
                                    source.name
                                )}
                            </span>
                        `;

                        button.onclick =
                            ()=>{

                                currentFolder =
                                    week.id;

                                renderFolders();

                                updateProjectMeta();

                                renderSourcesForSelectedFolder();
                            };

                        files.appendChild(
                            button
                        );
                    }
                );

            wrapper.appendChild(
                files
            );

            container.appendChild(
                wrapper
            );
        }
    );
}

window.addWeeklyFolder =
function(){

    const name =
        prompt(
            "Name the weekly report folder:",
            `Week commencing ${
                new Date()
                    .toISOString()
                    .slice(
                        0,
                        10
                    )
            }`
        );

    if(!name)
        return;

    weeklyFolders.push({

        id:
            "week-" +
            crypto.randomUUID(),

        name:
            name.trim(),

        open:true
    });

    currentFolder =
        weeklyFolders[
            weeklyFolders.length - 1
        ].id;

    renderFolders();

    updateProjectMeta();

    scheduleAutoSave();
};

window.handleFiles =
async function(fileList){

    const files =
        Array.from(
            fileList || []
        );

    if(!files.length)
        return;

    for(
        const file of files
    ){

        try{

            const text =
                await extractText(
                    file
                );

            if(
                !text ||
                !text.trim()
            ){

                continue;
            }

            sources.push({

                id:
                    crypto.randomUUID(),

                name:
                    file.name,

                size:
                    file.size,

                type:
                    file.type,

                folder:
                    currentFolder,

                text,

                uploadedAt:
                    Date.now()
            });

        }catch(error){

            console.error(
                error
            );

            alert(
                `Could not read "${file.name}".`
            );
        }
    }

    renderFolders();

    renderSourcesForSelectedFolder();

    updateProjectMeta();

    scheduleAutoSave();
};

async function extractText(file){
    return await window.parent.ProjectControlsCore.documents.extractText(file);
}

function loadPDFJS(){
    return window.parent.ProjectControlsCore.documents.ensurePDF();
}

function loadMammoth(){
    return window.parent.ProjectControlsCore.documents.ensureMammoth();
}

function renderSourcesForSelectedFolder(){

    const old =
        document.getElementById(
            "sourceDisplay"
        );

    if(old)
        old.remove();

    const container =
        document.querySelector(
            ".sidebar-scroll"
        );

    const section =
        document.createElement(
            "div"
        );

    section.id =
        "sourceDisplay";

    section.style.marginTop =
        "12px";

    const folderSources =
        sources.filter(
            source =>
                source.folder ===
                currentFolder
        );

    const heading =
        document.createElement(
            "div"
        );

    heading.className =
        "sidebar-heading";

    heading.innerHTML = `

        <span>
            ${escapeHtml(
                getFolderName(
                    currentFolder
                )
            )}
        </span>

        <span>
            ${folderSources.length}
        </span>
    `;

    section.appendChild(
        heading
    );

    if(!folderSources.length){

        const empty =
            document.createElement(
                "div"
            );

        empty.style.cssText =
            `
            padding:8px 5px;
            color:#aaa;
            font-size:7px;
            line-height:1.5;
            `;

        empty.textContent =
            "No documents in this folder yet.";

        section.appendChild(
            empty
        );

    }else{

        folderSources.forEach(
            source=>{

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "week-file";

                item.style.cssText =
                    `
                    width:100%;
                    display:flex;
                    align-items:center;
                    gap:7px;
                    margin-bottom:2px;
                    `;

                item.innerHTML = `

                    <span>
                        ${getFileIcon(
                            source.name
                        )}
                    </span>

                    <span
                        class="week-file-name"
                        style="flex:1"
                        title="${escapeHtml(
                            source.name
                        )}"
                    >
                        ${escapeHtml(
                            source.name
                        )}
                    </span>

                    <button
                        title="Remove"
                        style="
                            border:0;
                            background:transparent;
                            color:#aaa;
                            padding:2px 4px;
                        "
                    >
                        ×
                    </button>
                `;

                item
                    .querySelector(
                        "button"
                    )
                    .onclick =
                    ()=>{

                        sources =
                            sources.filter(
                                entry =>
                                    entry.id !==
                                    source.id
                            );

                        renderFolders();

                        renderSourcesForSelectedFolder();

                        updateProjectMeta();

                        scheduleAutoSave();
                    };

                section.appendChild(
                    item
                );
            }
        );
    }

    container.appendChild(
        section
    );
}

function getFileIcon(name){

    const extension =
        name
            .split(".")
            .pop()
            .toLowerCase();

    if(extension === "pdf")
        return "PDF";

    if(extension === "docx")
        return "DOC";

    if(
        extension === "xlsx" ||
        extension === "xls"
    )
        return "XLS";

    if(extension === "csv")
        return "CSV";

    if(extension === "json")
        return "{}";

    if(extension === "md")
        return "MD";

    return "TXT";
}

function formatBytes(bytes){

    if(bytes < 1024)
        return `${bytes} B`;

    if(bytes < 1024 * 1024){

        return `${(
            bytes / 1024
        ).toFixed(1)} KB`;
    }

    return `${(
        bytes /
        1024 /
        1024
    ).toFixed(1)} MB`;
}

function updateProjectMeta(){

    const meta =
        document.getElementById(
            "projectMeta"
        );

    const total =
        sources.length;

    const folderCount =
        sources.filter(
            source =>
                source.folder ===
                currentFolder
        ).length;

    if(!total){

        meta.textContent =
            "Upload contract information to begin";

        return;
    }

    meta.textContent =
        `${total} source${
            total === 1
                ? ""
                : "s"
        } · ${getFolderName(
            currentFolder
        )}: ${folderCount}`;
}

window.handleDragOver =
function(event){

    event.preventDefault();

    document
        .getElementById(
            "uploadZone"
        )
        .classList.add(
            "dragging"
        );
};

window.handleDragLeave =
function(){

    document
        .getElementById(
            "uploadZone"
        )
        .classList.remove(
            "dragging"
        );
};

window.handleDrop =
function(event){

    event.preventDefault();

    document
        .getElementById(
            "uploadZone"
        )
        .classList.remove(
            "dragging"
        );

    handleFiles(
        event.dataTransfer.files
    );
};

function trimAIConversation(){
    return conversation.slice(-12).map(message=>({role:message.role,content:String(message.content||"").slice(0,6000)}));
}

function buildSourceContext(){
    if(!sources.length){
        return `
No project documents have been uploaded.

Do not invent project-specific facts.
`;
    }
    const MAX_PER_SOURCE=14000;
    const MAX_TOTAL=60000;
    let total=0;
    const blocks=[];
    for(let index=0;index<sources.length;index++){
        const source=sources[index];
        const remaining=MAX_TOTAL-total;
        if(remaining<=0){
            blocks.push(`\n[${sources.length-index} more source(s) omitted because the AI context limit was reached]\n`);
            break;
        }
        const allowed=Math.min(MAX_PER_SOURCE,remaining);
        const block=`
SOURCE ${index+1}
CATEGORY: ${getFolderName(source.folder)}
FILE: ${source.name}

${source.text.slice(0,allowed)}

END SOURCE ${index+1}
`;
        blocks.push(block);
        total+=block.length;
    }
    return blocks.join("\n\n");
}

function buildCPUSourceContext(){

    if(!sources.length){

        return `
No project documents have been uploaded.

Do not invent project-specific facts.
`;
    }

    let total = 0;

    const blocks = [];

    for(
        let index = 0;
        index < sources.length;
        index++
    ){

        const source =
            sources[index];

        const remaining =
            CPU_MAX_TOTAL_CONTEXT_CHARS -
            total;

        if(remaining <= 0)
            break;

        const allowed =
            Math.min(
                CPU_MAX_SOURCE_CHARS,
                remaining
            );

        const text =
            source.text.slice(
                0,
                allowed
            );

        const block = `
SOURCE ${index + 1}
CATEGORY: ${getFolderName(
            source.folder
        )}
FILE: ${source.name}

${text}

END SOURCE ${index + 1}
`;

        blocks.push(
            block
        );

        total +=
            block.length;
    }

    if(
        sources.length >
        blocks.length
    ){

        blocks.push(
            "[CPU fallback: some documents were truncated.]"
        );
    }

    return blocks.join(
        "\n\n"
    );
}

let modelSwitchInFlight = false;

function disposeAIClients(){
    aiReady = false;
    engineMode = null;
    return Promise.resolve();
}

function findModelEntry(value){
    return MODEL_CATALOG.find(m => m.value === value) ||
           MODEL_CATALOG.find(m => m.value === "omniroute:auto") ||
           MODEL_CATALOG.find(m => String(m.value).includes("Qwen2.5-0.5B")) ||
           MODEL_CATALOG[0];
}

async function initialiseAssistant(){
    if(aiReady) return;

    const preferred =
        localStorage.getItem("projectControlsSharedAIModel") ||
        (MODEL_CATALOG.some(m => m.value === "omniroute:auto")
            ? "omniroute:auto"
            : (MODEL_CATALOG.find(m => String(m.value).includes("Qwen2.5-0.5B"))?.value || MODEL_CATALOG[0].value));

    await window.parent.ProjectControlsCore.ai.ensure(preferred);
    currentModelValue = preferred;
    aiReady = true;
    engineMode = window.parent.ProjectControlsCore.ai.status().engine;

    const modelSelect = document.getElementById("modelSelect");
    if(modelSelect && [...modelSelect.options].some(o => o.value === preferred)){
        modelSelect.value = preferred;
    }

    setEngineStatus(engineMode, window.parent.ProjectControlsCore.ai.status().label, "ready");
    updateSendButton?.();
}


window.changeModel = async function(value){
    if(modelSwitchInFlight) return;
    modelSwitchInFlight = true;
    aiReady = false;

    const modelSelect=document.getElementById("modelSelect");
    if(modelSelect) modelSelect.disabled=true;

    try{
        setEngineStatus(null,"Loading shared AI…","loading");
        await window.parent.ProjectControlsCore.ai.ensure(value);
        currentModelValue=value;
        aiReady=true;
        engineMode=window.parent.ProjectControlsCore.ai.status().engine;
        localStorage.setItem("projectControlsSharedAIModel",value);
        setEngineStatus(engineMode,window.parent.ProjectControlsCore.ai.status().label,"ready");
    }catch(error){
        setEngineStatus(null,error?.message||"AI unavailable","error");
        aiReady=false;
        throw error;
    }finally{
        modelSwitchInFlight=false;
        if(modelSelect) modelSelect.disabled=false;
        updateSendButton?.();
    }
};

async function runAI(messages,options={}){
    await ensureAssistantReady();
    const select=document.getElementById("modelSelect");
    const requested=select?.value || currentModelValue || localStorage.getItem("projectControlsSharedAIModel") || "omniroute:auto";
    await window.parent.ProjectControlsCore.ai.ensure(requested);
    currentModelValue=requested;
    engineMode=window.parent.ProjectControlsCore.ai.status().engine;
    return await window.parent.ProjectControlsCore.ai.run(messages,options);
}

async function switchToCPU(){
    const cpu =
        MODEL_CATALOG.find(m => String(m.value).includes("Qwen2.5-0.5B"))?.value ||
        "cpu:onnx-community/Qwen2.5-0.5B-Instruct";
    await window.changeModel(cpu);
}

function buildContractSystemPrompt(){
    const measurementContext = measurements.slice(0,250).map(m=>JSON.stringify(m)).join("\n");
    const normContext = norms.slice(0,150).map(n=>JSON.stringify(n)).join("\n");
    return `You are Quantity & Schedule Intelligence, a senior construction quantity take-off, estimating and project-controls assistant.
Your job is to assist, not fabricate measurements. Never claim to have geometrically measured a drawing unless an explicit measurement exists in the take-off register. Distinguish extracted/documented quantities, user-entered measurements, and AI suggestions.
Help with: classifying take-off items; matching drawing descriptions to BOQ items; matching quantities to appropriate schedule activities; checking BOQ vs measured variances; applying discipline norms; identifying missing norms, duplicates, unallocated quantities and suspicious mappings; explaining calculations and traceability.
Measurement modes: (1) norm per discipline/size, where hours = allocated quantity × applicable norm; (2) specific measurement, where a row may carry its own hours/unit.
PROJECT: ${currentProjectName}
DOCUMENTS:\n${(engineMode === "cpu" || engineMode === "browserlite") ? buildCPUSourceContext() : buildSourceContext()}
CURRENT TAKE-OFF REGISTER:\n${measurementContext || "No measurements entered yet."}
NORM LIBRARY:\n${normContext || "No norms entered yet."}`;
}

let assistantInitPromise = null;

async function ensureAssistantReady(){

    if(aiReady){
        return;
    }

    if(!assistantInitPromise){

        setEngineStatus(
            null,
            "Connecting AI…",
            "loading"
        );

        assistantInitPromise =
            initialiseAssistant()
                .finally(()=>{
                    assistantInitPromise = null;
                });
    }

    await assistantInitPromise;

    if(!aiReady){
        throw new Error(
            "The browser AI engine could not be started."
        );
    }
}

window.sendMessage =
async function(){

    const text =
        messageInput.value.trim();

    if(
        !text ||
        aiBusy
    )
        return;

    try{
        await ensureAssistantReady();
    }catch(error){
        addMessage(
            "assistant",
            `**AI could not be started.**\n\n${escapeHtml(error?.message || "Unknown error")}`
        );
        return;
    }

    messageInput.value = "";

    autoResize(
        messageInput
    );

    updateSendButton();

    document
        .getElementById(
            "welcome"
        )
        ?.remove();

    addMessage(
        "user",
        text
    );

    conversation.push({

        role:"user",

        content:text
    });

    scheduleAutoSave();

    const loadingId =
        addLoading();

    aiBusy = true;

    try{

        const messages = [

            {
                role:"system",
                content:
                    buildContractSystemPrompt()
            },

            ...trimAIConversation()
        ];

        removeLoading(
            loadingId
        );

        let answer = "";

        const element =
            addMessage(
                "assistant",
                ""
            );

        const body =
            element.querySelector(
                ".message-body"
            );

        const result =
            await runAI(
                messages,
                {

                    temperature:.2,

                    max_tokens:
                        (engineMode === "cpu" || engineMode === "browserlite")
                            ? 800
                            : 1400,

                    stream:true,

                    onToken:
                        token=>{

                            answer +=
                                token;

                            body.innerHTML =
                                formatMarkdown(
                                    answer
                                );

                            chat.scrollTop =
                                chat.scrollHeight;
                        }
                }
            );

        if(
            result &&
            typeof result[Symbol.asyncIterator] ===
            "function"
        ){

            for await(
                const chunk of result
            ){

                const delta =
                    chunk
                        ?.choices?.[0]
                        ?.delta?.content ||
                    "";

                answer +=
                    delta;

                body.innerHTML =
                    formatMarkdown(
                        answer
                    );

                chat.scrollTop =
                    chat.scrollHeight;
            }
        }

        if(
            !answer.trim()
        ){

            answer =
                result
                    ?.choices?.[0]
                    ?.message?.content ||
                "I couldn't generate a response.";

            body.innerHTML =
                formatMarkdown(
                    answer
                );
        }

        conversation.push({

            role:"assistant",

            content:answer
        });

        scheduleAutoSave();

    }catch(error){

        console.error(
            error
        );

        removeLoading(
            loadingId
        );

        addMessage(
            "assistant",
            `
**I couldn't complete the analysis.**

The selected AI service encountered an error.

\`${escapeHtml(
                error?.message ||
                "Unknown error"
            )}\`
`
        );

    }finally{

        aiBusy = false;

        updateSendButton();
    }
};

window.analyseContract =
async function(){

    if(!aiReady){

        addMessage(
            "assistant",
            "**The local AI engine is still loading. Please wait a moment.**"
        );

        return;
    }

    if(!sources.length){

        addMessage(
            "assistant",
            `
**Upload the project information first.**

For a useful contractual review, start with the contract,
baseline programme, updated programme and relevant correspondence.
`
        );

        return;
    }

    if(aiBusy)
        return;

    document
        .getElementById(
            "welcome"
        )
        ?.remove();

    aiBusy = true;

    updateSendButton();

    const loadingId =
        addLoading();

    try{

        const result =
            await runAI(
                [

                    {
                        role:"system",
                        content:
                            buildContractSystemPrompt()
                    },

                    {
                        role:"user",

                        content:`

Perform an initial contract-management review.

Provide:

1. Executive contractual position.
2. Top five current issues.
3. Potential notices or contractual actions.
4. Delay / programme concerns.
5. Evidence gaps.
6. Immediate recommended actions.
7. Key risks if action is not taken.

Do not invent clause numbers.

Clearly distinguish evidence from inference.
`
                    }
                ],
                {

                    temperature:.15,

                    max_tokens:
                        (engineMode === "cpu" || engineMode === "browserlite")
                            ? 1200
                            : 1800,

                    stream:false
                }
            );

        removeLoading(
            loadingId
        );

        const answer =
            result
                ?.choices?.[0]
                ?.message?.content ||
            "No analysis was returned.";

        addMessage(
            "assistant",
            answer
        );

        conversation.push({

            role:"assistant",

            content:answer
        });

        await generateRecommendations();

        scheduleAutoSave();

    }catch(error){

        removeLoading(
            loadingId
        );

        addMessage(
            "assistant",
            `
**The contract review could not be completed.**

\`${escapeHtml(
                error?.message ||
                "Unknown error"
            )}\`
`
        );

    }finally{

        aiBusy = false;

        updateSendButton();
    }
};

async function generateRecommendations(){

    if(!aiReady || !sources.length)
        return;

    const loading =
        document.getElementById(
            "recommendationList"
        );

    loading.innerHTML = `
        <div class="empty-right">
            Analysing contract information...
        </div>
    `;

    const prompt = `

Based on the project information, identify recommended
contract-management actions and documents.

Return ONLY valid JSON using exactly:

{
  "recommendations": [
    {
      "id": "unique-short-id",
      "category": "notice|risk|schedule|delay|general",
      "title": "short title",
      "description": "short explanation",
      "priority": "high|medium|low",
      "reason": "why this is recommended",
      "action": "what should be done next"
    }
  ]
}

Requirements:

- Produce 8 to 12 useful recommendations.
- Include contractual notices where potentially appropriate.
- Include issues and risks.
- Include schedule analysis recommendations.
- Include delay analysis recommendations where appropriate.
- Include document recommendations that would help preserve
  entitlement or establish the contractual position.
- Do not invent clause numbers.
- Do not say a notice is definitely required unless the evidence
  establishes that.
- If evidence is incomplete, recommend obtaining the missing evidence.
- Prioritise practical actions.
`;

    try{

        const result =
            await runAI(
                [

                    {
                        role:"system",

                        content:
                            buildContractSystemPrompt()
                    },

                    {
                        role:"user",

                        content:prompt
                    }
                ],
                {

                    temperature:.1,

                    max_tokens:
                        engineMode === "cpu"
                            ? 1500
                            : 2200,

                    stream:false
                }
            );

        const raw =
            result
                ?.choices?.[0]
                ?.message?.content ||
            "";

        const parsed =
            parseJSON(
                raw
            );

        recommendations =
            Array.isArray(
                parsed?.recommendations
            )
                ? parsed.recommendations
                : [];

        renderRecommendations();

    }catch(error){

        console.error(
            "Recommendation generation error:",
            error
        );

        loading.innerHTML = `
            <div class="empty-right">
                Recommendations could not be generated.
                <br><br>
                ${escapeHtml(
                    error?.message ||
                    "Unknown error"
                )}
            </div>
        `;
    }
}

function renderRecommendations(){

    const container =
        document.getElementById(
            "recommendationList"
        );

    container.innerHTML = "";

    if(!recommendations.length){

        container.innerHTML = `
            <div class="empty-right">
                No recommendations have been generated yet.
                <br><br>
                Upload project information and run
                <strong>Analyse take-off</strong>.
            </div>
        `;

        return;
    }

    const sections = [

        {
            category:"notice",
            title:"Recommended contractual notices"
        },

        {
            category:"risk",
            title:"Issues & risks"
        },

        {
            category:"schedule",
            title:"Schedule analysis"
        },

        {
            category:"delay",
            title:"Delay analysis reviews"
        },

        {
            category:"general",
            title:"Other recommended actions"
        }
    ];

    sections.forEach(
        section=>{

            const items =
                recommendations.filter(
                    recommendation =>
                        recommendation.category ===
                        section.category
                );

            if(!items.length)
                return;

            const sectionElement =
                document.createElement(
                    "div"
                );

            sectionElement.className =
                "right-section";

            const title =
                document.createElement(
                    "div"
                );

            title.className =
                "right-section-title";

            title.innerHTML = `
                <span>
                    ${section.title}
                </span>

                <span>
                    ${items.length}
                </span>
            `;

            sectionElement.appendChild(
                title
            );

            items.forEach(
                item=>{

                    sectionElement.appendChild(
                        createRecommendationCard(
                            item
                        )
                    );
                }
            );

            container.appendChild(
                sectionElement
            );
        }
    );
}

function createRecommendationCard(
    item
){

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "rec-card";

    const icon =
        getRecommendationIcon(
            item.category
        );

    card.innerHTML = `

        <div class="rec-top">

            <div class="
                rec-icon
                ${escapeHtml(
                    item.category
                )}
            ">
                ${icon}
            </div>

            <div class="rec-main">

                <div class="rec-title">
                    ${escapeHtml(
                        item.title ||
                        "Recommended action"
                    )}
                </div>

                <div class="rec-description">
                    ${escapeHtml(
                        item.description ||
                        ""
                    )}
                </div>

                <span class="
                    rec-priority
                    priority-${escapeHtml(
                        item.priority ||
                        "medium"
                    )}
                ">
                    ${escapeHtml(
                        item.priority ||
                        "medium"
                    )} priority
                </span>

            </div>

        </div>

        <div class="rec-actions">

            <button
                class="rec-button"
                data-action="discuss"
            >
                Discuss
            </button>

            <button
                class="rec-button primary"
                data-action="generate"
            >
                Generate document
            </button>

        </div>
    `;

    card
        .querySelector(
            '[data-action="discuss"]'
        )
        .onclick =
        ()=>{
            discussRecommendation(
                item
            );
        };

    card
        .querySelector(
            '[data-action="generate"]'
        )
        .onclick =
        ()=>{
            generateRecommendedDocument(
                item
            );
        };

    return card;
}

function getRecommendationIcon(
    category
){

    if(category === "notice")
        return "§";

    if(category === "risk")
        return "!";

    if(category === "schedule")
        return "▦";

    if(category === "delay")
        return "↗";

    return "✦";
}

function discussRecommendation(
    item
){

    const prompt = `

Let's discuss this recommended action:

Title:
${item.title}

Reason:
${item.reason || item.description}

Recommended action:
${item.action}

Please explain:

1. The contractual issue.
2. What evidence supports it.
3. What evidence is missing.
4. What contractual action should be considered.
5. The risks of doing nothing.
6. Any likely counterarguments.
7. The practical next steps.

Do not invent contract clauses.
`;

    messageInput.value =
        prompt;

    autoResize(
        messageInput
    );

    updateSendButton();

    messageInput.focus();
}

window.generateRecommendedDocument =
async function(item){

    if(!aiReady){

        addMessage(
            "assistant",
            "The local AI engine is not ready yet."
        );

        return;
    }

    if(aiBusy)
        return;

    aiBusy = true;

    updateSendButton();

    const loadingId =
        addLoading();

    try{

        const result =
            await runAI(
                [

                    {
                        role:"system",

                        content:
                            buildContractSystemPrompt()
                    },

                    {
                        role:"user",

                        content:`

Prepare a professional draft document based on this
recommended contract-management action.

RECOMMENDATION:
${JSON.stringify(
                            item,
                            null,
                            2
                        )}

DOCUMENT REQUIREMENTS:

- Do not invent contract clauses.
- Do not invent dates, names or factual events.
- Use [INSERT] placeholders where project-specific information
  is missing.
- Clearly distinguish factual statements from matters requiring
  confirmation.
- Preserve reservations of rights where appropriate.
- The document should be commercially professional.
- Include a clear purpose and requested action.
- Where the document is a notice, avoid saying it is legally valid
  unless the supplied contract information supports that.
- Include an "Evidence / supporting records" section.
- Include a "Contractual basis to verify" section where appropriate.

Return ONLY the document content in Markdown.
`
                    }
                ],
                {

                    temperature:.1,

                    max_tokens:
                        engineMode === "cpu"
                            ? 1600
                            : 2600,

                    stream:false
                }
            );

        removeLoading(
            loadingId
        );

        const content =
            result
                ?.choices?.[0]
                ?.message?.content ||
            "";

        currentDocument = {

            title:
                item.title ||
                "Recommended document",

            category:
                item.category,

            content,

            createdAt:
                Date.now()
        };

        openDocumentModal(
            currentDocument
        );

    }catch(error){

        removeLoading(
            loadingId
        );

        addMessage(
            "assistant",
            `
**The document could not be generated.**

\`${escapeHtml(
                error?.message ||
                "Unknown error"
            )}\`
`
        );

    }finally{

        aiBusy = false;

        updateSendButton();
    }
};

function openDocumentModal(
    documentData
){

    document
        .getElementById(
            "modalTitle"
        )
        .textContent =
        documentData.title;

    document
        .getElementById(
            "modalSubtitle"
        )
        .textContent =
        "AI-generated draft — verify contractual requirements before issue";

    document
        .getElementById(
            "modalContent"
        )
        .innerHTML = `

            <div class="document-preview">

                ${formatMarkdown(
                    documentData.content
                )}

            </div>
        `;

    document
        .getElementById(
            "documentModal"
        )
        .classList.add(
            "open"
        );
}

window.closeDocumentModal =
function(){

    document
        .getElementById(
            "documentModal"
        )
        .classList.remove(
            "open"
        );
};

window.saveCurrentDocument =
async function(){

    if(!currentDocument)
        return;

    const folder =
        currentDocument.category ===
        "notice"

            ? "correspondence"

            : currentFolder;

    const text =
        currentDocument.content;

    sources.push({

        id:
            crypto.randomUUID(),

        name:
            `${safeFilename(
                currentDocument.title
            )}.md`,

        size:
            new Blob([
                text
            ]).size,

        type:
            "text/markdown",

        folder,

        text,

        uploadedAt:
            Date.now(),

        generated:true
    });

    renderFolders();

    renderSourcesForSelectedFolder();

    updateProjectMeta();

    scheduleAutoSave();

    addMessage(
        "assistant",
        `
**Document saved to the project.**

The generated document has been added to:

**${escapeHtml(
            getFolderName(
                folder
            )
        )}**

It remains a draft and should be reviewed against the
executed contract and project records before issue.
`
    );

    closeDocumentModal();
};

window.downloadCurrentDocument =
function(){

    if(!currentDocument)
        return;

    const filename =
        `${safeFilename(
            currentDocument.title
        )}.md`;

    downloadFile(
        currentDocument.content,
        filename,
        "text/markdown"
    );
};

function addMessage(
    role,
    text
){

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        `message ${role}`;

    wrapper.innerHTML = `

        <div class="avatar">
            ${
                role === "user"
                    ? "You"
                    : "✦"
            }
        </div>

        <div class="message-body">
            ${formatMarkdown(
                text
            )}
        </div>
    `;

    chat.appendChild(
        wrapper
    );

    chat.scrollTop =
        chat.scrollHeight;

    return wrapper;
}

function renderChatFromConversation(){

    chat.innerHTML = "";

    if(!conversation.length){

        chat.innerHTML = `

            <div id="welcome" class="welcome">

                <div class="welcome-logo">
                    ✦
                </div>

                <h1>
                    Quantity take-off intelligence
                </h1>

                <p>
                    Continue working on your project.
                    Your saved contract-management conversation
                    has been restored.
                </p>

            </div>
        `;

        return;
    }

    conversation.forEach(
        message=>{

            addMessage(
                message.role,
                message.content
            );
        }
    );
}

function addLoading(){

    const id =
        crypto.randomUUID();

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "message assistant";

    wrapper.dataset.loadingId =
        id;

    wrapper.innerHTML = `

        <div class="avatar">
            ✦
        </div>

        <div class="message-body">

            <div class="loading">

                <span></span>
                <span></span>
                <span></span>

            </div>

        </div>
    `;

    chat.appendChild(
        wrapper
    );

    chat.scrollTop =
        chat.scrollHeight;

    return id;
}

function removeLoading(id){

    document
        .querySelector(
            `[data-loading-id="${id}"]`
        )
        ?.remove();
}

function formatMarkdown(
    text
){

    if(!text)
        return "";

    let safe =
        escapeHtml(
            text
        );

    safe =
        safe.replace(
            /```([\s\S]*?)```/g,
            "<pre>$1</pre>"
        );

    safe =
        safe.replace(
            /^### (.*?)$/gm,
            "<h3>$1</h3>"
        );

    safe =
        safe.replace(
            /^## (.*?)$/gm,
            "<h3>$1</h3>"
        );

    safe =
        safe.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

    safe =
        safe.replace(
            /^- (.*?)$/gm,
            "<li>$1</li>"
        );

    safe =
        safe.replace(
            /(<li>.*?<\/li>)/gs,
            "<ul>$1</ul>"
        );

    safe =
        safe.replace(
            /\n\n/g,
            "</p><p>"
        );

    safe =
        `<p>${safe}</p>`;

    safe =
        safe.replace(
            /\n/g,
            "<br>"
        );

    return safe;
}

window.handleKeyDown =
function(event){

    if(
        event.key === "Enter" &&
        !event.shiftKey
    ){

        event.preventDefault();

        sendMessage();
    }
};

window.autoResize =
function(element){

    element.style.height =
        "auto";

    element.style.height =
        Math.min(
            element.scrollHeight,
            130
        ) + "px";
};

function updateSendButton(){

    sendButton.disabled =
        !messageInput.value.trim() ||
        aiBusy;
}

window.useSuggestion =
function(button){

    messageInput.value =
        button.textContent.trim();

    autoResize(
        messageInput
    );

    updateSendButton();

    messageInput.focus();
};

window.clearChat =
function(){

    conversation = [];

    chat.innerHTML = `

        <div id="welcome" class="welcome">

            <div class="welcome-logo">
                ✦
            </div>

            <h1>
                Quantity take-off intelligence
            </h1>

            <p>
                Ask questions about the contract, entitlement,
                delay, notices, correspondence and risks.
            </p>

        </div>
    `;

    scheduleAutoSave();
};

window.newProject =
function(){

    if(
        sources.length ||
        conversation.length ||
        recommendations.length
    ){

        if(
            !confirm(
                "Start a new project? Your current project is already stored locally."
            )
        ){

            return;
        }
    }

    currentProjectId =
        null;

    currentProjectName =
        "Untitled project";

    sources = [];

    conversation = [];

    recommendations = [];

    weeklyFolders = [];

    currentFolder =
        "contract";

    currentDocument =
        null;

    document
        .getElementById(
            "projectTitle"
        )
        .textContent =
        currentProjectName;

    document
        .getElementById(
            "projectNameInput"
        )
        .value =
        currentProjectName;

    renderFolders();

    renderSourcesForSelectedFolder();

    updateProjectMeta();

    renderRecommendations();

    clearChat();

    updateSaveStatus(
        "New project"
    );
};

async function loadSavedProjectList(){

    const projects =
        await getSavedProjects();

    if(!projects.length){

        alert(
            "There are no saved projects in this browser."
        );

        return;
    }

    const choices =
        projects
            .map(
                (project,index)=>
                    `${index + 1}. ${
                        project.name ||
                        "Untitled project"
                    }`
            )
            .join(
                "\n"
            );

    const answer =
        prompt(
            `Saved projects:\n\n${choices}\n\nEnter project number to open:`
        );

    const index =
        Number(
            answer
        ) - 1;

    if(
        Number.isInteger(index) &&
        projects[index]
    ){

        await openSavedProject(
            projects[index].id
        );
    }
}

async function openSavedProject(id){

    const project =
        await loadProject(
            id
        );

    if(!project)
        return;

    currentProjectId =
        project.id;

    currentProjectName =
        project.name ||
        "Untitled project";

    sources =
        project.sources ||
        [];

    conversation =
        project.conversation ||
        [];

    recommendations =
        project.recommendations ||
        [];

    weeklyFolders =
        project.weeklyFolders ||
        [];

    currentFolder =
        project.currentFolder ||
        "contract";

    document
        .getElementById(
            "projectTitle"
        )
        .textContent =
        currentProjectName;

    document
        .getElementById(
            "projectNameInput"
        )
        .value =
        currentProjectName;

    renderFolders();

    renderSourcesForSelectedFolder();

    updateProjectMeta();

    renderChatFromConversation();

    renderRecommendations();

    updateSaveStatus(
        "Saved locally ✓"
    );
}

function parseJSON(
    raw
){

    let cleaned =
        String(
            raw || ""
        ).trim();

    cleaned =
        cleaned.replace(
            /^```json/i,
            ""
        );

    cleaned =
        cleaned.replace(
            /^```/,
            ""
        );

    cleaned =
        cleaned.replace(
            /```$/g,
            ""
        );

    try{

        return JSON.parse(
            cleaned.trim()
        );

    }catch{

        const start =
            cleaned.indexOf(
                "{"
            );

        const end =
            cleaned.lastIndexOf(
                "}"
            );

        if(
            start !== -1 &&
            end !== -1
        ){

            try{

                return JSON.parse(
                    cleaned.slice(
                        start,
                        end + 1
                    )
                );

            }catch{

                return null;
            }
        }
    }

    return null;
}

function safeFilename(
    value
){

    return String(
        value ||
        "contract-document"
    )
        .replace(
            /[<>:"/\\|?*]+/g,
            "-"
        )
        .replace(
            /\s+/g,
            "-"
        );
}

function escapeHtml(
    value
){

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}

function downloadFile(
    content,
    filename,
    type
){

    const blob =
        new Blob(
            [content],
            {type}
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        ()=>URL.revokeObjectURL(
            url
        ),
        1000
    );
}

window.updateThemeToggle =
function(){

    const button =
        document.getElementById(
            "themeToggle"
        );

    if(!button)
        return;

    const isDark =
        document.documentElement.classList.contains(
            "dark-mode"
        );

    button.textContent =
        isDark
            ? "☀"
            : "☾";

    button.setAttribute(
        "aria-label",
        isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
    );

    button.setAttribute(
        "title",
        isDark
            ? "Switch to light mode"
            : "Switch to dark mode"
    );
};

window.toggleTheme =
function(){

    const isDark =
        document.documentElement.classList.toggle(
            "dark-mode"
        );

    localStorage.setItem(
        "scheduleContractManagementTheme",
        isDark
            ? "dark"
            : "light"
    );

    updateThemeToggle();
};

document.addEventListener(
    "DOMContentLoaded",
    updateThemeToggle
);

messageInput.addEventListener(
    "input",
    updateSendButton
);

document
    .getElementById(
        "documentModal"
    )
    .addEventListener(
        "click",
        event=>{

            if(
                event.target.id ===
                "documentModal"
            ){

                closeDocumentModal();
            }
        }
    );

async function initialiseApp(){

    renderFolders();

    renderSourcesForSelectedFolder();

    updateProjectMeta();

    aiReady = true;
    engineMode = "shared";
    setEngineStatus("shared", "Shared AI ready — model loads on first use", "ready");
    updateSendButton();
}

initialiseApp();

window.openTakeoffWorkspace=function(){ renderTakeoff(); document.getElementById('takeoffModal').classList.add('open'); };
window.closeTakeoffWorkspace=function(){ document.getElementById('takeoffModal').classList.remove('open'); };
window.addMeasurementRow=function(){ measurements.push({id:crypto.randomUUID(),discipline:'Electrical',category:'Containment',item:'',size:'',unit:'m',drawingQty:0,boqItem:'',boqQty:0,activityId:'',activityName:'',norm:0,specificRate:0,source:'',confidence:'User',status:'Unallocated'}); renderTakeoff(); scheduleAutoSave(); };
window.addNormRow=function(){ norms.push({id:crypto.randomUUID(),discipline:'Electrical',category:'Containment',item:'Cable Tray',size:'',unit:'m',hoursPerUnit:0}); renderTakeoff(); scheduleAutoSave(); };
function calcHours(m){ const mode=document.getElementById('measurementMode')?.value||'norm'; const r=mode==='specific'?(+m.specificRate||0):(+m.norm||findNorm(m)||0); return (+m.drawingQty||0)*r; }
function findNorm(m){ const n=norms.find(x=>String(x.discipline).toLowerCase()===String(m.discipline).toLowerCase() && String(x.category).toLowerCase()===String(m.category).toLowerCase() && (!x.size||String(x.size).toLowerCase()===String(m.size).toLowerCase())); return n?+n.hoursPerUnit:0; }
function tdInput(value,i,key,type='text'){ return `<td style="padding:4px;border:1px solid var(--border)"><input type="${type}" value="${escapeHtml(String(value??''))}" onchange="updateMeasurement(${i},'${key}',this.value)" style="width:100%;min-width:72px;padding:5px;border:1px solid var(--border);border-radius:5px"></td>`; }
window.updateMeasurement=function(i,key,v){ if(['drawingQty','boqQty','norm','specificRate'].includes(key)) v=Number(v)||0; measurements[i][key]=v; measurements[i].status=measurements[i].activityId?'Allocated':'Unallocated'; renderTakeoff(); scheduleAutoSave(); };
window.updateNorm=function(i,key,v){ if(key==='hoursPerUnit')v=Number(v)||0; norms[i][key]=v; renderTakeoff(); scheduleAutoSave(); };
window.deleteMeasurement=function(i){ measurements.splice(i,1);renderTakeoff();scheduleAutoSave();};
window.deleteNorm=function(i){norms.splice(i,1);renderTakeoff();scheduleAutoSave();};
function renderTakeoff(){
 const t=document.getElementById('takeoffTable'); if(!t)return;
 const headers=['Discipline','Category','Item','Size','Unit','Drawing Qty','BOQ Item','BOQ Qty','Variance','Activity ID','Activity Name','Norm h/u','Specific h/u','Hours','Source','Confidence','Status',''];
 let h='<thead><tr>'+headers.map(x=>`<th style="position:sticky;top:0;background:var(--panel-soft);padding:6px;border:1px solid var(--border);white-space:nowrap">${x}</th>`).join('')+'</tr></thead><tbody>';
 measurements.forEach((m,i)=>{ const variance=(+m.drawingQty||0)-(+m.boqQty||0); h+='<tr>'+tdInput(m.discipline,i,'discipline')+tdInput(m.category,i,'category')+tdInput(m.item,i,'item')+tdInput(m.size,i,'size')+tdInput(m.unit,i,'unit')+tdInput(m.drawingQty,i,'drawingQty','number')+tdInput(m.boqItem,i,'boqItem')+tdInput(m.boqQty,i,'boqQty','number')+`<td style="padding:5px;border:1px solid var(--border)">${variance.toFixed(2)}</td>`+tdInput(m.activityId,i,'activityId')+tdInput(m.activityName,i,'activityName')+tdInput(m.norm,i,'norm','number')+tdInput(m.specificRate,i,'specificRate','number')+`<td style="padding:5px;border:1px solid var(--border)">${calcHours(m).toFixed(2)}</td>`+tdInput(m.source,i,'source')+tdInput(m.confidence,i,'confidence')+`<td style="padding:5px;border:1px solid var(--border)">${m.status}</td><td><button class="modal-close" onclick="deleteMeasurement(${i})">×</button></td></tr>`; });
 t.innerHTML=h+'</tbody>';
 const nt=document.getElementById('normTable'); let nh='<thead><tr>'+['Discipline','Category','Item','Size','Unit','Hours / Unit',''].map(x=>`<th style="padding:6px;border:1px solid var(--border);background:var(--panel-soft)">${x}</th>`).join('')+'</tr></thead><tbody>';
 norms.forEach((n,i)=>{nh+='<tr>'+['discipline','category','item','size','unit','hoursPerUnit'].map(k=>`<td style="padding:4px;border:1px solid var(--border)"><input value="${escapeHtml(String(n[k]??''))}" onchange="updateNorm(${i},'${k}',this.value)" style="width:100%;padding:5px"></td>`).join('')+`<td><button class="modal-close" onclick="deleteNorm(${i})">×</button></td></tr>`}); nt.innerHTML=nh+'</tbody>';
}
window.aiAssistTakeoff=async function(){
 if(document.getElementById('aiAssistMode')?.value==='off'){addMessage('assistant','**AI assistance is switched off.**');return;}
 if(!aiReady){addMessage('assistant','**The selected local AI engine is not ready yet.**');return;}
 const loadingId=addLoading(); try{ const result=await runAI([{role:'system',content:buildContractSystemPrompt()},{role:'user',content:`Review the uploaded documents and current take-off register. Recommend concrete take-off classifications, BOQ matches, schedule activity mappings, missing norms, variances and checks. Do not invent geometric measurements. If a quantity is not explicitly supported, label it as requiring measurement. Keep recommendations concise and auditable.`}],{temperature:.1,max_tokens:1400,stream:false}); removeLoading(loadingId); const answer=result?.choices?.[0]?.message?.content||'No recommendation returned.'; addMessage('assistant',answer); conversation.push({role:'assistant',content:answer}); }catch(e){removeLoading(loadingId);addMessage('assistant','AI take-off review failed: '+escapeHtml(e.message||String(e)));}
};
function xmlEscape(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function xmlCell(v,type='String'){return `<Cell><Data ss:Type="${type}">${xmlEscape(v)}</Data></Cell>`;}
function xmlSheet(name,headers,rows){return `<Worksheet ss:Name="${xmlEscape(name)}"><Table><Row>${headers.map(x=>xmlCell(x)).join('')}</Row>${rows.map(r=>'<Row>'+r.map(v=>xmlCell(v,typeof v==='number'?'Number':'String')).join('')+'</Row>').join('')}</Table></Worksheet>`;}
window.exportExcelXML=function(){
 const takeHeaders=['Discipline','Category','Item','Size','Unit','Drawing Quantity','BOQ Item','BOQ Quantity','Variance','Activity ID','Activity Name','Norm Hours/Unit','Specific Hours/Unit','Calculated Hours','Source','Confidence','Status'];
 const takeRows=measurements.map(m=>[m.discipline,m.category,m.item,m.size,m.unit,+m.drawingQty||0,m.boqItem,+m.boqQty||0,(+m.drawingQty||0)-(+m.boqQty||0),m.activityId,m.activityName,+m.norm||0,+m.specificRate||0,calcHours(m),m.source,m.confidence,m.status]);
 const normRows=norms.map(n=>[n.discipline,n.category,n.item,n.size,n.unit,+n.hoursPerUnit||0]);
 const act={}; measurements.forEach(m=>{const k=m.activityId||'(Unallocated)'; if(!act[k])act[k]={name:m.activityName,qty:0,hours:0};act[k].qty+=+m.drawingQty||0;act[k].hours+=calcHours(m)});
 const actRows=Object.entries(act).map(([id,a])=>[id,a.name,a.qty,a.hours]);
 const summary=[['Project',currentProjectName],['Measurement mode',document.getElementById('measurementMode')?.value||'norm'],['Measurements',measurements.length],['Total measured quantity',measurements.reduce((a,m)=>a+(+m.drawingQty||0),0)],['Total calculated hours',measurements.reduce((a,m)=>a+calcHours(m),0)],['Unallocated items',measurements.filter(m=>!m.activityId).length]];
 const xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${xmlSheet('Project Summary',['Metric','Value'],summary)}${xmlSheet('Take-Off',takeHeaders,takeRows)}${xmlSheet('Norms',['Discipline','Category','Item','Size','Unit','Hours per Unit'],normRows)}${xmlSheet('Activity Quantities',['Activity ID','Activity Name','Quantity','Hours'],actRows)}</Workbook>`;
 downloadFile(xml,`${safeFilename(currentProjectName)}_Takeoff.xml`,'application/xml');
};
