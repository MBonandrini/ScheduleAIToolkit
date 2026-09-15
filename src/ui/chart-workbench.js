/**
 * Interactive chart workbench used throughout the analytical reports.
 *
 * The renderer is intentionally dependency-free so the GitHub Pages build stays
 * self-contained.  Every chart carries its source data and can be re-rendered as
 * grouped/stacked/100%-stacked/horizontal bars, line or area charts.  Series can
 * be hidden, data sorted/limited, values labelled, bars/points clicked, and the
 * visible chart exported to CSV, SVG or PNG.
 */
import { esc, downloadBlob } from "../core/utils.js";

let chartCounter = 0;
const jsonForHtml = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
const n = v => Number(v || 0);

function legend(series) {
  return `<div class="chart-legend interactive-chart-legend">${series.map((s, i) => `<label><input type="checkbox" data-chart-series="${i}" checked><i class="chart-key chart-key-${i % 6}"></i>${esc(s.label || s.name || s.key)}</label>`).join("")}</div>`;
}

export function interactiveBarChart(rows, {
  width = 900, height = 300, labelKey = "label", series = [], xLabels = null,
  rotateLabels = false, valueSuffix = "", title = "", defaultMode = "grouped",
  dateKey = null, threshold = null
} = {}) {
  if (!rows?.length || !series?.length) return `<div class="empty-state">No chart data.</div>`;
  const id = `chart-${++chartCounter}`;
  const payload = { rows, series, labelKey, xLabels, rotateLabels, valueSuffix, width, height, dateKey, threshold };
  return `<div class="chart-workbench" id="${id}">
    <div class="chart-toolbar">
      <div class="chart-toolbar-group">
        <label>View <select data-chart-control="mode">
          <option value="grouped" ${defaultMode==="grouped"?"selected":""}>Grouped bars</option>
          <option value="stacked" ${defaultMode==="stacked"?"selected":""}>Stacked bars</option>
          <option value="percent" ${defaultMode==="percent"?"selected":""}>100% stacked</option>
          <option value="horizontal" ${defaultMode==="horizontal"?"selected":""}>Horizontal bars</option>
          <option value="line" ${defaultMode==="line"?"selected":""}>Line</option>
          <option value="area" ${defaultMode==="area"?"selected":""}>Area</option>
        </select></label>
        <label>Sort <select data-chart-control="sort"><option value="original">Original</option><option value="desc">Largest first</option><option value="asc">Smallest first</option></select></label>
        <label>Show <select data-chart-control="top"><option value="0">All</option><option value="10">Top 10</option><option value="20">Top 20</option><option value="50">Top 50</option></select></label>
        <label>Filter <input type="search" data-chart-control="search" placeholder="labels…"></label>
        ${dateKey ? `<label>From <input type="date" data-chart-control="date-from"></label><label>To <input type="date" data-chart-control="date-to"></label><label>Aggregate <select data-chart-control="aggregate"><option value="original">Original</option><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Year</option></select></label>` : ""}
        <label>Threshold <input type="number" step="any" data-chart-control="threshold" value="${threshold ?? ""}" placeholder="optional"></label>
        <label>Height <select data-chart-control="height"><option value="1">Standard</option><option value="1.4">Tall</option><option value="1.8">Very tall</option></select></label>
        <label>Zoom <select data-chart-control="zoom"><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option></select></label>
        <label class="chart-check"><input type="checkbox" data-chart-control="labels"> Values</label>
        <label class="chart-check"><input type="checkbox" data-chart-control="average"> Average</label>
        <label class="chart-check"><input type="checkbox" data-chart-control="rotate" ${rotateLabels ? "checked" : ""}> Rotate labels</label>
      </div>
      <div class="chart-toolbar-group chart-toolbar-actions">
        <button class="btn compact" type="button" data-chart-action="reset">Reset</button>
        <button class="btn compact" type="button" data-chart-action="fullscreen">Full screen</button>
        <button class="btn compact" type="button" data-chart-action="csv">CSV</button>
        <button class="btn compact" type="button" data-chart-action="svg">SVG</button>
        <button class="btn compact" type="button" data-chart-action="png">PNG</button>
      </div>
    </div>
    ${title ? `<h3 class="chart-workbench-title">${esc(title)}</h3>` : ""}
    ${legend(series)}
    <div class="chart-selection muted" aria-live="polite">Click a bar/point to inspect its value.</div>
    <div class="chart-canvas" aria-live="polite"></div>
    <script type="application/json" class="chart-source">${jsonForHtml(payload)}</script>
  </div>`;
}

function payloadFor(root) {
  try { return JSON.parse(root.querySelector(".chart-source")?.textContent || "{}"); } catch { return {}; }
}
function visibleSeries(root, payload) {
  return (payload.series || []).map((s, i) => ({ ...s, _index: i }))
    .filter((_, i) => root.querySelector(`[data-chart-series="${i}"]`)?.checked !== false);
}
function dateBucket(value, mode) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (mode === "day") return { key: d.toISOString().slice(0,10), label: d.toISOString().slice(0,10) };
  if (mode === "week") {
    const x = new Date(Date.UTC(y,m,d.getUTCDate()));
    const day = (x.getUTCDay()+6)%7; x.setUTCDate(x.getUTCDate()-day+4);
    const wy=x.getUTCFullYear(), jan4=new Date(Date.UTC(wy,0,4)), janDay=(jan4.getUTCDay()+6)%7; jan4.setUTCDate(jan4.getUTCDate()-janDay+4);
    const week=1+Math.round((x-jan4)/604800000); return {key:`${wy}-W${String(week).padStart(2,"0")}`,label:`${wy}-W${String(week).padStart(2,"0")}`};
  }
  if (mode === "month") return { key: `${y}-${String(m+1).padStart(2,"0")}`, label: `${y}-${String(m+1).padStart(2,"0")}` };
  if (mode === "quarter") return { key: `${y}-Q${Math.floor(m/3)+1}`, label: `${y} Q${Math.floor(m/3)+1}` };
  if (mode === "year") return { key: String(y), label: String(y) };
  return null;
}
function aggregateDateRows(rows, payload, activeSeries, mode) {
  if (!payload.dateKey || mode === "original") return rows;
  const buckets = new Map();
  for (const x of rows) {
    const b = dateBucket(x.row[payload.dateKey], mode);
    if (!b) continue;
    if (!buckets.has(b.key)) {
      const row = { [payload.dateKey]: x.row[payload.dateKey] };
      for (const s of activeSeries) row[s.key] = 0;
      buckets.set(b.key, { row, index: x.index, label: b.label });
    }
    const out = buckets.get(b.key);
    for (const s of activeSeries) out.row[s.key] = n(out.row[s.key]) + n(x.row[s.key]);
  }
  return [...buckets.values()];
}

function orderedRows(root, payload, activeSeries) {
  let rows = (payload.rows || []).map((row, index) => ({ row, index, label: payload.xLabels?.[index] ?? row[payload.labelKey] ?? String(index) }));
  const search = String(root.querySelector('[data-chart-control="search"]')?.value || "").trim().toLowerCase();
  if (search) rows = rows.filter(x => String(x.label).toLowerCase().includes(search));
  if (payload.dateKey) {
    const from = root.querySelector('[data-chart-control="date-from"]')?.value || "";
    const to = root.querySelector('[data-chart-control="date-to"]')?.value || "";
    if (from) rows = rows.filter(x => String(x.row[payload.dateKey] || "") >= from);
    if (to) rows = rows.filter(x => String(x.row[payload.dateKey] || "") <= to);
  }
  rows = aggregateDateRows(rows, payload, activeSeries, root.querySelector('[data-chart-control="aggregate"]')?.value || "original");
  const total = x => activeSeries.reduce((sum, s) => sum + Math.abs(n(x.row[s.key])), 0);
  const sort = root.querySelector('[data-chart-control="sort"]')?.value || "original";
  if (sort === "desc") rows.sort((a, b) => total(b) - total(a));
  if (sort === "asc") rows.sort((a, b) => total(a) - total(b));
  const top = Number(root.querySelector('[data-chart-control="top"]')?.value || 0);
  if (top > 0) rows = rows.slice(0, top);
  return rows;
}
function rangeFor(values, includeZero = true) {
  const clean = values.filter(Number.isFinite);
  let min = clean.length ? Math.min(...clean) : 0, max = clean.length ? Math.max(...clean) : 1;
  if (includeZero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (Math.abs(max - min) < 1e-9) { max += 1; min -= min === 0 ? 0 : 1; }
  return { min, max, span: max - min };
}
function gridLines(range, left, right, top, plotH, width) {
  return Array.from({ length: 5 }, (_, i) => {
    const y = top + i / 4 * plotH, val = range.max - i / 4 * range.span;
    const cls = Math.abs(val) < range.span / 1000 ? "chart-grid chart-zero" : "chart-grid";
    return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" class="${cls}"/><text x="5" y="${y+3}" class="chart-axis-label">${Number(val).toFixed(Math.abs(val)<10?1:0)}</text>`;
  }).join("");
}

function renderVertical(root, payload, rows, series, mode) {
  const width = Math.round((payload.width || 900) * Number(root.querySelector('[data-chart-control="zoom"]')?.value || 1)), height = Math.round((payload.height || 300) * Number(root.querySelector('[data-chart-control="height"]')?.value || 1)), rotate = !!root.querySelector('[data-chart-control="rotate"]')?.checked;
  const left = 52, right = 18, top = 22, bottom = rotate ? 88 : 46, plotH = height - top - bottom, plotW = width - left - right;
  const percentMode = mode === "percent", stacked = mode === "stacked" || percentMode;
  const rowTotals = new Map(rows.map(x => [x.index, series.reduce((sum,s)=>sum+Math.abs(n(x.row[s.key])),0) || 1]));
  const normalized = (x,s) => percentMode ? n(x.row[s.key]) / rowTotals.get(x.index) * 100 : n(x.row[s.key]);
  const values = rows.flatMap(x => series.map(s => normalized(x,s)));
  let range;
  if (stacked) {
    const pos = rows.map(x => series.reduce((sum,s)=>sum+Math.max(0,normalized(x,s)),0));
    const neg = rows.map(x => series.reduce((sum,s)=>sum+Math.min(0,normalized(x,s)),0));
    range = rangeFor([...pos,...neg]);
  } else range = rangeFor(values);
  const yAt = v => top + (range.max - v) / range.span * plotH, zeroY = yAt(0);
  const groupW = plotW / Math.max(1, rows.length), barW = stacked ? Math.max(3, groupW * .62) : Math.max(2, groupW / Math.max(2, series.length + .5));
  const labelsOn = !!root.querySelector('[data-chart-control="labels"]')?.checked, bars=[];
  rows.forEach((x,i)=>{
    let posBase=0, negBase=0;
    series.forEach((s,j)=>{
      const raw=n(x.row[s.key]), v=normalized(x,s);
      let from=0,to=v;
      if(stacked){ if(v>=0){from=posBase;to=posBase+v;posBase=to;} else {from=negBase;to=negBase+v;negBase=to;} }
      const y1=yAt(from), y2=yAt(to), by=Math.min(y1,y2), h=Math.max(0.6,Math.abs(y2-y1));
      const bx=stacked?left+i*groupW+(groupW-barW)/2:left+i*groupW+j*barW+barW*.22, bw=stacked?barW:Math.max(1,barW*.68);
      bars.push(`<g class="chart-bar-group" data-chart-row="${x.index}" data-chart-series-key="${esc(s.key)}" data-chart-value="${raw}" data-chart-label="${esc(x.label)}"><rect x="${bx}" y="${by}" width="${bw}" height="${h}" rx="2" class="chart-bar chart-series-${s._index%6}"><title>${esc(x.label)} · ${esc(s.label||s.name||s.key)}: ${raw.toFixed(2)}${esc(payload.valueSuffix||"")}</title></rect>${labelsOn&&raw?`<text x="${bx+bw/2}" y="${raw>=0?Math.max(10,by-3):Math.min(height-bottom-2,by+h+11)}" text-anchor="middle" class="chart-value-label">${percentMode?`${v.toFixed(0)}%`:raw.toFixed(Math.abs(raw)%1?1:0)}</text>`:""}</g>`);
    });
  });
  const step=Math.max(1,Math.ceil(rows.length/16));
  const labels=rows.map((x,i)=>i%step===0?`<text x="${left+i*groupW+groupW/2}" y="${height-bottom+18}" class="chart-axis-label chart-x-label" text-anchor="${rotate?"start":"middle"}" ${rotate?`transform="rotate(90 ${left+i*groupW+groupW/2} ${height-bottom+18})"`:""}>${esc(String(x.label).slice(0,24))}</text>`:"").join("");
  const threshold = Number(root.querySelector('[data-chart-control="threshold"]')?.value);
  const thresholdLine = Number.isFinite(threshold) && root.querySelector('[data-chart-control="threshold"]')?.value !== "" ? `<line x1="${left}" y1="${yAt(threshold)}" x2="${width-right}" y2="${yAt(threshold)}" class="chart-threshold-line"/><text x="${width-right-4}" y="${yAt(threshold)-4}" text-anchor="end" class="chart-threshold-label">Threshold ${threshold}</text>` : "";
  const showAverage = !!root.querySelector('[data-chart-control="average"]')?.checked;
  const avg = values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0;
  const averageLine = showAverage ? `<line x1="${left}" y1="${yAt(avg)}" x2="${width-right}" y2="${yAt(avg)}" class="chart-average-line"/><text x="${width-right-4}" y="${yAt(avg)-4}" text-anchor="end" class="chart-average-label">Average ${avg.toFixed(2)}</text>` : "";
  return `<svg class="svg-chart${rotate?" rotated-axis":""}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${gridLines(range,left,right,top,plotH,width)}<line x1="${left}" y1="${zeroY}" x2="${width-right}" y2="${zeroY}" class="chart-zero-line"/>${thresholdLine}${averageLine}${bars.join("")}${labels}</svg>`;
}

function renderHorizontal(root,payload,rows,series){
  const width=Math.round((payload.width||900)*Number(root.querySelector('[data-chart-control="zoom"]')?.value||1)),rowH=Math.max(30,series.length*12+12),height=Math.max(260,rows.length*rowH+60)*Number(root.querySelector('[data-chart-control="height"]')?.value||1),left=190,right=28,top=18,plotW=width-left-right;
  const range=rangeFor(rows.flatMap(x=>series.map(s=>n(x.row[s.key])))), xAt=v=>left+(v-range.min)/range.span*plotW, zeroX=xAt(0), barH=Math.max(5,(rowH-6)/Math.max(1,series.length));
  const labelsOn=!!root.querySelector('[data-chart-control="labels"]')?.checked,parts=[`<line x1="${zeroX}" y1="0" x2="${zeroX}" y2="${height-30}" class="chart-zero-line"/>`];
  rows.forEach((x,i)=>{const y0=top+i*rowH;parts.push(`<text x="${left-8}" y="${y0+rowH/2+4}" text-anchor="end" class="chart-axis-label">${esc(String(x.label).slice(0,28))}</text>`);series.forEach((s,j)=>{const v=n(x.row[s.key]),x0=xAt(Math.min(0,v)),x1=xAt(Math.max(0,v)),w=Math.max(.6,x1-x0),y=y0+3+j*barH;parts.push(`<g class="chart-bar-group" data-chart-row="${x.index}" data-chart-series-key="${esc(s.key)}" data-chart-value="${v}" data-chart-label="${esc(x.label)}"><rect x="${x0}" y="${y}" width="${w}" height="${Math.max(3,barH-2)}" rx="2" class="chart-bar chart-series-${s._index%6}"><title>${esc(x.label)} · ${esc(s.label||s.name||s.key)}: ${v.toFixed(2)}${esc(payload.valueSuffix||"")}</title></rect>${labelsOn&&v?`<text x="${v>=0?x1+4:x0-4}" y="${y+barH-4}" text-anchor="${v>=0?"start":"end"}" class="chart-value-label">${v.toFixed(Math.abs(v)%1?1:0)}</text>`:""}</g>`);});});
  const threshold = Number(root.querySelector('[data-chart-control="threshold"]')?.value);
  if (Number.isFinite(threshold) && root.querySelector('[data-chart-control="threshold"]')?.value !== "") { const tx=xAt(threshold); parts.unshift(`<line x1="${tx}" y1="0" x2="${tx}" y2="${height-30}" class="chart-threshold-line"/><text x="${tx+4}" y="14" class="chart-threshold-label">Threshold ${threshold}</text>`); }
  if (root.querySelector('[data-chart-control="average"]')?.checked) { const vals=rows.flatMap(x=>series.map(s=>n(x.row[s.key]))), avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0, ax=xAt(avg); parts.unshift(`<line x1="${ax}" y1="0" x2="${ax}" y2="${height-30}" class="chart-average-line"/><text x="${ax+4}" y="28" class="chart-average-label">Average ${avg.toFixed(2)}</text>`); }
  return `<svg class="svg-chart horizontal-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${parts.join("")}</svg>`;
}

function renderLineArea(root,payload,rows,series,area=false){
  const width=Math.round((payload.width||900)*Number(root.querySelector('[data-chart-control="zoom"]')?.value||1)),height=Math.round((payload.height||300)*Number(root.querySelector('[data-chart-control="height"]')?.value||1)),rotate=!!root.querySelector('[data-chart-control="rotate"]')?.checked,left=52,right=18,top=22,bottom=rotate?88:46,plotH=height-top-bottom,plotW=width-left-right;
  const range=rangeFor(rows.flatMap(x=>series.map(s=>n(x.row[s.key])))), yAt=v=>top+(range.max-v)/range.span*plotH, xAt=i=>left+(rows.length===1?.5:i/Math.max(1,rows.length-1))*plotW, zeroY=yAt(0), labelsOn=!!root.querySelector('[data-chart-control="labels"]')?.checked;
  const shapes=series.map(s=>{const pts=rows.map((x,i)=>`${xAt(i)},${yAt(n(x.row[s.key]))}`).join(" ");const fillPts=area?`${left},${zeroY} ${pts} ${xAt(rows.length-1)},${zeroY}`:"";const poly=area?`<polygon points="${fillPts}" class="chart-area chart-series-${s._index%6}"/>`:"";const line=`<polyline points="${pts}" fill="none" class="chart-line chart-series-${s._index%6}" stroke-width="2.5"/>`;const points=rows.map((x,i)=>{const v=n(x.row[s.key]);return `<g class="chart-bar-group" data-chart-row="${x.index}" data-chart-series-key="${esc(s.key)}" data-chart-value="${v}" data-chart-label="${esc(x.label)}"><circle cx="${xAt(i)}" cy="${yAt(v)}" r="4" class="chart-point chart-series-${s._index%6}"><title>${esc(x.label)} · ${esc(s.label||s.name||s.key)}: ${v.toFixed(2)}${esc(payload.valueSuffix||"")}</title></circle>${labelsOn?`<text x="${xAt(i)}" y="${yAt(v)-7}" text-anchor="middle" class="chart-value-label">${v.toFixed(Math.abs(v)%1?1:0)}</text>`:""}</g>`}).join("");return poly+line+points;}).join("");
  const step=Math.max(1,Math.ceil(rows.length/16)), labels=rows.map((x,i)=>i%step===0?`<text x="${xAt(i)}" y="${height-bottom+18}" class="chart-axis-label chart-x-label" text-anchor="${rotate?"start":"middle"}" ${rotate?`transform="rotate(90 ${xAt(i)} ${height-bottom+18})"`:""}>${esc(String(x.label).slice(0,24))}</text>`:"").join("");
  const threshold = Number(root.querySelector('[data-chart-control="threshold"]')?.value);
  const thresholdLine = Number.isFinite(threshold) && root.querySelector('[data-chart-control="threshold"]')?.value !== "" ? `<line x1="${left}" y1="${yAt(threshold)}" x2="${width-right}" y2="${yAt(threshold)}" class="chart-threshold-line"/><text x="${width-right-4}" y="${yAt(threshold)-4}" text-anchor="end" class="chart-threshold-label">Threshold ${threshold}</text>` : "";
  const vals=rows.flatMap(x=>series.map(s=>n(x.row[s.key]))), avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
  const averageLine=root.querySelector('[data-chart-control="average"]')?.checked?`<line x1="${left}" y1="${yAt(avg)}" x2="${width-right}" y2="${yAt(avg)}" class="chart-average-line"/><text x="${width-right-4}" y="${yAt(avg)-4}" text-anchor="end" class="chart-average-label">Average ${avg.toFixed(2)}</text>`:"";
  return `<svg class="svg-chart${rotate?" rotated-axis":""}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${gridLines(range,left,right,top,plotH,width)}<line x1="${left}" y1="${zeroY}" x2="${width-right}" y2="${zeroY}" class="chart-zero-line"/>${thresholdLine}${averageLine}${shapes}${labels}</svg>`;
}

function renderChart(root) {
  const payload=payloadFor(root),series=visibleSeries(root,payload),rows=orderedRows(root,payload,series),mode=root.querySelector('[data-chart-control="mode"]')?.value||"grouped",canvas=root.querySelector(".chart-canvas");
  if(!series.length){canvas.innerHTML='<div class="empty-state">Select at least one chart series.</div>';return;}
  if(!rows.length){canvas.innerHTML='<div class="empty-state">No chart rows after filtering.</div>';return;}
  if(mode==="horizontal")canvas.innerHTML=renderHorizontal(root,payload,rows,series);
  else if(mode==="line"||mode==="area")canvas.innerHTML=renderLineArea(root,payload,rows,series,mode==="area");
  else canvas.innerHTML=renderVertical(root,payload,rows,series,mode);
  canvas.querySelectorAll(".chart-bar-group").forEach(g=>g.addEventListener("click",()=>{
    const detail={rowIndex:Number(g.dataset.chartRow),label:g.dataset.chartLabel,seriesKey:g.dataset.chartSeriesKey,value:Number(g.dataset.chartValue)};
    const readout=root.querySelector(".chart-selection"); if(readout) readout.textContent=`Selected: ${detail.label} · ${detail.seriesKey} = ${detail.value}${payload.valueSuffix||""}`;
    root.dispatchEvent(new CustomEvent("chartselect",{bubbles:true,detail}));
  }));
  // Date charts support a lightweight drag-to-focus gesture. Drag horizontally
  // across the plot and the From/To controls are populated from the nearest
  // visible rows. This avoids a heavyweight chart dependency while retaining
  // the common analytical workflow of narrowing a time window directly.
  if (payload.dateKey && ["grouped","stacked","percent","line","area"].includes(mode)) {
    const svg = canvas.querySelector("svg");
    let dragStart = null;
    svg?.addEventListener("pointerdown", e => { dragStart = { x: e.clientX, pointerId: e.pointerId }; svg.setPointerCapture?.(e.pointerId); });
    svg?.addEventListener("pointerup", e => {
      if (!dragStart || Math.abs(e.clientX - dragStart.x) < 12 || !rows.length) { dragStart = null; return; }
      const box = svg.getBoundingClientRect(), clamp = v => Math.max(0, Math.min(1, v));
      const f1 = clamp((dragStart.x - box.left) / Math.max(1, box.width)), f2 = clamp((e.clientX - box.left) / Math.max(1, box.width));
      const i1 = Math.min(rows.length - 1, Math.floor(Math.min(f1,f2) * rows.length));
      const i2 = Math.min(rows.length - 1, Math.floor(Math.max(f1,f2) * rows.length));
      const dates = [rows[i1]?.row?.[payload.dateKey], rows[i2]?.row?.[payload.dateKey]].map(v => { const d=new Date(v); return Number.isNaN(d.getTime())?"":d.toISOString().slice(0,10); }).filter(Boolean).sort();
      if (dates.length) {
        const from = root.querySelector('[data-chart-control="date-from"]'), to = root.querySelector('[data-chart-control="date-to"]');
        if (from) from.value = dates[0]; if (to) to.value = dates.at(-1);
        renderChart(root);
      }
      dragStart = null;
    });
  }
}

function exportCsv(root){const payload=payloadFor(root),active=visibleSeries(root,payload),rows=orderedRows(root,payload,active),q=v=>`"${String(v??"").replace(/"/g,'""')}"`;const csv=[["Label",...active.map(s=>s.label||s.name||s.key)],...rows.map(x=>[x.label,...active.map(s=>x.row[s.key]??0)])].map(r=>r.map(q).join(",")).join("\n");downloadBlob(new Blob([csv],{type:"text/csv"}),"chart-data.csv");}
function svgMarkup(root){const svg=root.querySelector(".chart-canvas svg");return svg?`<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`:"";}
function exportSvg(root){const markup=svgMarkup(root);if(markup)downloadBlob(new Blob([markup],{type:"image/svg+xml"}),"chart.svg");}
async function exportPng(root){const svg=root.querySelector(".chart-canvas svg");if(!svg)return;const box=svg.viewBox?.baseVal||{width:900,height:300};const blob=new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg.outerHTML}`],{type:"image/svg+xml"}),url=URL.createObjectURL(blob),img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});const scale=Math.max(1,Math.min(2,window.devicePixelRatio||1)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(box.width*scale));canvas.height=Math.max(1,Math.round(box.height*scale));const ctx=canvas.getContext("2d");ctx.scale(scale,scale);ctx.fillStyle=getComputedStyle(root).backgroundColor||"white";ctx.fillRect(0,0,box.width,box.height);ctx.drawImage(img,0,0,box.width,box.height);const out=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));if(out)downloadBlob(out,"chart.png");}finally{URL.revokeObjectURL(url);}}

export function bindInteractiveCharts(scope=document){
  scope.querySelectorAll?.(".chart-workbench").forEach(root=>{
    if(root.dataset.bound==="1")return;root.dataset.bound="1";
    root.querySelectorAll("select[data-chart-control], input[data-chart-control], input[data-chart-series]").forEach(el=>el.addEventListener("change",()=>renderChart(root)));
    root.querySelector('[data-chart-control="search"]')?.addEventListener("input",()=>renderChart(root));
    root.querySelector('[data-chart-action="reset"]')?.addEventListener("click",()=>{root.querySelector('[data-chart-control="mode"]').value="grouped";root.querySelector('[data-chart-control="sort"]').value="original";root.querySelector('[data-chart-control="top"]').value="0";root.querySelector('[data-chart-control="labels"]').checked=false;root.querySelector('[data-chart-control="average"]').checked=false;root.querySelector('[data-chart-control="rotate"]').checked=!!payloadFor(root).rotateLabels;root.querySelector('[data-chart-control="search"]').value="";root.querySelector('[data-chart-control="date-from"]')&&(root.querySelector('[data-chart-control="date-from"]').value="");root.querySelector('[data-chart-control="date-to"]')&&(root.querySelector('[data-chart-control="date-to"]').value="");root.querySelector('[data-chart-control="threshold"]').value=payloadFor(root).threshold??"";root.querySelector('[data-chart-control="height"]').value="1";root.querySelector('[data-chart-control="zoom"]').value="1";root.querySelector('[data-chart-control="aggregate"]')&&(root.querySelector('[data-chart-control="aggregate"]').value="original");root.querySelectorAll("[data-chart-series]").forEach(x=>x.checked=true);renderChart(root);});
    root.querySelector('[data-chart-action="fullscreen"]')?.addEventListener("click",async()=>{if(document.fullscreenElement)await document.exitFullscreen?.();else await root.requestFullscreen?.();});
    root.querySelector('[data-chart-action="csv"]')?.addEventListener("click",()=>exportCsv(root));
    root.querySelector('[data-chart-action="svg"]')?.addEventListener("click",()=>exportSvg(root));
    root.querySelector('[data-chart-action="png"]')?.addEventListener("click",()=>exportPng(root));
    renderChart(root);
  });
}
