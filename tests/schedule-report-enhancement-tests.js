const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'apps/schedule-assessment/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'apps/schedule-assessment/style.css'),'utf8');
const checks=[
 ['Gantt forced light in application theme',css.includes('.gantt-light-panel')&&css.includes('background:#FFFFFF !important')],
 ['Critical path contains red-bar Gantt',app.includes('title:"Critical path Gantt"')&&app.includes('forceRed:true')&&css.includes('.critical-gantt .gantt-current-bar')],
 ['Calendar analyser renders each used calendar by year',app.includes('calendarYearHtml')&&app.includes('calendarMonthHtml')&&app.includes('calendar-year-grid')],
 ['Calendar non-work days colour coded',app.includes('calendar-day nonwork')&&css.includes('.calendar-day.nonwork')],
 ['Narrative has comparative programme selector',app.includes('narrativeComparisonSelect')&&app.includes('setNarrativeComparison')],
 ['Narrative uses data date and four-week lookahead',app.includes('narrativeLookahead(s,4)')&&app.includes('Next Four Weeks')],
 ['Narrative contains management graphics',app.includes('narrative-progress-graphic')&&app.includes('narrative-outlook-chart')],
 ['S-curve uses weekly periods',app.includes('startOfWeek(date)')&&app.includes('Monday–Sunday axis')],
 ['S-curve exposes copyable weekly quantities/hours/percentages',app.includes('Planned hours')&&app.includes('Actual cumulative %')&&app.includes('copyable-data-table')],
 ['WBS Gantt supports timescale',app.includes('pcGanttTimescale')&&['weekly','monthly','quarterly','annual'].every(v=>app.includes(`"${v}"`))],
 ['WBS Gantt supports bar compression',app.includes('pcGanttCompression')&&app.includes('Compact / print')&&app.includes('Expanded')],
 ['Gantt compression controls row height and timeline width',app.includes('--gantt-row-h')&&app.includes('--gantt-time-min')]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
if(failed)process.exit(1);
