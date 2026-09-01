const fs=require('fs');
const app=fs.readFileSync('apps/schedule-assessment/app.js','utf8');
const html=fs.readFileSync('apps/schedule-assessment/index.html','utf8');
const shell=fs.readFileSync('assets/js/shell.js','utf8');
const checks=[
 ['compare mini pane',/id="compareSchedulesPane"/.test(html)],
 ['ordered sequence UI',/compareSequenceList/.test(html)&&/moveComparisonSequence/.test(app)],
 ['2+ validation',/Select at least two schedules/.test(app)],
 ['saved comparison persistence',/savedComparisonReports:state\.savedComparisonReports/.test(app)&&/project\.savedComparisonReports/.test(app)],
 ['progress comparison',/progressChanged/.test(app)&&/Progress & dates/.test(app)],
 ['data date comparison',/dataDateDelta/.test(app)],
 ['logic comparison',/linkAdded/.test(app)&&/Open starts/.test(app)&&/Positive lags/.test(app)],
 ['resource comparison',/resourceChanged/.test(app)&&/Resources & cost movement/.test(app)],
 ['S curve and histogram',/drawSCurve\(job\.curveId/.test(app)&&/drawSCurve\(job\.histId/.test(app)],
 ['direct and bulk auto reporting',/buildAllReportsForSchedule\(scheduleId/.test(app)&&/importBulkInformationSchedules/.test(app)],
 ['schedule file remove cross',/className="file-remove"/.test(app)&&/removeScheduleFile/.test(app)],
 ['repository file remove cross',/data-shared-remove/.test(shell)&&/removeSharedFileReference/.test(shell)]
];
for(const [label,ok] of checks){if(!ok){console.error('FAIL',label);process.exitCode=1}else console.log('PASS',label)}
