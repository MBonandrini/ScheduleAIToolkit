"use strict";

const TOOL_CONFIG = {
    contracts: { name: "Contract Manager", url: "./apps/contract-manager/index.html" },
    drawing: { name: "Drawing Measurement", url: "./apps/drawing-measurement/index.html" },
    assessment: { name: "Schedule Assessment", url: "./apps/schedule-assessment/index.html" },
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

async function destroyCurrent() {
    if (frame) {
        try {
            frame.src = "about:blank";
        } catch (_) {}
        frame.remove();
        frame = null;
    }
    const aiState = ProjectControlsCore.ai.status();
    if (aiState.engine === "cpu" || aiState.engine === "mlc") {
        await ProjectControlsCore.ai.release();
    }
}

async function activateTool(key) {
    const config = TOOL_CONFIG[key];
    if (!config || (key === activeTool && frame)) return;
    const run = ++token;
    activeTool = key;
    setTabs(key);
    loading.hidden = false;
    loading.textContent = `Opening ${config.name}…`;
    statusNode.textContent = "OmniRoute Auto · switching tool";
    await destroyCurrent();
    if (run !== token) return;

    const next = document.createElement("iframe");
    next.className = "tool-frame";
    next.title = config.name;
    next.referrerPolicy = "no-referrer";
    next.addEventListener("load", () => {
        if (run !== token) return;
        loading.hidden = true;
        statusNode.textContent = ProjectControlsCore.ai.status().label === "AI idle" ? "OmniRoute Auto · AI on demand" : ProjectControlsCore.ai.status().label;
        try{next.contentWindow.postMessage({type:"pc-theme",theme:document.documentElement.dataset.theme||"light"},"*")}catch(_){}
    }, { once: true });

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


const aiSettingsButton=document.getElementById("aiSettingsButton");
const aiModal=document.getElementById("aiModal");
const aiModalClose=document.getElementById("aiModalClose");
const omniBaseUrl=document.getElementById("omniBaseUrl");
const omniApiKey=document.getElementById("omniApiKey");
const aiSaveButton=document.getElementById("aiSaveButton");
const aiTestButton=document.getElementById("aiTestButton");
const aiModalStatus=document.getElementById("aiModalStatus");

function openAiSettings(){
    const config=ProjectControlsCore.ai.config();
    omniBaseUrl.value=config.baseUrl;
    omniApiKey.value=config.apiKey;
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
    ProjectControlsCore.ai.configure({baseUrl:omniBaseUrl.value,apiKey:omniApiKey.value});
    aiModalStatus.textContent="OmniRoute settings saved.";
    statusNode.textContent="OmniRoute Auto · configured";
});
aiTestButton.addEventListener("click",async()=>{
    ProjectControlsCore.ai.configure({baseUrl:omniBaseUrl.value,apiKey:omniApiKey.value});
    aiTestButton.disabled=true;
    aiModalStatus.textContent="Testing OmniRoute…";
    try{
        const result=await ProjectControlsCore.ai.testConnection();
        aiModalStatus.textContent=`Connected successfully${result.content?`: ${result.content}`:"."}`;
        statusNode.textContent="OmniRoute Auto · connected";
    }catch(error){
        aiModalStatus.textContent=error?.message || "OmniRoute connection failed.";
        statusNode.textContent="OmniRoute · connection required";
    }finally{
        aiTestButton.disabled=false;
    }
});

document.addEventListener("pc-theme-change",event=>{try{if(frame&&frame.contentWindow)frame.contentWindow.postMessage({type:"pc-theme",theme:event.detail.theme},"*")}catch(_){}});
window.addEventListener("message",event=>{if(event.data&&event.data.type==="pc-theme"){try{if(frame&&frame.contentWindow&&event.source!==frame.contentWindow)frame.contentWindow.postMessage(event.data,"*")}catch(_){}}});
