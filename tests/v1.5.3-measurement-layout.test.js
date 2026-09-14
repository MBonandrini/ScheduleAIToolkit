import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");
export async function run(){
  const app=read("src/ui/app.js"),css=read("assets/app.css"),index=read("index.html");
  const start=app.indexOf("function renderDrawing()"),end=app.indexOf("function assessmentNav()",start),block=app.slice(start,end);
  assert.ok(block.includes("Drawings to be measured"),"Measurement page should provide the drawings source box");
  assert.ok(block.includes(">BOQ<")||block.includes("<h2>BOQ</h2>"),"Measurement page should provide the BOQ box");
  assert.ok(block.includes("NEW BOQ Document"),"BOQ chooser should provide NEW BOQ Document");
  assert.ok(app.includes('const BOQ_EXT=/\\.(csv|xls|xlsx)$/i'),"Only CSV/XLS/XLSX should be valid existing BOQ targets");
  assert.ok(block.includes('data-drawing-file'),"Drawing tree should support multi-select file checkboxes");
  assert.ok(block.includes('data-boq-file'),"BOQ tree should support single-select file radios");
  assert.ok(block.includes('id="measurementGenerate"')&&block.includes(">Generate</button>"),"Measurement source block should expose Generate");
  assert.ok(block.includes("Measurement & allocation settings"),"Settings/configuration should sit below source selection");
  assert.ok(block.includes("Measurement & allocation register"),"Existing editable measurement register should remain available");
  assert.ok(!block.includes('chatMarkup("drawing"')&&!block.includes('bindChat("drawing"'),"Measurement chat/conversation panel must be removed");
  assert.ok(app.includes("fileTreeData")&&app.includes("relativePath"),"Measurement trees should retain repository folder hierarchy");
  assert.ok(css.includes(".measurement-source-grid")&&css.includes(".measurement-tree-file.disabled"),"Measurement page should have dedicated two-pane/tree styling including disabled non-BOQ files");
  const versions=[...index.matchAll(/(?:app\.css|app\.js)\?v=(\d+)\.(\d+)\.(\d+)/g)].map(m=>m.slice(1).map(Number));
  assert.ok(versions.length>=2&&versions.every(v=>v[0]>1||v[1]>5||(v[1]===5&&v[2]>=3)),"GitHub Pages assets should remain cache-bumped to v1.5.3 or newer");
  return "v1.5.3 measurement workflow layout";
}
