const TRANSFORMERS_URL="https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0";
const WEBLLM_URL="https://esm.run/@mlc-ai/web-llm@0.2.85";

let transformersModule=null;
let cpuRuntime=null,cpuModel=null;
let gpuTransformersRuntime=null,gpuTransformersModel=null;
let mlcRuntime=null,mlcModel=null;

async function transformers(){
  const hook=globalThis.__PC_AI_TEST_HOOKS__?.transformers;
  if(hook)return hook;
  if(!transformersModule)transformersModule=await import(TRANSFORMERS_URL);
  return transformersModule;
}
function progressPercent(r){
  for(const v of [r?.progress,r?.percentage,r?.percent]){
    const n=Number(v);if(Number.isFinite(n))return n<=1?n*100:n;
  }
  if(Number.isFinite(Number(r?.loaded))&&Number.isFinite(Number(r?.total))&&Number(r.total)>0)
    return Number(r.loaded)/Number(r.total)*100;
  return null;
}
function emitLoad(onProgress,title,model,r){
  const pct=progressPercent(r);
  onProgress?.({
    title,detail:r?.file||r?.status||r?.text||model,
    percent:pct??5,indeterminate:pct===null
  });
}
function generatedText(output){
  let generated=output?.[0]?.generated_text ?? output?.generated_text ?? output?.[0]?.text ?? output?.text ?? "";
  if(Array.isArray(generated)){
    const assistant=[...generated].reverse().find(x=>x?.role==="assistant");
    generated=assistant?.content ?? generated.at(-1)?.content ?? "";
  }
  if(generated && typeof generated==="object")generated=generated.content||generated.text||"";
  return String(generated||"").trim();
}
function browserError(error,engine,model){
  const raw=String(error?.message||error||"Unknown browser AI error");
  if(/indices element out of data bounds|Gather/i.test(raw)){
    return new Error(`${engine} model ${model} exceeded a safe browser context boundary. The toolkit now uses compact schedule context; reload once to clear the failed runtime and retry.`);
  }
  if(/out of memory|memory|allocation/i.test(raw)){
    return new Error(`${engine} model ${model} could not allocate enough browser memory. Choose a smaller model or use Ollama.`);
  }
  return new Error(`${engine} model ${model} failed: ${raw}`);
}
async function ensureWebGPU(){
  if(typeof navigator==="undefined"||!navigator.gpu)
    throw new Error("WebGPU is unavailable in this browser. Use current Chrome/Edge with compatible graphics, or choose CPU/WASM or Ollama.");
  const adapter=await navigator.gpu.requestAdapter().catch(()=>null);
  if(!adapter)throw new Error("WebGPU is exposed by the browser but no compatible GPU adapter was found. Use CPU/WASM or Ollama.");
  return adapter;
}

export async function browserCPU(messages,{
  model="onnx-community/Qwen2.5-0.5B-Instruct",dtype="q4",
  maxTokens=384,temperature=.18,onProgress=null
}={}){
  try{
    if(!cpuRuntime||cpuModel!==model){
      cpuRuntime=null;cpuModel=null;
      onProgress?.({title:"Downloading browser AI",detail:model,percent:1});
      const tr=await transformers();
      cpuRuntime=await tr.pipeline("text-generation",model,{
        device:"wasm",dtype,
        progress_callback:r=>emitLoad(onProgress,"Downloading browser AI",model,r)
      });
      cpuModel=model;
      onProgress?.({title:"Browser AI ready",detail:model,percent:100,done:true});
    }
    onProgress?.({title:"Generating AI response",detail:model,indeterminate:true});
    const output=await cpuRuntime(messages,{
      max_new_tokens:Math.max(32,Math.min(768,Number(maxTokens)||384)),
      temperature:Number(temperature),do_sample:Number(temperature)>0,
      return_full_text:false
    });
    const text=generatedText(output);
    if(!text)throw new Error("The model returned no assistant text.");
    onProgress?.({title:"AI response complete",detail:model,percent:100,done:true});
    return {text,model};
  }catch(error){
    if(cpuModel===model){cpuRuntime=null;cpuModel=null}
    onProgress?.({title:"Browser AI failed",detail:String(error?.message||error),percent:100,done:true});
    throw browserError(error,"CPU/WASM",model);
  }
}

export async function browserTransformersGPU(messages,{
  model="onnx-community/Qwen2.5-0.5B-Instruct",dtype="q4",
  maxTokens=384,temperature=.18,onProgress=null
}={}){
  try{
    await ensureWebGPU();
    if(!gpuTransformersRuntime||gpuTransformersModel!==model){
      gpuTransformersRuntime=null;gpuTransformersModel=null;
      onProgress?.({title:"Downloading WebGPU model",detail:model,percent:1});
      const tr=await transformers();
      gpuTransformersRuntime=await tr.pipeline("text-generation",model,{
        device:"webgpu",dtype,
        progress_callback:r=>emitLoad(onProgress,"Downloading WebGPU model",model,r)
      });
      gpuTransformersModel=model;
      onProgress?.({title:"WebGPU model ready",detail:model,percent:100,done:true});
    }
    onProgress?.({title:"Generating AI response",detail:model,indeterminate:true});
    const output=await gpuTransformersRuntime(messages,{
      max_new_tokens:Math.max(32,Math.min(768,Number(maxTokens)||384)),
      temperature:Number(temperature),do_sample:Number(temperature)>0,
      return_full_text:false
    });
    const text=generatedText(output);
    if(!text)throw new Error("The model returned no assistant text.");
    onProgress?.({title:"AI response complete",detail:model,percent:100,done:true});
    return {text,model};
  }catch(error){
    if(gpuTransformersModel===model){gpuTransformersRuntime=null;gpuTransformersModel=null}
    onProgress?.({title:"WebGPU AI failed",detail:String(error?.message||error),percent:100,done:true});
    throw browserError(error,"WebGPU",model);
  }
}

export async function browserMLC(messages,{
  model="Llama-3.2-1B-Instruct-q4f16_1-MLC",
  maxTokens=512,temperature=.18,onProgress=null
}={}){
  try{
    await ensureWebGPU();
    if(!mlcRuntime||mlcModel!==model){
      try{await mlcRuntime?.unload?.()}catch{}
      mlcRuntime=null;mlcModel=null;
      onProgress?.({title:"Downloading WebLLM model",detail:model,percent:1});
      const webllm=globalThis.__PC_AI_TEST_HOOKS__?.webllm || await import(WEBLLM_URL);
      mlcRuntime=await webllm.CreateMLCEngine(model,{
        initProgressCallback:r=>emitLoad(onProgress,"Downloading WebLLM model",model,r)
      });
      mlcModel=model;
      onProgress?.({title:"WebLLM model ready",detail:model,percent:100,done:true});
    }
    onProgress?.({title:"Generating AI response",detail:model,indeterminate:true});
    const out=await mlcRuntime.chat.completions.create({
      messages,temperature:Number(temperature),
      max_tokens:Math.max(32,Math.min(1024,Number(maxTokens)||512)),stream:false
    });
    const text=String(out?.choices?.[0]?.message?.content||"").trim();
    if(!text)throw new Error("The model returned no assistant text.");
    onProgress?.({title:"AI response complete",detail:model,percent:100,done:true});
    return {text,model};
  }catch(error){
    if(mlcModel===model){try{await mlcRuntime?.unload?.()}catch{};mlcRuntime=null;mlcModel=null}
    onProgress?.({title:"WebLLM failed",detail:String(error?.message||error),percent:100,done:true});
    throw browserError(error,"WebLLM",model);
  }
}

export async function releaseBrowserAI(){
  try{await mlcRuntime?.unload?.()}catch{}
  mlcRuntime=null;mlcModel=null;
  cpuRuntime=null;cpuModel=null;
  gpuTransformersRuntime=null;gpuTransformersModel=null;
}

export async function testBrowserAI(entry,{onProgress=null}={}){
  const messages=[
    {role:"system",content:"You are a connectivity test. Follow the user instruction exactly."},
    {role:"user",content:"Reply with exactly OK"}
  ];
  let result;
  if(entry.engine==="cpu")result=await browserCPU(messages,{model:entry.model,dtype:entry.dtype||"q4",maxTokens:16,temperature:0,onProgress});
  else if(entry.engine==="gpu-transformers")result=await browserTransformersGPU(messages,{model:entry.model,dtype:entry.dtype||"q4",maxTokens:16,temperature:0,onProgress});
  else if(entry.engine==="mlc")result=await browserMLC(messages,{model:entry.model,maxTokens:16,temperature:0,onProgress});
  else throw new Error("This is not a browser AI model.");
  return {ok:/\bOK\b/i.test(result.text),text:result.text,model:entry.model};
}
