
import assert from "node:assert/strict";
import {parseXERTables,parseXER} from "../src/parsers/xer.js";
export async function run({quick=false}={}){
  const count=quick?100:500;
  for(let i=0;i<count;i++){
    const rows=[];const n=Math.floor(Math.random()*30);
    for(let j=0;j<n;j++){
      const kind=["%T","%F","%R","junk",""][Math.floor(Math.random()*5)];
      rows.push(`${kind}\t${Math.random().toString(36).slice(2)}\t${Math.random().toString(36).slice(2)}`);
    }
    const text=rows.join("\n");
    assert.doesNotThrow(()=>parseXERTables(text));
    try{parseXER(text,`fuzz-${i}.xer`)}catch(e){assert.ok(e instanceof Error)}
  }
  return `fuzz-${count}`;
}
