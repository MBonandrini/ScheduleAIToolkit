(function(){
    const core=window.parent&&window.parent.ProjectControlsCore;
    if(!core||!core.ai||!Array.isArray(core.ai.catalog)) return;
    const groups=[
        {label:"OmniRoute",test:item=>item.engine==="omniroute"},
        {label:"Browser / local models",test:item=>item.engine==="cpu"},
        {label:"Local WebGPU models",test:item=>item.engine==="mlc"},
        {label:"Coming soon",test:item=>item.engine==="placeholder"}
    ];
    const saved=(()=>{try{
        const value=localStorage.getItem("projectControlsSharedAIModel")||"omniroute:auto";
        return core.ai.catalog.some(item=>item.value===value&&!item.disabled)?value:"omniroute:auto";
    }catch(_){return "omniroute:auto"}})();
    document.querySelectorAll("select[data-ai-model-select]").forEach(select=>{
        select.classList.add("shared-ai-select");
        select.removeAttribute("onchange");
        const heuristic=select.dataset.includeHeuristic==="true";
        select.innerHTML="";
        groups.forEach(group=>{
            const items=core.ai.catalog.filter(group.test);
            if(!items.length) return;
            const optgroup=document.createElement("optgroup");
            optgroup.label=group.label;
            items.forEach(item=>{
                const option=document.createElement("option");
                option.value=item.value;
                option.textContent=item.disabled?`${item.label} — coming soon`:item.label;
                option.disabled=!!item.disabled;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });
        if(heuristic){
            const group=document.createElement("optgroup");
            group.label="Analysis only";
            const option=document.createElement("option");
            option.value="heuristic";
            option.textContent="Deterministic schedule analysis — no AI model";
            group.appendChild(option);
            select.appendChild(group);
        }
        const values=[...select.options].filter(option=>!option.disabled).map(option=>option.value);
        select.value=values.includes(saved)?saved:"omniroute:auto";
        select.dataset.previousAiValue=select.value;
        select.addEventListener("focus",()=>{select.dataset.previousAiValue=select.value});
        select.addEventListener("change",async()=>{
            const next=select.value;
            const previous=select.dataset.previousAiValue||"omniroute:auto";
            select.disabled=true;
            try{
                if(typeof window.changeModel==="function") await window.changeModel(next);
                select.dataset.previousAiValue=next;
            }catch(error){
                select.value=previous;
                window.alert(error?.message||"The selected AI option could not be started.");
            }finally{
                select.disabled=false;
            }
        });
    });
})();
