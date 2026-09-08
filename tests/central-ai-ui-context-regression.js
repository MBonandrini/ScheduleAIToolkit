const fs=require("fs"),path=require("path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const index=read("index.html");
const modules=[
 "apps/contract-manager/app.js","apps/drawing-measurement/app.js",
 "apps/claims-forensics/app.js","apps/schedule-builder/app.js",
 "apps/schedule-assessment/app.js","apps/risk-analysis/app.js",
 "apps/notebooklmplus/js/app.js"
].map(read).join("\n");
const moduleHtml=[
 "apps/contract-manager/index.html","apps/drawing-measurement/index.html",
 "apps/claims-forensics/index.html","apps/schedule-builder/index.html",
 "apps/schedule-assessment/index.html","apps/risk-analysis/index.html",
 "apps/notebooklmplus/index.html"
].map(read).join("\n");
const checks=[
 ["single global AI selector remains",(index.match(/id="globalModelSelect"/g)||[]).length===1],
 ["no mini-tool engine/model status UI",!/id="engine(?:Status|Text|Dot)"|class="engine-status"|class="engine"|id="ollamaStatusPill"/i.test(moduleHtml)],
 ["no obsolete Shared AI status wording",!/Shared AI ready|model loads on first use|configured in Settings/i.test(modules)],
 ["no removed OmniRoute wording",!/OmniRoute/i.test(index+modules)],
 ["local empty-source prompts do not claim there are no project documents",!/No project documents have been uploaded/i.test(modules)],
 ["contract analysis is not blocked solely by local sources",!/Upload the project information first/i.test(read("apps/contract-manager/app.js"))],
 ["claims analysis is not blocked solely by local sources",!/Upload project records first/i.test(read("apps/claims-forensics/app.js"))],
 ["schedule builder is not blocked solely by local sources",!/Please upload some project information first/i.test(read("apps/schedule-builder/app.js"))],
 ["all app JS/CSS references are cache-versioned",Array.from(root?[]:[])!==null && [...fs.readdirSync(path.join(root,"apps"),{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name)].every(name=>{
   const f=path.join(root,"apps",name,"index.html");if(!fs.existsSync(f))return true;
   const h=fs.readFileSync(f,"utf8");const refs=[...h.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map(m=>m[1]).filter(u=>!/^https?:|^\/\//.test(u));
   return refs.every(u=>/[?&]v=20260908-central-ai-context-clean2/.test(u));
 })]
];
let bad=0;for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)bad++}
if(bad)process.exit(1);
