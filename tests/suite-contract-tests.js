const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
let failures=[];
function check(name,cond,detail=''){console.log((cond?'PASS ':'FAIL ')+name+(detail?` ${detail}`:''));if(!cond)failures.push(name)}
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const shell=fs.readFileSync(path.join(root,'assets/js/shell.js'),'utf8');
const tabs=[...index.matchAll(/data-tool="([^"]+)"/g)].map(x=>x[1]);
const cfg={};
for(const m of shell.matchAll(/^\s*(\w+): \{ name: "([^"]+)", url: "([^"]+)" \}/gm)) cfg[m[1]]={name:m[2],url:m[3]};
check('all shell tabs have route configs',tabs.every(t=>cfg[t]),`tabs=${tabs.length} routes=${Object.keys(cfg).length}`);
check('all route configs have tabs',Object.keys(cfg).every(t=>tabs.includes(t)));
for(const [key,v] of Object.entries(cfg)){
  const clean=v.url.split('?')[0].replace(/^\.\//,'');
  check(`route exists: ${key}`,fs.existsSync(path.join(root,clean)),clean);
}
check('AI/Ollama Configuration tab present',tabs.includes('aiconfig'));
check('Setup Tutorial tab present',tabs.includes('tutorial'));
check('Settings tab present',tabs.includes('settings'));
check('NotebookLM+ tab present',tabs.includes('notebook'));
check('AI config hidden from shared repository pane',/key==="aiconfig"/.test(shell));
check('Settings hidden from shared repository pane',/key==="settings"/.test(shell));
const settings=fs.readFileSync(path.join(root,'apps/settings/app.js'),'utf8');
check('Settings persists official theme key',settings.includes('projectControlsTheme'));
check('Settings does not use obsolete theme key',!/localStorage\.setItem\(\"pc-theme\"/.test(settings));
const aiConfig=fs.readFileSync(path.join(root,'apps/ai-configuration/app.js'),'utf8');
check('AI config tests OmniRoute',aiConfig.includes('Core.ai.testConnection()'));
check('AI config detects Ollama models',aiConfig.includes('Core.ai.listOllamaModels()'));
check('AI config tests Ollama chat',aiConfig.includes('Core.ai.testOllamaConnection'));
const tutorial=fs.readFileSync(path.join(root,'apps/tutorial/app.js'),'utf8');
check('Tutorial includes Ollama setup',/OLLAMA_ORIGINS/.test(tutorial)&&/Detect models/.test(tutorial));
check('Tutorial includes OmniRoute setup',/OmniRoute/.test(tutorial)&&/testConnection/.test(tutorial));
const core=fs.readFileSync(path.join(root,'assets/js/core.js'),'utf8');
check('Ollama is enabled in shared catalog',/value:"ollama:auto",engine:"ollama"/.test(core));
check('OmniRoute remains default route',/omniroute:auto/.test(core));
check('Puter absent from shared core',!/\bPuter\b/i.test(core));
if(failures.length){console.error('FAILURES:',failures);process.exit(1)}
