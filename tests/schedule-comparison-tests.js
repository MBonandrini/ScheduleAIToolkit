const fs=require('fs');
const vm=require('vm');
const src=fs.readFileSync('apps/schedule-assessment/app.js','utf8');
function extractFunction(name){
  const start=src.indexOf(`function ${name}(`);
  if(start<0) throw new Error(`Missing function ${name}`);
  const brace=src.indexOf('{',start); let depth=0, quote=null, esc=false, templateDepth=0;
  for(let i=brace;i<src.length;i++){
    const c=src[i];
    if(quote){ if(esc){esc=false;continue} if(c==='\\'){esc=true;continue} if(c===quote){quote=null} continue; }
    if(c==='"'||c==="'"||c==='`'){quote=c;continue}
    if(c==='{')depth++; else if(c==='}'){depth--;if(depth===0)return src.slice(start,i+1)}
  }
  throw new Error(`Unclosed function ${name}`);
}
const names=['compareScheduleNetworks','scheduleLogicSnapshot','scheduleResourceSnapshot','assignmentFingerprint','transitionDetails'];
const context={console};
context.relationshipSignature=r=>`${r.predecessorUid||r.predecessor}->${r.successorUid||r.successor}:${r.type||'FS'}:${Number(r.lag||0)}`;
context.daysBetween=(a,b)=>(new Date(b)-new Date(a))/86400000;
context.latestDate=dates=>{const valid=dates.filter(Boolean).map(d=>new Date(d));return valid.length?new Date(Math.max(...valid.map(d=>d.getTime()))).toISOString():null};
context.weightedProgress=acts=>acts.length?acts.reduce((s,a)=>s+Number(a.percent||0),0)/acts.length:0;
vm.createContext(context);
for(const name of names)vm.runInContext(extractFunction(name),context);
const previous={id:'p',name:'Prev',statusDate:'2026-01-01T00:00:00Z',activities:[
 {id:'A',percent:20,start:'2026-01-01',finish:'2026-01-10',currentFinish:'2026-01-10',duration:5,totalFloat:3,calendar:'C1',constraint:'',secondConstraint:'',predecessors:[],successors:['B'],resources:[{resourceId:'R1',resourceName:'Crew',actualUnits:10,remainingUnits:20,actualCost:100,budgetUnits:30,budgetCost:300,remainingCost:200}]},
 {id:'B',percent:0,start:'2026-01-11',finish:'2026-01-20',currentFinish:'2026-01-20',duration:5,totalFloat:2,calendar:'C1',constraint:'',secondConstraint:'',predecessors:['A'],successors:[],resources:[]}
],relationships:[{predecessor:'A',successor:'B',predecessorUid:'A',successorUid:'B',type:'FS',lag:0}]};
const current={id:'c',name:'Current',statusDate:'2026-01-08T00:00:00Z',activities:[
 {id:'A',percent:50,start:'2026-01-01',finish:'2026-01-12',currentFinish:'2026-01-12',duration:6,totalFloat:1,calendar:'C2',constraint:'MSO',secondConstraint:'',predecessors:[],successors:['B'],resources:[{resourceId:'R1',resourceName:'Crew',actualUnits:15,remainingUnits:15,actualCost:160,budgetUnits:30,budgetCost:300,remainingCost:140}]},
 {id:'B',percent:0,start:'2026-01-13',finish:'2026-01-25',currentFinish:'2026-01-25',duration:6,totalFloat:0,calendar:'C1',constraint:'',secondConstraint:'',predecessors:['A'],successors:[],resources:[]},
 {id:'C',percent:0,start:'2026-01-20',finish:'2026-01-30',currentFinish:'2026-01-30',duration:5,totalFloat:5,calendar:'C1',constraint:'',secondConstraint:'',predecessors:['B'],successors:[],resources:[]}
],relationships:[{predecessor:'A',successor:'B',predecessorUid:'A',successorUid:'B',type:'FS',lag:0},{predecessor:'B',successor:'C',predecessorUid:'B',successorUid:'C',type:'FS',lag:1}]};
const d=context.transitionDetails(previous,current);
const checks=[
 ['data date interval',d.dataDateDelta===7],['progress movement',d.progressChanged===1],['constraint movement',d.constraintsChanged===1],['calendar movement',d.calendarChanged===1],['resource movement',d.resourceChanged===1],['new relationship',d.network.linkAdded.length===1],['new activity',d.network.activityChanges.some(x=>x.id==='C'&&x.status==='New')],['duration change',d.durationChanged===2],['float change',d.floatChanged===2],['resource actual units',d.currentResources.totals.actualUnits===15]
];
for(const [label,ok] of checks){if(!ok){console.error('FAIL',label);process.exitCode=1}else console.log('PASS',label)}
