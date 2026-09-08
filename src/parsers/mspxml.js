
import {createSchedule} from "../core/model.js";
function unesc(s){return String(s||"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&")}
function tag(block,name){
  const m=String(block||"").match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));
  return m?unesc(m[1].replace(/<[^>]+>/g,"").trim()):"";
}
function blocks(xml,name){return [...String(xml||"").matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"gi"))].map(m=>m[1])}
export function parseMSProjectXML(text,sourceName="schedule.xml"){
  const xml=String(text||"");if(!/<Project[\s>]/i.test(xml))throw new Error("Invalid Microsoft Project XML");
  const projectName=tag(xml,"Name")||sourceName,dataDate=tag(xml,"StatusDate");
  const tasks=blocks(xml,"Task");
  const activities=tasks.filter(t=>tag(t,"UID")!=="0").map(t=>({
    id:tag(t,"ID")||tag(t,"UID"),uid:tag(t,"UID"),name:tag(t,"Name"),
    status:Number(tag(t,"PercentComplete"))>=100?"Complete":Number(tag(t,"PercentComplete"))>0?"In Progress":"Not Started",
    start:tag(t,"Start"),finish:tag(t,"Finish"),currentStart:tag(t,"Start"),currentFinish:tag(t,"Finish"),
    baselineStart:tag(blocks(t,"Baseline")[0]||"","Start"),baselineFinish:tag(blocks(t,"Baseline")[0]||"","Finish"),
    actualStart:tag(t,"ActualStart"),actualFinish:tag(t,"ActualFinish"),percent:Number(tag(t,"PercentComplete"))||0,
    originalDuration:0,remainingDuration:0,totalFloat:Number(tag(t,"TotalSlack"))||0,
    milestone:tag(t,"Milestone")==="1",activityType:tag(t,"Milestone")==="1"?"Milestone":"Task",raw:{}
  }));
  const uidToId=new Map(activities.map(a=>[a.uid,a.id])),relationships=[];
  for(const t of tasks){
    const succ=uidToId.get(tag(t,"UID"));if(!succ)continue;
    for(const p of blocks(t,"PredecessorLink")){
      const pred=uidToId.get(tag(p,"PredecessorUID"));if(!pred)continue;
      const map={"0":"FF","1":"FS","2":"SF","3":"SS"};
      relationships.push({predId:pred,succId:succ,type:map[tag(p,"Type")]||"FS",lag:Number(tag(p,"LinkLag"))/4800||0});
    }
  }
  return {schedules:[createSchedule({name:projectName,projectName,sourceName,dataDate,activities,relationships})],diagnostics:{warnings:[],errors:[]}};
}
