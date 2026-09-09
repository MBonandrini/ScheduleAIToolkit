import test from 'node:test';
import assert from 'node:assert/strict';
import {
 classifyFile,parseBOQText,extractQuantitiesFromText,parseGuidelines,parseXER,ingestHistoricalXER,
 scheduleActivities,runQA,buildPlan,parseDXF,parseIFCText,demoDocuments,topologicalOrder,extractScopeSystems,extractKeyDates
} from '../js/core.mjs';

const act=(id,d=1,name=id)=>({activityId:id,name,wbs:'W',durationDays:d,area:'General',system:'General'});
const rel=(p,s,t='FS',lag=0)=>({predecessorId:p,successorId:s,relType:t,lagDays:lag});

test('file classification tree paths',()=>{
 assert.equal(classifyFile('a.pdf','Current Information/Current Drawings/a.pdf'),'current_drawings');
 assert.equal(classifyFile('boq.xlsx','Current Information/BOQ/boq.xlsx'),'boq');
 assert.equal(classifyFile('old.xer','Previous Reference Documents/Schedules from Other Projects/old.xer'),'historical_schedules');
 assert.equal(classifyFile('norms.pdf','Previous Reference Documents/Estimating Norms and Books/norms.pdf'),'estimating_norms');
});

test('BOQ parse',()=>{const q=parseBOQText('Description,Quantity,Unit,Area,Norm\nLV cable,1000,m,DH01,0.2','Electrical');assert.equal(q.length,1);assert.equal(q[0].system,'Cabling');assert.equal(q[0].norm,.2);});
test('drawing text quantity extraction',()=>{const q=extractQuantitiesFromText('185 m cable ladder\n12 ea UPS panels','Electrical');assert.equal(q.length,2);assert.equal(q[0].system,'Containment');});
test('guidelines parse',()=>{const g=parseGuidelines('Maximum activity duration 20 days. Maximum lag 5 days. Negative lag is not permitted. Open ends are not permitted.');assert.equal(g.maxActivityDurationDays,20);assert.equal(g.maxLagDays,5);assert.equal(g.negativeLagAllowed,false);assert.equal(g.openEndsAllowed,false);});
test('scope systems',()=>{const s=extractScopeSystems('Install cable ladder, LV cables, UPS, chilled water piping and pumps.');assert(s.includes('Containment'));assert(s.includes('Cabling'));assert(s.includes('Electrical Equipment'));assert(s.includes('Piping'));assert(s.includes('Mechanical Equipment'));});
test('date extraction',()=>{const d=extractKeyDates('Required turnover 30 September 2026. Energisation 2026-08-15.');assert(d.length>=2);assert(d.some(x=>x.date==='2026-09-30'));});

test('XER parse + history',()=>{const x=`%T\tTASK\n%F\ttask_id\ttask_name\ttarget_drtn_hr_cnt\n%R\t1\tPull Cables\t100\n%R\t2\tTerminate Cables\t50\n%T\tTASKPRED\n%F\tpred_task_id\ttask_id\tpred_type\n%R\t1\t2\tPR_FS\n`;const t=parseXER(x);assert.equal(t.TASK.length,2);const h=ingestHistoricalXER(x,10);assert.equal(h.taskCount,2);assert.equal(h.relationshipCount,1);assert.equal(h.durations['cable installation'][0],10);});

test('CPM simple FS chain',()=>{const a=[act('A',2),act('B',3),act('C',1)],r=[rel('A','B'),rel('B','C')];const s=scheduleActivities(a,r,'2026-09-07');assert.equal(s.projectDuration,6);assert(a.every(x=>x.critical));assert.equal(a[2].finish,'2026-09-14');});
test('CPM parallel float',()=>{const a=[act('A',1),act('B',5),act('C',2),act('D',1)],r=[rel('A','B'),rel('A','C'),rel('B','D'),rel('C','D')];scheduleActivities(a,r,'2026-09-07');assert.equal(a.find(x=>x.activityId==='C').totalFloatDays,3);});
test('CPM SS',()=>{const a=[act('A',5),act('B',2)],r=[rel('A','B','SS',2)];scheduleActivities(a,r,'2026-09-07');assert.equal(a[1].start,'2026-09-09');});
test('CPM FF',()=>{const a=[act('A',5),act('B',2)],r=[rel('A','B','FF',0)];scheduleActivities(a,r,'2026-09-07');assert.equal(a[1].finish,a[0].finish);});
test('CPM cycle fails safely',()=>{const a=[act('A'),act('B')],r=[rel('A','B'),rel('B','A')];assert.equal(scheduleActivities(a,r,'2026-09-07').projectDuration,null);assert.equal(topologicalOrder(['A','B'],r),null);});

test('QA detects bad endpoint',()=>{const q=runQA([act('A')],[rel('A','Z')]);assert(q.some(x=>x.code==='QA002'));});
test('QA detects cycle',()=>{const q=runQA([act('A'),act('B')],[rel('A','B'),rel('B','A')]);assert(q.some(x=>x.code==='QA003'));});
test('QA detects negative lag',()=>{const q=runQA([act('A'),act('B')],[rel('A','B','FS',-2)]);assert(q.some(x=>x.code==='QA008'));});
test('QA detects excessive duration',()=>{const q=runQA([act('A',61)],[],[],{maxActivityDurationDays:30});assert(q.some(x=>x.code==='QA007'));});
test('QA semantic energisation',()=>{const q=runQA([act('A',0,'Energise Equipment')],[]);assert(q.some(x=>x.code==='QA020'));});

test('DXF line/block parsing',()=>{const d=`0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nCABLE\n10\n0\n20\n0\n11\n3\n21\n4\n0\nINSERT\n8\nEQUIP\n2\nUPS\n0\nENDSEC\n0\nEOF`;const x=parseDXF(d);assert.equal(x.lengthsByLayer.CABLE,5);assert.equal(x.blockCounts.UPS,1);});
test('IFC text entity parsing',()=>{const x=parseIFCText("#1=IFCWALL('x');#2=IFCWALL('y');#3=IFCPUMP('p');");assert.equal(x.entityTypes.IFCWALL,2);assert.equal(x.total,3);});

test('build demo project',()=>{const p=buildPlan({projectName:'Demo',projectStart:'2026-09-07',discipline:'Electrical',documents:demoDocuments()});assert(p.activities.length>20);assert(p.relationships.length>=p.activities.length-1);assert.equal(p.qaIssues.filter(x=>x.severity==='error').length,0);assert(p.quantities.length>=4);assert(p.confidence.overall>50);});

for(const mask of Array.from({length:16},(_,i)=>i)) test(`missing information matrix ${mask.toString(2).padStart(4,'0')}`,()=>{
 const docs=[];if(mask&1)docs.push({branch:'boq',name:'boq.csv',text:'Description,Quantity,Unit,Area\nLV cable,1000,m,DH01'});if(mask&2)docs.push({branch:'scope',name:'scope.txt',text:'Electrical scope in Data Hall 01 including cabling and containment.'});if(mask&4)docs.push({branch:'current_drawings',name:'E101.pdf',text:'Data Hall 01 500 m cable ladder'});if(mask&8)docs.push({branch:'historical_schedules',name:'old.xer',text:'%T\tTASK\n%F\ttask_id\ttask_name\ttarget_drtn_hr_cnt\n%R\t1\tPull Cables\t100'});
 const p=buildPlan({projectStart:'2026-09-07',discipline:'Electrical',documents:docs});assert(p.activities.length>0);assert.equal(p.qaIssues.filter(x=>x.severity==='error').length,0);assert(p.activities.every(a=>a.durationDays>=0));assert(p.activities.every(a=>a.start&&a.finish));
});

// Random DAG logic tests
let seed=24681357;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
for(let caseNo=0;caseNo<40;caseNo++) test(`random DAG CPM ${caseNo+1}`,()=>{
 const n=5+Math.floor(rnd()*16),a=Array.from({length:n},(_,i)=>act(`A${i}`,Math.floor(rnd()*8))),r=[];
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(rnd()<.13)r.push(rel(`A${i}`,`A${j}`,['FS','SS','FF'][Math.floor(rnd()*3)],Math.floor(rnd()*3)));
 const s=scheduleActivities(a,r,'2026-09-07');assert.notEqual(s.projectDuration,null);assert(a.every(x=>x.durationDays>=0));assert(a.every(x=>x.start<=x.finish));assert.equal(runQA(a,r).filter(x=>x.severity==='error').length,0);
});

test('CPM SF relationship is calculated without failure',()=>{const a=[act('A',3),act('B',2)],r=[rel('A','B','SF',1)];const s=scheduleActivities(a,r,'2026-09-07');assert.notEqual(s.projectDuration,null);assert(a.every(x=>x.start&&x.finish));});
test('QA flags multiple open starts/finishes',()=>{const q=runQA([act('A',2),act('B',2)],[]);assert(q.some(x=>x.code==='QA004'));assert(q.some(x=>x.code==='QA005'));});
test('valid piping sequence satisfies constructability pressure-test check',()=>{const a=[act('A',2,'Install Piping'),act('B',1,'Pressure Test Piping')],r=[rel('A','B')];const q=runQA(a,r);assert(!q.some(x=>x.code==='QA020'&&x.activityIds.includes('B')));});
test('valid concrete sequence satisfies place-concrete check',()=>{const a=[act('A',2,'Install Reinforcement'),act('B',1,'Pre-Pour Inspection'),act('C',1,'Place Concrete')],r=[rel('A','B'),rel('B','C')];const q=runQA(a,r);assert(!q.some(x=>x.code==='QA020'&&x.activityIds.includes('C')));});
test('target finish slippage is exposed as a warning',()=>{const p=buildPlan({projectStart:'2026-09-07',targetFinish:'2026-09-08',discipline:'Electrical',systems:['Electrical Equipment'],documents:[]});assert(p.warnings.some(x=>x.includes('later than target')));});
test('reference estimating norm drives calculated man-hours',()=>{const docs=[{branch:'boq',name:'boq.csv',text:'Description,Quantity,Unit,Area\nLV cable,1000,m,General'},{branch:'estimating_norms',name:'norms.txt',text:'cable installation: 0.10 MH/m'}];const p=buildPlan({projectStart:'2026-09-07',discipline:'Electrical',systems:['Cabling'],documents:docs});const pull=p.activities.find(a=>a.name==='Pull Cables');assert.equal(pull.norm,.10);assert.equal(pull.manhours,100);});
test('historical XER duration is used when quantity basis is unavailable',()=>{const xer='%T\tTASK\n%F\ttask_id\ttask_name\ttarget_drtn_hr_cnt\n%R\t1\tPull Cables\t100\n';const p=buildPlan({projectStart:'2026-09-07',discipline:'Electrical',systems:['Cabling'],documents:[{branch:'historical_schedules',name:'old.xer',text:xer}]});const pull=p.activities.find(a=>a.name==='Pull Cables');assert.equal(pull.durationDays,10);});
test('generated electrical equipment procurement chain drives installation',()=>{const p=buildPlan({projectStart:'2026-09-07',discipline:'Electrical',systems:['Electrical Equipment'],documents:[]});assert(!p.qaIssues.some(x=>x.code==='QA021'));const need=p.activities.find(a=>a.name==='Equipment Required On Site'),inst=p.activities.find(a=>a.name==='Install Electrical Equipment');assert(p.relationships.some(r=>r.predecessorId===need.activityId&&r.successorId===inst.activityId));});

for(const system of ['Containment','Cabling','Electrical Equipment','Lighting & Small Power','Earthing','Piping','Mechanical Equipment','Concrete']) test(`system template builds acyclic logic: ${system}`,()=>{const discipline=['Piping','Mechanical Equipment'].includes(system)?'Mechanical':system==='Concrete'?'CSA':'Electrical';const p=buildPlan({projectStart:'2026-09-07',discipline,systems:[system],documents:[]});assert.equal(p.qaIssues.filter(x=>x.severity==='error').length,0);assert(p.activities.some(a=>a.system===system));assert.notEqual(topologicalOrder(p.activities.map(a=>a.activityId),p.relationships),null);});

let seed2=97531;const rnd2=()=>((seed2=(seed2*1103515245+12345)>>>0)/2**32);
for(let caseNo=0;caseNo<20;caseNo++) test(`random mixed-relation DAG ${caseNo+1}`,()=>{const n=8+Math.floor(rnd2()*12),a=Array.from({length:n},(_,i)=>act(`M${i}`,Math.floor(rnd2()*7))),r=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(rnd2()<.11)r.push(rel(`M${i}`,`M${j}`,['FS','SS','FF','SF'][Math.floor(rnd2()*4)],Math.floor(rnd2()*4)));const s=scheduleActivities(a,r,'2026-09-07');assert.notEqual(s.projectDuration,null);assert.equal(runQA(a,r).filter(x=>x.severity==='error').length,0);assert(a.every(x=>x.totalFloatDays!==null));});
