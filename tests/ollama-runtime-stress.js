
const fs=require("fs"),vm=require("vm"),path=require("path");
const corePath=path.join(__dirname,"..","assets","js","core.js");
function storage(){const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
(async()=>{
 let tags=0,shows=0,chats=0;
 async function fetch(url,opts={}){
   if(String(url).endsWith("/api/tags")){tags++;await new Promise(r=>setTimeout(r,5));return new Response(JSON.stringify({models:[{name:"qwen3:4b"}]}),{status:200,headers:{"content-type":"application/json"}})}
   if(String(url).endsWith("/api/show")){shows++;await new Promise(r=>setTimeout(r,5));return new Response(JSON.stringify({capabilities:["completion"]}),{status:200,headers:{"content-type":"application/json"}})}
   if(String(url).endsWith("/api/chat")){chats++;await new Promise(r=>setTimeout(r,2));return new Response(JSON.stringify({message:{content:"OK"}}),{status:200,headers:{"content-type":"application/json"}})}
   throw new Error("unexpected "+url);
 }
 const localStorage=storage(),sessionStorage=storage();
 const sandbox={console,fetch,Response,Request,Headers,AbortController,setTimeout,clearTimeout,URL,Date,Math,JSON,Map,Set,Array,Object,String,Number,Boolean,RegExp,Promise,Uint8Array,Int32Array,Float64Array,Uint32Array,ArrayBuffer,TextDecoder,TextEncoder,crypto:globalThis.crypto,localStorage,sessionStorage,navigator:{},location:{href:"https://example.github.io/",origin:"https://example.github.io",protocol:"https:"},document:{createElement:()=>({}),head:{appendChild(){}}},postMessage(){}};
 sandbox.window=sandbox;sandbox.globalThis=sandbox;
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(corePath,"utf8"),sandbox);
 const ai=sandbox.ProjectControlsCore.ai;
 ai.configureOllama({model:"qwen3:4b"});ai.setPreferred("ollama:auto");
 const jobs=Array.from({length:25},(_,i)=>ai.run([{role:"user",content:`request ${i}`}],{thinkingMode:"off",temperature:0.1,max_tokens:32}));
 const outputs=await Promise.all(jobs);
 const ok=outputs.every(x=>x?.choices?.[0]?.message?.content==="OK");
 const checks=[
  ["25 concurrent requests all succeed",ok],
  ["concurrent ensure performs one model discovery",tags===1],
  ["concurrent ensure performs one capability inspection",shows===1],
  ["all 25 chat calls execute",chats===25]
 ];
 let bad=0;for(const [n,v] of checks){console.log(`${v?"PASS":"FAIL"} ${n}`);if(!v)bad++}
 if(bad)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
