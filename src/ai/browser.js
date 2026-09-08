
let cpu=null,gpu=null;
export async function browserCPU(messages,{model="onnx-community/Qwen2.5-0.5B-Instruct",maxTokens=512,temperature=.2,onProgress=null}={}){
  if(!cpu){
    onProgress?.({title:"Downloading browser AI",detail:model,percent:1});
    const tr=await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1");
    cpu=await tr.pipeline("text-generation",model,{device:"wasm",dtype:"q4",progress_callback:r=>{
      const n=Number(r?.progress);onProgress?.({title:"Downloading browser AI",detail:r?.file||r?.status||model,percent:Number.isFinite(n)?(n<=1?n*100:n):5,indeterminate:!Number.isFinite(n)});
    }});
  }
  onProgress?.({title:"Generating AI response",detail:model,indeterminate:true});
  const out=await cpu(messages,{max_new_tokens:maxTokens,temperature,do_sample:temperature>0,return_full_text:false});
  const text=Array.isArray(out)?(out[0]?.generated_text||out[0]?.text||""):(out?.generated_text||out?.text||"");
  onProgress?.({title:"AI response complete",detail:model,percent:100,done:true});return {text:String(text),model};
}
export async function browserGPU(messages,{model="Qwen2.5-1.5B-Instruct-q4f16_1-MLC",maxTokens=768,temperature=.2,onProgress=null}={}){
  if(!navigator.gpu)throw new Error("WebGPU is not available.");
  if(!gpu){
    onProgress?.({title:"Downloading WebGPU AI",detail:model,percent:1});
    const webllm=await import("https://esm.run/@mlc-ai/web-llm");
    gpu=await webllm.CreateMLCEngine(model,{initProgressCallback:r=>{
      const n=Number(r?.progress);onProgress?.({title:"Downloading WebGPU AI",detail:r?.text||model,percent:Number.isFinite(n)?(n<=1?n*100:n):5,indeterminate:!Number.isFinite(n)});
    }});
  }
  onProgress?.({title:"Generating AI response",detail:model,indeterminate:true});
  const out=await gpu.chat.completions.create({messages,temperature,max_tokens:maxTokens,stream:false});
  const text=out?.choices?.[0]?.message?.content||"";onProgress?.({title:"AI response complete",detail:model,percent:100,done:true});
  return {text,model};
}
export async function releaseBrowserAI(){try{await gpu?.unload?.()}catch{};gpu=null;cpu=null}
