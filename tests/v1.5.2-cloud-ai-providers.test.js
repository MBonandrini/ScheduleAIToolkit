import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {AI_CATALOG} from "../src/ai/catalog.js";

const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");

export async function run(){
  const app=read("src/ui/app.js"),cloud=read("src/ai/cloud.js"),runtime=read("src/ai/runtime.js");
  const openai=AI_CATALOG.find(x=>x.engine==="openai"),anthropic=AI_CATALOG.find(x=>x.engine==="anthropic");
  assert.ok(openai,"OpenAI must be present in the global AI catalogue");
  assert.ok(anthropic,"Anthropic must be present in the global AI catalogue");
  assert.equal(openai.model,"gpt-5.6");
  assert.equal(anthropic.model,"claude-sonnet-5");
  assert.ok(app.includes('id="openaiApiKey"')&&app.includes('id="anthropicApiKey"'));
  assert.ok(app.includes('id="testOpenai"')&&app.includes('id="testAnthropic"'));
  assert.ok(app.includes('bindCloudProvider("openai")')&&app.includes('bindCloudProvider("anthropic")'));
  assert.ok(runtime.includes('cloudChat("openai"')&&runtime.includes('cloudChat("anthropic"'));
  assert.ok(cloud.includes("https://api.openai.com/v1/responses"));
  assert.ok(cloud.includes("https://api.anthropic.com/v1/messages"));
  assert.ok(cloud.includes('"anthropic-version":"2023-06-01"'));
  assert.ok(cloud.includes('"anthropic-dangerous-direct-browser-access":"true"'));

  const oldStorage=globalThis.localStorage,oldFetch=globalThis.fetch;
  const store=new Map();
  globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const mod=await import(`../src/ai/cloud.js?v152=${Date.now()}`);
  mod.saveCloudConfig("openai",{apiKey:"test-openai-key",model:"gpt-5.6"});
  mod.saveCloudConfig("anthropic",{apiKey:"test-anthropic-key",model:"claude-sonnet-5"});
  assert.equal(mod.cloudConfig("openai").apiKey,"test-openai-key");
  assert.equal(mod.cloudConfig("anthropic").apiKey,"test-anthropic-key");

  const calls=[];
  globalThis.fetch=async(url,opt={})=>{
    calls.push({url:String(url),opt});
    if(String(url).includes("api.openai.com")){
      const body=JSON.parse(opt.body);
      assert.equal(body.model,"gpt-5.6");
      assert.equal(body.instructions,"System context");
      assert.equal(body.input[0].role,"user");
      assert.equal(opt.headers.Authorization,"Bearer test-openai-key");
      return {ok:true,status:200,statusText:"OK",text:async()=>JSON.stringify({output:[{content:[{type:"output_text",text:"OPENAI_OK"}]}]})};
    }
    if(String(url).includes("api.anthropic.com")){
      const body=JSON.parse(opt.body);
      assert.equal(body.model,"claude-sonnet-5");
      assert.equal(body.system,"System context");
      assert.equal(body.messages[0].role,"user");
      assert.equal(opt.headers["x-api-key"],"test-anthropic-key");
      assert.equal(opt.headers["anthropic-version"],"2023-06-01");
      assert.equal(opt.headers["anthropic-dangerous-direct-browser-access"],"true");
      return {ok:true,status:200,statusText:"OK",text:async()=>JSON.stringify({content:[{type:"text",text:"CLAUDE_OK"}]})};
    }
    throw new Error(`Unexpected URL ${url}`);
  };
  const messages=[{role:"system",content:"System context"},{role:"user",content:"Hello"}];
  const o=await mod.cloudChat("openai",messages);assert.equal(o.text,"OPENAI_OK");assert.equal(o.provider,"openai");
  const a=await mod.cloudChat("anthropic",messages);assert.equal(a.text,"CLAUDE_OK");assert.equal(a.provider,"anthropic");
  assert.equal(calls.length,2);
  mod.clearCloudKey("openai");mod.clearCloudKey("anthropic");
  assert.equal(mod.cloudConfig("openai").apiKey,"");assert.equal(mod.cloudConfig("anthropic").apiKey,"");

  if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
  if(oldFetch===undefined)delete globalThis.fetch;else globalThis.fetch=oldFetch;
  return "v1.5.2 OpenAI + Claude cloud providers";
}
