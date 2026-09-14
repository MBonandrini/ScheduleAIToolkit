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
  assert.ok(index.includes("v=1.5.1"),"GitHub Pages assets should be cache-bumped to v1.5.1");
  return "v1.5.1 builder cleanup";
}
