
import assert from "node:assert/strict";
import {syntheticXER} from "./helpers.js";

class StorageMock{
  constructor(){this.m=new Map()}
  getItem(k){return this.m.has(k)?this.m.get(k):null}
  setItem(k,v){this.m.set(k,String(v))}
  removeItem(k){this.m.delete(k)}
  clear(){this.m.clear()}
}
globalThis.localStorage=new StorageMock();
globalThis.window=globalThis;

class FakeIDB{
  constructor(){this.databases=new Map()}
  open(name,version){
    const req={result:null,error:null,onupgradeneeded:null,onsuccess:null,onerror:null};
    queueMicrotask(()=>{
      let rec=this.databases.get(name);
      const oldVersion=rec?.version||0;
      if(!rec){rec={version:0,stores:new Map()};this.databases.set(name,rec)}
      const db={
        objectStoreNames:{contains:n=>rec.stores.has(n)},
        createObjectStore:(n,{keyPath="id"}={})=>{
          if(!rec.stores.has(n))rec.stores.set(n,{keyPath,data:new Map()});
          return {};
        },
        transaction:(storeName,mode="readonly")=>{
          const tx={oncomplete:null,onerror:null,onabort:null,error:null};
          const store=rec.stores.get(storeName);if(!store)throw new Error(`Missing store ${storeName}`);
          let pending=0,completeQueued=false;
          const complete=()=>{if(pending===0&&!completeQueued){completeQueued=true;queueMicrotask(()=>tx.oncomplete?.())}};
          const request=(work)=>{
            const r={result:undefined,error:null,onsuccess:null,onerror:null};pending++;
            queueMicrotask(()=>{
              try{r.result=work();r.onsuccess?.()}catch(e){r.error=e;tx.error=e;r.onerror?.();tx.onerror?.()}
              pending--;complete();
            });
            return r;
          };
          const objectStore=()=>({
            put:value=>request(()=>{const key=value[store.keyPath];store.data.set(key,structuredClone(value));return key}),
            get:key=>request(()=>{const v=store.data.get(key);return v===undefined?undefined:structuredClone(v)}),
            getAll:()=>request(()=>[...store.data.values()].map(v=>structuredClone(v))),
            delete:key=>request(()=>store.data.delete(key)),
            clear:()=>request(()=>store.data.clear())
          });
          tx.objectStore=objectStore;queueMicrotask(complete);return tx;
        }
      };
      req.result=db;
      if(version>oldVersion){rec.version=version;req.onupgradeneeded?.()}
      queueMicrotask(()=>req.onsuccess?.());
    });
    return req;
  }
}
globalThis.indexedDB=new FakeIDB();

export async function run(){
  const repo=await import("../src/repository/repository.js");

  const p1=await repo.currentProject();
  assert.equal(p1.name,"Untitled Project");
  await repo.renameProject("Perun");
  assert.equal((await repo.currentProject()).name,"Perun");

  const xer=new File([syntheticXER(20,35)],"perun 3.xer",{type:"text/plain",lastModified:Date.now()});
  const txt=new File(["Project instruction: energisation is priority."],"instruction.txt",{type:"text/plain"});
  await repo.addFiles([xer,txt],{category:"Programme"});
  let files=await repo.listFiles(),schedules=await repo.listSchedules();
  assert.equal(files.length,2);
  assert.equal(schedules.length,1);
  assert.equal(schedules[0].activities.length,20);
  assert.equal(files.every(x=>x.checked),true);

  const ctx=await repo.selectedContext();
  assert.ok(ctx.text.includes("perun 3.xer"));
  assert.ok(ctx.text.includes("Project instruction: energisation is priority."));

  await repo.setFileChecked(files.find(x=>x.name==="instruction.txt").id,false);
  const ctx2=await repo.selectedContext();
  assert.ok(ctx2.text.includes("perun 3.xer"));
  assert.ok(!ctx2.text.includes("Project instruction: energisation is priority."));

  const p2=await repo.newProject("Second Project");
  assert.notEqual(p2.id,p1.id);
  assert.equal((await repo.listFiles()).length,0);
  assert.equal((await repo.listSchedules()).length,0);

  await repo.addFiles([new File(["hello"],"second.txt",{type:"text/plain"})],{category:"Other"});
  assert.equal((await repo.listFiles()).length,1);

  await repo.switchProject(p1.id);
  files=await repo.listFiles();schedules=await repo.listSchedules();
  assert.equal(files.length,2);
  assert.equal(schedules.length,1);

  const risks=await repo.listRisks();assert.equal(risks.length,0);
  await repo.saveRisk({title:"Risk one",activityIds:["A000001"]});
  assert.equal((await repo.listRisks()).length,1);
  await repo.saveClaim({title:"Claim event",activityIds:["A000001"]});
  assert.equal((await repo.listClaims()).length,1);

  const remove=files.find(x=>x.name==="perun 3.xer");
  await repo.removeFile(remove.id);
  assert.equal((await repo.listSchedules()).length,0);

  return "repository-integration";
}
