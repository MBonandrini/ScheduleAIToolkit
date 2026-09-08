
import assert from "node:assert/strict";
import fs from "node:fs";import path from "node:path";
import {esc,csvEscape} from "../src/core/utils.js";
const root=path.resolve(new URL("..",import.meta.url).pathname);
export async function run(){
  assert.equal(esc(`<img src=x onerror=alert(1)>`),"&lt;img src=x onerror=alert(1)&gt;");
  assert.equal(csvEscape(`a,"b"`),`"a,""b"""`);
  let prod="";
  for(const dir of ["src","index.html"]){
    const p=path.join(root,dir);
    if(fs.statSync(p).isFile())prod+=fs.readFileSync(p,"utf8");
    else for(const f of walk(p))if(f.endsWith(".js"))prod+=fs.readFileSync(f,"utf8");
  }
  assert.ok(!/OmniRoute/i.test(prod));
  assert.ok(!/eval\s*\(/.test(prod));
  assert.ok(!/api[_-]?key\s*[:=]\s*["'][^"']+["']/i.test(prod));
  return "security";
}
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)])}
