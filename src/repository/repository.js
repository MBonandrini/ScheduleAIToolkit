
import {db,ensureProject,listProjects,createProject,setActiveProject,deleteProject} from "./db.js?v=1.2.0";
import {uid} from "../core/utils.js?v=1.2.0";
import {parseScheduleOffThread} from "../workers/client.js?v=1.2.0";

const TEXT_EXT=new Set(["txt","md","csv","tsv","json","xml","xer","html","htm","log","ini","yaml","yml","sql"]);
let folderHandles=new Map();

export async function currentProject(){return await ensureProject()}
export async function projects(){return await listProjects()}
export async function newProject(name){return await createProject(name)}
export async function switchProject(id){return await setActiveProject(id)}
export async function removeProject(id){return await deleteProject(id)}
export async function restoreFolderHandles(){
  folderHandles.clear();
  const p=await ensureProject(),folders=(await db.all("folders")).filter(x=>x.projectId===p.id);
  for(const f of folders)if(f.handle)folderHandles.set(f.id,f.handle);
  return folders;
}
export async function renameProject(name){
  const p=await ensureProject();p.name=String(name||"Untitled Project").trim()||"Untitled Project";p.updatedAt=new Date().toISOString();await db.put("projects",p);return p;
}
export async function addFiles(files,{category="Other",checked=true,source="upload",relativePath=""}={}){
  const project=await ensureProject(),out=[];
  for(const file of Array.from(files||[])){
    const rec={id:uid("file"),projectId:project.id,name:file.name,size:file.size||0,type:file.type||"",category,checked,source,relativePath:relativePath||file.webkitRelativePath||file.name,blob:file,lastModified:file.lastModified||Date.now(),createdAt:new Date().toISOString()};
    await db.put("files",rec);out.push(rec);
    if(/\.(xer|xml)$/i.test(file.name)){
      try{
        const parsed=await parseScheduleOffThread(file);
        for(const s of parsed.schedules){s.id=uid("schedule");s.projectId=project.id;s.sourceFileId=rec.id;s.sourceName=file.name;await db.put("schedules",s)}
      }catch(error){rec.parseError=error.message;await db.put("files",rec)}
    }
  }
  return out;
}
export async function listFiles(){const p=await ensureProject();return (await db.all("files")).filter(x=>x.projectId===p.id)}
export async function listSchedules(){const p=await ensureProject();return (await db.all("schedules")).filter(x=>x.projectId===p.id)}
export async function setFileChecked(id,checked){const f=await db.get("files",id);if(!f)return;f.checked=!!checked;await db.put("files",f)}
export async function removeFile(id){
  await db.del("files",id);
  for(const s of await db.all("schedules"))if(s.sourceFileId===id)await db.del("schedules",s.id);
}
export async function checkedFiles(){return (await listFiles()).filter(f=>f.checked)}

function queryTerms(question){
  return [...new Set(String(question||"").toLowerCase().match(/[a-z0-9][a-z0-9_.-]{2,}/g)||[])]
    .filter(x=>!["what","about","current","project","schedule","schedules","please","could","would","think","with","from","this","that"].includes(x))
    .slice(0,20);
}
function relevantExcerpt(text,question,maxChars){
  const raw=String(text||"");
  if(raw.length<=maxChars)return raw;
  const terms=queryTerms(question);
  if(!terms.length)return raw.slice(0,maxChars);
  const lower=raw.toLowerCase(),windows=[];
  for(const term of terms){
    let pos=0,hits=0;
    while((pos=lower.indexOf(term,pos))>=0&&hits++<8){
      const start=Math.max(0,pos-700),end=Math.min(raw.length,pos+term.length+1300);
      windows.push([start,end]);pos+=term.length;
    }
  }
  if(!windows.length)return raw.slice(0,maxChars);
  windows.sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const w of windows){
    const last=merged.at(-1);
    if(last&&w[0]<=last[1]+120)last[1]=Math.max(last[1],w[1]);else merged.push([...w]);
  }
  let out="";
  for(const [a,b] of merged){
    const piece=raw.slice(a,b);
    if(out.length+piece.length>maxChars){out+=piece.slice(0,maxChars-out.length);break}
    out+=(out?"\n…\n":"")+piece;
    if(out.length>=maxChars)break;
  }
  return out.slice(0,maxChars);
}
export async function selectedContext({
  maxFileChars=12000,maxTotalChars=36000,question="",skipScheduleText=true
}={}){
  const files=await checkedFiles(),blocks=[];let total=0;
  for(const f of files){
    if(total>=maxTotalChars)break;
    const ext=(f.name.split(".").pop()||"").toLowerCase();
    const isSchedule=ext==="xer"||ext==="xml";
    const meta=`FILE: ${f.name}\nCATEGORY: ${f.category}\nPATH: ${f.relativePath}\nSIZE: ${f.size||0} bytes`;
    if(isSchedule&&skipScheduleText){
      blocks.push(`${meta}\nTYPE: Parsed schedule file — use structured schedule evidence supplied separately.`);
      continue;
    }
    if(!TEXT_EXT.has(ext)){blocks.push(`${meta}\nTYPE: Binary/non-text project evidence.`);continue}
    let blob=f.blob;
    if(!blob&&f.folderKey){
      const handle=folderHandles.get(f.folderKey);if(handle)blob=await resolveHandleFile(handle,f.relativePath);
    }
    if(!blob){blocks.push(`${meta}\nSTATUS: Linked file unavailable until the folder is re-authorized.`);continue}
    try{
      const raw=await blob.text(),remaining=Math.max(0,maxTotalChars-total);
      const excerpt=relevantExcerpt(raw,question,Math.min(maxFileChars,remaining));
      blocks.push(`PROJECT FILE EXCERPT\n${meta}\n\n${excerpt}\n\nEND PROJECT FILE EXCERPT`);
      total+=excerpt.length;
    }catch(e){blocks.push(`${meta}\nSTATUS: Could not read: ${e.message}`)}
  }
  return {files,text:blocks.join("\n\n"),textChars:total};
}
async function resolveHandleFile(root,path){
  const parts=String(path||"").split("/").filter(Boolean);let cur=root;
  for(let i=0;i<parts.length-1;i++)cur=await cur.getDirectoryHandle(parts[i]);
  return await (await cur.getFileHandle(parts.at(-1))).getFile();
}
async function indexDirectory(handle,prefix="",folderKey=null,rows=[]){
  for await(const [name,entry] of handle.entries()){
    if(name.startsWith("."))continue;
    const path=prefix?`${prefix}/${name}`:name;
    if(entry.kind==="directory")await indexDirectory(entry,path,folderKey,rows);
    else{
      const file=await entry.getFile();
      rows.push({file,path});
    }
  }
  return rows;
}
export async function linkFolder(){
  if(!window.showDirectoryPicker)throw new Error("This browser does not support persistent folder linking. Use the folder upload fallback.");
  const handle=await window.showDirectoryPicker({mode:"read"}),key=uid("folder"),project=await ensureProject();
  folderHandles.set(key,handle);
  try{await db.put("folders",{id:key,projectId:project.id,name:handle.name,handle,createdAt:new Date().toISOString()})}catch(_){}
  const rows=await indexDirectory(handle,"",key,[]);
  const saved=[];
  for(const {file,path} of rows){
    const rec={id:uid("file"),projectId:project.id,name:file.name,size:file.size,type:file.type,category:"Bulk Information",checked:true,source:"linked-folder",relativePath:path,folderKey:key,lastModified:file.lastModified,createdAt:new Date().toISOString()};
    await db.put("files",rec);saved.push(rec);
    if(/\.(xer|xml)$/i.test(file.name)){
      try{const parsed=await parseScheduleOffThread(file);for(const s of parsed.schedules){s.id=uid("schedule");s.projectId=project.id;s.sourceFileId=rec.id;s.sourceName=file.name;await db.put("schedules",s)}}catch(e){rec.parseError=e.message;await db.put("files",rec)}
    }
  }
  return {key,name:handle.name,count:saved.length};
}
export async function importFolderFallback(files){return await addFiles(files,{category:"Bulk Information",checked:true,source:"folder-upload"})}
export async function saveRisk(risk){const p=await ensureProject();risk={id:risk.id||uid("risk"),projectId:p.id,...risk};await db.put("risks",risk);return risk}
export async function listRisks(){const p=await ensureProject();return (await db.all("risks")).filter(x=>x.projectId===p.id)}
export async function saveClaim(claim){const p=await ensureProject();claim={id:claim.id||uid("claim"),projectId:p.id,...claim};await db.put("claims",claim);return claim}
export async function listClaims(){const p=await ensureProject();return (await db.all("claims")).filter(x=>x.projectId===p.id)}
