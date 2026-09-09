export const AI_CATALOG = [
  {
    value:"ollama:auto", engine:"ollama", model:null,
    label:"Ollama — selected local model",
    group:"Ollama", memory:"Model dependent", contextChars:60000
  },

  {
    value:"cpu:qwen2.5-0.5b", engine:"cpu",
    model:"onnx-community/Qwen2.5-0.5B-Instruct",
    label:"Browser CPU/WASM — Qwen2.5 0.5B",
    group:"Browser CPU / WASM", memory:"~0.8–1.5 GB RAM", contextChars:12000, dtype:"q4"
  },
  {
    value:"cpu:qwen2.5-1.5b", engine:"cpu",
    model:"onnx-community/Qwen2.5-1.5B-Instruct",
    label:"Browser CPU/WASM — Qwen2.5 1.5B",
    group:"Browser CPU / WASM", memory:"~1.8–3.5 GB RAM", contextChars:12000, dtype:"q4"
  },
  {
    value:"cpu:llama3.2-1b", engine:"cpu",
    model:"onnx-community/Llama-3.2-1B-Instruct-ONNX",
    label:"Browser CPU/WASM — Llama 3.2 1B",
    group:"Browser CPU / WASM", memory:"~1.5–3 GB RAM", contextChars:12000, dtype:"q4"
  },

  {
    value:"gpu:qwen2.5-0.5b", engine:"gpu-transformers",
    model:"onnx-community/Qwen2.5-0.5B-Instruct",
    label:"Browser WebGPU — Qwen2.5 0.5B",
    group:"Browser WebGPU / Transformers.js", memory:"~0.8–1.5 GB VRAM", contextChars:12000, dtype:"q4"
  },
  {
    value:"gpu:qwen2.5-1.5b", engine:"gpu-transformers",
    model:"onnx-community/Qwen2.5-1.5B-Instruct",
    label:"Browser WebGPU — Qwen2.5 1.5B",
    group:"Browser WebGPU / Transformers.js", memory:"~1.8–3.5 GB VRAM", contextChars:12000, dtype:"q4"
  },
  {
    value:"gpu:llama3.2-1b", engine:"gpu-transformers",
    model:"onnx-community/Llama-3.2-1B-Instruct-ONNX",
    label:"Browser WebGPU — Llama 3.2 1B",
    group:"Browser WebGPU / Transformers.js", memory:"~1.5–3 GB VRAM", contextChars:12000, dtype:"q4"
  },

  {
    value:"mlc:llama3.2-1b", engine:"mlc",
    model:"Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label:"WebLLM — Llama 3.2 1B",
    group:"Browser WebGPU / WebLLM", memory:"~0.88 GB VRAM", contextChars:9000
  },
  {
    value:"mlc:llama3.2-3b", engine:"mlc",
    model:"Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label:"WebLLM — Llama 3.2 3B",
    group:"Browser WebGPU / WebLLM", memory:"~2.26 GB VRAM", contextChars:9000
  },
  {
    value:"mlc:llama3.1-8b", engine:"mlc",
    model:"Llama-3.1-8B-Instruct-q4f16_1-MLC",
    label:"WebLLM — Llama 3.1 8B",
    group:"Browser WebGPU / WebLLM", memory:"~5.0 GB VRAM", contextChars:9000
  },
  {
    value:"mlc:phi3.5-mini", engine:"mlc",
    model:"Phi-3.5-mini-instruct-q4f16_1-MLC",
    label:"WebLLM — Phi 3.5 Mini",
    group:"Browser WebGPU / WebLLM", memory:"~3.67 GB VRAM", contextChars:9000
  },

  {
    value:"proprietary:placeholder", engine:"placeholder", model:null,
    label:"Proprietary Schedule AI Toolkit — future",
    group:"Future", memory:"—", contextChars:0, disabled:true
  }
];

export const DEFAULT_AI_VALUE="cpu:qwen2.5-0.5b";

export function aiEntry(value){
  const aliases={
    "ollama":"ollama:auto",
    "browser-cpu":"cpu:qwen2.5-0.5b",
    "browser-gpu":"mlc:llama3.2-1b"
  };
  const normalized=aliases[value]||value;
  return AI_CATALOG.find(x=>x.value===normalized) || AI_CATALOG.find(x=>x.value===DEFAULT_AI_VALUE);
}
export function browserHasWebGPU(){
  return typeof navigator!=="undefined" && !!navigator.gpu;
}
export function aiCompatibility(value){
  const entry=aiEntry(value);
  if(entry.disabled)return {ok:false,reason:"This option is reserved for a future release."};
  if((entry.engine==="mlc"||entry.engine==="gpu-transformers")&&!browserHasWebGPU()){
    return {
      ok:false,
      reason:"WebGPU is not available in this browser. Use current Chrome/Edge with compatible graphics, or choose a CPU/WASM or Ollama model."
    };
  }
  return {ok:true,reason:""};
}
export function catalogueGroups(){
  const groups=new Map();
  for(const entry of AI_CATALOG){
    if(!groups.has(entry.group))groups.set(entry.group,[]);
    groups.get(entry.group).push(entry);
  }
  return groups;
}
