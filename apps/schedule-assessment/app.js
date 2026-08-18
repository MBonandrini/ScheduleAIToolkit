const REPORTS = [
    {
        id:"health",
        icon:"♥",
        name:"Schedule health report",
        desc:"Interactive overall schedule health dashboard"
    },
    {
        id:"dcma",
        icon:"✓",
        name:"Full DCMA check",
        desc:"14-point schedule quality assessment"
    },
    {
        id:"detailed",
        icon:"≡",
        name:"Detailed schedule check",
        desc:"Logic, dates, constraints, float and quality"
    },
    {
        id:"forensic",
        icon:"⌕",
        name:"Forensic schedule check",
        desc:"Forensic indicators, changes and audit trail"
    },
    {
        id:"scurve",
        icon:"∿",
        name:"S-Curve & histogram",
        desc:"Planned, actual and forecast progress"
    },
    {
        id:"cost",
        icon:"£",
        name:"Cost report",
        desc:"Budget, actuals, forecast and variance"
    },
    {
        id:"comparison",
        icon:"⇄",
        name:"Schedule comparison",
        desc:"Compare two or more active schedules"
    },
    {
        id:"week",
        icon:"↻",
        name:"Week on Week",
        desc:"Progress, slippage and weekly schedule movement"
    },
    {
        id:"delay",
        icon:"↗",
        name:"Delay analysis",
        desc:"Potential delay and critical-path drivers"
    },
    {
        id:"monte",
        icon:"⌁",
        name:"Monte-Carlo simulation",
        desc:"Probabilistic completion forecast"
    },
    {
        id:"gantt",
        icon:"▤",
        name:"Collapsible Gantt chart",
        desc:"WBS-based activity dates, progress and forecast"
    },
    {
        id:"ai",
        icon:"✦",
        name:"Detailed AI report",
        desc:"AI-assisted project controls review"
    }
];

const state = {
    files:[],
    schedules:[],
    activeSchedules:new Set(), 
    reports:{},                
    currentReport:null,
    reportJobs:{},             
    recommendations:[],
    recommendationsBySchedule:{},
    comparisonScheduleBySchedule:{},
    weekComparisonBySchedule:{},
    delayBaselineBySchedule:{},
    forensicBaselineBySchedule:{},
    monteSettingsBySchedule:{},
    chat:[],
    aiReady:false,
    aiBusy:false,
    aiMode:"initialising",
    aiModelValue:"puter:auto",
    projectName:"Untitled project",
    projectId:null
};

let currentReportObject = null;

const DB_NAME = "ScheduleIntelligenceDB";
const DB_VERSION = 1;
const STORE = "projects";

function dbOpen(){

    return new Promise((resolve,reject)=>{

        const req = indexedDB.open(
            DB_NAME,
            DB_VERSION
        );

        req.onupgradeneeded = e => {

            const db = e.target.result;

            if(!db.objectStoreNames.contains(STORE)){
                db.createObjectStore(
                    STORE,
                    {keyPath:"id"}
                );
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveProject(){

    try{

        if(!state.projectId){
            state.projectId = crypto.randomUUID();
        }

        const project = {
            id:state.projectId,
            name:state.projectName,
            files:state.files.map(file => ({
                id:file.id,
                name:file.name,
                extension:file.extension,
                text:file.text,
                uploadedAt:file.uploadedAt
            })),
            schedules:state.schedules,
            activeSchedules:[...state.activeSchedules],
            reports:state.reports,
            currentReport:state.currentReport,
            recommendations:state.recommendations,
            recommendationsBySchedule:state.recommendationsBySchedule,
            comparisonScheduleBySchedule:state.comparisonScheduleBySchedule,
            weekComparisonBySchedule:state.weekComparisonBySchedule,
            delayBaselineBySchedule:state.delayBaselineBySchedule,
            forensicBaselineBySchedule:state.forensicBaselineBySchedule,
            monteSettingsBySchedule:state.monteSettingsBySchedule,
            aiModelValue:state.aiModelValue,
            chat:state.chat,
            updatedAt:Date.now()
        };

        const db = await dbOpen();

        await new Promise((resolve,reject)=>{

            const tx = db.transaction(
                STORE,
                "readwrite"
            );

            tx.objectStore(STORE).put(project);

            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });

        db.close();

        document.getElementById("saveStatus").textContent =
            "Saved locally ✓";

    }catch(error){

        console.error(error);

        document.getElementById("saveStatus").textContent =
            "Save failed";
    }
}

function scheduleSave(){

    document.getElementById("saveStatus").textContent =
        "Changes pending...";

    clearTimeout(scheduleSave.timer);

    scheduleSave.timer =
        setTimeout(
            saveProject,
            700
        );
}

const MODEL_CATALOG = [
    {
        value:"puter:auto",
        engine:"puter",
        id:null,
        label:"Lightweight browser AI — Puter hosted"
    },
    {
        value:"heuristic",
        engine:"heuristic",
        id:null,
        label:"Deterministic schedule analysis — no AI model"
    },

    { value:"webllmio:high",   engine:"webllmio", tier:"high",   id:"Qwen3-8B-q4f16_1-MLC",              label:"Auto-routed — High quality (Qwen3 8B)" },
    { value:"webllmio:medium", engine:"webllmio", tier:"medium", id:"Qwen2.5-3B-Instruct-q4f16_1-MLC",   label:"Auto-routed — Balanced (Qwen2.5 3B)" },
    { value:"webllmio:low",    engine:"webllmio", tier:"low",    id:"Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label:"Auto-routed — Fast (Qwen2.5 1.5B)" },

    { value:"mlc:Llama-3.2-1B-Instruct-q4f16_1-MLC", engine:"mlc", id:"Llama-3.2-1B-Instruct-q4f16_1-MLC", label:"MLC direct — Fast (Llama 3.2 1B)" },
    { value:"mlc:Llama-3.2-3B-Instruct-q4f16_1-MLC", engine:"mlc", id:"Llama-3.2-3B-Instruct-q4f16_1-MLC", label:"MLC direct — Balanced (Llama 3.2 3B)" },
    { value:"mlc:Phi-3.5-mini-instruct-q4f16_1-MLC", engine:"mlc", id:"Phi-3.5-mini-instruct-q4f16_1-MLC", label:"MLC direct — Higher quality (Phi-3.5 Mini)" },
    { value:"mlc:Llama-3.1-8B-Instruct-q4f16_1-MLC", engine:"mlc", id:"Llama-3.1-8B-Instruct-q4f16_1-MLC", label:"MLC direct — Best quality (Llama 3.1 8B)" },

    { value:"cpu:onnx-community/Qwen2.5-0.5B-Instruct", engine:"cpu", id:"onnx-community/Qwen2.5-0.5B-Instruct", label:"CPU / WASM — Fast (Qwen2.5 0.5B)" },
    { value:"cpu:onnx-community/Llama-3.2-1B-Instruct", engine:"cpu", id:"onnx-community/Llama-3.2-1B-Instruct", label:"CPU / WASM — Better quality (Llama 3.2 1B)" }
];

const GPU_MODELS = {
    high:"Qwen3-8B-q4f16_1-MLC",
    medium:"Qwen2.5-3B-Instruct-q4f16_1-MLC",
    low:"Qwen2.5-1.5B-Instruct-q4f16_1-MLC"
};

let webllmClient = null;
let mlcClient = null;
let cpuGenerator = null;

function setEngine(text,status="loading"){

    const dot =
        document.getElementById("engineDot");

    if(dot){
        dot.className =
            "engine-dot " + status;
    }

    const textElement =
        document.getElementById("engineText");

    if(textElement){
        textElement.textContent =
            text;
    }
}

async function disposeAIEngines(){

    if(webllmClient){

        try{
            if(typeof webllmClient.dispose === "function"){
                await webllmClient.dispose();
            }
        }catch(error){
            console.warn("Could not dispose webllm-io engine:",error);
        }
    }

    if(mlcClient){

        try{
            if(typeof mlcClient.unload === "function"){
                await mlcClient.unload();
            }
        }catch(error){
            console.warn("Could not unload MLC engine:",error);
        }
    }

    webllmClient = null;
    mlcClient = null;
    cpuGenerator = null;
}

async function initialiseAI(){

    const saved =
        localStorage.getItem(
            "scheduleIntelligenceAIModel"
        );

    const requested =
        MODEL_CATALOG.some(
            model =>
                model.value === saved
        )
            ? saved
            : "puter:auto";

    const select =
        document.getElementById(
            "modelSelect"
        );

    if(select){
        select.value =
            requested;
    }

    try{

        await changeModel(
            requested,
            true
        );

    }catch(error){

        console.warn(
            "Preferred AI option could not start; using deterministic analysis.",
            error
        );

        if(select){
            select.value =
                "heuristic";
        }

        state.aiReady = true;
        state.aiMode = "heuristic";
        state.aiModelValue =
            "heuristic";

        localStorage.setItem(
            "scheduleIntelligenceAIModel",
            "heuristic"
        );

        setEngine(
            "Deterministic analysis ready",
            "ready"
        );
    }

    updateChatButton();
}

async function changeModel(value,initial=false){
    const model =
        MODEL_CATALOG.find(item=>item.value===value) ||
        MODEL_CATALOG[0];

    if(model.engine === "heuristic"){
        state.aiReady=true;
        state.aiMode="heuristic";
        state.aiModelValue="heuristic";
        localStorage.setItem("scheduleIntelligenceAIModel","heuristic");
        setEngine("Deterministic analysis ready","ready");
        return;
    }

    setEngine(`Loading ${model.label}...`,"loading");

    await window.parent.ProjectControlsCore.ai.ensure(model.value);

    state.aiReady=true;
    state.aiMode=window.parent.ProjectControlsCore.ai.status().engine;
    state.aiModelValue=model.value;
    localStorage.setItem("scheduleIntelligenceAIModel",model.value);
    setEngine(window.parent.ProjectControlsCore.ai.status().label,"ready");
}

async function runLocalAI(messages,options={}){
    if(state.aiMode === "heuristic"){
        throw new Error("Deterministic mode selected.");
    }

    const modelValue =
        state.aiModelValue ||
        "puter:auto";

    await window.parent.ProjectControlsCore.ai.ensure(modelValue);
    return await window.parent.ProjectControlsCore.ai.run(messages,options);
}

function buildAIContext(schedule){

    if(!schedule)
        return "No active schedule.";

    const activities =
        schedule.activities || [];

    const critical =
        activities
            .filter(
                a =>
                    a.critical ||
                    a.totalFloat <= 0
            )
            .sort(
                (a,b)=>
                    a.totalFloat -
                    b.totalFloat
            )
            .slice(0,60);

    const logicIssues =
        activities
            .filter(
                a =>
                    a.percent < 100 &&
                    (
                        !a.predecessors?.length ||
                        !a.successors?.length
                    )
            )
            .slice(0,40);

    const negative =
        activities
            .filter(
                a=>a.totalFloat < 0
            )
            .slice(0,40);

    return `
ACTIVE SCHEDULE
Name: ${schedule.name}
Format: ${schedule.format}
Data date: ${formatDate(schedule.statusDate)}
Planned start: ${formatDate(schedule.plannedStart)}
Planned finish: ${formatDate(schedule.plannedFinish)}
Activities: ${activities.length}
Relationships: ${schedule.relationships?.length || 0}
Progress: ${formatPercent(weightedProgress(activities))}

CRITICAL / ZERO-FLOAT ACTIVITIES
${critical.map(
    a =>
        `${a.id} | ${a.name} | WBS ${a.wbsPath || a.wbs || "—"} | start ${formatDate(a.start)} | finish ${formatDate(a.finish)} | float ${formatNumber(a.totalFloat)}d | ${formatPercent(a.percent)}`
).join("\n") || "None identified"}

NEGATIVE-FLOAT ACTIVITIES
${negative.map(
    a =>
        `${a.id} | ${a.name} | ${formatNumber(a.totalFloat)}d`
).join("\n") || "None identified"}

LOGIC EXCEPTIONS
${logicIssues.map(
    a =>
        `${a.id} | ${a.name} | predecessors ${a.predecessors?.length || 0} | successors ${a.successors?.length || 0}`
).join("\n") || "None identified"}
`;
}

async function askAI(question,scheduleOverride=null){

    const schedule =
        scheduleOverride ||
        getActiveSchedule();

    if(!schedule){

        return "Please select an active schedule before asking the AI to review the programme.";
    }

    const messages = [
        {
            role:"system",
            content:`
You are a senior project-controls and forensic schedule analyst.

You are reviewing Primavera P6 XER and Microsoft Project XML schedule data parsed in the browser.

Rules:
- Be precise and evidence-led.
- Refer to activity IDs whenever discussing individual activities.
- Do not invent contract clauses, dates, relationships, events or responsibilities.
- Distinguish schedule observations from legal/contractual conclusions.
- For critical-path analysis, discuss logic continuity, float, constraints, calendars and path drivers.
- For delay analysis, distinguish causation, concurrency, mitigation and responsibility.
- Where the parsed data is insufficient, say exactly what additional evidence is needed.
- Treat the output as project-controls analysis, not a legal determination.

${buildAIContext(schedule)}
`
        },
        ...state.chat
            .filter(
                message =>
                    !message.scheduleId ||
                    message.scheduleId ===
                    schedule.id
            )
            .slice(-8)
            .map(
                message=>({
                    role:message.role,
                    content:String(
                        message.content || ""
                    ).slice(0,5000)
                })
            ),
        {
            role:"user",
            content:question
        }
    ];

    if(
        state.aiReady &&
        ["puter","webllmio","mlc","cpu"].includes(
            state.aiMode
        )
    ){

        try{

            const result =
                await runLocalAI(
                    messages,
                    {
                        temperature:.12,
                        max_tokens:1800
                    }
                );

            const answer =
                result
                    ?.choices?.[0]
                    ?.message?.content;

            if(answer && String(answer).trim()){
                return String(answer).trim();
            }

        }catch(error){

            console.error(
                "Local AI response failed:",
                error
            );

            setEngine(
                "AI error · deterministic fallback active",
                "error"
            );
        }
    }

    return heuristicAIResponse(
        question,
        schedule
    );
}

function heuristicAIResponse(
    question,
    schedule
){

    const active = [schedule];

    const summary =
        scheduleSummary(
            schedule
        );

    const q =
        String(question || "")
            .toLowerCase();

    if(q.includes("critical")){

        const analysis =
            analyseCriticalPath(
                schedule
            );

        return [
            "### Critical-path review",
            "",
            `Critical / zero-float activities identified: **${analysis.criticalActivities.length}**.`,
            `Critical-to-critical relationships: **${analysis.criticalRelationships.length}**.`,
            "",
            ...analysis.topChains
                .slice(0,5)
                .map(
                    (chain,index)=>
                        `- Path ${index+1}: ${chain.map(a=>`${a.id} ${a.name}`).join(" → ")}`
                ),
            "",
            "This deterministic fallback is being used because a local language model was not available."
        ].join("\n");
    }

    if(q.includes("delay")){

        return [
            "### Delay review",
            "",
            "Review baseline/current date movement, critical-path changes, negative float, out-of-sequence progress, relationship changes, constraints, calendars, mitigation and concurrency.",
            "",
            summary
        ].join("\n");
    }

    if(q.includes("dcma")){
        return buildDCMASummary(active);
    }

    if(q.includes("cost")){
        return buildCostNarrative(active);
    }

    const health =
        calculateHealth(active);

    return [
        "### Project-controls review",
        "",
        `Health screening: **${health.score}/100 — ${health.label}**.`,
        "",
        ...health.reasons.map(
            x=>`- ${x}`
        ),
        "",
        summary,
        "",
        "A deterministic fallback generated this response. Select the lightweight hosted AI or an optional local model from the header for a fuller natural-language review."
    ].join("\n");
}

async function handleScheduleFiles(fileList){

    const files =
        [...(fileList || [])];

    if(!files.length)
        return;

    const newlyAddedScheduleIds = [];

    document.getElementById(
        "autoReportStatus"
    ).textContent =
        "Reading schedule files...";

    for(const file of files){

        const ext =
            file.name
                .split(".")
                .pop()
                .toLowerCase();

        if(!["xer","xml"].includes(ext)){

            alert(
                `${file.name} is not a supported schedule file. Please upload XER or Microsoft Project XML.`
            );

            continue;
        }

        try{

            const fileText =
                await readFile(file);

            const result =
                parseScheduleFile(
                    file,
                    fileText
                );

            const fileRecord = {
                id:crypto.randomUUID(),
                name:result.fileName,
                extension:result.extension,
                text:result.text,
                uploadedAt:Date.now()
            };

            state.files.push(
                fileRecord
            );

            result.schedules.forEach(
                schedule=>{

                    schedule.fileId =
                        fileRecord.id;

                    schedule.expanded =
                        false;

                    state.schedules.push(
                        schedule
                    );

                    newlyAddedScheduleIds.push(
                        schedule.id
                    );
                }
            );

        }catch(error){

            console.error(error);

            alert(
                `Could not read ${file.name}: ${error.message}`
            );
        }
    }

    if(
        !getActiveSchedule() &&
        newlyAddedScheduleIds.length
    ){

        state.activeSchedules =
            new Set([
                newlyAddedScheduleIds[0]
            ]);
    }

    renderScheduleTree();
    updateWorkspaceMeta();
    renderRightPane();
    scheduleSave();

    for(
        let i=0;
        i<newlyAddedScheduleIds.length;
        i++
    ){

        const scheduleId =
            newlyAddedScheduleIds[i];

        const schedule =
            getScheduleById(
                scheduleId
            );

        document.getElementById(
            "autoReportStatus"
        ).textContent =
            `Building reports ${i+1}/${newlyAddedScheduleIds.length}: ${schedule?.name || "schedule"}...`;

        await buildAllReportsForSchedule(
            scheduleId
        );
    }

    document.getElementById(
        "autoReportStatus"
    ).textContent =
        "All automatic reports complete.";

    const active =
        getActiveSchedule();

    if(active){

        const preferred =
            state.currentReport ||
            "health";

        await openReport(
            preferred
        );
    }

    renderRightPane();
}

function readFile(file){

    return new Promise(
        (resolve,reject)=>{

            const reader =
                new FileReader();

            reader.onload =
                ()=>resolve(
                    reader.result
                );

            reader.onerror =
                ()=>reject(
                    reader.error
                );

            reader.readAsText(
                file
            );
        }
    );
}

function dragOver(event){

    event.preventDefault();

    document
        .getElementById(
            "uploadArea"
        )
        .classList.add(
            "drag"
        );
}

function dragLeave(){

    document
        .getElementById(
            "uploadArea"
        )
        .classList.remove(
            "drag"
        );
}

function dropFiles(event){

    event.preventDefault();

    dragLeave();

    handleScheduleFiles(
        event.dataTransfer.files
    );
}

function parseScheduleFile(file,text){
    return window.parent.ProjectControlsCore.schedule.parse(file,text);
}

function parseDate(value){

    if(!value) return null;

    const d = new Date(value);

    if(Number.isNaN(d.getTime()))
        return null;

    return d.toISOString();
}

function parseNumber(value){

    if(value === null || value === undefined)
        return 0;

    const n =
        parseFloat(
            String(value)
                .replace(/,/g,"")
        );

    return Number.isFinite(n)
        ? n
        : 0;
}

function parseDuration(value){

    if(value === null || value === undefined)
        return 0;

    return parseNumber(value) / 8;
}

function parseISO8601Duration(value){

    if(!value) return 0;

    const match =
        String(value).match(
            /P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?/
        );

    if(!match)
        return 0;

    const hours =
        parseNumber(match[1]) +
        parseNumber(match[2]) / 60;

    return hours / 8;
}

function formatDate(value){

    if(!value)
        return "—";

    const d =
        new Date(value);

    if(Number.isNaN(d.getTime()))
        return "—";

    return d.toLocaleDateString(
        undefined,
        {
            year:"numeric",
            month:"short",
            day:"numeric"
        }
    );
}

function formatNumber(value){

    if(!Number.isFinite(Number(value)))
        return "—";

    return Number(value).toLocaleString(
        undefined,
        {
            maximumFractionDigits:1
        }
    );
}

function formatPercent(value){

    return `${formatNumber(value)}%`;
}

function daysBetween(a,b){

    if(!a || !b) return 0;

    return Math.round(
        (
            new Date(b) -
            new Date(a)
        ) /
        86400000
    );
}

function sleep(ms){

    return new Promise(
        resolve => setTimeout(resolve,ms)
    );
}

function getScheduleById(id){

    return state.schedules.find(
        schedule =>
            schedule.id === id
    ) || null;
}

function getActiveSchedule(){

    const id =
        [...state.activeSchedules][0];

    return id
        ? getScheduleById(id)
        : null;
}

function getActiveSchedules(){

    const schedule =
        getActiveSchedule();

    return schedule
        ? [schedule]
        : [];
}

async function selectActiveSchedule(
    scheduleId
){

    const schedule =
        getScheduleById(
            scheduleId
        );

    if(!schedule)
        return;

    state.activeSchedules =
        new Set([
            scheduleId
        ]);

    state.recommendations =
        state.recommendationsBySchedule[
            scheduleId
        ] ||
        [];

    renderScheduleTree();
    renderReportList();
    updateWorkspaceMeta();
    renderRightPane();
    restoreChat();
    updateChatButton();
    scheduleSave();

    await openReport(
        state.currentReport ||
        "health"
    );
}

function renderScheduleTree(){

    const tree =
        document.getElementById(
            "scheduleTree"
        );

    tree.innerHTML = "";

    document.getElementById(
        "scheduleCount"
    ).textContent =
        state.schedules.length;

    if(!state.files.length){

        tree.innerHTML = `
            <div class="tree-empty">
                No schedule files uploaded.
            </div>
        `;

        return;
    }

    const active =
        getActiveSchedule();

    state.files.forEach(
        file=>{

            const wrapper =
                document.createElement(
                    "div"
                );

            const schedules =
                state.schedules.filter(
                    schedule =>
                        schedule.fileId ===
                        file.id
                );

            const containsActive =
                schedules.some(
                    schedule =>
                        schedule.id ===
                        active?.id
                );

            wrapper.className =
                "file-node" +
                (
                    containsActive
                        ? " open"
                        : ""
                );

            const header =
                document.createElement(
                    "button"
                );

            header.className =
                "file-header";

            header.innerHTML = `
                <span class="file-arrow">
                    ${containsActive ? "▾":"▸"}
                </span>

                <span class="file-icon">
                    ${escapeHTML(
                        file.extension.toUpperCase()
                    )}
                </span>

                <span
                    class="file-name"
                    title="${escapeHTML(file.name)}"
                >
                    ${escapeHTML(file.name)}
                </span>

                <span class="file-count">
                    ${schedules.length}
                </span>
            `;

            header.onclick =
                ()=>{

                    wrapper
                        .classList
                        .toggle(
                            "open"
                        );

                    header
                        .querySelector(
                            ".file-arrow"
                        )
                        .textContent =
                            wrapper
                                .classList
                                .contains(
                                    "open"
                                )
                                ? "▾"
                                : "▸";
                };

            wrapper.appendChild(
                header
            );

            const children =
                document.createElement(
                    "div"
                );

            children.className =
                "schedule-children";

            schedules.forEach(
                schedule=>{

                    const row =
                        document.createElement(
                            "label"
                        );

                    row.className =
                        "schedule-node";

                    row.innerHTML = `
                        <input
                            class="schedule-check"
                            type="radio"
                            name="activeSchedule"
                            ${active?.id===schedule.id ? "checked":""}
                        >

                        <div class="schedule-node-info">

                            <div
                                class="schedule-name"
                                title="${escapeHTML(schedule.name)}"
                            >
                                ${escapeHTML(schedule.name)}
                            </div>

                            <div class="schedule-meta">
                                ${schedule.activities.length} activities ·
                                ${formatDate(schedule.statusDate)} data date
                            </div>

                        </div>

                        <span class="schedule-badge ${String(schedule.extension || schedule.format).toLowerCase()}">
                            ${escapeHTML(schedule.format)}
                        </span>
                    `;

                    row
                        .querySelector(
                            "input"
                        )
                        .onchange =
                            ()=>{

                                selectActiveSchedule(
                                    schedule.id
                                );
                            };

                    children.appendChild(
                        row
                    );
                }
            );

            wrapper.appendChild(
                children
            );

            tree.appendChild(
                wrapper
            );
        }
    );
}

function updateWorkspaceMeta(){

    const active =
        getActiveSchedule();

    document.getElementById(
        "workspaceMeta"
    ).textContent =
        active
            ? `${active.name} · ${active.activities.length} activities · data date ${formatDate(active.statusDate)}`
            : "No active schedule selected";
}

function reportJobKey(
    scheduleId,
    reportId
){

    return `${scheduleId}:${reportId}`;
}

function ensureReportStore(
    scheduleId
){

    if(!state.reports[scheduleId]){
        state.reports[scheduleId] = {};
    }

    return state.reports[
        scheduleId
    ];
}

function getReportForSchedule(
    scheduleId,
    reportId
){

    return state.reports?.[scheduleId]?.[reportId] || null;
}

function renderReportList(){

    const container =
        document.getElementById(
            "reportList"
        );

    container.innerHTML = "";

    const active =
        getActiveSchedule();

    REPORTS.forEach(
        report=>{

            const button =
                document.createElement(
                    "button"
                );

            button.className =
                "report-item";

            if(
                state.currentReport ===
                report.id
            ){

                button.classList.add(
                    "active"
                );
            }

            const job =
                active
                    ? state.reportJobs[
                        reportJobKey(
                            active.id,
                            report.id
                        )
                    ]
                    : null;

            const data =
                active
                    ? getReportForSchedule(
                        active.id,
                        report.id
                    )
                    : null;

            const progress =
                data
                    ? 100
                    : job?.progress ||
                      0;

            button.innerHTML = `
                <div class="report-icon">
                    ${report.icon}
                </div>

                <div class="report-text">

                    <div class="report-name">
                        ${escapeHTML(report.name)}
                    </div>

                    <div class="report-desc">
                        ${escapeHTML(report.desc)}
                    </div>

                </div>

                <div>

                    <div class="report-progress">
                        ${progress}%
                    </div>

                    <div class="progress-bar">
                        <div
                            class="progress-fill"
                            style="width:${progress}%"
                        ></div>
                    </div>

                </div>
            `;

            button.onclick =
                ()=>openReport(
                    report.id
                );

            container.appendChild(
                button
            );
        }
    );

    document.getElementById(
        "reportCount"
    ).textContent =
        REPORTS.length;
}

async function openReport(id){

    state.currentReport = id;

    renderReportList();

    const reportDefinition =
        REPORTS.find(
            item=>item.id===id
        );

    if(reportDefinition){

        document.getElementById(
            "workspaceTitle"
        ).textContent =
            reportDefinition.name;
    }

    const active =
        getActiveSchedule();

    if(!active){

        renderNoScheduleReport();

        return;
    }

    let report =
        getReportForSchedule(
            active.id,
            id
        );

    if(!report){

        report =
            await buildReport(
                id,
                active.id,
                {
                    render:true
                }
            );
    }

    if(report){

        renderReport(
            report
        );
    }

    renderRightPane();
}

async function buildReport(
    id,
    scheduleId,
    {
        render=false
    }={}
){

    const schedule =
        getScheduleById(
            scheduleId
        );

    if(!schedule){

        return null;
    }

    const key =
        reportJobKey(
            scheduleId,
            id
        );

    state.reportJobs[key] = {
        progress:0,
        status:"building"
    };

    if(
        render &&
        getActiveSchedule()?.id ===
        scheduleId
    ){

        renderBuildPlaceholder(
            REPORTS.find(
                r=>r.id===id
            )
        );
    }

    renderReportList();
    renderRightPane();

    for(const progress of [12,35,58,78]){

        state.reportJobs[key].progress =
            progress;

        renderReportList();

        await sleep(20);
    }

    let result;

    try{

        result =
            await generateReport(
                id,
                [schedule]
            );

    }catch(error){

        console.error(
            `Report ${id} failed:`,
            error
        );

        result = {
            id,
            title:
                REPORTS.find(
                    r=>r.id===id
                )?.name ||
                "Report",
            subtitle:
                "Report generation error",
            html:`
                <div class="panel">
                    <div class="panel-title">
                        Report generation error
                    </div>
                    <div style="font-size:8px;line-height:1.6">
                        ${escapeHTML(
                            error?.message ||
                            "Unknown report error"
                        )}
                    </div>
                </div>
            `,
            text:
                error?.message ||
                "Unknown report error"
        };
    }

    result.scheduleId =
        scheduleId;

    result.generatedAt =
        Date.now();

    ensureReportStore(
        scheduleId
    )[id] =
        result;

    state.reportJobs[key] = {
        progress:100,
        status:"complete"
    };

    refreshRecommendationsForSchedule(
        scheduleId
    );

    if(
        render &&
        getActiveSchedule()?.id ===
        scheduleId &&
        state.currentReport === id
    ){

        renderReport(
            result
        );
    }

    renderReportList();
    renderRightPane();

    return result;
}

async function buildAllReportsForSchedule(
    scheduleId
){

    const schedule =
        getScheduleById(
            scheduleId
        );

    if(!schedule)
        return;

    ensureReportStore(
        scheduleId
    );

    for(const report of REPORTS){

        await buildReport(
            report.id,
            scheduleId,
            {
                render:
                    getActiveSchedule()?.id ===
                    scheduleId &&
                    state.currentReport ===
                    report.id
            }
        );
    }

    refreshRecommendationsForSchedule(
        scheduleId
    );

    scheduleSave();
}

async function generateReport(
    id,
    schedules
){

    switch(id){

        case "health":
            return buildHealthReport(
                schedules
            );

        case "dcma":
            return buildDCMAReport(
                schedules
            );

        case "detailed":
            return buildDetailedReport(
                schedules
            );

        case "forensic":
            return buildForensicReport(
                schedules
            );

        case "scurve":
            return buildSCurveReport(
                schedules
            );

        case "cost":
            return buildCostReport(
                schedules
            );

        case "comparison":
            return buildComparisonReport(
                schedules
            );

        case "week":
            return buildWeekOnWeekReport(
                schedules
            );

        case "delay":
            return buildDelayReport(
                schedules
            );

        case "monte":
            return buildMonteCarloReport(
                schedules
            );

        case "gantt":
            return buildGanttReport(
                schedules
            );

        case "ai":
            return await buildAIReport(
                schedules
            );

        default:
            throw new Error(
                "Unknown report"
            );
    }
}

async function runSelectedReport(){

    const active =
        getActiveSchedule();

    if(
        !active ||
        !state.currentReport
    ){
        return;
    }

    delete ensureReportStore(
        active.id
    )[state.currentReport];

    await buildReport(
        state.currentReport,
        active.id,
        {
            render:true
        }
    );
}

async function runAllReports(){

    const active =
        getActiveSchedule();

    if(!active)
        return;

    state.reports[
        active.id
    ] = {};

    await buildAllReportsForSchedule(
        active.id
    );

    await openReport(
        state.currentReport ||
        "health"
    );
}

function calculateHealth(schedules){

    const activities =
        schedules.flatMap(
            s => s.activities
        );

    if(!activities.length){

        return {
            score:0,
            label:"Insufficient data",
            reasons:["No activities were parsed."]
        };
    }

    const logicMissing =
        activities.filter(
            a =>
                !a.predecessors.length &&
                !a.successors.length
        ).length;

    const constraints =
        activities.filter(
            a => a.constraint
        ).length;

    const negativeFloat =
        activities.filter(
            a => a.totalFloat < 0
        ).length;

    const critical =
        activities.filter(
            a =>
                a.critical ||
                a.totalFloat <= 0
        ).length;

    const overdue =
        activities.filter(a => {

            if(!a.finish) return false;

            if(a.percent >= 100) return false;

            return new Date(a.finish) < new Date();

        }).length;

    let score = 100;

    score -=
        Math.min(
            25,
            logicMissing /
            activities.length *
            35
        );

    score -=
        Math.min(
            20,
            constraints /
            activities.length *
            25
        );

    score -=
        Math.min(
            25,
            negativeFloat /
            activities.length *
            45
        );

    score -=
        Math.min(
            15,
            overdue /
            activities.length *
            20
        );

    score =
        Math.max(
            0,
            Math.round(score)
        );

    const label =
        score >= 85
            ? "Healthy"
            : score >= 70
                ? "Watch"
                : score >= 50
                    ? "At risk"
                    : "Poor";

    const reasons = [
        `${logicMissing} activities have no predecessor or successor relationship.`,
        `${constraints} activities contain explicit constraints.`,
        `${negativeFloat} activities have negative float.`,
        `${critical} activities are critical or zero-float.`,
        `${overdue} incomplete activities have forecast/finish dates before today.`
    ];

    return {
        score,
        label,
        reasons
    };
}

function buildHealthReport(schedules){

    const health =
        calculateHealth(schedules);

    const activities =
        schedules.flatMap(
            s => s.activities
        );

    const completed =
        activities.filter(
            a => a.percent >= 100
        ).length;

    const inProgress =
        activities.filter(
            a =>
                a.percent > 0 &&
                a.percent < 100
        ).length;

    const notStarted =
        activities.length -
        completed -
        inProgress;

    const critical =
        activities.filter(
            a =>
                a.critical ||
                a.totalFloat <= 0
        ).length;

    const negative =
        activities.filter(
            a =>
                a.totalFloat < 0
        ).length;

    const forecastFinish =
        latestDate(
            activities.map(
                a => a.finish
            )
        );

    return {
        id:"health",
        title:"Schedule health report",
        subtitle:
            "Interactive schedule quality and performance dashboard",
        html:`

            <div class="metrics">

                ${metric(
                    "Health score",
                    `${health.score}/100`,
                    health.label,
                    health.score >= 85
                        ? "good"
                        : health.score >= 70
                            ? "warning"
                            : "danger"
                )}

                ${metric(
                    "Activities",
                    activities.length,
                    "Parsed activities",
                    "blue"
                )}

                ${metric(
                    "Critical",
                    critical,
                    "Critical / zero float",
                    "danger"
                )}

                ${metric(
                    "Negative float",
                    negative,
                    "Activities",
                    negative ? "danger":"good"
                )}

                ${metric(
                    "Forecast finish",
                    formatDate(forecastFinish),
                    "Latest activity finish",
                    "blue"
                )}

            </div>

            <div class="grid2">

                <div class="panel">

                    <div class="panel-title">
                        Overall assessment
                    </div>

                    <div style="
                        display:flex;
                        align-items:center;
                        gap:12px;
                    ">

                        <div style="
                            width:70px;
                            height:70px;
                            display:grid;
                            place-items:center;
                            border-radius:50%;
                            background:
                                conic-gradient(
                                    ${health.score >= 85
                                        ? "var(--green)"
                                        : health.score >= 70
                                            ? "var(--amber)"
                                            : "var(--red)"
                                    } ${health.score}%,
                                    #ecece7 ${health.score}%
                                );
                        ">

                            <div style="
                                width:54px;
                                height:54px;
                                display:grid;
                                place-items:center;
                                border-radius:50%;
                                background:white;
                                font-size:13px;
                                font-weight:800;
                            ">
                                ${health.score}
                            </div>

                        </div>

                        <div>

                            <strong>
                                ${health.label}
                            </strong>

                            <p style="
                                color:#777;
                                font-size:7px;
                                line-height:1.5;
                            ">
                                Screening assessment based on
                                logic, float, constraints and
                                forecast/status characteristics.
                            </p>

                        </div>

                    </div>

                </div>

                <div class="panel">

                    <div class="panel-title">
                        Activity status
                    </div>

                    <table>

                        <tr>
                            <td>Complete</td>
                            <td>
                                <strong>${completed}</strong>
                                (${formatPercent(
                                    activities.length
                                        ? completed/activities.length*100
                                        : 0
                                )})
                            </td>
                        </tr>

                        <tr>
                            <td>In progress</td>
                            <td>
                                <strong>${inProgress}</strong>
                            </td>
                        </tr>

                        <tr>
                            <td>Not started</td>
                            <td>
                                <strong>${notStarted}</strong>
                            </td>
                        </tr>

                        <tr>
                            <td>Critical / zero float</td>
                            <td>
                                <strong>${critical}</strong>
                            </td>
                        </tr>

                    </table>

                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Health findings
                </div>

                <div class="analysis-list">

                    ${health.reasons.map(
                        (reason,index)=>`

                        <div class="analysis-row">

                            <div class="analysis-dot"></div>

                            <div class="analysis-main">

                                <div class="analysis-title">
                                    Finding ${index+1}
                                </div>

                                <div class="analysis-detail">
                                    ${escapeHTML(reason)}
                                </div>

                            </div>

                        </div>
                    `).join("")}

                </div>

            </div>

            ${scheduleTable(schedules)}

        `,
        text:
            `Schedule Health Report\n\n` +
            `Score: ${health.score}/100 (${health.label})\n\n` +
            health.reasons.join("\n")
    };
}

function calculateDCMA(schedule){

    const a =
        schedule.activities;

    const total =
        a.length || 1;

    const incomplete =
        a.filter(
            x => x.percent < 100
        );

    const missingPredecessor =
        incomplete.filter(
            x => !x.predecessors.length
        ).length;

    const missingSuccessor =
        incomplete.filter(
            x => !x.successors.length
        ).length;

    const logic =
        a.filter(
            x =>
                x.predecessors.length +
                x.successors.length === 0
        ).length;

    const hardConstraints =
        a.filter(
            x => x.constraint
        ).length;

    const negativeFloat =
        a.filter(
            x => x.totalFloat < 0
        ).length;

    const zeroFloat =
        a.filter(
            x => x.totalFloat <= 0
        ).length;

    const highFloat =
        a.filter(
            x => x.totalFloat > 44
        ).length;

    const durationRisk =
        a.filter(
            x => x.duration > 44
        ).length;

    const completed =
        a.filter(
            x => x.percent >= 100
        ).length;

    const milestones =
        a.filter(
            x => x.duration === 0
        ).length;

    return [
        {
            n:1,
            title:"Logic completeness",
            result:
                (logic/total*100) <= 5,
            value:
                formatPercent(
                    100 -
                    logic/total*100
                ),
            detail:
                `${logic} activities appear isolated from schedule logic.`
        },
        {
            n:2,
            title:"Missing predecessors",
            result:
                missingPredecessor/Math.max(incomplete.length,1)*100 <= 5,
            value:
                `${missingPredecessor}`,
            detail:
                `${missingPredecessor} incomplete activities have no predecessor.`
        },
        {
            n:3,
            title:"Missing successors",
            result:
                missingSuccessor/Math.max(incomplete.length,1)*100 <= 5,
            value:
                `${missingSuccessor}`,
            detail:
                `${missingSuccessor} incomplete activities have no successor.`
        },
        {
            n:4,
            title:"Hard constraints",
            result:
                hardConstraints/total*100 <= 5,
            value:
                `${hardConstraints}`,
            detail:
                `${hardConstraints} activities contain a constraint.`
        },
        {
            n:5,
            title:"Negative float",
            result:
                negativeFloat === 0,
            value:
                `${negativeFloat}`,
            detail:
                `${negativeFloat} activities have negative float.`
        },
        {
            n:6,
            title:"High float",
            result:
                highFloat/total*100 <= 5,
            value:
                `${highFloat}`,
            detail:
                `${highFloat} activities have more than 44 days float.`
        },
        {
            n:7,
            title:"Long duration activities",
            result:
                durationRisk/total*100 <= 5,
            value:
                `${durationRisk}`,
            detail:
                `${durationRisk} activities exceed approximately 44 working days.`
        },
        {
            n:8,
            title:"Critical / zero float",
            result:
                zeroFloat/total*100 <= 15,
            value:
                `${zeroFloat}`,
            detail:
                `${zeroFloat} activities have zero or negative float.`
        },
        {
            n:9,
            title:"Milestones",
            result:
                milestones > 0,
            value:
                `${milestones}`,
            detail:
                `${milestones} zero-duration activities were identified.`
        },
        {
            n:10,
            title:"Completed activities",
            result:
                completed <= total,
            value:
                `${completed}`,
            detail:
                `${completed} activities are marked complete.`
        },
        {
            n:11,
            title:"Actual progress",
            result:
                a.some(x => x.percent > 0),
            value:
                `${a.filter(x=>x.percent>0).length}`,
            detail:
                "Activities containing reported progress."
        },
        {
            n:12,
            title:"Forecast dates",
            result:
                a.some(x => x.finish),
            value:
                `${a.filter(x=>x.finish).length}`,
            detail:
                "Activities containing finish/forecast dates."
        },
        {
            n:13,
            title:"Baseline dates",
            result:
                a.some(x => x.baselineFinish),
            value:
                `${a.filter(x=>x.baselineFinish).length}`,
            detail:
                "Activities containing baseline finish information."
        },
        {
            n:14,
            title:"Activity traceability",
            result:
                a.some(x=>x.id && x.name),
            value:
                `${a.filter(x=>x.id && x.name).length}`,
            detail:
                "Activities containing an identifiable ID and name."
        }
    ];
}

function buildDCMASummary(schedules){

    const results =
        schedules.map(
            calculateDCMA
        );

    const all =
        results.flat();

    const passed =
        all.filter(
            x => x.result
        ).length;

    return [
        "### DCMA-style screening",
        "",
        `**${passed}/${all.length}** checks currently screen as passing.`,
        "",
        ...all
            .filter(x=>!x.result)
            .slice(0,8)
            .map(
                x =>
                    `- **${x.title}:** ${x.detail}`
            ),
        "",
        "This is an automated browser-based screening assessment. It is not a substitute for a formal DCMA schedule quality review against the project-specific baseline, calendars, coding structures and contractual requirements."
    ].join("\n");
}

function buildDCMAReport(schedules){

    const results =
        schedules.flatMap(
            calculateDCMA
        );

    const passed =
        results.filter(
            x => x.result
        ).length;

    const score =
        Math.round(
            passed /
            results.length *
            100
        );

    return {
        id:"dcma",
        title:"Full DCMA check",
        subtitle:
            "14-point automated schedule quality screening",
        html:`

            <div class="metrics">

                ${metric(
                    "DCMA screen",
                    `${score}%`,
                    `${passed}/${results.length} checks passing`,
                    score >= 85
                        ? "good"
                        : score >= 70
                            ? "warning"
                            : "danger"
                )}

                ${metric(
                    "Passed",
                    passed,
                    "Screening checks",
                    "good"
                )}

                ${metric(
                    "Failed",
                    results.length-passed,
                    "Requires review",
                    results.length-passed
                        ? "danger"
                        : "good"
                )}

                ${metric(
                    "Schedules",
                    schedules.length,
                    "Active schedules",
                    "blue"
                )}

                ${metric(
                    "Activities",
                    schedules.reduce(
                        (n,s)=>n+s.activities.length,
                        0
                    ),
                    "Total activities",
                    "blue"
                )}

            </div>

            <div class="panel">

                <div class="panel-title">
                    14-point DCMA-style assessment
                </div>

                <div class="check-grid">

                    ${results.map(
                        check=>`

                        <div class="check">

                            <div class="check-number">
                                ${check.n}
                            </div>

                            <div class="check-main">

                                <div class="check-title">
                                    ${escapeHTML(check.title)}

                                    <span
                                        class="pill ${
                                            check.result
                                                ? "good"
                                                : "danger"
                                        }"
                                        style="float:right"
                                    >
                                        ${
                                            check.result
                                                ? "PASS"
                                                : "REVIEW"
                                        }
                                    </span>
                                </div>

                                <div class="check-text">
                                    ${escapeHTML(check.detail)}
                                </div>

                            </div>

                        </div>
                    `
                    ).join("")}

                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Important qualification
                </div>

                <div style="
                    color:#666;
                    font-size:7px;
                    line-height:1.6;
                ">
                    The checks above are automated indicators designed
                    to help project-controls teams identify potential
                    schedule-quality issues. They should not be described
                    as a formal DCMA certification or contractual opinion.
                    Thresholds can and should be configured for the
                    specific project.
                </div>

            </div>
        `,
        text:
            `DCMA-style Schedule Check\n\nScore: ${score}%\n\n` +
            results.map(
                x =>
                    `${x.n}. ${x.title}: ${x.result?"PASS":"REVIEW"} — ${x.detail}`
            ).join("\n")
    };
}

function analyseCriticalPath(
    schedule,
    nearFloat=10
){

    const activities =
        schedule.activities ||
        [];

    const byId =
        new Map(
            activities.map(
                activity=>[
                    String(
                        activity.id
                    ),
                    activity
                ]
            )
        );

    const criticalActivities =
        activities
            .filter(
                activity =>
                    activity.critical ||
                    activity.totalFloat <= 0
            )
            .sort(
                (a,b)=>
                    (
                        a.totalFloat || 0
                    ) -
                    (
                        b.totalFloat || 0
                    )
            );

    const criticalIds =
        new Set(
            criticalActivities.map(
                activity=>
                    String(
                        activity.id
                    )
            )
        );

    const criticalRelationships =
        (schedule.relationships || [])
            .filter(
                relationship =>
                    criticalIds.has(
                        String(
                            relationship.predecessor
                        )
                    ) &&
                    criticalIds.has(
                        String(
                            relationship.successor
                        )
                    )
            );

    const successors =
        new Map();

    const predecessors =
        new Map();

    criticalActivities.forEach(
        activity=>{

            successors.set(
                String(activity.id),
                []
            );

            predecessors.set(
                String(activity.id),
                []
            );
        }
    );

    criticalRelationships.forEach(
        relationship=>{

            successors
                .get(
                    String(
                        relationship.predecessor
                    )
                )
                ?.push(
                    String(
                        relationship.successor
                    )
                );

            predecessors
                .get(
                    String(
                        relationship.successor
                    )
                )
                ?.push(
                    String(
                        relationship.predecessor
                    )
                );
        }
    );

    const starts =
        criticalActivities.filter(
            activity =>
                (
                    predecessors.get(
                        String(
                            activity.id
                        )
                    ) ||
                    []
                ).length === 0
        );

    const paths = [];

    const walk =
        (
            activityId,
            path,
            visited
        )=>{

            if(
                visited.has(
                    activityId
                )
            ){

                paths.push(
                    [...path]
                );

                return;
            }

            const nextVisited =
                new Set(
                    visited
                );

            nextVisited.add(
                activityId
            );

            const activity =
                byId.get(
                    activityId
                );

            if(!activity)
                return;

            const nextPath = [
                ...path,
                activity
            ];

            const next =
                successors.get(
                    activityId
                ) ||
                [];

            if(
                !next.length ||
                nextPath.length >= 80
            ){

                paths.push(
                    nextPath
                );

                return;
            }

            next
                .slice(0,12)
                .forEach(
                    successorId=>
                        walk(
                            successorId,
                            nextPath,
                            nextVisited
                        )
                );
        };

    (
        starts.length
            ? starts
            : criticalActivities.slice(0,10)
    )
        .slice(0,30)
        .forEach(
            activity=>
                walk(
                    String(
                        activity.id
                    ),
                    [],
                    new Set()
                )
        );

    const topChains =
        paths
            .filter(
                path=>path.length
            )
            .sort(
                (a,b)=>{

                    const finishA =
                        latestDate(
                            a.map(
                                activity=>
                                    activity.finish
                            )
                        );

                    const finishB =
                        latestDate(
                            b.map(
                                activity=>
                                    activity.finish
                            )
                        );

                    const durationA =
                        a.reduce(
                            (sum,activity)=>
                                sum +
                                (
                                    activity.remainingDuration ||
                                    activity.duration ||
                                    0
                                ),
                            0
                        );

                    const durationB =
                        b.reduce(
                            (sum,activity)=>
                                sum +
                                (
                                    activity.remainingDuration ||
                                    activity.duration ||
                                    0
                                ),
                            0
                        );

                    return (
                        (
                            finishB
                                ? new Date(
                                    finishB
                                ).getTime()
                                : 0
                        ) -
                        (
                            finishA
                                ? new Date(
                                    finishA
                                ).getTime()
                                : 0
                        )
                    ) ||
                    durationB -
                    durationA;
                }
            )
            .slice(0,12);

    const nearCritical =
        activities
            .filter(
                activity =>
                    !criticalIds.has(
                        String(
                            activity.id
                        )
                    ) &&
                    activity.totalFloat > 0 &&
                    activity.totalFloat <=
                    nearFloat
            )
            .sort(
                (a,b)=>
                    a.totalFloat -
                    b.totalFloat
            );

    const breaks =
        criticalActivities.filter(
            activity=>{

                const predCount =
                    (
                        predecessors.get(
                            String(
                                activity.id
                            )
                        ) ||
                        []
                    ).length;

                const succCount =
                    (
                        successors.get(
                            String(
                                activity.id
                            )
                        ) ||
                        []
                    ).length;

                return (
                    predCount === 0 ||
                    succCount === 0
                ) &&
                !activity.milestone;
            }
        );

    return {
        criticalActivities,
        criticalRelationships,
        nearCritical,
        starts,
        topChains,
        breaks
    };
}

function collectScheduleIssues(
    schedule
){

    const activities =
        schedule.activities ||
        [];

    const issues = [];

    const add =
        (
            activity,
            category,
            severity,
            detail
        )=>{

            issues.push({
                activity,
                category,
                severity,
                detail
            });
        };

    activities.forEach(
        activity=>{

            const predCount =
                activity.predecessors
                    ?.length ||
                0;

            const succCount =
                activity.successors
                    ?.length ||
                0;

            if(
                activity.percent < 100 &&
                predCount === 0 &&
                !activity.milestone
            ){

                add(
                    activity,
                    "Logic",
                    "high",
                    "Incomplete activity has no predecessor."
                );
            }

            if(
                activity.percent < 100 &&
                succCount === 0 &&
                !activity.milestone
            ){

                add(
                    activity,
                    "Logic",
                    "high",
                    "Incomplete activity has no successor."
                );
            }

            if(
                !activity.start ||
                !activity.finish
            ){

                add(
                    activity,
                    "Dates",
                    "high",
                    "Missing current/forecast start or finish date."
                );
            }

            if(
                activity.start &&
                activity.finish &&
                new Date(
                    activity.start
                ) >
                new Date(
                    activity.finish
                )
            ){

                add(
                    activity,
                    "Dates",
                    "high",
                    "Start date is later than finish date."
                );
            }

            if(
                activity.constraint ||
                activity.secondConstraint
            ){

                add(
                    activity,
                    "Constraint",
                    (
                        /mandatory|must/i.test(
                            `${activity.constraint} ${activity.secondConstraint}`
                        )
                            ? "high"
                            : "medium"
                    ),
                    `Constraint(s): ${activity.constraint || "—"}${activity.secondConstraint ? ` / ${activity.secondConstraint}`:""}.`
                );
            }

            if(
                activity.totalFloat < 0
            ){

                add(
                    activity,
                    "Float",
                    "high",
                    `Negative total float of ${formatNumber(activity.totalFloat)} days.`
                );
            }

            if(
                activity.totalFloat > 44
            ){

                add(
                    activity,
                    "Float",
                    "medium",
                    `High total float of ${formatNumber(activity.totalFloat)} days.`
                );
            }

            if(
                activity.duration > 44 &&
                !activity.milestone
            ){

                add(
                    activity,
                    "Duration",
                    "medium",
                    `Long original/planned duration of ${formatNumber(activity.duration)} days.`
                );
            }

            if(
                activity.percent > 0 &&
                !activity.actualStart
            ){

                add(
                    activity,
                    "Progress",
                    "high",
                    `Progress is ${formatPercent(activity.percent)} but no actual start was parsed.`
                );
            }

            if(
                activity.percent >= 100 &&
                !activity.actualFinish
            ){

                add(
                    activity,
                    "Progress",
                    "high",
                    "Activity is 100% complete but no actual finish was parsed."
                );
            }

            if(
                activity.actualFinish &&
                activity.percent < 100
            ){

                add(
                    activity,
                    "Progress",
                    "high",
                    `Actual finish exists but percent complete is ${formatPercent(activity.percent)}.`
                );
            }

            if(
                schedule.statusDate &&
                activity.actualStart &&
                new Date(
                    activity.actualStart
                ) >
                new Date(
                    schedule.statusDate
                )
            ){

                add(
                    activity,
                    "Progress",
                    "high",
                    "Actual start is later than the schedule data/status date."
                );
            }

            if(
                schedule.statusDate &&
                activity.actualFinish &&
                new Date(
                    activity.actualFinish
                ) >
                new Date(
                    schedule.statusDate
                )
            ){

                add(
                    activity,
                    "Progress",
                    "high",
                    "Actual finish is later than the schedule data/status date."
                );
            }

            if(
                activity.baselineFinish &&
                activity.currentFinish
            ){

                const movement =
                    daysBetween(
                        activity.baselineFinish,
                        activity.currentFinish
                    );

                if(
                    Math.abs(
                        movement
                    ) >= 14
                ){

                    add(
                        activity,
                        "Baseline variance",
                        movement > 0
                            ? "high"
                            : "medium",
                        `Current finish is ${Math.abs(movement)} days ${movement>0 ? "later":"earlier"} than baseline finish.`
                    );
                }
            }

            if(
                activity.critical &&
                (
                    predCount === 0 ||
                    succCount === 0
                ) &&
                !activity.milestone
            ){

                add(
                    activity,
                    "Critical path",
                    "high",
                    "Critical activity has a break in predecessor/successor continuity."
                );
            }

            if(
                !activity.calendar
            ){

                add(
                    activity,
                    "Calendar",
                    "medium",
                    "No activity calendar was identified."
                );
            }
        }
    );

    (
        schedule.relationships ||
        []
    ).forEach(
        relationship=>{

            const successor =
                activities.find(
                    activity =>
                        String(
                            activity.id
                        ) ===
                        String(
                            relationship.successor
                        )
                );

            if(!successor)
                return;

            if(
                Math.abs(
                    relationship.lag || 0
                ) > 5
            ){

                add(
                    successor,
                    "Relationship",
                    "medium",
                    `${relationship.predecessor} → ${relationship.successor} ${relationship.type} has ${formatNumber(relationship.lag)} days lag.`
                );
            }

            if(
                relationship.type !== "FS"
            ){

                add(
                    successor,
                    "Relationship",
                    "low",
                    `${relationship.predecessor} → ${relationship.successor} uses ${relationship.type} logic.`
                );
            }
        }
    );

    const rank = {
        high:3,
        medium:2,
        low:1
    };

    issues.sort(
        (a,b)=>
            rank[b.severity] -
            rank[a.severity]
    );

    return issues;
}

function buildDetailedReport(
    schedules
){

    const schedule =
        schedules[0];

    const activities =
        schedule.activities ||
        [];

    const issues =
        collectScheduleIssues(
            schedule
        );

    const critical =
        analyseCriticalPath(
            schedule,
            10
        );

    const high =
        issues.filter(
            issue =>
                issue.severity ===
                "high"
        ).length;

    const medium =
        issues.filter(
            issue =>
                issue.severity ===
                "medium"
        ).length;

    const criticalPathRows =
        critical.topChains.length
            ? critical.topChains
                .map(
                    (path,index)=>{

                        const pathDuration =
                            path.reduce(
                                (sum,activity)=>
                                    sum +
                                    (
                                        activity.remainingDuration ||
                                        activity.duration ||
                                        0
                                    ),
                                0
                            );

                        return `
                            <tr>
                                <td>
                                    <strong>Path ${index+1}</strong>
                                </td>
                                <td>${path.length}</td>
                                <td>${formatNumber(pathDuration)} d</td>
                                <td>${formatDate(path[0]?.start)}</td>
                                <td>${formatDate(path[path.length-1]?.finish)}</td>
                                <td>
                                    ${path
                                        .map(
                                            activity=>
                                                `<span class="activity-id">${escapeHTML(activity.id)}</span> ${escapeHTML(activity.name)}`
                                        )
                                        .join(" → ")}
                                </td>
                            </tr>
                        `;
                    }
                )
                .join("")
            : `
                <tr>
                    <td colspan="6">
                        No continuous critical chain could be assembled from the parsed relationships.
                    </td>
                </tr>
            `;

    return {
        id:"detailed",
        title:"Detailed schedule check",
        subtitle:
            "Activity-level logic, dates, progress, constraints, float and critical-path analysis",
        html:`

            <div class="metrics">

                ${metric(
                    "Detailed issues",
                    issues.length,
                    "Activity / relationship findings",
                    issues.length ? "warning":"good"
                )}

                ${metric(
                    "High severity",
                    high,
                    "Requires priority review",
                    high ? "danger":"good"
                )}

                ${metric(
                    "Critical activities",
                    critical.criticalActivities.length,
                    "Zero / negative float or critical flag",
                    "danger"
                )}

                ${metric(
                    "Near critical",
                    critical.nearCritical.length,
                    "0–10 days float",
                    "warning"
                )}

                ${metric(
                    "Critical links",
                    critical.criticalRelationships.length,
                    "Critical-to-critical relationships",
                    "blue"
                )}

            </div>

            <div class="panel">

                <div class="panel-title">
                    Detailed critical path analysis
                </div>

                <div class="panel-subtitle">
                    Critical chains are reconstructed from parsed activity IDs and schedule relationships. Multiple chains can exist where the network branches or merges.
                </div>

                <table>

                    <thead>
                        <tr>
                            <th>Path</th>
                            <th>Activities</th>
                            <th>Remaining / activity duration</th>
                            <th>Path start</th>
                            <th>Path finish</th>
                            <th>Activity sequence</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${criticalPathRows}
                    </tbody>

                </table>

            </div>

            <div class="grid2">

                <div class="panel">

                    <div class="panel-title">
                        Critical-path continuity
                    </div>

                    <table>
                        <tr>
                            <td>Critical activities</td>
                            <td><strong>${critical.criticalActivities.length}</strong></td>
                        </tr>
                        <tr>
                            <td>Critical relationships</td>
                            <td><strong>${critical.criticalRelationships.length}</strong></td>
                        </tr>
                        <tr>
                            <td>Critical chain starts</td>
                            <td><strong>${critical.starts.length}</strong></td>
                        </tr>
                        <tr>
                            <td>Potential path breaks / endpoints</td>
                            <td><strong>${critical.breaks.length}</strong></td>
                        </tr>
                        <tr>
                            <td>Near-critical activities</td>
                            <td><strong>${critical.nearCritical.length}</strong></td>
                        </tr>
                    </table>

                </div>

                <div class="panel">

                    <div class="panel-title">
                        Critical / near-critical activities
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Activity</th>
                                <th>WBS</th>
                                <th>Float</th>
                                <th>Finish</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${[
                                ...critical.criticalActivities,
                                ...critical.nearCritical
                            ]
                                .slice(0,60)
                                .map(
                                    activity=>`
                                        <tr>
                                            <td class="activity-id">${escapeHTML(activity.id)}</td>
                                            <td>${escapeHTML(activity.name)}</td>
                                            <td>${escapeHTML(activity.wbsPath || activity.wbs || "—")}</td>
                                            <td>${formatNumber(activity.totalFloat)}</td>
                                            <td>${formatDate(activity.finish)}</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Activity and relationship issues
                </div>

                <div class="panel-subtitle">
                    Each finding is tied to the activity ID so it can be traced directly in P6 or Microsoft Project.
                </div>

                <table>

                    <thead>
                        <tr>
                            <th>Severity</th>
                            <th>Activity ID</th>
                            <th>Activity name</th>
                            <th>WBS</th>
                            <th>Category</th>
                            <th>Issue</th>
                            <th>% complete</th>
                            <th>Float</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${
                            issues.length
                                ? issues
                                    .slice(0,250)
                                    .map(
                                        issue=>`
                                            <tr>
                                                <td>
                                                    <span class="issue-severity ${issue.severity}">
                                                        ${escapeHTML(issue.severity)}
                                                    </span>
                                                </td>
                                                <td class="activity-id">${escapeHTML(issue.activity.id)}</td>
                                                <td>${escapeHTML(issue.activity.name)}</td>
                                                <td>${escapeHTML(issue.activity.wbsPath || issue.activity.wbs || "—")}</td>
                                                <td>${escapeHTML(issue.category)}</td>
                                                <td>${escapeHTML(issue.detail)}</td>
                                                <td>${formatPercent(issue.activity.percent)}</td>
                                                <td>${formatNumber(issue.activity.totalFloat)}</td>
                                            </tr>
                                        `
                                    )
                                    .join("")
                                : `
                                    <tr>
                                        <td colspan="8">
                                            No detailed schedule exceptions were identified by the automated checks.
                                        </td>
                                    </tr>
                                `
                        }

                    </tbody>

                </table>

            </div>

        `,
        text:
            `Detailed Schedule Check\n\n` +
            `Schedule: ${schedule.name}\n` +
            `Issues: ${issues.length} (${high} high, ${medium} medium)\n` +
            `Critical activities: ${critical.criticalActivities.length}\n` +
            `Near-critical activities: ${critical.nearCritical.length}\n\n` +
            `CRITICAL PATHS\n` +
            critical.topChains
                .map(
                    (path,index)=>
                        `Path ${index+1}: ${path.map(a=>`${a.id} ${a.name}`).join(" -> ")}`
                )
                .join("\n") +
            `\n\nISSUES\n` +
            issues
                .map(
                    issue=>
                        `${issue.severity.toUpperCase()} | ${issue.activity.id} | ${issue.activity.name} | ${issue.category} | ${issue.detail}`
                )
                .join("\n")
    };
}

function relationshipSignature(
    relationship
){

    return [
        String(
            relationship.predecessor ||
            ""
        ),
        String(
            relationship.successor ||
            ""
        ),
        String(
            relationship.type ||
            "FS"
        ),
        Number(
            relationship.lag ||
            0
        ).toFixed(2)
    ].join("|");
}

function compareScheduleNetworks(
    current,
    baseline
){

    const currentById =
        new Map(
            (current.activities || [])
                .map(
                    activity=>[
                        String(
                            activity.id
                        ),
                        activity
                    ]
                )
        );

    const baselineById =
        new Map(
            (baseline.activities || [])
                .map(
                    activity=>[
                        String(
                            activity.id
                        ),
                        activity
                    ]
                )
        );

    const allIds =
        new Set([
            ...currentById.keys(),
            ...baselineById.keys()
        ]);

    const activityChanges = [];

    allIds.forEach(
        id=>{

            const currentActivity =
                currentById.get(id);

            const baselineActivity =
                baselineById.get(id);

            if(
                currentActivity &&
                !baselineActivity
            ){

                activityChanges.push({
                    id,
                    status:"New",
                    current:currentActivity,
                    baseline:null,
                    startVariance:null,
                    finishVariance:null,
                    durationVariance:null,
                    floatVariance:null,
                    calendarChanged:false,
                    wbsChanged:false,
                    areaChanged:false,
                    predecessorAdded:
                        currentActivity.predecessors ||
                        [],
                    predecessorRemoved:[],
                    successorAdded:
                        currentActivity.successors ||
                        [],
                    successorRemoved:[]
                });

                return;
            }

            if(
                baselineActivity &&
                !currentActivity
            ){

                activityChanges.push({
                    id,
                    status:"Deleted",
                    current:null,
                    baseline:baselineActivity,
                    startVariance:null,
                    finishVariance:null,
                    durationVariance:null,
                    floatVariance:null,
                    calendarChanged:false,
                    wbsChanged:false,
                    areaChanged:false,
                    predecessorAdded:[],
                    predecessorRemoved:
                        baselineActivity.predecessors ||
                        [],
                    successorAdded:[],
                    successorRemoved:
                        baselineActivity.successors ||
                        []
                });

                return;
            }

            const predecessorCurrent =
                new Set(
                    currentActivity.predecessors ||
                    []
                );

            const predecessorBaseline =
                new Set(
                    baselineActivity.predecessors ||
                    []
                );

            const successorCurrent =
                new Set(
                    currentActivity.successors ||
                    []
                );

            const successorBaseline =
                new Set(
                    baselineActivity.successors ||
                    []
                );

            const predecessorAdded =
                [...predecessorCurrent]
                    .filter(
                        value=>
                            !predecessorBaseline.has(
                                value
                            )
                    );

            const predecessorRemoved =
                [...predecessorBaseline]
                    .filter(
                        value=>
                            !predecessorCurrent.has(
                                value
                            )
                    );

            const successorAdded =
                [...successorCurrent]
                    .filter(
                        value=>
                            !successorBaseline.has(
                                value
                            )
                    );

            const successorRemoved =
                [...successorBaseline]
                    .filter(
                        value=>
                            !successorCurrent.has(
                                value
                            )
                    );

            const startVariance =
                baselineActivity.start &&
                currentActivity.start
                    ? daysBetween(
                        baselineActivity.start,
                        currentActivity.start
                    )
                    : null;

            const finishVariance =
                baselineActivity.finish &&
                currentActivity.finish
                    ? daysBetween(
                        baselineActivity.finish,
                        currentActivity.finish
                    )
                    : null;

            const durationVariance =
                Number(
                    currentActivity.duration ||
                    0
                ) -
                Number(
                    baselineActivity.duration ||
                    0
                );

            const floatVariance =
                Number(
                    currentActivity.totalFloat ||
                    0
                ) -
                Number(
                    baselineActivity.totalFloat ||
                    0
                );

            const calendarChanged =
                String(
                    currentActivity.calendar ||
                    ""
                ) !==
                String(
                    baselineActivity.calendar ||
                    ""
                );

            const wbsChanged =
                String(
                    currentActivity.wbsPath ||
                    currentActivity.wbs ||
                    ""
                ) !==
                String(
                    baselineActivity.wbsPath ||
                    baselineActivity.wbs ||
                    ""
                );

            const areaChanged =
                String(
                    currentActivity.area ||
                    ""
                ) !==
                String(
                    baselineActivity.area ||
                    ""
                );

            const changed =
                (
                    startVariance ||
                    finishVariance ||
                    durationVariance ||
                    floatVariance ||
                    calendarChanged ||
                    wbsChanged ||
                    areaChanged ||
                    predecessorAdded.length ||
                    predecessorRemoved.length ||
                    successorAdded.length ||
                    successorRemoved.length ||
                    Number(
                        currentActivity.percent ||
                        0
                    ) !==
                    Number(
                        baselineActivity.percent ||
                        0
                    )
                );

            activityChanges.push({
                id,
                status:
                    changed
                        ? "Changed"
                        : "Unchanged",
                current:currentActivity,
                baseline:baselineActivity,
                startVariance,
                finishVariance,
                durationVariance,
                floatVariance,
                calendarChanged,
                wbsChanged,
                areaChanged,
                predecessorAdded,
                predecessorRemoved,
                successorAdded,
                successorRemoved
            });
        }
    );

    const currentLinks =
        new Map(
            (current.relationships || [])
                .map(
                    relationship=>[
                        relationshipSignature(
                            relationship
                        ),
                        relationship
                    ]
                )
        );

    const baselineLinks =
        new Map(
            (baseline.relationships || [])
                .map(
                    relationship=>[
                        relationshipSignature(
                            relationship
                        ),
                        relationship
                    ]
                )
        );

    const linkAdded =
        [...currentLinks]
            .filter(
                ([signature])=>
                    !baselineLinks.has(
                        signature
                    )
            )
            .map(
                ([,relationship])=>
                    relationship
            );

    const linkRemoved =
        [...baselineLinks]
            .filter(
                ([signature])=>
                    !currentLinks.has(
                        signature
                    )
            )
            .map(
                ([,relationship])=>
                    relationship
            );

    const wbsGroups =
        new Map();

    activityChanges.forEach(
        change=>{

            const activity =
                change.current ||
                change.baseline;

            const wbs =
                activity?.wbsPath ||
                activity?.wbs ||
                "Unassigned";

            if(
                !wbsGroups.has(
                    wbs
                )
            ){

                wbsGroups.set(
                    wbs,
                    {
                        wbs,
                        total:0,
                        newCount:0,
                        deletedCount:0,
                        changedCount:0,
                        delayedCount:0,
                        maxFinishDelay:0
                    }
                );
            }

            const group =
                wbsGroups.get(
                    wbs
                );

            group.total++;

            if(
                change.status ===
                "New"
            ){
                group.newCount++;
            }

            if(
                change.status ===
                "Deleted"
            ){
                group.deletedCount++;
            }

            if(
                change.status ===
                "Changed"
            ){
                group.changedCount++;
            }

            if(
                Number(
                    change.finishVariance
                ) > 0
            ){

                group.delayedCount++;

                group.maxFinishDelay =
                    Math.max(
                        group.maxFinishDelay,
                        Number(
                            change.finishVariance
                        )
                    );
            }
        }
    );

    return {
        activityChanges,
        linkAdded,
        linkRemoved,
        wbsSummary:
            [...wbsGroups.values()]
                .sort(
                    (a,b)=>
                        b.changedCount -
                        a.changedCount
                )
    };
}

function forensicActivityFlags(
    schedule
){

    const flags = [];

    const add =
        (
            activity,
            category,
            severity,
            detail
        )=>{

            flags.push({
                activity,
                category,
                severity,
                detail
            });
        };

    (
        schedule.activities ||
        []
    ).forEach(
        activity=>{

            if(
                activity.constraint ||
                activity.secondConstraint
            ){

                add(
                    activity,
                    "Constraints",
                    "medium",
                    `Constraint ${activity.constraint || "—"}${activity.secondConstraint ? ` / ${activity.secondConstraint}`:""}.`
                );
            }

            if(
                activity.totalFloat < 0
            ){

                add(
                    activity,
                    "Float",
                    "high",
                    `Negative float ${formatNumber(activity.totalFloat)} days.`
                );
            }

            if(
                activity.totalFloat > 44
            ){

                add(
                    activity,
                    "Float",
                    "medium",
                    `High float ${formatNumber(activity.totalFloat)} days.`
                );
            }

            if(
                activity.percent > 0 &&
                !activity.actualStart
            ){

                add(
                    activity,
                    "Progress",
                    "high",
                    `${formatPercent(activity.percent)} progress without an actual start.`
                );
            }

            if(
                activity.percent >= 100 &&
                !activity.actualFinish
            ){

                add(
                    activity,
                    "Progress",
                    "high",
                    "100% complete without an actual finish."
                );
            }

            if(
                activity.actualFinish &&
                activity.percent < 100
            ){

                add(
                    activity,
                    "Progress",
                    "high",
                    `Actual finish exists while percent complete is ${formatPercent(activity.percent)}.`
                );
            }

            if(
                activity.baselineFinish &&
                activity.currentFinish
            ){

                const movement =
                    daysBetween(
                        activity.baselineFinish,
                        activity.currentFinish
                    );

                if(
                    Math.abs(
                        movement
                    ) >= 7
                ){

                    add(
                        activity,
                        "Date movement",
                        Math.abs(movement)>=21
                            ? "high"
                            : "medium",
                        `Finish moved ${Math.abs(movement)} days ${movement>0?"later":"earlier"} than embedded baseline/target.`
                    );
                }
            }

            if(
                activity.suspendDate ||
                activity.resumeDate
            ){

                add(
                    activity,
                    "Progress",
                    "medium",
                    `Suspend/resume data present: ${formatDate(activity.suspendDate)} / ${formatDate(activity.resumeDate)}.`
                );
            }

            if(
                activity.milestone &&
                (
                    activity.duration > 0 ||
                    (
                        activity.actualStart &&
                        activity.actualFinish &&
                        activity.actualStart !==
                        activity.actualFinish
                    )
                )
            ){

                add(
                    activity,
                    "Milestones",
                    "medium",
                    "Milestone has duration or differing actual start/finish dates."
                );
            }

            if(
                !activity.calendar
            ){

                add(
                    activity,
                    "Calendars",
                    "medium",
                    "No activity calendar was identified."
                );
            }
        }
    );

    return flags;
}

async function setForensicBaseline(
    scheduleId,
    baselineId
){

    state.forensicBaselineBySchedule[
        scheduleId
    ] =
        baselineId ||
        "";

    delete ensureReportStore(
        scheduleId
    ).forensic;

    const result =
        await buildReport(
            "forensic",
            scheduleId,
            {
                render:
                    getActiveSchedule()?.id ===
                    scheduleId
            }
        );

    if(
        getActiveSchedule()?.id ===
        scheduleId
    ){

        renderReport(
            result
        );
    }

    scheduleSave();
}

function buildForensicReport(
    schedules
){

    const schedule =
        schedules[0];

    const baselineId =
        state.forensicBaselineBySchedule[
            schedule.id
        ] ||
        "";

    const baseline =
        getScheduleById(
            baselineId
        );

    const flags =
        forensicActivityFlags(
            schedule
        );

    const comparison =
        baseline
            ? compareScheduleNetworks(
                schedule,
                baseline
            )
            : null;

    const otherSchedules =
        state.schedules.filter(
            item =>
                item.id !==
                schedule.id
        );

    const severe =
        flags.filter(
            flag =>
                flag.severity ===
                "high"
        ).length;

    const milestoneActivities =
        schedule.activities.filter(
            activity =>
                activity.milestone
        );

    const calendarCounts =
        new Map();

    schedule.activities.forEach(
        activity=>{

            const calendar =
                activity.calendar ||
                "Unassigned";

            calendarCounts.set(
                calendar,
                (
                    calendarCounts.get(
                        calendar
                    ) ||
                    0
                ) +
                1
            );
        }
    );

    const changedActivities =
        comparison
            ? comparison.activityChanges
                .filter(
                    change =>
                        change.status !==
                        "Unchanged"
                )
            : [];

    return {
        id:"forensic",
        title:"Forensic schedule check",
        subtitle:
            baseline
                ? `Detailed forensic comparison against ${baseline.name}`
                : "Detailed forensic review using current data and embedded baseline/target information",
        html:`

            <div class="report-parameter-panel">

                <div class="panel-title">
                    Forensic comparison baseline
                </div>

                <div class="report-control-grid">

                    <label class="report-control">
                        External baseline / prior update
                        <select
                            id="forensicBaselineSelect"
                            onchange="setForensicBaseline('${schedule.id}',this.value)"
                        >
                            <option value="">
                                None — use embedded baseline/target dates where available
                            </option>

                            ${otherSchedules
                                .map(
                                    item=>`
                                        <option
                                            value="${item.id}"
                                            ${baselineId===item.id ? "selected":""}
                                        >
                                            ${escapeHTML(item.name)}
                                        </option>
                                    `
                                )
                                .join("")}
                        </select>
                    </label>

                </div>

            </div>

            <div class="metrics">

                ${metric(
                    "Forensic flags",
                    flags.length,
                    "Activity-level anomalies",
                    flags.length ? "warning":"good"
                )}

                ${metric(
                    "High severity",
                    severe,
                    "Priority investigation",
                    severe ? "danger":"good"
                )}

                ${metric(
                    "Milestones",
                    milestoneActivities.length,
                    "Milestone activities",
                    "blue"
                )}

                ${metric(
                    "Calendars",
                    calendarCounts.size,
                    "Calendars in use",
                    "blue"
                )}

                ${metric(
                    "Network changes",
                    comparison
                        ? comparison.linkAdded.length +
                          comparison.linkRemoved.length
                        : "—",
                    baseline
                        ? "Added + removed links"
                        : "Select baseline for link audit",
                    comparison &&
                    (
                        comparison.linkAdded.length ||
                        comparison.linkRemoved.length
                    )
                        ? "danger"
                        : "blue"
                )}

            </div>

            <div class="panel">

                <div class="panel-title">
                    Activity forensic audit
                </div>

                <table>

                    <thead>
                        <tr>
                            <th>Severity</th>
                            <th>Activity ID</th>
                            <th>Activity name</th>
                            <th>WBS / area</th>
                            <th>Category</th>
                            <th>Finding</th>
                            <th>% complete</th>
                            <th>Calendar</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${
                            flags.length
                                ? flags
                                    .slice(0,300)
                                    .map(
                                        flag=>`
                                            <tr>
                                                <td>
                                                    <span class="issue-severity ${flag.severity}">
                                                        ${escapeHTML(flag.severity)}
                                                    </span>
                                                </td>
                                                <td class="activity-id">${escapeHTML(flag.activity.id)}</td>
                                                <td>${escapeHTML(flag.activity.name)}</td>
                                                <td>
                                                    ${escapeHTML(flag.activity.wbsPath || flag.activity.wbs || "—")}
                                                    ${flag.activity.area ? `<br>Area: ${escapeHTML(flag.activity.area)}`:""}
                                                </td>
                                                <td>${escapeHTML(flag.category)}</td>
                                                <td>${escapeHTML(flag.detail)}</td>
                                                <td>${formatPercent(flag.activity.percent)}</td>
                                                <td>${escapeHTML(flag.activity.calendar || "—")}</td>
                                            </tr>
                                        `
                                    )
                                    .join("")
                                : `
                                    <tr>
                                        <td colspan="8">
                                            No material forensic activity flags were identified by the automated review.
                                        </td>
                                    </tr>
                                `
                        }

                    </tbody>

                </table>

            </div>

            ${
                comparison
                    ? `
                        <div class="panel">

                            <div class="panel-title">
                                Activity-by-activity change audit
                            </div>

                            <table>

                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Status</th>
                                        <th>WBS</th>
                                        <th>Start Δ</th>
                                        <th>Finish Δ</th>
                                        <th>Duration Δ</th>
                                        <th>Float Δ</th>
                                        <th>Calendar / WBS / area</th>
                                        <th>Logic changes</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    ${changedActivities
                                        .slice(0,350)
                                        .map(
                                            change=>`
                                                <tr>
                                                    <td class="activity-id">${escapeHTML(change.id)}</td>
                                                    <td>${escapeHTML(change.status)}</td>
                                                    <td>${escapeHTML((change.current || change.baseline)?.wbsPath || "—")}</td>
                                                    <td>${change.startVariance===null ? "—":`${change.startVariance} d`}</td>
                                                    <td>${change.finishVariance===null ? "—":`${change.finishVariance} d`}</td>
                                                    <td>${change.durationVariance===null ? "—":`${formatNumber(change.durationVariance)} d`}</td>
                                                    <td>${change.floatVariance===null ? "—":`${formatNumber(change.floatVariance)} d`}</td>
                                                    <td>
                                                        ${change.calendarChanged ? "Calendar changed; ":""}
                                                        ${change.wbsChanged ? "WBS changed; ":""}
                                                        ${change.areaChanged ? "Area changed; ":""}
                                                        ${!change.calendarChanged&&!change.wbsChanged&&!change.areaChanged ? "—":""}
                                                    </td>
                                                    <td>
                                                        +Pred ${change.predecessorAdded.length};
                                                        −Pred ${change.predecessorRemoved.length};
                                                        +Succ ${change.successorAdded.length};
                                                        −Succ ${change.successorRemoved.length}
                                                    </td>
                                                </tr>
                                            `
                                        )
                                        .join("")}

                                </tbody>

                            </table>

                        </div>

                        <div class="grid2">

                            <div class="panel">

                                <div class="panel-title">
                                    Relationship changes
                                </div>

                                <table>
                                    <thead>
                                        <tr>
                                            <th>Change</th>
                                            <th>Predecessor</th>
                                            <th>Successor</th>
                                            <th>Type</th>
                                            <th>Lag</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${comparison.linkAdded
                                            .slice(0,100)
                                            .map(
                                                link=>`
                                                    <tr>
                                                        <td><span class="pill warning">ADDED</span></td>
                                                        <td class="activity-id">${escapeHTML(link.predecessor)}</td>
                                                        <td class="activity-id">${escapeHTML(link.successor)}</td>
                                                        <td>${escapeHTML(link.type)}</td>
                                                        <td>${formatNumber(link.lag)} d</td>
                                                    </tr>
                                                `
                                            )
                                            .join("")}

                                        ${comparison.linkRemoved
                                            .slice(0,100)
                                            .map(
                                                link=>`
                                                    <tr>
                                                        <td><span class="pill danger">REMOVED</span></td>
                                                        <td class="activity-id">${escapeHTML(link.predecessor)}</td>
                                                        <td class="activity-id">${escapeHTML(link.successor)}</td>
                                                        <td>${escapeHTML(link.type)}</td>
                                                        <td>${formatNumber(link.lag)} d</td>
                                                    </tr>
                                                `
                                            )
                                            .join("")}
                                    </tbody>
                                </table>

                            </div>

                            <div class="panel">

                                <div class="panel-title">
                                    WBS change summary
                                </div>

                                <table>
                                    <thead>
                                        <tr>
                                            <th>WBS</th>
                                            <th>Activities</th>
                                            <th>Changed</th>
                                            <th>New</th>
                                            <th>Deleted</th>
                                            <th>Delayed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${comparison.wbsSummary
                                            .map(
                                                wbs=>`
                                                    <tr>
                                                        <td>${escapeHTML(wbs.wbs)}</td>
                                                        <td>${wbs.total}</td>
                                                        <td>${wbs.changedCount}</td>
                                                        <td>${wbs.newCount}</td>
                                                        <td>${wbs.deletedCount}</td>
                                                        <td>${wbs.delayedCount}</td>
                                                    </tr>
                                                `
                                            )
                                            .join("")}
                                    </tbody>
                                </table>

                            </div>

                        </div>
                    `
                    : `
                        <div class="panel">
                            <div class="panel-title">
                                Native-update change analysis
                            </div>
                            <div style="font-size:7px;line-height:1.6;color:var(--muted)">
                                Select a baseline or prior update above to activate activity-by-activity, relationship-by-relationship, calendar, WBS, area and milestone change analysis. Without an external comparison schedule, the report uses only the baseline/target fields embedded in the active file.
                            </div>
                        </div>
                    `
            }

            <div class="grid2">

                <div class="panel">

                    <div class="panel-title">
                        Calendar usage
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Calendar</th>
                                <th>Activities</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${[...calendarCounts.entries()]
                                .sort(
                                    (a,b)=>b[1]-a[1]
                                )
                                .map(
                                    ([calendar,count])=>`
                                        <tr>
                                            <td>${escapeHTML(calendar)}</td>
                                            <td>${count}</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

                <div class="panel">

                    <div class="panel-title">
                        Milestones
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Milestone</th>
                                <th>WBS</th>
                                <th>Baseline</th>
                                <th>Current</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${milestoneActivities
                                .slice(0,100)
                                .map(
                                    activity=>`
                                        <tr>
                                            <td class="activity-id">${escapeHTML(activity.id)}</td>
                                            <td>${escapeHTML(activity.name)}</td>
                                            <td>${escapeHTML(activity.wbsPath || "—")}</td>
                                            <td>${formatDate(activity.baselineFinish)}</td>
                                            <td>${formatDate(activity.currentFinish || activity.finish)}</td>
                                            <td>${escapeHTML(activity.status)}</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

            </div>

        `,
        text:
            `Forensic Schedule Check\n\n` +
            `Schedule: ${schedule.name}\n` +
            `External baseline: ${baseline ? baseline.name:"None selected"}\n` +
            `Forensic flags: ${flags.length}\n` +
            `High severity: ${severe}\n\n` +
            flags
                .map(
                    flag=>
                        `${flag.severity.toUpperCase()} | ${flag.activity.id} | ${flag.activity.name} | ${flag.category} | ${flag.detail}`
                )
                .join("\n") +
            (
                comparison
                    ? `\n\nNETWORK CHANGES\nAdded links: ${comparison.linkAdded.length}\nRemoved links: ${comparison.linkRemoved.length}\nChanged/new/deleted activities: ${changedActivities.length}\n`
                    : ""
            )
    };
}

function buildSCurveReport(schedules){

    const a =
        schedules.flatMap(
            s=>s.activities
        );

    const points =
        buildTimeSeries(a);

    const chartId =
        "chart-" + crypto.randomUUID();

    setTimeout(
        ()=>drawSCurve(
            chartId,
            points
        ),
        50
    );

    return {
        id:"scurve",
        title:"S-Curve & histogram",
        subtitle:
            "Planned, actual and forecast progress",
        html:`

            <div class="metrics">

                ${metric(
                    "Planned value",
                    currency(
                        a.reduce(
                            (n,x)=>n+(x.budget||0),
                            0
                        )
                    ),
                    "Parsed schedule budget",
                    "blue"
                )}

                ${metric(
                    "Actual cost",
                    currency(
                        a.reduce(
                            (n,x)=>n+(x.actualCost||0),
                            0
                        )
                    ),
                    "Where supplied",
                    "blue"
                )}

                ${metric(
                    "Actual progress",
                    formatPercent(
                        weightedProgress(a)
                    ),
                    "Activity-weighted",
                    "good"
                )}

                ${metric(
                    "Forecast finish",
                    formatDate(
                        latestDate(
                            a.map(x=>x.finish)
                        )
                    ),
                    "Current forecast",
                    "warning"
                )}

                ${metric(
                    "Data points",
                    points.length,
                    "Time periods",
                    "blue"
                )}

            </div>

            <div class="panel">

                <div class="panel-title">
                    Cumulative progress
                </div>

                <div class="chart-controls">
                    <button
                        class="chart-control active"
                        onclick="toggleChartMode(this,'scurve')"
                    >
                        S-Curve
                    </button>

                    <button
                        class="chart-control"
                        onclick="toggleChartMode(this,'histogram')"
                    >
                        Histogram
                    </button>
                </div>

                <div class="chart-wrap">
                    <canvas id="${chartId}"></canvas>
                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Time-phased data
                </div>

                ${timeSeriesTable(points)}

            </div>
        `,
        text:
            `S-Curve and Histogram Report\n\n` +
            timeSeriesText(points)
    };
}

function buildTimeSeries(activities){

    const dates = [];

    activities.forEach(a => {

        if(a.start)
            dates.push(
                new Date(a.start)
            );

        if(a.finish)
            dates.push(
                new Date(a.finish)
            );

        if(a.baselineStart)
            dates.push(
                new Date(a.baselineStart)
            );

        if(a.baselineFinish)
            dates.push(
                new Date(a.baselineFinish)
            );
    });

    if(!dates.length)
        return [];

    let start =
        new Date(
            Math.min(
                ...dates.map(d=>d.getTime())
            )
        );

    let end =
        new Date(
            Math.max(
                ...dates.map(d=>d.getTime())
            )
        );

    const months = [];

    let cursor =
        new Date(
            start.getFullYear(),
            start.getMonth(),
            1
        );

    while(cursor <= end){

        months.push(
            new Date(cursor)
        );

        cursor.setMonth(
            cursor.getMonth()+1
        );

        if(months.length > 120)
            break;
    }

    return months.map(date => {

        const t =
            date.getTime();

        const planned =
            activities.filter(
                a =>
                    a.baselineFinish &&
                    new Date(a.baselineFinish).getTime() <= t
            ).length;

        const actual =
            activities.filter(
                a =>
                    a.percent >= 100 &&
                    a.finish &&
                    new Date(a.finish).getTime() <= t
            ).length;

        const forecast =
            activities.filter(
                a =>
                    a.finish &&
                    new Date(a.finish).getTime() <= t
            ).length;

        const inMonth =
            activities.filter(
                a =>
                    a.finish &&
                    new Date(a.finish).getMonth() === date.getMonth() &&
                    new Date(a.finish).getFullYear() === date.getFullYear()
            ).length;

        return {
            date,
            planned,
            actual,
            forecast,
            histogram:inMonth,
            total:activities.length
        };
    });
}

function drawSCurve(id,points,mode="scurve"){

    const canvas =
        document.getElementById(id);

    if(!canvas)
        return;

    const rect =
        canvas.getBoundingClientRect();

    const ratio =
        window.devicePixelRatio || 1;

    canvas.width =
        rect.width * ratio;

    canvas.height =
        rect.height * ratio;

    const ctx =
        canvas.getContext("2d");

    ctx.scale(
        ratio,
        ratio
    );

    const w =
        rect.width;

    const h =
        rect.height;

    ctx.clearRect(
        0,
        0,
        w,
        h
    );

    const pad = {
        l:42,
        r:15,
        t:15,
        b:30
    };

    ctx.strokeStyle="#e7e7e2";
    ctx.lineWidth=1;

    for(let i=0;i<=4;i++){

        const y =
            pad.t +
            (h-pad.t-pad.b) *
            i/4;

        ctx.beginPath();
        ctx.moveTo(pad.l,y);
        ctx.lineTo(w-pad.r,y);
        ctx.stroke();
    }

    if(!points.length)
        return;

    const max =
        mode === "histogram"
            ? Math.max(
                ...points.map(x=>x.histogram),
                1
            )
            : Math.max(
                ...points.map(x=>x.total),
                1
            );

    const x =
        i =>
            pad.l +
            (w-pad.l-pad.r) *
            (
                points.length === 1
                    ? 0
                    : i/(points.length-1)
            );

    const y =
        value =>
            h-pad.b -
            (h-pad.t-pad.b) *
            value/max;

    if(mode === "histogram"){

        const barWidth =
            Math.max(
                2,
                (w-pad.l-pad.r) /
                Math.max(points.length,1) *
                .65
            );

        ctx.fillStyle="#7057e8";

        points.forEach(
            (point,i)=>{

                const yy =
                    y(point.histogram);

                ctx.fillRect(
                    x(i)-barWidth/2,
                    yy,
                    barWidth,
                    h-pad.b-yy
                );
            }
        );

    }else{

        drawLine(
            ctx,
            points.map(p=>p.planned),
            x,
            y,
            "#3478c9"
        );

        drawLine(
            ctx,
            points.map(p=>p.actual),
            x,
            y,
            "#24985a"
        );

        drawLine(
            ctx,
            points.map(p=>p.forecast),
            x,
            y,
            "#7057e8"
        );

        ctx.font="7px sans-serif";

        [
            ["Planned","#3478c9"],
            ["Actual","#24985a"],
            ["Forecast","#7057e8"]
        ].forEach(
            (legend,i)=>{

                ctx.fillStyle =
                    legend[1];

                ctx.fillRect(
                    pad.l + i*85,
                    4,
                    12,
                    3
                );

                ctx.fillStyle="#666";

                ctx.fillText(
                    legend[0],
                    pad.l+15+i*85,
                    8
                );
            }
        );
    }

    ctx.fillStyle="#888";
    ctx.font="6px sans-serif";

    points.forEach(
        (p,i)=>{

            if(
                i === 0 ||
                i === points.length-1 ||
                i % Math.ceil(points.length/8) === 0
            ){

                ctx.fillText(
                    p.date.toLocaleDateString(
                        undefined,
                        {
                            month:"short",
                            year:"2-digit"
                        }
                    ),
                    x(i)-12,
                    h-9
                );
            }
        }
    );
}

function drawLine(
    ctx,
    values,
    x,
    y,
    color
){

    ctx.beginPath();

    values.forEach(
        (value,i)=>{

            const xx=x(i);
            const yy=y(value);

            if(i===0)
                ctx.moveTo(xx,yy);
            else
                ctx.lineTo(xx,yy);
        }
    );

    ctx.strokeStyle=color;
    ctx.lineWidth=2;
    ctx.stroke();
}

function toggleChartMode(button,mode){

    const buttons =
        button
            .parentElement
            .querySelectorAll(
                ".chart-control"
            );

    buttons.forEach(
        b=>b.classList.remove("active")
    );

    button.classList.add("active");

    const canvas =
        button
            .closest(".panel")
            .querySelector("canvas");

    if(!canvas)
        return;

    const active =
        getActiveSchedules();

    const points =
        buildTimeSeries(
            active.flatMap(
                s=>s.activities
            )
        );

    drawSCurve(
        canvas.id,
        points,
        mode
    );
}

function buildCostReport(schedules){

    const a =
        schedules.flatMap(
            s=>s.activities
        );

    const budget =
        a.reduce(
            (n,x)=>n+(x.budget||0),
            0
        );

    const actual =
        a.reduce(
            (n,x)=>n+(x.actualCost||0),
            0
        );

    const forecast =
        a.reduce(
            (n,x)=>n+(x.forecastCost||0),
            0
        );

    const variance =
        forecast-budget;

    const progress =
        weightedProgress(a);

    const earned =
        budget *
        progress/100;

    const costVariance =
        earned-actual;

    return {
        id:"cost",
        title:"Cost report",
        subtitle:
            "Budget, actual cost, earned-value indicators and forecast",
        html:`

            <div class="metrics">

                ${metric(
                    "Budget",
                    currency(budget),
                    "Parsed budget",
                    "blue"
                )}

                ${metric(
                    "Actual",
                    currency(actual),
                    "Parsed actual cost",
                    "blue"
                )}

                ${metric(
                    "Forecast",
                    currency(forecast),
                    "Schedule forecast",
                    forecast>budget ? "danger":"good"
                )}

                ${metric(
                    "Variance",
                    currency(variance),
                    variance>0 ? "Forecast over budget":"Forecast under budget",
                    variance>0 ? "danger":"good"
                )}

                ${metric(
                    "CPI",
                    actual > 0
                        ? (earned/actual).toFixed(2)
                        : "—",
                    "Indicative CPI",
                    actual>earned ? "warning":"good"
                )}

            </div>

            <div class="grid2">

                <div class="panel">

                    <div class="panel-title">
                        Cost position
                    </div>

                    <table>

                        <tr>
                            <td>Budget</td>
                            <td><strong>${currency(budget)}</strong></td>
                        </tr>

                        <tr>
                            <td>Earned value</td>
                            <td><strong>${currency(earned)}</strong></td>
                        </tr>

                        <tr>
                            <td>Actual cost</td>
                            <td><strong>${currency(actual)}</strong></td>
                        </tr>

                        <tr>
                            <td>Cost variance</td>
                            <td>
                                <strong class="${
                                    costVariance < 0
                                        ? "status-danger"
                                        : "status-good"
                                }">
                                    ${currency(costVariance)}
                                </strong>
                            </td>
                        </tr>

                    </table>

                </div>

                <div class="panel">

                    <div class="panel-title">
                        Interpretation
                    </div>

                    <div style="
                        font-size:7px;
                        line-height:1.6;
                        color:#666;
                    ">
                        The cost report uses cost values embedded
                        in the uploaded schedule where available.
                        If the schedule does not contain actual
                        cost or resource-cost information, the
                        resulting cost analysis will be incomplete.
                    </div>

                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Highest forecast-cost activities
                </div>

                ${costTable(
                    a
                        .slice()
                        .sort(
                            (x,y)=>
                                (y.forecastCost||0) -
                                (x.forecastCost||0)
                        )
                        .slice(0,30)
                )}

            </div>
        `,
        text:
            `Cost Report\n\n` +
            `Budget: ${budget}\n` +
            `Actual: ${actual}\n` +
            `Forecast: ${forecast}\n` +
            `Variance: ${variance}\n`
    };
}

async function setComparisonSchedule(
    scheduleId,
    comparisonId
){

    state.comparisonScheduleBySchedule[
        scheduleId
    ] =
        comparisonId ||
        "";

    delete ensureReportStore(
        scheduleId
    ).comparison;

    const result =
        await buildReport(
            "comparison",
            scheduleId,
            {
                render:
                    getActiveSchedule()?.id ===
                    scheduleId
            }
        );

    if(
        getActiveSchedule()?.id ===
        scheduleId
    ){

        renderReport(
            result
        );
    }

    scheduleSave();
}

function buildComparisonReport(
    schedules
){

    const current =
        schedules[0];

    const comparisonId =
        state.comparisonScheduleBySchedule[
            current.id
        ] ||
        "";

    const comparisonSchedule =
        getScheduleById(
            comparisonId
        );

    const otherSchedules =
        state.schedules.filter(
            schedule =>
                schedule.id !==
                current.id
        );

    const selector = `
        <div class="report-parameter-panel">

            <div class="panel-title">
                Comparison schedule
            </div>

            <div class="panel-subtitle">
                The active schedule remains the current/update schedule. Select one other uploaded schedule as the baseline or comparison schedule.
            </div>

            <div class="report-control-grid">

                <label class="report-control">
                    Compare active schedule against
                    <select
                        id="comparisonScheduleSelect"
                        onchange="setComparisonSchedule('${current.id}',this.value)"
                    >
                        <option value="">
                            Select another schedule...
                        </option>

                        ${otherSchedules
                            .map(
                                schedule=>`
                                    <option
                                        value="${schedule.id}"
                                        ${comparisonId===schedule.id ? "selected":""}
                                    >
                                        ${escapeHTML(schedule.name)}
                                    </option>
                                `
                            )
                            .join("")}
                    </select>
                </label>

            </div>

        </div>
    `;

    if(!comparisonSchedule){

        return {
            id:"comparison",
            title:"Schedule comparison",
            subtitle:
                "Select another schedule to begin the detailed comparison",
            html:
                selector +
                `
                    <div class="panel">
                        <div class="panel-title">
                            Comparison required
                        </div>
                        <div style="font-size:8px;line-height:1.6;color:var(--muted)">
                            This report deliberately does not compare the active schedule against itself. Upload or select another XER/XML schedule above. Once selected, the analysis is rebuilt activity-by-activity, relationship-by-relationship and WBS-by-WBS.
                        </div>
                    </div>
                `,
            text:
                "Schedule comparison requires another uploaded schedule to be selected."
        };
    }

    const comparison =
        compareScheduleNetworks(
            current,
            comparisonSchedule
        );

    const currentCritical =
        analyseCriticalPath(
            current
        );

    const baselineCritical =
        analyseCriticalPath(
            comparisonSchedule
        );

    const changed =
        comparison.activityChanges
            .filter(
                item =>
                    item.status !==
                    "Unchanged"
            );

    const newActivities =
        comparison.activityChanges
            .filter(
                item =>
                    item.status ===
                    "New"
            );

    const deletedActivities =
        comparison.activityChanges
            .filter(
                item =>
                    item.status ===
                    "Deleted"
            );

    const delayed =
        comparison.activityChanges
            .filter(
                item =>
                    Number(
                        item.finishVariance
                    ) > 0
            )
            .sort(
                (a,b)=>
                    Number(
                        b.finishVariance
                    ) -
                    Number(
                        a.finishVariance
                    )
            );

    const currentFinish =
        latestDate(
            current.activities.map(
                activity =>
                    activity.finish
            )
        );

    const baselineFinish =
        latestDate(
            comparisonSchedule.activities.map(
                activity =>
                    activity.finish
            )
        );

    const projectFinishVariance =
        currentFinish &&
        baselineFinish
            ? daysBetween(
                baselineFinish,
                currentFinish
            )
            : 0;

    return {
        id:"comparison",
        title:"Schedule comparison",
        subtitle:
            `${current.name} compared with ${comparisonSchedule.name}`,
        html:`

            ${selector}

            <div class="metrics">

                ${metric(
                    "Project finish Δ",
                    `${projectFinishVariance} d`,
                    `${formatDate(baselineFinish)} → ${formatDate(currentFinish)}`,
                    projectFinishVariance > 0
                        ? "danger"
                        : projectFinishVariance < 0
                            ? "good"
                            : "blue"
                )}

                ${metric(
                    "Changed activities",
                    changed.length,
                    "New, deleted or changed",
                    changed.length ? "warning":"good"
                )}

                ${metric(
                    "New / deleted",
                    `${newActivities.length} / ${deletedActivities.length}`,
                    "Scope movement",
                    newActivities.length || deletedActivities.length
                        ? "warning"
                        : "good"
                )}

                ${metric(
                    "Link changes",
                    comparison.linkAdded.length +
                    comparison.linkRemoved.length,
                    `${comparison.linkAdded.length} added · ${comparison.linkRemoved.length} removed`,
                    comparison.linkAdded.length || comparison.linkRemoved.length
                        ? "danger"
                        : "good"
                )}

                ${metric(
                    "Critical count Δ",
                    currentCritical.criticalActivities.length -
                    baselineCritical.criticalActivities.length,
                    `${baselineCritical.criticalActivities.length} → ${currentCritical.criticalActivities.length}`,
                    "warning"
                )}

            </div>

            <div class="panel">

                <div class="panel-title">
                    Activity-by-activity comparison
                </div>

                <div class="panel-subtitle">
                    Activities are matched by activity ID. New and deleted IDs are shown explicitly; matched activities are tested for date, duration, float, progress, calendar, WBS, area and logic changes.
                </div>

                <table>

                    <thead>
                        <tr>
                            <th>Activity ID</th>
                            <th>Status</th>
                            <th>Activity</th>
                            <th>WBS</th>
                            <th>Baseline start</th>
                            <th>Current start</th>
                            <th>Start Δ</th>
                            <th>Baseline finish</th>
                            <th>Current finish</th>
                            <th>Finish Δ</th>
                            <th>Duration Δ</th>
                            <th>Float Δ</th>
                            <th>Progress</th>
                            <th>Calendar / WBS / area</th>
                            <th>Logic changes</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${comparison.activityChanges
                            .slice(0,600)
                            .map(
                                item=>{

                                    const activity =
                                        item.current ||
                                        item.baseline;

                                    return `
                                        <tr>
                                            <td class="activity-id">${escapeHTML(item.id)}</td>
                                            <td>
                                                <span class="pill ${
                                                    item.status==="Unchanged"
                                                        ? "good"
                                                        : item.status==="Changed"
                                                            ? "warning"
                                                            : "danger"
                                                }">
                                                    ${escapeHTML(item.status)}
                                                </span>
                                            </td>
                                            <td>${escapeHTML(activity?.name || "—")}</td>
                                            <td>${escapeHTML(activity?.wbsPath || activity?.wbs || "—")}</td>
                                            <td>${formatDate(item.baseline?.start)}</td>
                                            <td>${formatDate(item.current?.start)}</td>
                                            <td>${item.startVariance===null ? "—":`${item.startVariance} d`}</td>
                                            <td>${formatDate(item.baseline?.finish)}</td>
                                            <td>${formatDate(item.current?.finish)}</td>
                                            <td class="${Number(item.finishVariance)>0 ? "status-danger":Number(item.finishVariance)<0 ? "status-good":""}">
                                                ${item.finishVariance===null ? "—":`${item.finishVariance} d`}
                                            </td>
                                            <td>${item.durationVariance===null ? "—":`${formatNumber(item.durationVariance)} d`}</td>
                                            <td>${item.floatVariance===null ? "—":`${formatNumber(item.floatVariance)} d`}</td>
                                            <td>
                                                ${item.baseline ? formatPercent(item.baseline.percent):"—"}
                                                →
                                                ${item.current ? formatPercent(item.current.percent):"—"}
                                            </td>
                                            <td>
                                                ${item.calendarChanged ? "Calendar; ":""}
                                                ${item.wbsChanged ? "WBS; ":""}
                                                ${item.areaChanged ? "Area; ":""}
                                                ${!item.calendarChanged&&!item.wbsChanged&&!item.areaChanged ? "—":""}
                                            </td>
                                            <td>
                                                +Pred ${item.predecessorAdded.length};
                                                −Pred ${item.predecessorRemoved.length};
                                                +Succ ${item.successorAdded.length};
                                                −Succ ${item.successorRemoved.length}
                                            </td>
                                        </tr>
                                    `;
                                }
                            )
                            .join("")}

                    </tbody>

                </table>

            </div>

            <div class="panel">

                <div class="panel-title">
                    WBS-by-WBS comparison
                </div>

                <table>

                    <thead>
                        <tr>
                            <th>WBS</th>
                            <th>Total IDs</th>
                            <th>Changed</th>
                            <th>New</th>
                            <th>Deleted</th>
                            <th>Delayed finishes</th>
                            <th>Maximum finish delay</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${comparison.wbsSummary
                            .map(
                                group=>`
                                    <tr>
                                        <td>${escapeHTML(group.wbs)}</td>
                                        <td>${group.total}</td>
                                        <td>${group.changedCount}</td>
                                        <td>${group.newCount}</td>
                                        <td>${group.deletedCount}</td>
                                        <td>${group.delayedCount}</td>
                                        <td>${group.maxFinishDelay} d</td>
                                    </tr>
                                `
                            )
                            .join("")}

                    </tbody>

                </table>

            </div>

            <div class="grid2">

                <div class="panel">

                    <div class="panel-title">
                        Relationship changes
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Change</th>
                                <th>Predecessor</th>
                                <th>Successor</th>
                                <th>Type</th>
                                <th>Lag</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${comparison.linkAdded
                                .slice(0,150)
                                .map(
                                    link=>`
                                        <tr>
                                            <td><span class="pill warning">ADDED</span></td>
                                            <td class="activity-id">${escapeHTML(link.predecessor)}</td>
                                            <td class="activity-id">${escapeHTML(link.successor)}</td>
                                            <td>${escapeHTML(link.type)}</td>
                                            <td>${formatNumber(link.lag)} d</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                            ${comparison.linkRemoved
                                .slice(0,150)
                                .map(
                                    link=>`
                                        <tr>
                                            <td><span class="pill danger">REMOVED</span></td>
                                            <td class="activity-id">${escapeHTML(link.predecessor)}</td>
                                            <td class="activity-id">${escapeHTML(link.successor)}</td>
                                            <td>${escapeHTML(link.type)}</td>
                                            <td>${formatNumber(link.lag)} d</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

                <div class="panel">

                    <div class="panel-title">
                        Largest finish movements
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Activity</th>
                                <th>WBS</th>
                                <th>Finish Δ</th>
                                <th>Float Δ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${delayed
                                .slice(0,100)
                                .map(
                                    item=>`
                                        <tr>
                                            <td class="activity-id">${escapeHTML(item.id)}</td>
                                            <td>${escapeHTML(item.current?.name || item.baseline?.name || "—")}</td>
                                            <td>${escapeHTML(item.current?.wbsPath || item.baseline?.wbsPath || "—")}</td>
                                            <td class="status-danger">${item.finishVariance} d</td>
                                            <td>${formatNumber(item.floatVariance)} d</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Critical-path comparison
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Measure</th>
                            <th>Comparison / baseline</th>
                            <th>Active / current</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Critical activities</td>
                            <td>${baselineCritical.criticalActivities.length}</td>
                            <td>${currentCritical.criticalActivities.length}</td>
                        </tr>
                        <tr>
                            <td>Critical relationships</td>
                            <td>${baselineCritical.criticalRelationships.length}</td>
                            <td>${currentCritical.criticalRelationships.length}</td>
                        </tr>
                        <tr>
                            <td>Near-critical activities</td>
                            <td>${baselineCritical.nearCritical.length}</td>
                            <td>${currentCritical.nearCritical.length}</td>
                        </tr>
                        <tr>
                            <td>Forecast finish</td>
                            <td>${formatDate(baselineFinish)}</td>
                            <td>${formatDate(currentFinish)}</td>
                        </tr>
                    </tbody>
                </table>

            </div>

        `,
        text:
            `Schedule Comparison\n\n` +
            `Current: ${current.name}\n` +
            `Comparison: ${comparisonSchedule.name}\n` +
            `Project finish variance: ${projectFinishVariance} days\n` +
            `Changed activities: ${changed.length}\n` +
            `New activities: ${newActivities.length}\n` +
            `Deleted activities: ${deletedActivities.length}\n` +
            `Added relationships: ${comparison.linkAdded.length}\n` +
            `Removed relationships: ${comparison.linkRemoved.length}\n\n` +
            comparison.activityChanges
                .filter(
                    item =>
                        item.status !==
                        "Unchanged"
                )
                .map(
                    item=>
                        `${item.id} | ${item.status} | finish Δ ${item.finishVariance ?? "—"} d | duration Δ ${item.durationVariance ?? "—"} d | float Δ ${item.floatVariance ?? "—"} d`
                )
                .join("\n")
    };
}

async function setWeekComparisonSchedule(scheduleId,comparisonId){

    state.weekComparisonBySchedule[scheduleId] = comparisonId || "";

    delete ensureReportStore(scheduleId).week;

    const result = await buildReport(
        "week",
        scheduleId,
        {render:getActiveSchedule()?.id === scheduleId}
    );

    if(getActiveSchedule()?.id === scheduleId){
        renderReport(result);
    }

    scheduleSave();
}

function traceDownstreamActivityIds(schedule,startId){
    const byId = new Map((schedule.activities || []).map(a=>[String(a.id),a]));
    const seen = new Set();
    const queue = [String(startId)];

    while(queue.length){
        const id = queue.shift();
        const activity = byId.get(id);
        if(!activity) continue;
        (activity.successors || []).forEach(next=>{
            const key=String(next);
            if(!seen.has(key)){
                seen.add(key);
                queue.push(key);
            }
        });
    }

    seen.delete(String(startId));
    return seen;
}

function weekImpactScreen(change,currentSchedule,changeById){
    if(!change.current || Number(change.finishVariance || 0) <= 0){
        return {screenedImpact:0,downstreamDelayed:0,maxDownstreamDelay:0};
    }

    const currentFloat = Number(change.current.totalFloat || 0);
    const finishDelay = Number(change.finishVariance || 0);

    const screenedImpact = Math.max(0, finishDelay - Math.max(0,currentFloat));
    const downstream = traceDownstreamActivityIds(currentSchedule,change.id);
    let downstreamDelayed=0;
    let maxDownstreamDelay=0;

    downstream.forEach(id=>{
        const item=changeById.get(String(id));
        const delay=Number(item?.finishVariance || 0);
        if(delay>0){
            downstreamDelayed++;
            maxDownstreamDelay=Math.max(maxDownstreamDelay,delay);
        }
    });

    return {screenedImpact,downstreamDelayed,maxDownstreamDelay};
}

function buildWeekOnWeekReport(schedules){

    const current = schedules[0];
    const comparisonId = state.weekComparisonBySchedule[current.id] || "";
    const previous = getScheduleById(comparisonId);
    const otherSchedules = state.schedules.filter(s=>s.id !== current.id);

    const selector = `
        <div class="report-parameter-panel">
            <div class="panel-title">Previous-week schedule</div>
            <div class="panel-subtitle">
                The active schedule is treated as this week's update. Select the previous week's XER/XML update to measure progress achieved, activity movement and downstream schedule impact.
            </div>
            <div class="report-control-grid">
                <label class="report-control">
                    Compare this week against
                    <select id="weekComparisonScheduleSelect" onchange="setWeekComparisonSchedule('${current.id}',this.value)">
                        <option value="">Select previous week...</option>
                        ${otherSchedules.map(schedule=>`
                            <option value="${schedule.id}" ${comparisonId===schedule.id ? "selected":""}>
                                ${escapeHTML(schedule.name)}${schedule.statusDate ? ` · DD ${formatDate(schedule.statusDate)}` : ""}
                            </option>
                        `).join("")}
                    </select>
                </label>
            </div>
        </div>
    `;

    if(!previous){
        return {
            id:"week",
            title:"Week on Week",
            subtitle:"Select the previous weekly update to begin",
            html:selector+`
                <div class="panel">
                    <div class="panel-title">Previous update required</div>
                    <div style="font-size:8px;line-height:1.65;color:var(--muted)">
                        Upload both weekly schedule updates, keep this week's schedule active, then select last week's schedule above. Activities are matched by Activity ID.
                    </div>
                </div>
            `,
            text:"Week on Week requires a previous weekly schedule to be selected."
        };
    }

    const comparison = compareScheduleNetworks(current,previous);
    const changeById = new Map(comparison.activityChanges.map(c=>[String(c.id),c]));

    const currentFinish = latestDate((current.activities || []).map(a=>a.finish));
    const previousFinish = latestDate((previous.activities || []).map(a=>a.finish));
    const projectFinishVariance = currentFinish && previousFinish ? daysBetween(previousFinish,currentFinish) : 0;

    const rows = comparison.activityChanges.map(change=>{
        const c=change.current;
        const p=change.baseline;
        const currentPct=Number(c?.percent || 0);
        const previousPct=Number(p?.percent || 0);
        const progressDelta=c && p ? currentPct-previousPct : 0;
        const newActualStart=Boolean(c?.actualStart && !p?.actualStart);
        const newActualFinish=Boolean(c?.actualFinish && !p?.actualFinish);
        const previousRemaining=Number(p?.remainingDuration ?? p?.duration ?? 0);
        const currentRemaining=Number(c?.remainingDuration ?? c?.duration ?? 0);
        const remainingBurn=c && p ? previousRemaining-currentRemaining : 0;
        const progressed=change.status!=="Deleted" && (
            progressDelta>0.0001 || newActualStart || newActualFinish || remainingBurn>0.0001
        );
        const impact=weekImpactScreen(change,current,changeById);
        return {...change,progressDelta,newActualStart,newActualFinish,remainingBurn,progressed,...impact};
    });

    const progressed = rows.filter(r=>r.progressed).sort((a,b)=>b.progressDelta-a.progressDelta || b.remainingBurn-a.remainingBurn);
    const delayed = rows.filter(r=>Number(r.finishVariance||0)>0).sort((a,b)=>Number(b.finishVariance||0)-Number(a.finishVariance||0));
    const recovered = rows.filter(r=>Number(r.finishVariance||0)<0).sort((a,b)=>Number(a.finishVariance||0)-Number(b.finishVariance||0));
    const criticalDelayed = delayed.filter(r=>r.current && (r.current.critical || Number(r.current.totalFloat||0)<=0));
    const newStarts = rows.filter(r=>r.newActualStart).length;
    const newFinishes = rows.filter(r=>r.newActualFinish).length;
    const totalProgressPoints = progressed.reduce((sum,r)=>sum+Math.max(0,r.progressDelta),0);

    const impactRows = delayed.map((r,index)=>{
        const a=r.current || r.baseline;
        const finishDelay=Number(r.finishVariance||0);
        const impactClass=r.screenedImpact>0 ? "status-danger" : finishDelay>0 ? "status-warning" : "";
        return `
            <tr>
                <td>${index+1}</td>
                <td class="activity-id">${escapeHTML(r.id)}</td>
                <td>${escapeHTML(a?.name || "")}</td>
                <td>${escapeHTML(a?.wbsPath || a?.wbsName || "—")}</td>
                <td>${formatDate(r.baseline?.finish)}</td>
                <td>${formatDate(r.current?.finish)}</td>
                <td class="status-danger">+${finishDelay} d</td>
                <td class="status-danger">+${(finishDelay/7).toFixed(1)} wk</td>
                <td>${r.floatVariance===null ? "—" : `${formatNumber(r.floatVariance)} d`}</td>
                <td>${r.current?.critical || Number(r.current?.totalFloat||0)<=0 ? "Critical" : `${formatNumber(r.current?.totalFloat)} d TF`}</td>
                <td>${r.downstreamDelayed}</td>
                <td class="${impactClass}">${r.screenedImpact>0 ? `≈ ${formatNumber(r.screenedImpact)} d` : "Float/path absorbed"}</td>
            </tr>
        `;
    }).join("");

    const progressRows = progressed.map((r,index)=>{
        const a=r.current || r.baseline;
        const changes=[];
        if(r.progressDelta>0) changes.push(`+${formatNumber(r.progressDelta)} pp`);
        if(r.newActualStart) changes.push("Actual start");
        if(r.newActualFinish) changes.push("Actual finish");
        if(r.remainingBurn>0) changes.push(`${formatNumber(r.remainingBurn)} d remaining burned`);
        return `
            <tr>
                <td>${index+1}</td>
                <td class="activity-id">${escapeHTML(r.id)}</td>
                <td>${escapeHTML(a?.name || "")}</td>
                <td>${escapeHTML(a?.wbsPath || a?.wbsName || "—")}</td>
                <td>${formatPercent(r.baseline?.percent || 0)}</td>
                <td>${formatPercent(r.current?.percent || 0)}</td>
                <td><span class="wow-progress-chip">${changes.join(" · ") || "Progressed"}</span></td>
                <td>${r.startVariance===null ? "—" : `${r.startVariance>0?"+":""}${r.startVariance} d`}</td>
                <td class="${Number(r.finishVariance)>0 ? "status-danger":Number(r.finishVariance)<0 ? "status-good":""}">${r.finishVariance===null ? "—" : `${r.finishVariance>0?"+":""}${r.finishVariance} d`}</td>
            </tr>
        `;
    }).join("");

    const recoveredRows = recovered.slice(0,50).map(r=>{
        const a=r.current || r.baseline;
        return `<tr><td class="activity-id">${escapeHTML(r.id)}</td><td>${escapeHTML(a?.name || "")}</td><td>${escapeHTML(a?.wbsPath || "—")}</td><td class="status-good">${r.finishVariance} d</td><td>${formatNumber(r.floatVariance)} d</td></tr>`;
    }).join("");

    return {
        id:"week",
        title:"Week on Week",
        subtitle:`${current.name} versus ${previous.name}`,
        html:`
            ${selector}
            <div class="metrics">
                ${metric("Progressed activities",progressed.length,`${newStarts} new starts · ${newFinishes} new finishes`,progressed.length?"good":"blue")}
                ${metric("Finish pushed out",delayed.length,`${criticalDelayed.length} critical / zero-float`,delayed.length?"danger":"good")}
                ${metric("Project finish Δ",`${projectFinishVariance>0?"+":""}${projectFinishVariance} d`,`${formatDate(previousFinish)} → ${formatDate(currentFinish)}`,projectFinishVariance>0?"danger":projectFinishVariance<0?"good":"blue")}
                ${metric("Progress gain",`${formatNumber(totalProgressPoints)} pp`,`Sum of activity % complete movement`,"good")}
                ${metric("Recovered activities",recovered.length,"Finish dates moved earlier",recovered.length?"good":"blue")}
            </div>

            <div class="grid2">
                <div class="panel">
                    <div class="panel-title">Update context</div>
                    <table>
                        <tr><td>Previous update</td><td><strong>${escapeHTML(previous.name)}</strong></td></tr>
                        <tr><td>Previous data date</td><td>${formatDate(previous.statusDate)}</td></tr>
                        <tr><td>Current update</td><td><strong>${escapeHTML(current.name)}</strong></td></tr>
                        <tr><td>Current data date</td><td>${formatDate(current.statusDate)}</td></tr>
                        <tr><td>Project finish movement</td><td class="${projectFinishVariance>0?"status-danger":projectFinishVariance<0?"status-good":""}">${projectFinishVariance>0?"+":""}${projectFinishVariance} d</td></tr>
                    </table>
                </div>
                <div class="panel">
                    <div class="panel-title">Weekly movement summary</div>
                    <table>
                        <tr><td>Activities with progress</td><td><strong>${progressed.length}</strong></td></tr>
                        <tr><td>New actual starts</td><td><strong>${newStarts}</strong></td></tr>
                        <tr><td>New actual finishes</td><td><strong>${newFinishes}</strong></td></tr>
                        <tr><td>Activities pushed later</td><td><strong>${delayed.length}</strong></td></tr>
                        <tr><td>Critical activities pushed later</td><td><strong>${criticalDelayed.length}</strong></td></tr>
                    </table>
                </div>
            </div>

            <div class="panel">
                <div class="panel-title">Progress achieved this week</div>
                <div class="panel-subtitle">Activities with increased % complete, a new actual start/finish, or reduction in remaining duration.</div>
                <div style="overflow:auto;max-height:430px">
                    <table class="wow-table">
                        <thead><tr><th>#</th><th>ID</th><th>Activity</th><th>WBS</th><th>Last week</th><th>This week</th><th>Progress movement</th><th>Start Δ</th><th>Finish Δ</th></tr></thead>
                        <tbody>${progressRows || `<tr><td colspan="9">No progressed activities detected between these two updates.</td></tr>`}</tbody>
                    </table>
                </div>
            </div>

            <div class="panel">
                <div class="panel-title">Activity finish push-out and impact</div>
                <div class="panel-subtitle">Positive finish variance means this week's forecast is later. Screened impact estimates delay beyond available positive total float; it is a schedule-risk indicator, not a contractual delay finding.</div>
                <div style="overflow:auto;max-height:520px">
                    <table class="wow-table">
                        <thead><tr><th>#</th><th>ID</th><th>Activity</th><th>WBS</th><th>Last finish</th><th>This finish</th><th>Push-out</th><th>Weeks</th><th>Float Δ</th><th>Current path status</th><th>Delayed successors</th><th>Screened impact</th></tr></thead>
                        <tbody>${impactRows || `<tr><td colspan="12">No activities moved later between these updates.</td></tr>`}</tbody>
                    </table>
                </div>
            </div>

            <div class="panel">
                <div class="panel-title">Recovered / pulled-forward activities</div>
                <div style="overflow:auto;max-height:300px">
                    <table class="wow-table">
                        <thead><tr><th>ID</th><th>Activity</th><th>WBS</th><th>Finish improvement</th><th>Float Δ</th></tr></thead>
                        <tbody>${recoveredRows || `<tr><td colspan="5">No activities moved earlier.</td></tr>`}</tbody>
                    </table>
                </div>
            </div>
        `,
        text:
            `Week on Week Report\n\nCurrent: ${current.name}\nPrevious: ${previous.name}\n`+
            `Current data date: ${formatDate(current.statusDate)}\nPrevious data date: ${formatDate(previous.statusDate)}\n`+
            `Project finish movement: ${projectFinishVariance} d\nProgressed activities: ${progressed.length}\n`+
            `Activities pushed later: ${delayed.length}\nCritical delayed: ${criticalDelayed.length}\nNew starts: ${newStarts}\nNew finishes: ${newFinishes}\n\n`+
            delayed.slice(0,100).map(r=>`${r.id} | finish Δ +${r.finishVariance} d | ${(Number(r.finishVariance||0)/7).toFixed(1)} wk | screened impact ${formatNumber(r.screenedImpact)} d`).join("\n")
    };
}

async function setDelayBaseline(
    scheduleId,
    baselineId
){

    state.delayBaselineBySchedule[
        scheduleId
    ] =
        baselineId ||
        "";

    delete ensureReportStore(
        scheduleId
    ).delay;

    const result =
        await buildReport(
            "delay",
            scheduleId,
            {
                render:
                    getActiveSchedule()?.id ===
                    scheduleId
            }
        );

    if(
        getActiveSchedule()?.id ===
        scheduleId
    ){

        renderReport(
            result
        );
    }

    scheduleSave();
}

function rangesOverlap(
    startA,
    finishA,
    startB,
    finishB
){

    if(
        !startA ||
        !finishA ||
        !startB ||
        !finishB
    ){
        return false;
    }

    const a1 =
        new Date(
            startA
        ).getTime();

    const a2 =
        new Date(
            finishA
        ).getTime();

    const b1 =
        new Date(
            startB
        ).getTime();

    const b2 =
        new Date(
            finishB
        ).getTime();

    return (
        a1 <= b2 &&
        b1 <= a2
    );
}

function buildDelayForensics(
    current,
    baseline
){

    const comparison =
        compareScheduleNetworks(
            current,
            baseline
        );

    const drivers =
        comparison.activityChanges
            .filter(
                change =>
                    change.current &&
                    change.baseline
            )
            .map(
                change=>{

                    const currentActivity =
                        change.current;

                    const baselineActivity =
                        change.baseline;

                    const finishDelay =
                        Math.max(
                            0,
                            Number(
                                change.finishVariance ||
                                0
                            )
                        );

                    const startDelay =
                        baselineActivity.start &&
                        currentActivity.start
                            ? Math.max(
                                0,
                                daysBetween(
                                    baselineActivity.start,
                                    currentActivity.start
                                )
                            )
                            : 0;

                    const durationGrowth =
                        Math.max(
                            0,
                            Number(
                                change.durationVariance ||
                                0
                            )
                        );

                    const baselineFloat =
                        Math.max(
                            0,
                            Number(
                                baselineActivity.totalFloat ||
                                0
                            )
                        );

                    const tiaImpact =
                        Math.max(
                            0,
                            finishDelay -
                            baselineFloat
                        );

                    const currentCritical =
                        currentActivity.critical ||
                        currentActivity.totalFloat <= 10;

                    const causes = [];

                    if(startDelay > 0){
                        causes.push(
                            `late start ${startDelay}d`
                        );
                    }

                    if(durationGrowth > 0){
                        causes.push(
                            `duration growth ${formatNumber(durationGrowth)}d`
                        );
                    }

                    if(
                        change.predecessorAdded.length ||
                        change.predecessorRemoved.length ||
                        change.successorAdded.length ||
                        change.successorRemoved.length
                    ){
                        causes.push(
                            "logic changed"
                        );
                    }

                    if(change.calendarChanged){
                        causes.push(
                            "calendar changed"
                        );
                    }

                    if(change.wbsChanged){
                        causes.push(
                            "WBS changed"
                        );
                    }

                    if(change.areaChanged){
                        causes.push(
                            "area changed"
                        );
                    }

                    if(
                        currentActivity.constraint &&
                        currentActivity.constraint !==
                        baselineActivity.constraint
                    ){
                        causes.push(
                            "constraint changed"
                        );
                    }

                    if(
                        Number(
                            currentActivity.percent ||
                            0
                        ) <
                        100 &&
                        finishDelay > 0
                    ){
                        causes.push(
                            "incomplete delayed work"
                        );
                    }

                    return {
                        change,
                        currentActivity,
                        baselineActivity,
                        finishDelay,
                        startDelay,
                        durationGrowth,
                        baselineFloat,
                        tiaImpact,
                        currentCritical,
                        causes,
                        concurrentWith:[]
                    };
                }
            )
            .filter(
                driver =>
                    driver.finishDelay > 0 ||
                    driver.startDelay > 0 ||
                    driver.durationGrowth > 0 ||
                    driver.causes.includes(
                        "logic changed"
                    ) ||
                    driver.causes.includes(
                        "calendar changed"
                    )
            );

    for(
        let i=0;
        i<drivers.length;
        i++
    ){

        for(
            let j=i+1;
            j<drivers.length;
            j++
        ){

            const a =
                drivers[i];

            const b =
                drivers[j];

            const overlap =
                rangesOverlap(
                    a.currentActivity.start ||
                    a.baselineActivity.start,
                    a.currentActivity.finish ||
                    a.baselineActivity.finish,
                    b.currentActivity.start ||
                    b.baselineActivity.start,
                    b.currentActivity.finish ||
                    b.baselineActivity.finish
                );

            if(
                overlap &&
                a.currentCritical &&
                b.currentCritical
            ){

                a.concurrentWith.push(
                    b.currentActivity.id
                );

                b.concurrentWith.push(
                    a.currentActivity.id
                );
            }
        }
    }

    const windows =
        new Map();

    drivers.forEach(
        driver=>{

            const date =
                driver.baselineActivity.finish ||
                driver.currentActivity.finish ||
                current.statusDate ||
                new Date().toISOString();

            const d =
                new Date(date);

            const key =
                Number.isNaN(
                    d.getTime()
                )
                    ? "Undated"
                    : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

            if(!windows.has(key)){

                windows.set(
                    key,
                    {
                        key,
                        drivers:[],
                        maxFinishDelay:0,
                        maxTIAImpact:0,
                        criticalDrivers:0
                    }
                );
            }

            const window =
                windows.get(
                    key
                );

            window.drivers.push(
                driver
            );

            window.maxFinishDelay =
                Math.max(
                    window.maxFinishDelay,
                    driver.finishDelay
                );

            window.maxTIAImpact =
                Math.max(
                    window.maxTIAImpact,
                    driver.tiaImpact
                );

            if(
                driver.currentCritical
            ){
                window.criticalDrivers++;
            }
        }
    );

    const currentFinish =
        latestDate(
            current.activities.map(
                activity=>activity.finish
            )
        );

    const baselineFinish =
        latestDate(
            baseline.activities.map(
                activity=>activity.finish
            )
        );

    const projectDelay =
        currentFinish &&
        baselineFinish
            ? Math.max(
                0,
                daysBetween(
                    baselineFinish,
                    currentFinish
                )
            )
            : 0;

    const impactedAsPlanned =
        Math.max(
            0,
            ...drivers
                .filter(
                    driver =>
                        driver.currentCritical
                )
                .map(
                    driver =>
                        driver.finishDelay
                )
        );

    const timeImpactExposure =
        Math.max(
            0,
            ...drivers
                .filter(
                    driver =>
                        driver.currentCritical
                )
                .map(
                    driver =>
                        driver.tiaImpact
                )
        );

    const wbsMap =
        new Map();

    drivers.forEach(
        driver=>{

            const wbs =
                driver.currentActivity.wbsPath ||
                driver.baselineActivity.wbsPath ||
                "Unassigned";

            if(!wbsMap.has(wbs)){

                wbsMap.set(
                    wbs,
                    {
                        wbs,
                        drivers:0,
                        criticalDrivers:0,
                        maxDelay:0,
                        totalDelayExposure:0,
                        causes:new Map()
                    }
                );
            }

            const group =
                wbsMap.get(
                    wbs
                );

            group.drivers++;

            if(driver.currentCritical){
                group.criticalDrivers++;
            }

            group.maxDelay =
                Math.max(
                    group.maxDelay,
                    driver.finishDelay
                );

            group.totalDelayExposure +=
                driver.tiaImpact;

            driver.causes.forEach(
                cause=>{

                    const category =
                        cause
                            .replace(
                                /\s+\d+(\.\d+)?d$/,
                                ""
                            );

                    group.causes.set(
                        category,
                        (
                            group.causes.get(
                                category
                            ) ||
                            0
                        ) +
                        1
                    );
                }
            );
        }
    );

    return {
        comparison,
        drivers:
            drivers.sort(
                (a,b)=>
                    (
                        b.tiaImpact +
                        b.finishDelay
                    ) -
                    (
                        a.tiaImpact +
                        a.finishDelay
                    )
            ),
        windows:
            [...windows.values()]
                .sort(
                    (a,b)=>
                        String(a.key)
                            .localeCompare(
                                String(b.key)
                            )
                ),
        wbs:
            [...wbsMap.values()]
                .sort(
                    (a,b)=>
                        b.maxDelay -
                        a.maxDelay
                ),
        currentFinish,
        baselineFinish,
        projectDelay,
        impactedAsPlanned,
        timeImpactExposure
    };
}

function buildDelayReport(
    schedules
){

    const current =
        schedules[0];

    const baselineId =
        state.delayBaselineBySchedule[
            current.id
        ] ||
        "";

    const baseline =
        getScheduleById(
            baselineId
        );

    const otherSchedules =
        state.schedules.filter(
            schedule =>
                schedule.id !==
                current.id
        );

    const selector = `
        <div class="report-parameter-panel">

            <div class="panel-title">
                Delay-analysis baseline
            </div>

            <div class="panel-subtitle">
                A separate baseline or earlier update is mandatory. The active schedule is treated as the current/update schedule.
            </div>

            <div class="report-control-grid">

                <label class="report-control">
                    Baseline / earlier update
                    <select
                        id="delayBaselineSelect"
                        onchange="setDelayBaseline('${current.id}',this.value)"
                    >
                        <option value="">
                            Select baseline schedule...
                        </option>

                        ${otherSchedules
                            .map(
                                schedule=>`
                                    <option
                                        value="${schedule.id}"
                                        ${baselineId===schedule.id ? "selected":""}
                                    >
                                        ${escapeHTML(schedule.name)}
                                    </option>
                                `
                            )
                            .join("")}
                    </select>
                </label>

            </div>

        </div>
    `;

    if(!baseline){

        return {
            id:"delay",
            title:"Delay analysis",
            subtitle:
                "A baseline schedule must be selected before delay analysis can run",
            html:
                selector +
                `
                    <div class="panel">
                        <div class="panel-title">
                            Baseline required
                        </div>

                        <div style="font-size:8px;line-height:1.65;color:var(--muted)">
                            This report requires a separately uploaded baseline or earlier update. Once selected, the browser performs a multi-method schedule analysis comprising activity variance review, a time-impact screening, impacted-as-planned screening, time-slice/windows analysis, critical/near-critical driver review, concurrency screening and root-cause indicators. Responsibility and entitlement are not inferred from schedule data alone.
                        </div>
                    </div>
                `,
            text:
                "Delay analysis requires a baseline or earlier schedule to be selected."
        };
    }

    const analysis =
        buildDelayForensics(
            current,
            baseline
        );

    const concurrent =
        analysis.drivers.filter(
            driver =>
                driver.concurrentWith.length
        );

    return {
        id:"delay",
        title:"Delay analysis",
        subtitle:
            `Multi-method delay analysis: ${baseline.name} → ${current.name}`,
        html:`

            ${selector}

            <div class="metrics">

                ${metric(
                    "Project finish delay",
                    `${analysis.projectDelay} d`,
                    `${formatDate(analysis.baselineFinish)} → ${formatDate(analysis.currentFinish)}`,
                    analysis.projectDelay
                        ? "danger"
                        : "good"
                )}

                ${metric(
                    "TIA exposure",
                    `${formatNumber(analysis.timeImpactExposure)} d`,
                    "Float-adjusted critical-driver screening",
                    analysis.timeImpactExposure
                        ? "danger"
                        : "good"
                )}

                ${metric(
                    "Impacted as-planned",
                    `${formatNumber(analysis.impactedAsPlanned)} d`,
                    "Largest critical baseline-to-current movement",
                    analysis.impactedAsPlanned
                        ? "warning"
                        : "good"
                )}

                ${metric(
                    "Delay drivers",
                    analysis.drivers.length,
                    "Activity-level drivers",
                    analysis.drivers.length
                        ? "warning"
                        : "good"
                )}

                ${metric(
                    "Concurrent drivers",
                    concurrent.length,
                    "Overlapping critical / near-critical drivers",
                    concurrent.length
                        ? "warning"
                        : "good"
                )}

            </div>

            <div class="panel">

                <div class="panel-title">
                    Delay-method summary
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Method</th>
                            <th>Modelled result</th>
                            <th>How this browser analysis uses the method</th>
                            <th>Important limitation</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Baseline vs update</strong></td>
                            <td>${analysis.projectDelay} days project finish movement</td>
                            <td>Compares matched activity IDs, dates, durations, float, calendars, WBS and logic.</td>
                            <td>Schedule movement alone does not establish cause or responsibility.</td>
                        </tr>
                        <tr>
                            <td><strong>Time Impact Analysis screening</strong></td>
                            <td>${formatNumber(analysis.timeImpactExposure)} days maximum float-adjusted critical-driver exposure</td>
                            <td>For each delayed matched activity, positive finish movement is reduced by available baseline float and tested for current critical/near-critical status.</td>
                            <td>A formal TIA requires contemporaneous fragnet logic and an accepted unimpacted update immediately before the event.</td>
                        </tr>
                        <tr>
                            <td><strong>Impacted As-Planned screening</strong></td>
                            <td>${formatNumber(analysis.impactedAsPlanned)} days largest critical activity movement</td>
                            <td>Uses the baseline network as the reference and identifies critical activity movements that would expose planned completion.</td>
                            <td>This is not a substitute for inserting event fragnets into the accepted baseline.</td>
                        </tr>
                        <tr>
                            <td><strong>Windows / time-slice analysis</strong></td>
                            <td>${analysis.windows.length} analysis windows</td>
                            <td>Groups delay drivers by baseline finish period and identifies dominant critical drivers and movement in each period.</td>
                            <td>Formal windows analysis should use successive accepted updates and contemporaneous data dates.</td>
                        </tr>
                        <tr>
                            <td><strong>Concurrency screening</strong></td>
                            <td>${concurrent.length} drivers overlap another critical/near-critical driver</td>
                            <td>Flags overlapping work windows where more than one critical/near-critical delayed activity exists.</td>
                            <td>True legal/contractual concurrency depends on causation, responsibility and the governing contract/law.</td>
                        </tr>
                    </tbody>
                </table>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Activity-by-activity delay drivers
                </div>

                <table>

                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Activity</th>
                            <th>WBS</th>
                            <th>Baseline start</th>
                            <th>Current start</th>
                            <th>Start delay</th>
                            <th>Baseline finish</th>
                            <th>Current finish</th>
                            <th>Finish delay</th>
                            <th>Baseline float</th>
                            <th>TIA exposure</th>
                            <th>Critical?</th>
                            <th>Root-cause indicators</th>
                            <th>Concurrent with</th>
                        </tr>
                    </thead>

                    <tbody>

                        ${analysis.drivers
                            .slice(0,500)
                            .map(
                                driver=>`
                                    <tr>
                                        <td class="activity-id">${escapeHTML(driver.currentActivity.id)}</td>
                                        <td>${escapeHTML(driver.currentActivity.name)}</td>
                                        <td>${escapeHTML(driver.currentActivity.wbsPath || "—")}</td>
                                        <td>${formatDate(driver.baselineActivity.start)}</td>
                                        <td>${formatDate(driver.currentActivity.start)}</td>
                                        <td>${driver.startDelay} d</td>
                                        <td>${formatDate(driver.baselineActivity.finish)}</td>
                                        <td>${formatDate(driver.currentActivity.finish)}</td>
                                        <td class="${driver.finishDelay ? "status-danger":""}">${driver.finishDelay} d</td>
                                        <td>${formatNumber(driver.baselineFloat)} d</td>
                                        <td class="${driver.tiaImpact ? "status-danger":""}">${formatNumber(driver.tiaImpact)} d</td>
                                        <td>${driver.currentCritical ? "Yes":"No"}</td>
                                        <td>${escapeHTML(driver.causes.join(", ") || "Date movement only")}</td>
                                        <td>${escapeHTML(driver.concurrentWith.join(", ") || "—")}</td>
                                    </tr>
                                `
                            )
                            .join("")}

                    </tbody>

                </table>

            </div>

            <div class="grid2">

                <div class="panel">

                    <div class="panel-title">
                        Windows / time slices
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Window</th>
                                <th>Drivers</th>
                                <th>Critical drivers</th>
                                <th>Max finish delay</th>
                                <th>Max TIA exposure</th>
                                <th>Driver IDs</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${analysis.windows
                                .map(
                                    window=>`
                                        <tr>
                                            <td>${escapeHTML(window.key)}</td>
                                            <td>${window.drivers.length}</td>
                                            <td>${window.criticalDrivers}</td>
                                            <td>${window.maxFinishDelay} d</td>
                                            <td>${formatNumber(window.maxTIAImpact)} d</td>
                                            <td>${escapeHTML(window.drivers.slice(0,15).map(d=>d.currentActivity.id).join(", "))}</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

                <div class="panel">

                    <div class="panel-title">
                        WBS root-cause screening
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>WBS</th>
                                <th>Drivers</th>
                                <th>Critical</th>
                                <th>Max delay</th>
                                <th>TIA exposure sum</th>
                                <th>Root-cause indicators</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${analysis.wbs
                                .map(
                                    group=>`
                                        <tr>
                                            <td>${escapeHTML(group.wbs)}</td>
                                            <td>${group.drivers}</td>
                                            <td>${group.criticalDrivers}</td>
                                            <td>${group.maxDelay} d</td>
                                            <td>${formatNumber(group.totalDelayExposure)} d</td>
                                            <td>${escapeHTML(
                                                [...group.causes.entries()]
                                                    .sort((a,b)=>b[1]-a[1])
                                                    .map(([cause,count])=>`${cause} (${count})`)
                                                    .join(", ")
                                            )}</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Delay-analysis interpretation
                </div>

                <div style="font-size:7px;line-height:1.65;color:var(--muted)">
                    The methods above are schedule-data analyses, not findings of contractual liability. A defensible forensic delay opinion also requires contemporaneous event evidence, accepted baselines/updates, schedule narratives, actual records, instructions, access/approval dates, mitigation records, cause-and-effect evidence and the applicable contract. The browser intentionally reports potential concurrency rather than assigning responsibility.
                </div>

            </div>

        `,
        text:
            `Delay Analysis\n\n` +
            `Baseline: ${baseline.name}\n` +
            `Current: ${current.name}\n` +
            `Project finish delay: ${analysis.projectDelay} days\n` +
            `TIA exposure: ${formatNumber(analysis.timeImpactExposure)} days\n` +
            `Impacted as-planned exposure: ${formatNumber(analysis.impactedAsPlanned)} days\n` +
            `Drivers: ${analysis.drivers.length}\n` +
            `Concurrent drivers: ${concurrent.length}\n\n` +
            analysis.drivers
                .map(
                    driver=>
                        `${driver.currentActivity.id} | ${driver.currentActivity.name} | finish delay ${driver.finishDelay}d | TIA exposure ${formatNumber(driver.tiaImpact)}d | ${driver.causes.join(", ")} | concurrent ${driver.concurrentWith.join(", ") || "none"}`
                )
                .join("\n")
    };
}

function defaultMonteSettings(){

    return {
        iterations:5000,
        optimisticPct:80,
        mostLikelyPct:100,
        pessimisticPct:140,
        nearCriticalFloat:10,
        correlation:0.25,
        scope:"critical",
        seed:12345
    };
}

function seededRandomFactory(seed){

    let value =
        (
            Number(seed) ||
            12345
        ) >>> 0;

    return function(){

        value +=
            0x6D2B79F5;

        let t =
            value;

        t =
            Math.imul(
                t ^ t >>> 15,
                t | 1
            );

        t ^=
            t +
            Math.imul(
                t ^ t >>> 7,
                t | 61
            );

        return (
            (
                t ^ t >>> 14
            ) >>> 0
        ) /
        4294967296;
    };
}

function triangularSample(
    min,
    mode,
    max,
    u
){

    if(
        !Number.isFinite(min) ||
        !Number.isFinite(mode) ||
        !Number.isFinite(max) ||
        max <= min
    ){

        return mode;
    }

    const f =
        (
            mode -
            min
        ) /
        (
            max -
            min
        );

    if(u < f){

        return min +
            Math.sqrt(
                u *
                (
                    max -
                    min
                ) *
                (
                    mode -
                    min
                )
            );
    }

    return max -
        Math.sqrt(
            (
                1 -
                u
            ) *
            (
                max -
                min
            ) *
            (
                max -
                mode
            )
        );
}

async function rerunMonteCarlo(
    scheduleId
){

    const settings =
        defaultMonteSettings();

    settings.iterations =
        Math.max(
            500,
            Math.min(
                50000,
                parseInt(
                    document.getElementById(
                        "monteIterations"
                    )?.value ||
                    settings.iterations,
                    10
                )
            )
        );

    settings.optimisticPct =
        Math.max(
            20,
            Math.min(
                100,
                parseNumber(
                    document.getElementById(
                        "monteOptimistic"
                    )?.value ||
                    settings.optimisticPct
                )
            )
        );

    settings.mostLikelyPct =
        Math.max(
            settings.optimisticPct,
            Math.min(
                160,
                parseNumber(
                    document.getElementById(
                        "monteMostLikely"
                    )?.value ||
                    settings.mostLikelyPct
                )
            )
        );

    settings.pessimisticPct =
        Math.max(
            settings.mostLikelyPct,
            Math.min(
                300,
                parseNumber(
                    document.getElementById(
                        "montePessimistic"
                    )?.value ||
                    settings.pessimisticPct
                )
            )
        );

    settings.nearCriticalFloat =
        Math.max(
            0,
            Math.min(
                120,
                parseNumber(
                    document.getElementById(
                        "monteFloat"
                    )?.value ||
                    settings.nearCriticalFloat
                )
            )
        );

    settings.correlation =
        Math.max(
            0,
            Math.min(
                .95,
                parseNumber(
                    document.getElementById(
                        "monteCorrelation"
                    )?.value ||
                    settings.correlation
                )
            )
        );

    settings.scope =
        document.getElementById(
            "monteScope"
        )?.value ||
        settings.scope;

    settings.seed =
        parseInt(
            document.getElementById(
                "monteSeed"
            )?.value ||
            settings.seed,
            10
        ) ||
        12345;

    state.monteSettingsBySchedule[
        scheduleId
    ] =
        settings;

    delete ensureReportStore(
        scheduleId
    ).monte;

    const button =
        document.querySelector(
            '.report-param-button[onclick*="rerunMonteCarlo"]'
        );

    if(button){
        button.disabled = true;
        button.dataset.originalText =
            button.textContent;
        button.textContent =
            "Starting simulation…";
    }

    try{
        const result =
            await buildReport(
                "monte",
                scheduleId,
                {
                    render:
                        getActiveSchedule()?.id ===
                        scheduleId
                }
            );

        if(
            getActiveSchedule()?.id ===
            scheduleId
        ){
            renderReport(
                result
            );
        }

        scheduleSave();

    }finally{
        if(button && document.body.contains(button)){
            button.disabled = false;
            button.textContent =
                button.dataset.originalText ||
                "Run simulation";
        }
    }
}

async function buildMonteCarloReport(
    schedules
){

    const schedule =
        schedules[0];

    const settings = {
        ...defaultMonteSettings(),
        ...(
            state.monteSettingsBySchedule[
                schedule.id
            ] ||
            {}
        )
    };

    const baseFinish =
        latestDate(
            (
                schedule.activities ||
                []
            ).map(
                activity =>
                    activity.finish
            )
        );

    const incomplete =
        (
            schedule.activities ||
            []
        ).filter(
            activity =>
                activity.percent < 100 &&
                (
                    activity.remainingDuration > 0 ||
                    activity.duration > 0
                )
        );

    if(
        !incomplete.length ||
        !baseFinish
    ){

        return {
            id:"monte",
            title:"Monte-Carlo simulation",
            subtitle:
                "Insufficient remaining-duration or finish-date data",
            html:
                buildMonteControls(
                    schedule,
                    settings
                ) +
                `
                    <div class="panel">
                        <div class="panel-title">
                            Simulation cannot run
                        </div>
                        <div style="font-size:8px;line-height:1.6;color:var(--muted)">
                            No incomplete activities with a numeric remaining/original duration were available for network simulation.
                        </div>
                    </div>
                `,
            text:
                "Monte-Carlo simulation could not run because no suitable incomplete activities were available."
        };
    }

    const core =
        parent?.ProjectControlsCore ||
        window.ProjectControlsCore;

    if(
        !core?.risk?.runMonteCarlo
    ){
        throw new Error(
            "The shared Monte Carlo risk engine is not available."
        );
    }

    const progressTarget =
        document.querySelector(
            '.report-param-button[onclick*="rerunMonteCarlo"]'
        );

    const simulation =
        await core.risk.runMonteCarlo(
            schedule,
            settings,
            progress => {

                if(
                    progressTarget &&
                    document.body.contains(
                        progressTarget
                    )
                ){
                    progressTarget.textContent =
                        `Simulating ${progress.percent}%`;
                }

                const job =
                    state.reportJobs[
                        reportJobKey(
                            schedule.id,
                            "monte"
                        )
                    ];

                if(job){
                    job.progress =
                        Math.max(
                            job.progress || 0,
                            Math.min(
                                99,
                                progress.percent
                            )
                        );
                }
            }
        );

    const p = simulation.probabilities;

    const probabilityRows = [
        ["P10",p.p10],
        ["P20",p.p20],
        ["P50",p.p50],
        ["P80",p.p80],
        ["P90",p.p90],
        ["P95",p.p95]
    ].map(
        ([label,value])=>({
            label,
            value
        })
    );

    const baseTime =
        new Date(
            baseFinish
        ).getTime();

    const dayToMs =
        day =>
            Number(day) *
            86400000;

    const p80Time =
        dayToMs(
            p.p80
        );

    const p80Contingency =
        Math.max(
            0,
            Math.round(
                (
                    p80Time -
                    baseTime
                ) /
                86400000
            )
        );

    const riskRows =
        simulation.riskRows ||
        [];

    const riskTable =
        riskRows
            .slice(
                0,
                25
            )
            .map(
                (
                    row,
                    index
                )=>`
                    <tr>
                        <td>${index+1}</td>
                        <td>${escapeHTML(row.id)}</td>
                        <td>${escapeHTML(row.name)}</td>
                        <td>${formatPercent(row.criticality*100)}</td>
                        <td>${formatPercent(row.sensitivity*100)}</td>
                        <td>${Number(row.baseDuration||0).toFixed(1)} d</td>
                    </tr>
                `
            )
            .join("");

    return {
        id:"monte",
        title:"Monte-Carlo simulation",
        subtitle:
            `${simulation.iterations.toLocaleString()} CPM network simulations · ${simulation.activityCount.toLocaleString()} activities · ${simulation.relationCount.toLocaleString()} relationships`,
        html:`

            ${buildMonteControls(
                schedule,
                settings
            )}

            <div class="metrics">

                ${metric(
                    "Current finish",
                    formatDate(baseFinish),
                    "Deterministic forecast",
                    "blue"
                )}

                ${metric(
                    "P50",
                    formatDate(
                        new Date(
                            dayToMs(
                                p.p50
                            )
                        ).toISOString()
                    ),
                    "Median network finish",
                    "blue"
                )}

                ${metric(
                    "P80",
                    formatDate(
                        new Date(
                            p80Time
                        ).toISOString()
                    ),
                    `+${p80Contingency} calendar days vs current finish`,
                    "warning"
                )}

                ${metric(
                    "P90",
                    formatDate(
                        new Date(
                            dayToMs(
                                p.p90
                            )
                        ).toISOString()
                    ),
                    "90% confidence",
                    "warning"
                )}

                ${metric(
                    "P95",
                    formatDate(
                        new Date(
                            dayToMs(
                                p.p95
                            )
                        ).toISOString()
                    ),
                    "95% confidence",
                    "danger"
                )}

            </div>

            <div class="grid2">

                <div class="panel">

                    <div class="panel-title">
                        Probability forecast
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Confidence</th>
                                <th>Forecast finish</th>
                                <th>Calendar-day movement from current forecast</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${probabilityRows
                                .map(
                                    row=>{
                                        const ms =
                                            dayToMs(
                                                row.value
                                            );
                                        return `
                                            <tr>
                                                <td>${row.label}</td>
                                                <td>${formatDate(new Date(ms).toISOString())}</td>
                                                <td>${Math.round((ms-baseTime)/86400000)} d</td>
                                            </tr>
                                        `;
                                    }
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

                <div class="panel">

                    <div class="panel-title">
                        Network simulation scope
                    </div>

                    <table>
                        <tr>
                            <td>Total activities recalculated</td>
                            <td><strong>${simulation.activityCount.toLocaleString()}</strong></td>
                        </tr>
                        <tr>
                            <td>Relationships recalculated</td>
                            <td><strong>${simulation.relationCount.toLocaleString()}</strong></td>
                        </tr>
                        <tr>
                            <td>Activities with sampled duration risk</td>
                            <td><strong>${simulation.riskActivityCount.toLocaleString()}</strong></td>
                        </tr>
                        <tr>
                            <td>Iterations</td>
                            <td><strong>${simulation.iterations.toLocaleString()}</strong></td>
                        </tr>
                        <tr>
                            <td>Duration distribution</td>
                            <td>Triangular</td>
                        </tr>
                        <tr>
                            <td>Optimistic / likely / pessimistic</td>
                            <td>${settings.optimisticPct}% / ${settings.mostLikelyPct}% / ${settings.pessimisticPct}%</td>
                        </tr>
                        <tr>
                            <td>Common-factor correlation</td>
                            <td>${formatPercent(settings.correlation*100)}</td>
                        </tr>
                        <tr>
                            <td>Network cycles/unresolved nodes</td>
                            <td><strong>${simulation.cycleCount}</strong></td>
                        </tr>
                    </table>

                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Driving-path risk ranking
                </div>

                <div style="font-size:7px;line-height:1.55;color:var(--muted);margin-bottom:8px">
                    Criticality Index is the percentage of iterations in which an activity appeared on the controlling predecessor chain to the simulated project finish. Finish Sensitivity is the Pearson correlation between that activity's sampled duration and the simulated project finish.
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Activity ID</th>
                            <th>Activity</th>
                            <th>Criticality Index</th>
                            <th>Finish Sensitivity</th>
                            <th>Base Remaining Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            riskTable ||
                            `
                                <tr>
                                    <td colspan="6">
                                        No risk-ranked activities were returned.
                                    </td>
                                </tr>
                            `
                        }
                    </tbody>
                </table>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Methodology and interpretation
                </div>

                <div style="font-size:7px;line-height:1.65;color:var(--muted)">
                    Every iteration samples remaining durations for the selected risk scope, then recalculates the full remaining CPM network in a Web Worker. FS, SS, FF and SF predecessor relationships and relationship lag are applied during the forward pass. Completed activities remain fixed anchors; incomplete activities outside the selected risk scope retain their deterministic remaining duration. Activity calendars are approximated from hours-per-day and hours-per-week as 5-day, 6-day or 7-day working calendars. The simulation therefore propagates upstream duration movement through successor logic instead of simply shifting individual forecast-finish dates. Explicit calendar exceptions, resource levelling and complex P6 scheduling options are not reproduced by this browser engine.
                </div>

            </div>
        `,
        text:
            `Monte-Carlo CPM Network Simulation\n\n` +
            `Current finish: ${formatDate(baseFinish)}\n` +
            `Iterations: ${simulation.iterations}\n` +
            `Activities recalculated: ${simulation.activityCount}\n` +
            `Relationships: ${simulation.relationCount}\n` +
            `Risk activities: ${simulation.riskActivityCount}\n` +
            `Network cycles/unresolved nodes: ${simulation.cycleCount}\n` +
            `Optimistic / likely / pessimistic: ${settings.optimisticPct}% / ${settings.mostLikelyPct}% / ${settings.pessimisticPct}%\n` +
            `Correlation: ${settings.correlation}\n` +
            `Seed: ${settings.seed}\n\n` +
            probabilityRows
                .map(
                    row=>
                        `${row.label}: ${new Date(dayToMs(row.value)).toISOString()}`
                )
                .join("\n")
    };
}

function buildMonteControls(
    schedule,
    settings
){

    return `
        <div class="report-parameter-panel">

            <div class="panel-title">
                Monte-Carlo parameters
            </div>

            <div class="panel-subtitle">
                Defaults: 5,000 iterations; 80% optimistic; 100% most likely; 140% pessimistic; critical/near-critical scope ≤10 days float; 0.25 common-factor correlation; seed 12345.
            </div>

            <div class="report-control-grid">

                <label class="report-control">
                    Iterations
                    <input
                        id="monteIterations"
                        type="number"
                        min="500"
                        max="50000"
                        step="500"
                        value="${settings.iterations}"
                    >
                </label>

                <label class="report-control">
                    Optimistic duration %
                    <input
                        id="monteOptimistic"
                        type="number"
                        min="20"
                        max="100"
                        step="5"
                        value="${settings.optimisticPct}"
                    >
                </label>

                <label class="report-control">
                    Most-likely duration %
                    <input
                        id="monteMostLikely"
                        type="number"
                        min="50"
                        max="160"
                        step="5"
                        value="${settings.mostLikelyPct}"
                    >
                </label>

                <label class="report-control">
                    Pessimistic duration %
                    <input
                        id="montePessimistic"
                        type="number"
                        min="100"
                        max="300"
                        step="5"
                        value="${settings.pessimisticPct}"
                    >
                </label>

                <label class="report-control">
                    Near-critical float threshold (days)
                    <input
                        id="monteFloat"
                        type="number"
                        min="0"
                        max="120"
                        step="1"
                        value="${settings.nearCriticalFloat}"
                    >
                </label>

                <label class="report-control">
                    Common-factor correlation (0–0.95)
                    <input
                        id="monteCorrelation"
                        type="number"
                        min="0"
                        max=".95"
                        step=".05"
                        value="${settings.correlation}"
                    >
                </label>

                <label class="report-control">
                    Risk scope
                    <select id="monteScope">
                        <option
                            value="critical"
                            ${settings.scope==="critical" ? "selected":""}
                        >
                            Critical + near-critical activities
                        </option>
                        <option
                            value="all"
                            ${settings.scope==="all" ? "selected":""}
                        >
                            All incomplete activities
                        </option>
                    </select>
                </label>

                <label class="report-control">
                    Random seed
                    <input
                        id="monteSeed"
                        type="number"
                        step="1"
                        value="${settings.seed}"
                    >
                </label>

            </div>

            <div class="report-parameter-actions">
                <button
                    class="report-param-button"
                    onclick="rerunMonteCarlo('${schedule.id}')"
                >
                    Run simulation
                </button>
            </div>

        </div>
    `;
}

function ganttPosition(date,minTime,maxTime){
    if(!date || maxTime<=minTime) return 0;
    const t=new Date(date).getTime();
    if(!Number.isFinite(t)) return 0;
    return Math.max(0,Math.min(100,(t-minTime)/(maxTime-minTime)*100));
}

function ganttDateRange(schedule){
    const values=[];
    (schedule.activities||[]).forEach(a=>[
        a.baselineStart,a.baselineFinish,a.plannedStart,a.plannedFinish,
        a.actualStart,a.actualFinish,a.currentStart,a.currentFinish,a.start,a.finish
    ].filter(Boolean).forEach(v=>{
        const t=new Date(v).getTime();
        if(Number.isFinite(t)) values.push(t);
    }));
    if(!values.length) return [Date.now(),Date.now()+86400000*30];
    const day=86400000;
    let min=Math.min(...values),max=Math.max(...values);
    min-=day*7; max+=day*14;
    return [min,max];
}

function buildGanttHierarchy(schedule){
    const sourceWBS=(schedule.wbs||[]).map(w=>({
        id:String(w.id ?? w.path ?? w.code ?? w.name),
        parentId:String(w.parentId ?? ""),
        code:String(w.code ?? w.name ?? "WBS"),
        name:String(w.name ?? w.code ?? "WBS"),
        path:String(w.path ?? w.name ?? w.code ?? "WBS"),
        children:[],activities:[],synthetic:false
    }));
    const nodes=new Map(sourceWBS.map(n=>[n.id,n]));

    function ensurePath(path){
        const clean=String(path||"Unassigned").trim()||"Unassigned";
        const parts=clean.includes(" / ") ? clean.split(/\s*\/\s*/) : [clean];
        let parent="",full="";
        for(const part of parts){
            full=full ? `${full} / ${part}` : part;
            let node=[...nodes.values()].find(n=>n.path===full);
            if(!node){
                const id=`path:${full}`;
                node={id,parentId:parent,code:part,name:part,path:full,children:[],activities:[],synthetic:true};
                nodes.set(id,node);
            }
            parent=node.id;
        }
        return [...nodes.values()].find(n=>n.path===full);
    }

    (schedule.activities||[]).forEach(a=>{
        let node=nodes.get(String(a.wbs||""));
        if(!node){
            node=[...nodes.values()].find(n=>n.path===String(a.wbsPath||"") || n.name===String(a.wbsName||""));
        }
        if(!node) node=ensurePath(a.wbsPath||a.wbsName||"Unassigned");
        node.activities.push(a);
    });

    nodes.forEach(n=>n.children=[]);
    const roots=[];
    nodes.forEach(n=>{
        const parent=nodes.get(String(n.parentId||""));
        if(parent && parent!==n) parent.children.push(n);
        else roots.push(n);
    });

    function allActivities(node){
        return [
            ...node.activities,
            ...node.children.flatMap(allActivities)
        ];
    }

    function enrich(node,depth=0){
        node.depth=depth;
        node.children.sort((a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true}));
        node.activities.sort((a,b)=>new Date(a.start||a.finish||0)-new Date(b.start||b.finish||0));
        node.children.forEach(c=>enrich(c,depth+1));
        node.rollupActivities=allActivities(node);
        node.progress=weightedProgress(node.rollupActivities);
        node.baselineStart=earliestDate(node.rollupActivities.map(a=>a.baselineStart||a.plannedStart||a.start));
        node.baselineFinish=latestDate(node.rollupActivities.map(a=>a.baselineFinish||a.plannedFinish||a.finish));
        node.currentStart=earliestDate(node.rollupActivities.map(a=>a.actualStart||a.currentStart||a.start));
        node.currentFinish=latestDate(node.rollupActivities.map(a=>a.actualFinish||a.currentFinish||a.finish));
        node.criticalCount=node.rollupActivities.filter(a=>a.critical||Number(a.totalFloat||0)<=0).length;
    }
    roots.sort((a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true}));
    roots.forEach(r=>enrich(r,0));
    return {roots,nodes};
}

function earliestDate(values){
    const valid=(values||[]).filter(Boolean).map(v=>new Date(v)).filter(d=>Number.isFinite(d.getTime()));
    return valid.length ? new Date(Math.min(...valid.map(d=>d.getTime()))).toISOString() : null;
}

function ganttScaleBands(minTime,maxTime){
    const weeks=[];
    const months=[];
    const start=new Date(minTime);
    start.setHours(0,0,0,0);
    start.setDate(start.getDate()-((start.getDay()+6)%7));
    let cursor=new Date(start);
    while(cursor.getTime()<=maxTime){
        const next=new Date(cursor); next.setDate(next.getDate()+7);
        weeks.push({start:cursor.getTime(),end:Math.min(next.getTime(),maxTime),label:`W${isoWeek(cursor)}`});
        cursor=next;
    }
    cursor=new Date(new Date(minTime).getFullYear(),new Date(minTime).getMonth(),1);
    while(cursor.getTime()<=maxTime){
        const next=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);
        months.push({start:Math.max(cursor.getTime(),minTime),end:Math.min(next.getTime(),maxTime),label:cursor.toLocaleDateString(undefined,{month:"short",year:"numeric"})});
        cursor=next;
    }
    return {weeks,months};
}

function isoWeek(date){
    const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
    const day=d.getUTCDay()||7;
    d.setUTCDate(d.getUTCDate()+4-day);
    const yearStart=new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d-yearStart)/86400000)+1)/7);
}

function ganttTimelineGrid(bands,minTime,maxTime){
    const monthLines=bands.months.map(m=>`<span class="gantt-gridline month" style="left:${ganttPosition(new Date(m.start).toISOString(),minTime,maxTime)}%"></span>`).join("");
    const weekLines=bands.weeks.map(w=>`<span class="gantt-gridline" style="left:${ganttPosition(new Date(w.start).toISOString(),minTime,maxTime)}%"></span>`).join("");
    return monthLines+weekLines;
}

function ganttRowBars(item,type,minTime,maxTime){
    const baselineStart=item.baselineStart||item.plannedStart||item.start;
    const baselineFinish=item.baselineFinish||item.plannedFinish||item.finish;
    const currentStart=item.currentStart||item.actualStart||item.start;
    const currentFinish=item.currentFinish||item.actualFinish||item.finish;
    const p1=ganttPosition(baselineStart,minTime,maxTime),p2=ganttPosition(baselineFinish,minTime,maxTime);
    const c1=ganttPosition(currentStart,minTime,maxTime),c2=ganttPosition(currentFinish,minTime,maxTime);
    const critical=type==="activity" && (item.critical||Number(item.totalFloat||0)<=0);
    if(type==="wbs"){
        return `<span class="gantt-summary-bar" style="left:${Math.min(c1,c2)}%;width:${Math.max(.35,Math.abs(c2-c1))}%" title="WBS roll-up: ${formatDate(currentStart)} to ${formatDate(currentFinish)}"></span>`;
    }
    if(item.milestone){
        return `<span class="gantt-pro-milestone ${critical?"critical":""}" style="left:${c2}%" title="${escapeHTML(item.id)} · ${formatDate(currentFinish)}"></span>`;
    }
    return `
        <span class="gantt-baseline-bar" style="left:${Math.min(p1,p2)}%;width:${Math.max(.25,Math.abs(p2-p1))}%" title="Baseline: ${formatDate(baselineStart)} to ${formatDate(baselineFinish)}"></span>
        <span class="gantt-current-bar ${critical?"gantt-critical-bar":""}" style="left:${Math.min(c1,c2)}%;width:${Math.max(.25,Math.abs(c2-c1))}%" title="Current: ${formatDate(currentStart)} to ${formatDate(currentFinish)} · ${formatPercent(item.percent)}">
            <span class="gantt-current-progress" style="width:${Math.max(0,Math.min(100,Number(item.percent||0)))}%"></span>
        </span>`;
}

function ganttRowsForTree(hierarchy,minTime,maxTime,bands,dataDate){
    const rows=[];
    let seq=0;
    const grid=ganttTimelineGrid(bands,minTime,maxTime);
    const dd=dataDate ? ganttPosition(dataDate,minTime,maxTime) : null;

    function addWBS(node,parentKey=""){
        const key=`wbs-${++seq}`;
        const hasChildren=node.children.length||node.activities.length;
        rows.push({
            key,parentKey,kind:"wbs",depth:node.depth,
            left:`<div class="gantt-pro-left-row wbs-row ${node.depth===0?"root-wbs":""}" data-row="${key}" data-parent="${parentKey}">
                <div class="gantt-name-cell">
                    <span class="gantt-indent" style="width:${node.depth*15}px"></span>
                    ${hasChildren?`<button class="gantt-tree-toggle" data-toggle="${key}" aria-label="Collapse ${escapeHTML(node.name)}">▾</button>`:`<span style="width:17px"></span>`}
                    <span class="gantt-code">${escapeHTML(node.code)}</span>
                    <span class="gantt-name gantt-wbs-name" title="${escapeHTML(node.path)}">${escapeHTML(node.name)}</span>
                </div>
                <div>${formatPercent(node.progress)}</div>
                <div>${formatDate(node.currentStart)}</div>
                <div>${formatDate(node.currentFinish)}</div>
            </div>`,
            time:`<div class="gantt-pro-time-row wbs-row ${node.depth===0?"root-wbs":""}" data-row="${key}" data-parent="${parentKey}">${grid}${dd!==null?`<span class="gantt-data-date" style="left:${dd}%"></span>`:""}${ganttRowBars(node,"wbs",minTime,maxTime)}</div>`
        });
        node.children.forEach(child=>addWBS(child,key));
        node.activities.forEach(activity=>addActivity(activity,key,node.depth+1));
    }

    function addActivity(activity,parentKey,depth){
        const key=`act-${++seq}`;
        rows.push({
            key,parentKey,kind:"activity",depth,
            left:`<div class="gantt-pro-left-row" data-row="${key}" data-parent="${parentKey}">
                <div class="gantt-name-cell">
                    <span class="gantt-indent" style="width:${depth*15}px"></span>
                    <span style="width:17px"></span>
                    <span class="gantt-code">${escapeHTML(activity.id)}</span>
                    <span class="gantt-name" title="${escapeHTML(activity.name)}">${escapeHTML(activity.name)}</span>
                </div>
                <div>${formatPercent(activity.percent)}</div>
                <div>${formatDate(activity.actualStart||activity.currentStart||activity.start)}</div>
                <div>${formatDate(activity.actualFinish||activity.currentFinish||activity.finish)}</div>
            </div>`,
            time:`<div class="gantt-pro-time-row" data-row="${key}" data-parent="${parentKey}">${grid}${dd!==null?`<span class="gantt-data-date" style="left:${dd}%"></span>`:""}${ganttRowBars(activity,"activity",minTime,maxTime)}</div>`
        });
    }

    hierarchy.roots.forEach(root=>addWBS(root,""));
    return rows;
}

function toggleGanttBranch(key){
    const left=document.querySelector(`.gantt-pro-left-row[data-row="${key}"] .gantt-tree-toggle`);
    const collapsed=left?.dataset.collapsed==="true";
    if(left){left.dataset.collapsed=collapsed?"false":"true";left.textContent=collapsed?"▾":"▸";}
    function apply(parent,hide){
        document.querySelectorAll(`[data-parent="${parent}"]`).forEach(el=>{
            el.classList.toggle("gantt-hidden",hide);
            const child=el.dataset.row;
            const toggle=document.querySelector(`.gantt-pro-left-row[data-row="${child}"] .gantt-tree-toggle`);
            const childCollapsed=toggle?.dataset.collapsed==="true";
            if(child) apply(child,hide || childCollapsed);
        });
    }
    apply(key,!collapsed);
}

function setAllGanttBranches(expanded){
    document.querySelectorAll('.gantt-tree-toggle').forEach(btn=>{
        btn.dataset.collapsed=expanded?"false":"true";
        btn.textContent=expanded?"▾":"▸";
    });
    document.querySelectorAll('.gantt-pro-left-row[data-parent],.gantt-pro-time-row[data-parent]').forEach(el=>{
        el.classList.toggle('gantt-hidden',!expanded && Boolean(el.dataset.parent));
    });
}

function initialiseGanttInteractions(){
    document.querySelectorAll('.gantt-tree-toggle').forEach(btn=>{
        btn.addEventListener('click',()=>toggleGanttBranch(btn.dataset.toggle));
    });
    document.getElementById('ganttExpandAll')?.addEventListener('click',()=>setAllGanttBranches(true));
    document.getElementById('ganttCollapseAll')?.addEventListener('click',()=>setAllGanttBranches(false));
}

function buildGanttReport(schedules){
    const schedule=schedules[0];
    const activities=schedule.activities||[];
    const [minTime,maxTime]=ganttDateRange(schedule);
    const hierarchy=buildGanttHierarchy(schedule);
    const bands=ganttScaleBands(minTime,maxTime);
    const rows=ganttRowsForTree(hierarchy,minTime,maxTime,bands,schedule.statusDate);

    const months=bands.months.map(m=>{
        const left=ganttPosition(new Date(m.start).toISOString(),minTime,maxTime);
        const right=ganttPosition(new Date(m.end).toISOString(),minTime,maxTime);
        return `<span class="gantt-month-label" style="left:${left}%;width:${Math.max(.2,right-left)}%">${escapeHTML(m.label)}</span>`;
    }).join("");
    const weeks=bands.weeks.map(w=>{
        const left=ganttPosition(new Date(w.start).toISOString(),minTime,maxTime);
        const right=ganttPosition(new Date(w.end).toISOString(),minTime,maxTime);
        return `<span class="gantt-week-label" style="left:${left}%;width:${Math.max(.2,right-left)}%">${escapeHTML(w.label)}</span>`;
    }).join("");

    const leftRows=rows.map(r=>r.left).join("");
    const timeRows=rows.map(r=>r.time).join("");
    const wbsCount=hierarchy.nodes.size;

    setTimeout(initialiseGanttInteractions,0);

    return {
        id:"gantt",
        title:"Professional WBS Gantt",
        subtitle:`Full hierarchical WBS · ${formatDate(new Date(minTime).toISOString())} to ${formatDate(new Date(maxTime).toISOString())}`,
        html:`
            <div class="metrics">
                ${metric("Activities",activities.length,"Schedule activities","blue")}
                ${metric("WBS elements",wbsCount,"Parent + child WBS","blue")}
                ${metric("Progress",formatPercent(weightedProgress(activities)),"Activity weighted","good")}
                ${metric("Critical",activities.filter(a=>a.critical||Number(a.totalFloat||0)<=0).length,"Critical / zero float","danger")}
                ${metric("Forecast finish",formatDate(latestDate(activities.map(a=>a.finish))),"Latest current finish","warning")}
            </div>

            <div class="panel">
                <div class="panel-title">Gantt legend</div>
                <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;font-size:7px;color:var(--muted)">
                    <span><span style="display:inline-block;width:22px;height:5px;background:#8b8f97;border-radius:999px;margin-right:4px"></span>Baseline / planned</span>
                    <span><span style="display:inline-block;width:22px;height:8px;background:var(--purple);border-radius:3px;margin-right:4px"></span>Current / forecast</span>
                    <span><span style="display:inline-block;width:22px;border-top:3px solid var(--text);margin-right:4px"></span>WBS summary</span>
                    <span>◆ Milestone</span>
                    <span style="color:var(--red)">│ Data date</span>
                </div>
            </div>

            <div class="panel">
                <div class="panel-title">WBS programme</div>
                <div class="panel-subtitle">Native P6 parent/child WBS hierarchy is retained. Parent summary bars roll up every descendant activity. Expand or collapse branches independently.</div>
                <div class="gantt-pro">
                    <div class="gantt-pro-toolbar">
                        <div style="font-size:7px;color:var(--muted)">${wbsCount} WBS elements · ${activities.length} activities · weekly time scale</div>
                        <div class="gantt-pro-actions">
                            <button id="ganttExpandAll" type="button">Expand all</button>
                            <button id="ganttCollapseAll" type="button">Collapse all</button>
                        </div>
                    </div>
                    <div class="gantt-pro-scroll">
                        <div class="gantt-pro-grid">
                            <div>
                                <div class="gantt-pro-left-head"><div>WBS / Activity</div><div>%</div><div>Start</div><div>Finish</div></div>
                                ${leftRows}
                            </div>
                            <div>
                                <div class="gantt-pro-time-head"><div class="gantt-month-band">${months}</div><div class="gantt-week-band">${weeks}</div></div>
                                ${timeRows}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        text:`Professional WBS Gantt\n\nSchedule: ${schedule.name}\nWBS elements: ${wbsCount}\nActivities: ${activities.length}\nRange: ${formatDate(new Date(minTime).toISOString())} to ${formatDate(new Date(maxTime).toISOString())}`
    };
}

async function buildAIReport(
    schedules
){

    const schedule =
        schedules[0];

    const health =
        calculateHealth(
            [schedule]
        );

    const dcma =
        calculateDCMA(
            schedule
        );

    const issues =
        collectScheduleIssues(
            schedule
        );

    const forensicFlags =
        forensicActivityFlags(
            schedule
        );

    const critical =
        analyseCriticalPath(
            schedule,
            10
        );

    const progress =
        weightedProgress(
            schedule.activities
        );

    const baselineId =
        state.forensicBaselineBySchedule[
            schedule.id
        ] ||
        state.comparisonScheduleBySchedule[
            schedule.id
        ] ||
        state.delayBaselineBySchedule[
            schedule.id
        ] ||
        "";

    const baseline =
        getScheduleById(
            baselineId
        );

    const comparison =
        baseline
            ? compareScheduleNetworks(
                schedule,
                baseline
            )
            : null;

    const prompt = `
Prepare a detailed forensic schedule review of the schedule below.

This is the DETAILED AI REPORT, not a short chat response.

Required structure:
1. Executive assessment.
2. Schedule quality weaknesses.
3. Logic and relationship weaknesses.
4. Detailed critical-path and near-critical-path assessment.
5. Progress/statusing weaknesses and data-date concerns.
6. Baseline/current date movement.
7. Float, constraints and calendar risks.
8. WBS, area and milestone observations.
9. Potential forensic red flags.
10. Progress-to-date assessment.
11. Forecast and completion risks.
12. Evidence gaps / information still required.
13. Prioritised recommendations.

Requirements:
- Use activity IDs whenever referring to specific activities.
- Identify the most material activities individually rather than only giving totals.
- Explain why each issue matters to schedule reliability.
- Do not infer contractual responsibility from schedule data alone.
- Do not invent events or clauses.
- If a separate baseline/comparison is available, discuss material network and date changes.

SCHEDULE
${scheduleSummary(schedule)}

HEALTH
${health.score}/100 ${health.label}

DCMA-STYLE SCREEN
${dcma.filter(x=>x.result).length}/${dcma.length} passing

PROGRESS
${formatPercent(progress)}

DETAILED ISSUES
${issues
    .slice(0,120)
    .map(
        issue=>
            `${issue.severity.toUpperCase()} | ${issue.activity.id} | ${issue.activity.name} | ${issue.category} | ${issue.detail}`
    )
    .join("\n")}

FORENSIC FLAGS
${forensicFlags
    .slice(0,100)
    .map(
        flag=>
            `${flag.severity.toUpperCase()} | ${flag.activity.id} | ${flag.activity.name} | ${flag.category} | ${flag.detail}`
    )
    .join("\n")}

CRITICAL CHAINS
${critical.topChains
    .slice(0,8)
    .map(
        (path,index)=>
            `Path ${index+1}: ${path.map(a=>`${a.id} ${a.name}`).join(" -> ")}`
    )
    .join("\n")}

${baseline && comparison
    ? `
COMPARISON SCHEDULE
${baseline.name}

NETWORK / ACTIVITY CHANGE SUMMARY
Changed/new/deleted activities: ${comparison.activityChanges.filter(c=>c.status!=="Unchanged").length}
Relationships added: ${comparison.linkAdded.length}
Relationships removed: ${comparison.linkRemoved.length}

LARGEST CHANGES
${comparison.activityChanges
    .filter(c=>c.status!=="Unchanged")
    .sort((a,b)=>Math.abs(Number(b.finishVariance||0))-Math.abs(Number(a.finishVariance||0)))
    .slice(0,80)
    .map(
        change=>
            `${change.id} | ${change.status} | finish Δ ${change.finishVariance ?? "—"}d | duration Δ ${change.durationVariance ?? "—"}d | float Δ ${change.floatVariance ?? "—"}d | logic +${change.predecessorAdded.length+change.successorAdded.length}/-${change.predecessorRemoved.length+change.successorRemoved.length}`
    )
    .join("\n")}
`
    : `
No separate comparison schedule is currently selected. Restrict baseline comments to embedded baseline/target fields.
`}
`;

    let answer;

    try{

        answer =
            await askAI(
                prompt,
                schedule
            );

    }catch(error){

        console.error(
            "Detailed AI report failed:",
            error
        );

        answer =
            `The selected AI engine could not complete the forensic narrative. Deterministic schedule findings remain available below. Technical detail: ${error?.message || "Unknown error"}`;
    }

    const recommendations =
        generateRecommendations(
            [schedule],
            health,
            critical.criticalActivities
        );

    state.recommendationsBySchedule[
        schedule.id
    ] =
        recommendations;

    if(
        getActiveSchedule()?.id ===
        schedule.id
    ){

        state.recommendations =
            recommendations;
    }

    return {
        id:"ai",
        title:"Detailed AI report",
        subtitle:
            `Forensic AI review using ${state.aiModelValue === "heuristic" ? "deterministic fallback":state.aiModelValue}`,
        html:`

            <div class="metrics">

                ${metric(
                    "Health",
                    `${health.score}/100`,
                    health.label,
                    health.score>=85
                        ? "good"
                        : health.score>=70
                            ? "warning"
                            : "danger"
                )}

                ${metric(
                    "DCMA screen",
                    `${Math.round(
                        dcma.filter(x=>x.result).length/
                        Math.max(dcma.length,1)*100
                    )}%`,
                    `${dcma.filter(x=>x.result).length}/${dcma.length} passing`,
                    "blue"
                )}

                ${metric(
                    "Progress",
                    formatPercent(progress),
                    "Activity weighted",
                    "blue"
                )}

                ${metric(
                    "Critical / near critical",
                    `${critical.criticalActivities.length} / ${critical.nearCritical.length}`,
                    "Current path exposure",
                    "danger"
                )}

                ${metric(
                    "Forensic flags",
                    forensicFlags.length,
                    "Potential weaknesses",
                    forensicFlags.length
                        ? "warning"
                        : "good"
                )}

            </div>

            <div class="panel">

                <div class="panel-title">
                    AI forensic review
                </div>

                <div style="
                    font-size:8px;
                    line-height:1.72;
                    color:var(--text);
                ">
                    ${simpleMarkdown(
                        answer
                    )}
                </div>

            </div>

            <div class="grid2">

                <div class="panel">

                    <div class="panel-title">
                        Highest-priority deterministic weaknesses
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Severity</th>
                                <th>ID</th>
                                <th>Activity</th>
                                <th>Category</th>
                                <th>Finding</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${issues
                                .slice(0,80)
                                .map(
                                    issue=>`
                                        <tr>
                                            <td>
                                                <span class="issue-severity ${issue.severity}">
                                                    ${escapeHTML(issue.severity)}
                                                </span>
                                            </td>
                                            <td class="activity-id">${escapeHTML(issue.activity.id)}</td>
                                            <td>${escapeHTML(issue.activity.name)}</td>
                                            <td>${escapeHTML(issue.category)}</td>
                                            <td>${escapeHTML(issue.detail)}</td>
                                        </tr>
                                    `
                                )
                                .join("")}
                        </tbody>
                    </table>

                </div>

                <div class="panel">

                    <div class="panel-title">
                        Recommended actions
                    </div>

                    <div class="analysis-list">

                        ${recommendations
                            .map(
                                recommendation=>`

                                    <div class="analysis-row">

                                        <div class="analysis-dot"></div>

                                        <div class="analysis-main">

                                            <div class="analysis-title">
                                                ${escapeHTML(
                                                    recommendation.title
                                                )}
                                            </div>

                                            <div class="analysis-detail">
                                                ${escapeHTML(
                                                    recommendation.description
                                                )}
                                            </div>

                                        </div>

                                    </div>
                                `
                            )
                            .join("")}

                    </div>

                </div>

            </div>

        `,
        text:
            `Detailed AI Forensic Report\n\n` +
            `Schedule: ${schedule.name}\n` +
            `AI engine: ${state.aiModelValue}\n\n` +
            answer +
            `\n\nRECOMMENDATIONS\n` +
            recommendations
                .map(
                    recommendation=>
                        `${recommendation.title}: ${recommendation.description}`
                )
                .join("\n")
    };
}

function generateRecommendations(
    schedules,
    health,
    critical
){

    const schedule =
        schedules[0];

    const recommendations = [];

    const activities =
        schedule.activities ||
        [];

    const negative =
        activities.filter(
            activity =>
                activity.totalFloat < 0
        );

    const constraints =
        activities.filter(
            activity =>
                activity.constraint ||
                activity.secondConstraint
        );

    const noPredecessor =
        activities.filter(
            activity =>
                activity.percent < 100 &&
                !activity.milestone &&
                !activity.predecessors.length
        );

    const noSuccessor =
        activities.filter(
            activity =>
                activity.percent < 100 &&
                !activity.milestone &&
                !activity.successors.length
        );

    const progressAnomalies =
        activities.filter(
            activity =>
                (
                    activity.percent > 0 &&
                    !activity.actualStart
                ) ||
                (
                    activity.percent >= 100 &&
                    !activity.actualFinish
                ) ||
                (
                    activity.actualFinish &&
                    activity.percent < 100
                )
        );

    const baselineSlippage =
        activities.filter(
            activity =>
                activity.baselineFinish &&
                activity.currentFinish &&
                daysBetween(
                    activity.baselineFinish,
                    activity.currentFinish
                ) > 7
        );

    if(negative.length){

        recommendations.push({
            title:"Resolve negative-float drivers",
            description:
                `${negative.length} activities have negative float. Start with ${negative.slice(0,5).map(a=>a.id).join(", ")} and trace the required finish, constraints and downstream path.`,
            priority:"High"
        });
    }

    if(
        noPredecessor.length ||
        noSuccessor.length
    ){

        recommendations.push({
            title:"Repair open-ended logic",
            description:
                `${noPredecessor.length} incomplete activities have no predecessor and ${noSuccessor.length} have no successor. Review IDs ${[...noPredecessor,...noSuccessor].slice(0,8).map(a=>a.id).join(", ")} first.`,
            priority:"High"
        });
    }

    if(progressAnomalies.length){

        recommendations.push({
            title:"Correct progress/statusing anomalies",
            description:
                `${progressAnomalies.length} activities contain inconsistent actual-date or percent-complete status. Verify IDs ${progressAnomalies.slice(0,8).map(a=>a.id).join(", ")} against the data date and actual records.`,
            priority:"High"
        });
    }

    if(constraints.length){

        recommendations.push({
            title:"Validate schedule constraints",
            description:
                `${constraints.length} activities contain explicit constraints. Confirm that each constraint is required and that the critical path is not being artificially driven by imposed dates.`,
            priority:"Medium"
        });
    }

    if(baselineSlippage.length){

        recommendations.push({
            title:"Investigate baseline finish movement",
            description:
                `${baselineSlippage.length} activities are more than seven days later than their embedded baseline/target finish. Prioritise ${baselineSlippage.sort((a,b)=>daysBetween(b.baselineFinish,b.currentFinish)-daysBetween(a.baselineFinish,a.currentFinish)).slice(0,6).map(a=>a.id).join(", ")}.`,
            priority:"High"
        });
    }

    if(critical.length){

        recommendations.push({
            title:"Validate the critical and near-critical network",
            description:
                `${critical.length} activities are currently critical/zero-float. Confirm path continuity, calendars, constraints and actual status before using the path for forecasting or delay conclusions.`,
            priority:"High"
        });
    }

    if(
        state.schedules.length > 1 &&
        !state.comparisonScheduleBySchedule[
            schedule.id
        ]
    ){

        recommendations.push({
            title:"Select a comparison schedule",
            description:
                "Another schedule is available. Select it in the Schedule Comparison report to activate activity-by-activity, WBS and relationship-change analysis.",
            priority:"Medium"
        });
    }

    if(
        state.schedules.length > 1 &&
        !state.delayBaselineBySchedule[
            schedule.id
        ]
    ){

        recommendations.push({
            title:"Select a baseline for delay analysis",
            description:
                "A separate uploaded schedule is available. Select the approved baseline or earlier update in the Delay Analysis report to run TIA, impacted-as-planned, windows and concurrency screening.",
            priority:"Medium"
        });
    }

    recommendations.push({
        title:"Preserve native schedule evidence",
        description:
            "Retain each native XER/XML, data date, accepted baseline, update narrative, calendar definitions and contemporaneous records so later forensic comparisons remain auditable.",
        priority:"Medium"
    });

    if(health.score < 70){

        recommendations.push({
            title:"Undertake schedule recovery and quality review",
            description:
                `The automated schedule-health score is ${health.score}/100 (${health.label}). Resolve quality defects before relying on the programme as the principal forecasting or forensic record.`,
            priority:"High"
        });
    }

    return recommendations
        .slice(0,12);
}

function refreshRecommendationsForSchedule(
    scheduleId
){

    const schedule =
        getScheduleById(
            scheduleId
        );

    if(!schedule)
        return;

    const health =
        calculateHealth(
            [schedule]
        );

    const critical =
        schedule.activities
            .filter(
                activity =>
                    activity.critical ||
                    activity.totalFloat <= 0
            );

    const recommendations =
        generateRecommendations(
            [schedule],
            health,
            critical
        );

    state.recommendationsBySchedule[
        scheduleId
    ] =
        recommendations;

    if(
        getActiveSchedule()?.id ===
        scheduleId
    ){

        state.recommendations =
            recommendations;
    }

    renderRightPane();
}

function generateRecommendationsFromReport(){

    const schedule =
        getActiveSchedule();

    if(!schedule)
        return;

    refreshRecommendationsForSchedule(
        schedule.id
    );
}

function renderBuildPlaceholder(report){

    if(!report)
        return;

    document.getElementById(
        "reportView"
    ).innerHTML = `

        <div class="report-card">

            <div class="report-card-header">

                <div>

                    <div class="report-card-title">
                        ${escapeHTML(report.name)}
                    </div>

                    <div class="report-card-subtitle">
                        Building report automatically...
                    </div>

                </div>

            </div>

            <div class="panel">

                <div class="panel-title">
                    Report generation
                </div>

                <div class="progress-large">
                    <div
                        id="mainReportProgress"
                        style="width:65%"
                    ></div>
                </div>

                <div style="
                    margin-top:7px;
                    color:var(--muted);
                    font-size:7px;
                ">
                    Analysing the selected schedule. Reports are generated
                    automatically when XER/XML files are loaded.
                </div>

            </div>

        </div>
    `;
}

function renderReport(report){

    if(!report)
        return;

    currentReportObject =
        report;

    document.getElementById(
        "reportView"
    ).innerHTML = `

        <div class="report-card">

            <div class="report-card-header">

                <div>

                    <div class="report-card-title">
                        ${escapeHTML(report.title)}
                    </div>

                    <div class="report-card-subtitle">
                        ${escapeHTML(report.subtitle)}
                    </div>

                </div>

                <div class="report-actions">

                    <button
                        class="report-action"
                        onclick="openReportModal()"
                    >
                        Open
                    </button>

                    <button
                        class="report-action primary"
                        onclick="downloadReport('${report.id}','${report.scheduleId || getActiveSchedule()?.id || ""}')"
                    >
                        ↓ PDF
                    </button>

                </div>

            </div>

            ${report.html}

        </div>
    `;

    if(report.id === "scurve"){

        const schedule =
            getScheduleById(
                report.scheduleId ||
                getActiveSchedule()?.id
            );

        const canvas =
            document
                .getElementById(
                    "reportView"
                )
                .querySelector(
                    "canvas"
                );

        if(
            schedule &&
            canvas
        ){

            const points =
                buildTimeSeries(
                    schedule.activities
                );

            setTimeout(
                ()=>drawSCurve(
                    canvas.id,
                    points,
                    "scurve"
                ),
                20
            );
        }
    }
}

function renderNoScheduleReport(){

    document.getElementById(
        "reportView"
    ).innerHTML = `

        <div class="report-empty">

            <div class="report-empty-icon">
                ▦
            </div>

            <h1>
                Project controls intelligence
            </h1>

            <p>
                Upload a Primavera P6 XER or Microsoft Project XML file.
                One schedule can be active at a time. All reports for
                uploaded schedules are generated automatically.
            </p>

        </div>
    `;
}

function renderRightPane(){

    const reportsContainer =
        document.getElementById(
            "rightReports"
        );

    const recommendationContainer =
        document.getElementById(
            "rightRecommendations"
        );

    if(
        !reportsContainer ||
        !recommendationContainer
    ){
        return;
    }

    reportsContainer.innerHTML = "";
    recommendationContainer.innerHTML = "";

    let completedCount = 0;

    state.files.forEach(
        file=>{

            const schedules =
                state.schedules.filter(
                    schedule =>
                        schedule.fileId ===
                        file.id
                );

            const fileReports =
                schedules.reduce(
                    (total,schedule)=>
                        total +
                        Object.keys(
                            state.reports[
                                schedule.id
                            ] ||
                            {}
                        ).length,
                    0
                );

            if(!fileReports)
                return;

            completedCount +=
                fileReports;

            const fileNode =
                document.createElement(
                    "div"
                );

            fileNode.className =
                "right-tree-node";

            const fileHeader =
                document.createElement(
                    "button"
                );

            fileHeader.className =
                "right-tree-header";

            fileHeader.innerHTML = `
                <span class="file-arrow">▸</span>

                <span class="file-icon">
                    ${escapeHTML(
                        file.extension.toUpperCase()
                    )}
                </span>

                <span class="file-name">
                    ${escapeHTML(file.name)}
                </span>

                <span class="file-count">
                    ${fileReports}
                </span>
            `;

            fileHeader.onclick =
                ()=>{

                    fileNode
                        .classList
                        .toggle(
                            "open"
                        );

                    fileHeader
                        .querySelector(
                            ".file-arrow"
                        )
                        .textContent =
                            fileNode
                                .classList
                                .contains(
                                    "open"
                                )
                                ? "▾"
                                : "▸";
                };

            fileNode.appendChild(
                fileHeader
            );

            const fileChildren =
                document.createElement(
                    "div"
                );

            fileChildren.className =
                "right-tree-children";

            schedules.forEach(
                schedule=>{

                    const reportStore =
                        state.reports[
                            schedule.id
                        ] ||
                        {};

                    const completedReports =
                        REPORTS.filter(
                            report =>
                                reportStore[
                                    report.id
                                ]
                        );

                    if(!completedReports.length)
                        return;

                    const scheduleNode =
                        document.createElement(
                            "div"
                        );

                    scheduleNode.className =
                        "right-tree-node";

                    const scheduleHeader =
                        document.createElement(
                            "button"
                        );

                    scheduleHeader.className =
                        "right-tree-header";

                    scheduleHeader.innerHTML = `
                        <span class="file-arrow">▸</span>

                        <span class="report-icon" style="width:20px;height:20px;flex:0 0 20px">
                            ▦
                        </span>

                        <span class="file-name">
                            ${escapeHTML(schedule.name)}
                        </span>

                        <span class="file-count">
                            ${completedReports.length}
                        </span>
                    `;

                    scheduleHeader.onclick =
                        ()=>{

                            scheduleNode
                                .classList
                                .toggle(
                                    "open"
                                );

                            scheduleHeader
                                .querySelector(
                                    ".file-arrow"
                                )
                                .textContent =
                                    scheduleNode
                                        .classList
                                        .contains(
                                            "open"
                                        )
                                        ? "▾"
                                        : "▸";
                        };

                    scheduleNode.appendChild(
                        scheduleHeader
                    );

                    const scheduleChildren =
                        document.createElement(
                            "div"
                        );

                    scheduleChildren.className =
                        "right-tree-children";

                    completedReports.forEach(
                        report=>{

                            const data =
                                reportStore[
                                    report.id
                                ];

                            const row =
                                document.createElement(
                                    "div"
                                );

                            row.className =
                                "right-report-row";

                            row.innerHTML = `
                                <span class="report-icon" style="width:20px;height:20px;flex:0 0 20px">
                                    ${report.icon}
                                </span>

                                <span class="right-report-name">
                                    ${escapeHTML(data.title)}
                                </span>

                                <button class="right-report-button" data-action="open">
                                    Open
                                </button>

                                <button class="right-report-button" data-action="pdf">
                                    PDF
                                </button>
                            `;

                            row
                                .querySelector(
                                    '[data-action="open"]'
                                )
                                .onclick =
                                    async event=>{

                                        event.stopPropagation();

                                        if(
                                            getActiveSchedule()?.id !==
                                            schedule.id
                                        ){

                                            state.activeSchedules =
                                                new Set([
                                                    schedule.id
                                                ]);

                                            state.recommendations =
                                                state.recommendationsBySchedule[
                                                    schedule.id
                                                ] ||
                                                [];

                                            renderScheduleTree();
                                            updateWorkspaceMeta();
                                        }

                                        state.currentReport =
                                            report.id;

                                        renderReportList();
                                        renderReport(
                                            data
                                        );

                                        document.getElementById(
                                            "workspaceTitle"
                                        ).textContent =
                                            report.name;

                                        renderRightPane();
                                    };

                            row
                                .querySelector(
                                    '[data-action="pdf"]'
                                )
                                .onclick =
                                    event=>{

                                        event.stopPropagation();

                                        downloadReport(
                                            report.id,
                                            schedule.id
                                        );
                                    };

                            scheduleChildren.appendChild(
                                row
                            );
                        }
                    );

                    scheduleNode.appendChild(
                        scheduleChildren
                    );

                    fileChildren.appendChild(
                        scheduleNode
                    );
                }
            );

            fileNode.appendChild(
                fileChildren
            );

            reportsContainer.appendChild(
                fileNode
            );
        }
    );

    if(!completedCount){

        reportsContainer.innerHTML = `
            <div class="tree-empty">
                Reports are generated automatically after a schedule is loaded.
            </div>
        `;
    }

    document.getElementById(
        "rightReportCount"
    ).textContent =
        completedCount;

    const active =
        getActiveSchedule();

    const recommendations =
        active
            ? state.recommendationsBySchedule[
                active.id
            ] ||
              []
            : [];

    document.getElementById(
        "rightRecommendationCount"
    ).textContent =
        recommendations.length;

    if(!active){

        recommendationContainer.innerHTML = `
            <div class="tree-empty">
                Select a schedule to view recommendations.
            </div>
        `;

        return;
    }

    if(!recommendations.length){

        recommendationContainer.innerHTML = `
            <div class="tree-empty">
                No recommendations have been generated for
                ${escapeHTML(active.name)}.
            </div>
        `;

        return;
    }

    recommendations.forEach(
        recommendation=>{

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "recommendation";

            card.innerHTML = `
                <div class="rec-title">
                    ${escapeHTML(recommendation.title)}
                </div>

                <div class="rec-body">
                    ${escapeHTML(recommendation.description)}
                </div>

                <span class="rec-tag">
                    ${escapeHTML(recommendation.priority)}
                </span>
            `;

            recommendationContainer.appendChild(
                card
            );
        }
    );
}

let pdfLibraryPromise = null;

function ensurePDFLibrary(){

    if(
        typeof window.html2pdf ===
        "function"
    ){
        return Promise.resolve();
    }

    if(pdfLibraryPromise){
        return pdfLibraryPromise;
    }

    pdfLibraryPromise =
        new Promise(
            (resolve,reject)=>{

                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

                script.onload =
                    ()=>{

                        if(
                            typeof window.html2pdf ===
                            "function"
                        ){
                            resolve();
                        }else{
                            reject(
                                new Error(
                                    "PDF library loaded but did not initialise."
                                )
                            );
                        }
                    };

                script.onerror =
                    ()=>reject(
                        new Error(
                            "Could not load the browser PDF library."
                        )
                    );

                document.head.appendChild(
                    script
                );
            }
        );

    return pdfLibraryPromise;
}

function openReportModal(){

    const active =
        getActiveSchedule();

    const report =
        currentReportObject ||
        (
            active &&
            state.currentReport
                ? getReportForSchedule(
                    active.id,
                    state.currentReport
                )
                : null
        );

    if(!report)
        return;

    currentReportObject =
        report;

    document.getElementById(
        "modalTitle"
    ).textContent =
        report.title;

    document.getElementById(
        "modalSubtitle"
    ).textContent =
        report.subtitle;

    document.getElementById(
        "modalContent"
    ).innerHTML =
        report.html;

    document.getElementById(
        "modal"
    ).classList.add(
        "open"
    );
}

function closeModal(){

    document.getElementById(
        "modal"
    ).classList.remove(
        "open"
    );
}

function modalBackgroundClick(event){

    if(
        event.target.id ===
        "modal"
    ){
        closeModal();
    }
}

function downloadCurrentReport(){

    if(
        currentReportObject
    ){

        downloadReport(
            currentReportObject.id,
            currentReportObject.scheduleId ||
            getActiveSchedule()?.id
        );
    }
}

async function downloadReport(
    id,
    scheduleId=null
){

    const resolvedScheduleId =
        scheduleId ||
        getActiveSchedule()?.id;

    const schedule =
        getScheduleById(
            resolvedScheduleId
        );

    const report =
        getReportForSchedule(
            resolvedScheduleId,
            id
        );

    if(
        !schedule ||
        !report
    ){
        return;
    }

    try{

        await ensurePDFLibrary();

    }catch(error){

        console.error(
            "PDF library load failed:",
            error
        );

        alert(
            "The PDF export library could not be loaded. Check your internet connection and try again."
        );

        return;
    }

    const exportContainer =
        document.createElement(
            "div"
        );

    exportContainer.className =
        "pdf-export";

    exportContainer.innerHTML = `
        <div class="pdf-cover">
            <div class="pdf-brand">
                Schedule Intelligence & Project Controls
            </div>

            <h1>
                ${escapeHTML(report.title)}
            </h1>

            <p>
                ${escapeHTML(report.subtitle)}
            </p>

            <table class="pdf-meta-table">
                <tr>
                    <th>Schedule</th>
                    <td>${escapeHTML(schedule.name)}</td>
                </tr>
                <tr>
                    <th>Format</th>
                    <td>${escapeHTML(schedule.format)}</td>
                </tr>
                <tr>
                    <th>Data date</th>
                    <td>${formatDate(schedule.statusDate)}</td>
                </tr>
                <tr>
                    <th>Generated</th>
                    <td>${new Date(report.generatedAt || Date.now()).toLocaleString()}</td>
                </tr>
            </table>
        </div>

        <div class="pdf-report-body">
            ${report.html}
        </div>
    `;

    if(report.id === "gantt"){
        setTimeout(initialiseGanttInteractions,0);
    }

    document.body.appendChild(
        exportContainer
    );

    if(id === "scurve"){

        const canvas =
            exportContainer.querySelector(
                "canvas"
            );

        if(canvas){

            canvas.id =
                `pdf-chart-${crypto.randomUUID()}`;

            drawSCurve(
                canvas.id,
                buildTimeSeries(
                    schedule.activities
                ),
                "scurve"
            );

            await sleep(40);
        }
    }

    try{

        const options = {
            margin:[
                8,
                8,
                10,
                8
            ],
            filename:
                safeFilename(
                    `${schedule.name} - ${report.title}`
                ) +
                ".pdf",
            image:{
                type:"jpeg",
                quality:.96
            },
            html2canvas:{
                scale:1.6,
                useCORS:true,
                backgroundColor:"#ffffff",
                logging:false
            },
            jsPDF:{
                unit:"mm",
                format:"a4",
                orientation:
                    (
                        id === "comparison" ||
                        id === "delay" ||
                        id === "gantt" ||
                        id === "forensic"
                    )
                        ? "landscape"
                        : "portrait"
            },
            pagebreak:{
                mode:[
                    "css",
                    "legacy"
                ],
                avoid:[
                    ".metric",
                    ".analysis-row",
                    ".recommendation"
                ]
            }
        };

        await window
            .html2pdf()
            .set(
                options
            )
            .from(
                exportContainer
            )
            .save();

    }catch(error){

        console.error(
            "PDF generation failed:",
            error
        );

        alert(
            `The PDF could not be generated: ${error?.message || "Unknown error"}`
        );

    }finally{

        exportContainer.remove();
    }
}

async function sendChat(){

    const input =
        document.getElementById(
            "chatInput"
        );

    const question =
        input.value.trim();

    if(
        !question ||
        state.aiBusy
    ){
        return;
    }

    const schedule =
        getActiveSchedule();

    if(!schedule){

        addChat(
            "assistant",
            "Please select an active schedule first."
        );

        return;
    }

    input.value = "";

    addChat(
        "user",
        question
    );

    state.aiBusy = true;

    updateChatButton();

    const loading =
        addChat(
            "assistant",
            "Analysing the selected schedule..."
        );

    try{

        const answer =
            await askAI(
                question,
                schedule
            );

        loading
            ?.querySelector(
                ".chat-body"
            )
            ?.replaceChildren();

        if(loading){

            loading
                .querySelector(
                    ".chat-body"
                )
                .innerHTML =
                    simpleMarkdown(
                        answer
                    );

        }else{

            addChat(
                "assistant",
                answer
            );
        }

        state.chat.push(
            {
                role:"user",
                content:question,
                scheduleId:
                    schedule.id
            },
            {
                role:"assistant",
                content:answer,
                scheduleId:
                    schedule.id
            }
        );

    }catch(error){

        console.error(
            "AI chat failed:",
            error
        );

        const errorText =
            `The AI review could not complete. ${error?.message || "Unknown AI error"}`;

        if(loading){

            loading
                .querySelector(
                    ".chat-body"
                )
                .innerHTML =
                    simpleMarkdown(
                        errorText
                    );

        }else{

            addChat(
                "assistant",
                errorText
            );
        }

        state.chat.push(
            {
                role:"user",
                content:question,
                scheduleId:
                    schedule.id
            },
            {
                role:"assistant",
                content:errorText,
                scheduleId:
                    schedule.id
            }
        );

    }finally{

        state.aiBusy = false;

        updateChatButton();

        scheduleSave();
    }
}

function addChat(
    role,
    text
){

    const container =
        document.getElementById(
            "chatMessages"
        );

    const message =
        document.createElement(
            "div"
        );

    message.className =
        "chat-message " +
        role;

    message.innerHTML = `

        <div class="chat-avatar">
            ${role==="user" ? "You":"✦"}
        </div>

        <div class="chat-body">
            ${simpleMarkdown(text)}
        </div>
    `;

    container.appendChild(
        message
    );

    container.scrollTop =
        container.scrollHeight;

    return message;
}

function clearChat(){

    const activeId =
        getActiveSchedule()?.id;

    if(activeId){

        state.chat =
            state.chat.filter(
                message =>
                    message.scheduleId &&
                    message.scheduleId !==
                    activeId
            );

    }else{

        state.chat = [];
    }

    document.getElementById(
        "chatMessages"
    ).innerHTML = `
        <div class="chat-message assistant">
            <div class="chat-avatar">✦</div>
            <div class="chat-body">
                Chat cleared. Ask a question about the selected schedule.
            </div>
        </div>
    `;

    scheduleSave();
}

function chatKeyDown(event){

    if(
        event.key === "Enter" &&
        !event.shiftKey
    ){

        event.preventDefault();

        sendChat();
    }
}

function updateChatButton(){

    const button =
        document.getElementById(
            "chatSend"
        );

    const input =
        document.getElementById(
            "chatInput"
        );

    if(
        !button ||
        !input
    ){
        return;
    }

    button.disabled =
        !state.aiReady ||
        state.aiBusy ||
        !getActiveSchedule() ||
        !input.value.trim();
}

function newProject(){

    if(
        state.schedules.length ||
        Object.keys(
            state.reports ||
            {}
        ).length
    ){

        if(
            !confirm(
                "Start a new project? The current project will remain saved locally if you have already saved it."
            )
        ){
            return;
        }
    }

    state.files = [];
    state.schedules = [];
    state.activeSchedules =
        new Set();
    state.reports = {};
    state.reportJobs = {};
    state.currentReport = null;
    state.recommendations = [];
    state.recommendationsBySchedule = {};
    state.comparisonScheduleBySchedule = {};
    state.weekComparisonBySchedule = {};
    state.delayBaselineBySchedule = {};
    state.forensicBaselineBySchedule = {};
    state.monteSettingsBySchedule = {};
    state.chat = [];
    state.projectId = null;
    state.projectName =
        "Untitled project";

    currentReportObject =
        null;

    renderScheduleTree();
    renderReportList();
    renderRightPane();
    updateWorkspaceMeta();

    document.getElementById(
        "workspaceTitle"
    ).textContent =
        "Schedule Intelligence";

    document.getElementById(
        "autoReportStatus"
    ).textContent =
        "Reports build automatically when a schedule is loaded.";

    renderNoScheduleReport();

    document.getElementById(
        "chatMessages"
    ).innerHTML = `
        <div class="chat-message assistant">
            <div class="chat-avatar">✦</div>
            <div class="chat-body">
                Upload a schedule and ask about critical path, float, logic, delay, cost, schedule quality, forecast completion or any report.
            </div>
        </div>
    `;

    updateChatButton();
}

function metric(
    label,
    value,
    note,
    colour
){

    return `
        <div class="metric">

            <div class="metric-label">
                ${escapeHTML(label)}
            </div>

            <div class="
                metric-value
                status-${colour}
            ">
                ${escapeHTML(value)}
            </div>

            <div class="metric-note">
                ${escapeHTML(note)}
            </div>

        </div>
    `;
}

function scheduleTable(schedules){

    return `
        <div class="panel">

            <div class="panel-title">
                Active schedules
            </div>

            <table>

                <thead>

                    <tr>
                        <th>Schedule</th>
                        <th>Format</th>
                        <th>Activities</th>
                        <th>Start</th>
                        <th>Finish</th>
                        <th>Status date</th>
                    </tr>

                </thead>

                <tbody>

                    ${schedules.map(
                        s=>`

                        <tr>

                            <td>
                                <strong>
                                    ${escapeHTML(
                                        s.name
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${s.format}
                            </td>

                            <td>
                                ${s.activities.length}
                            </td>

                            <td>
                                ${formatDate(
                                    s.plannedStart
                                )}
                            </td>

                            <td>
                                ${formatDate(
                                    s.plannedFinish
                                )}
                            </td>

                            <td>
                                ${formatDate(
                                    s.statusDate
                                )}
                            </td>

                        </tr>
                    `).join("")}

                </tbody>

            </table>

        </div>
    `;
}

function activityRiskTable(activities){

    return `
        <table>

            <thead>

                <tr>
                    <th>ID</th>
                    <th>Activity</th>
                    <th>Float</th>
                    <th>Progress</th>
                    <th>Constraint</th>
                </tr>

            </thead>

            <tbody>

                ${activities.map(
                    a=>`

                    <tr>

                        <td>
                            ${escapeHTML(a.id)}
                        </td>

                        <td>
                            ${escapeHTML(a.name)}
                        </td>

                        <td class="${
                            a.totalFloat<0
                                ? "status-danger"
                                : ""
                        }">
                            ${formatNumber(
                                a.totalFloat
                            )}
                        </td>

                        <td>
                            ${formatPercent(
                                a.percent
                            )}
                        </td>

                        <td>
                            ${
                                a.constraint
                                    ? `<span class="pill warning">Yes</span>`
                                    : "—"
                            }
                        </td>

                    </tr>
                `).join("")}

            </tbody>

        </table>
    `;
}

function costTable(activities){

    return `
        <table>

            <thead>

                <tr>
                    <th>ID</th>
                    <th>Activity</th>
                    <th>Budget</th>
                    <th>Actual</th>
                    <th>Forecast</th>
                </tr>

            </thead>

            <tbody>

                ${activities.map(
                    a=>`

                    <tr>

                        <td>
                            ${escapeHTML(a.id)}
                        </td>

                        <td>
                            ${escapeHTML(a.name)}
                        </td>

                        <td>
                            ${currency(a.budget)}
                        </td>

                        <td>
                            ${currency(a.actualCost)}
                        </td>

                        <td>
                            ${currency(a.forecastCost)}
                        </td>

                    </tr>
                `).join("")}

            </tbody>

        </table>
    `;
}

function timeSeriesTable(points){

    if(!points.length)
        return "<p>No usable date information.</p>";

    return `
        <table>

            <thead>
                <tr>
                    <th>Period</th>
                    <th>Planned cumulative</th>
                    <th>Actual cumulative</th>
                    <th>Forecast cumulative</th>
                    <th>Histogram</th>
                </tr>
            </thead>

            <tbody>

                ${points.map(
                    p=>`

                    <tr>

                        <td>
                            ${p.date.toLocaleDateString(
                                undefined,
                                {
                                    month:"short",
                                    year:"numeric"
                                }
                            )}
                        </td>

                        <td>${p.planned}</td>
                        <td>${p.actual}</td>
                        <td>${p.forecast}</td>
                        <td>${p.histogram}</td>

                    </tr>
                `).join("")}

            </tbody>

        </table>
    `;
}

function timeSeriesText(points){

    return points.map(
        p =>
            `${p.date.toISOString().slice(0,7)} planned=${p.planned} actual=${p.actual} forecast=${p.forecast} histogram=${p.histogram}`
    ).join("\n");
}

function activityStatusCounts(activities){

    return {
        complete:
            activities.filter(
                a=>a.percent>=100
            ).length,

        progress:
            activities.filter(
                a =>
                    a.percent>0 &&
                    a.percent<100
            ).length,

        notStarted:
            activities.filter(
                a=>a.percent<=0
            ).length
    };
}

function weightedProgress(activities){

    if(!activities.length)
        return 0;

    return activities.reduce(
        (sum,a)=>
            sum +
            Math.max(
                0,
                Math.min(
                    100,
                    a.percent || 0
                )
            ),
        0
    ) /
    activities.length;
}

function latestDate(values){

    const dates =
        values
            .filter(Boolean)
            .map(
                x=>new Date(x)
            )
            .filter(
                d=>!Number.isNaN(
                    d.getTime()
                )
            );

    if(!dates.length)
        return null;

    return new Date(
        Math.max(
            ...dates.map(
                d=>d.getTime()
            )
        )
    ).toISOString();
}

function percentile(sorted,p){

    if(!sorted.length)
        return Date.now();

    const index =
        Math.min(
            sorted.length-1,
            Math.max(
                0,
                Math.floor(
                    p *
                    sorted.length
                )
            )
        );

    return sorted[index];
}

function currency(value){

    const n =
        Number(value) || 0;

    return n.toLocaleString(
        undefined,
        {
            style:"currency",
            currency:"EUR",
            maximumFractionDigits:0
        }
    );
}

function simpleMarkdown(text){

    let html =
        escapeHTML(
            String(text || "")
        );

    html =
        html.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );

    html =
        html.replace(
            /^### (.*?)$/gm,
            "<strong>$1</strong>"
        );

    html =
        html.replace(
            /^- (.*?)$/gm,
            "• $1"
        );

    html =
        html.replace(
            /\n/g,
            "<br>"
        );

    return html;
}

function escapeHTML(value){

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

function safeFilename(value){

    return String(
        value ||
        "schedule-report"
    )
        .replace(
            /[<>:"/\\|?*]+/g,
            "-"
        )
        .replace(
            /\s+/g,
            "-"
        )
        .slice(
            0,
            120
        );
}

function downloadFile(
    content,
    filename,
    mime
){

    const blob =
        new Blob(
            [content],
            {type:mime}
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(
        () =>
            URL.revokeObjectURL(url),
        1000
    );
}

function scheduleSummary(schedule){

    const a =
        schedule.activities;

    return `${schedule.name}: ${a.length} activities, ${formatPercent(weightedProgress(a))} progress, ${a.filter(x=>x.critical||x.totalFloat<=0).length} critical/zero-float, ${a.filter(x=>x.totalFloat<0).length} negative-float, forecast finish ${formatDate(latestDate(a.map(x=>x.finish)))}.`;
}

function initialiseTheme(){

    const saved =
        localStorage.getItem(
            "scheduleIntelligenceTheme"
        );

    if(saved === "light"){

        document.documentElement
            .classList
            .remove(
                "dark-mode"
            );

    }else{

        document.documentElement
            .classList
            .add(
                "dark-mode"
            );
    }

    updateThemeToggle();
}

function updateThemeToggle(){

    const button =
        document.getElementById(
            "themeToggle"
        );

    if(!button)
        return;

    const dark =
        document.documentElement
            .classList
            .contains(
                "dark-mode"
            );

    button.textContent =
        dark
            ? "☀"
            : "☾";

    button.title =
        dark
            ? "Switch to light mode"
            : "Switch to dark mode";

    button.setAttribute(
        "aria-label",
        button.title
    );
}

function toggleTheme(){

    const dark =
        document.documentElement
            .classList
            .toggle(
                "dark-mode"
            );

    localStorage.setItem(
        "scheduleIntelligenceTheme",
        dark
            ? "dark"
            : "light"
    );

    updateThemeToggle();

    if(
        state.currentReport ===
        "scurve"
    ){

        const report =
            getActiveSchedule()
                ? getReportForSchedule(
                    getActiveSchedule().id,
                    "scurve"
                )
                : null;

        if(report){
            renderReport(report);
        }
    }
}

function restoreChat(){

    const container =
        document.getElementById(
            "chatMessages"
        );

    container.innerHTML = "";

    const activeId =
        getActiveSchedule()?.id;

    const messages =
        activeId
            ? state.chat.filter(
                message =>
                    !message.scheduleId ||
                    message.scheduleId ===
                    activeId
            )
            : [];

    if(!messages.length){

        addChat(
            "assistant",
            "Upload/select a schedule and ask about critical path, delay, cost, float, logic, forensic changes or schedule health."
        );

        return;
    }

    messages.forEach(
        message =>
            addChat(
                message.role,
                message.content
            )
    );
}

async function initialise(){

    initialiseTheme();

    renderReportList();
    renderScheduleTree();
    renderRightPane();
    updateWorkspaceMeta();

    let restoredProject =
        null;

    try{

        const db =
            await dbOpen();

        const projects =
            await new Promise(
                (resolve,reject)=>{

                    const request =
                        db
                            .transaction(
                                STORE,
                                "readonly"
                            )
                            .objectStore(
                                STORE
                            )
                            .getAll();

                    request.onsuccess =
                        () =>
                            resolve(
                                request.result
                            );

                    request.onerror =
                        () =>
                            reject(
                                request.error
                            );
                }
            );

        db.close();

        if(projects.length){

            projects.sort(
                (a,b)=>
                    b.updatedAt -
                    a.updatedAt
            );

            const project =
                projects[0];

            if(
                project &&
                confirm(
                    `Restore the last saved project "${project.name}"?`
                )
            ){

                restoredProject =
                    project;

                state.projectId =
                    project.id;

                state.projectName =
                    project.name ||
                    "Untitled project";

                state.files =
                    project.files ||
                    [];

                state.schedules =
                    project.schedules ||
                    [];

                const restoredActive =
                    (
                        project.activeSchedules ||
                        []
                    )
                        .find(
                            id =>
                                state.schedules.some(
                                    schedule =>
                                        schedule.id ===
                                        id
                                )
                        ) ||
                    state.schedules[0]?.id ||
                    null;

                state.activeSchedules =
                    restoredActive
                        ? new Set([
                            restoredActive
                        ])
                        : new Set();

                const restoredReports =
                    project.reports ||
                    {};

                const looksFlat =
                    Object.keys(
                        restoredReports
                    )
                        .some(
                            key =>
                                REPORTS.some(
                                    report =>
                                        report.id ===
                                        key
                                )
                        );

                if(
                    looksFlat &&
                    restoredActive
                ){

                    state.reports = {
                        [restoredActive]:
                            restoredReports
                    };

                    Object.values(
                        state.reports[
                            restoredActive
                        ]
                    )
                        .forEach(
                            report=>{

                                if(report){
                                    report.scheduleId =
                                        restoredActive;
                                }
                            }
                        );

                }else{

                    state.reports =
                        restoredReports;
                }

                state.currentReport =
                    project.currentReport ||
                    "health";

                state.recommendations =
                    project.recommendations ||
                    [];

                state.recommendationsBySchedule =
                    project.recommendationsBySchedule ||
                    (
                        restoredActive
                            ? {
                                [restoredActive]:
                                    state.recommendations
                              }
                            : {}
                    );

                state.comparisonScheduleBySchedule =
                    project.comparisonScheduleBySchedule ||
                    {};

                state.weekComparisonBySchedule =
                    project.weekComparisonBySchedule ||
                    {};

                state.delayBaselineBySchedule =
                    project.delayBaselineBySchedule ||
                    {};

                state.forensicBaselineBySchedule =
                    project.forensicBaselineBySchedule ||
                    {};

                state.monteSettingsBySchedule =
                    project.monteSettingsBySchedule ||
                    {};

                state.chat =
                    project.chat ||
                    [];

                if(
                    project.aiModelValue &&
                    MODEL_CATALOG.some(
                        model =>
                            model.value ===
                            project.aiModelValue
                    )
                ){

                    localStorage.setItem(
                        "scheduleIntelligenceAIModel",
                        project.aiModelValue
                    );
                }

                const active =
                    getActiveSchedule();

                if(active){

                    state.recommendations =
                        state.recommendationsBySchedule[
                            active.id
                        ] ||
                        state.recommendations ||
                        [];
                }

                renderScheduleTree();
                renderReportList();
                renderRightPane();
                updateWorkspaceMeta();
                restoreChat();

                const report =
                    active
                        ? getReportForSchedule(
                            active.id,
                            state.currentReport
                        ) ||
                          getReportForSchedule(
                              active.id,
                              "health"
                          )
                        : null;

                if(report){

                    state.currentReport =
                        report.id;

                    renderReportList();
                    renderReport(
                        report
                    );

                    document.getElementById(
                        "workspaceTitle"
                    ).textContent =
                        REPORTS.find(
                            item =>
                                item.id ===
                                report.id
                        )?.name ||
                        report.title;

                }else if(active){

                    renderBuildPlaceholder(
                        REPORTS.find(
                            report =>
                                report.id ===
                                "health"
                        )
                    );

                }else{

                    renderNoScheduleReport();
                }
            }
        }

    }catch(error){

        console.warn(
            "Could not restore saved project:",
            error
        );
    }

    await initialiseAI();

    if(restoredProject){

        for(const schedule of state.schedules){

            const store =
                ensureReportStore(
                    schedule.id
                );

            const missing =
                REPORTS.some(
                    report =>
                        !store[
                            report.id
                        ]
                );

            if(missing){

                document.getElementById(
                    "autoReportStatus"
                ).textContent =
                    `Updating reports: ${schedule.name}...`;

                await buildAllReportsForSchedule(
                    schedule.id
                );
            }
        }

        document.getElementById(
            "autoReportStatus"
        ).textContent =
            "All automatic reports complete.";

        const active =
            getActiveSchedule();

        if(active){

            await openReport(
                state.currentReport ||
                "health"
            );
        }
    }

    renderRightPane();
    updateChatButton();
}

initialise();
