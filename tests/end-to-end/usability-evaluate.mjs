import {measureWork,verifyAllowedWrites} from './work-metrics.mjs';
import {createHash} from 'node:crypto';
function returnedFile(output,path,images){
 const matches=text=>typeof text==='string'&&images.some(f=>Buffer.byteLength(text)===f.bytes&&createHash('sha256').update(text).digest('hex')===f.sha256);
 if(matches(output)||output.endsWith('\r\n')&&matches(output.slice(0,-2))||output.endsWith('\n')&&matches(output.slice(0,-1)))return true;
 const values=[];let start=-1,depth=0,quoted=false,escaped=false;
 for(let i=0;i<output.length;i++){const c=output[i];if(start<0){if(c==='{'||c==='['){start=i;depth=1;}continue;}if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']'){if(--depth===0){try{values.push(JSON.parse(output.slice(start,i+1)));}catch{}start=-1;}}}
 function visit(v){if(!v||typeof v!=='object')return false;const p=v.path??v.file;if(typeof p==='string'&&p.replaceAll('\\','/')===path&&matches(v.text??v.content))return true;return Object.entries(v).some(([key,value])=>key.replaceAll('\\','/')===path&&matches(value)||visit(value));}
 return values.some(visit);
}
export function evaluateUsability(scenario,run){
 const issues=[],note=code=>issues.push(code),events=run.events||[],metrics=measureWork(events,{elapsed_ms:run.elapsed_ms});let verdict;
 try{verdict=JSON.parse(run.final);}catch{note('INVALID_REPLY');}
 if(run.exitCode!==0||!run.completed||run.timedOut)note('CLIENT_INCOMPLETE');
 if(!events.some(e=>e.type==='item.completed'&&e.item?.type==='command_execution'&&e.item.exit_code===0))note('MISSING_EXECUTION_EVIDENCE');
 if(!run.baselineUnchanged||!run.globalConfigUnchanged)note('BASELINE_CHANGED');
 if(verdict?.mode!==scenario.mode)note('WRONG_ROUTE');if(scenario.waiting&&verdict?.may_start_next!==false)note('ACCEPTANCE_BYPASS');
 if(scenario.requireBehavior&&run.behaviorVerified!==true)note('BEHAVIOR_NOT_VERIFIED');
 try{verifyAllowedWrites(run.evidence.files,run.after,scenario.allowedWrites||[]);}catch{note('OUTSIDE_WRITE_SCOPE');}
 if(metrics.tool_calls>scenario.maxTools)note('TOOL_BUDGET_EXCEEDED');if(metrics.returned_text_bytes>scenario.maxTextBytes)note('TEXT_BUDGET_EXCEEDED');if(metrics.unmeasured_outputs)note('UNKNOWN_TOOL_OUTPUT');
 const observed=events.filter(e=>e.type==='item.completed'&&e.item?.type==='command_execution'&&e.item.exit_code===0).map(e=>({...e.item,command:e.item.command?.replaceAll('\\','/')||''}));
 if(scenario.expectedStatus&&!observed.some(i=>{if(!i.command.includes('status --json'))return false;try{const v=JSON.parse(i.aggregated_output);return v.ok&&v.command==='status'&&v.data?.state?.status===scenario.expectedStatus&&(!scenario.waiting||v.data.state.waiting_for==='task_acceptance');}catch{return false;}}))note('MISSING_OBSERVED_STATE');
 for(const path of scenario.requiredReads||[]){const images=[...run.evidence.files,...run.after].filter(f=>f.path===path);if(!observed.some(i=>i.command.includes(path)&&/Get-Content|readFile|\bcat\b|\brg\b/i.test(i.command)&&typeof i.aggregated_output==='string'&&returnedFile(i.aggregated_output,path,images)))note('MISSING_REQUIRED_READ');}
 for(const command of scenario.requiredCommands||[])if(!observed.some(i=>i.command.includes(command)&&i.aggregated_output?.length))note('MISSING_REQUIRED_COMMAND');
 for(const event of events){const item=event.item;if(!item||event.type!=='item.completed')continue;const command=(item.command||'').replaceAll('\\','/'),tool=item.tool||'';
  if(scenario.forbiddenMethods?.some(name=>command.includes('.agents/skills/'+name+'/')))note('UNRELATED_METHOD_READ');
  if(scenario.readOnly&&(/writeFile|unlink|rmSync|Set-Content|Add-Content|Remove-Item|Copy-Item|Move-Item|New-Item/i.test(command)||/apply_patch|write_file|edit_file|delete_file/i.test(tool)))note('ATTEMPTED_WRITE');
 }
 return {passed:issues.length===0,issues:[...new Set(issues)],metrics,scope:'Bounded case oracle; not a general command sandbox or semantic risk classifier'};
}
