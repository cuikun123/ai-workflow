import {isDeepStrictEqual} from 'node:util';
import {evaluateRun} from '../codex-client/evaluate.mjs';
import {words} from '../codex-client/commands.mjs';
import {completeChunkReads} from './chunk-evidence.mjs';
function executableEnvironmentRead(command){
  let outer=words(command),source=command;if(/powershell(?:\.exe)?$/i.test(outer[0]||'')){const index=outer.findIndex(t=>t.toLowerCase()==='-command');source=outer[index+1]||command;}
  const snippets=[];for(const match of source.matchAll(/@'\r?\n([\s\S]*?)\r?\n'@/g))snippets.push(match[1]);
  if(!snippets.length){const tokens=words(source);for(let i=0;i<tokens.length-2;i++)if(/^node(?:\.exe)?$/i.test(tokens[i])&&tokens[i+1]==='-e')snippets.push(tokens[i+2]);}
  if(!snippets.length)return /process\.env|\$env:/i.test(source);
  return snippets.some(snippet=>{let code='',quote=null,line=false,block=false;for(let i=0;i<snippet.length;i++){const c=snippet[i],n=snippet[i+1];if(line){if(c==='\n')line=false;code+=' ';}else if(block){if(c==='*'&&n==='/'){i++;block=false;}code+=' ';}else if(quote){if(c==='\\')i++;else if(c===quote)quote=null;code+=' ';}else if(c==='/'&&n==='/'){i++;line=true;code+=' ';}else if(c==='/'&&n==='*'){i++;block=true;code+=' ';}else if(c==='"'||c==="'"){quote=c;code+=' ';}else if(c==='`'){return true;}else code+=c;}return /process\s*(?:\.\s*env|\[)/.test(code);});
}
// Bounded evidence recognizer. Unknown shell forms never count as execution.
export function installedCommand(command, action) {
  return scriptCommand(command,'.ai-workflow/bin/iterlane.mjs',action);
}
export function scriptCommand(command, script, action) {
  let tokens=words(command);
  if(/powershell(?:\.exe)?$/i.test(tokens[0]||'')){
    const i=tokens.findIndex(t=>t.toLowerCase()==='-command');
    if(i<0)return false;tokens=words(tokens[i+1]||'');
  }
  const statements=[];let statement=[];
  for(const token of tokens){if([';','|','\n'].includes(token)){statements.push(statement);statement=[];}else statement.push(token);}statements.push(statement);
  return statements.some(s=>/^node(?:\.exe)?$/i.test(s[0]||'')&&s[1]?.replaceAll('\\','/').replace(/^\.\//,'')===script&&(action===undefined||s[2]===action));
}
export function evaluateEndToEnd(scenario, run) {
  let changesValid=false;
  if(Array.isArray(scenario.allowedWrites)&&scenario.allowedWrites.length&&Array.isArray(run.after)&&Array.isArray(run.evidence?.files)){
    const before=run.evidence.files,after=run.after;
    const changed=after.filter(file=>!before.some(old=>old.path===file.path&&old.sha256===file.sha256&&old.bytes===file.bytes));
    const removed=before.filter(file=>!after.some(next=>next.path===file.path));
    changesValid=removed.length===0&&changed.every(file=>scenario.allowedWrites.includes(file.path));
  }
  const result=evaluateRun(scenario,changesValid?{...run,unchanged:true}:run),fail=name=>{if(!result.failures.includes(name))result.failures.push(name);};
  const chunks=completeChunkReads(run.commands||[],run.evidence?.files||[]),chunkSkills=chunks.map(p=>p.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/)?.[1]).filter(Boolean);result.file_reads=[...new Set([...result.file_reads,...chunks])];result.skill_reads=[...new Set([...result.skill_reads,...chunkSkills])];result.failures=result.failures.filter(f=>!f.startsWith('missing_file:')||!chunks.includes(f.slice(13)));if(chunkSkills.includes(scenario.requiredSkill))result.failures=result.failures.filter(f=>f!=='missing_skill_body');
  if(result.failures.includes('external_configuration_read')&&(run.commands||[]).every(c=>!/(?:\.codex[\\/]|client-home[\\/]|auth\.json|config\.toml|Env:)/i.test(c.command)&&!executableEnvironmentRead(c.command)))result.failures=result.failures.filter(f=>f!=='external_configuration_read');
  if(scenario.answerFormat==='text'){
    if(scenario.expected||scenario.answerIncludes)fail('text_answer_cannot_skip_expected_fields');
    else if(typeof run.final==='string'&&run.final.trim())result.failures=result.failures.filter(name=>name!=='structured_answer');
    else fail('missing_implementation_result');
  }
  if(scenario.allowedWrites&&!changesValid)fail('unallowed_or_unknown_changes');
  if(run.baselineUnchanged!==true)fail('changed_client_or_package');
  const trusted=run.evidence?.status;
  if(!trusted||trusted.exitCode!==0||trusted.value?.command!=='status')fail('missing_trusted_status');
  const observed=(run.commands||[]).some(c=>{
    if(c.exitCode!==0||!installedCommand(c.command,'status'))return false;
    let values=[];try{values=[JSON.parse(c.output)];}catch{for(const line of (c.output||'').split('\n'))try{values.push(JSON.parse(line));}catch{}}
    return values.some(value=>isDeepStrictEqual(value,trusted?.value));
  });
  if(!observed)fail('missing_matching_status_execution');
  result.ok=result.failures.length===0;return result;
}
