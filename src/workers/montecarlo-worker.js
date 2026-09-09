
import {runMonteCarlo} from "../analysis/risk.js";
self.onmessage=e=>{
  const {id,schedule,options}=e.data||{};
  try{postMessage({id,ok:true,result:runMonteCarlo(schedule,options)})}
  catch(error){postMessage({id,ok:false,error:error.message||String(error)})}
};
