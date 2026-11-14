import Ajv from 'ajv';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { analyzeCommand } from './commands.mjs';
import { outputSchema } from './cases.mjs';
import { parse } from 'yaml';
const validateAnswer=new Ajv({strict:false}).compile(outputSchema);
const normalize=text=>text.replace(/\r\n/g,'\n').trimEnd();
const hash=text=>createHash('sha256').update(text).digest('hex');
const slash=text=>text.replace(/\\+/g,'/');
function localPath(value,project){
  let file=slash(value),base=slash(project).replace(/\/$/,'');
  if(file.split('/').includes('..'))return null;
  if(/^(?:[a-z]:|\/)/i.test(file)){if(!file.toLowerCase().startsWith(base.toLowerCase()+'/'))return null;file=file.slice(base.length+1);}
  return file.replace(/^\.\//,'');
}
function documents(output,targets){
  const records=[];const visit=value=>{
    if(value&&typeof value==='object'){
      if(typeof (value.path??value.file)==='string'&&typeof (value.text??value.content)==='string')records.push({path:value.path??value.file,text:value.text??value.content});
      else for(const [key,child]of Object.entries(value)){if(typeof child==='string'&&targets.includes(key))records.push({path:key,text:child});else visit(child);}
    }else if(typeof value==='string'&&targets.length===1)records.push({path:targets[0],text:value});
  };
  try{visit(JSON.parse(output));}catch{for(const line of output.split('\n'))try{visit(JSON.parse(line));}catch{}}
  const lines=output.replace(/\r\n/g,'\n').split('\n'),label=line=>line.replace(/^FILE:\s*/,'');
  for(let index=0;index<lines.length;index++)if(targets.includes(label(lines[index]))){let end=index+1;while(end<lines.length&&!targets.includes(label(lines[end])))end++;records.push({path:label(lines[index]),text:lines.slice(index+1,end).join('\n')});}
  if(targets.length===1)records.push({path:targets[0],text:output});
  return records;
}
export function evaluateRun(scenario,run){
  const failures=[],fail=name=>{if(!failures.includes(name))failures.push(name);};
  for(const [key,expected]of Object.entries({exitCode:0,timedOut:false,completed:true,unchanged:true,globalConfigUnchanged:true,globalSkillsEnabled:0}))if(run[key]!==expected)fail(key);
  if(!Array.isArray(run.errors)||run.errors.length)fail('client_errors');
  let answer;try{answer=JSON.parse(run.final);if(!validateAnswer(answer))fail('structured_answer');}catch{fail('structured_answer');}
  if(answer&&typeof answer==='object')for(const [key,value]of Object.entries(scenario.expected||{}))if(answer[key]!==value)fail('answer.'+key);
  for(const value of scenario.answerIncludes||[])if(typeof answer?.answer!=='string'||!answer.answer.includes(value))fail('answer.version:'+value);
  const evidence=run.evidence,files=evidence?.files;
  if(!evidence||typeof evidence.project!=='string'||!Array.isArray(files)||!evidence.check)fail('missing_frozen_evidence');
  const reads=new Set(),fileReads=new Set();let checked=false,blocked=false;
  for(const command of run.commands||[]){
    if(typeof command.command!=='string'){fail('invalid_command');continue;}
    let stateReferences=[];try{stateReferences=(parse(files?.find(file=>file.path==='docs/workflow/state.yaml')?.text||'')?.basis||[]).map(ref=>ref.path);}catch{}
    const operation=analyzeCommand(command.command,{stateReferences,managedPaths:evidence?.managedPaths||[]}),output=command.output||'';
    if(operation.invalid)fail('unrecognized_read_operation');
    if(/(?:\.codex[\\/]|client-home[\\/]|auth\.json|config\.toml|process\.env|Env:)/i.test(command.command))fail('external_configuration_read');
    const targets=(operation.targets||[]).map(p=>localPath(p,evidence?.project||''));
    if([...(operation.targets||[]),...(operation.external||[])].some(p=>localPath(p,evidence?.project||'')===null))fail('external_project_read');
    const hashOnly=new Set((operation.hashOnlyTargets||[]).map(p=>localPath(p,evidence?.project||'')));
    if(operation.read)for(const file of targets){const match=file?.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/);if(match&&!hashOnly.has(file)&&!scenario.skills.includes(match[1]))fail('unnecessary_skill:'+match[1]);}
    if(operation.read&&!operation.invalid&&command.exitCode===0){
      const records=documents(output,targets.filter(Boolean));
      // PowerShell may emit diagnostics before the last ASCII state document.
      // Only the last actual read target can be recognized from this suffix.
      const last=targets.at(-1),lastFile=files?.find(file=>file.path===last);
      if(lastFile?.text&&normalize(output).endsWith('\n'+normalize(lastFile.text)))records.push({path:last,text:lastFile.text});
      for(const record of records){
        const target=localPath(record.path,evidence?.project||''),file=files?.find(file=>file.path===target);
        if(file&&targets.includes(target)&&typeof file.text==='string'&&hash(file.text)===file.sha256&&Buffer.byteLength(file.text)===file.bytes&&normalize(record.text)===normalize(file.text)){
          fileReads.add(file.path);const match=file.path.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/);if(match){reads.add(match[1]);if(!scenario.skills.includes(match[1]))fail('unnecessary_skill:'+match[1]);}
        }
      }
    }
    if(operation.check){
      let value;try{value=JSON.parse(output);}catch{for(const line of output.split('\n'))try{const parsed=JSON.parse(line);if(parsed?.command==='check'||parsed?.ok===false&&parsed?.error)value=parsed;}catch{}}
      if(value&&evidence?.check&&Number.isInteger(command.exitCode)&&Math.sign(command.exitCode)===Math.sign(evidence.check.exitCode)&&isDeepStrictEqual(value,evidence.check.value)){
        if(command.exitCode===0&&value.ok===true&&value.command==='check'&&value.data?.resources==='valid')checked=true;
        if(command.exitCode!==0&&value.ok===false&&['INCOMPLETE','CONFLICT','PACKAGE_INVALID'].includes(value.error?.code))blocked=true;
      }
    }
  }
  if(scenario.requiredSkill&&!reads.has(scenario.requiredSkill))fail('missing_skill_body');
  for(const file of scenario.requiredFiles||[])if(!fileReads.has(file))fail('missing_file:'+file);
  if(scenario.check&&!checked)fail('missing_resource_check');
  if(scenario.blockedCheck&&!blocked)fail('missing_damage_detection');
  if(scenario.skills.length===0&&(reads.size||checked||blocked||(run.commands||[]).length))fail('unrelated_workflow');
  return {id:scenario.id,ok:failures.length===0,failures,skill_reads:[...reads],file_reads:[...fileReads],resource_check:checked?'valid':blocked?'blocked':'not_observed'};
}
export function evaluateBatch(results,requiredIds){
  if(!results.length||!requiredIds.length||new Set(requiredIds).size!==requiredIds.length||new Set(results.map(result=>result.id)).size!==results.length)throw Error('A nonempty unique evaluation batch is required');
  if(results.length!==requiredIds.length||requiredIds.some(id=>!results.some(result=>result.id===id&&result.ok===true))||results.some(result=>result.ok!==true))throw Error('Required client evaluations did not all pass');
  return {passed:results.length,failed:0,required:requiredIds.length};
}
