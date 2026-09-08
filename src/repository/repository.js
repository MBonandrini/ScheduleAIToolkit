
import {db,ensureProject,listProjects,createProject,setActiveProject,deleteProject} from "./db.js";
import {uid} from "../core/utils.js";
import {parseScheduleOffThread} from "../workers/client.js";

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
export async function selectedContext({maxFileChars=750000,maxTotalChars=4000000}={}){
  const files=await checkedFiles(),blocks=[];let total=0;
  for(const f of files){
    if(total>=maxTotalChars)break;
    const ext=(f.name.split(".").pop()||"").toLowerCase();
    if(!TEXT_EXT.has(ext)){blocks.push(`[FILE ${f.name}] Binary file selected; use module parser/tooling for its structured content.`);continue}
    let blob=f.blob;
    if(!blob&&f.folderKey){
      const handle=folderHandles.get(f.folderKey);if(handle)blob=await resolveHandleFile(handle,f.relativePath);
    }
    if(!blob){blocks.push(`[FILE ${f.name}] File reference unavailable until the linked folder is re-authorized.`);continue}
    try{
      const text=(await blob.text()).slice(0,Math.min(maxFileChars,maxTotalChars-total));
      blocks.push(`PROJECT FILE\nNAME: ${f.name}\nCATEGORY: ${f.category}\nPATH: ${f.relativePath}\n\n${text}\n\nEND PROJECT FILE`);
      total+=text.length;
    }catch(e){blocks.push(`[FILE ${f.name}] Could not read: ${e.message}`)}
  }
  return {files,text:blocks.join("\n\n")};
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
