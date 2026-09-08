
import assert from "node:assert/strict";
import {sampleSchedule} from "./helpers.js";
import {standardWorkingDays,parseCalendarExceptions,calendarYear,projectYears} from "../src/analysis/calendar.js";
import {dataCentreReadiness,readinessGates} from "../src/analysis/datacentre.js";
export async function run(){
  const s=sampleSchedule(),c=s.calendars[0],days=standardWorkingDays(c);assert.equal(days.has(1),true);assert.equal(days.has(0),false);
  const ex=parseCalendarExceptions(c);assert.ok(ex.has("2026-12-25"));
  const year=calendarYear(c,2026);assert.equal(year.months.length,12);assert.ok(year.months[11].days.some(d=>d.date==="2026-12-25"&&d.exception));
  assert.ok(projectYears(s).includes(2026));
  const dc=dataCentreReadiness(s);assert.ok(dc.some(x=>x.stage==="Energisation"&&x.activities>=1));
  const gates=readinessGates(s);assert.ok(gates.some(x=>x.name==="Energisation"&&x.activity));
  return "calendar-datacentre";
}
