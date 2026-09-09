/* Planning Engine GitHub Edition - deterministic browser core. No server required. */

export const VERSION = 'GitHub-1.0.0';

export const TREE = [
  {id:'current_information', label:'Current Information', children:[
    ['current_drawings','Current Drawings'],['boq','BOQ'],['scope','Scope Document'],
    ['client_schedules','Client Reference Schedules'],['contracts','Contract Documents'],
    ['specifications','Specifications'],['equipment','Equipment Schedules'],
    ['procurement','Procurement Information'],['key_dates','Key Dates'],['other','Other']
  ]},
  {id:'previous_reference_documents', label:'Previous Reference Documents', children:[
    ['historical_schedules','Schedules from Other Projects'],
    ['schedule_guidelines','Schedule Guidelines and Specifications'],
    ['estimating_norms','Estimating Norms and Books'],
    ['methodology','Construction Methodology'],['lessons','Lessons Learned']
  ]}
].map(n=>({...n,children:n.children.map(([id,label])=>({id,label}))}));

export const SYSTEM_TEMPLATES = {
  'Containment': [
    ['Area Release','milestone',null],['Install Primary Containment','work','install containment'],
    ['Install Secondary Containment','work','install containment'],['Containment Complete','milestone',null]
  ],
  'Cabling': [
    ['Cable Route Available','milestone',null],['Pull Cables','work','cable installation'],
    ['Dress Cables','work','cable installation'],['Terminate Cables - Source','work','cable termination'],
    ['Terminate Cables - Load','work','cable termination'],['IR / Continuity Testing','work','electrical testing'],
    ['Cabling Complete','milestone',null]
  ],
  'Electrical Equipment': [
    ['Equipment Technical Submittal Approved','milestone',null],
    ['Place Equipment Purchase Order / Release','procurement','procurement release'],
    ['Manufacture / Vendor Lead Time','procurement','manufacture lead time'],
    ['FAT / Release to Ship','procurement','fat'],['Ship / Deliver Equipment','procurement','shipping'],
    ['Equipment Required On Site','milestone',null],['Install Electrical Equipment','work','equipment installation'],
    ['Connect Electrical Equipment','work','equipment connection'],['Pre-Energisation Inspection','work','electrical testing'],
    ['Ready For Energisation','milestone',null],['Energise Equipment','milestone',null],
    ['Functional Testing','work','electrical testing'],['Equipment Commissioned','milestone',null]
  ],
  'Lighting & Small Power': [
    ['Area Available','milestone',null],['Install Lighting & Small Power','work','lighting installation'],
    ['Test Lighting & Small Power','work','electrical testing'],['Lighting & Small Power Complete','milestone',null]
  ],
  'Earthing': [
    ['Area Available','milestone',null],['Install Earthing','work','earthing installation'],
    ['Test Earthing','work','electrical testing'],['Earthing Complete','milestone',null]
  ],
  'Piping': [
    ['Area Release','milestone',null],['Install Pipe Supports','work','piping supports'],
    ['Install Piping','work','piping installation'],['Pressure Test Piping','work','piping testing'],
    ['Flush / Clean Piping','work','piping testing'],['Insulate Piping','work','piping insulation'],
    ['Piping Complete','milestone',null]
  ],
  'Mechanical Equipment': [
    ['Equipment Technical Submittal Approved','milestone',null],
    ['Place Equipment Purchase Order / Release','procurement','procurement release'],
    ['Manufacture / Vendor Lead Time','procurement','manufacture lead time'],
    ['FAT / Release to Ship','procurement','fat'],['Ship / Deliver Equipment','procurement','shipping'],
    ['Equipment Required On Site','milestone',null],['Install Mechanical Equipment','work','equipment installation'],
    ['Align / Level Equipment','work','equipment installation'],['Connect Mechanical Equipment','work','equipment connection'],
    ['Pre-Commission Equipment','work','commissioning'],['Commission Mechanical Equipment','work','commissioning'],
    ['Equipment Turnover','milestone',null]
  ],
  'Concrete': [
    ['Area Release','milestone',null],['Excavate / Prepare Formation','work','earthworks'],
    ['Install Formwork','work','formwork'],['Install Reinforcement','work','rebar'],
    ['Pre-Pour Inspection','work','inspection'],['Place Concrete','work','concrete'],
    ['Cure Concrete','work','concrete cure'],['Strip Formwork','work','formwork'],['Concrete Complete','milestone',null]
  ],
  'General': [
    ['Area Release','milestone',null],['Execute Scope','work','general'],['Inspect / Test','work','testing'],['Scope Complete','milestone',null]
  ]
};

export const DEFAULT_NORMS = {
  'install containment':0.55,'cable installation':0.22,'cable termination':0.18,'electrical testing':0.08,
  'equipment installation':8.0,'equipment connection':4.0,'lighting installation':0.8,'earthing installation':0.4,
  'piping supports':0.7,'piping installation':1.1,'piping testing':0.25,'piping insulation':0.45,
  'commissioning':4.0,'earthworks':0.8,'formwork':1.2,'rebar':8.0,'inspection':0.1,'concrete':0.5,
  'concrete cure':0.0,'general':1.0,'testing':0.15
};

export const DURATION_DEFAULTS = {'procurement release':2,'manufacture lead time':60,'fat':2,'shipping':10,'concrete cure':5,'commissioning':3,'testing':2,'inspection':1,'general':5};

const AREA_PATTERNS = [
  /\b(data\s*hall\s*[-_ ]?\d+)\b/ig,/\b(electrical\s*room\s*[-_ ]?[a-z0-9]+)\b/ig,
  /\b(plant\s*room\s*[-_ ]?[a-z0-9]+)\b/ig,/\b(level\s*[-_ ]?\d+)\b/ig,
  /\b(zone\s*[-_ ]?[a-z0-9]+)\b/ig,/\b(area\s*[-_ ]?[a-z0-9]+)\b/ig,
  /\b(room\s*[-_ ]?[a-z0-9]+)\b/ig
];

export function median(values){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length) return null;
  const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function normText(s=''){return String(s).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();}
export function slug(s=''){return normText(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}

export function classifyFile(fileName='', relativePath=''){
  const n=(relativePath||fileName).replace(/\\/g,'/').toLowerCase();
  const ext=(fileName.match(/\.[^.]+$/)||[''])[0].toLowerCase();
  const folderRules=[
    ['current drawings','current_drawings'],['/boq','boq'],['scope document','scope'],['client reference schedules','client_schedules'],
    ['contract documents','contracts'],['/specifications','specifications'],['equipment schedules','equipment'],
    ['procurement information','procurement'],['key dates','key_dates'],['schedules from other projects','historical_schedules'],
    ['schedule guidelines','schedule_guidelines'],['estimating norms','estimating_norms'],['construction methodology','methodology'],['lessons learned','lessons']
  ];
  for(const [needle,id] of folderRules) if(n.includes(needle)) return id;
  if(/\bboq\b|bill.of.quant|quantit/i.test(n)) return 'boq';
  if(/scope|sow|statement.of.work/i.test(n)) return 'scope';
  if(/contract|subcontract|agreement/i.test(n)) return 'contracts';
  if(/guideline|scheduling.spec|schedule.spec|planning.spec/i.test(n)) return 'schedule_guidelines';
  if(/norm|productivity|estimating|labou?r.rate|man.?hour/i.test(n)) return 'estimating_norms';
  if(['.xer','.mpp','.mpx'].includes(ext)) return n.includes('current')?'client_schedules':'historical_schedules';
  if(['.dxf','.dwg','.ifc'].includes(ext)||/drawing|layout|single.line|schematic|plan\b/i.test(n)) return 'current_drawings';
  if(ext==='.pdf' && /e[-_ ]?\d|m[-_ ]?\d|drawing/i.test(n)) return 'current_drawings';
  return 'other';
}

export function detectAreas(text=''){
  const out=new Set();
  for(const re0 of AREA_PATTERNS){ const re=new RegExp(re0.source,re0.flags); let m; while((m=re.exec(text))) out.add(titleCase(m[1])); }
  return [...out].slice(0,100);
}
export function titleCase(s=''){return s.replace(/\b\w/g,c=>c.toUpperCase()).replace(/\s+/g,' ').trim();}

export function classifyDescription(desc='', defaultDiscipline='General'){
  const s=normText(desc); let discipline=defaultDiscipline||'General',system='General';
  if(/tray|ladder|basket|containment/.test(s)){discipline='Electrical';system='Containment';}
  else if(/cable|wire|conductor/.test(s)){discipline='Electrical';system='Cabling';}
  else if(/switchgear|transformer|\bups\b|panel|mcc|distribution board|\bdb\b/.test(s)){discipline='Electrical';system='Electrical Equipment';}
  else if(/light|socket|small power/.test(s)){discipline='Electrical';system='Lighting & Small Power';}
  else if(/earth|ground|bond/.test(s)){discipline='Electrical';system='Earthing';}
  else if(/pipe|piping|valve|duct/.test(s)){discipline='Mechanical';system='Piping';}
  else if(/pump|ahu|chiller|fan|mechanical equipment/.test(s)){discipline='Mechanical';system='Mechanical Equipment';}
  else if(/concrete|rebar|reinforcement|formwork|excavat/.test(s)){discipline='CSA';system='Concrete';}
  const areas=detectAreas(desc); return {discipline,system,area:areas[0]||'General'};
}

function parseDelimitedLine(line, delim){
  const out=[]; let cur='',q=false;
  for(let i=0;i<line.length;i++){ const c=line[i]; if(c==='"'){ if(q&&line[i+1]==='"'){cur+='"';i++;} else q=!q; }
    else if(c===delim&&!q){out.push(cur.trim());cur='';} else cur+=c; }
  out.push(cur.trim()); return out;
}

export function parseTableText(text=''){
  const lines=String(text).split(/\r?\n/).filter(x=>x.trim()); if(!lines.length) return [];
  const candidates=[',','\t',';','|'];
  let delim=candidates.map(d=>[d,(lines[0].match(new RegExp('\\'+d,'g'))||[]).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=lines.map(l=>parseDelimitedLine(l,delim));
  const headers=rows[0].map(h=>normText(h));
  return rows.slice(1).filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}

function pick(obj,names){for(const k of Object.keys(obj)){if(names.some(n=>k===n||k.includes(n))) return obj[k];} return '';}
export function parseBOQText(text='', defaultDiscipline='General', source='BOQ'){
  const rows=parseTableText(text); const out=[];
  for(const r of rows){
    const desc=pick(r,['description','item description','activity','scope','item']);
    const qtyRaw=pick(r,['quantity','qty','measure']); const unit=pick(r,['unit','uom'])||'unit';
    const q=parseFloat(String(qtyRaw).replace(/,/g,'')); if(!desc||!Number.isFinite(q)) continue;
    const c=classifyDescription(desc,defaultDiscipline);
    const area=pick(r,['area','location','room'])||c.area; const sys=pick(r,['system','service'])||c.system;
    const normRaw=pick(r,['norm','mh/unit','manhour','man hour']); const norm=parseFloat(String(normRaw).replace(/,/g,''));
    out.push({description:desc,quantity:q,unit,area:area||'General',system:sys||'General',discipline:c.discipline,norm:Number.isFinite(norm)?norm:null,normUnit:'MH/unit',evidence:[{sourceType:'BOQ',source,detail:'Parsed BOQ row',grade:'A',confidence:.95}]});
  }
  return out;
}

export function extractQuantitiesFromText(text='', defaultDiscipline='General', source='Drawing'){
  const out=[]; const re=/(\d+(?:[.,]\d+)?)\s*(m3|m2|m³|m²|m|ea|no|nr|kg|t)\s+([A-Za-z][A-Za-z0-9 /&()_\-]{3,80})/gi; let m;
  while((m=re.exec(text))){ const desc=m[3].trim();const c=classifyDescription(desc,defaultDiscipline);
    out.push({description:desc,quantity:parseFloat(m[1].replace(',','.')),unit:{no:'ea',nr:'ea'}[m[2].toLowerCase()]||m[2],area:c.area,system:c.system,discipline:c.discipline,norm:null,normUnit:'MH/unit',evidence:[{sourceType:'Drawing',source,detail:'Text-extracted quantity',grade:'C',confidence:.65}]}); }
  return out;
}

export function parseNormText(text='', source='Reference'){
  const out=[]; const patterns=[
    /([A-Za-z][A-Za-z0-9 /&()_\-]{3,60})\s*[:=\-]\s*(\d+(?:\.\d+)?)\s*(?:mh|man\s*hours?)\s*\/\s*([A-Za-z0-9³²]+)/gi,
    /(\d+(?:\.\d+)?)\s*(?:mh|man\s*hours?)\s*\/\s*([A-Za-z0-9³²]+)\s+(?:for\s+)?([A-Za-z][A-Za-z0-9 /&()_\-]{3,60})/gi
  ];
  let m; while((m=patterns[0].exec(text))) out.push({key:normText(m[1]),norm:+m[2],unit:m[3],source});
  while((m=patterns[1].exec(text))) out.push({key:normText(m[3]),norm:+m[1],unit:m[2],source});
  return out;
}

export function parseGuidelines(text=''){
  const t=normText(text); const out={}; let m;
  if((m=t.match(/(?:maximum|max)\s+activity\s+duration[^\d]{0,20}(\d+)\s*(?:working\s*)?days?/))) out.maxActivityDurationDays=+m[1];
  if((m=t.match(/(?:maximum|max)\s+lag[^\d]{0,20}(\d+)\s*(?:working\s*)?days?/))) out.maxLagDays=+m[1];
  if(/negative\s+lag[^.]{0,30}(not\s+permitted|prohibited|shall\s+not)/.test(t)) out.negativeLagAllowed=false;
  if(/open\s+ends?[^.]{0,30}(not\s+permitted|prohibited|shall\s+not)/.test(t)) out.openEndsAllowed=false;
  return out;
}

export function parseXER(text=''){
  const lines=String(text).split(/\r?\n/); let table='',fields=[]; const tables={};
  for(const line of lines){ if(line.startsWith('%T\t')){table=line.slice(3).trim();tables[table]??=[];fields=[];}
    else if(line.startsWith('%F\t')) fields=line.slice(3).split('\t');
    else if(line.startsWith('%R\t')&&table&&fields.length){const vals=line.slice(3).split('\t'); const row={};fields.forEach((f,i)=>row[f]=vals[i]??'');tables[table].push(row);}
  }
  return tables;
}

export function categorizeActivity(name=''){
  const s=normText(name);
  const pairs=[['containment','containment'],['pull cable','cable installation'],['dress cable','cable installation'],['terminate','cable termination'],
    ['ir / continuity','electrical testing'],['functional test','electrical testing'],['install piping','piping installation'],['pipe support','piping supports'],
    ['pressure test','piping testing'],['insulat','piping insulation'],['equipment','equipment'],['commission','commissioning'],['concrete','concrete'],['formwork','formwork'],['reinforcement','rebar']];
  for(const [k,v] of pairs) if(s.includes(k)) return v; return s.replace(/\b\d+\b/g,'').trim().slice(0,50)||'general';
}

export function ingestHistoricalXER(text='', hoursPerDay=10){
  const t=parseXER(text), durations={},pairs=[]; const task=t.TASK||[];
  const byId=new Map(task.map(r=>[r.task_id,r]));
  for(const r of task){const h=parseFloat(r.target_drtn_hr_cnt||r.remain_drtn_hr_cnt||'');if(!Number.isFinite(h))continue;const c=categorizeActivity(r.task_name||'');(durations[c]??=[]).push(h/hoursPerDay);}
  for(const r of (t.TASKPRED||[])){const p=byId.get(r.pred_task_id),s=byId.get(r.task_id);if(p&&s)pairs.push([categorizeActivity(p.task_name),categorizeActivity(s.task_name),r.pred_type||'PR_FS']);}
  return {durations,pairs,taskCount:task.length,relationshipCount:(t.TASKPRED||[]).length};
}

export function extractScopeSystems(text=''){
  const s=normText(text); const out=new Set();
  const rules=[['Containment',/containment|cable tray|cable ladder|basket/],['Cabling',/cabling|cable installation|power cable|lv cable|mv cable/],
    ['Electrical Equipment',/switchgear|transformer|\bups\b|mcc|distribution board|panel/],['Lighting & Small Power',/lighting|small power|socket/],
    ['Earthing',/earthing|grounding|bonding/],['Piping',/piping|pipework|chilled water|heating water|gas pipe/],
    ['Mechanical Equipment',/pump|ahu|chiller|mechanical equipment|fan coil/],['Concrete',/concrete|reinforcement|rebar|formwork/]];
  for(const [name,re] of rules) if(re.test(s)) out.add(name); return [...out];
}

export function extractKeyDates(text=''){
  const out=[]; const re=/([^\n.]{3,80}?)\b(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[\/]\d{1,2}[\/]20\d{2}|\d{1,2}\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+20\d{2})\b/gi;
  let m; while((m=re.exec(text))){const d=normalizeDate(m[2]);if(d)out.push({label:m[1].trim().replace(/^[-:;, ]+|[-:;, ]+$/g,''),date:d});}
  return out.slice(0,100);
}
export function normalizeDate(s){
  const x=String(s).trim(); let d;
  if(/^20\d{2}[-/]\d{1,2}[-/]\d{1,2}$/.test(x)){const [y,m,day]=x.split(/[-/]/).map(Number);d=new Date(Date.UTC(y,m-1,day));}
  else if(/^\d{1,2}\/\d{1,2}\/20\d{2}$/.test(x)){const [day,m,y]=x.split('/').map(Number);d=new Date(Date.UTC(y,m-1,day));}
  else d=new Date(x+' UTC'); if(Number.isNaN(d.getTime()))return null;return d.toISOString().slice(0,10);
}

export function parseDXF(text='', source='DXF'){
  const lines=String(text).split(/\r?\n/).map(x=>x.trimEnd()); const entities=[]; let section='',entity=null;
  for(let i=0;i<lines.length-1;i+=2){const code=lines[i].trim(),value=lines[i+1]?.trim()??'';
    if(code==='2'&&value==='ENTITIES') section='ENTITIES';
    if(section!=='ENTITIES') continue;
    if(code==='0'){if(entity)entities.push(entity); if(value==='ENDSEC'){section='';entity=null;continue;} entity={type:value,layer:'0'};continue;}
    if(!entity)continue; if(code==='8')entity.layer=value; else if(code==='10')entity.x1=+value;else if(code==='20')entity.y1=+value;else if(code==='11')entity.x2=+value;else if(code==='21')entity.y2=+value;else if(code==='2')entity.name=value;
  }
  if(entity)entities.push(entity);
  const byLayer={},blocks={}; for(const e of entities){ if(e.type==='LINE'&&[e.x1,e.y1,e.x2,e.y2].every(Number.isFinite)){const len=Math.hypot(e.x2-e.x1,e.y2-e.y1);byLayer[e.layer]=(byLayer[e.layer]||0)+len;}
    if(e.type==='INSERT'){const k=e.name||'Unknown Block';blocks[k]=(blocks[k]||0)+1;} }
  return {source,entities:entities.length,lengthsByLayer:byLayer,blockCounts:blocks};
}

export function parseIFCText(text='', source='IFC'){
  const types={}; const re=/#\d+\s*=\s*(IFC[A-Z0-9_]+)\s*\(/g; let m; while((m=re.exec(String(text).toUpperCase())))types[m[1]]=(types[m[1]]||0)+1;
  return {source,entityTypes:types,total:Object.values(types).reduce((a,b)=>a+b,0)};
}

function workdayAdd(dateStr,days){let d=new Date(dateStr+'T00:00:00Z');if(!Number.isFinite(d.getTime()))d=new Date();if(days<=0)return d.toISOString().slice(0,10);let n=0;while(n<days){d.setUTCDate(d.getUTCDate()+1);const w=d.getUTCDay();if(w!==0&&w!==6)n++;}return d.toISOString().slice(0,10);}
function workdaysBetween(a,b){let d=new Date(a+'T00:00:00Z'),end=new Date(b+'T00:00:00Z'),n=0;if(!Number.isFinite(d.getTime())||!Number.isFinite(end.getTime())||end<=d)return 0;while(d<end){d.setUTCDate(d.getUTCDate()+1);const w=d.getUTCDay();if(w!==0&&w!==6)n++;}return n;}

export function topologicalOrder(ids,rels){
  const indeg=Object.fromEntries(ids.map(x=>[x,0]));const adj=Object.fromEntries(ids.map(x=>[x,[]]));
  for(const r of rels){if(indeg[r.predecessorId]!==undefined&&indeg[r.successorId]!==undefined){indeg[r.successorId]++;adj[r.predecessorId].push(r.successorId);}}
  const q=ids.filter(x=>indeg[x]===0),order=[]; while(q.length){const n=q.shift();order.push(n);for(const s of adj[n]){if(--indeg[s]===0)q.push(s);}}
  return order.length===ids.length?order:null;
}

export function scheduleActivities(activities,relationships,projectStart){
  const amap=new Map(activities.map(a=>[a.activityId,a])); const ids=[...amap.keys()]; const order=topologicalOrder(ids,relationships);
  if(!order)return {activities,warnings:['Cannot calculate CPM: relationship network contains a cycle.'],projectDuration:null};
  const preds=Object.fromEntries(ids.map(x=>[x,[]])),succ=Object.fromEntries(ids.map(x=>[x,[]]));
  for(const r of relationships){if(amap.has(r.predecessorId)&&amap.has(r.successorId)){preds[r.successorId].push(r);succ[r.predecessorId].push(r);}}
  const ES={},EF={}; for(const id of order){const a=amap.get(id);let es=0;for(const r of preds[id]){const p=amap.get(r.predecessorId),lag=+r.lagDays||0,t=(r.relType||'FS').toUpperCase();let c;
      if(t==='SS')c=ES[p.activityId]+lag;else if(t==='FF')c=EF[p.activityId]+lag-a.durationDays;else if(t==='SF')c=ES[p.activityId]+lag-a.durationDays;else c=EF[p.activityId]+lag;es=Math.max(es,c);}ES[id]=Math.max(0,es);EF[id]=ES[id]+Math.max(0,+a.durationDays||0);}
  const projectDuration=Math.max(0,...Object.values(EF)); const LF={},LS={};
  for(const id of [...order].reverse()){const a=amap.get(id);if(!succ[id].length)LF[id]=projectDuration;else{const vals=succ[id].map(r=>{const s=amap.get(r.successorId),lag=+r.lagDays||0,t=(r.relType||'FS').toUpperCase();if(t==='SS')return LS[s.activityId]-lag+a.durationDays;if(t==='FF')return LF[s.activityId]-lag;if(t==='SF')return LF[s.activityId]-lag+a.durationDays;return LS[s.activityId]-lag;});LF[id]=Math.min(...vals);}LS[id]=LF[id]-Math.max(0,+a.durationDays||0);}
  for(const id of ids){const a=amap.get(id);a.start=workdayAdd(projectStart,ES[id]);a.finish=workdayAdd(projectStart,(+a.durationDays||0)>0?EF[id]-1:EF[id]);a.totalFloatDays=Math.round(LS[id]-ES[id]);a.critical=a.totalFloatDays<=0;}
  return {activities,warnings:[],projectDuration};
}

export function runQA(activities,relationships,milestones=[],guidelines={}){
  const issues=[],ids=activities.map(a=>a.activityId),amap=new Map(activities.map(a=>[a.activityId,a]));const maxDur=guidelines.maxActivityDurationDays??60,maxLag=guidelines.maxLagDays??20;
  const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);if(dup.length)issues.push(issue('QA001','error',`Duplicate activity IDs: ${[...new Set(dup)].join(', ')}`,dup,'Make all activity IDs unique.'));
  for(const r of relationships){if(!amap.has(r.predecessorId)||!amap.has(r.successorId))issues.push(issue('QA002','error',`Relationship references missing activity: ${r.predecessorId}->${r.successorId}`,[r.predecessorId,r.successorId],'Repair relationship endpoints.'));if((+r.lagDays||0)<0&&!guidelines.negativeLagAllowed)issues.push(issue('QA008','warning',`Negative lag on ${r.predecessorId}->${r.successorId}`,[r.predecessorId,r.successorId],'Use an explicit activity rather than a lead where practical.'));if(Math.abs(+r.lagDays||0)>maxLag)issues.push(issue('QA009','warning',`Large lag (${r.lagDays}d) on ${r.predecessorId}->${r.successorId}`,[r.predecessorId,r.successorId],'Review whether the lag should be an explicit activity.'));}
  const validRels=relationships.filter(r=>amap.has(r.predecessorId)&&amap.has(r.successorId)); const order=topologicalOrder(ids,validRels);
  if(!order)issues.push(issue('QA003','error','Relationship network contains circular logic.',[],'Break circular dependencies before scheduling.'));
  else {const indeg=Object.fromEntries(ids.map(x=>[x,0])),outdeg=Object.fromEntries(ids.map(x=>[x,0]));for(const r of validRels){indeg[r.successorId]++;outdeg[r.predecessorId]++;}
    const starts=activities.filter(a=>indeg[a.activityId]===0&&a.durationDays>0),ends=activities.filter(a=>outdeg[a.activityId]===0&&a.durationDays>0);if(starts.length>1&&!guidelines.openEndsAllowed)issues.push(issue('QA004','warning',`${starts.length} non-milestone activities have no predecessors.`,starts.map(a=>a.activityId).slice(0,20),'Connect genuine starts to an access/start milestone.'));if(ends.length>1&&!guidelines.openEndsAllowed)issues.push(issue('QA005','warning',`${ends.length} non-milestone activities have no successors.`,ends.map(a=>a.activityId).slice(0,20),'Connect genuine finishes to completion/turnover.'));
    const ancestorCache=new Map(); const rev=Object.fromEntries(ids.map(x=>[x,[]]));for(const r of validRels)rev[r.successorId].push(r.predecessorId); const ancestors=id=>{if(ancestorCache.has(id))return ancestorCache.get(id);const seen=new Set(),stack=[...(rev[id]||[])];while(stack.length){const x=stack.pop();if(seen.has(x))continue;seen.add(x);stack.push(...(rev[x]||[]));}ancestorCache.set(id,seen);return seen;};
    const semantic=[['energ',['test','inspection','ready for energ']],['commission',['energ','pre-commission','functional test']],['pressure test',['install piping']],['insulate piping',['pressure test']],['terminate cables',['pull cables']],['ir / continuity',['terminate cables']],['place concrete',['reinforcement','pre-pour']]];
    for(const a of activities){const n=normText(a.name);for(const [tr,reqs] of semantic){if(n.includes(tr)){const names=[...ancestors(a.activityId)].map(x=>normText(amap.get(x)?.name||''));if(!names.some(an=>reqs.some(req=>an.includes(req))))issues.push(issue('QA020','warning',`Constructability check: "${a.name}" has no expected upstream prerequisite (${reqs.join(' / ')}).`,[a.activityId],'Review construction sequence.'));break;}}}
    for(const inst of activities.filter(a=>/install .*equipment/i.test(a.name))){const ds=activities.filter(a=>a.area===inst.area&&a.system===inst.system&&/required on site|deliver equipment/i.test(a.name));if(ds.length&&!ds.some(d=>ancestors(inst.activityId).has(d.activityId)))issues.push(issue('QA021','warning',`Equipment/material need milestone is not driving installation: ${inst.name}`,[ds[0].activityId,inst.activityId],'Link delivery/need date to installation.'));}
  }
  for(const a of activities){if(a.durationDays<0)issues.push(issue('QA006','error',`Negative duration: ${a.name}`,[a.activityId],'Set duration >= 0.'));if(a.durationDays>maxDur)issues.push(issue('QA007','warning',`Long activity (${a.durationDays}d > guideline ${maxDur}d): ${a.name}`,[a.activityId],'Break into measurable work fronts where practical.'));}
  const mn=milestones.map(x=>normText(x.name)).join(' ');if(milestones.length&&!/turnover|completion|complete/.test(mn))issues.push(issue('QA030','warning','No clear project completion/turnover milestone found.',[],'Confirm contractual finish/turnover milestone.'));
  return issues;
}
function issue(code,severity,message,activityIds,recommendation){return{code,severity,message,activityIds,recommendation};}

export function buildPlan(input={}){
  const projectName=input.projectName||'Planning Project',discipline=input.discipline||'Electrical',projectStart=input.projectStart||new Date().toISOString().slice(0,10),hoursPerDay=+(input.hoursPerDay||10),crewSize=+(input.crewSize||6),productivity=+(input.productivity||0.85);
  const docs=input.documents||[]; const byBranch={};for(const d of docs)(byBranch[d.branch]??=[]).push(d);
  let quantities=[]; const boqDocs=byBranch.boq||[];for(const d of boqDocs)quantities.push(...parseBOQText(d.text||'',discipline,d.name));
  const drawQuant=[];for(const d of (byBranch.current_drawings||[]))drawQuant.push(...extractQuantitiesFromText(d.text||'',discipline,d.name));
  const assumptions=[],warnings=[],questions=[];if(!quantities.length){quantities=drawQuant;if(quantities.length)assumptions.push('BOQ unavailable/unusable; drawing-derived quantities are the working basis and require review.');else assumptions.push('No usable BOQ or drawing quantities found; schedule uses scope templates and planning allowances.');}
  const normRefs=[];for(const d of [...(byBranch.estimating_norms||[]),...(byBranch.methodology||[])])normRefs.push(...parseNormText(d.text||'',d.name));
  const guidelineText=[...(byBranch.schedule_guidelines||[]),...(byBranch.specifications||[])].map(d=>d.text||'').join('\n'); const guidelines=parseGuidelines(guidelineText);
  const hist={durations:{},pairs:[],scheduleCount:0};for(const d of [...(byBranch.historical_schedules||[]),...(byBranch.client_schedules||[])]){if(/\.xer$/i.test(d.name)){const h=ingestHistoricalXER(d.text||'',hoursPerDay);hist.scheduleCount++;for(const [k,v] of Object.entries(h.durations))(hist.durations[k]??=[]).push(...v);hist.pairs.push(...h.pairs);}else if(/\.mpp$/i.test(d.name))warnings.push(`${d.name}: native MPP parsing is not available in the browser edition; export to XER/XML/MPX for analysis.`);}
  const scopeText=[...(byBranch.scope||[]),...(byBranch.contracts||[]),...(byBranch.specifications||[])].map(d=>d.text||'').join('\n');
  const explicitSystems=(input.systems||[]).filter(Boolean), inferredSystems=extractScopeSystems(scopeText), areas=new Set(input.areas||[]);quantities.forEach(q=>areas.add(q.area||'General'));docs.forEach(d=>detectAreas(d.text||'').forEach(a=>areas.add(a)));if(!areas.size)areas.add('General');
  let systems=explicitSystems.length?explicitSystems:[...new Set([...quantities.map(q=>q.system),...inferredSystems].filter(x=>x&&x!=='General'))];if(!systems.length)systems=discipline==='Mechanical'?['Piping','Mechanical Equipment']:discipline==='CSA'?['Concrete']:['Containment','Cabling','Electrical Equipment'];
  if(!boqDocs.length)questions.push(q('Q-BOQ-001','No BOQ was found. Should drawing-derived quantities be treated as the working quantity basis?','Quantities','medium'));
  if(!(byBranch.scope||[]).length){questions.push(q('Q-SCOPE-001','No scope document was found. Confirm included systems/disciplines and major exclusions.','Scope','high'));let i=10;for(const a of areas){questions.push(q(`Q-AREA-${i++}`,`What is the access/release date for ${a}?`,'Area Dates','high'));questions.push(q(`Q-AREA-${i++}`,`What is the required turnover / ready-for-use date for ${a}?`,'Turnover','high'));}}
  if(!(byBranch.current_drawings||[]).length)questions.push(q('Q-DWG-001','No current drawings were found. Confirm areas/rooms and systems to be planned.','Drawings','high'));
  if(!input.targetFinish)questions.push(q('Q-DATE-001','What is the contractual or required project completion / turnover date?','Key Dates','high'));
  const normFor=(key)=>{const nk=normText(key);const candidates=normRefs.filter(n=>n.key.includes(nk)||nk.includes(n.key));return candidates.length?median(candidates.map(x=>x.norm)):DEFAULT_NORMS[key]??DEFAULT_NORMS.general;};
  const histDuration=name=>median(hist.durations[categorizeActivity(name)]||[]);
  const wbs=[projectName],activities=[],relationships=[],milestones=[{milestoneId:'M000',name:'Project Start',date:projectStart,category:'Contract'}];
  activities.push(activity('A00000','Project Start',projectName,'Start Milestone',0,null,'',null,0,0,'General','General',discipline));let seq=10;const systemIndex={};
  for(const area of [...areas].sort()){
    const aw=`${projectName} > ${area}`;wbs.push(aw);
    for(const system of systems){const template=SYSTEM_TEMPLATES[system]||SYSTEM_TEMPLATES.General,sw=`${aw} > ${system}`;wbs.push(sw);const qs=quantities.filter(x=>(x.area===area||x.area==='General'||area==='General')&&x.system===system);const totalQty=qs.length?qs.reduce((s,x)=>s+x.quantity,0):null;const unit=qs.length&&qs.every(x=>x.unit===qs[0].unit)?qs[0].unit:'';let prev='A00000';systemIndex[`${area}|${system}`]={};
      for(const [name,kind,normKey] of template){const id=`A${String(seq).padStart(5,'0')}`;seq+=10;let duration=0,mh=null,norm=null,qtyVal=null,u='';if(kind==='work'){qtyVal=totalQty;u=unit;norm=normFor(normKey);if(qtyVal!=null){mh=qtyVal*norm;duration=Math.max(1,Math.ceil(mh/Math.max(1,crewSize*hoursPerDay*productivity)));}else{const hd=histDuration(name);duration=Math.max(1,Math.ceil(hd??DURATION_DEFAULTS[normKey]??5));}}
        else if(kind==='procurement'){const hd=histDuration(name);duration=Math.max(1,Math.ceil(hd??DURATION_DEFAULTS[normKey]??10));}
        const a=activity(id,name,sw,kind==='milestone'?'Finish Milestone':'Task Dependent',duration,qtyVal,u,norm,mh,kind==='milestone'?0:crewSize,area,system,discipline);activities.push(a);relationships.push(rel(prev,id,'FS',0,kind==='procurement'?'Procurement sequence':'Physical dependency'));prev=id;systemIndex[`${area}|${system}`][name]=id;}
    }
  }
  // Cross-system physical dependencies where both systems exist in the same area.
  for(const area of areas){const cont=systemIndex[`${area}|Containment`],cab=systemIndex[`${area}|Cabling`],eq=systemIndex[`${area}|Electrical Equipment`];if(cont&&cab){relationships.push(rel(cont['Containment Complete'],cab['Cable Route Available'],'FS',0,'Cable route requires containment'));}if(eq&&cab){const load=cab['Terminate Cables - Load'],inst=eq['Install Electrical Equipment'];if(load&&inst)relationships.push(rel(inst,load,'FS',0,'Load termination requires equipment installed'));}}
  // Completion milestone activity and links from terminal nodes.
  const finishId=`A${String(seq).padStart(5,'0')}`;activities.push(activity(finishId,'Project Completion / Turnover',projectName,'Finish Milestone',0,null,'',null,0,0,'General','General',discipline));
  const outgoing=new Set(relationships.map(r=>r.predecessorId));for(const a of activities){if(a.activityId!==finishId&&a.activityId!=='A00000'&&!outgoing.has(a.activityId))relationships.push(rel(a.activityId,finishId,'FS',0,'Project completion integration'));}
  milestones.push({milestoneId:'M999',name:'Project Completion / Turnover',date:input.targetFinish||null,category:'Contract/Planning'});
  const dateText=[...(byBranch.key_dates||[]),...(byBranch.contracts||[]),...(byBranch.scope||[])].map(d=>d.text||'').join('\n');for(const [i,x] of extractKeyDates(dateText).entries())milestones.push({milestoneId:`M${String(i+1).padStart(3,'0')}`,name:x.label||'Extracted Milestone',date:x.date,category:'Extracted'});
  const sch=scheduleActivities(activities,relationships,projectStart);warnings.push(...sch.warnings);if(input.targetFinish){const calc=activities.find(a=>a.activityId===finishId)?.finish;if(calc&&calc>input.targetFinish)warnings.push(`Calculated completion ${calc} is later than target ${input.targetFinish} by ${workdaysBetween(input.targetFinish,calc)} working days.`);}const qa=runQA(activities,relationships,milestones,guidelines);
  const durationBench=[];for(const a of activities){const h=histDuration(a.name);if(h!=null&&a.durationDays>0)durationBench.push({activityId:a.activityId,name:a.name,generatedDays:a.durationDays,historicalMedianDays:+h.toFixed(2),ratio:+(a.durationDays/h).toFixed(2),status:a.durationDays<h*.7?'aggressive':a.durationDays>h*1.4?'conservative':'within-range'});}
  const histPairSet=new Set(hist.pairs.map(p=>`${p[0]}|${p[1]}`));let compared=0,matched=0;for(const r of relationships){const p=activities.find(a=>a.activityId===r.predecessorId),s=activities.find(a=>a.activityId===r.successorId);if(p&&s){compared++;if(histPairSet.has(`${categorizeActivity(p.name)}|${categorizeActivity(s.name)}`))matched++;}}
  const errors=qa.filter(x=>x.severity==='error').length,warns=qa.filter(x=>x.severity==='warning').length;const confidence={scope:clamp(100-(questions.filter(x=>x.category==='Scope').length*18),20,100),quantities:quantities.length?(boqDocs.length?95:70):30,history:hist.scheduleCount?85:35,logic:clamp(100-errors*30-warns*3,15,100)};confidence.overall=Math.round(Object.values(confidence).reduce((a,b)=>a+b,0)/4);
  return {version:VERSION,projectName,generatedAt:new Date().toISOString(),wbs:[...new Set(wbs)],activities,relationships,milestones,quantities,questions,qaIssues:qa,assumptions,warnings,guidelines,confidence,sourceSummary:{documents:docs.length,boqQuantities:boqDocs.length?quantities.length:0,drawingCandidateQuantities:drawQuant.length,historicalSchedules:hist.scheduleCount,historicalBenchmark:{durationComparisons:durationBench,logicPairsCompared:compared,logicPairsSeenHistorically:matched,logicMatchRatio:compared?+(matched/compared).toFixed(3):null}},systems:[...systems],areas:[...areas]};
}
function q(id,question,category,severity){return{questionId:id,question,category,severity,rationale:'Generated because required planning information was not found.',resolved:false,answer:null};}
function activity(activityId,name,wbs,activityType,durationDays,quantity,unit,norm,manhours,crewSize,area,system,discipline){return{activityId,name,wbs,activityType,durationDays,quantity,unit,norm,manhours,crewSize,start:null,finish:null,totalFloatDays:null,critical:false,area,system,discipline,evidence:[],assumptions:[]};}
function rel(predecessorId,successorId,relType='FS',lagDays=0,reason='Physical dependency'){return{predecessorId,successorId,relType,lagDays,reason,source:'Rule library'};}

export function buildAIContext(plan,documents=[],maxChars=120000){
  const docSummaries=[];let used=0;for(const d of documents){if(used>=maxChars)break;const text=(d.text||'').slice(0,Math.max(0,Math.min(16000,maxChars-used)));used+=text.length;docSummaries.push({name:d.name,branch:d.branch,relativePath:d.relativePath||'',text});}
  return {project:{name:plan.projectName,systems:plan.systems,areas:plan.areas,confidence:plan.confidence},documents:docSummaries,quantities:plan.quantities.slice(0,500),wbs:plan.wbs.slice(0,500),activities:plan.activities.slice(0,1000).map(a=>({id:a.activityId,name:a.name,wbs:a.wbs,duration:a.durationDays,start:a.start,finish:a.finish,float:a.totalFloatDays,qty:a.quantity,unit:a.unit,mh:a.manhours,area:a.area,system:a.system})),relationships:plan.relationships.slice(0,2000),questions:plan.questions,qa:plan.qaIssues,historical:plan.sourceSummary.historicalBenchmark,assumptions:plan.assumptions,warnings:plan.warnings};
}

export function toCSV(rows){if(!rows?.length)return '';const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];const esc=v=>{const s=v==null?'':typeof v==='object'?JSON.stringify(v):String(v);return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};return [keys.join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n');}

export function demoDocuments(){
  return [
    {id:'d1',branch:'scope',name:'Scope.txt',relativePath:'Current Information/Scope Document/Scope.txt',text:'Electrical installation for Data Hall 01 and Electrical Room ER01 including containment, LV cabling, UPS panels, lighting, small power and earthing. Data Hall 01 turnover 30 September 2026.'},
    {id:'d2',branch:'boq',name:'BOQ.csv',relativePath:'Current Information/BOQ/BOQ.csv',text:'Description,Quantity,Unit,Area,Norm\n300mm cable ladder,850,m,Data Hall 01,0.55\nLV cable,12400,m,Data Hall 01,0.22\nUPS panels,6,ea,Electrical Room ER01,8\nLighting fittings,180,ea,Data Hall 01,0.8'},
    {id:'d3',branch:'schedule_guidelines',name:'Schedule_Guideline.txt',relativePath:'Previous Reference Documents/Schedule Guidelines and Specifications/Schedule_Guideline.txt',text:'Maximum activity duration 30 days. Maximum lag 10 days. Negative lag is not permitted. Open ends are not permitted.'},
    {id:'d4',branch:'estimating_norms',name:'Norms.txt',relativePath:'Previous Reference Documents/Estimating Norms and Books/Norms.txt',text:'cable installation: 0.22 MH/m\ninstall containment: 0.55 MH/m\nelectrical testing: 0.08 MH/m'}
  ];
}
