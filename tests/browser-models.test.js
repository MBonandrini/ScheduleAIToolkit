import assert from "node:assert/strict";
import {AI_CATALOG,aiCompatibility} from "../src/ai/catalog.js";
import {testBrowserAI,releaseBrowserAI} from "../src/ai/browser.js";

export async function run(){
  const labels=AI_CATALOG.map(x=>x.label);
  for(const required of [
    "Browser CPU/WASM — Qwen2.5 0.5B",
    "Browser CPU/WASM — Qwen2.5 1.5B",
    "Browser CPU/WASM — Llama 3.2 1B",
    "Browser WebGPU — Qwen2.5 0.5B",
    "Browser WebGPU — Qwen2.5 1.5B",
    "Browser WebGPU — Llama 3.2 1B",
    "WebLLM — Llama 3.2 1B",
    "WebLLM — Llama 3.2 3B",
    "WebLLM — Llama 3.1 8B",
    "WebLLM — Phi 3.5 Mini"
  ])assert.ok(labels.includes(required),`Missing restored model: ${required}`);

  const loaded=[];
  globalThis.__PC_AI_TEST_HOOKS__={
    transformers:{
      pipeline:async(task,model,options)=>{
        loaded.push({kind:"transformers",task,model,device:options.device,dtype:options.dtype});
        options.progress_callback?.({progress:.5,file:"weights.bin"});
        return async(messages)=>[{generated_text:[...messages,{role:"assistant",content:"OK"}]}];
      }
    },
    webllm:{
      CreateMLCEngine:async(model,options)=>{
        loaded.push({kind:"webllm",model});
        options.initProgressCallback?.({progress:.5,text:"loading"});
        return {chat:{completions:{create:async()=>({choices:[{message:{content:"OK"}}]})}},unload:async()=>{}};
      }
    }
  };
  const originalNavigator=globalThis.navigator;
  Object.defineProperty(globalThis,"navigator",{value:{gpu:{requestAdapter:async()=>({})}},configurable:true});

  try{
    for(const entry of AI_CATALOG.filter(x=>["cpu","gpu-transformers","mlc"].includes(x.engine))){
      const progress=[];
      const r=await testBrowserAI(entry,{onProgress:x=>progress.push(x)});
      assert.equal(r.ok,true,entry.label);
      assert.ok(progress.some(x=>x.indeterminate)||progress.some(x=>x.percent>0),`No progress for ${entry.label}`);
    }
    for(const entry of AI_CATALOG.filter(x=>x.engine==="cpu"))
      assert.ok(loaded.some(x=>x.model===entry.model&&x.device==="wasm"),`CPU route missing ${entry.model}`);
    for(const entry of AI_CATALOG.filter(x=>x.engine==="gpu-transformers"))
      assert.ok(loaded.some(x=>x.model===entry.model&&x.device==="webgpu"),`WebGPU route missing ${entry.model}`);
    for(const entry of AI_CATALOG.filter(x=>x.engine==="mlc"))
      assert.ok(loaded.some(x=>x.model===entry.model&&x.kind==="webllm"),`WebLLM route missing ${entry.model}`);
  }finally{
    await releaseBrowserAI();delete globalThis.__PC_AI_TEST_HOOKS__;
    if(originalNavigator===undefined)delete globalThis.navigator;else Object.defineProperty(globalThis,"navigator",{value:originalNavigator,configurable:true});
  }

  Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
  assert.equal(aiCompatibility("mlc:llama3.2-1b").ok,false);
  assert.equal(aiCompatibility("gpu:qwen2.5-0.5b").ok,false);
  assert.equal(aiCompatibility("cpu:qwen2.5-0.5b").ok,true);
  if(originalNavigator===undefined)delete globalThis.navigator;else Object.defineProperty(globalThis,"navigator",{value:originalNavigator,configurable:true});

  return `browser-model-routing-${loaded.length}`;
}
