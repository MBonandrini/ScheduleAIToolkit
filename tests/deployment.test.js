
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(new URL("..",import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]);
}
function resolveImport(from,spec){
  if(!spec.startsWith("."))return null;
  const p=path.resolve(path.dirname(from),spec);
  return path.extname(p)?p:`${p}.js`;
}
export async function run(){
  const html=read("index.html");
  const localAssets=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(x=>!/^https?:|^\/\//.test(x)&&!x.startsWith("#"));
  for(const asset of localAssets){
    const clean=asset.replace(/^\.\//,"").split("?")[0];
    assert.ok(fs.existsSync(path.join(root,clean)),`Missing HTML asset: ${asset}`);
    assert.ok(!asset.startsWith("/"),`Root-absolute asset would break project GitHub Pages: ${asset}`);
  }

  const jsFiles=walk(path.join(root,"src")).filter(x=>x.endsWith(".js"));
  for(const file of jsFiles){
    const text=fs.readFileSync(file,"utf8");
    for(const m of text.matchAll(/(?:import|export)\s+(?:[^"'`]+?\s+from\s+)?["']([^"']+)["']/g)){
      const dep=resolveImport(file,m[1]);if(dep)assert.ok(fs.existsSync(dep),`Broken import ${m[1]} in ${path.relative(root,file)}`);
    }
    for(const m of text.matchAll(/new URL\(["']([^"']+)["'],\s*import\.meta\.url\)/g)){
      const dep=path.resolve(path.dirname(file),m[1]);assert.ok(fs.existsSync(dep),`Broken worker/URL dependency ${m[1]} in ${path.relative(root,file)}`);
    }
  }

  assert.ok(fs.existsSync(path.join(root,".nojekyll")),".nojekyll is required for predictable GitHub Pages static serving");
  assert.ok(fs.existsSync(path.join(root,"404.html")));
  assert.ok(!html.includes('href="/"')&&!html.includes('src="/"'));
  assert.ok(!/fetch\(\s*["']\//.test(jsFiles.map(readFile).join("\n")),"Root-relative server API fetch found");
  assert.ok(read("404.html").includes("location.replace('./')"));

  const app=read("src/ui/app.js"),ollama=read("src/ai/ollama.js");
  assert.ok(app.includes("Check Ollama"));
  assert.ok(app.includes("OLLAMA_ORIGINS"));
  assert.ok(ollama.includes("Ollama was not detected"));
  assert.ok(ollama.includes("likelyNotInstalled"));
  assert.ok(ollama.includes("127.0.0.1"));

  return "deployment";
}
function readFile(f){return fs.readFileSync(f,"utf8")}
