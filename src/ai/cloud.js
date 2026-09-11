const PREFIX="pcai.cloud.";
const DEFAULTS={
  gemini:{model:"gemini-3.8-flash",label:"Gemini"},
  grok:{model:"grok-4.6",label:"Grok"}
};
function storage(){return typeof localStorage!=="undefined"?localStorage:null}
function key(provider,field){return `${PREFIX}${provider}.${field}`}
export function cloudConfig(provider){
  const p=DEFAULTS[provider];if(!p)throw new Error(`Unknown cloud AI provider: ${provider}`);const s=storage();
  return {provider,model:s?.getItem(key(provider,"model"))||p.model,apiKey:s?.getItem(key(provider,"key"))||"",remember:true};
}
export function saveCloudConfig(provider,{model,apiKey}={}){
  const p=DEFAULTS[provider];if(!p)throw new Error(`Unknown cloud AI provider: ${provider}`);const s=storage();if(!s)throw new Error("Browser local storage is unavailable.");
  if(model!=null)s.setItem(key(provider,"model"),String(model).trim()||p.model);
  if(apiKey!=null)s.setItem(key(provider,"key"),String(apiKey).trim());
  return cloudConfig(provider);
}
export function clearCloudKey(provider){const s=storage();s?.removeItem(key(provider,"key"));return cloudConfig(provider)}
function friendlyFetchError(provider,error){
  const name=DEFAULTS[provider]?.label||provider,msg=String(error?.message||error||"");
  if(error instanceof TypeError||/failed to fetch|networkerror|cors/i.test(msg))return `${name} could not be reached from this browser. Check the API key, internet connection and browser CORS policy. For a public deployment, a small server/Worker proxy is safer than exposing a long-lived API key in browser storage.`;
  return msg||`${name} request failed.`;
}
async function request(url,options,provider){
  let res;try{res=await fetch(url,options)}catch(error){throw new Error(friendlyFetchError(provider,error))}
  const text=await res.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!res.ok){const detail=data?.error?.message||data?.message||data?.raw||`${res.status} ${res.statusText}`;throw new Error(`${DEFAULTS[provider].label} API error: ${detail}`)}
  return data;
}
function splitMessages(messages=[]){
  const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n\n");
  const chat=messages.filter(m=>m.role!=="system");return {system,chat};
}
export async function cloudChat(provider,messages,{model=null,onProgress=null}={}){
  const cfg=cloudConfig(provider),selected=model||cfg.model;if(!cfg.apiKey)throw new Error(`${DEFAULTS[provider].label} API key is not configured. Open Settings and paste your key first.`);
  onProgress?.({title:`Contacting ${DEFAULTS[provider].label}`,detail:selected,indeterminate:true});
  if(provider==="gemini"){
    const {system,chat}=splitMessages(messages),contents=chat.map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:String(m.content||"")}]}));
    const body={contents};if(system)body.system_instruction={parts:[{text:system}]};
    const data=await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selected)}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":cfg.apiKey},body:JSON.stringify(body)},provider);
    const text=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("").trim();if(!text)throw new Error("Gemini returned no text response.");
    onProgress?.({title:"Gemini complete",detail:selected,pct:100});return {text,model:selected,provider};
  }
  if(provider==="grok"){
    const data=await request("https://api.x.ai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${cfg.apiKey}`},body:JSON.stringify({model:selected,messages:messages.map(m=>({role:m.role,content:String(m.content||"")}))})},provider);
    const text=String(data.choices?.[0]?.message?.content||"").trim();if(!text)throw new Error("Grok returned no text response.");
    onProgress?.({title:"Grok complete",detail:selected,pct:100});return {text,model:selected,provider};
  }
  throw new Error(`Unsupported cloud AI provider: ${provider}`);
}
export async function testCloudAI(provider){
  try{const r=await cloudChat(provider,[{role:"user",content:"Reply with OK only."}],{});return {ok:true,message:`${DEFAULTS[provider].label} responded using ${r.model}.`,text:r.text}}
  catch(error){return {ok:false,message:error.message||String(error)}}
}
