import {esc,isoDate,parseDate,clamp,addDays} from "../core/utils.js";

export const metric=(label,value,detail="",help="")=>`<div class="metric${help?" metric-help":""}"${help?` title="${esc(help)}" data-help="${esc(help)}"`:""}><small>${esc(label)}${help?` <span class="help-dot" aria-hidden="true">?</span>`:""}</small><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`;
export const badge=(text,kind="")=>`<span class="badge ${kind}">${esc(text)}</span>`;
export const table=(headers,rows,{resizable=false,resizeKey=""}={})=>`<div class="table-wrap${resizable?" resizable-wrap":""}"${resizable&&resizeKey?` data-resize-key="${esc(resizeKey)}"`:""}><table class="${resizable?"resizable-table":""}">${resizable?`<colgroup>${headers.map(()=>`<col>`).join("")}</colgroup>`:""}<thead><tr>${headers.map((h,i)=>`<th>${esc(h)}${resizable?`<span class="col-resizer" data-col-index="${i}" role="separator" aria-orientation="vertical" aria-label="Resize ${esc(h)} column" title="Drag to resize column"></span>`:""}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c??""}</td>`).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}" class="muted">No data</td></tr>`}</tbody></table></div>`;

function chartLegend(series){
  return `<div class="chart-legend">${series.map((s,i)=>`<span><i class="chart-key chart-key-${i%6}"></i>${esc(s.name||s.label||`Series ${i+1}`)}</span>`).join("")}</div>`;
}
export function lineChart(series,{width=900,height=280,xLabels=[],rotateLabels=false,valueSuffix=""}={}){
  if(!series?.length||!series.some(s=>s.values?.length))return `<div class="empty-state">No chart data.</div>`;
  const all=series.flatMap(s=>(s.values||[]).map(v=>Number(v.y))).filter(Number.isFinite),min=Math.min(...all),max=Math.max(...all),span=max-min||1;
  const n=Math.max(2,...series.map(s=>s.values?.length||0)),left=42,right=18,top=22,bottom=rotateLabels?82:42,plotH=height-top-bottom,plotW=width-left-right;
  const xAt=i=>left+i/Math.max(1,n-1)*plotW,yAt=v=>top+plotH-(Number(v)-min)/span*plotH;
  const grid=Array.from({length:5},(_,i)=>{const y=top+i/4*plotH,val=max-i/4*span;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="chart-grid"/><text x="5" y="${y+3}" class="chart-axis-label">${Number(val).toFixed(1)}</text>`}).join("");
  const paths=series.map((s,si)=>{
    const pts=(s.values||[]).map((v,i)=>`${xAt(i)},${yAt(v.y)}`).join(" ");
    const points=(s.values||[]).map((v,i)=>`<circle cx="${xAt(i)}" cy="${yAt(v.y)}" r="3.5" class="chart-point chart-series-${si%6}"><title>${esc(xLabels[i]||String(v.x??i))} · ${esc(s.name||s.label||`Series ${si+1}`)}: ${Number(v.y).toFixed(2)}${esc(valueSuffix)}</title></circle>`).join("");
    return `<polyline points="${pts}" fill="none" class="chart-line chart-series-${si%6}" stroke-width="${si?2:3}"/>${points}`;
  }).join("");
  const step=Math.max(1,Math.ceil(n/16));
  const labels=Array.from({length:n},(_,i)=>i%step===0?`<text x="${xAt(i)}" y="${height-bottom+18}" class="chart-axis-label chart-x-label" text-anchor="${rotateLabels?"start":"middle"}" ${rotateLabels?`transform="rotate(90 ${xAt(i)} ${height-bottom+18})"`:""}>${esc(String(xLabels[i]??i))}</text>`:"").join("");
  return `<div class="chart-shell">${chartLegend(series)}<svg class="svg-chart${rotateLabels?" rotated-axis":""}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${grid}${paths}${labels}</svg></div>`;
}

export function barChart(rows,{width=900,height=280,labelKey="label",series=[],xLabels=null,rotateLabels=false,valueSuffix=""}={}){
  if(!rows?.length||!series?.length)return `<div class="empty-state">No chart data.</div>`;
  const vals=rows.flatMap(r=>series.map(s=>Number(r[s.key]||0))),max=Math.max(1,...vals),left=38,right=16,top=20,bottom=rotateLabels?84:42,plotH=height-top-bottom,plotW=width-left-right;
  const groupW=plotW/rows.length,barW=Math.max(1.5,groupW/Math.max(2,series.length+1));
  const grid=Array.from({length:5},(_,i)=>{const y=top+i/4*plotH,val=max-i/4*max;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="chart-grid"/><text x="5" y="${y+3}" class="chart-axis-label">${Number(val).toFixed(0)}</text>`}).join("");
  const bars=[];
  rows.forEach((r,i)=>{
    series.forEach((s,j)=>{
      const v=Number(r[s.key]||0),h=(v/max)*plotH,x=left+i*groupW+j*barW+barW*.22,y=top+plotH-h;
      bars.push(`<rect x="${x}" y="${y}" width="${Math.max(1,barW*.68)}" height="${h}" rx="1.5" class="chart-bar chart-series-${j%6}"><title>${esc((xLabels?.[i])??r[labelKey]??"")} · ${esc(s.label||s.name||s.key)}: ${v.toFixed(2)}${esc(valueSuffix)}</title></rect>`);
    });
  });
  const step=Math.max(1,Math.ceil(rows.length/16)),labels=rows.map((r,i)=>i%step===0?`<text x="${left+i*groupW+groupW*.35}" y="${height-bottom+18}" class="chart-axis-label chart-x-label" text-anchor="${rotateLabels?"start":"middle"}" ${rotateLabels?`transform="rotate(90 ${left+i*groupW+groupW*.35} ${height-bottom+18})"`:""}>${esc(String((xLabels?.[i])??r[labelKey]??"").slice(0,18))}</text>`:"").join("");
  return `<div class="chart-shell">${chartLegend(series)}<svg class="svg-chart${rotateLabels?" rotated-axis":""}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${grid}${bars.join("")}${labels}</svg></div>`;
}

function relationshipText(r){return `${r.predId} ${r.type||"FS"}${Number(r.lag||0)?` ${Number(r.lag)>0?"+":""}${Number(r.lag).toFixed(1)}d`:""} → ${r.succId}`}
export function networkGraph(schedule,{maxNodes=120}={}){
  const critical=(schedule.activities||[]).filter(a=>a.critical||a.totalFloat<=0);
  const pool=(critical.length?critical:schedule.activities||[]).slice(0,maxNodes);
  if(!pool.length)return `<div class="empty-state">No network data.</div>`;
  const ids=new Set(pool.map(a=>a.id)),rels=(schedule.relationships||[]).filter(r=>ids.has(r.predId)&&ids.has(r.succId));
  const incoming=new Map(pool.map(a=>[a.id,[]])),outgoing=new Map(pool.map(a=>[a.id,[]]));
  for(const r of rels){incoming.get(r.succId)?.push(r);outgoing.get(r.predId)?.push(r)}
  const indegree=new Map(pool.map(a=>[a.id,incoming.get(a.id)?.length||0])),layer=new Map(pool.map(a=>[a.id,0])),queue=pool.filter(a=>indegree.get(a.id)===0).map(a=>a.id);
  while(queue.length){const id=queue.shift(),base=layer.get(id)||0;for(const r of outgoing.get(id)||[]){layer.set(r.succId,Math.max(layer.get(r.succId)||0,base+1));indegree.set(r.succId,(indegree.get(r.succId)||0)-1);if(indegree.get(r.succId)===0)queue.push(r.succId)}}
  const maxKnown=Math.max(0,...layer.values());for(const a of pool)if((indegree.get(a.id)||0)>0)layer.set(a.id,Math.max(layer.get(a.id)||0,maxKnown+1));
  const layers=new Map();for(const a of pool){const l=layer.get(a.id)||0;if(!layers.has(l))layers.set(l,[]);layers.get(l).push(a)}
  for(const xs of layers.values())xs.sort((a,b)=>(parseDate(a.currentStart||a.start)?.getTime()||0)-(parseDate(b.currentStart||b.start)?.getTime()||0)||String(a.id).localeCompare(String(b.id)));
  const maxLayer=Math.max(0,...layers.keys()),maxLane=Math.max(1,...[...layers.values()].map(x=>x.length)),width=Math.max(1100,(maxLayer+1)*190+120),height=Math.max(420,maxLane*78+100),coords=new Map();
  for(const [l,xs] of layers.entries())xs.forEach((a,i)=>coords.set(a.id,{x:55+l*190,y:55+i*78,a}));
  const marker=`<defs><marker id="netArrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L7,3 z" class="network-arrow"/></marker></defs>`;
  const lines=rels.map(r=>{const p=coords.get(r.predId),s=coords.get(r.succId);if(!p||!s)return"";const x1=p.x+138,y1=p.y+20,x2=s.x,y2=s.y+20,mx=x1+Math.max(28,(x2-x1)*.45);return `<path d="M${x1} ${y1} C${mx} ${y1},${mx} ${y2},${x2} ${y2}" class="network-link" marker-end="url(#netArrow)"><title>${esc(relationshipText(r))}</title></path>`}).join("");
  const nodes=pool.map(a=>{const c=coords.get(a.id),crit=a.critical||a.totalFloat<=0,ins=incoming.get(a.id)||[],outs=outgoing.get(a.id)||[],issues=[];if(!ins.length)issues.push("Open start");if(!outs.length)issues.push("Open finish");if(Number(a.totalFloat)<0)issues.push(`Negative float ${Number(a.totalFloat).toFixed(1)}d`);if(a.constraintType)issues.push(`Constraint ${a.constraintType}${a.constraintDate?` ${isoDate(a.constraintDate)}`:""}`);if(a.milestone)issues.push("Milestone");
    const tip=[`${a.id} · ${a.name}`,`WBS: ${a.wbsPath||"—"}`,`Status: ${a.status||"—"}`,`Start: ${isoDate(a.currentStart||a.start)||"—"}`,`Finish: ${isoDate(a.currentFinish||a.finish)||"—"}`,`TF: ${Number(a.totalFloat||0).toFixed(1)}d`,`Incoming: ${ins.length}${ins.length?` — ${ins.slice(0,8).map(relationshipText).join("; ")}`:""}`,`Outgoing: ${outs.length}${outs.length?` — ${outs.slice(0,8).map(relationshipText).join("; ")}`:""}`,`Issues: ${issues.join("; ")||"None detected"}`].join("\n");
    return `<g class="network-node${crit?" critical":""}"><rect x="${c.x}" y="${c.y}" width="138" height="42" rx="7"/><text x="${c.x+7}" y="${c.y+16}" class="network-node-id">${esc(a.id.slice(0,19))}</text><text x="${c.x+7}" y="${c.y+32}" class="network-node-name">${esc((a.name||"").slice(0,22))}</text><title>${esc(tip)}</title></g>`}).join("");
  return `<div class="network-widget" data-network-widget data-zoom="1"><div class="network-toolbar"><button class="btn" data-net-zoom="out" title="Zoom out">−</button><span class="network-zoom-label">100%</span><button class="btn" data-net-zoom="in" title="Zoom in">＋</button><button class="btn" data-net-zoom="reset">Reset</button><span class="muted">${pool.length} nodes · ${rels.length} visible relationships</span></div><div class="network-viewport"><div class="network-canvas" style="width:${width}px;height:${height}px"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="Schedule network diagram">${marker}${lines}${nodes}</svg></div></div></div>`;
}

function scaleSegments(min,max,timescale){
  const out=[],span=max-min||1,start=new Date(min);let cursor;
  if(timescale==="weekly"){cursor=new Date(start);cursor.setHours(0,0,0,0);const mondayOffset=(cursor.getDay()+6)%7;cursor.setDate(cursor.getDate()-mondayOffset)}
  else if(timescale==="monthly"){cursor=new Date(start.getFullYear(),start.getMonth(),1)}
  else if(timescale==="quarterly"){cursor=new Date(start.getFullYear(),Math.floor(start.getMonth()/3)*3,1)}
  else cursor=new Date(start.getFullYear(),0,1);
  let guard=0;
  while(cursor.getTime()<=max&&guard++<1000){
    const next=new Date(cursor);
    if(timescale==="weekly")next.setDate(next.getDate()+7);else if(timescale==="monthly")next.setMonth(next.getMonth()+1);else if(timescale==="quarterly")next.setMonth(next.getMonth()+3);else next.setFullYear(next.getFullYear()+1);
    const left=clamp((cursor.getTime()-min)/span*100,0,100),right=clamp((next.getTime()-min)/span*100,0,100),width=Math.max(.2,right-left);
    let label="";
    if(timescale==="weekly")label=isoDate(addDays(cursor,4));
    else if(timescale==="monthly")label=cursor.toLocaleDateString(undefined,{month:"short",year:"2-digit"});
    else if(timescale==="quarterly")label=`Q${Math.floor(cursor.getMonth()/3)+1} ${cursor.getFullYear()}`;
    else label=String(cursor.getFullYear());
    out.push(`<span style="left:${left}%;width:${width}%" title="${esc(label)}">${esc(label)}</span>`);cursor=next;
  }
  return out.join("");
}
export function gantt(schedule,{activities=null,timescale="weekly",compression="standard",criticalOnly=false,forceRed=false,showRelationships=true,leftWidth=410,resizeKey="gantt"}={}){
  const acts=(activities||schedule.activities||[]).filter(a=>!criticalOnly||a.critical||a.totalFloat<=0);
  const dates=acts.flatMap(a=>[a.currentStart||a.start,a.currentFinish||a.finish,a.baselineStart,a.baselineFinish]).map(parseDate).filter(Boolean);
  if(!dates.length)return `<div class="gantt-panel panel"><div class="empty-state">No usable activity dates.</div></div>`;
  let min=Math.min(...dates.map(d=>d.getTime())),max=Math.max(...dates.map(d=>d.getTime()));if(max<=min)max=min+86400000;
  const span=max-min,pos=v=>{const d=parseDate(v);return d?clamp((d.getTime()-min)/span*100,0,100):0};
  const totalDays=Math.max(1,span/86400000),stepDays=timescale==="annual"?365:timescale==="quarterly"?91:timescale==="monthly"?30:7;
  const gridPct=Math.max(.35,stepDays/totalDays*100),timelineMin=compression==="compact"?760:timescale==="weekly"?1400:1100,rowClass=compression==="compact"?" compact":"";
  const renderActivity=a=>{
    const s=pos(a.currentStart||a.start),f=pos(a.currentFinish||a.finish),bs=pos(a.baselineStart),bf=pos(a.baselineFinish),crit=forceRed||a.critical||a.totalFloat<=0;
    const current=a.milestone?`<span class="milestone ${crit?"critical":""}" style="left:${f}%" title="${esc(a.id)} · ${esc(a.name)} · ${isoDate(a.currentFinish||a.finish)}"></span>`:
      `<span class="bar ${crit?"critical":""}" style="left:${Math.min(s,f)}%;width:${Math.max(.25,Math.abs(f-s))}%" title="${esc(a.id)} · ${esc(a.name)} · ${isoDate(a.currentStart||a.start)} → ${isoDate(a.currentFinish||a.finish)} · TF ${Number(a.totalFloat||0).toFixed(1)}d"><i style="width:${Math.max(0,Math.min(100,a.percent||0))}%"></i></span>`;
    const baseline=a.baselineStart&&!a.milestone?`<span class="baseline-bar" style="left:${Math.min(bs,bf)}%;width:${Math.max(.2,Math.abs(bf-bs))}%" title="Baseline ${isoDate(a.baselineStart)} → ${isoDate(a.baselineFinish)}"></span>`:"";
    const actual=a.actualStart?`<span class="actual-mark" style="left:${pos(a.actualStart)}%" title="Actual start ${isoDate(a.actualStart)}"></span>`:"";
    return `<div class="gantt-row${rowClass}" data-activity-id="${esc(a.id)}"><div class="gantt-left" title="${esc(a.wbsPath)}"><span class="gantt-code">${esc(a.id)}</span> · ${esc(a.name)}</div><div class="gantt-time" style="background-size:${gridPct}% 100%">${baseline}${current}${actual}</div></div>`;
  };
  const groups=new Map();for(const a of acts){const key=a.wbsPath||"Unassigned WBS";if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a)}
  const grouped=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([wbs,list])=>{
    const starts=list.map(a=>parseDate(a.currentStart||a.start)).filter(Boolean),finishes=list.map(a=>parseDate(a.currentFinish||a.finish)).filter(Boolean),gs=starts.length?pos(new Date(Math.min(...starts.map(d=>d.getTime())))):0,gf=finishes.length?pos(new Date(Math.max(...finishes.map(d=>d.getTime())))):0;
    return `<details class="gantt-group" open><summary><span>${esc(wbs)} <small>${list.length} activities</small></span><span class="summary-time"><i style="left:${Math.min(gs,gf)}%;width:${Math.max(.3,Math.abs(gf-gs))}%"></i></span></summary>${list.map(renderActivity).join("")}</details>`;
  }).join("");
  const dd=pos(schedule.dataDate),title=criticalOnly?"Critical Path Gantt":"WBS / Activity Gantt",scale=scaleSegments(min,max,timescale);
  return `<div class="panel gantt-panel" data-gantt-panel data-resize-key="${esc(resizeKey)}"><h2>${title}</h2><div class="muted">${acts.length} activities · ${isoDate(new Date(min))} to ${isoDate(new Date(max))}</div>
  <div class="gantt-toolbar"><label>Timescale <select id="ganttTimescale"><option value="weekly" ${timescale==="weekly"?"selected":""}>Weeks</option><option value="monthly" ${timescale==="monthly"?"selected":""}>Months</option><option value="quarterly" ${timescale==="quarterly"?"selected":""}>Quarters</option><option value="annual" ${timescale==="annual"?"selected":""}>Years</option></select></label>
  <label>Row density <select id="ganttCompression"><option value="compact" ${compression==="compact"?"selected":""}>Compact</option><option value="standard" ${compression==="standard"?"selected":""}>Standard</option></select></label>
  <label><input type="checkbox" id="ganttRelationships" ${showRelationships?"checked":""}> Show relationship links</label></div>
  <div class="gantt-wrap"><div class="gantt" style="--gantt-left:${Math.max(220,Number(leftWidth)||410)}px;min-width:${timelineMin+Math.max(220,Number(leftWidth)||410)}px" data-show-relationships="${showRelationships?"1":"0"}"><svg class="gantt-rel-overlay" aria-hidden="true"></svg><div class="gantt-row gantt-scale-row${rowClass}"><div class="gantt-left gantt-left-header"><strong>WBS / Activity</strong><span class="gantt-divider" role="separator" aria-orientation="vertical" title="Drag to resize WBS / Activity column"></span></div><div class="gantt-time gantt-scale" style="background-size:${gridPct}% 100%"><span class="data-date" style="left:${dd}%" title="Data date ${isoDate(schedule.dataDate)}"></span>${scale}</div></div>${grouped}</div></div>
  <div class="gantt-footnote muted">Relationship links are drawn between visible activities. Collapse/expand WBS bands or resize the activity column and the links redraw automatically.</div></div>`;
}
export function calendarMonth(calendarYear,monthIndex){
  const month=calendarYear.months[monthIndex],first=new Date(calendarYear.year,monthIndex,1),offset=(first.getDay()+6)%7;
  const blanks=Array.from({length:offset},()=>`<span class="day"></span>`).join("");
  const days=month.days.map(d=>`<span class="day ${d.exception?"exception":!d.working?"nonwork":""}">${d.day}</span>`).join("");
  return `<div class="calendar-month"><h4>${first.toLocaleDateString(undefined,{month:"long"})}</h4><div class="calendar-week">${["M","T","W","T","F","S","S"].map(x=>`<span>${x}</span>`).join("")}</div><div class="calendar-days">${blanks}${days}</div></div>`;
}
