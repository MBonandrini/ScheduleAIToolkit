import {recommendActivityIds} from "../analysis/measurement-alignment.js";
import {csvObjects,toCSV} from "../core/utils.js";

const SHEETJS_URL="https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
export const RECOMMENDED_HEADER="Recommended Activity ID(s)";

function rowQuery(row){return Array.isArray(row)?row.filter(x=>x!==null&&x!==undefined).join(" "):Object.values(row||{}).filter(Boolean).join(" ")}
function alignedName(name){const m=String(name||"BOQ").match(/^(.*?)(\.[^.]+)?$/);return `${m?.[1]||"BOQ"}-aligned${m?.[2]||".csv"}`}
function detectHeaderRow(aoa){
  let best=0,bestScore=-1;for(let i=0;i<Math.min(20,aoa.length);i++){const row=(aoa[i]||[]).map(x=>String(x||"").toLowerCase()),filled=row.filter(Boolean).length,terms=row.filter(x=>/(item|description|desc|qty|quantity|unit|boq|code|ref)/.test(x)).length,score=terms*4+filled;if(score>bestScore){bestScore=score;best=i}}return best;
}
export async function alignBoqFile(file,index){
  const ext=(String(file?.name||"").split(".").pop()||"").toLowerCase();
  if(ext==="csv"){
    const text=await file.text(),rows=csvObjects(text);if(!rows.length)return {blob:new Blob([text],{type:"text/csv"}),name:alignedName(file.name),matched:0,total:0};
    const headers=[...new Set(rows.flatMap(r=>Object.keys(r)))];if(!headers.includes(RECOMMENDED_HEADER))headers.push(RECOMMENDED_HEADER);
    let matched=0;const body=rows.map(r=>{const ids=recommendActivityIds(rowQuery(r),index).join("; ");if(ids)matched++;return headers.map(h=>h===RECOMMENDED_HEADER?ids:(r[h]??""))});
    return {blob:new Blob([toCSV(headers,body)],{type:"text/csv"}),name:alignedName(file.name),matched,total:rows.length};
  }
  if(ext==="xls"||ext==="xlsx"){
    const XLSX=await import(SHEETJS_URL),wb=XLSX.read(await file.arrayBuffer(),{type:"array"}),sheetName=wb.SheetNames[0];if(!sheetName)throw new Error("The BOQ workbook contains no worksheets.");
    const aoa=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:"",raw:false}),hi=detectHeaderRow(aoa),headers=aoa[hi]||[];let ci=headers.findIndex(x=>String(x).trim()===RECOMMENDED_HEADER);if(ci<0){ci=headers.length;headers.push(RECOMMENDED_HEADER)}
    let matched=0,total=0;for(let i=hi+1;i<aoa.length;i++){const row=aoa[i]||[];if(!row.some(x=>String(x||"").trim()))continue;total++;const ids=recommendActivityIds(rowQuery(row),index).join("; ");row[ci]=ids;if(ids)matched++;aoa[i]=row}
    wb.Sheets[sheetName]=XLSX.utils.aoa_to_sheet(aoa);const bookType=ext==="xls"?"biff8":"xlsx",arr=XLSX.write(wb,{type:"array",bookType});
    return {blob:new Blob([arr],{type:ext==="xls"?"application/vnd.ms-excel":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),name:alignedName(file.name),matched,total};
  }
  throw new Error("Only CSV, XLS and XLSX BOQ files can be aligned.");
}
