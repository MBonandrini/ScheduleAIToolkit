
import {esc,isoDate,parseDate,clamp} from "../core/utils.js";

export const metric=(label,value,detail="")=>`<div class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`;
export const badge=(text,kind="")=>`<span class="badge ${kind}">${esc(text)}</span>`;
export const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}" class="muted">No data</td></tr>`}</tbody></table></div>`;
export function lineChart(series,{width=900,height=260}={}){
  if(!series?.length)return `<div class="empty-state">No chart data.</div>`;
  const all=series.flatMap(s=>s.values.map(v=>Number(v.y))).filter(Number.isFinite),min=Math.min(...all),max=Math.max(...all),span=max-min||1;
  const n=Math.max(2,...series.map(s=>s.values.length)),pad=28;
  const paths=series.map((s,si)=>{
    const pts=s.values.map((v,i)=>{
      const x=pad+i/(n-1)*(width-pad*2),y=height-pad-(Number(v.y)-min)/span*(height-pad*2);return `${x},${y}`;
    }).join(" ");
    return `<polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="${si?2:3}" opacity="${si?0.65:1}"/>`;
  }).join("");
  return `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${paths}<text x="8" y="18" fill="currentColor" font-size="10">${max.toFixed(1)}</text><text x="8" y="${height-8}" fill="currentColor" font-size="10">${min.toFixed(1)}</text></svg>`;
}

export function barChart(rows,{width=900,height=240,labelKey="label",series=[]}={}){
  if(!rows?.length||!series?.length)return `<div class="empty-state">No chart data.</div>`;
  const vals=rows.flatMap(r=>series.map(s=>Number(r[s.key]||0))),max=Math.max(1,...vals),pad=30;
  const groupW=(width-pad*2)/rows.length,barW=Math.max(2,groupW/(series.length+1));
  const bars=[];
  rows.forEach((r,i)=>{
    series.forEach((s,j)=>{
      const v=Number(r[s.key]||0),h=(v/max)*(height-pad*2),x=pad+i*groupW+j*barW+barW*.15,y=height-pad-h;
      bars.push(`<rect x="${x}" y="${y}" width="${barW*.72}" height="${h}" rx="1.5" fill="currentColor" opacity="${0.9-j*.18}"><title>${esc(r[labelKey]||"")} · ${esc(s.label)}: ${v}</title></rect>`);
    });
  });
  const step=Math.max(1,Math.ceil(rows.length/12)),labels=rows.map((r,i)=>i%step===0?`<text x="${pad+i*groupW}" y="${height-8}" fill="currentColor" font-size="8">${esc(String(r[labelKey]||"").slice(0,12))}</text>`:"").join("");
  return `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${bars.join("")}${labels}</svg>`;
}

export function networkGraph(schedule,{maxNodes=90}={}){
  const critical=(schedule.activities||[]).filter(a=>a.critical||a.totalFloat<=0);
  const pool=(critical.length?critical:schedule.activities||[]).slice(0,maxNodes);
  if(!pool.length)return `<div class="empty-state">No network data.</div>`;
  const ids=new Set(pool.map(a=>a.id)),rels=(schedule.relationships||[]).filter(r=>ids.has(r.predId)&&ids.has(r.succId));
  const dates=pool.map(a=>parseDate(a.currentStart||a.start)?.getTime()).filter(Boolean),min=Math.min(...dates),max=Math.max(...dates),span=max-min||1;
  const width=1000,height=Math.max(300,Math.ceil(pool.length/8)*64),coords=new Map();
  pool.forEach((a,i)=>{
    const dt=parseDate(a.currentStart||a.start)?.getTime()||min;
    const x=60+(dt-min)/span*(width-150),y=45+(i%Math.max(1,Math.floor(height/60)))*55;
    coords.set(a.id,{x,y,a});
  });
  const lines=rels.map(r=>{const p=coords.get(r.predId),s=coords.get(r.succId);return p&&s?`<line x1="${p.x+80}" y1="${p.y+12}" x2="${s.x}" y2="${s.y+12}" stroke="currentColor" opacity=".28" stroke-width="1.2"><title>${esc(r.predId)} ${esc(r.type)} ${esc(r.succId)} · lag ${Number(r.lag||0).toFixed(1)}d</title></line>`:""}).join("");
  const nodes=pool.map(a=>{const c=coords.get(a.id),crit=a.critical||a.totalFloat<=0;return `<g><rect x="${c.x}" y="${c.y}" width="82" height="25" rx="5" fill="${crit?"#c83932":"#337eb0"}"/><text x="${c.x+4}" y="${c.y+16}" fill="#fff" font-size="8">${esc(a.id.slice(0,13))}</text><title>${esc(a.id)} · ${esc(a.name)} · TF ${Number(a.totalFloat||0).toFixed(1)}d</title></g>`}).join("");
  return `<div class="table-wrap" style="max-height:520px"><svg viewBox="0 0 ${width} ${height}" style="min-width:1000px;width:100%;height:${height}px;background:var(--panel2);border-radius:8px">${lines}${nodes}</svg></div>`;
}
export function gantt(schedule,{activities=null,timescale="weekly",compression="standard",criticalOnly=false,forceRed=false,showRelationships=false}={}){
  const acts=(activities||schedule.activities||[]).filter(a=>!criticalOnly||a.critical||a.totalFloat<=0);
  const dates=acts.flatMap(a=>[a.currentStart||a.start,a.currentFinish||a.finish,a.baselineStart,a.baselineFinish]).map(parseDate).filter(Boolean);
  if(!dates.length)return `<div class="gantt-panel panel"><div class="empty-state">No usable activity dates.</div></div>`;
  let min=Math.min(...dates.map(d=>d.getTime())),max=Math.max(...dates.map(d=>d.getTime()));if(max<=min)max=min+86400000;
  const span=max-min,pos=v=>{const d=parseDate(v);return d?clamp((d.getTime()-min)/span*100,0,100):0};
  const totalDays=Math.max(1,span/86400000),stepDays=timescale==="annual"?365:timescale==="quarterly"?91:timescale==="monthly"?30:7;
  const gridPct=Math.max(.5,stepDays/totalDays*100),timelineMin=compression==="compact"?760:timescale==="weekly"?1350:1050;
  const rowClass=compression==="compact"?" compact":"";
  const renderActivity=a=>{
    const s=pos(a.currentStart||a.start),f=pos(a.currentFinish||a.finish),bs=pos(a.baselineStart),bf=pos(a.baselineFinish),crit=forceRed||a.critical||a.totalFloat<=0;
    const current=a.milestone?`<span class="milestone ${crit?"critical":""}" style="left:${f}%"></span>`:
      `<span class="bar ${crit?"critical":""}" style="left:${Math.min(s,f)}%;width:${Math.max(.25,Math.abs(f-s))}%"><i style="width:${Math.max(0,Math.min(100,a.percent||0))}%"></i></span>`;
    const baseline=a.baselineStart&&!a.milestone?`<span class="baseline-bar" style="left:${Math.min(bs,bf)}%;width:${Math.max(.2,Math.abs(bf-bs))}%"></span>`:"";
    const actual=a.actualStart?`<span class="actual-mark" style="left:${pos(a.actualStart)}%"></span>`:"";
    return `<div class="gantt-row${rowClass}"><div class="gantt-left" title="${esc(a.wbsPath)}"><span class="gantt-code">${esc(a.id)}</span> · ${esc(a.name)}</div><div class="gantt-time" style="background-size:${gridPct}% 100%">${baseline}${current}${actual}</div></div>`;
  };
  const groups=new Map();
  for(const a of acts){const key=a.wbsPath||"Unassigned WBS";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a)}
  const grouped=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([wbs,list])=>{
    const starts=list.map(a=>parseDate(a.currentStart||a.start)).filter(Boolean),finishes=list.map(a=>parseDate(a.currentFinish||a.finish)).filter(Boolean);
    const gs=starts.length?pos(new Date(Math.min(...starts.map(d=>d.getTime())))):0,gf=finishes.length?pos(new Date(Math.max(...finishes.map(d=>d.getTime())))):0;
    return `<details class="gantt-group" open><summary><span>${esc(wbs)} <small>${list.length} activities</small></span><span class="summary-time"><i style="left:${Math.min(gs,gf)}%;width:${Math.max(.3,Math.abs(gf-gs))}%"></i></span></summary>${list.map(renderActivity).join("")}</details>`;
  }).join("");
  const dd=pos(schedule.dataDate),title=criticalOnly?"Critical Path Gantt":"WBS / Activity Gantt";
  return `<div class="panel gantt-panel"><h2>${title}</h2><div class="muted">${acts.length} activities · ${isoDate(new Date(min))} to ${isoDate(new Date(max))}</div>
  <div class="gantt-toolbar"><label>Timescale <select id="ganttTimescale"><option value="weekly" ${timescale==="weekly"?"selected":""}>Weekly</option><option value="monthly" ${timescale==="monthly"?"selected":""}>Monthly</option><option value="quarterly" ${timescale==="quarterly"?"selected":""}>Quarterly</option><option value="annual" ${timescale==="annual"?"selected":""}>Annual</option></select></label>
  <label>Bar compression <select id="ganttCompression"><option value="compact" ${compression==="compact"?"selected":""}>Compact / print</option><option value="standard" ${compression==="standard"?"selected":""}>Standard</option></select></label>
  <label><input type="checkbox" id="ganttRelationships" ${showRelationships?"checked":""}> Relationship emphasis</label></div>
  <div class="gantt-wrap"><div class="gantt" style="min-width:${timelineMin+410}px"><div class="gantt-row${rowClass}"><div class="gantt-left"><strong>WBS / Activity</strong></div><div class="gantt-time" style="background-size:${gridPct}% 100%"><span class="data-date" style="left:${dd}%"></span></div></div>${grouped}</div></div>
  ${showRelationships?`<div class="muted" style="margin-top:6px">Relationship emphasis is enabled. Driving/critical relationships are analysed in Nodes & Links; browser rendering intentionally avoids thousands of crossing SVG lines on very large programmes.</div>`:""}</div>`;
}
export function calendarMonth(calendarYear,monthIndex){
  const month=calendarYear.months[monthIndex],first=new Date(calendarYear.year,monthIndex,1),offset=(first.getDay()+6)%7;
  const blanks=Array.from({length:offset},()=>`<span class="day"></span>`).join("");
  const days=month.days.map(d=>`<span class="day ${d.exception?"exception":!d.working?"nonwork":""}">${d.day}</span>`).join("");
  return `<div class="calendar-month"><h4>${first.toLocaleDateString(undefined,{month:"long"})}</h4><div class="calendar-week">${["M","T","W","T","F","S","S"].map(x=>`<span>${x}</span>`).join("")}</div><div class="calendar-days">${blanks}${days}</div></div>`;
}
