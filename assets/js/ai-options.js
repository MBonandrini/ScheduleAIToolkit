(function(){
    const core=window.parent&&window.parent.ProjectControlsCore;
    if(!core||!core.ai||!Array.isArray(core.ai.catalog)) return;
    const groups=[
        {label:"OmniRoute — default intelligence",test:item=>item.engine==="omniroute"},
        {label:"Hosted fallback",test:item=>item.engine==="puter"},
        {label:"Lightweight browser AI",test:item=>item.value.startsWith("browserlite:")},
        {label:"Local CPU / WebAssembly",test:item=>item.engine==="cpu"&&!item.value.startsWith("browserlite:")},
        {label:"Local WebGPU — routed",test:item=>item.value.startsWith("webllmio:")},
        {label:"Local WebGPU — direct MLC",test:item=>item.value.startsWith("mlc:")}
    ];
    const saved=(()=>{try{return localStorage.getItem("projectControlsSharedAIModel")||"omniroute:auto"}catch(_){return "omniroute:auto"}})();
    document.querySelectorAll("select[data-ai-model-select]").forEach(select=>{
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
                option.textContent=item.label;
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
        const values=[...select.options].map(option=>option.value);
        select.value=values.includes(saved)?saved:"omniroute:auto";
    });
})();
