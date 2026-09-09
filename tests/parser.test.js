
import assert from "node:assert/strict";
import {parseXER,parseXERTables} from "../src/parsers/xer.js";
import {parseMSProjectXML} from "../src/parsers/mspxml.js";
import {syntheticXER} from "./helpers.js";

export async function run(){
  const simple=syntheticXER(100,250),parsed=parseXER(simple,"simple.xer").schedules[0];
  assert.equal(parsed.activities.length,100);
  assert.equal(parsed.relationships.length,250);
  assert.equal(parsed.projectName,"Synthetic");
  assert.equal(parsed.calendars.length,1);
  assert.ok(parsed.activities[0].wbsPath.includes("Root"));
  const lagXer=simple.replace("%R\t1\t2\t1\tPR_FS\t0","%R\t1\t2\t1\tPR_FS\t48");
  const lagSchedule=parseXER(lagXer,"lag-hours-regression.xer").schedules[0];
  assert.equal(lagSchedule.relationships[0].lag,2,"48 P6 lag hours must normalize to 2 days exactly once");

  const malformed=simple+"\n%T\tTASK\n%F\ta\tb\n%R\t1";
  const t=parseXERTables(malformed);assert.ok(t.diagnostics.malformedRows>=1);

  const xml=`<?xml version="1.0"?><Project><Name>MSP Test</Name><StatusDate>2026-08-01T00:00:00</StatusDate><Tasks>
  <Task><UID>1</UID><ID>1</ID><Name>Start</Name><Start>2026-08-01T08:00:00</Start><Finish>2026-08-02T17:00:00</Finish><PercentComplete>100</PercentComplete></Task>
  <Task><UID>2</UID><ID>2</ID><Name>Finish</Name><Start>2026-08-03T08:00:00</Start><Finish>2026-08-03T08:00:00</Finish><PercentComplete>0</PercentComplete><Milestone>1</Milestone><PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink></Task>
  </Tasks></Project>`;
  const msp=parseMSProjectXML(xml,"msp.xml").schedules[0];
  assert.equal(msp.activities.length,2);assert.equal(msp.relationships.length,1);assert.equal(msp.activities[1].milestone,true);
  const xmlLag=xml.replace("<LinkLag>0</LinkLag>","<LinkLag>4800</LinkLag>");
  const mspLag=parseMSProjectXML(xmlLag,"msp-lag.xml").schedules[0];
  assert.equal(mspLag.relationships[0].lag,1,"MS Project normalized lag must not be divided twice");
  return "parser";
}
