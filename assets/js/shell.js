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
    statusNode.textContent = "Shared Core 3.0 · switching tool";
    await destroyCurrent();
    if (run !== token) return;

    const next = document.createElement("iframe");
    next.className = "tool-frame";
    next.title = config.name;
    next.referrerPolicy = "no-referrer";
    next.addEventListener("load", () => {
        if (run !== token) return;
        loading.hidden = true;
        statusNode.textContent = "Shared CSS · parser · schedule model · AI";
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
