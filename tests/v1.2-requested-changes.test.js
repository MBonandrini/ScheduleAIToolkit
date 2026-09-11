import assert from "node:assert/strict";
import fs from "node:fs";import path from "node:path";
import {createSchedule,hydrateSchedule,isMilestoneActivity} from "../src/core/model.js";
import {DEFAULT_AI_VALUE} from "../src/ai/catalog.js";
const root=path.resolve(new URL("..",import.meta.url).pathname),read=p=>fs.readFileSync(path.join(root,p),"utf8");
export async function run(){
  const html=read("index.html"),app=read("src/ui/app.js"),css=read("assets/app.css"),bat=read("setup-ollama.bat");
  assert.equal(DEFAULT_AI_VALUE,"none");
  assert.ok(html.includes('id="aiDisplay"')&&html.includes('readonly'));
  assert.ok(app.includes('settingsAiSelect')&&app.includes('applyAiModel'));
  assert.ok(app.includes('e.key==="Enter"&&!e.shiftKey')&&app.includes('chatSend').valueOf());
  assert.ok(app.includes('resizeKey:"criticalPath"')&&css.includes('.col-resizer')&&css.includes('.virtual-resizer'));
  assert.ok(app.includes('pcai.activityRegisterWidths')&&app.includes('pcai.tableWidths.${wrap.dataset.resizeKey}'));
  assert.ok(css.includes('.col-resizer::after')&&css.includes('html.resizing-column'));
  assert.ok(app.includes('Pass / Fail')&&app.includes('badge("PASS"')&&app.includes('badge("FAIL"'));
  assert.ok(!app.includes('Nodes & Links'));
  const schedule=createSchedule({activities:[
    {id:"M1",name:"Start",task_type:"TT_Mile",total_float_hr_cnt:24},
    {id:"M2",name:"Finish",task_type:"TT_FinMile",total_float_hr_cnt:24},
    {id:"M3",name:"Start 2",task_type:"TT_StartMile",total_float_hr_cnt:24},
    {id:"A1",name:"Normal",task_type:"TT_Task",total_float_hr_cnt:24}
  ]});
  assert.deepEqual(schedule.activities.map(a=>a.milestone),[true,true,true,false]);
  const legacy=hydrateSchedule({wbs:[],calendars:[],assignments:[],activities:[
    {id:"LM1",activityType:"",milestone:false,raw:{task_type:"TT_Mile"},totalFloat:5},
    {id:"LM2",activityType:"",milestone:false,raw:{task_type:"TT_FinMile"},totalFloat:5},
    {id:"A2",activityType:"",milestone:false,raw:{task_type:"TT_Task"},totalFloat:5}
  ]});
  assert.deepEqual(legacy.activities.map(a=>a.milestone),[true,true,false]);
  assert.equal(isMilestoneActivity({milestone:"0",raw:{task_type:"TT_Task"}}),false);
  assert.ok(app.includes('(await listSchedules()).map(hydrateSchedule)'));
  assert.ok(app.includes('costTreeMarkup')&&css.includes('.cost-node')&&css.includes('.cost-activity'));
  assert.ok(app.includes('applyProfile')&&app.includes('pcai.profile'));
  assert.ok(app.includes('Set up Ollama on Windows')&&/v=1\.3\.0/.test(html));
  assert.ok(bat.includes('winget install --id Ollama.Ollama')&&bat.includes('OLLAMA_ORIGINS')&&bat.includes('ollama pull'));
  return "v1.2-requested-changes";
}
