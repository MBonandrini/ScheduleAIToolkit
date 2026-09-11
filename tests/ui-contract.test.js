
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(new URL("..",import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
export async function run(){
  const html=read("index.html"),app=read("src/ui/app.js"),css=read("assets/app.css"),runtime=read("src/ai/runtime.js"),repo=read("src/repository/repository.js");
  for(const label of ["Dashboard","Contract Manager","Drawing Measurement","Schedule Assessment","Risk Analysis","Claims &amp; Forensics","NotebookLM+","Schedule Builder","Settings"])assert.ok(html.includes(label),label);
  assert.equal((html.match(/id="aiDisplay"/g)||[]).length,1);
  assert.equal((html.match(/id="aiSelect"/g)||[]).length,0);
  assert.ok(html.includes("Dark")&&html.includes("Light · Dark Blue Contrast"));assert.ok(!html.includes("Slate")&&!html.includes("Midnight")&&!html.includes("Sand"));
  assert.ok(!/tab-icon/.test(html));
  assert.ok(html.indexOf("Schedule Builder")<html.indexOf("Settings"));
  for(const feature of ["Planner's Inbox","Readiness","Why Did My Date Move?","Calendar Analyser","Weekly S-Curve","Weekly Histogram","Executive Schedule Narrative","Schedule Time Machine","Milestone Control Centre","Network graph intelligence","Data-centre lifecycle readiness"])assert.ok(app.includes(feature),feature);
  assert.ok(css.includes(".gantt-panel{background:#fff!important"));
  assert.ok(css.includes(".bar.critical{background:#c83932"));
  assert.ok(app.includes("Virtualised activity register"));
  assert.ok(repo.includes("checked:true")&&repo.includes("selectedContext"));
  assert.ok(runtime.includes("toolRegistry")&&runtime.includes("inferTool"));
  assert.ok(read("src/workers/schedule-worker.js").includes("self.onmessage"));
  assert.ok(read("src/workers/montecarlo-worker.js").includes("self.onmessage"));
  // GitHub Pages: relative local assets and no server-only routes.
  for(const src of [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(x=>!x.startsWith("http")))assert.ok(src.startsWith("./")||src.startsWith("#"),`non-relative asset ${src}`);
  assert.ok(fs.existsSync(path.join(root,".nojekyll")));
  return "ui-contract";
}
