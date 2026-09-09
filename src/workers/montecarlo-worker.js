
import {runMonteCarlo} from "../analysis/risk.js?v=1.2.0";
self.onmessage=e=>{
  const {id,schedule,options}=e.data||{};
  try{postMessage({id,ok:true,result:runMonteCarlo(schedule,options)})}
  catch(error){postMessage({id,ok:false,error:error.message||String(error)})}
};
