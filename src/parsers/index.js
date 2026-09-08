
import {parseXER} from "./xer.js";
import {parseMSProjectXML} from "./mspxml.js";
export async function parseScheduleFile(file){
  const text=await file.text(),ext=(file.name.split(".").pop()||"").toLowerCase();
  if(ext==="xer")return parseXER(text,file.name);
  if(ext==="xml")return parseMSProjectXML(text,file.name);
  throw new Error(`Unsupported schedule format: .${ext}`);
}
