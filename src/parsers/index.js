import {parseXER} from "./xer.js";
import {parseMSProjectXML} from "./mspxml.js";

const MPP_BRIDGE_DEFAULT="http://127.0.0.1:8765";
export function mppBridgeUrl(){return localStorage.getItem("pcai.mppBridgeUrl")||MPP_BRIDGE_DEFAULT}
export function setMppBridgeUrl(url){const clean=String(url||MPP_BRIDGE_DEFAULT).replace(/\/$/,"");localStorage.setItem("pcai.mppBridgeUrl",clean);return clean}
export async function probeMppBridge(baseUrl=mppBridgeUrl()){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
  try{const r=await fetch(`${String(baseUrl).replace(/\/$/,"")}/health`,{signal:controller.signal,cache:"no-store"});if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json().catch(()=>({}));return {ok:true,message:j.message||"Local MPP parser is ready",version:j.version||""}}
  catch(error){return {ok:false,message:error.name==="AbortError"?"Local MPP parser did not respond.":error.message||String(error)}}finally{clearTimeout(timer)}
}
async function parseMPPViaLocalBridge(file){
  const base=mppBridgeUrl(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
  try{
    const body=await file.arrayBuffer(),r=await fetch(`${base}/convert`,{method:"POST",headers:{"Content-Type":"application/octet-stream","X-Filename":encodeURIComponent(file.name)},body,signal:controller.signal});
    const text=await r.text();if(!r.ok)throw new Error(text||`MPP converter returned HTTP ${r.status}`);
    const parsed=parseMSProjectXML(text,file.name);parsed.sourceFormat="mpp";return parsed;
  }catch(error){
    if(error.name==="AbortError")throw new Error("MPP conversion timed out. Confirm the local MPP parser is running, then try again.");
    throw new Error(`MPP files require the local MPP parser on this GitHub Pages build. Run setup-mpp-bridge.bat once, leave its window open while importing, then retry. Detail: ${error.message||error}`);
  }finally{clearTimeout(timer)}
}
export async function parseScheduleFile(file){
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(ext==="mpp")return await parseMPPViaLocalBridge(file);
  const text=await file.text();
  if(ext==="xer")return parseXER(text,file.name);
  if(ext==="xml")return parseMSProjectXML(text,file.name);
  throw new Error(`Unsupported schedule format: .${ext}`);
}
