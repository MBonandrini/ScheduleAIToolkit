import assert from "node:assert/strict";
import {createSchedule} from "../src/core/model.js";
import {parseXER} from "../src/parsers/xer.js";
import {gantt} from "../src/ui/render.js";

export async function run(){
  const d=n=>new Date(Date.UTC(2026,8,1+n)).toISOString();
  const s=createSchedule({
    name:"WBS Order Test",projectName:"WBS Order Test",dataDate:d(0),
    wbs:[
      {id:"ROOT",code:"PRJ",name:"Project",seqNum:1000,projectNode:true,sourceOrder:0},
      {id:"EARLY",parentId:"ROOT",code:"ZZZ",name:"First by P6 order",seqNum:2000,sourceOrder:1},
      {id:"MID",parentId:"EARLY",code:"MID",name:"Intermediate Parent",seqNum:2100,sourceOrder:2},
      {id:"LEAF",parentId:"MID",code:"LEAF",name:"Leaf",seqNum:2200,sourceOrder:3},
      {id:"LATE",parentId:"ROOT",code:"AAA",name:"Second by P6 order",seqNum:3000,sourceOrder:4},
      {id:"EMPTY",parentId:"ROOT",code:"EMPTY",name:"Empty WBS",seqNum:4000,sourceOrder:5}
    ],
    activities:[
      {id:"A1",name:"Leaf activity",wbsId:"LEAF",start:d(1),finish:d(5),currentStart:d(1),currentFinish:d(5),totalFloat:0,critical:true},
      {id:"A2",name:"Late activity",wbsId:"LATE",start:d(2),finish:d(7),currentStart:d(2),currentFinish:d(7),totalFloat:5,critical:false}
    ]
  });
  const html=gantt(s,{layoutKey:"wbs"});
  for(const id of ["ROOT","EARLY","MID","LEAF","LATE","EMPTY"]) assert.match(html,new RegExp(`data-wbs-id="${id}"`),`${id} WBS should render`);
  assert.ok(html.indexOf('data-wbs-id="EARLY"') < html.indexOf('data-wbs-id="LATE"'),"P6 seq_num must override alphabetical code order");
  assert.ok(html.indexOf('data-wbs-id="LATE"') < html.indexOf('data-wbs-id="EMPTY"'),"later seq_num should render later");
  assert.match(html,/Project \/ First by P6 order \/ Intermediate Parent \/ Leaf/,"full parent WBS path should be reconstructed");

  const criticalHtml=gantt(s,{activities:s.activities.filter(a=>a.critical),criticalOnly:true,layoutKey:"critical"});
  for(const id of ["ROOT","EARLY","MID","LEAF"]) assert.match(criticalHtml,new RegExp(`data-wbs-id="${id}"`),`critical path must retain ancestor ${id}`);
  assert.ok(!criticalHtml.includes('data-wbs-id="LATE"'),"unrelated non-critical branch should not be shown in critical-path hierarchy");

  const xer=[
    "%T\tPROJECT","%F\tproj_id\tproj_short_name\tlast_recalc_date","%R\t1\tSeq Test\t2026-09-01 08:00",
    "%T\tPROJWBS","%F\twbs_id\tproj_id\tseq_num\tproj_node_flag\twbs_short_name\twbs_name\tparent_wbs_id",
    "%R\t10\t1\t1000\tY\tPRJ\tProject\t",
    "%R\t12\t1\t3000\tN\tAAA\tSecond\t10",
    "%R\t11\t1\t2000\tN\tZZZ\tFirst\t10",
    "%T\tTASK","%F\ttask_id\ttask_code\ttask_name\twbs_id\tstatus_code\ttask_type\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct",
    "%R\t1\tA1\tActivity\t11\tTK_NotStart\tTT_Task\t2026-09-01\t2026-09-05\t96\t96\t0\t0"
  ].join("\n");
  const parsed=parseXER(xer,"seq.xer").schedules[0];
  assert.equal(parsed.wbs.find(w=>w.id==="10").seqNum,1000);
  assert.equal(parsed.wbs.find(w=>w.id==="11").seqNum,2000);
  assert.equal(parsed.wbs.find(w=>w.id==="12").seqNum,3000);
  assert.equal(parsed.wbs.find(w=>w.id==="10").projectNode,true);
  const parsedHtml=gantt(parsed,{layoutKey:"wbs"});
  assert.ok(parsedHtml.indexOf('data-wbs-id="11"') < parsedHtml.indexOf('data-wbs-id="12"'),"XER WBS must render in seq_num order");
  return {wbsNodes:s.wbs.length,parsedWbs:parsed.wbs.length};
}
