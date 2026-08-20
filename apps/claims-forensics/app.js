const MODEL_CATALOG = [
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

function findModelEntry(value){
    return MODEL_CATALOG.find(m => m.value === value) || MODEL_CATALOG.find(m => m.engine === "browserlite") || MODEL_CATALOG[0];
}



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
    {id:"contract", name:"Contract Documents", icon:"§", section:"project"},
    {id:"scope", name:"Scope Documents", icon:"◫", section:"project"},
    {id:"schedule", name:"Schedule", icon:"▦", section:"project"},
    {id:"schedule-baseline", name:"Baseline Programme", icon:"P6", section:"project", child:true},
    {id:"schedule-updates", name:"Programme Updates", icon:"P6", section:"project", child:true},
    {id:"schedule-revisions", name:"Revisions", icon:"P6", section:"project", child:true},
    {id:"boq", name:"Bill of Quantities", icon:"≣", section:"project"},
    {id:"drawings", name:"Drawings", icon:"⌗", section:"project"},
    {id:"cables", name:"Cable Schedules", icon:"⌁", section:"project"},

    {id:"correspondence", name:"Correspondence", icon:"✉", section:"claims"},
    {id:"notices", name:"Notices", icon:"!", section:"claims"},
    {id:"instructions", name:"Instructions / Directions", icon:"→", section:"claims"},
    {id:"variations", name:"Variations / Changes", icon:"Δ", section:"claims"},
    {id:"rfi", name:"RFIs / TQs", icon:"?", section:"claims"},
    {id:"daily", name:"Daily Reports", icon:"D", section:"claims"},
    {id:"weekly", name:"Weekly Reports", icon:"W", section:"claims"},
    {id:"monthly", name:"Monthly Reports", icon:"M", section:"claims"},
    {id:"meetings", name:"Meeting Minutes", icon:"☷", section:"claims"},
    {id:"photos", name:"Photographs / Videos", icon:"◉", section:"claims"},
    {id:"costs", name:"Costs / Invoices", icon:"€", section:"claims"},
    {id:"productivity", name:"Productivity Records", icon:"∿", section:"claims"},
    {id:"evidence", name:"Other Evidence", icon:"＋", section:"claims"}
];




let client = null;
let mlcClient = null;
let cpuGenerator = null;

let engineMode = null;

let currentModelValue = "omniroute:auto";
let aiReady = false;
let aiBusy = false;

let sources = [];
let conversation = [];

let recommendations = [];
let measurements = [];
let norms = [];
let claimEvents = [];
let currentWorkspace = "claims";
let currentClaimView = "overview";
let workspaceConversations = {contract:[], claims:[], quantity:[]};

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
        measurements:measurements,
        norms:norms,
        claimEvents:claimEvents,
        currentWorkspace:currentWorkspace,
        currentClaimView:currentClaimView,
        workspaceConversations:workspaceConversations,
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

    const container = document.getElementById("folderList");
    container.innerHTML = "";

    const renderSection = (sectionId, title) => {
        const titleEl = document.createElement("div");
        titleEl.className = "repo-section-title";
        titleEl.textContent = title;
        container.appendChild(titleEl);

        CONTRACT_FOLDERS.filter(f => f.section === sectionId).forEach(folder => {
            let count = sources.filter(source => source.folder === folder.id).length;

            if(folder.id === "schedule"){
                count += sources.filter(source =>
                    ["schedule-baseline","schedule-updates","schedule-revisions"].includes(source.folder)
                ).length;
            }

            const button = document.createElement("button");
            button.className = "folder" +
                (folder.child ? " child" : "") +
                (currentFolder === folder.id ? " active" : "");

            button.innerHTML = `
                <div class="folder-icon">${folder.icon}</div>
                <div class="folder-text">
                    <div class="folder-name">${escapeHtml(folder.name)}</div>
                </div>
                <div class="folder-count">${count}</div>
            `;
            button.onclick = () => selectFolder(folder.id);
            container.appendChild(button);
        });
    };

    renderSection("project", "Project information");
    renderSection("claims", "Claims & project records");

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

    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();


    if(
        [
            "txt",
            "md",
            "csv",
            "json",
            "html"
        ].includes(
            extension
        )
    ){

        return await file.text();
    }


    if(extension === "pdf"){

        await loadPDFJS();

        const arrayBuffer =
            await file.arrayBuffer();

        const pdf =
            await window.pdfjsLib
                .getDocument({
                    data:arrayBuffer
                })
                .promise;

        let text = "";


        for(
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ){

            const page =
                await pdf.getPage(
                    pageNumber
                );

            const content =
                await page.getTextContent();

            text +=
                content.items
                    .map(
                        item =>
                            item.str
                    )
                    .join(" ");

            text +=
                "\n\n";
        }


        return text;
    }


    if(extension === "docx"){

        await loadMammoth();

        const arrayBuffer =
            await file.arrayBuffer();

        const result =
            await window.mammoth
                .extractRawText({
                    arrayBuffer
                });

        return result.value;
    }


    

    if(
        extension === "xlsx" ||
        extension === "xls"
    ){

        return `
Spreadsheet file: ${file.name}

The spreadsheet has been uploaded but browser-side
spreadsheet parsing is not enabled in this version.

Please upload an exported CSV or PDF version if the
spreadsheet contents need to be analysed by the AI.
`;
    }


    throw new Error(
        "Unsupported file type"
    );
}


function loadPDFJS(){

    return new Promise(
        (resolve,reject)=>{

            if(window.pdfjsLib){

                resolve();

                return;
            }


            const script =
                document.createElement(
                    "script"
                );

            script.src =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";

            script.type =
                "module";


            script.onload =
                async()=>{

                    try{

                        window.pdfjsLib =
                            await import(
                                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
                            );

                        resolve();

                    }catch(error){

                        reject(error);
                    }
                };


            script.onerror =
                reject;


            document.head.appendChild(
                script
            );
        }
    );
}


function loadMammoth(){

    return new Promise(
        (resolve,reject)=>{

            if(window.mammoth){

                resolve();

                return;
            }


            const script =
                document.createElement(
                    "script"
                );

            script.src =
                "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js";

            script.onload =
                resolve;

            script.onerror =
                reject;

            document.head.appendChild(
                script
            );
        }
    );
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




function buildSourceContext(){

    if(!sources.length){

        return `
No project documents have been uploaded.

Do not invent project-specific facts.
`;
    }


    const MAX_PER_SOURCE =
        18000;


    return sources
        .map(
            (source,index)=>{

                return `
SOURCE ${index + 1}
CATEGORY: ${getFolderName(
                    source.folder
                )}
FILE: ${source.name}

${source.text.slice(
                    0,
                    MAX_PER_SOURCE
                )}

END SOURCE ${index + 1}
`;
            }
        )
        .join(
            "\n\n"
        );
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




async function disposeAIClients(){

    if(client){

        try{

            if(typeof client.dispose === "function"){
                await client.dispose();
            }

        }catch(error){
            console.warn("Could not dispose WebLLM client:", error);
        }
    }

    client = null;

    if(mlcClient){

        try{

            if(typeof mlcClient.unload === "function"){
                await mlcClient.unload();
            }

        }catch(error){
            console.warn("Could not dispose MLC client:", error);
        }
    }

    mlcClient = null;
}




async function initialiseGPU(tierKey){

    await disposeAIClients();

    setEngineStatus(
        "gpu",
        "Checking WebGPU...",
        "loading"
    );

    if(
        !navigator.gpu
    ){

        throw new Error(
            "WebGPU is not available."
        );
    }

    setEngineStatus(
        "gpu",
        "Checking GPU adapter...",
        "loading"
    );

    const adapter =
        await navigator.gpu
            .requestAdapter();

    if(!adapter){

        throw new Error(
            "No compatible GPU adapter was found."
        );
    }

    setEngineStatus(
        "gpu",
        "Starting WebLLM...",
        "loading"
    );

    client =
        createClient({

            local:{

                
                tiers: tierKey
                    ? { [tierKey]: GPU_MODELS[tierKey] }
                    : GPU_MODELS,

                useCache:true,

                useWebWorker:false
            },

            onProgress:progress=>{

                if(!progress) return;

                const percent =
                    typeof progress.progress ===
                    "number"

                        ? Math.round(
                            progress.progress <= 1
                                ? progress.progress * 100
                                : progress.progress
                        )

                        : null;

                if(percent !== null){

                    const stage =
                        progress.stage ||
                        "Loading";

                    setEngineStatus(
                        "gpu",
                        `GPU / WebLLM — ${stage} ${percent}%`,
                        "loading"
                    );

                }else if(
                    progress.stage
                ){

                    setEngineStatus(
                        "gpu",
                        `GPU / WebLLM — ${progress.stage}`,
                        "loading"
                    );
                }
            }
        });


    

    if(
        typeof client.init ===
        "function"
    ){

        await client.init();

    }else if(
        client.local &&
        typeof client.local.load ===
        "function"
    ){

        const status =
            typeof client.status ===
            "function"
                ? client.status()
                : null;

        const selectedModel =
            status?.localModel ||
            GPU_MODELS.low;

        await client.local.load(
            selectedModel
        );
    }

    engineMode = "gpu";

    aiReady = true;

    setEngineStatus(
        "gpu",
        "GPU / WebLLM ready",
        "ready"
    );
}




async function initialiseMLC(modelId){

    await disposeAIClients();

    setEngineStatus(
        "mlc",
        "Checking WebGPU...",
        "loading"
    );

    if(!navigator.gpu){

        throw new Error(
            "WebGPU is not available."
        );
    }

    const adapter =
        await navigator.gpu.requestAdapter();

    if(!adapter){

        throw new Error(
            "No compatible GPU adapter was found."
        );
    }

    setEngineStatus(
        "mlc",
        "Starting MLC WebLLM...",
        "loading"
    );

    
    const webllm =
        await import(
            "https://esm.run/@mlc-ai/web-llm"
        );

    mlcClient =
        await webllm.CreateMLCEngine(
            modelId,
            {
                initProgressCallback: report => {

                    const percent =
                        typeof report?.progress === "number"
                            ? Math.round(report.progress * 100)
                            : null;

                    setEngineStatus(
                        "mlc",
                        percent !== null
                            ? `MLC WebLLM — ${report.text || "Loading"} ${percent}%`
                            : (report?.text || "Loading MLC WebLLM..."),
                        "loading"
                    );
                }
            }
        );

    engineMode = "mlc";

    aiReady = true;

    setEngineStatus(
        "mlc",
        "MLC WebLLM ready",
        "ready"
    );
}




async function initialiseBrowserLite(modelId){

    modelId =
        modelId ||
        MODEL_CATALOG.find(m => m.engine === "browserlite").id;

    await initialiseCPU(modelId);

    engineMode = "browserlite";
    aiReady = true;

    setEngineStatus(
        "browserlite",
        "Lightweight Browser AI ready — Qwen2.5 0.5B",
        "ready"
    );
}




async function initialiseCPU(modelId){

    modelId =
        modelId ||
        MODEL_CATALOG.find(m => m.engine === "cpu").id;

    await disposeAIClients();

    engineMode = null;

    setEngineStatus(
        "cpu",
        "Starting CPU fallback...",
        "loading"
    );


    setEngineStatus(
        "cpu",
        "Loading CPU AI model...",
        "loading"
    );


    

    cpuGenerator =
        await pipeline(
            "text-generation",
            modelId,
            {
                device:"wasm",

                dtype:"q4",

                progress_callback:
                    progress=>{

                        if(!progress)
                            return;

                        if(
                            progress.status ===
                            "progress_total"
                        ){

                            const percent =
                                Math.round(
                                    progress.progress
                                );

                            setEngineStatus(
                                "cpu",
                                `CPU / WASM — downloading model ${percent}%`,
                                "loading"
                            );

                            return;
                        }

                        if(
                            progress.status ===
                            "progress"
                        ){

                            const percent =
                                typeof progress.progress ===
                                "number"
                                    ? Math.round(
                                        progress.progress
                                    )
                                    : null;

                            if(
                                percent !== null
                            ){

                                setEngineStatus(
                                    "cpu",
                                    `CPU / WASM — downloading model ${percent}%`,
                                    "loading"
                                );
                            }

                            return;
                        }

                        if(
                            progress.status ===
                            "ready"
                        ){

                            setEngineStatus(
                                "cpu",
                                "CPU / WASM — model ready",
                                "loading"
                            );
                        }
                    }
            }
        );


    engineMode = "cpu";

    aiReady = true;

    setEngineStatus(
        "cpu",
        "CPU / WASM ready",
        "ready"
    );
}




async function initialiseAssistant(){
    aiReady=false;
    sendButton.disabled=true;
    try{
        const select=document.getElementById("modelSelect");
        const preferred=select?.value || localStorage.getItem("projectControlsSharedAIModel") || "omniroute:auto";
        currentModelValue=preferred;
        await window.parent.ProjectControlsCore.ai.ensure(preferred);
        engineMode=window.parent.ProjectControlsCore.ai.status().engine;
        aiReady=true;
        setEngineStatus(engineMode,window.parent.ProjectControlsCore.ai.status().label,"ready");
        updateSendButton();
    }catch(error){
        aiReady=false;
        setEngineStatus(null,"AI unavailable","error");
        console.error(error);
    }
}



let modelSwitchInFlight = false;

window.changeModel = async function(value){
    if(!value) return;
    const select=document.getElementById("modelSelect");
    if(select) select.disabled=true;
    try{
        await window.parent.ProjectControlsCore.ai.ensure(value);
        currentModelValue=value;
        engineMode=window.parent.ProjectControlsCore.ai.status().engine;
        aiReady=true;
        try{localStorage.setItem("projectControlsSharedAIModel",value)}catch(_){}
        setEngineStatus(engineMode,window.parent.ProjectControlsCore.ai.status().label,"ready");
        updateSendButton();
    }finally{
        if(select) select.disabled=false;
    }
};






async function runAI(messages,options={}){
    const select=document.getElementById("modelSelect");
    const requested=select?.value || currentModelValue || "omniroute:auto";
    await window.parent.ProjectControlsCore.ai.ensure(requested);
    currentModelValue=requested;
    engineMode=window.parent.ProjectControlsCore.ai.status().engine;
    aiReady=true;
    return await window.parent.ProjectControlsCore.ai.run(messages,options);
}


async function switchToCPU(){

    if(
        engineMode === "cpu" &&
        cpuGenerator
    ){

        return;
    }

    aiReady = false;

    sendButton.disabled = true;

    try{

        await initialiseCPU();

        sendButton.disabled =
            !messageInput.value.trim();

    }catch(error){

        aiReady = false;

        setEngineStatus(
            null,
            "AI unavailable",
            "error"
        );

        throw error;
    }
}






function prepareMessagesForCPU(
    messages
){

    return messages
        .filter(
            message =>
                message &&
                message.content
        )
        .map(
            message=>{

                let content =
                    String(
                        message.content
                    );


                if(
                    content.length >
                    CPU_MAX_TOTAL_CONTEXT_CHARS
                ){

                    content =
                        content.slice(
                            0,
                            CPU_MAX_TOTAL_CONTEXT_CHARS
                        ) +
                        "\n[Context truncated for CPU inference]";
                }


                return {

                    role:
                        message.role,

                    content
                };
            }
        );
}


async function runCPUGeneration(
    messages,
    {
        temperature=.2,
        max_tokens=1000,
        stream=false,
        onToken=null
    }={}
){

    const cpuMessages =
        prepareMessagesForCPU(
            messages
        );


    let streamedText = "";


    let streamer = null;


    if(stream){

        streamer =
            new TextStreamer(
                cpuGenerator.tokenizer,
                {

                    skip_prompt:true,

                    skip_special_tokens:true,

                    callback_function:
                        token=>{

                            streamedText +=
                                token;


                            if(
                                typeof onToken ===
                                "function"
                            ){

                                onToken(
                                    token,
                                    streamedText
                                );
                            }
                        }
                }
            );
    }


    const options = {

        max_new_tokens:
            Math.min(
                max_tokens,
                1800
            ),

        do_sample:
            temperature > 0,

        repetition_penalty:
            1.05,

        streamer
    };


    if(options.do_sample){

        options.temperature =
            Math.max(
                .1,
                Math.min(
                    temperature,
                    1
                )
            );
    }


    const output =
        await cpuGenerator(
            cpuMessages,
            options
        );


    const generatedText =
        streamedText ||
        extractCPUGeneratedText(
            output
        );


    return {

        choices:[

            {

                message:{

                    role:"assistant",

                    content:
                        generatedText
                },

                delta:{

                    content:
                        generatedText
                }
            }
        ]
    };
}


function extractCPUGeneratedText(
    output
){

    const first =
        output?.[0];


    if(!first)
        return "";


    const generated =
        first.generated_text;


    if(
        Array.isArray(
            generated
        )
    ){

        const last =
            generated[
                generated.length - 1
            ];


        if(
            last &&
            typeof last.content ===
            "string"
        ){

            return last.content;
        }
    }


    if(
        typeof generated ===
        "string"
    ){

        return generated;
    }


    return "";
}




function buildContractSystemPrompt(){

    const docContext =
        (engineMode === "cpu" || engineMode === "browserlite")
            ? buildCPUSourceContext()
            : buildSourceContext();

    if(currentWorkspace === "claims"){
        const eventContext = claimEvents.slice(0,120).map(e=>JSON.stringify(e)).join("\n");
        return `You are Claims & Forensic Analysis, a senior construction claims, delay and forensic schedule-analysis assistant.

You work from evidence first. Never invent project facts, dates, contractual clauses, notices, schedule impacts, critical-path effects, causation, entitlement or quantum.

Use these analytical principles:
- Structure each potential claim around Cause, Effect, Entitlement and Substantiation (CEES).
- Validate the baseline, contemporaneous updates, revisions, actual dates, logic, calendars, constraints and granted extensions before relying on a forensic model.
- Distinguish prospective from retrospective analysis and observational from modelled analysis.
- Consider Time Impact Analysis, windows/time-slice analysis, as-planned versus as-built, impacted as-planned and collapsed as-built only where the available records support the method.
- Concurrency must be analysed explicitly. Distinguish critical from non-critical delay, excusable from non-excusable delay, compensable from non-compensable delay, and employer/contractor/neutral responsibility.
- Consider pacing, float, mitigation, acceleration, disruption and prolongation separately.
- For disruption, prefer project-specific productivity evidence such as measured-mile or comparable-work analysis when it is actually available.
- Treat the uploaded contract as controlling. Do not assume standard FIDIC/NEC/JCT wording if the executed clause is not in the repository.
- Identify evidence gaps and weaknesses as clearly as supporting evidence.
- A claim narrative should be the final product of the evidence and analysis, not a substitute for it.

PROJECT: ${currentProjectName}

SHARED PROJECT REPOSITORY:
${docContext}

CURRENT CLAIM / DELAY EVENT REGISTER:
${eventContext || "No claim events have been entered yet."}`;
    }

    if(currentWorkspace === "contract"){
        return `You are Contract Management Intelligence, a senior construction contract-management and project-controls assistant.
Use the same shared repository as the claims module.
Help identify contractual obligations, notices, instructions, changes, programme requirements, payment/valuation issues, evidence gaps, and practical actions.
Always distinguish documented fact, reasonable inference and missing information.
Never invent clause wording or clause numbers. The executed uploaded contract controls.
Where an issue may become a claim, identify the evidence and records that should be preserved and explain how it may affect cause, effect, entitlement and substantiation.

PROJECT: ${currentProjectName}

SHARED PROJECT REPOSITORY:
${docContext}`;
    }

    const measurementContext = measurements.slice(0,250).map(m=>JSON.stringify(m)).join("\n");
    const normContext = norms.slice(0,150).map(n=>JSON.stringify(n)).join("\n");
    return `You are Quantity & Schedule Intelligence, a senior construction quantity take-off, estimating and project-controls assistant.
Your job is to assist, not fabricate measurements. Never claim to have geometrically measured a drawing unless an explicit measurement exists in the take-off register.
Distinguish extracted/documented quantities, user-entered measurements, and AI suggestions.
Help with classifying take-off items, matching drawing descriptions to BOQ items, matching quantities to schedule activities, checking BOQ variances, applying discipline norms, identifying missing norms, duplicates and unallocated quantities.

PROJECT: ${currentProjectName}

SHARED PROJECT REPOSITORY:
${docContext}

CURRENT TAKE-OFF REGISTER:
${measurementContext || "No measurements entered yet."}

NORM LIBRARY:
${normContext || "No norms entered yet."}`;
}



window.sendMessage =
async function(){

    const text =
        messageInput.value.trim();


    if(
        !text ||
        !aiReady ||
        aiBusy
    )
        return;


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


    conversation.push({role:"user",content:text});
    workspaceConversations[currentWorkspace] = conversation;
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

            ...conversation
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


        conversation.push({role:"assistant",content:answer});
        workspaceConversations[currentWorkspace] = conversation;
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

The local AI engine encountered an error.

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
        addMessage("assistant","**The local AI engine is still loading. Please wait a moment.**");
        return;
    }

    if(!sources.length){
        addMessage("assistant",
            currentWorkspace === "claims"
            ? "**Upload project records first.**\\n\\nFor forensic work, start with the executed contract, baseline programme, available updates/revisions, notices and contemporaneous records."
            : "**Upload project information first.**");
        return;
    }

    if(aiBusy) return;

    aiBusy = true;
    updateSendButton();
    const loadingId = addLoading();

    let task = "";
    if(currentWorkspace === "claims"){
        task = `Perform an initial forensic claims review.

Provide:
1. Executive forensic position.
2. Potential delay / claim events identifiable from the records.
3. Schedule-source reliability and data gaps.
4. Critical-path / longest-path issues that require testing.
5. Potential concurrency, pacing, float and mitigation issues.
6. Recommended forensic analysis method(s), with reasons and caveats.
7. Evidence gaps and records to obtain.
8. Potential disruption / prolongation / acceleration issues.
9. Immediate next forensic actions.
10. Do not state entitlement or days of EOT as proven unless the records demonstrate it.

Clearly separate facts, inference, assumptions and missing evidence.`;
    }else if(currentWorkspace === "contract"){
        task = `Perform an initial contract-management review.

Provide:
1. Executive contractual position.
2. Top current obligations and issues.
3. Potential notices, instructions or change-management actions.
4. Programme / delay concerns.
5. Evidence gaps.
6. Immediate recommended actions.
7. Issues that should be moved into the Claims & Forensics event register.

Do not invent clause numbers or wording.`;
    }else{
        task = `Review the uploaded project information and current take-off register.

Provide:
1. BOQ vs measured quantity issues.
2. Unallocated quantities.
3. Missing or suspicious norms.
4. Potential schedule-activity mapping issues.
5. Duplicate or unsupported quantities.
6. Traceability / evidence gaps.
7. Recommended take-off actions.

Do not invent geometric measurements.`;
    }

    try{
        const result = await runAI(
            [
                {role:"system",content:buildContractSystemPrompt()},
                {role:"user",content:task}
            ],
            {
                temperature:.12,
                max_tokens:(engineMode === "cpu" || engineMode === "browserlite") ? 1300 : 2000,
                stream:false
            }
        );

        removeLoading(loadingId);
        const answer = result?.choices?.[0]?.message?.content || "No analysis was returned.";
        addMessage("assistant",answer);
        conversation.push({role:"assistant",content:answer});
        workspaceConversations[currentWorkspace] = conversation;
        await generateRecommendations();
        scheduleAutoSave();

    }catch(error){
        removeLoading(loadingId);
        addMessage("assistant","**The analysis could not be completed.**\n\n`" + escapeHtml(error?.message || "Unknown error") + "`");
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


    const prompt = currentWorkspace === "claims" ? `
Based on the shared repository and current event register, identify forensic findings and recommended next actions.

Return ONLY valid JSON:
{"recommendations":[{"id":"short-id","category":"notice|risk|schedule|delay|general","title":"short title","description":"short evidence-based explanation","priority":"high|medium|low","reason":"why it matters","action":"next forensic action"}]}

Produce 6 to 10 concise findings. Prioritise:
- notice or procedural risk;
- unexplained schedule changes;
- source-validation problems;
- critical/near-critical path questions;
- concurrency or pacing;
- missing contemporaneous evidence;
- missing cause/effect linkage;
- disruption / measured-mile opportunities;
- quantum substantiation gaps.
Do not invent facts, clauses or delay days.
` : currentWorkspace === "quantity" ? `
Based on the project information and take-off register, return ONLY valid JSON:
{"recommendations":[{"id":"short-id","category":"notice|risk|schedule|delay|general","title":"short title","description":"short explanation","priority":"high|medium|low","reason":"why it matters","action":"next action"}]}
Focus on BOQ variance, unsupported quantities, missing norms, activity mapping, duplicates and traceability. Never invent geometric measurements.
` : `
Based on the shared project repository, return ONLY valid JSON:
{"recommendations":[{"id":"short-id","category":"notice|risk|schedule|delay|general","title":"short title","description":"short explanation","priority":"high|medium|low","reason":"why it matters","action":"next action"}]}
Focus on contract-management actions, notice risk, instructions/changes, programme obligations, entitlement preservation and evidence gaps. Never invent clause numbers.
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
                        (engineMode === "cpu" || engineMode === "browserlite")
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
        !aiReady ||
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
    workspaceConversations[currentWorkspace] = [];
    renderWorkspaceHome(false);
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
    measurements = [];
    norms = [];
    claimEvents = [];
    workspaceConversations = {contract:[],claims:[],quantity:[]};
    currentWorkspace = "claims";
    currentClaimView = "overview";

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
    switchWorkspace("claims", true);

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

    measurements = project.measurements || [];
    norms = project.norms || [];
    claimEvents = project.claimEvents || [];
    currentWorkspace = "claims";
    currentClaimView = project.currentClaimView || "overview";
    workspaceConversations = project.workspaceConversations || {
        contract:[],
        claims:[],
        quantity:(project.conversation || [])
    };
    conversation = workspaceConversations[currentWorkspace] || [];

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

    renderRecommendations();
    currentWorkspace="claims"; switchWorkspace("claims", true);

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






const CLAIM_VIEWS = [
    ["overview","Overview"],
    ["events","Events"],
    ["forensics","Forensics"],
    ["concurrency","Concurrency"],
    ["disruption","Disruption"],
    ["quantum","Quantum"],
    ["builder","Claim Builder"]
];

window.switchWorkspace = function(mode, force=false){

    if(!["contract","claims","quantity"].includes(mode)) mode = "claims";

    if(!force && currentWorkspace === mode) return;

    if(currentWorkspace && workspaceConversations[currentWorkspace]){
        workspaceConversations[currentWorkspace] = conversation;
    }

    currentWorkspace = mode;
    conversation = workspaceConversations[mode] || [];
    workspaceConversations[mode] = conversation;

    ["contract","claims","quantity"].forEach(x=>{
        document.getElementById("nav-"+x)?.classList.toggle("active",x===mode);
    });

    const qControls = document.getElementById("quantityControls");
    const takeoffButton = document.getElementById("takeoffButton");
    const exportXmlButton = document.getElementById("exportXmlButton");
    const addEventButton = document.getElementById("addEventButton");
    const analyseButton = document.getElementById("analyseButton");

    if(qControls) qControls.style.display = mode === "quantity" ? "inline-flex" : "none";
    if(takeoffButton) takeoffButton.style.display = mode === "quantity" ? "" : "none";
    if(exportXmlButton) exportXmlButton.style.display = mode === "quantity" ? "" : "none";
    if(addEventButton) addEventButton.style.display = mode === "claims" ? "" : "none";

    if(analyseButton){
        analyseButton.textContent =
            mode === "claims" ? "✦ Analyse claims" :
            mode === "contract" ? "✦ Analyse contract" :
            "✦ Analyse take-off";
    }

    const brandTitle = document.querySelector(".brand-title");
    const brandSubtitle = document.querySelector(".brand-subtitle");

    if(mode === "claims"){
        brandTitle.textContent = "Project Intelligence";
        brandSubtitle.textContent = "Claims · Delay · Forensic Schedule Analysis";
        messageInput.placeholder = "Ask about delays, events, concurrency, entitlement, evidence or claim preparation...";
        document.getElementById("rightTitle").textContent = "Forensic findings & recommendations";
        document.getElementById("rightSubtitle").textContent = "AI-assisted findings from the same shared project evidence and schedules.";
    }else if(mode === "contract"){
        brandTitle.textContent = "Project Intelligence";
        brandSubtitle.textContent = "Contract Strategy & Project Controls";
        messageInput.placeholder = "Ask about the contract, obligations, notices, changes, programme or evidence...";
        document.getElementById("rightTitle").textContent = "Contract actions & recommendations";
        document.getElementById("rightSubtitle").textContent = "Contract-management actions based on the shared repository.";
    }else{
        brandTitle.textContent = "Project Intelligence";
        brandSubtitle.textContent = "Take-off · BOQ · Schedule Allocation";
        messageInput.placeholder = "Ask about quantities, drawings, BOQ variances, norms or schedule allocation...";
        document.getElementById("rightTitle").textContent = "Take-off recommendations";
        document.getElementById("rightSubtitle").textContent = "AI-assisted checks based on the shared project repository and take-off register.";
    }

    renderModuleSubnav();
    renderWorkspaceHome(true);
    renderRecommendations();
    scheduleAutoSave();
};

function renderModuleSubnav(){
    const sub = document.getElementById("moduleSubnav");
    if(!sub) return;

    if(currentWorkspace === "claims"){
        sub.innerHTML = CLAIM_VIEWS.map(([id,label])=>
            `<button class="subnav-button ${currentClaimView===id?"active":""}" onclick="setClaimView('${id}')">${label}</button>`
        ).join("");
    }else if(currentWorkspace === "contract"){
        sub.innerHTML = [
            ["overview","Overview"],["obligations","Obligations"],["notices","Notices & Changes"],
            ["programme","Programme"],["evidence","Evidence"]
        ].map(([id,label],i)=>`<button class="subnav-button ${i===0?"active":""}" onclick="askWorkspaceQuestion('${escapeHtml(label)}')">${label}</button>`).join("");
    }else{
        sub.innerHTML = [
            ["overview","Overview"],["takeoff","Take-Off"],["boq","BOQ Comparison"],
            ["allocation","Schedule Allocation"],["norms","Norms"]
        ].map(([id,label],i)=>{
            const action = id==="takeoff"||id==="norms" ? "openTakeoffWorkspace()" : `askWorkspaceQuestion('${escapeHtml(label)}')`;
            return `<button class="subnav-button ${i===0?"active":""}" onclick="${action}">${label}</button>`;
        }).join("");
    }
}

window.setClaimView = function(view){
    currentClaimView = CLAIM_VIEWS.some(x=>x[0]===view) ? view : "overview";
    renderModuleSubnav();
    renderWorkspaceHome(true);
    scheduleAutoSave();
};

window.askWorkspaceQuestion = function(label){
    messageInput.value =
        currentWorkspace === "contract" ? `Review the ${label.toLowerCase()} position using the uploaded project information.` :
        currentWorkspace === "quantity" ? `Review the ${label.toLowerCase()} using the uploaded project information and take-off register.` :
        `Review ${label.toLowerCase()} for the current claims position.`;
    autoResize(messageInput);
    updateSendButton();
    messageInput.focus();
};

function renderWorkspaceHome(includeConversation=true){
    chat.innerHTML = "";

    if(currentWorkspace === "claims"){
        renderClaimsWorkspace();
    }else if(currentWorkspace === "contract"){
        renderContractWorkspace();
    }else{
        renderQuantityWorkspace();
    }

    if(includeConversation && conversation.length){
        const divider = document.createElement("div");
        divider.className = "chat-divider";
        divider.textContent = "AI conversation";
        chat.appendChild(divider);

        conversation.forEach(msg=>addMessage(msg.role,msg.content));
    }

    chat.scrollTop = 0;
}

function sourceCount(folderIds){
    const ids = Array.isArray(folderIds) ? folderIds : [folderIds];
    return sources.filter(s=>ids.includes(s.folder)).length;
}

function formatDateShort(v){
    if(!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"});
}

function eventDelayDays(e){
    if(Number.isFinite(+e.days) && +e.days) return +e.days;
    if(!e.start || !e.finish) return 0;
    const a=new Date(e.start), b=new Date(e.finish);
    if(Number.isNaN(a)||Number.isNaN(b)) return 0;
    return Math.max(0,Math.round((b-a)/86400000)+1);
}

function evidencePct(e){ return Math.max(0,Math.min(100,+e.evidence||0)); }

function renderClaimsWorkspace(){
    const host = document.createElement("div");
    host.id = "claimsWorkspace";
    host.className = "workspace-dashboard";

    if(currentClaimView === "events"){ host.innerHTML = claimsEventsView(); }
    else if(currentClaimView === "forensics"){ host.innerHTML = claimsForensicsView(); }
    else if(currentClaimView === "concurrency"){ host.innerHTML = claimsConcurrencyView(); }
    else if(currentClaimView === "disruption"){ host.innerHTML = claimsDisruptionView(); }
    else if(currentClaimView === "quantum"){ host.innerHTML = claimsQuantumView(); }
    else if(currentClaimView === "builder"){ host.innerHTML = claimsBuilderView(); }
    else { host.innerHTML = claimsOverviewView(); }

    chat.appendChild(host);
}

function claimsOverviewView(){
    const potential = claimEvents.length;
    const critical = claimEvents.filter(e=>e.critical).length;
    const grossDays = claimEvents.reduce((a,e)=>a+eventDelayDays(e),0);
    const employer = claimEvents.filter(e=>e.responsibility==="Employer").reduce((a,e)=>a+eventDelayDays(e),0);
    const contractor = claimEvents.filter(e=>e.responsibility==="Contractor").reduce((a,e)=>a+eventDelayDays(e),0);
    const concurrent = claimEvents.reduce((a,e)=>a+(+e.concurrentDays||0),0);
    const readiness = potential ? Math.round(claimEvents.reduce((a,e)=>a+evidencePct(e),0)/potential) : 0;

    return `
      <div class="module-title-row">
        <div><h2>Claims & Forensic Analysis</h2><p>Evidence-led delay analysis, schedule forensics and claim preparation using the shared project repository.</p></div>
        <div class="dashboard-actions">
            <button class="workspace-button" onclick="addClaimEvent()">＋ Delay / Claim Event</button>
            <button class="workspace-button" onclick="setClaimView('forensics')">Run Forensic Review</button>
            <button class="workspace-button primary" onclick="analyseContract()">✦ AI Review</button>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpi("Potential Claims",potential,critical?`${critical} marked critical`:"No critical events marked")}
        ${kpi("Gross Delay Events",grossDays+" days","Before concurrency / entitlement")}
        ${kpi("Employer Events",employer+" days","Gross event duration")}
        ${kpi("Concurrent Days",concurrent+" days","Requires contract-specific analysis")}
        ${kpi("Claim Readiness",readiness+"%","Average evidence completeness")}
      </div>

      <div class="dashboard-grid">
        <div class="forensic-card">
            <div class="forensic-card-header"><span>Delay Responsibility</span><span>${claimEvents.length} events</span></div>
            <div class="forensic-card-body">${delayResponsibilityGraphic(employer,contractor,concurrent,grossDays)}</div>
        </div>
        <div class="forensic-card">
            <div class="forensic-card-header"><span>Critical Issues</span><button class="rec-button" onclick="setClaimView('events')">View register</button></div>
            <div class="forensic-card-body">${criticalIssuesHtml()}</div>
        </div>
      </div>

      <div class="forensic-card" style="margin-bottom:9px">
        <div class="forensic-card-header"><span>Forensic Analysis Visuals</span><span>TIA · APAB · Cause & Effect</span></div>
        <div class="forensic-card-body">
          <div class="graphics-grid">
            <div><div style="font-size:8px;font-weight:800;margin-bottom:5px">TIA — Time Impact Analysis</div>${tiaGraphic()}</div>
            <div><div style="font-size:8px;font-weight:800;margin-bottom:5px">APAB — As-Planned vs As-Built</div>${apabGraphic()}</div>
            <div><div style="font-size:8px;font-weight:800;margin-bottom:5px">Fishbone — Cause & Effect</div>${fishboneGraphic()}</div>
          </div>
        </div>
      </div>

      <div class="forensic-card">
        <div class="forensic-card-header"><span>Recent Delay / Claim Events</span><button class="rec-button" onclick="addClaimEvent()">＋ Event</button></div>
        <div class="forensic-card-body" style="overflow:auto">${eventRegisterTable(6)}</div>
      </div>`;
}

function kpi(label,value,note){
    return `<div class="kpi-card"><div class="kpi-label">${escapeHtml(String(label))}</div><div class="kpi-value">${escapeHtml(String(value))}</div><div class="kpi-note">${escapeHtml(String(note))}</div></div>`;
}

function criticalIssuesHtml(){
    const items = claimEvents.filter(e=>e.critical).slice(0,5);
    if(!items.length) return `<div class="empty-graphic">No critical events have been identified yet.<br>Add events or run the AI forensic review.</div>`;
    return `<div class="metric-list">${items.map(e=>`
      <div class="metric-row">
        <span><strong>${escapeHtml(e.title||e.id)}</strong><br><small style="color:var(--muted)">${escapeHtml(e.category||"Unclassified")}</small></span>
        <span>${eventDelayDays(e)} d</span>
      </div>`).join("")}</div>`;
}

function delayResponsibilityGraphic(employer,contractor,concurrent,total){
    const neutral = Math.max(0,total-employer-contractor);
    const vals=[["Employer",employer,"#087FE8"],["Contractor",contractor,"#e85656"],["Concurrent",concurrent,"#e89a32"],["Other / Neutral",neutral,"#8f97a3"]];
    const max=Math.max(1,...vals.map(v=>v[1]));
    return `<svg viewBox="0 0 620 165" role="img" aria-label="Delay responsibility bar chart">
      ${vals.map((v,i)=>{
        const w=430*(v[1]/max);
        return `<text x="5" y="${29+i*35}" fill="currentColor" font-size="11">${v[0]}</text>
        <rect x="130" y="${16+i*35}" width="430" height="16" rx="4" fill="rgba(127,127,127,.12)"/>
        <rect x="130" y="${16+i*35}" width="${w}" height="16" rx="4" fill="${v[2]}"/>
        <text x="570" y="${29+i*35}" fill="currentColor" font-size="11">${v[1]} d</text>`;
      }).join("")}
    </svg>`;
}

function tiaGraphic(){
    if(!claimEvents.length) return `<div class="empty-graphic">Add delay events to populate the Time Impact Analysis visual.</div>`;
    const items=claimEvents.slice(0,5);
    const max=Math.max(1,...items.map(eventDelayDays));
    return `<svg viewBox="0 0 500 235">
      <text x="10" y="22" fill="currentColor" font-size="11">Baseline / current model</text>
      <line x1="115" y1="18" x2="455" y2="18" stroke="#548cff" stroke-width="6" stroke-linecap="round"/>
      ${items.map((e,i)=>{
        const y=55+i*32, w=260*(eventDelayDays(e)/max);
        const col=e.responsibility==="Employer"?"#087FE8":e.responsibility==="Contractor"?"#e85656":"#e89a32";
        return `<text x="10" y="${y+5}" fill="currentColor" font-size="9">${escapeHtml((e.id||"EV")+"")}</text>
        <line x1="115" y1="${y}" x2="${115+w}" y2="${y}" stroke="${col}" stroke-width="10" stroke-linecap="round"/>
        <line x1="${115+w}" y1="${y-12}" x2="${115+w}" y2="${y+12}" stroke="${col}" stroke-width="1.5" stroke-dasharray="4 3"/>
        <text x="${125+w}" y="${y+4}" fill="currentColor" font-size="9">${eventDelayDays(e)} d</text>`;
      }).join("")}
      <text x="10" y="224" fill="currentColor" opacity=".65" font-size="8">Graphic is an event visualisation; CPM impact must be calculated from validated schedule models.</text>
    </svg>`;
}

function apabGraphic(){
    const impact=claimEvents.reduce((a,e)=>a+(e.critical?eventDelayDays(e):0),0);
    return `<svg viewBox="0 0 500 235">
      <text x="10" y="20" fill="currentColor" font-size="10">As-Planned critical / longest path</text>
      ${[65,155,245,335,425].map((x,i)=>`<circle cx="${x}" cy="65" r="18" fill="none" stroke="#438cff" stroke-width="3"/><text x="${x}" y="69" text-anchor="middle" fill="currentColor" font-size="9">A${i+1}</text>${i<4?`<line x1="${x+18}" y1="65" x2="${x+72}" y2="65" stroke="#438cff" stroke-width="3"/><polygon points="${x+72},65 ${x+62},59 ${x+62},71" fill="#438cff"/>`:""}`).join("")}
      <text x="10" y="120" fill="currentColor" font-size="10">As-Built / impacted path</text>
      ${[65,155,260,350,440].map((x,i)=>{const y=155+(i%2?14:0);return `<circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#e85656" stroke-width="3"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="currentColor" font-size="9">B${i+1}</text>${i<4?`<line x1="${x+18}" y1="${y}" x2="${[155,260,350,440][i]-18}" y2="${155+((i+1)%2?14:0)}" stroke="#e85656" stroke-width="3" stroke-dasharray="5 3"/>`:""}`}).join("")}
      <text x="330" y="220" fill="#e85656" font-size="11" font-weight="700">${impact ? "+"+impact+" gross critical-event days" : "No critical-event delay entered"}</text>
    </svg>`;
}

function fishboneGraphic(){
    const cats={};
    claimEvents.forEach(e=>{
        const c=(e.category||"Other").trim()||"Other";
        if(!cats[c]) cats[c]=[];
        cats[c].push(e.title||e.id||"Event");
    });
    const groups=Object.entries(cats).slice(0,6);
    if(!groups.length) return `<div class="empty-graphic">Cause-and-effect branches will be created from the event register.</div>`;
    return `<svg viewBox="0 0 540 250">
      <line x1="55" y1="125" x2="450" y2="125" stroke="currentColor" stroke-width="3"/>
      <polygon points="450,125 435,116 435,134" fill="currentColor"/>
      <rect x="452" y="104" width="80" height="42" rx="7" fill="#e85656"/><text x="492" y="129" text-anchor="middle" fill="white" font-size="11">Project Delay</text>
      ${groups.map(([cat,events],i)=>{
        const top=i<3, slot=i%3, x=115+slot*125;
        const y=top?45:205, spineY=125, endY=top?65:185;
        return `<line x1="${x}" y1="${spineY}" x2="${x-48}" y2="${endY}" stroke="#6f8fb4" stroke-width="2"/>
        <text x="${x-52}" y="${top?endY-8:endY+18}" fill="currentColor" font-size="9" font-weight="700">${escapeHtml(cat.slice(0,18))}</text>
        ${events.slice(0,2).map((ev,j)=>`<text x="${x-42}" y="${top?endY+9+j*12:endY-20+j*12}" fill="currentColor" opacity=".75" font-size="7">${escapeHtml(ev.slice(0,24))}</text>`).join("")}`;
      }).join("")}
    </svg>`;
}

function eventRegisterTable(limit=999){
    const rows=claimEvents.slice(0,limit);
    if(!rows.length) return `<div class="empty-graphic">No events yet.<br>Use “＋ Delay / Claim Event” to start the forensic register.</div>`;
    return `<table class="event-table"><thead><tr>
      <th>ID</th><th>Event</th><th>Category</th><th>Start</th><th>Finish</th><th>Gross Days</th><th>Critical</th><th>Concurrency</th><th>Evidence</th><th>Status</th>
      </tr></thead><tbody>${rows.map((e,i)=>`<tr>
      <td class="event-id" onclick="editClaimEvent(${i})">${escapeHtml(e.id||("EV-"+String(i+1).padStart(3,"0")))}</td>
      <td>${escapeHtml(e.title||"Untitled event")}</td>
      <td>${escapeHtml(e.category||"Unclassified")}</td>
      <td>${escapeHtml(formatDateShort(e.start))}</td>
      <td>${escapeHtml(formatDateShort(e.finish))}</td>
      <td>${eventDelayDays(e)}</td>
      <td>${e.critical?"Yes":"No"}</td>
      <td>${+e.concurrentDays||0} d</td>
      <td><div style="display:flex;align-items:center;gap:5px"><div class="evidence-bar"><span style="width:${evidencePct(e)}%"></span></div>${evidencePct(e)}%</div></td>
      <td><span class="status-pill">${escapeHtml(e.status||"Review")}</span></td></tr>`).join("")}</tbody></table>`;
}

function claimsEventsView(){
    return `<div class="module-title-row"><div><h2>Delay / Claim Event Register</h2><p>Each event links cause, effect, responsibility, schedule impact, evidence and claim status.</p></div><div class="dashboard-actions"><button class="workspace-button primary" onclick="addClaimEvent()">＋ Event</button></div></div>
    <div class="forensic-card"><div class="forensic-card-header"><span>Event Register</span><span>${claimEvents.length}</span></div><div class="forensic-card-body" style="overflow:auto">${eventRegisterTable()}</div></div>`;
}

function claimsForensicsView(){
    return `<div class="module-title-row"><div><h2>Forensic Schedule Analysis</h2><p>Source validation and graphical delay analysis. The graphics do not replace CPM calculations in the source schedules.</p></div><div class="dashboard-actions"><button class="workspace-button" onclick="analyseContract()">✦ Recommend Method</button></div></div>
    <div class="graphics-grid">
      <div class="forensic-card"><div class="forensic-card-header">Time Impact Analysis (TIA)</div><div class="forensic-card-body">${tiaGraphic()}</div></div>
      <div class="forensic-card"><div class="forensic-card-header">As-Planned vs As-Built (APAB)</div><div class="forensic-card-body">${apabGraphic()}</div></div>
      <div class="forensic-card"><div class="forensic-card-header">Cause & Effect / Fishbone</div><div class="forensic-card-body">${fishboneGraphic()}</div></div>
    </div>
    <div class="forensic-card" style="margin-top:9px"><div class="forensic-card-header">Source Validation Checklist</div><div class="forensic-card-body">${sourceValidationHtml()}</div></div>`;
}

function sourceValidationHtml(){
    const checks=[
      ["Executed contract",sourceCount("contract")>0],
      ["Baseline programme",sourceCount(["schedule-baseline","schedule"])>0],
      ["Contemporaneous updates",sourceCount("schedule-updates")>0],
      ["Schedule revisions",sourceCount("schedule-revisions")>0],
      ["Notices / correspondence",sourceCount(["notices","correspondence"])>0],
      ["Daily / weekly records",sourceCount(["daily","weekly"])>0],
      ["Cost / productivity records",sourceCount(["costs","productivity"])>0]
    ];
    return `<div class="metric-list">${checks.map(([n,ok])=>`<div class="metric-row"><span>${ok?"✓":"⚠"} ${escapeHtml(n)}</span><span>${ok?"Available":"Missing / not classified"}</span></div>`).join("")}</div>`;
}

function claimsConcurrencyView(){
    const conc=claimEvents.filter(e=>(+e.concurrentDays||0)>0);
    return `<div class="module-title-row"><div><h2>Concurrency Analysis</h2><p>Concurrency is shown separately from entitlement. Contract wording and the chosen legal/technical basis must be confirmed.</p></div></div>
      <div class="dashboard-grid">
        <div class="forensic-card"><div class="forensic-card-header">Concurrency Timeline</div><div class="forensic-card-body">${concurrencyGraphic(conc)}</div></div>
        <div class="forensic-card"><div class="forensic-card-header">Concurrency Controls</div><div class="forensic-card-body">
          <div class="metric-list">
            <div class="metric-row"><span>Critical-path effect required</span><span>Review</span></div>
            <div class="metric-row"><span>Literal vs functional concurrency</span><span>Confirm basis</span></div>
            <div class="metric-row"><span>Pacing</span><span>Check evidence</span></div>
            <div class="metric-row"><span>Float treatment</span><span>Contract-specific</span></div>
            <div class="metric-row"><span>Compensation vs EOT</span><span>Analyse separately</span></div>
          </div></div></div>
      </div>`;
}

function concurrencyGraphic(events){
    if(!events.length) return `<div class="empty-graphic">No events with concurrent days have been entered.</div>`;
    return `<svg viewBox="0 0 650 230">${events.slice(0,5).map((e,i)=>{
      const y=35+i*38, cd=+e.concurrentDays||0, d=Math.max(1,eventDelayDays(e)), frac=Math.min(1,cd/d);
      return `<text x="5" y="${y+5}" fill="currentColor" font-size="10">${escapeHtml(e.id||"EV")}</text>
      <rect x="85" y="${y-7}" width="450" height="14" rx="4" fill="#087FE8"/>
      <rect x="${85+450*(1-frac)}" y="${y-7}" width="${450*frac}" height="14" rx="4" fill="#e89a32"/>
      <text x="548" y="${y+5}" fill="currentColor" font-size="9">${cd} concurrent d</text>`;
    }).join("")}<text x="85" y="222" fill="currentColor" opacity=".65" font-size="8">Blue = gross event period · Orange = entered potential concurrency</text></svg>`;
}

function claimsDisruptionView(){
    const prod=sourceCount("productivity"), costs=sourceCount("costs");
    return `<div class="module-title-row"><div><h2>Disruption & Productivity</h2><p>Keep disruption separate from delay. Use project-specific productivity evidence where possible.</p></div><div class="dashboard-actions"><button class="workspace-button" onclick="askWorkspaceQuestion('Measured Mile')">✦ Assess Measured Mile</button></div></div>
    <div class="dashboard-grid three">
      ${disruptionCard("Measured Mile",prod?"Productivity records available":"Productivity records not yet classified","Compare similar impacted and non-impacted work on the same project.")}
      ${disruptionCard("Baseline Productivity",prod?"Potential dataset available":"Requires productivity data","Useful where a clean consecutive measured-mile period is not available.")}
      ${disruptionCard("Cost Support",costs?`${costs} cost record(s) available`:"No cost records classified","Link lost hours / productivity to actual substantiated cost.")}
    </div>
    <div class="forensic-card"><div class="forensic-card-header">Disruption Evidence</div><div class="forensic-card-body">${sourceValidationHtml()}</div></div>`;
}

function disruptionCard(title,status,desc){
    return `<div class="contract-summary-card"><h3>${escapeHtml(title)}</h3><p><strong>${escapeHtml(status)}</strong></p><p style="margin-top:6px">${escapeHtml(desc)}</p></div>`;
}

function claimsQuantumView(){
    const costCount=sourceCount("costs");
    return `<div class="module-title-row"><div><h2>Claim Quantum</h2><p>Separate calculated cost, evidenced cost and contractual recoverability.</p></div></div>
    <div class="contract-card-grid">
      ${["Prolongation","Disruption / Lost Productivity","Acceleration","Escalation","Idle Labour / Plant","Other Direct Cost"].map(x=>disruptionCard(x,costCount?"Cost evidence exists in repository":"No linked amount yet","Build quantum from project records and link each amount to event, cause and entitlement.")).join("")}
    </div>`;
}

function claimsBuilderView(){
    const readiness=claimEvents.length?Math.round(claimEvents.reduce((a,e)=>a+evidencePct(e),0)/claimEvents.length):0;
    const sections=["Executive Summary","Project & Contract Particulars","Chronology","Cause","Effect","Contractual Entitlement","Delay Analysis","Concurrency","Mitigation","Extension of Time","Disruption / Prolongation","Quantum","Conclusion","Exhibits"];
    return `<div class="module-title-row"><div><h2>Claim Builder</h2><p>Build the narrative only after the evidence and forensic analysis are established.</p></div><div class="dashboard-actions"><button class="workspace-button primary" onclick="generateClaimDraft()">✦ Generate Draft Claim</button></div></div>
    <div class="dashboard-grid">
      <div class="forensic-card"><div class="forensic-card-header">Claim Readiness <span>${readiness}%</span></div><div class="forensic-card-body"><div class="metric-list">${sections.map((s,i)=>`<div class="metric-row"><span>${i+1}. ${escapeHtml(s)}</span><span>${readiness>70?"✓":"Review"}</span></div>`).join("")}</div></div></div>
      <div class="forensic-card"><div class="forensic-card-header">CEES Completeness</div><div class="forensic-card-body">${ceesGraphic(readiness)}</div></div>
    </div>`;
}

function ceesGraphic(readiness){
    const vals=[["Cause",readiness],["Effect",Math.max(0,readiness-5)],["Entitlement",Math.max(0,readiness-12)],["Substantiation",Math.max(0,readiness-3)]];
    return `<svg viewBox="0 0 520 220">${vals.map((v,i)=>`<text x="10" y="${38+i*42}" fill="currentColor" font-size="11">${v[0]}</text><rect x="120" y="${24+i*42}" width="330" height="18" rx="8" fill="rgba(127,127,127,.12)"/><rect x="120" y="${24+i*42}" width="${330*v[1]/100}" height="18" rx="8" fill="#087FE8"/><text x="462" y="${38+i*42}" fill="currentColor" font-size="10">${v[1]}%</text>`).join("")}</svg>`;
}

window.generateClaimDraft = function(){
    const prompt = `Prepare a structured draft claim outline from the current evidence and event register. Use Cause, Effect, Entitlement and Substantiation. Include explicit placeholders for every point that is not supported by the uploaded records. Do not invent clauses, dates, delay days or quantum.`;
    messageInput.value=prompt; autoResize(messageInput); updateSendButton(); sendMessage();
};

function renderContractWorkspace(){
    const total=sources.length;
    const claimsRecords=CONTRACT_FOLDERS.filter(f=>f.section==="claims").reduce((a,f)=>a+sourceCount(f.id),0);
    const scheduleFiles=sourceCount(["schedule","schedule-baseline","schedule-updates","schedule-revisions"]);
    const host=document.createElement("div");
    host.className="workspace-dashboard";
    host.innerHTML=`
      <div class="module-title-row"><div><h2>Contract Management</h2><p>The contract module and Claims & Forensics use exactly the same project repository.</p></div><div class="dashboard-actions"><button class="workspace-button primary" onclick="analyseContract()">✦ Contract Review</button></div></div>
      <div class="kpi-grid">
        ${kpi("Project Sources",total,"Shared across every module")}
        ${kpi("Contract Documents",sourceCount("contract"),"Executed contract / amendments")}
        ${kpi("Schedule Files",scheduleFiles,"Baseline, updates and revisions")}
        ${kpi("Claims Records",claimsRecords,"Correspondence, notices and evidence")}
        ${kpi("Notices",sourceCount("notices"),"Shared with Claims & Forensics")}
      </div>
      <div class="contract-card-grid">
        <div class="contract-summary-card"><h3>Contractual Position</h3><p>Review obligations, conditions precedent, notice requirements, instructions, variations and entitlement from the uploaded contract.</p><button class="workspace-button" style="margin-top:10px" onclick="askWorkspaceQuestion('Contractual obligations')">Review</button></div>
        <div class="contract-summary-card"><h3>Programme & Delay</h3><p>Use the same baseline, updates and revisions that feed the forensic claims module. Move potential issues directly into the event register.</p><button class="workspace-button" style="margin-top:10px" onclick="switchWorkspace('claims')">Open Forensics</button></div>
        <div class="contract-summary-card"><h3>Evidence & Notices</h3><p>Correspondence, notices, daily reports, meeting minutes and cost evidence are shared without re-uploading or duplication.</p><button class="workspace-button" style="margin-top:10px" onclick="askWorkspaceQuestion('Evidence and notices')">Review</button></div>
      </div>`;
    chat.appendChild(host);
}

function renderQuantityWorkspace(){
    const qty=measurements.reduce((a,m)=>a+(+m.drawingQty||0),0);
    const hours=measurements.reduce((a,m)=>a+calcHours(m),0);
    const host=document.createElement("div");
    host.className="workspace-dashboard";
    host.innerHTML=`
      <div class="module-title-row"><div><h2>Quantity / Schedule Intelligence</h2><p>Take-off, BOQ comparison, labour norms and schedule allocation using the same shared repository.</p></div><div class="dashboard-actions"><button class="workspace-button" onclick="openTakeoffWorkspace()">▦ Open Take-Off</button><button class="workspace-button primary" onclick="analyseContract()">✦ AI Review</button></div></div>
      <div class="kpi-grid">
        ${kpi("Measurements",measurements.length,"Auditable take-off rows")}
        ${kpi("Measured Quantity",qty.toFixed(1),"Across current register")}
        ${kpi("Calculated Hours",hours.toFixed(1),"Current allocation method")}
        ${kpi("Unallocated",measurements.filter(m=>!m.activityId).length,"No schedule activity assigned")}
        ${kpi("Norms",norms.length,"Current norm library")}
      </div>
      <div class="contract-card-grid">
        <div class="contract-summary-card"><h3>Take-Off Register</h3><p>Measured quantities, source traceability, BOQ comparison and confidence status.</p><button class="workspace-button" style="margin-top:10px" onclick="openTakeoffWorkspace()">Open</button></div>
        <div class="contract-summary-card"><h3>Schedule Allocation</h3><p>Assign quantities and calculated labour hours to activities while preserving source traceability.</p><button class="workspace-button" style="margin-top:10px" onclick="openTakeoffWorkspace()">Allocate</button></div>
        <div class="contract-summary-card"><h3>Claims Link</h3><p>Quantity growth, productivity loss and change records can support disruption and quantum analyses in the claims module.</p><button class="workspace-button" style="margin-top:10px" onclick="switchWorkspace('claims')">Open Claims</button></div>
      </div>`;
    chat.appendChild(host);
}

window.addClaimEvent = function(){
    const id = prompt("Event ID:", `EV-${String(claimEvents.length+1).padStart(3,"0")}`);
    if(id===null) return;
    const title = prompt("Event title / cause:", "");
    if(title===null) return;
    const category = prompt("Category (e.g. Design, Access, Variation, Procurement, Weather):", "Unclassified") || "Unclassified";
    const responsibility = prompt("Responsibility (Employer / Contractor / Neutral / Undetermined):", "Undetermined") || "Undetermined";
    const start = prompt("Start date (YYYY-MM-DD), if known:", "") || "";
    const finish = prompt("Finish date (YYYY-MM-DD), if known:", "") || "";
    const critical = confirm("Is this event currently considered critical / controlling?");
    const concurrentDays = Number(prompt("Potential concurrent days (0 if none / unknown):","0")) || 0;
    const evidence = Math.max(0,Math.min(100,Number(prompt("Evidence completeness %:","50"))||0));

    claimEvents.push({
        id:id.trim()||`EV-${String(claimEvents.length+1).padStart(3,"0")}`,
        title:title.trim()||"Untitled event",
        category, responsibility, start, finish, critical,
        concurrentDays, evidence,
        status:"Review",
        cause:title.trim()||"",
        effect:"",
        entitlement:"",
        substantiation:""
    });

    currentClaimView="overview";
    renderModuleSubnav();
    renderWorkspaceHome(true);
    scheduleAutoSave();
};

window.editClaimEvent = function(index){
    const e=claimEvents[index]; if(!e) return;
    const title=prompt("Event title:",e.title||""); if(title===null)return;
    const category=prompt("Category:",e.category||"Unclassified"); if(category===null)return;
    const responsibility=prompt("Responsibility:",e.responsibility||"Undetermined"); if(responsibility===null)return;
    const evidence=prompt("Evidence completeness %:",String(e.evidence||0)); if(evidence===null)return;
    e.title=title; e.category=category; e.responsibility=responsibility;
    e.evidence=Math.max(0,Math.min(100,Number(evidence)||0));
    e.status=prompt("Status:",e.status||"Review")||e.status||"Review";
    renderWorkspaceHome(true); scheduleAutoSave();
};





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
    switchWorkspace(currentWorkspace, true);
    updateSendButton();
    initialiseAssistant().catch(error=>{
        console.error(error);
        setEngineStatus(null,"AI available on demand","error");
    });
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
 const loadingId=addLoading(); try{ const result=await runAI([{role:'system',content:buildContractSystemPrompt()},{role:'user',content:`Review the uploaded documents and current take-off register. Recommend concrete take-off classifications, BOQ matches, schedule activity mappings, missing norms, variances and checks. Do not invent geometric measurements. If a quantity is not explicitly supported, label it as requiring measurement. Keep recommendations concise and auditable.`}],{temperature:.1,max_tokens:1400,stream:false}); removeLoading(loadingId); const answer=result?.choices?.[0]?.message?.content||'No recommendation returned.'; addMessage('assistant',answer); conversation.push({role:'assistant',content:answer}); workspaceConversations[currentWorkspace]=conversation; }catch(e){removeLoading(loadingId);addMessage('assistant','AI take-off review failed: '+escapeHtml(e.message||String(e)));}
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
 const claimRows=claimEvents.map(e=>[e.id,e.title,e.category,e.responsibility,e.start,e.finish,eventDelayDays(e),e.critical?'Yes':'No',+e.concurrentDays||0,evidencePct(e),e.status||'Review']);
 const xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${xmlSheet('Project Summary',['Metric','Value'],summary)}${xmlSheet('Take-Off',takeHeaders,takeRows)}${xmlSheet('Norms',['Discipline','Category','Item','Size','Unit','Hours per Unit'],normRows)}${xmlSheet('Activity Quantities',['Activity ID','Activity Name','Quantity','Hours'],actRows)}${xmlSheet('Claim Events',['ID','Event','Category','Responsibility','Start','Finish','Gross Days','Critical','Concurrent Days','Evidence %','Status'],claimRows)}</Workbook>`;
 downloadFile(xml,`${safeFilename(currentProjectName)}_Takeoff.xml`,'application/xml');
};

window.addEventListener("message",event=>{
    if(!event.data||event.data.type!=="pc-theme") return;
    const dark=event.data.theme==="dark";
    document.documentElement.classList.toggle("dark-mode",dark);
    document.documentElement.dataset.theme=dark?"dark":"light";
});