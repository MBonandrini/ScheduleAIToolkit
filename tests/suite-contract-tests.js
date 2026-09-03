const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
let failures=[];
function check(name,cond,detail=''){console.log((cond?'PASS ':'FAIL ')+name+(detail?` ${detail}`:''));if(!cond)failures.push(name)}
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const index=read('index.html'), shell=read('assets/js/shell.js'), core=read('assets/js/core.js'), aiOptions=read('assets/js/ai-options.js');
const settingsHtml=read('apps/settings/index.html'), settingsJs=read('apps/settings/app.js');
const notebookHtml=read('apps/notebooklmplus/index.html'), notebookApp=read('apps/notebooklmplus/js/app.js'), notebookAi=read('apps/notebooklmplus/js/ai.js');
const notebookCss=read('apps/notebooklmplus/css/styles.css'), assessmentApp=read('apps/schedule-assessment/app.js'), assessmentCss=read('apps/schedule-assessment/style.css');
const tabs=[...index.matchAll(/data-tool="([^"]+)"/g)].map(x=>x[1]);
const cfg={}; for(const m of shell.matchAll(/^\s*(\w+): \{ name: "([^"]+)", url: "([^"]+)" \}/gm)) cfg[m[1]]={name:m[2],url:m[3]};
check('all shell tabs have route configs',tabs.every(t=>cfg[t]),`tabs=${tabs.length} routes=${Object.keys(cfg).length}`);
check('all route configs have tabs',Object.keys(cfg).every(t=>tabs.includes(t)));
for(const [key,v] of Object.entries(cfg)){const clean=v.url.split('?')[0].replace(/^\.\//,'');check(`route exists: ${key}`,fs.existsSync(path.join(root,clean)),clean)}
check('single top-level Settings tab present',tabs.filter(x=>x==='settings').length===1);
check('standalone AI configuration tab removed',!tabs.includes('aiconfig'));
check('standalone Setup Tutorial tab removed',!tabs.includes('tutorial'));
check('legacy top-shell AI Settings button removed',!index.includes('id="aiSettingsButton"'));
check('NotebookLM+ tab present',tabs.includes('notebook'));
check('Settings is full-width workspace',/key==="settings"/.test(shell));
check('Settings contains General Settings section',/General Settings/.test(settingsHtml));
check('Settings contains Unified AI Configuration section',/Unified AI Configuration/.test(settingsHtml));
check('Settings contains Setup Tutorial section',/Setup Tutorial/.test(settingsHtml));
check('Settings persists official theme key',settingsJs.includes('projectControlsTheme'));
check('Settings manages global AI key through core',/Core\.ai\.setPreferred/.test(settingsJs));
check('Settings configures Ollama',/Core\.ai\.testOllamaConnection/.test(settingsJs)&&/Core\.ai\.inspectOllamaModels/.test(settingsJs));
check('Settings includes Ollama GitHub Pages origin guidance',/OLLAMA_ORIGINS/.test(settingsJs));
check('Core exposes one preferred AI selection',/function preferred\(/.test(core)&&/function setPreferred\(/.test(core)&&/preferredLabel/.test(core));
check('Ollama is enabled in shared catalog',/value:"ollama:auto",engine:"ollama"/.test(core));
check('Per-module AI selectors are removed', ['contract-manager','drawing-measurement','schedule-assessment','risk-analysis','claims-forensics','schedule-builder'].every(n=>!read(`apps/${n}/index.html`).includes('data-ai-model-select')&&!read(`apps/${n}/index.html`).includes('id="modelSelect"')));
const moduleApps=['contract-manager','drawing-measurement','schedule-assessment','risk-analysis','claims-forensics','schedule-builder'].map(n=>read(`apps/${n}/app.js`));
check('Only Settings owns global AI selection persistence',moduleApps.every(code=>!code.includes('localStorage.setItem(\"projectControlsSharedAIModel\"'))&&!notebookApp.includes('localStorage.setItem(\"projectControlsSharedAIModel\"'));
check('Notebook visible tabs are Workspace and Studio only',![...notebookHtml.matchAll(/<button class="tab[^>]*data-tab="([^"]+)"/g)].map(x=>x[1]).some(x=>['ollama','tutorial','settings'].includes(x)));
check('Notebook Suite Settings button removed',!notebookHtml.includes('Suite Settings')&&!notebookApp.includes('pc-open-settings'));
check('Notebook top performance dropdown removed',!notebookHtml.includes('id="modeSelect"'));
check('Notebook performance is centrally sourced',/projectControlsNotebookPerformanceMode/.test(notebookApp)&&/suitePerformanceMode/.test(notebookApp));
check('Settings owns Notebook performance selector',/notebookPerformanceSelect/.test(settingsJs)&&/projectControlsNotebookPerformanceMode/.test(settingsJs));
check('Settings restores advanced AI runtime configuration',/AI Runtime &amp; NotebookLM\+ advanced settings/.test(settingsJs)&&/projectControlsNotebookRuntimeConfig/.test(settingsJs)&&/nbContextTokens/.test(settingsJs)&&/nbFirstResponse/.test(settingsJs));
check('Notebook consumes central advanced configuration',/suiteNotebookRuntimeConfig/.test(notebookApp)&&/applySuiteNotebookRuntime/.test(notebookApp)&&/projectControlsNotebookRuntimeConfig/.test(notebookApp));

check('Settings exposes expanded reasoning and reliability controls',/nbThinkingTimeout/.test(settingsJs)&&/nbFallbackThinking/.test(settingsJs)&&/nbRetryCount/.test(settingsJs)&&/nbRetryDelay/.test(settingsJs)&&/nbGenerateFallback/.test(settingsJs));
check('Settings exposes expanded generation controls',/nbTopP/.test(settingsJs)&&/nbTopKSampling/.test(settingsJs)&&/nbRepeatPenalty/.test(settingsJs));
check('Invalid legacy Ollama keep alive is migrated',/rawKeepAlive!==keepAlive/.test(core)&&/sanitiseOllamaKeepAlive/.test(core)&&!/<option value="-1"/.test(settingsJs));
check('Ollama keep alive supports validated durations',/"default","0","5m","15m","30m","1h","2h","4h"/.test(core)&&/ollamaKeepAliveBody/.test(core));
check('Shared AI consumes central runtime timeouts and thinking settings',/aiRuntimeConfig/.test(core)&&/firstResponseTimeoutSeconds/.test(core)&&/requestTimeoutSeconds/.test(core)&&/thinkingMode/.test(core)&&/keepAlive/.test(core));
check('Settings exposes original NotebookLM+ timeout and retrieval controls',/nbRequestTimeout/.test(settingsJs)&&/nbFirstResponse/.test(settingsJs)&&/nbInactivity/.test(settingsJs)&&/nbKeepAlive/.test(settingsJs)&&/nbChunkSize/.test(settingsJs)&&/nbResearchTimeout/.test(settingsJs));
check('Notebook consumes central retrieval and research controls',/maxFileSizeMB/.test(notebookApp)&&/maxDiscoveryResults/.test(notebookApp)&&/researchTimeoutSeconds/.test(notebookApp)&&/webProxyEndpoint/.test(notebookApp));
check('Shell exposes global model selector',/id="globalModelSelect"/.test(index)&&/populateGlobalModelSelect/.test(shell)&&/setGlobalModel/.test(shell));
check('Legacy top-right AI status pill removed',!index.includes('id="status"'));
check('Dark theme is first-run default',/localStorage\.getItem\(key\)\|\|"dark"/.test(read('assets/js/theme.js')));
check('Settings tutorial includes central performance guidance',/CPU \/ No GPU/.test(settingsJs)&&/top-right AI Model dropdown/.test(settingsJs));
check('Notebook synchronises from global AI selection',/function syncSuiteAiToMode/.test(notebookApp)&&/projectControlsSharedAIModel/.test(notebookApp));
check('Notebook can use shared browser AI runtime',/suite-core/.test(notebookAi)&&/ProjectControlsCore/.test(notebookAi));
check('Notebook Ollama embedding model comes from suite settings',/ollamaEmbeddingModel/.test(notebookApp));
check('Obsolete standalone AI app removed',!fs.existsSync(path.join(root,'apps/ai-configuration')));
check('Obsolete standalone tutorial app removed',!fs.existsSync(path.join(root,'apps/tutorial')));
check('Puter absent from shared core',!/\bPuter\b/i.test(core));

check('Settings AI configuration is provider-contextual',/aiProviderSelect/.test(settingsJs)&&/providerEntries/.test(settingsJs)&&/aiProviderView/.test(settingsJs));
check('Settings tutorial is provider-contextual',/tutorialProviderSelect/.test(settingsJs)&&/tutorialContent/.test(settingsJs)&&/tutorialProviderView/.test(settingsJs));
check('Ollama settings separate chat and embedding models',/Only chat\/completion-capable models are shown/.test(settingsJs)&&/Embedding-only models belong here/.test(settingsJs));
check('Core classifies Ollama capabilities',/inspectOllamaModels/.test(core)&&/supportsChat/.test(core)&&/supportsEmbedding/.test(core)&&/\/api\/show/.test(core));
check('All AI modules consume global preference at execution time',moduleApps.every(code=>/\.ai\.preferred\(\)/.test(code)));



const userFacingAiSelectPatterns=[/id="modelSelect"/,/data-ai-model-select/,/id="aiAssistMode"/];
check('Exactly one user-facing AI/model selector exists outside Settings', (()=>{
  const pages=['contract-manager','drawing-measurement','schedule-assessment','risk-analysis','claims-forensics','schedule-builder'];
  return pages.every(n=>userFacingAiSelectPatterns.every(rx=>!rx.test(read(`apps/${n}/index.html`)))) && (index.match(/id="globalModelSelect"/g)||[]).length===1;
})());
check('Global progress HUD is present',/id="suiteProgress"/.test(index)&&/id="suiteProgressBar"/.test(index)&&/pc-progress/.test(shell));
check('Schedule import reports progress to shell',/reportProcessingProgress/.test(read('apps/schedule-assessment/app.js'))&&/pc-progress/.test(read('apps/schedule-assessment/app.js')));
check('Ollama has generate fallback for empty chat responses',/\/api\/generate/.test(core)&&/extractOllamaText/.test(core));

check('Bulk Information section present in shared pane',/id="bulkInformationTitle"/.test(index)&&/Bulk Information/.test(index));
check('Bulk Information exposes folder link action',/id="bulkLinkFolder"/.test(index)&&/showDirectoryPicker/.test(shell));
check('Bulk Information has directory-selection fallback',/id="bulkFolderFallbackInput"/.test(index)&&/webkitdirectory/.test(index)&&/addBulkFallbackFiles/.test(shell));
check('Bulk Information stores folder metadata separately',/SHARED_DB_VERSION=2/.test(shell)&&/createObjectStore\("folders"/.test(shell));
check('Bulk folders render as collapsible trees',/class="bulk-folder"/.test(shell)&&/bulk-tree-dir/.test(shell)&&/renderBulkNode/.test(shell));
check('Bulk linked folders can refresh without reimporting all content',/refreshBulkFolder/.test(shell)&&/queryPermission/.test(shell)&&/requestPermission/.test(shell));
check('Bulk folders can be safely unlinked',/unlinkBulkFolder/.test(shell)&&/No files on your computer will be deleted/.test(shell));
check('Bulk folders show a header cross remove control',/class=\"bulk-folder-remove\"/.test(shell)&&/data-bulk-unlink/.test(shell)&&/Remove linked folder/.test(shell));
check('Bulk files route through shared Use action',/data-bulk-use/.test(shell)&&/resolveBulkFile/.test(shell)&&/pc-use-shared-file/.test(shell));

check("NotebookLM+ Studio tab removed", !notebookHtml.includes('data-tab="studio"') && !notebookHtml.includes('id="tab-studio"'));
check("NotebookLM+ exposes shared repository source action", notebookHtml.includes('useSharedRepositoryBtn') && notebookApp.includes('addSharedRepositorySources'));
check("NotebookLM+ follows suite theme", notebookApp.includes("dataset.theme = value") && notebookCss.includes("--accent:#084B73"));
check("Schedule Assessment never prompts to restore last project", !assessmentApp.includes("Restore the last saved project"));
check("Schedule Assessment PDF uses automatic blob download", assessmentApp.includes('worker.outputPdf("blob")') && assessmentApp.includes("anchor.click()"));
check("Schedule Assessment export footer uses requested site address", assessmentApp.includes("https://mbonandrini.githib.io/ScheduleAIToolkit"));
check("Schedule Assessment Gantt export forced light", assessmentCss.includes(".pdf-export .gantt-pro") && assessmentCss.includes("background:#fff!important"));

if(failures.length){console.error('FAILURES:',failures);process.exit(1)}
