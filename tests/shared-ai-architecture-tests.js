const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=read('assets/js/core.js');
const notebook=read('apps/notebooklmplus/js/app.js');
const notebookHtml=read('apps/notebooklmplus/index.html');
const modules=[
 'apps/contract-manager/app.js','apps/drawing-measurement/app.js',
 'apps/schedule-assessment/app.js','apps/risk-analysis/app.js',
 'apps/claims-forensics/app.js','apps/schedule-builder/app.js'
].map(read).join('\n');
const checks=[
 ['no model-loading confirmation prompt',!core.includes('Continue loading this model')&&!core.includes('Local AI loading was cancelled')],
 ['settings owns module model lifecycle',!/ProjectControlsCore\.ai\.ensure|Core\.ai\.ensure/.test(modules)],
 ['modules execute through shared runtime',/core\.ai\.run|ProjectControlsCore\.ai\.run|Core\.ai\.run/.test(modules)],
 ['Notebook chat uses shared runtime',notebook.includes('streamSuiteAiChat')&&notebook.includes('core.ai.run(messages')],
 ['Notebook does not require local chat model before send',!notebook.includes("openTab('ollama')")],
 ['Notebook first paint is dark',/<html[^>]+data-theme="dark"[^>]+dark-mode/.test(notebookHtml)],
 ['Notebook follows parent theme messages',notebook.includes("event.data?.type === 'pc-theme'")&&notebook.includes("dataset.theme = value")]
];
let bad=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)bad++}
if(bad)process.exit(1);
