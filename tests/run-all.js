
import {performance} from "node:perf_hooks";
const quick=process.argv.includes("--quick");
const suites=[
  ["Parser & file import",()=>import("./parser.test.js")],
  ["Network/driving path",()=>import("./network.test.js")],
  ["Schedule comparison/golden movement",()=>import("./comparison.test.js")],
  ["Health, confidence, narrative, weekly series",()=>import("./health-timeseries.test.js")],
  ["Calendar & data-centre readiness",()=>import("./calendar-datacentre.test.js")],
  ["Risk/QSRA & claims",()=>import("./risk-claims.test.js")],
  ["Structured AI schedule tools",()=>import("./ai-tools.test.js")],
  ["MS Project XML golden",()=>import("./msp-golden.test.js")],
  ["Ollama native API compatibility",()=>import("./ollama.test.js")],
  ["Ollama failure/recovery paths",()=>import("./ollama-errors.test.js")],
  ["All restored browser AI models",()=>import("./browser-models.test.js")],
  ["Repository/multi-project integration",()=>import("./repository.integration.test.js")],
  ["Shared AI runtime + repository context",()=>import("./ai-runtime.integration.test.js")],
  ["All toolkit AI agent roles",()=>import("./all-agents.test.js")],
  ["Parser fuzz",()=>import("./fuzz.test.js")],
  ["Performance/volume",()=>import("./performance.test.js")],
  ["UI/GitHub Pages contracts",()=>import("./ui-contract.test.js")],
  ["Model catalogue + professional UI regression",()=>import("./model-ui-regression.test.js")],
  ["Master feature completeness contract",()=>import("./master-feature-contract.test.js")],
  ["GitHub Pages deployment/import graph",()=>import("./deployment.test.js")],
  ["Security",()=>import("./security.test.js")]
];
let failed=0,results=[];const totalStart=performance.now();
for(const [name,loader] of suites){
  const t=performance.now();
  try{const mod=await loader(),detail=await mod.run({quick});results.push({name,ok:true,ms:performance.now()-t,detail});console.log(`PASS ${name} (${(performance.now()-t).toFixed(1)} ms)`)}
  catch(e){failed++;results.push({name,ok:false,ms:performance.now()-t,error:e.stack||String(e)});console.error(`FAIL ${name}\n${e.stack||e}`)}
}
console.log(`\n${failed?"TEST FAILURE":"ALL TESTS PASS"} · ${suites.length-failed}/${suites.length} suites · ${(performance.now()-totalStart).toFixed(1)} ms`);
if(failed)process.exit(1);
