
import {performance} from "node:perf_hooks";
const t=performance.now();
try{
  const mod=await import("./exhaustive.test.js");
  const result=await mod.run();
  console.log("PASS exhaustive stress/volume/boundary suite");
  console.log(JSON.stringify(result,null,2));
  console.log(`EXHAUSTIVE PASS · ${(performance.now()-t).toFixed(1)} ms`);
}catch(e){
  console.error("EXHAUSTIVE FAIL");
  console.error(e.stack||e);
  process.exit(1);
}
