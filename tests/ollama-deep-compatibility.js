
const fs=require("fs"),vm=require("vm"),path=require("path");
const corePath=path.join(__dirname,"..","assets","js","core.js");

function storage(seed={}){
  const map=new Map(Object.entries(seed));
  return {
    getItem:k=>map.has(k)?map.get(k):null,
    setItem:(k,v)=>map.set(k,String(v)),
    removeItem:k=>map.delete(k),
    dump:()=>Object.fromEntries(map)
  };
}
function response(obj,status=200,contentType="application/json"){
  return new Response(contentType==="application/json"?JSON.stringify(obj):String(obj),{
    status,headers:{"content-type":contentType}
  });
}
async function makeCore(handler,seed={}){
  const localStorage=storage(seed),sessionStorage=storage(),calls=[],progress=[];
  async function fetch(url,opts={}){
    calls.push({url:String(url),method:opts.method||"GET",headers:opts.headers||{},body:opts.body||null,opts});
    return await handler(String(url),opts,calls);
  }
  const sandbox={
    console,fetch,Response,Request,Headers,AbortController,setTimeout,clearTimeout,URL,
    Date,Math,JSON,Map,Set,Array,Object,String,Number,Boolean,RegExp,Promise,
    Uint8Array,Int32Array,Float64Array,Uint32Array,ArrayBuffer,TextDecoder,TextEncoder,
    crypto:globalThis.crypto,localStorage,sessionStorage,navigator:{},
    location:{href:"https://example.github.io/ScheduleAIToolkit/",origin:"https://example.github.io",protocol:"https:"},
    document:{createElement:()=>({}),head:{appendChild(){}}},
    postMessage:(msg)=>progress.push(msg)
  };
  sandbox.window=sandbox;sandbox.globalThis=sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(corePath,"utf8"),sandbox);
  return {ai:sandbox.ProjectControlsCore.ai,calls,localStorage,progress,sandbox};
}
let failures=[];
function check(name,value,detail=""){console.log((value?"PASS ":"FAIL ")+name+(detail?` · ${detail}`:""));if(!value)failures.push(name)}

(async()=>{
  // Official native endpoints + request shape
  {
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[
        {name:"qwen3:8b",model:"qwen3:8b",size:123,details:{parameter_size:"8B",quantization_level:"Q4_K_M"}},
        {name:"embeddinggemma:latest",model:"embeddinggemma:latest",details:{parameter_size:"300M"}}
      ]});
      if(url.endsWith("/api/show")){
        const body=JSON.parse(opts.body||"{}");
        return response({capabilities:/embedding/i.test(body.model)?["embedding"]:["completion","tools"],details:{parameter_size:/embedding/i.test(body.model)?"300M":"8B"}});
      }
      if(url.endsWith("/api/chat")){
        const body=JSON.parse(opts.body||"{}");
        return response({model:body.model,message:{role:"assistant",content:"SHAPE_OK"},done:true});
      }
      throw new Error("unexpected "+url);
    };
    const {ai,calls,progress}=await makeCore(handler,{
      projectControlsNotebookRuntimeConfig:JSON.stringify({
        contextTokens:24576,maxAnswerTokens:777,temperature:0.23,topP:0.87,topKSampling:31,repeatPenalty:1.07,
        thinkingMode:"off",requestTimeoutSeconds:60,firstResponseTimeoutSeconds:30,thinkingTimeoutSeconds:30,
        retryCount:0,retryDelayMs:1,generateFallback:true,keepAlive:"30m"
      })
    });
    ai.configureOllama({baseUrl:"http://localhost:11434/api",model:"qwen3:8b"});
    ai.setPreferred("ollama:auto");
    const inspected=await ai.inspectOllamaModels();
    check("native model discovery + /api/show capabilities",inspected.length===2&&inspected[0].supportsChat&&inspected[1].supportsEmbedding&&!inspected[1].supportsChat);
    const out=await ai.run([{role:"user",content:"shape"}],{thinkingMode:"off"});
    const chatCall=calls.find(c=>c.url.endsWith("/api/chat"));
    const body=JSON.parse(chatCall.body);
    check("base URL /api suffix normalized",chatCall.url==="http://localhost:11434/api/chat");
    check("selected model sent",body.model==="qwen3:8b");
    check("stream false explicitly sent",body.stream===false);
    check("thinking off sent as boolean false",body.think===false);
    check("keep_alive duration sent",body.keep_alive==="30m");
    check("num_ctx runtime option sent",body.options.num_ctx===24576);
    check("num_predict runtime option sent",body.options.num_predict===777);
    check("sampling options sent",body.options.temperature===0.23&&body.options.top_p===0.87&&body.options.top_k===31&&body.options.repeat_penalty===1.07);
    check("normal assistant response extracted",out.choices[0].message.content==="SHAPE_OK");
    check("AI generation progress start+complete emitted",progress.some(x=>x?.title==="Generating AI response"&&x.indeterminate===true)&&progress.some(x=>x?.title==="AI response complete"&&x.done===true));
  }

  // Auto thinking omits think; On sends true.
  {
    let chatBodies=[];
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"qwen3:4b"}]});
      if(url.endsWith("/api/show")) return response({capabilities:["completion"]});
      if(url.endsWith("/api/chat")){chatBodies.push(JSON.parse(opts.body));return response({message:{content:"OK"}})}
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler);
    ai.configureOllama({model:"qwen3:4b"});ai.setPreferred("ollama:auto");
    await ai.run([{role:"user",content:"auto"}],{thinkingMode:"auto"});
    await ai.run([{role:"user",content:"on"}],{thinkingMode:"on"});
    check("thinking auto leaves think unspecified",!("think" in chatBodies[0]));
    check("thinking on sends true",chatBodies[1].think===true);
  }

  // Thinking-only response falls back to think:false.
  {
    let bodies=[];
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"qwen3:4b"}]});
      if(url.endsWith("/api/show")) return response({capabilities:["completion"]});
      if(url.endsWith("/api/chat")){
        const b=JSON.parse(opts.body);bodies.push(b);
        if(b.think!==false) return response({message:{content:"",thinking:"reasoning only"}});
        return response({message:{content:"FINAL_OK"}});
      }
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler,{projectControlsNotebookRuntimeConfig:JSON.stringify({thinkingMode:"on",fallbackThinkingOff:true,retryCount:0})});
    ai.configureOllama({model:"qwen3:4b"});ai.setPreferred("ollama:auto");
    const out=await ai.run([{role:"user",content:"think"}],{thinkingMode:"on"});
    check("thinking-only output retries with thinking off",bodies.length>=2&&bodies.some(b=>b.think===false));
    check("thinking fallback returns final answer",out.choices[0].message.content==="FINAL_OK");
  }

  // Empty chat falls back to generate.
  {
    let seenGenerate=false;
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"gemma3:4b"}]});
      if(url.endsWith("/api/show")) return response({capabilities:["completion"]});
      if(url.endsWith("/api/chat")) return response({message:{content:""}});
      if(url.endsWith("/api/generate")){seenGenerate=true;const b=JSON.parse(opts.body);return response({response:"GENERATE_OK",model:b.model})}
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler,{projectControlsNotebookRuntimeConfig:JSON.stringify({generateFallback:true,retryCount:0,thinkingMode:"off"})});
    ai.configureOllama({model:"gemma3:4b"});ai.setPreferred("ollama:auto");
    const out=await ai.run([{role:"user",content:"fallback"}],{thinkingMode:"off"});
    check("empty /api/chat falls back to /api/generate",seenGenerate);
    check("/api/generate response extracted",out.choices[0].message.content==="GENERATE_OK");
  }

  // Response-shape compatibility.
  for(const [label,payload,expected] of [
    ["top-level response",{response:"RESP_OK"},"RESP_OK"],
    ["top-level content",{content:"CONTENT_OK"},"CONTENT_OK"],
    ["message.text",{message:{text:"TEXT_OK"}},"TEXT_OK"],
    ["content array",{message:{content:[{text:"ARRAY_"},{content:"OK"}]}},"ARRAY_OK"]
  ]){
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"shape:latest"}]});
      if(url.endsWith("/api/show")) return response({capabilities:["completion"]});
      if(url.endsWith("/api/chat")) return response(payload);
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler,{projectControlsNotebookRuntimeConfig:JSON.stringify({generateFallback:false,retryCount:0,thinkingMode:"off"})});
    ai.configureOllama({model:"shape:latest"});ai.setPreferred("ollama:auto");
    const out=await ai.run([{role:"user",content:"shape"}],{thinkingMode:"off"});
    check(`response compatibility: ${label}`,out.choices[0].message.content===expected);
  }

  // Capability endpoint failure uses safe name fallback.
  {
    const handler=async(url)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"nomic-embed-text:latest"},{name:"my-chat-model:latest"}]});
      if(url.endsWith("/api/show")) return response({error:"old Ollama show behavior"},404);
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler);
    const models=await ai.inspectOllamaModels();
    const embed=models.find(x=>/nomic/.test(x.name)),chat=models.find(x=>/my-chat/.test(x.name));
    check("/api/show failure falls back to model-name capability heuristic",embed.supportsEmbedding&&!embed.supportsChat&&chat.supportsChat);
  }

  // Embedding-only chat model is explicitly rejected by connection test.
  {
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"embeddinggemma:latest"}]});
      if(url.endsWith("/api/show")) return response({capabilities:["embedding"]});
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler);
    ai.configureOllama({model:"embeddinggemma:latest"});
    let message="";
    try{await ai.testOllamaConnection();}catch(e){message=e.message}
    check("embedding-only model rejected for chat",/does not support chat|no installed model supports chat/i.test(message)||message==="");
    const result=await ai.testOllamaConnection().catch(e=>({ok:false,message:e.message}));
    check("embedding-only condition never reports ready",result.ok!==true);
  }

  // Missing configured model selects first chat-capable installed model.
  {
    let usedModel="";
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"qwen3:4b"},{name:"embeddinggemma:latest"}]});
      if(url.endsWith("/api/show")){const b=JSON.parse(opts.body);return response({capabilities:/embedding/.test(b.model)?["embedding"]:["completion"]})}
      if(url.endsWith("/api/chat")){const b=JSON.parse(opts.body);usedModel=b.model;return response({message:{content:"OK"}})}
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler);
    ai.configureOllama({model:"model-that-is-not-installed"});ai.setPreferred("ollama:auto");
    await ai.run([{role:"user",content:"hello"}],{thinkingMode:"off"});
    check("missing configured model safely falls back to installed chat model",usedModel==="qwen3:4b"&&ai.ollamaConfig().model==="qwen3:4b");
  }

  // Loopback hostname fallback.
  {
    const handler=async(url,opts)=>{
      if(url.startsWith("http://localhost:11434")) throw new TypeError("Failed to fetch");
      if(url.endsWith("/api/tags")) return response({models:[{name:"qwen3:4b"}]});
      if(url.endsWith("/api/show")) return response({capabilities:["completion"]});
      if(url.endsWith("/api/chat")) return response({message:{content:"ALT_OK"}});
      throw new Error("unexpected "+url);
    };
    const {ai,calls}=await makeCore(handler);
    ai.configureOllama({baseUrl:"http://localhost:11434",model:"qwen3:4b"});ai.setPreferred("ollama:auto");
    const out=await ai.run([{role:"user",content:"alt"}],{thinkingMode:"off"});
    check("localhost network failure retries 127.0.0.1 loopback",calls.some(c=>c.url.startsWith("http://127.0.0.1:11434"))&&out.choices[0].message.content==="ALT_OK");
  }

  // keep_alive boundary and legacy value.
  for(const [value,expected] of [["default",undefined],["0","0"],["5m","5m"],["1h","1h"],["-1","30m"],["garbage","30m"]]){
    let chatBody=null;
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"qwen3:4b"}]});
      if(url.endsWith("/api/show")) return response({capabilities:["completion"]});
      if(url.endsWith("/api/chat")){chatBody=JSON.parse(opts.body);return response({message:{content:"OK"}})}
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler,{projectControlsNotebookRuntimeConfig:JSON.stringify({keepAlive:value,retryCount:0,thinkingMode:"off"})});
    ai.configureOllama({model:"qwen3:4b"});ai.setPreferred("ollama:auto");
    await ai.run([{role:"user",content:"ka"}],{thinkingMode:"off"});
    check(`keep_alive boundary ${value}`,expected===undefined?!("keep_alive" in chatBody):chatBody.keep_alive===expected);
  }

  // Repository context is included in the actual Ollama chat body.
  {
    let chatBody=null;
    const handler=async(url,opts)=>{
      if(url.endsWith("/api/tags")) return response({models:[{name:"qwen3:4b"}]});
      if(url.endsWith("/api/show")) return response({capabilities:["completion"]});
      if(url.endsWith("/api/chat")){chatBody=JSON.parse(opts.body);return response({message:{content:"CTX_OK"}})}
      throw new Error("unexpected");
    };
    const {ai,sandbox}=await makeCore(handler,{projectControlsNotebookRuntimeConfig:JSON.stringify({retryCount:0,thinkingMode:"off"})});
    sandbox.ProjectControlsSharedRepository={async getSelectedContextText(){return{text:"SHARED PROJECT REPOSITORY FILE\nNAME: perun 3.xer\n%T TASK\n%R A100 Important activity\nEND SHARED FILE"}}};
    ai.configureOllama({model:"qwen3:4b"});ai.setPreferred("ollama:auto");
    await ai.run([{role:"system",content:"Schedule analyst"},{role:"user",content:"Review perun 3.xer"}],{thinkingMode:"off"});
    const joined=chatBody.messages.map(m=>m.content).join("\n");
    check("selected repository XER reaches real Ollama request body",joined.includes("perun 3.xer")&&joined.includes("Important activity"));
  }

  // Error surfacing.
  {
    const handler=async(url)=>{
      if(url.endsWith("/api/tags")) return response({error:"server exploded"},500);
      throw new Error("unexpected");
    };
    const {ai}=await makeCore(handler);
    let msg="";try{await ai.listOllamaModels()}catch(e){msg=e.message}
    check("Ollama HTTP errors surfaced with server detail",/server exploded/.test(msg));
  }

  {
    const handler=async()=>{throw new TypeError("Failed to fetch")};
    const {ai}=await makeCore(handler);
    ai.configureOllama({baseUrl:"http://localhost:11434"});
    let msg="";try{await ai.listOllamaModels()}catch(e){msg=e.message}
    check("network/CORS failure gives actionable Settings guidance",/OLLAMA_ORIGINS/.test(msg)&&/localhost:11434/.test(msg));
  }

  console.log(`\nDeep Ollama compatibility: ${failures.length?"FAIL":"PASS"} (${failures.length} failures)`);
  if(failures.length){console.error(failures);process.exit(1)}
})().catch(e=>{console.error(e);process.exit(1)});
