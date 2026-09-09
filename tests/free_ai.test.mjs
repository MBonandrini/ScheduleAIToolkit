import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FREE_AI,FREE_BROWSER_MODELS,migrateAIConfig,aiModeLabel,modelLabel,browserAIStatus,ollamaRequest,callOllama
} from '../js/free_ai.mjs';

test('free AI default is offline',()=>{assert.equal(DEFAULT_FREE_AI.mode,'offline');});
test('legacy paid proxy config migrates to offline',()=>{assert.equal(migrateAIConfig({mode:'proxy',proxyEndpoint:'https://x',model:'paid'}).mode,'offline');});
test('paid proxy fields are not retained',()=>{const x=migrateAIConfig({mode:'proxy',proxyEndpoint:'secret',model:'paid'});assert.equal('proxyEndpoint' in x,false);assert.equal('model' in x,false);});
test('valid free modes survive migration',()=>{for(const m of ['offline','ollama','webllm'])assert.equal(migrateAIConfig({mode:m}).mode,m);});
test('AI labels are free-mode labels',()=>{assert.equal(aiModeLabel('ollama'),'Local Ollama');assert.equal(aiModeLabel('webllm'),'Browser AI (WebGPU)');assert.equal(aiModeLabel('offline'),'Offline / No AI');});
test('model label shows none offline',()=>{assert.equal(modelLabel({mode:'offline'}),'None');});
test('browser status rejects no WebGPU',()=>{assert.equal(browserAIStatus({}).ok,false);});
test('browser status accepts WebGPU object',()=>{assert.equal(browserAIStatus({gpu:{}}).ok,true);});
test('browser model presets are nonempty and unique',()=>{assert(FREE_BROWSER_MODELS.length>=2);assert.equal(new Set(FREE_BROWSER_MODELS.map(x=>x.id)).size,FREE_BROWSER_MODELS.length);});
test('Ollama request uses local chat endpoint and selected model',()=>{const r=ollamaRequest({mode:'ollama',ollamaEndpoint:'http://127.0.0.1:11434/',ollamaModel:'gemma3:4b'},'sys','usr');assert.equal(r.endpoint,'http://127.0.0.1:11434/api/chat');const b=JSON.parse(r.init.body);assert.equal(b.model,'gemma3:4b');assert.equal(b.messages[0].content,'sys');});
test('Ollama successful response extracts assistant text',async()=>{const fake=async()=>new Response(JSON.stringify({message:{content:'ok'}}),{status:200,headers:{'Content-Type':'application/json'}});assert.equal(await callOllama({mode:'ollama'},'s','u',fake),'ok');});
test('Ollama error is propagated clearly',async()=>{const fake=async()=>new Response(JSON.stringify({error:'model missing'}),{status:404,headers:{'Content-Type':'application/json'}});await assert.rejects(()=>callOllama({mode:'ollama'},'s','u',fake),/404.*model missing/);});
