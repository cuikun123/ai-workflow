// Bounded evidence for this suite's explicit runNode adapter; arbitrary JS is not
// inferred to be executed, safe, or authentic. Other MCP forms remain unknown.
import {eventEvidence} from './events.mjs';
export function collectStateCommands(stdout){
  const commands=[...eventEvidence(stdout).commands];
  for(const line of stdout.split('\n').filter(Boolean)){
    let event;try{event=JSON.parse(line);}catch{continue;}const item=event.item;
    if(event.type!=='item.completed'||item?.type!=='mcp_tool_call'||item.server!=='node_repl'||item.tool!=='js'||item.status!=='completed'||item.error)continue;
    const code=item.arguments?.code||'',invoked=new Set();
    for(const match of code.matchAll(/\brunNode\s*\(\s*\[\s*(['"])\.ai-workflow\/bin\/iterlane\.mjs\1\s*,\s*(['"])(check|status|transition|validate|doctor|recover)\2/gu))invoked.add(match[3]);
    const visit=(value,depth=0)=>{if(depth>12)return;if(Array.isArray(value)){for(const v of value)visit(v,depth+1);return;}if(!value||typeof value!=='object')return;
      if(Array.isArray(value.args)&&value.args[0]==='.ai-workflow/bin/iterlane.mjs'&&invoked.has(value.args[1])&&value.args.every(a=>typeof a==='string')&&Number.isInteger(value.exitCode)&&typeof value.stdout==='string')commands.push({command:'node '+value.args.join(' '),exitCode:value.exitCode,output:value.stdout,evidence_form:'bounded_node_repl_runNode_result'});
      else for(const v of Object.values(value))visit(v,depth+1);
    };
    for(const content of item.result?.content||[])if(content.type==='text'&&content.text.length<=4*1024*1024)try{visit(JSON.parse(content.text));}catch{/* Unrecognized output stays unknown. */}
  }
  return commands;
}
