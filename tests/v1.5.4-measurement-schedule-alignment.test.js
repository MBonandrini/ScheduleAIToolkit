import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {activityAlignmentIndex,pdfScheduleCandidates,recommendActivityIds,alignMeasurementRows} from "../src/analysis/measurement-alignment.js";
import {alignBoqFile,RECOMMENDED_HEADER} from "../src/measurement/boq-alignment.js";

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.join(here,"..");
export async function run(){
  const app=fs.readFileSync(path.join(root,"src/ui/app.js"),"utf8"),css=fs.readFileSync(path.join(root,"assets/app.css"),"utf8");
  assert.match(app,/Align to schedule/);assert.match(app,/alignmentScheduleFile/);assert.match(app,/ALIGN_SCHEDULE_EXT=\/\\\.\(pdf\|xml\|xer\)/);
  assert.match(app,/Recommended Activity ID\(s\)/);assert.match(app,/Select a PDF, XML or XER schedule before generating/);
  assert.match(css,/measurement-alignment/);

  const idx=activityAlignmentIndex([
    {id:"ELEC-1100",name:"Install LV cable containment",wbsPath:"Construction / Electrical / Level 1"},
    {id:"ELEC-1200",name:"Install LV power cables",wbsPath:"Construction / Electrical / Level 1"},
    {id:"MECH-2100",name:"Install chilled water pipework",wbsPath:"Construction / Mechanical / Plantroom"}
  ]);
  assert.deepEqual(recommendActivityIds({discipline:"Electrical",item:"LV power cable installation Level 1"},idx).slice(0,1),["ELEC-1200"]);
  const rows=alignMeasurementRows([{item:"Chilled water pipe installation plantroom",category:"Pipework"}],idx);
  assert.match(rows[0].recommendedActivityIds,/MECH-2100/);

  const pdf=pdfScheduleCandidates("ELEC-1100 Install LV cable containment Level 1\nMECH-2100 Install chilled water pipework plantroom");
  assert.equal(pdf.length,2);assert.equal(pdf[0].id,"ELEC-1100");

  const csv='Item,Description,Qty\n1,"LV power cable installation Level 1",100\n2,"Chilled water pipework plantroom",25\n';
  const file=new File([csv],"boq.csv",{type:"text/csv"}),out=await alignBoqFile(file,idx),text=await out.blob.text();
  assert.match(text,new RegExp(RECOMMENDED_HEADER.replace(/[()]/g,"\\$&")));assert.match(text,/ELEC-1200/);assert.match(text,/MECH-2100/);assert.equal(out.total,2);assert.equal(out.matched,2);
  return "measurement schedule alignment UI, matching and CSV BOQ output verified";
}
