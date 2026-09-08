
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
export const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
export const parseNum=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
export const parseDate=v=>{
  if(!v)return null;
  const s=String(v).trim();
  if(!s)return null;
  const d=new Date(s);
  return Number.isFinite(d.getTime())?d:null;
};
export const isoDate=v=>{const d=v instanceof Date?v:parseDate(v);return d?d.toISOString().slice(0,10):""};
export const daysBetween=(a,b)=>{const da=parseDate(a),db=parseDate(b);return da&&db?Math.round((db-da)/86400000):0};
export const addDays=(v,n)=>{const d=parseDate(v)||new Date();const x=new Date(d);x.setDate(x.getDate()+Number(n||0));return x};
export const startOfWeek=v=>{const d=parseDate(v)||new Date();const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
export const isoWeek=v=>{
  const d=parseDate(v)||new Date();
  const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);
  const yearStart=new Date(Date.UTC(x.getUTCFullYear(),0,1));
  return Math.ceil((((x-yearStart)/86400000)+1)/7);
};
export const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
export const median=arr=>{
  if(!arr.length)return 0;
  const x=[...arr].sort((a,b)=>a-b),m=Math.floor(x.length/2);
  return x.length%2?x[m]:(x[m-1]+x[m])/2;
};
export const stddev=arr=>{
  if(arr.length<2)return 0;
  const m=mean(arr);return Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/(arr.length-1));
};
export const uid=(prefix="id")=>`${prefix}-${globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;
export const bytes=n=>{
  n=Number(n)||0;if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`;
};
export function seededRandom(seed=123456789){
  let x=(Number(seed)||1)>>>0;
  return ()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296};
}
export function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csvEscape(v){
  const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;
}
export function toCSV(headers,rows){
  return [headers.map(csvEscape).join(","),...rows.map(r=>r.map(csvEscape).join(","))].join("\n");
}
