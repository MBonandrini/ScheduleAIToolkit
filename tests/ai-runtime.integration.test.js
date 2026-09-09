
import assert from "node:assert/strict";
import {syntheticXER} from "./helpers.js";

export async function run(){
  // This suite intentionally runs after repository.integration.test.js, which installs
  // the IndexedDB/localStorage browser shims used by the repository modules.
  const repo=await import("../src/repository/repository.js");
  const runtime=await import("../src/ai/runtime.js");
  const ollama=await import("../src/ai/ollama.js");

  const p=await repo.newProject("AI Integration Project");
  const xer=new File([syntheticXER(12,20)],"perun 3.xer",{type:"text/plain"});
  const note=new File(["Approved weekly report: switchgear is the principal management concern."],"weekly-report.txt",{type:"text/plain"});
  await repo.addFiles([xer,note],{category:"Project Evidence"});
  const schedules=await repo.listSchedules();
  assert.equal(schedules.length,1);
  const current=schedules[0];

  const calls=[];
  globalThis.location={origin:"https://example.github.io",href:"https://example.github.io/ScheduleAIToolkit/"};
  globalThis.fetch=async(url,opts={})=>{
    calls.push({url:String(url),opts});
    if(String(url).endsWith("/api/tags"))return new Response(JSON.stringify({models:[{name:"qwen3:4b"}]}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/api/show"))return new Response(JSON.stringify({capabilities:["completion"]}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/api/chat")){
      const body=JSON.parse(opts.body||"{}");
      const joined=(body.messages||[]).map(x=>x.content).join("\n");
      assert.ok(joined.includes("perun 3.xer"));
      assert.ok(joined.includes("switchgear is the principal management concern"));
      assert.ok(joined.includes("STRUCTURED SCHEDULE TOOL RESULT"));
      assert.ok(joined.includes("get_activity"));
      assert.ok(joined.includes("A000001"));
      return new Response(JSON.stringify({message:{content:"Grounded answer"}}),{status:200,headers:{"content-type":"application/json"}});
    }
    throw new Error("Unexpected "+url);
  };

  ollama.saveOllamaConfig({baseUrl:"http://localhost:11434",model:"qwen3:4b",thinking:"off"});
  await runtime.setPreferredAI("ollama");
  const result=await runtime.askAI({question:"Tell me about A000001",role:"Planner",current,revisions:[current]});
  assert.equal(result.text,"Grounded answer");
  assert.equal(result.structuredTool,"get_activity");
  assert.ok(result.sources.some(x=>x.name==="perun 3.xer"));
  assert.ok(result.sources.some(x=>x.name==="weekly-report.txt"));
  assert.ok(calls.some(x=>x.url.endsWith("/api/chat")));

  await repo.addFiles([
    new File([syntheticXER(5000,12000)],"large-revision.xer",{type:"text/plain"}),
    new File([syntheticXER(3000,8000)],"another-revision.xer",{type:"text/plain"})
  ],{category:"Programme"});
  const allSchedules=await repo.listSchedules();
  let observedChars=0,observedSystem="";
  globalThis.__PC_AI_TEST_HOOKS__={transformers:{pipeline:async(task,model,options)=>{
    options.progress_callback?.({progress:.5,file:"model_q4.onnx"});
    return async messages=>{
      observedChars=messages.reduce((n,m)=>n+String(m.content||"").length,0);
      observedSystem=String(messages[0]?.content||"");
      return [{generated_text:[...messages,{role:"assistant",content:"OK"}]}];
    };
  }}};
  await runtime.setPreferredAI("cpu:qwen2.5-0.5b");
  const cpuResult=await runtime.askAI({question:"What do you think about my current schedules?",role:"Planner",current:allSchedules.at(-1),revisions:allSchedules});
  assert.equal(cpuResult.text,"OK");
  assert.ok(observedChars<30000,`Browser-model prompt is too large: ${observedChars} characters`);
  assert.ok(observedSystem.includes("SCHEDULE PORTFOLIO / REVISION SUMMARY"));
  assert.ok(observedSystem.includes("large-revision.xer"));
  assert.ok(!observedSystem.includes("%T\\tTASK"),"Raw XER table data must not be dumped into browser-model context");
  delete globalThis.__PC_AI_TEST_HOOKS__;

  return "ai-runtime-integration";
}
