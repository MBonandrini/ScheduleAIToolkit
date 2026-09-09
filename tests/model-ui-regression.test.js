
import assert from "node:assert/strict";
import fs from "node:fs";import path from "node:path";
import {AI_CATALOG,DEFAULT_AI_VALUE} from "../src/ai/catalog.js";
import {browserCPU,releaseBrowserAI} from "../src/ai/browser.js";
const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");
export async function run(){
  const html=read("index.html"),app=read("src/ui/app.js"),css=read("assets/app.css"),browser=read("src/ai/browser.js"),runtime=read("src/ai/runtime.js");
  assert.equal(DEFAULT_AI_VALUE,"none");
  assert.equal((html.match(/id="aiDisplay"/g)||[]).length,1);
  assert.equal((html.match(/id="aiSelect"/g)||[]).length,0);
  assert.ok(app.includes("renderAIModelDisplay"));assert.ok(app.includes("settingsAiSelect"));assert.ok(app.includes("testSelectedAI"));
  assert.ok(app.includes("No AI is the default"));
  assert.ok(browser.includes("@huggingface/transformers@4.2.0"));assert.ok(browser.includes("@mlc-ai/web-llm@0.2.84"));
  const enabled=AI_CATALOG.filter(x=>!x.disabled);assert.ok(enabled.length>=12);
  assert.ok(enabled.some(x=>x.label==="WebLLM — Qwen3 8B"));assert.ok(enabled.some(x=>x.label==="WebLLM — Qwen2.5 3B"));assert.ok(enabled.some(x=>x.label==="Browser CPU/WASM — Llama 3.2 1B"));
  assert.ok(enabled.find(x=>x.value==="none"));assert.ok(enabled.filter(x=>x.value!=="none").every(x=>Number(x.contextChars)>0));
  assert.ok(html.includes('data-theme="navy"'));assert.ok(css.includes("PROFESSIONAL APPLICATION CHROME v1.1"));
  assert.ok(css.includes("grid-template-rows:52px 42px"));assert.ok(css.includes("--content-max:1680px"));assert.ok(css.includes(".chat{"));
  assert.ok(css.includes('html[data-theme="dark"]'));assert.ok(css.includes('html[data-theme="light"]'));assert.ok(css.includes('html[data-theme="navy"]'));
  assert.ok(html.includes('id="renameProjectBtn"'));assert.ok(!html.includes('id="projectName"'));
  await releaseBrowserAI();
  globalThis.__PC_AI_TEST_HOOKS__={transformers:{pipeline:async()=>async()=>{throw new Error("failed to call OrtRun(). ERROR_CODE: 2, ERROR_MESSAGE: indices element out of data bounds, idx=32768 must be within the inclusive range [-32768,32767]")}}};
  let msg="";try{await browserCPU([{role:"user",content:"test"}],{model:"onnx-community/Qwen2.5-0.5B-Instruct"})}catch(e){msg=e.message}
  delete globalThis.__PC_AI_TEST_HOOKS__;await releaseBrowserAI();
  assert.ok(/safe browser context boundary/i.test(msg),msg);
  assert.ok(runtime.includes("SCHEDULE PORTFOLIO / REVISION SUMMARY"));assert.ok(runtime.includes("skipScheduleText:true"));
  return `model-ui-regression-${enabled.length}`;
}
