
import assert from "node:assert/strict";
import {parseMSProjectXML} from "../src/parsers/mspxml.js";
export async function run(){
  const xml=`<Project><Name>Golden</Name><StatusDate>2026-09-01T00:00:00</StatusDate><Tasks>
  <Task><UID>1</UID><ID>10</ID><Name>A</Name><Start>2026-09-01</Start><Finish>2026-09-03</Finish><PercentComplete>50</PercentComplete></Task>
  <Task><UID>2</UID><ID>20</ID><Name>B</Name><Start>2026-09-04</Start><Finish>2026-09-05</Finish><PercentComplete>0</PercentComplete><PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink></Task>
  </Tasks></Project>`;
  const s=parseMSProjectXML(xml).schedules[0];
  assert.deepEqual(s.activities.map(a=>a.id),["10","20"]);assert.deepEqual(s.relationships.map(r=>[r.predId,r.succId,r.type]),[["10","20","FS"]]);
  return "msp-golden";
}
