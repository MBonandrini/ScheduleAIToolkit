
import {chat as ollamaChat,ollamaConfig} from "./ollama.js";
import {browserCPU,browserTransformersGPU,browserMLC,releaseBrowserAI,testBrowserAI} from "./browser.js";
import {AI_CATALOG,DEFAULT_AI_VALUE,aiEntry,aiCompatibility,catalogueGroups} from "./catalog.js";
import {toolRegistry,inferTool} from "./tools.js";
import {selectedContext} from "../repository/repository.js";
import {scheduleSummary} from "../core/model.js";

const AI_KEY="pcai.model",LEGACY_KEY="pcai.engine";
export {AI_CATALOG,aiEntry,aiCompatibility,catalogueGroups};

function migrateLegacy(){
  const existing=localStorage.getItem(AI_KEY);if(existing)return existing;
  const legacy=localStorage.getItem(LEGACY_KEY);
  const mapped=legacy==="browser-cpu"?"cpu:qwen2.5-0.5b":legacy==="browser-gpu"?"mlc:llama3.2-1b":legacy==="ollama"?"ollama:auto":null;
  if(mapped)localStorage.setItem(AI_KEY,mapped);
  return mapped;
}
export function preferredAI(){return migrateLegacy()||localStorage.getItem(AI_KEY)||DEFAULT_AI_VALUE}
export async function setPreferredAI(value){
  const entry=aiEntry(value);if(entry.disabled)throw new Error("This AI option is not available yet.");
  localStorage.setItem(AI_KEY,entry.value);localStorage.removeItem(LEGACY_KEY);await releaseBrowserAI();return entry;
}
export function aiLabel(value=preferredAI()){
  const e=aiEntry(value);
  if(e.engine==="ollama")return `Ollama${ollamaConfig().model?` · ${ollamaConfig().model}`:" · selected local model"}`;
  return e.label;
}
function progress(x){globalThis.dispatchEvent?.(new CustomEvent("pc-progress",{detail:x}))}
function portfolioSummary(revisions=[]){
  return revisions.slice(-30).map(s=>{const x=scheduleSummary(s);return {file:s.sourceName||s.name,project:s.projectName||s.name,dataDate:x.dataDate,activities:x.activities,progress:Number(x.progress.toFixed(1)),critical:x.critical,negativeFloat:x.negativeFloat,forecastFinish:x.forecastFinish}});
}
function compactStructured(value,maxChars){if(value==null)return "";let text;try{text=JSON.stringify(value)}catch{text=String(value)}return text.length<=maxChars?text:text.slice(0,maxChars)+"…[truncated]"}
function budgetFor(entry){
  const chars=Math.max(4000,Number(entry.contextChars)||10000);
  return {repoTotal:Math.round(chars*.58),repoFile:Math.min(9000,Math.round(chars*.35)),structured:Math.round(chars*.30),portfolio:Math.round(chars*.20),historyMessages:entry.engine==="ollama"?10:4};
}
export async function askAI({question,role="Project Controls Manager",current=null,previous=null,revisions=[],history=[]}){
  if(!question?.trim())throw new Error("Question required");
  const entry=aiEntry(preferredAI()),compat=aiCompatibility(entry.value);if(!compat.ok)throw new Error(compat.reason);
  const budget=budgetFor(entry),reg=current?toolRegistry({current,previous,revisions}):{},call=current?inferTool(question,current):null;
  let structured=null;if(call&&reg[call.name]){try{structured=reg[call.name](call.args)}catch(e){structured={error:e.message}}}
  const repo=await selectedContext({question,maxFileChars:budget.repoFile,maxTotalChars:budget.repoTotal,skipScheduleText:true});
  const system=`You are the ${role} inside Schedule AI Toolkit, a professional project-controls workbench.
Use project evidence carefully. Never invent Primavera fields, contract clauses, dates or quantities.
When structured schedule evidence is supplied, prefer it over guesses.
Distinguish confirmed evidence from inference. Cite filenames or activity IDs when material.
The toolkit is an analytical layer above P6/MS Project, not a replacement scheduling engine.

ACTIVE SCHEDULE OVERVIEW:
${compactStructured(current?scheduleSummary(current):null,budget.portfolio)}

SCHEDULE PORTFOLIO / REVISION SUMMARY:
${compactStructured(portfolioSummary(revisions),budget.portfolio)}

${structured?`STRUCTURED SCHEDULE TOOL RESULT (${call.name}):
${compactStructured(structured,budget.structured)}`:""}

SELECTED PROJECT REPOSITORY CONTEXT:
${repo.text}`;
  const messages=[{role:"system",content:system},...history.slice(-budget.historyMessages).map(x=>({role:x.role,content:String(x.content||"").slice(0,3000)})),{role:"user",content:question}];
  const onProgress=x=>progress(x);let out;
  if(entry.engine==="cpu")out=await browserCPU(messages,{model:entry.model,dtype:entry.dtype||"q4",onProgress});
  else if(entry.engine==="gpu-transformers")out=await browserTransformersGPU(messages,{model:entry.model,dtype:entry.dtype||"q4",onProgress});
  else if(entry.engine==="mlc")out=await browserMLC(messages,{model:entry.model,onProgress});
  else if(entry.engine==="ollama")out=await ollamaChat(messages,{onProgress});
  else throw new Error("This AI option is not available yet.");
  return {...out,aiValue:entry.value,aiLabel:aiLabel(entry.value),sources:repo.files.map(f=>({id:f.id,name:f.name,category:f.category,relativePath:f.relativePath})),structuredTool:call?.name||null};
}
export async function testSelectedAI({onProgress=null}={}){
  const entry=aiEntry(preferredAI()),compat=aiCompatibility(entry.value);
  if(!compat.ok)return {ok:false,message:compat.reason,entry};
  if(entry.engine==="ollama")return {ok:true,message:"Use the Ollama Test & Save control in Settings for a full local-server test.",entry};
  try{const r=await testBrowserAI(entry,{onProgress:onProgress||((x)=>progress(x))});return {ok:r.ok,message:r.ok?`${entry.label} responded correctly.`:`${entry.label} returned: ${r.text}`,entry}}
  catch(error){return {ok:false,message:error.message||String(error),entry}}
}
