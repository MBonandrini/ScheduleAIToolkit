
import {createSchedule} from "../src/core/model.js";
export function sampleSchedule({name="Rev 1",dataDate="2026-08-01",shift=0}={}){
  const d=n=>{const x=new Date("2026-08-01T00:00:00Z");x.setUTCDate(x.getUTCDate()+n+shift);return x.toISOString()};
  return createSchedule({
    id:name,projectName:"Perun",name,sourceName:`${name}.xer`,dataDate,
    wbs:[{id:"W1",name:"Electrical",code:"ELEC"},{id:"W2",parentId:"W1",name:"Energisation",code:"ENG"}],
    calendars:[{id:"C1",name:"5 Day",hoursPerDay:8,hoursPerWeek:40,raw:{clndr_data:"Exception 25-Dec-2026"}}],
    activities:[
      {id:"A100",name:"Design complete",wbsId:"W1",start:d(0),finish:d(5),baselineStart:d(0),baselineFinish:d(5),originalDuration:5,totalFloat:2,percent:100,activityType:"Task",calendarId:"C1"},
      {id:"A200",name:"Switchgear delivery",wbsId:"W1",start:d(5),finish:d(15),baselineStart:d(5),baselineFinish:d(12),originalDuration:10,totalFloat:0,percent:70,activityType:"Task",calendarId:"C1",budgetUnits:100,actualUnits:60,remainingUnits:40},
      {id:"A300",name:"Install switchgear",wbsId:"W2",start:d(15),finish:d(20),baselineStart:d(12),baselineFinish:d(17),originalDuration:5,totalFloat:0,percent:20,activityType:"Task",calendarId:"C1",budgetUnits:80,actualUnits:10,remainingUnits:70},
      {id:"M400",name:"MV Energisation",wbsId:"W2",start:d(20),finish:d(20),baselineStart:d(17),baselineFinish:d(17),originalDuration:0,totalFloat:0,percent:0,activityType:"Finish Milestone",milestone:true,calendarId:"C1"},
      {id:"A500",name:"L4 Functional Testing",wbsId:"W2",start:d(20),finish:d(28),baselineStart:d(17),baselineFinish:d(25),originalDuration:8,totalFloat:5,percent:0,activityType:"Task",calendarId:"C1"},
      {id:"M600",name:"IST Complete",wbsId:"W2",start:d(28),finish:d(28),baselineStart:d(25),baselineFinish:d(25),originalDuration:0,totalFloat:3,percent:0,activityType:"Finish Milestone",milestone:true,calendarId:"C1"}
    ],
    relationships:[
      {predId:"A100",succId:"A200",type:"FS",lag:0},
      {predId:"A200",succId:"A300",type:"FS",lag:0},
      {predId:"A300",succId:"M400",type:"FS",lag:0},
      {predId:"M400",succId:"A500",type:"FS",lag:0},
      {predId:"A500",succId:"M600",type:"FS",lag:0}
    ]
  });
}
export function comparisonPair(){
  const p=sampleSchedule({name:"Rev 1",dataDate:"2026-08-01",shift:0});
  const c=sampleSchedule({name:"Rev 2",dataDate:"2026-08-08",shift:3});
  c.activities.find(a=>a.id==="A300").originalDuration=8;
  c.activities.find(a=>a.id==="A300").totalFloat=-3;
  c.activities.find(a=>a.id==="A300").critical=true;
  c.activities.find(a=>a.id==="A200").percent=85;
  c.activities.push({...c.activities[0],id:"A700",name:"Additional works",percent:0,critical:false,totalFloat:10});
  c.relationships.push({id:"extra",predId:"A200",succId:"A700",type:"FS",lag:0});
  return {previous:p,current:c};
}
export function syntheticXER(activityCount=100,relationshipCount=250){
  const lines=[
    "ERMHDR\t21.12\t2026-01-01",
    "%T\tPROJECT","%F\tproj_id\tproj_short_name\tlast_recalc_date","%R\t1\tSynthetic\t2026-08-01 08:00",
    "%T\tPROJWBS","%F\twbs_id\tparent_wbs_id\twbs_short_name\twbs_name","%R\t10\t\tROOT\tRoot",
    "%T\tCALENDAR","%F\tclndr_id\tclndr_name\tclndr_type\tday_hr_cnt\tweek_hr_cnt\tclndr_data","%R\t1\t5 Day\tCA_Base\t8\t40\tException 25-Dec-2026",
    "%T\tTASK","%F\ttask_id\ttask_code\ttask_name\twbs_id\tstatus_code\ttask_type\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct\tclndr_id"
  ];
  for(let i=0;i<activityCount;i++){
    const start=new Date(Date.UTC(2026,7,1+i%300)),finish=new Date(start);finish.setUTCDate(finish.getUTCDate()+5);
    lines.push(`%R\t${i+1}\tA${String(i+1).padStart(6,"0")}\tActivity ${i+1}\t10\tTK_NotStart\tTT_Task\t${start.toISOString()}\t${finish.toISOString()}\t120\t120\t${(i%30)*24}\t0\t1`);
  }
  lines.push("%T\tTASKPRED","%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt");
  for(let i=0;i<relationshipCount;i++){
    const pred=i%Math.max(1,activityCount-1)+1,succ=Math.min(activityCount,pred+1);
    lines.push(`%R\t${i+1}\t${succ}\t${pred}\tPR_FS\t0`);
  }
  return lines.join("\n");
}
