const fs=require("fs"),vm=require("vm"),path=require("path");
const corePath=path.join(__dirname,"..","assets","js","core.js");
function storage(){const map=new Map();return{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}}
async function makeCore(mode="ok"){
    const localStorage=storage(),sessionStorage=storage();
    const calls=[];
    async function fetch(url,opts={}){
        calls.push({url:String(url),method:opts.method||"GET",body:opts.body||null});
        if(String(url).endsWith("/api/tags")){
            if(mode==="network") throw new TypeError("Failed to fetch");
            if(mode==="nomodels") return new Response(JSON.stringify({models:[]}),{status:200,headers:{"content-type":"application/json"}});
            return new Response(JSON.stringify({models:[{name:"gemma3:4b",model:"gemma3:4b",size:1,details:{parameter_size:"4.3B",quantization_level:"Q4_K_M"}},{name:"embeddinggemma:latest",model:"embeddinggemma:latest",size:1,details:{parameter_size:"300M",quantization_level:"F16"}}]}),{status:200,headers:{"content-type":"application/json"}});
        }
        if(String(url).endsWith("/api/show")){
            const payload=JSON.parse(opts.body||"{}");
            const isEmbed=/embeddinggemma/i.test(payload.model||"");
            return new Response(JSON.stringify({model:payload.model,capabilities:isEmbed?["embedding"]:["completion"]}),{status:200,headers:{"content-type":"application/json"}});
        }
        if(String(url).endsWith("/api/chat")){
            if(mode==="chat500") return new Response(JSON.stringify({error:"model failed"}),{status:500,headers:{"content-type":"application/json"}});
            const payload=JSON.parse(opts.body||"{}");
            if(mode==="thinking" && payload.think!==false) return new Response(JSON.stringify({model:"qwen3:4b",message:{role:"assistant",content:"",thinking:"I should answer OK."}}),{status:200,headers:{"content-type":"application/json"}});
            if(mode==="emptychat") return new Response(JSON.stringify({model:payload.model||"qwen3:4b",message:{role:"assistant",content:""}}),{status:200,headers:{"content-type":"application/json"}});
            return new Response(JSON.stringify({model:payload.model||"gemma3:4b",message:{role:"assistant",content:"OK"}}),{status:200,headers:{"content-type":"application/json"}});
        }
        if(String(url).endsWith("/api/generate")){
            const payload=JSON.parse(opts.body||"{}");
            return new Response(JSON.stringify({model:payload.model||"qwen3:4b",response:"OK"}),{status:200,headers:{"content-type":"application/json"}});
        }
        throw new Error("Unexpected request "+url);
    }
    const sandbox={console,fetch,Response,Request,Headers,AbortController,setTimeout,clearTimeout,URL,Date,Math,JSON,Map,Set,Array,Object,String,Number,Boolean,RegExp,Promise,Uint8Array,Int32Array,Float64Array,Uint32Array,ArrayBuffer,TextDecoder,TextEncoder,crypto:globalThis.crypto,localStorage,sessionStorage,navigator:{},location:{href:"https://example.github.io/tool/",origin:"https://example.github.io",protocol:"https:"},document:{createElement:()=>({}),head:{appendChild(){}}},confirm:()=>true};
    sandbox.window=sandbox;sandbox.globalThis=sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(corePath,"utf8"),sandbox);
    return {ai:sandbox.ProjectControlsCore.ai,calls};
}
let failures=[];
function check(name,value){console.log((value?"PASS ":"FAIL ")+name);if(!value)failures.push(name)}
(async()=>{
    {
        const {ai,calls}=await makeCore();
        check("Ollama is enabled in shared catalog",ai.catalog.some(x=>x.value==="ollama:auto"&&x.engine==="ollama"&&!x.disabled));
        ai.configureOllama({baseUrl:"http://localhost:11434/api",model:""});
        check("Ollama base URL normalization",ai.ollamaConfig().baseUrl==="http://localhost:11434");
        const models=await ai.listOllamaModels();
        check("Ollama model discovery",models.length===2&&models.some(x=>x.name==="gemma3:4b"));
        const inspected=await ai.inspectOllamaModels();
        check("Ollama capability classification separates chat and embedding",inspected.find(x=>x.name==="gemma3:4b")?.supportsChat===true&&inspected.find(x=>x.name==="embeddinggemma:latest")?.supportsChat===false&&inspected.find(x=>x.name==="embeddinggemma:latest")?.supportsEmbedding===true);
        const result=await ai.testOllamaConnection({baseUrl:"http://localhost:11434",model:"gemma3:4b"});
        check("Ollama test completion",result.ok&&result.content==="OK"&&result.selectedModel==="gemma3:4b");
        await ai.ensure("ollama:auto");
        const run=await ai.run([{role:"user",content:"hello"}],{max_tokens:32});
        check("Shared AI run routes to Ollama",run.choices[0].message.content==="OK");
        check("Native /api/tags used",calls.some(x=>x.url.endsWith("/api/tags")));
        check("Native /api/chat used",calls.some(x=>x.url.endsWith("/api/chat")));
        check("Native /api/show used for capabilities",calls.some(x=>x.url.endsWith("/api/show")));
        let embeddingChatError="";
        try{await ai.testOllamaConnection({baseUrl:"http://localhost:11434",model:"embeddinggemma:latest"});}catch(e){embeddingChatError=String(e.message||e)}
        check("Embedding-only model is rejected as chat model",/does not support chat/i.test(embeddingChatError));
    }
    {
        const {ai,calls}=await makeCore("thinking");
        ai.configureOllama({baseUrl:"http://localhost:11434",model:"gemma3:4b"});
        const test=await ai.testOllamaConnection({baseUrl:"http://localhost:11434",model:"gemma3:4b"});
        const testChat=calls.filter(x=>x.url.endsWith("/api/chat")).map(x=>JSON.parse(x.body||"{}"));
        check("Ollama connection test disables thinking",test.ok===true&&testChat.some(x=>x.think===false));
        calls.length=0;
        localStorageSafe=undefined;
        await ai.ensure("ollama:auto");
        const out=await ai.run([{role:"user",content:"hello"}],{max_tokens:32,thinkingMode:"auto"});
        const bodies=calls.filter(x=>x.url.endsWith("/api/chat")).map(x=>JSON.parse(x.body||"{}"));
        check("Thinking-only Ollama response retries with thinking disabled",out.choices[0].message.content==="OK"&&bodies.length===2&&bodies[1].think===false);
    }
    {
        const {ai,calls}=await makeCore("emptychat");
        ai.configureOllama({baseUrl:"http://localhost:11434",model:"gemma3:4b"});
        const result=await ai.testOllamaConnection({baseUrl:"http://localhost:11434",model:"gemma3:4b"});
        check("Empty /api/chat response falls back to /api/generate",result.ok===true&&result.content==="OK"&&calls.some(x=>x.url.endsWith("/api/generate")));
    }
    {
        const {ai}=await makeCore("nomodels");
        const result=await ai.testOllamaConnection({baseUrl:"http://localhost:11434"});
        check("No-model condition is explicit",result.ok===false&&/no models/i.test(result.message));
    }
    {
        const {ai}=await makeCore("chat500");
        let text="";
        try{await ai.testOllamaConnection({baseUrl:"http://localhost:11434",model:"gemma3:4b"});}catch(e){text=String(e.message||e)}
        check("Ollama server error is surfaced",/model failed/i.test(text));
    }
    {
        const {ai}=await makeCore("network");
        let text="";
        try{await ai.listOllamaModels();}catch(e){text=String(e.message||e)}
        check("Ollama network/CORS error is actionable",/OLLAMA_ORIGINS/i.test(text)&&/Ollama/i.test(text));
    }
    if(failures.length){console.error("FAILURES",failures);process.exit(1)}
})().catch(error=>{console.error(error);process.exit(1)});
