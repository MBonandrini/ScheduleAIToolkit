
import {chat as ollamaChat,ollamaConfig} from "./ollama.js";
import {browserCPU,browserGPU,releaseBrowserAI} from "./browser.js";
import {toolRegistry,inferTool} from "./tools.js";
import {selectedContext} from "../repository/repository.js";

const AI_KEY="pcai.engine";
export function preferredAI(){return localStorage.getItem(AI_KEY)||"ollama"}
export async function setPreferredAI(v){localStorage.setItem(AI_KEY,v);await releaseBrowserAI()}
export function aiLabel(v=preferredAI()){return v==="ollama"?`Ollama${ollamaConfig().model?` · ${ollamaConfig().model}`:""}`:v==="browser-cpu"?"Browser CPU AI":v==="browser-gpu"?"Browser WebGPU AI":"AI"}
function progress(x){globalThis.dispatchEvent?.(new CustomEvent("pc-progress",{detail:x}))}
export async function askAI({question,role="Project Controls Manager",current=null,previous=null,revisions=[],history=[]}){
  if(!question?.trim())throw new Error("Question required");
  const reg=current?toolRegistry({current,previous,revisions}):{},call=current?inferTool(question,current):null;
  let structured=null;if(call&&reg[call.name]){try{structured=reg[call.name](call.args)}catch(e){structured={error:e.message}}}
  const repo=await selectedContext();
  const system=`You are the ${role} inside Schedule AI Toolkit, a professional project-controls workbench.
Use project evidence carefully. Never invent Primavera fields, contract clauses, dates or quantities.
When structured schedule evidence is supplied, prefer it over guesses.
Distinguish confirmed evidence from inference. Cite filenames or activity IDs when material.
The toolkit is an analytical layer above P6/MS Project, not a replacement scheduling engine.

${structured?`STRUCTURED SCHEDULE TOOL RESULT (${call.name}):\n${JSON.stringify(structured).slice(0,500000)}`:""}

SELECTED PROJECT REPOSITORY CONTEXT:
${repo.text.slice(0,1500000)}`;
  const messages=[{role:"system",content:system},...history.slice(-12),{role:"user",content:question}];
  const engine=preferredAI(),onProgress=x=>progress(x);
  let out;
  if(engine==="browser-cpu")out=await browserCPU(messages,{onProgress});
  else if(engine==="browser-gpu")out=await browserGPU(messages,{onProgress});
  else out=await ollamaChat(messages,{onProgress});
  return {...out,sources:repo.files.map(f=>({id:f.id,name:f.name,category:f.category,relativePath:f.relativePath})),structuredTool:call?.name||null};
}
