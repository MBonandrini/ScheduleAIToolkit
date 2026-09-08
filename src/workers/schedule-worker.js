
import {parseXER} from "../parsers/xer.js";
import {compareSchedules} from "../analysis/comparison.js";
import {scheduleHealth} from "../analysis/health.js";
self.onmessage=e=>{
  const {id,type,payload}=e.data||{};
  try{
    let result;
    if(type==="parse-xer")result=parseXER(payload.text,payload.name);
    else if(type==="compare")result=compareSchedules(payload.previous,payload.current);
    else if(type==="health")result=scheduleHealth(payload.schedule);
    else throw new Error(`Unknown worker operation: ${type}`);
    postMessage({id,ok:true,result});
  }catch(error){postMessage({id,ok:false,error:error.message||String(error)})}
};
