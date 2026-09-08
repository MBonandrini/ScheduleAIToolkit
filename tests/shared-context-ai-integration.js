const fs=require("fs"),vm=require("vm"),path=require("path");
const corePath=path.join(__dirname,"..","assets","js","core.js");
function storage(){const map=new Map();return{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}}
(async()=>{
 const localStorage=storage(),sessionStorage=storage(),calls=[];
 async function fetch(url,opts={}){
   calls.push({url:String(url),body:opts.body||null});
   if(String(url).endsWith("/api/tags")) return new Response(JSON.stringify({models:[{name:"qwen3:4b",model:"qwen3:4b"}]}),{status:200,headers:{"content-type":"application/json"}});
   if(String(url).endsWith("/api/show")) return new Response(JSON.stringify({capabilities:["completion"]}),{status:200,headers:{"content-type":"application/json"}});
   if(String(url).endsWith("/api/chat")) return new Response(JSON.stringify({message:{role:"assistant",content:"Perun context received"}}),{status:200,headers:{"content-type":"application/json"}});
   throw new Error("Unexpected "+url);
 }
 const sandbox={console,fetch,Response,Request,Headers,AbortController,setTimeout,clearTimeout,URL,Date,Math,JSON,Map,Set,Array,Object,String,Number,Boolean,RegExp,Promise,Uint8Array,Int32Array,Float64Array,Uint32Array,ArrayBuffer,TextDecoder,TextEncoder,crypto:globalThis.crypto,localStorage,sessionStorage,navigator:{},location:{href:"https://example.github.io/tool/",origin:"https://example.github.io",protocol:"https:"},document:{createElement:()=>({}),head:{appendChild(){}}},postMessage(){}};
 sandbox.window=sandbox;sandbox.globalThis=sandbox;
 sandbox.ProjectControlsSharedRepository={async getSelectedContextText(){return{text:"SHARED PROJECT REPOSITORY FILE\nNAME: perun 3.xer\n%T\tTASK\n%R\t123\tPerun Activity\nEND SHARED FILE",files:[{name:"perun 3.xer"}]}}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(corePath,"utf8"),sandbox);
 const ai=sandbox.ProjectControlsCore.ai;
 ai.configureOllama({baseUrl:"http://localhost:11434",model:"qwen3:4b"});ai.setPreferred("ollama:auto");
 const result=await ai.run([{role:"system",content:"Schedule assistant"},{role:"user",content:"What is in perun 3.xer?"}],{thinkingMode:"off"});
 const chat=calls.find(x=>x.url.endsWith("/api/chat"));
 const body=JSON.parse(chat.body);
 const payload=body.messages.map(x=>x.content).join("\n");
 const checks=[
   ["selected XER filename reaches shared AI request",payload.includes("perun 3.xer")],
   ["selected XER content reaches shared AI request",payload.includes("Perun Activity")],
   ["original user question remains present",payload.includes("What is in perun 3.xer?")],
   ["mock response returned",result?.choices?.[0]?.message?.content==="Perun context received"]
 ];
 let bad=0;for(const [name,ok] of checks){console.log(`${ok?"PASS":"FAIL"} ${name}`);if(!ok)bad++}
 if(bad)process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
