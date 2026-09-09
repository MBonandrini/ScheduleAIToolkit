
import {uid} from "../core/utils.js";
import {parseScheduleFile} from "../parsers/index.js";

function workerSupported(){return typeof Worker!=="undefined"&&typeof URL!=="undefined"}
async function callWorker(url,type,payload){
  return await new Promise((resolve,reject)=>{
    const w=new Worker(url,{type:"module"}),id=uid("worker");
    const done=()=>{try{w.terminate()}catch{}};
    w.onmessage=e=>{if(e.data?.id!==id)return;done();e.data.ok?resolve(e.data.result):reject(new Error(e.data.error))};
    w.onerror=e=>{done();reject(e.error||new Error(e.message||"Worker failed"))};
    w.postMessage({id,type,payload});
  });
}
export async function parseScheduleOffThread(file){
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(workerSupported()&&ext==="xer"){
    try{return await callWorker(new URL("./schedule-worker.js",import.meta.url),"parse-xer",{text:await file.text(),name:file.name})}
    catch(error){console.warn("Worker XER parse failed; falling back to main thread",error)}
  }
  return await parseScheduleFile(file);
}
export async function compareOffThread(previous,current){
  if(workerSupported()){
    try{return await callWorker(new URL("./schedule-worker.js",import.meta.url),"compare",{previous,current})}
    catch(error){console.warn("Worker comparison failed; falling back to caller",error)}
  }
  return null;
}
