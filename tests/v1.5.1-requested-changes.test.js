import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");
export async function run(){
  const app=read("src/ui/app.js"),index=read("index.html");
  assert.ok(app.includes('id="builderRemoveAll"'),"Schedule Builder should expose Remove all");
  assert.ok(app.includes("Remove all ${state.builderRows.length} generated activities?"),"Remove all should require confirmation");
  assert.ok(app.includes("state.builderRows=[]")&&app.includes("localStorage.setItem('pcai.builder','[]')"),"Remove all should clear and persist activities");
  const builderStart=app.indexOf("function renderBuilder()"),builderEnd=app.indexOf("function renderSettings",builderStart);
  const builderBlock=app.slice(builderStart,builderEnd>builderStart?builderEnd:app.length);
  assert.ok(!builderBlock.includes('chatMarkup("builder"'),"Schedule Builder should not render a chat panel");
  assert.ok(!builderBlock.includes("bindChat('builder'"),"Schedule Builder should not bind chat handlers");
  const versions=[...index.matchAll(/v=(\d+)\.(\d+)\.(\d+)/g)].map(m=>m.slice(1).map(Number));
  assert.ok(versions.length&&versions.every(v=>v[0]>1||v[1]>5||(v[1]===5&&v[2]>=1)),"GitHub Pages assets should remain cache-bumped to v1.5.1 or newer");
  return "v1.5.1 builder cleanup";
}
