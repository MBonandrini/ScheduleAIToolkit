const fs=require("fs"),path=require("path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const index=read("index.html"),theme=read("assets/js/theme.js"),settings=read("apps/settings/app.js");
const mini=[
 "apps/contract-manager/index.html","apps/drawing-measurement/index.html",
 "apps/claims-forensics/index.html","apps/schedule-builder/index.html",
 "apps/schedule-assessment/index.html"
].map(read).join("\n");
const checks=[
 ["only top shell has AI model selector",(index.match(/id="globalModelSelect"/g)||[]).length===1],
 ["per-tool AI status pills removed",!mini.includes('class="engine-status"')&&!mini.includes('class="engine"')],
 ["per-tool engine status elements removed",!mini.includes('id="engineStatus"')&&!mini.includes('id="engineText"')&&!mini.includes('id="engineDot"')],
 ["tab icons removed",!index.includes('class="tab-icon"')],
 ["Schedule Builder precedes Settings",index.indexOf('data-tool="builder"')<index.indexOf('data-tool="settings"')],
 ["theme dropdown contains exactly requested three themes",["dark","light","navy"].every(v=>index.includes(`value="${v}"`))],
 ["removed themes absent from shell dropdown",!index.includes('value="slate"')&&!index.includes('value="midnight"')&&!index.includes('value="sand"')],
 ["theme runtime allows only requested themes",theme.includes('const allowed=["dark","light","navy"]')],
 ["Settings exposes requested themes",settings.includes('Light · Dark Blue Contrast')&&!settings.includes('value="slate"')&&!settings.includes('value="midnight"')&&!settings.includes('value="sand"')]
];
let bad=0;for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)bad++}
if(bad)process.exit(1);
