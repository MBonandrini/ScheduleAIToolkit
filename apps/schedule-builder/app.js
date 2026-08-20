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
    { value:"browserlite:onnx-community/Qwen2.5-0.5B-Instruct", engine:"cpu", id:"onnx-community/Qwen2.5-0.5B-Instruct", label:"Lightweight Browser AI — Qwen2.5 0.5B" },
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
    high: MODEL_CATALOG.find(m=>m.value==="webllmio:high").id,
    medium: MODEL_CATALOG.find(m=>m.value==="webllmio:medium").id,
    low: MODEL_CATALOG.find(m=>m.value==="webllmio:low").id
};

const CPU_MAX_SOURCE_CHARS =
    10000;

const CPU_MAX_TOTAL_CONTEXT_CHARS =
    30000;

let client = null;

let mlcClient = null;

let cpuGenerator = null;

let engineMode = null;

let currentModelValue = "webllmio:low";

let aiReady = false;

let aiBusy = false;

let sources = [];

let conversation = [];

let generatedSchedule = null;

let currentProjectId = null;

let currentProjectName = "Untitled project";

let saveTimer = null;

const chat =
    document.getElementById("chat");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const createScheduleButton =
    document.getElementById("createScheduleButton");

function setEngineStatus(
    mode,
    statusText,
    state="loading"
){

    const dot =
        document.getElementById("engineDot");

    const status =
        document.getElementById("engineStatus");

    dot.className =
        `engine-dot ${state}`;

    status.textContent =
        statusText;
}

const DB_NAME = "ScheduleBuilderDB";

const DB_VERSION = 1;

const PROJECT_STORE = "projects";

function openDatabase(){

    return new Promise((resolve,reject)=>{

        const request =
            indexedDB.open(
                DB_NAME,
                DB_VERSION
            );

        request.onupgradeneeded = event=>{

            const db =
                event.target.result;

            if(
                !db.objectStoreNames.contains(
                    PROJECT_STORE
                )
            ){

                const store =
                    db.createObjectStore(
                        PROJECT_STORE,
                        {keyPath:"id"}
                    );

                store.createIndex(
                    "updatedAt",
                    "updatedAt"
                );
            }
        };

        request.onsuccess =
            ()=>resolve(request.result);

        request.onerror =
            ()=>reject(request.error);
    });
}

async function saveProjectToDatabase(){

    if(!currentProjectId){

        currentProjectId =
            crypto.randomUUID();
    }

    const project = {

        id:currentProjectId,

        name:getProjectName(),

        sources:sources,

        conversation:conversation,

        generatedSchedule:
            generatedSchedule,

        format:
            document
                .getElementById("formatSelect")
                .value,

        scheduleAnswers:{

            projectStart:
                document
                    .getElementById("projectStart")
                    ?.value || "",

            projectFinish:
                document
                    .getElementById("projectFinish")
                    ?.value || "",

            workingCalendar:
                document
                    .getElementById("workingCalendar")
                    ?.value ||
                "Monday-Friday",

            milestones:
                document
                    .getElementById("milestones")
                    ?.value || "",

            constraints:
                document
                    .getElementById("constraints")
                    ?.value || "",

            scheduleLevel:
                document
                    .getElementById("scheduleLevel")
                    ?.value ||
                "Detailed"
        },

        updatedAt:Date.now()
    };

    const db =
        await openDatabase();

    return new Promise((resolve,reject)=>{

        const transaction =
            db.transaction(
                PROJECT_STORE,
                "readwrite"
            );

        transaction
            .objectStore(PROJECT_STORE)
            .put(project);

        transaction.oncomplete = ()=>{

            db.close();

            resolve();
        };

        transaction.onerror = ()=>{

            db.close();

            reject(transaction.error);
        };
    });
}

async function getSavedProjects(){

    const db =
        await openDatabase();

    return new Promise((resolve,reject)=>{

        const request =
            db
                .transaction(
                    PROJECT_STORE,
                    "readonly"
                )
                .objectStore(PROJECT_STORE)
                .getAll();

        request.onsuccess = ()=>{

            db.close();

            resolve(
                request.result.sort(
                    (a,b)=>
                        b.updatedAt -
                        a.updatedAt
                )
            );
        };

        request.onerror = ()=>{

            db.close();

            reject(request.error);
        };
    });
}

async function loadProject(id){

    const db =
        await openDatabase();

    return new Promise((resolve,reject)=>{

        const request =
            db
                .transaction(
                    PROJECT_STORE,
                    "readonly"
                )
                .objectStore(PROJECT_STORE)
                .get(id);

        request.onsuccess = ()=>{

            db.close();

            resolve(request.result);
        };

        request.onerror = ()=>{

            db.close();

            reject(request.error);
        };
    });
}

async function deleteProject(id){

    const db =
        await openDatabase();

    return new Promise((resolve,reject)=>{

        const request =
            db
                .transaction(
                    PROJECT_STORE,
                    "readwrite"
                )
                .objectStore(PROJECT_STORE)
                .delete(id);

        request.onsuccess = ()=>{

            db.close();

            resolve();
        };

        request.onerror = ()=>{

            db.close();

            reject(request.error);
        };
    });
}

window.saveCurrentProject =
async function(){

    try{

        updateSaveStatus("Saving...");

        await saveProjectToDatabase();

        updateSaveStatus(
            "Saved locally ✓"
        );

        await renderSavedProjects();

    }catch(error){

        console.error(
            "Save failed:",
            error
        );

        updateSaveStatus(
            "Save failed"
        );
    }
};

function scheduleAutoSave(){

    clearTimeout(saveTimer);

    updateSaveStatus(
        "Changes pending..."
    );

    saveTimer =
        setTimeout(
            ()=>saveCurrentProject(),
            1000
        );
}

function updateSaveStatus(text){

    document
        .getElementById("saveStatus")
        .textContent = text;
}

async function renderSavedProjects(){

    const container =
        document.getElementById(
            "savedProjects"
        );

    const projects =
        await getSavedProjects();

    document
        .getElementById("projectCount")
        .textContent =
        projects.length;

    container.innerHTML = "";

    if(!projects.length){

        container.innerHTML = `
            <div class="project-empty">
                Your saved projects will appear here.
            </div>
        `;

        return;
    }

    projects.forEach(project=>{

        const button =
            document.createElement(
                "button"
            );

        button.className =
            "saved-project";

        if(
            project.id ===
            currentProjectId
        ){

            button.classList.add(
                "active"
            );
        }

        button.innerHTML = `

            <div class="project-folder">
                📁
            </div>

            <div class="project-details">

                <div class="project-name">
                    ${escapeHtml(
                        project.name ||
                        "Untitled project"
                    )}
                </div>

                <div class="project-date">
                    ${formatSavedDate(
                        project.updatedAt
                    )}
                </div>

            </div>

            <span
                class="delete-project"
                title="Delete project"
            >
                ×
            </span>
        `;

        button.onclick =
        async event=>{

            if(
                event.target.closest(
                    ".delete-project"
                )
            ){

                event.stopPropagation();

                await deleteSavedProject(
                    project.id
                );

                return;
            }

            await openSavedProject(
                project.id
            );
        };

        container.appendChild(
            button
        );
    });
}

async function deleteSavedProject(id){

    if(
        !confirm(
            "Delete this saved project from this browser?"
        )
    ){

        return;
    }

    await deleteProject(id);

    if(
        id === currentProjectId
    ){

        currentProjectId = null;

        sources = [];

        conversation = [];

        generatedSchedule = null;

        currentProjectName =
            "Untitled project";

        renderSources();

        clearChat();

        updateProjectMeta();
    }

    await renderSavedProjects();
}

async function openSavedProject(id){

    const project =
        await loadProject(id);

    if(!project) return;

    currentProjectId =
        project.id;

    currentProjectName =
        project.name ||
        "Untitled project";

    sources =
        project.sources || [];

    conversation =
        project.conversation || [];

    generatedSchedule =
        project.generatedSchedule ||
        null;

    document
        .getElementById("projectTitle")
        .textContent =
        currentProjectName;

    document
        .getElementById("formatSelect")
        .value =
        project.format || "xml";

    restoreScheduleAnswers(
        project.scheduleAnswers
    );

    renderSources();

    updateProjectMeta();

    renderChatFromConversation();

    if(generatedSchedule){

        addScheduleMessage(
            generatedSchedule
        );
    }

    await renderSavedProjects();

    updateSaveStatus(
        "Saved locally ✓"
    );
}

function restoreScheduleAnswers(answers){

    if(!answers) return;

    const mapping = {

        projectStart:
            answers.projectStart,

        projectFinish:
            answers.projectFinish,

        workingCalendar:
            answers.workingCalendar,

        milestones:
            answers.milestones,

        constraints:
            answers.constraints,

        scheduleLevel:
            answers.scheduleLevel
    };

    Object.entries(
        mapping
    ).forEach(
        ([id,value])=>{

            const element =
                document.getElementById(
                    id
                );

            if(
                element &&
                value !== undefined
            ){

                element.value =
                    value;
            }
        }
    );
}

function formatSavedDate(timestamp){

    if(!timestamp) return "";

    return new Date(
        timestamp
    ).toLocaleString(
        [],
        {
            day:"2-digit",
            month:"short",
            year:"numeric",
            hour:"2-digit",
            minute:"2-digit"
        }
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

async function initialiseApp(){

    await renderSavedProjects();

    aiReady = true;
    engineMode = "shared";
    setEngineStatus("shared", "Shared AI ready — model loads on first use", "ready");
    createScheduleButton.disabled = false;
    updateSendButton();
}

initialiseApp();

window.handleFiles =
async function(fileList){

    const files =
        Array.from(
            fileList || []
        );

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

                text
            });

        }catch(error){

            console.error(
                "Could not read file:",
                error
            );

            alert(
                `Could not read "${file.name}".`
            );
        }
    }

    renderSources();

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

function renderSources(){

    const container =
        document.getElementById(
            "sources"
        );

    container.innerHTML = "";

    if(!sources.length){

        container.innerHTML = `
            <div class="source-empty">
                Your project documents will appear here.
            </div>
        `;
    }

    sources.forEach(
        source=>{

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "source-item";

            item.innerHTML = `

                <div class="source-icon">
                    ${getFileIcon(
                        source.name
                    )}
                </div>

                <div class="source-info">

                    <div
                        class="source-name"
                        title="${escapeHtml(
                            source.name
                        )}"
                    >
                        ${escapeHtml(
                            source.name
                        )}
                    </div>

                    <div class="source-size">
                        ${formatBytes(
                            source.size
                        )}
                    </div>

                </div>

                <button
                    class="remove-source"
                    title="Remove source"
                >
                    ×
                </button>
            `;

            item
                .querySelector(
                    ".remove-source"
                )
                .onclick =
                ()=>{

                    sources =
                        sources.filter(
                            item=>
                                item.id !==
                                source.id
                        );

                    renderSources();

                    updateProjectMeta();

                    scheduleAutoSave();
                };

            container.appendChild(
                item
            );
        }
    );

    document
        .getElementById(
            "sourceCount"
        )
        .textContent =
        sources.length;
}

function getFileIcon(name){

    const extension =
        name
            .split(".")
            .pop()
            .toLowerCase();

    if(
        extension === "pdf"
    ) return "PDF";

    if(
        extension === "docx"
    ) return "DOC";

    if(
        extension === "csv"
    ) return "CSV";

    if(
        extension === "json"
    ) return "{}";

    if(
        extension === "md"
    ) return "MD";

    return "TXT";
}

function formatBytes(bytes){

    if(
        bytes < 1024
    ){

        return `${bytes} B`;
    }

    if(
        bytes < 1024 * 1024
    ){

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

    if(!sources.length){

        meta.textContent =
            "Upload project information to begin";

        return;
    }

    meta.textContent =
        `${sources.length} project source${
            sources.length === 1
                ? ""
                : "s"
        } uploaded`;
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

const MAX_CONVERSATION_MESSAGES = 12;

function trimConversation(){

    if(conversation.length <= MAX_CONVERSATION_MESSAGES){

        return conversation;
    }

    return conversation.slice(
        conversation.length - MAX_CONVERSATION_MESSAGES
    );
}

function buildSourceContext(){

    if(!sources.length){

        return `
No project documents have been uploaded.

Do not invent project-specific information.
`;
    }

    const MAX_PER_SOURCE =
        18000;

    const MAX_TOTAL =
        70000;

    let total =
        0;

    const blocks = [];

    for(
        let index = 0;
        index < sources.length;
        index++
    ){

        const source =
            sources[index];

        const remaining =
            MAX_TOTAL - total;

        if(remaining <= 0){

            blocks.push(
                `\n[${sources.length - index} more source(s) omitted — over the context budget for this turn]\n`
            );

            break;
        }

        const allowed =
            Math.min(
                MAX_PER_SOURCE,
                remaining
            );

        const text =
            source.text.slice(
                0,
                allowed
            );

        const block = `
SOURCE ${index + 1}
FILE: ${source.name}

${text}

END SOURCE ${index + 1}
`;

        blocks.push(block);

        total += block.length;
    }

    return blocks.join("\n\n");
}

function buildCPUSourceContext(){

    if(!sources.length){

        return `
No project documents have been uploaded.

Do not invent project-specific information.
`;
    }

    let total =
        0;

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

        if(remaining <= 0){

            break;
        }

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
            "\n[CPU fallback: some source documents were truncated to keep the local CPU prompt manageable.]"
        );
    }

    return blocks.join(
        "\n\n"
    );
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
    ){

        return;
    }

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

                content:`

You are ScheduleBuilder,
a professional project scheduling assistant.

You analyse project information supplied by the user.

When discussing project schedules:

- Identify activities.
- Identify logical relationships.
- Identify milestones.
- Identify constraints.
- Identify assumptions.
- Identify missing information.
- Never claim that an assumption is confirmed fact.
- Do not invent project-specific facts.
- Ask useful clarification questions.
- Help prepare professional construction programmes.

PROJECT SOURCES:

${
    engineMode === "cpu"
        ? buildCPUSourceContext()
        : buildSourceContext()
}
`
            },

            ...trimConversation()
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

                    temperature:.25,

                    max_tokens:
                        engineMode === "cpu"
                            ? 700
                            : 1200,

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
            (engineMode === "gpu" || engineMode === "mlc") &&
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
                        ?.delta
                        ?.content ||
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
            "Chat error:",
            error
        );

        removeLoading(
            loadingId
        );

        addMessage(
            "assistant",
            `
**I couldn't complete that request.**

The selected AI service encountered an error.

If you selected a browser or local model, it may be taking too long or the browser may not have enough available memory. If you selected OmniRoute, verify that OmniRoute is running and reachable.

**Technical information:**

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

window.startScheduleCreation =
async function(){

    if(!sources.length){

        addMessage(
            "assistant",
            `
**Please upload some project information first.**

I need the project documents before I can build a meaningful schedule.
`
        );

        return;
    }

    try{
        await ensureAssistantReady();
    }catch(error){
        addMessage(
            "assistant",
            `**AI could not be started.**\n\n${escapeHtml(error?.message || "Unknown error")}`
        );
        return;
    }

    if(aiBusy){

        return;
    }

    document
        .getElementById(
            "welcome"
        )
        ?.remove();

    const loadingId =
        addLoading();

    aiBusy = true;

    try{

        const sourceContext =
            engineMode === "cpu"
                ? buildCPUSourceContext()
                : buildSourceContext();

        const result =
            await runAI(
                [

                    {

                        role:"system",

                        content:`

You are a senior project planner.

Review the supplied project documents.

Identify:

1. Project name.
2. Major phases.
3. Major activities.
4. Known milestones.
5. Known durations.
6. Dependencies.
7. Constraints.
8. Missing information required to build a credible programme.

Do not invent information.

PROJECT DOCUMENTS:

${sourceContext}
`
                    },

                    {

                        role:"user",

                        content:
                            "Review these documents in preparation for creating a project schedule."
                    }
                ],
                {

                    temperature:.15,

                    max_tokens:
                        engineMode === "cpu"
                            ? 900
                            : 1400,

                    stream:false
                }
            );

        removeLoading(
            loadingId
        );

        const analysis =
            result
                ?.choices?.[0]
                ?.message?.content ||
            "The documents have been reviewed.";

        addMessage(
            "assistant",
            analysis
        );

        conversation.push({

            role:"assistant",

            content:analysis
        });

        openScheduleModal();

    }catch(error){

        console.error(
            "Schedule analysis error:",
            error
        );

        removeLoading(
            loadingId
        );

        addMessage(
            "assistant",
            `
**I couldn't analyse the documents automatically.**

You can still provide the project parameters in the schedule setup.

**Technical information:**

\`${escapeHtml(
    error?.message ||
    "Unknown error"
)}\`
`
        );

        openScheduleModal();

    }finally{

        aiBusy = false;

        updateSendButton();
    }
};

function openScheduleModal(){

    document
        .getElementById(
            "scheduleModal"
        )
        .classList.add(
            "open"
        );
}

window.closeScheduleModal =
function(){

    document
        .getElementById(
            "scheduleModal"
        )
        .classList.remove(
            "open"
        );
};

window.generateSchedule =
async function(){

    closeScheduleModal();

    if(!aiReady){
        try{
            await ensureAssistantReady();
        }catch(error){
            addMessage(
                "assistant",
                `**AI could not be started.**\n\n${escapeHtml(error?.message || "Unknown error")}`
            );
            return;
        }
    }

    if(aiBusy){

        return;
    }

    const projectName =
        document
            .getElementById(
                "projectName"
            )
            .value
            .trim();

    const start =
        document
            .getElementById(
                "projectStart"
            )
            .value;

    const finish =
        document
            .getElementById(
                "projectFinish"
            )
            .value;

    const calendar =
        document
            .getElementById(
                "workingCalendar"
            )
            .value;

    const milestones =
        document
            .getElementById(
                "milestones"
            )
            .value;

    const constraints =
        document
            .getElementById(
                "constraints"
            )
            .value;

    const detail =
        document
            .getElementById(
                "scheduleLevel"
            )
            .value;

    if(projectName){

        currentProjectName =
            projectName;

        document
            .getElementById(
                "projectTitle"
            )
            .textContent =
            projectName;
    }

    addMessage(
        "user",
        `
**Create Schedule**

Start: ${start || "Not specified"}

Finish: ${finish || "Not specified"}

Calendar: ${calendar}

Detail: ${detail}
`
    );

    scheduleAutoSave();

    const loadingId =
        addLoading();

    aiBusy = true;

    try{

        const sourceContext =
            engineMode === "cpu"
                ? buildCPUSourceContext()
                : buildSourceContext();

        const prompt = `

Create a professional project schedule from the
supplied project information.

Return ONLY valid JSON.

Use exactly this structure:

{
    "projectName": "string",
    "activities": [
        {
            "id": 1,
            "name": "string",
            "duration": 5,
            "predecessors": [],
            "type": "Task"
        }
    ]
}

Rules:

- IDs must be sequential integers.
- Predecessor IDs must refer to earlier activities.
- Use logical dependencies.
- Include major phases.
- Include construction activities.
- Include procurement activities where supported.
- Include testing/commissioning where appropriate.
- Include milestones where appropriate.
- Milestones have duration 0.
- Avoid duplicate activities.
- Do not fabricate project-specific facts.
- Use reasonable planning assumptions where exact information is missing.
- Do not include markdown.
- Do not include explanatory text outside JSON.

PROJECT NAME:
${projectName || "ScheduleBuilder Project"}

PROJECT START:
${start || "Not specified"}

PROJECT FINISH:
${finish || "Not specified"}

WORKING CALENDAR:
${calendar}

SCHEDULE DETAIL:
${detail}

MILESTONES:
${milestones || "None specified"}

CONSTRAINTS:
${constraints || "None specified"}

PROJECT DOCUMENTS:

${sourceContext}
`;

        const result =
            await runAI(
                [

                    {

                        role:"system",

                        content:
                            "You are a senior construction planner who creates structured project schedules."
                    },

                    {

                        role:"user",

                        content:prompt
                    }
                ],
                {

                    temperature:.05,

                    max_tokens:
                        engineMode === "cpu"
                            ? 2400
                            : 5000,

                    stream:false
                }
            );

        removeLoading(
            loadingId
        );

        const raw =
            result
                ?.choices?.[0]
                ?.message?.content ||
            "";

        const schedule =
            parseScheduleJSON(
                raw
            );

        if(
            !schedule ||
            !Array.isArray(
                schedule.activities
            )
        ){

            throw new Error(
                "The local model did not return valid schedule JSON."
            );
        }

        generatedSchedule =
            normaliseSchedule(
                schedule
            );

        addScheduleMessage(
            generatedSchedule
        );

        conversation.push({

            role:"assistant",

            content:
                `Schedule generated with ${
                    generatedSchedule
                        .activities
                        .length
                } activities.`
        });

        await saveCurrentProject();

    }catch(error){

        console.error(
            "Schedule generation error:",
            error
        );

        removeLoading(
            loadingId
        );

        addMessage(
            "assistant",
            `
**I couldn't generate a structured schedule.**

CPU mode is designed for devices without a GPU, but smaller CPU models have less capacity and can struggle with very large programmes.

Try selecting a less detailed programme or uploading the project information in smaller documents.

**Technical information:**

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

function parseScheduleJSON(raw){

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

function normaliseSchedule(
    schedule
){

    return {

        projectName:
            schedule.projectName ||
            currentProjectName ||
            "ScheduleBuilder Project",

        activities:
            schedule.activities.map(
                (
                    activity,
                    index
                )=>({

                    id:
                        index + 1,

                    name:
                        activity.name ||
                        `Activity ${
                            index + 1
                        }`,

                    duration:
                        Number(
                            activity.duration
                        ) >= 0

                            ? Number(
                                activity.duration
                            )

                            : 0,

                    predecessors:
                        Array.isArray(
                            activity.predecessors
                        )

                            ? activity
                                .predecessors
                                .map(Number)
                                .filter(
                                    id =>
                                        id <
                                        index + 1
                                )

                            : [],

                    type:
                        activity.type ||
                        (
                            Number(
                                activity.duration
                            ) === 0

                                ? "Milestone"

                                : "Task"
                        )
                })
            )
    };
}

function addScheduleMessage(
    schedule
){

    if(!schedule) return;

    const wrapper =
        document.createElement(
            "div"
        );

    wrapper.className =
        "message assistant";

    const rows =
        schedule.activities
            .slice(
                0,
                20
            )
            .map(
                activity=>`

                    <tr>

                        <td>
                            ${activity.id}
                        </td>

                        <td>
                            ${escapeHtml(
                                activity.name
                            )}
                        </td>

                        <td>
                            ${
                                activity.type ===
                                "Milestone"

                                    ? "Milestone"

                                    : activity.duration
                            }
                        </td>

                        <td>
                            ${
                                activity.predecessors
                                    .length

                                    ? activity
                                        .predecessors
                                        .join(", ")

                                    : "—"
                            }
                        </td>

                    </tr>
                `
            )
            .join("");

    const more =
        schedule.activities.length > 20

            ? `
                <div style="
                    padding:10px 12px;
                    color:#888;
                    font-size:9px;
                ">
                    Showing first 20 of
                    ${schedule.activities.length}
                    activities.
                </div>
            `

            : "";

    wrapper.innerHTML = `

        <div class="avatar">
            ✦
        </div>

        <div class="message-body">

            <p>
                Your schedule has been created.
                I generated
                <strong>
                    ${schedule.activities.length}
                    activities
                </strong>
                from the project information.
            </p>

            <div class="schedule-card">

                <div class="schedule-card-header">

                    <div class="schedule-card-title">
                        ${escapeHtml(
                            schedule.projectName
                        )}
                    </div>

                    <div class="schedule-card-status">
                        SCHEDULE READY
                    </div>

                </div>

                <table class="schedule-table">

                    <thead>

                        <tr>
                            <th>ID</th>
                            <th>Activity</th>
                            <th>Duration</th>
                            <th>Predecessors</th>
                        </tr>

                    </thead>

                    <tbody>
                        ${rows}
                    </tbody>

                </table>

                ${more}

                <div class="schedule-actions">

                    <button
                        class="download-button primary"
                        onclick="downloadXML()"
                    >
                        ↓ Microsoft Project XML
                    </button>

                    <button
                        class="download-button"
                        onclick="downloadXER()"
                    >
                        ↓ Primavera P6 XER
                    </button>

                </div>

            </div>
        </div>
    `;

    chat.appendChild(
        wrapper
    );

    chat.scrollTop =
        chat.scrollHeight;
}

window.downloadXML =
function(){

    if(!generatedSchedule){

        alert(
            "Create a schedule first."
        );

        return;
    }

    const start =
        document
            .getElementById(
                "projectStart"
            )
            .value ||

        new Date()
            .toISOString()
            .slice(
                0,
                10
            );

    const xml =
        buildMicrosoftProjectXML(
            generatedSchedule,
            start
        );

    downloadFile(
        xml,
        `${safeFilename(
            generatedSchedule.projectName
        )}.xml`,
        "application/xml"
    );
};

function buildMicrosoftProjectXML(
    schedule,
    projectStart
){

    const tasks =
        schedule.activities
            .map(
                activity=>{

                    const startDate =
                        calculateActivityDate(
                            schedule.activities,
                            activity,
                            projectStart
                        );

                    const finishDate =
                        calculateFinishDate(
                            startDate,
                            activity.duration
                        );

                    const predecessors =
                        activity.predecessors
                            .map(
                                id=>`

                                    <PredecessorLink>

                                        <PredecessorUID>
                                            ${id}
                                        </PredecessorUID>

                                        <Type>
                                            1
                                        </Type>

                                    </PredecessorLink>
                                `
                            )
                            .join("");

                    return `

                        <Task>

                            <UID>
                                ${activity.id}
                            </UID>

                            <ID>
                                ${activity.id}
                            </ID>

                            <Name>
                                ${xmlEscape(
                                    activity.name
                                )}
                            </Name>

                            <Type>
                                1
                            </Type>

                            <IsNull>
                                0
                            </IsNull>

                            <Duration>
                                PT${activity.duration * 8}H0M0S
                            </Duration>

                            <DurationFormat>
                                7
                            </DurationFormat>

                            <Start>
                                ${startDate}T08:00:00
                            </Start>

                            <Finish>
                                ${finishDate}T17:00:00
                            </Finish>

                            <Milestone>
                                ${
                                    activity.duration === 0
                                        ? 1
                                        : 0
                                }
                            </Milestone>

                            ${predecessors}

                        </Task>
                    `;
                }
            )
            .join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>

<Project xmlns="http://schemas.microsoft.com/project">

    <SaveVersion>14</SaveVersion>

    <Name>
        ${xmlEscape(
            schedule.projectName
        )}
    </Name>

    <Title>
        ${xmlEscape(
            schedule.projectName
        )}
    </Title>

    <ScheduleFromStart>1</ScheduleFromStart>

    <StartDate>
        ${projectStart}T08:00:00
    </StartDate>

    <MinutesPerDay>
        480
    </MinutesPerDay>

    <MinutesPerWeek>
        2400
    </MinutesPerWeek>

    <DaysPerMonth>
        20
    </DaysPerMonth>

    <DefaultStartTime>
        08:00:00
    </DefaultStartTime>

    <DefaultFinishTime>
        17:00:00
    </DefaultFinishTime>

    <Tasks>
        ${tasks}
    </Tasks>

</Project>`;
}

window.downloadXER =
function(){

    if(!generatedSchedule){

        alert(
            "Create a schedule first."
        );

        return;
    }

    const xer =
        buildXER(
            generatedSchedule
        );

    downloadFile(
        xer,
        `${safeFilename(
            generatedSchedule.projectName
        )}.xer`,
        "text/plain"
    );
};

function buildXER(
    schedule
){

    const projectId =
        "100";

    const projectName =
        schedule.projectName
            .replace(
                /\t/g,
                " "
            )
            .replace(
                /\r?\n/g,
                " "
            );

    let xer = "";

    xer +=
        "ERMHDR\t8.0\tScheduleBuilder\t" +
        new Date().toISOString() +
        "\n";

    xer +=
        "%T\tPROJECT\n";

    xer +=
        "%F\tproj_id\tproj_short_name\tproj_name\n";

    xer +=
        `%R\t${projectId}\t${projectName.slice(
            0,
            20
        )}\t${projectName}\n`;

    xer +=
        "%T\tTASK\n";

    xer +=
        "%F\ttask_id\tproj_id\ttask_name\tstatus_code\ttask_type\ttarget_drtn_hr_cnt\n";

    schedule.activities
        .forEach(
            activity=>{

                const taskType =
                    activity.duration === 0
                        ? "TT_Mile"
                        : "TT_Task";

                xer +=
                    `%R\t${activity.id}\t${projectId}\t${cleanXER(
                        activity.name
                    )}\tTK_NotStart\t${taskType}\t${
                        activity.duration * 8
                    }\n`;
            }
        );

    xer +=
        "%T\tTASKPRED\n";

    xer +=
        "%F\tpred_id\ttask_id\tpred_task_id\tpred_type\n";

    let predId =
        1;

    schedule.activities
        .forEach(
            activity=>{

                activity.predecessors
                    .forEach(
                        predecessor=>{

                            xer +=
                                `%R\t${predId}\t${activity.id}\t${predecessor}\tPR_FS\n`;

                            predId++;
                        }
                    );
            }
        );

    xer +=
        "%E\n";

    return xer;
}

function cleanXER(
    value
){

    return String(value)
        .replace(
            /\t/g,
            " "
        )
        .replace(
            /\r?\n/g,
            " "
        );
}

function calculateActivityDate(
    activities,
    activity,
    projectStart
){

    if(
        !activity.predecessors.length
    ){

        return projectStart;
    }

    let latestDate =
        new Date(
            projectStart
        );

    activity.predecessors
        .forEach(
            predecessorId=>{

                const predecessor =
                    activities.find(
                        item =>
                            item.id ===
                            predecessorId
                    );

                if(!predecessor)
                    return;

                const predecessorStart =
                    calculateActivityDate(
                        activities,
                        predecessor,
                        projectStart
                    );

                const predecessorFinish =
                    new Date(
                        predecessorStart
                    );

                predecessorFinish.setDate(
                    predecessorFinish.getDate() +
                    predecessor.duration
                );

                if(
                    predecessorFinish >
                    latestDate
                ){

                    latestDate =
                        predecessorFinish;
                }
            }
        );

    return formatDate(
        latestDate
    );
}

function calculateFinishDate(
    start,
    duration
){

    const date =
        new Date(start);

    date.setDate(
        date.getDate() +
        Math.max(
            0,
            duration
        )
    );

    return formatDate(
        date
    );
}

function formatDate(
    date
){

    return date
        .toISOString()
        .slice(
            0,
            10
        );
}

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

    if(
        !conversation.length
    ){

        chat.innerHTML = `

            <div id="welcome" class="welcome">

                <div class="welcome-logo">
                    ✦
                </div>

                <h1>
                    Build your project schedule
                </h1>

                <p>
                    Continue working on your project.
                    Your saved information has been restored.
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
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
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

window.updateSendButton = updateSendButton;

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
                Build your project schedule
            </h1>

            <p>
                Upload project information and
                discuss it with ScheduleBuilder.
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
        generatedSchedule
    ){

        const confirmed =
            confirm(
                "Start a new project? Your current project is already saved locally."
            );

        if(!confirmed)
            return;
    }

    currentProjectId =
        null;

    currentProjectName =
        "Untitled project";

    sources = [];

    conversation = [];

    generatedSchedule =
        null;

    document
        .getElementById(
            "projectTitle"
        )
        .textContent =
        "Untitled project";

    document
        .getElementById(
            "formatSelect"
        )
        .value =
        "xml";

    document
        .getElementById(
            "projectName"
        )
        .value =
        "";

    document
        .getElementById(
            "projectStart"
        )
        .value =
        "";

    document
        .getElementById(
            "projectFinish"
        )
        .value =
        "";

    document
        .getElementById(
            "workingCalendar"
        )
        .value =
        "Monday-Friday";

    document
        .getElementById(
            "milestones"
        )
        .value =
        "";

    document
        .getElementById(
            "constraints"
        )
        .value =
        "";

    document
        .getElementById(
            "scheduleLevel"
        )
        .value =
        "Detailed";

    renderSources();

    updateProjectMeta();

    clearChat();

    updateSaveStatus(
        "New project"
    );

    renderSavedProjects();
};

function getProjectName(){

    const title =
        document.getElementById(
            "projectTitle"
        );

    return (
        currentProjectName ||
        title?.textContent ||
        "Untitled project"
    );
}

function safeFilename(
    value
){

    return String(
        value ||
        "ScheduleBuilder-Project"
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

    return String(value)
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

function xmlEscape(
    value
){

    return String(value)
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
            "&apos;"
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

messageInput.addEventListener(
    "input",
    updateSendButton
);

window.addEventListener(
    "beforeunload",
    ()=>{}
);

document
    .getElementById(
        "scheduleModal"
    )
    .addEventListener(
        "click",
        event=>{

            if(
                event.target.id ===
                "scheduleModal"
            ){

                closeScheduleModal();
            }
        }
    );
