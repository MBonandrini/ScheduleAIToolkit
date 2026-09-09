import assert from "node:assert/strict";
import {syntheticXER} from "./helpers.js";
export async function run(){
  const repo=await import("../src/repository/repository.js");
  const runtime=await import("../src/ai/runtime.js");
  await repo.newProject("Agent Runtime Test");
  await repo.addFiles([
    new File([syntheticXER(30,55)],"agent-programme.xer",{type:"text/plain"}),
    new File(["Contract note: completion notice issued."],"contract-note.txt",{type:"text/plain"})
  ],{category:"Evidence"});
  const current=(await repo.listSchedules()).at(-1),calls=[];
  globalThis.__PC_AI_TEST_HOOKS__={transformers:{pipeline:async(task,model,options)=>{
    options.progress_callback?.({progress:.6,file:"model_q4.onnx"});
    return async(messages)=>{calls.push({model,messages});return [{generated_text:[...messages,{role:"assistant",content:"ROLE_OK"}]}]};
  }}};
  await runtime.setPreferredAI("cpu:qwen2.5-0.5b");
  const roles=["Planner","Forensic Planner","Risk Analyst","Commercial Manager","Contract Analyst","Project Controls Manager","Executive Reviewer"];
  for(const role of roles){
    const out=await runtime.askAI({question:"Review the current project position.",role,current,revisions:[current]});
    assert.equal(out.text,"ROLE_OK",role);assert.equal(out.aiValue,"cpu:qwen2.5-0.5b",role);
    assert.ok(out.sources.some(s=>s.name==="agent-programme.xer"),role);assert.ok(out.sources.some(s=>s.name==="contract-note.txt"),role);
  }
  assert.equal(calls.length,roles.length);assert.ok(calls.every(c=>c.model==="onnx-community/Qwen2.5-0.5B-Instruct"));
  delete globalThis.__PC_AI_TEST_HOOKS__;
  return `all-agents-${roles.length}`;
}
