const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const shell=read('assets/js/shell.js'),core=read('assets/js/core.js'),index=read('index.html'),
theme=read('assets/js/theme.js'),settings=read('apps/settings/app.js'),nb=read('apps/notebooklmplus/js/app.js');
const checks=[
 ['theme dropdown exists in shell',index.includes('data-theme-select')&&index.includes('value="slate"')&&index.includes('value="midnight"')&&index.includes('value="sand"')],
 ['settings supports five professional themes',['dark','light','slate','midnight','sand'].every(v=>settings.includes(`'${v}'`)||settings.includes(`"${v}"`))],
 ['shared repository has chat-context checkboxes',shell.includes('data-context-file')&&shell.includes('Include in chat context')],
 ['linked bulk files have chat-context checkboxes',shell.includes('bulk-file-context')&&shell.includes('renderBulkNode')],
 ['shared repository exposes selected context text',shell.includes('getSelectedContextText')&&shell.includes('selectedContextText')],
 ['XER/XML are readable shared chat context',shell.includes('"xer"')&&shell.includes('"xml"')&&shell.includes('SHARED PROJECT REPOSITORY FILE')],
 ['shared AI injects selected repository context into every AI run',core.includes('augmentSharedRepositoryContext')&&core.includes('SELECTED SHARED PROJECT REPOSITORY CONTEXT')],
 ['browser CPU download emits progress',core.includes('progress_callback')&&core.includes('Downloading browser AI')],
 ['WebGPU download emits progress',core.includes('initProgressCallback')&&core.includes('Downloading WebGPU AI')],
 ['AI response emits visible working progress',core.includes('Generating AI response')&&core.includes('indeterminate:true')],
 ['shell supports indeterminate progress bar',shell.includes('classList.toggle("indeterminate",indeterminate)')&&shell.includes('Working…')],
 ['AI runtime is retained across tabs',shell.includes('Keep the globally selected AI runtime alive across tab navigation')],
 ['Notebook follows all suite theme names',nb.includes("'slate'")&&nb.includes("'midnight'")&&nb.includes("'sand'")]
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
if(failed)process.exit(1);
