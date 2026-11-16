import {isDeepStrictEqual} from 'node:util';
export function assertMatchingRecord(existing,expected){if(!isDeepStrictEqual(existing,expected))throw Error('Existing record differs from actual candidate/source/coverage');return true;}
export function verifyAllowedWrites(before,after,allowed){
 const prior=new Map(before.map(f=>[f.path,f])),next=new Map(after.map(f=>[f.path,f]));
 for(const f of before)if(!next.has(f.path))throw Error('Project file removed: '+f.path);
 const changed=after.filter(f=>!prior.has(f.path)||prior.get(f.path).sha256!==f.sha256||prior.get(f.path).bytes!==f.bytes).map(f=>f.path);
 for(const path of changed)if(!allowed.includes(path))throw Error('Unallowed project write: '+path);
 return changed;
}
export function measureWork(events,{elapsed_ms=null}={}){
 const completed=new Map();let final='';const usages=[];
 for(const [index,e]of events.entries()){
  if(e.type==='item.completed'&&e.item){const key=e.item.id??'event-'+index;if(completed.has(key)&&!isDeepStrictEqual(completed.get(key),e.item))throw Error('Conflicting completed item '+key);completed.set(key,e.item);if(e.item.type==='agent_message')final=e.item.text||'';}
  if(e.type==='turn.completed')usages.push(e.usage??null);
 }
 let tool_calls=0,returned_text_bytes=0,unmeasured_outputs=0,input_request_tools=0;
 for(const item of completed.values()){
  if(!['command_execution','mcp_tool_call','web_search','collab_tool_call'].includes(item.type))continue;tool_calls++;
  if(/request_user_input|ask_user_question/.test(item.tool||''))input_request_tools++;
  if(item.type==='command_execution'&&typeof item.aggregated_output==='string')returned_text_bytes+=Buffer.byteLength(item.aggregated_output);
  else if(item.type==='mcp_tool_call'&&Array.isArray(item.result?.content)){let unknown=false;for(const block of item.result.content){if(block.type==='text'&&typeof block.text==='string')returned_text_bytes+=Buffer.byteLength(block.text);else unknown=true;}if(unknown)unmeasured_outputs++;}
  else unmeasured_outputs++;
 }
 const sum=key=>usages.length&&usages.every(u=>Number.isSafeInteger(u?.[key])&&u[key]>=0)?usages.reduce((n,u)=>n+u[key],0):null;
 const reported_usage=usages.length?Object.fromEntries(['input_tokens','cached_input_tokens','output_tokens'].map(k=>[k,sum(k)])):null;
 return {tool_calls,returned_text_bytes,unmeasured_outputs,input_request_tools,final_question_marks:(final.match(/[?？]/g)||[]).length,questions_need_manual_review:true,reported_usage,raw_usage:usages,elapsed_ms};
}
