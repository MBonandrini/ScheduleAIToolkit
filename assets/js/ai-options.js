(function(){
    const core=window.parent&&window.parent.ProjectControlsCore;
    if(!core||!core.ai||!Array.isArray(core.ai.catalog)) return;
    function renderSelect(select){
        const preferred=core.ai.preferred();
        const entry=core.ai.catalog.find(item=>item.value===preferred&&!item.disabled)||core.ai.catalog.find(item=>item.value==="ollama:auto");
        const heuristic=select.dataset.includeHeuristic==="true";
        select.classList.add("shared-ai-select");
        select.removeAttribute("onchange");
        select.innerHTML="";
        const option=document.createElement("option");
        option.value=entry.value; option.textContent=`${entry.label} — managed in Settings`;
        select.appendChild(option);
        if(heuristic){
            const h=document.createElement("option"); h.value="heuristic"; h.textContent="Deterministic schedule analysis — no AI model"; select.appendChild(h);
        }
        select.value=entry.value;
        select.disabled=true;
        select.title="AI selection is managed globally from the Settings tab.";
    }
    document.querySelectorAll("select[data-ai-model-select]").forEach(renderSelect);
    window.addEventListener("message",event=>{if(event.data?.type==="pc-ai-config-changed") document.querySelectorAll("select[data-ai-model-select]").forEach(renderSelect)});
})();
