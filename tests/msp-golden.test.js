import assert from "node:assert/strict";
import {parseMSProjectXML} from "../src/parsers/mspxml.js";

export async function run(){
  const xml=`<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Name>Golden MSPDI</Name><StatusDate>2026-09-04T00:00:00</StatusDate><HoursPerDay>8</HoursPerDay><HoursPerWeek>40</HoursPerWeek>
    <Calendars><Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays><WeekDay><DayType>2</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay></WeekDays></Calendar></Calendars>
    <Tasks>
      <Task><UID>10</UID><ID>1</ID><Name>Phase A</Name><Summary>1</Summary><OutlineNumber>1</OutlineNumber><OutlineLevel>1</OutlineLevel><WBS>A</WBS></Task>
      <Task><UID>11</UID><ID>2</ID><Name>Install equipment</Name><OutlineNumber>1.1</OutlineNumber><OutlineLevel>2</OutlineLevel><WBS>A.1</WBS><Start>2026-09-01T08:00:00</Start><Finish>2026-09-02T17:00:00</Finish><Duration>PT16H0M0S</Duration><RemainingDuration>PT8H0M0S</RemainingDuration><PercentComplete>50</PercentComplete><Work>PT16H0M0S</Work><ActualWork>PT8H0M0S</ActualWork><RemainingWork>PT8H0M0S</RemainingWork><Cost>1000</Cost><ActualCost>400</ActualCost><RemainingCost>600</RemainingCost><TotalSlack>-4800</TotalSlack><FreeSlack>2400</FreeSlack><Critical>1</Critical><CalendarUID>1</CalendarUID><ConstraintType>4</ConstraintType><ConstraintDate>2026-09-01T08:00:00</ConstraintDate><Baseline><Number>0</Number><Start>2026-08-31T08:00:00</Start><Finish>2026-09-01T17:00:00</Finish></Baseline></Task>
      <Task><UID>12</UID><ID>3</ID><Name>Ready milestone</Name><OutlineNumber>1.2</OutlineNumber><OutlineLevel>2</OutlineLevel><WBS>A.2</WBS><Start>2026-09-03T17:00:00</Start><Finish>2026-09-03T17:00:00</Finish><Duration>PT0H0M0S</Duration><RemainingDuration>PT0H0M0S</RemainingDuration><PercentComplete>0</PercentComplete><Milestone>1</Milestone><CalendarUID>1</CalendarUID><PredecessorLink><PredecessorUID>11</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink></Task>
    </Tasks>
    <Resources><Resource><UID>20</UID><ID>1</ID><Name>Electrician</Name><Type>1</Type><MaxUnits>4</MaxUnits><Group>Electrical</Group><Code>ELEC</Code></Resource></Resources>
    <Assignments><Assignment><UID>100</UID><TaskUID>11</TaskUID><ResourceUID>20</ResourceUID><Units>2</Units><Work>PT16H0M0S</Work><ActualWork>PT8H0M0S</ActualWork><RemainingWork>PT8H0M0S</RemainingWork><Cost>1000</Cost><ActualCost>400</ActualCost><RemainingCost>600</RemainingCost><Start>2026-09-01T08:00:00</Start><Finish>2026-09-02T17:00:00</Finish></Assignment></Assignments>
  </Project>`;
  const result=parseMSProjectXML(xml,"golden.xml"),s=result.schedules[0];
  assert.equal(s.projectName,"Golden MSPDI");
  assert.equal(s.wbs.length,1);assert.equal(s.wbs[0].name,"Phase A");
  assert.deepEqual(s.activities.map(a=>a.id),["2","3"]);
  const install=s.activities.find(a=>a.id==="2"),mile=s.activities.find(a=>a.id==="3");
  assert.equal(install.wbsPath,"Phase A");assert.equal(install.originalDuration,2);assert.equal(install.remainingDuration,1);
  assert.equal(install.totalFloat,-1);assert.equal(install.freeFloat,.5);assert.equal(install.calendarName,"Standard");
  assert.equal(install.constraintType,"Start No Earlier Than");assert.equal(install.baselineStart,"2026-08-31T08:00:00");
  assert.equal(mile.milestone,true);
  assert.deepEqual(s.relationships.map(r=>[r.predId,r.succId,r.type,r.lag]),[["2","3","FS",0]]);
  assert.equal(s.resources.length,1);assert.equal(s.resources[0].name,"Electrician");
  assert.equal(s.assignments.length,1);assert.equal(s.assignments[0].activityId,"11");assert.equal(s.assignments[0].resourceId,"20");
  assert.equal(install.assignments.length,1);assert.equal(install.budgetUnits,16);assert.equal(install.actualUnits,8);assert.equal(install.remainingUnits,8);assert.equal(install.budgetCost,1000);
  assert.equal(result.diagnostics.errors.length,0);
  return "msp-golden";
}
