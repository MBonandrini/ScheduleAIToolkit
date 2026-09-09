
import assert from "node:assert/strict";

class StorageMock{
  constructor(){this.m=new Map()}
  getItem(k){return this.m.has(k)?this.m.get(k):null}
  setItem(k,v){this.m.set(k,String(v))}
  removeItem(k){this.m.delete(k)}
  clear(){this.m.clear()}
}
globalThis.localStorage=new StorageMock();
globalThis.location={origin:"https://example.github.io",href:"https://example.github.io/tool/"};

const calls=[];
globalThis.fetch=async(url,opts={})=>{
  calls.push({url:String(url),opts});
  if(String(url).endsWith("/api/tags"))return new Response(JSON.stringify({models:[
    {name:"qwen3:4b",details:{parameter_size:"4B"}},
    {name:"embeddinggemma:latest",details:{parameter_size:"300M"}}
  ]}),{status:200,headers:{"content-type":"application/json"}});
  if(String(url).endsWith("/api/show")){
    const b=JSON.parse(opts.body||"{}"),embed=/embedding/.test(b.model);
    return new Response(JSON.stringify({capabilities:embed?["embedding"]:["completion","tools"]}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(String(url).endsWith("/api/chat")){
    const b=JSON.parse(opts.body||"{}");
    if(b.messages?.some(x=>/force-empty/.test(x.content||"")))return new Response(JSON.stringify({message:{content:""}}),{status:200,headers:{"content-type":"application/json"}});
    if(b.think===true)return new Response(JSON.stringify({message:{content:"",thinking:"reasoning"}}),{status:200,headers:{"content-type":"application/json"}});
    return new Response(JSON.stringify({message:{content:"OK"}}),{status:200,headers:{"content-type":"application/json"}});
  }
  if(String(url).endsWith("/api/generate"))return new Response(JSON.stringify({response:"GEN_OK"}),{status:200,headers:{"content-type":"application/json"}});
  throw new Error("Unexpected "+url);
};

const ollama=await import("../src/ai/ollama.js");
export async function run(){
  ollama.saveOllamaConfig({baseUrl:"http://localhost:11434/api",model:"qwen3:4b",keepAlive:"30m",thinking:"auto"});
  assert.equal(ollama.ollamaConfig().baseUrl,"http://localhost:11434");
  const models=await ollama.inspectModels();assert.equal(models.length,2);assert.equal(models[0].supportsChat,true);assert.equal(models[1].supportsEmbedding,true);assert.equal(models[1].supportsChat,false);
  let progress=[];
  let out=await ollama.chat([{role:"user",content:"hello"}],{thinking:"off",temperature:.2,maxTokens:20,contextTokens:4096,onProgress:x=>progress.push(x)});
  assert.equal(out.text,"OK");assert.ok(progress.some(x=>x.indeterminate));assert.ok(progress.some(x=>x.done));
  const chatCall=calls.filter(x=>x.url.endsWith("/api/chat")).at(-1),payload=JSON.parse(chatCall.opts.body);
  assert.equal(payload.model,"qwen3:4b");assert.equal(payload.think,false);assert.equal(payload.keep_alive,"30m");assert.equal(payload.options.num_ctx,4096);
  out=await ollama.chat([{role:"user",content:"force-empty"}],{thinking:"off"});assert.equal(out.text,"GEN_OK");
  out=await ollama.chat([{role:"user",content:"thinking"}],{thinking:"on"});assert.equal(out.text,"OK");
  const test=await ollama.testOllama({model:"qwen3:4b"});assert.equal(test.ok,true);

  // Explicit missing-Ollama diagnostic: browser fetch failure must not crash and must return actionable help.
  const goodFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new TypeError("Failed to fetch")};
  const probe=await ollama.probeOllama({baseUrl:"http://localhost:11434"});
  assert.equal(probe.ok,false);
  assert.equal(probe.likelyNotInstalled,true);
  assert.ok(/not detected/i.test(probe.message));
  assert.ok(probe.help.some(x=>/Install Ollama/i.test(x)));
  assert.ok(probe.help.some(x=>/OLLAMA_ORIGINS/i.test(x)));
  globalThis.fetch=goodFetch;

  return "ollama";
}
