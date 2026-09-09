
const CFG_KEY="pcai.ollama";
const DEFAULT={baseUrl:"http://localhost:11434",model:"",embeddingModel:"",keepAlive:"30m",thinking:"auto"};

export function ollamaConfig(){
  try{return {...DEFAULT,...JSON.parse(localStorage.getItem(CFG_KEY)||"{}")}}catch{return {...DEFAULT}}
}
export function saveOllamaConfig(patch){
  const cfg={...ollamaConfig(),...patch};
  cfg.baseUrl=normalizeBase(cfg.baseUrl);
  localStorage.setItem(CFG_KEY,JSON.stringify(cfg));return cfg;
}
export function normalizeBase(url){
  let s=String(url||DEFAULT.baseUrl).trim().replace(/\/+$/,"");s=s.replace(/\/api$/,"");return s||DEFAULT.baseUrl;
}
function alternative(base){
  try{
    const u=new URL(base);
    if(u.hostname==="localhost")u.hostname="127.0.0.1";
    else if(u.hostname==="127.0.0.1")u.hostname="localhost";
    else return null;
    return u.toString().replace(/\/$/,"");
  }catch{return null}
}
function corsHint(){try{return location.origin&&location.origin!=="null"?location.origin:"this website origin"}catch{return "this website origin"}}
export class OllamaConnectionError extends Error{
  constructor(message,{code="OLLAMA_CONNECTION",baseUrl="",origin=""}={}){
    super(message);this.name="OllamaConnectionError";this.code=code;this.baseUrl=baseUrl;this.origin=origin;
  }
}
export async function probeOllama({baseUrl=null}={}){
  if(baseUrl)saveOllamaConfig({baseUrl});
  const cfg=ollamaConfig(),base=normalizeBase(cfg.baseUrl);
  try{
    const res=await request("/version",{headers:{Accept:"application/json"}},3500);
    const data=await jsonResponse(res);
    return {ok:true,baseUrl:base,version:data.version||"unknown",message:`Ollama ${data.version||""} detected`.trim()};
  }catch(error){
    const message=String(error?.message||error);
    const likelyNotInstalled=/could not reach|did not respond|failed to fetch|network|not detected|unreachable/i.test(message);
    return {
      ok:false,baseUrl:base,version:null,
      code:error?.code||"OLLAMA_UNREACHABLE",
      likelyNotInstalled,
      message:likelyNotInstalled
        ? `Ollama was not detected at ${base}. It may not be installed, may not be running, or this website may not be allowed to access it.`
        : message,
      help:[
        "Install Ollama if it is not installed.",
        "Start Ollama and confirm it is running locally.",
        `Open ${base} in a browser; a running Ollama service should respond.`,
        `If this toolkit is hosted on GitHub Pages, allow ${corsHint()} using OLLAMA_ORIGINS and restart Ollama.`,
        "Then return to Settings → Ollama and use Detect & classify."
      ]
    };
  }
}
async function request(path,options={},timeoutMs=120000){
  const cfg=ollamaConfig(),base=normalizeBase(cfg.baseUrl),urls=[`${base}/api${path}`],alt=alternative(base);if(alt)urls.push(`${alt}/api${path}`);
  let last=null;
  for(const url of urls){
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
    try{
      const opts={...options,signal:c.signal,mode:"cors",cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer"};
      return await fetch(url,opts);
    }catch(e){last=e}finally{clearTimeout(timer)}
  }
  if(last?.name==="AbortError")throw new OllamaConnectionError(
    `Ollama did not respond at ${base}. It may not be installed or running.`,
    {code:"OLLAMA_TIMEOUT",baseUrl:base,origin:corsHint()}
  );
  throw new OllamaConnectionError(
    `Ollama was not detected at ${base}. It may not be installed, may not be running, or ${corsHint()} may not be permitted by OLLAMA_ORIGINS.`,
    {code:"OLLAMA_UNREACHABLE",baseUrl:base,origin:corsHint()}
  );
}
async function jsonResponse(res){
  const text=await res.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text}}
  if(!res.ok)throw new Error(`Ollama request failed: ${data.error||data.message||res.status}`);
  return data;
}
export async function listModels(){
  const d=await jsonResponse(await request("/tags",{headers:{Accept:"application/json"}},10000));
  return (d.models||[]).map(x=>({name:x.name||x.model,size:x.size||0,details:x.details||{}}));
}
export async function inspectModel(name){
  try{
    const d=await jsonResponse(await request("/show",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:name})},10000));
    const caps=(d.capabilities||[]).map(x=>String(x).toLowerCase());
    return {name,capabilities:caps,supportsChat:caps.length?caps.includes("completion"):!/(embed|embedding|nomic|bge-|e5-)/i.test(name),supportsEmbedding:caps.length?caps.includes("embedding"):/(embed|embedding|nomic|bge-|e5-)/i.test(name)};
  }catch{
    const embed=/(embed|embedding|nomic|bge-|e5-)/i.test(name);
    return {name,capabilities:embed?["embedding"]:["completion"],supportsChat:!embed,supportsEmbedding:embed};
  }
}
export async function inspectModels(){const models=await listModels();return await Promise.all(models.map(async m=>({...m,...await inspectModel(m.name)})))}
function textFrom(data){
  const c=data?.message?.content;
  if(typeof c==="string"&&c.trim())return c;
  if(Array.isArray(c))return c.map(x=>typeof x==="string"?x:(x?.text||x?.content||"")).join("");
  for(const v of [data?.response,data?.content,data?.text,data?.message?.text])if(typeof v==="string"&&v.trim())return v;
  return "";
}
function keepAlive(v){
  const s=String(v??"").trim().toLowerCase();
  if(s==="-1")return "30m";
  if(s==="default"||!s)return undefined;
  if(s==="0")return "0";
  if(/^\d+(?:\.\d+)?(?:ms|s|m|h)$/.test(s))return s;
  return "30m";
}
export async function chat(messages,{model=null,temperature=.18,maxTokens=2048,contextTokens=16384,topP=.9,topK=40,repeatPenalty=1.1,thinking="auto",onProgress=null}={}){
  const cfg=ollamaConfig();let selected=model||cfg.model;
  if(!selected){
    const models=(await inspectModels()).filter(x=>x.supportsChat);if(!models.length)throw new Error("Ollama is reachable but no chat-capable model is installed.");
    selected=models[0].name;saveOllamaConfig({model:selected});
  }
  onProgress?.({title:"Generating AI response",detail:`Ollama · ${selected}`,indeterminate:true,percent:5});
  const payload={model:selected,messages,stream:false,options:{temperature:Number(temperature),num_predict:Number(maxTokens),num_ctx:Number(contextTokens),top_p:Number(topP),top_k:Number(topK),repeat_penalty:Number(repeatPenalty)}};
  const ka=keepAlive(cfg.keepAlive);if(ka!==undefined)payload.keep_alive=ka;
  if(thinking==="off")payload.think=false;else if(thinking==="on")payload.think=true;
  let d=await jsonResponse(await request("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)},600000));
  let text=textFrom(d);
  if(!text&&thinking!=="off"){
    payload.think=false;d=await jsonResponse(await request("/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)},600000));text=textFrom(d);
  }
  if(!text){
    const prompt=messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const gen={model:selected,prompt,stream:false,options:payload.options};if(ka!==undefined)gen.keep_alive=ka;gen.think=false;
    d=await jsonResponse(await request("/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(gen)},600000));text=textFrom(d);
  }
  if(!text)throw new Error("Ollama returned successfully but no assistant text was produced.");
  onProgress?.({title:"AI response complete",detail:selected,percent:100,done:true});
  return {text,model:selected,raw:d};
}
export async function testOllama({baseUrl=null,model=null}={}){
  if(baseUrl)saveOllamaConfig({baseUrl});
  const models=await inspectModels(),chatModels=models.filter(x=>x.supportsChat);
  const selected=model&&chatModels.some(x=>x.name===model)?model:chatModels[0]?.name;
  if(!selected)return {ok:false,message:"No chat-capable Ollama model found.",models};
  const out=await chat([{role:"user",content:"Reply with exactly OK"}],{model:selected,temperature:0,maxTokens:16,thinking:"off"});
  saveOllamaConfig({model:selected});return {ok:/OK/i.test(out.text),selectedModel:selected,message:out.text,models};
}
