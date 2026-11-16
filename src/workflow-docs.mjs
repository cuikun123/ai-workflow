import {parseAllDocuments, visit, isScalar} from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import {createHash} from 'node:crypto';
import {assertPortablePath} from './paths.mjs';
import {isLosslessInteger, validateStateYaml} from './state.mjs';
import {WorkflowError} from './errors.mjs';
import schema from '../schemas/workflow-record-v1.schema.json' with {type:'json'};
import schema2 from '../schemas/workflow-record-v2.schema.json' with {type:'json'};
import {markdownLines} from './spec-docs.mjs';
import {taskVerificationPolicy} from './verification-policy.mjs';

const ajv=new Ajv2020({allErrors:true,strict:true,strictTypes:false});
const validator=ajv.compile(schema),artifactValidator=ajv.compile({$ref:schema.$id+'#/$defs/artifact'});
const validator2=ajv.compile(schema2);
const invalid=message=>{throw new WorkflowError('STATE_INVALID',message);};
const conflict=message=>{throw new WorkflowError('CONFLICT',message);};
export const canonicalJson=value=>JSON.stringify(sort(value));
function sort(value){if(Array.isArray(value))return value.map(sort);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])]));return value;}
export function parseStrictJson(text,maxBytes=1024*1024){
  if(typeof text!=='string'||Buffer.byteLength(text)>maxBytes||text.includes('\u0000')||text.includes('\ufffd'))invalid('Invalid or oversized JSON text');
  let value;try{value=JSON.parse(text);}catch{invalid('Expected strict JSON');}
  const docs=parseAllDocuments(text,{uniqueKeys:true,strict:true,version:'1.2'});
  if(docs.length!==1||docs[0].errors.length||docs[0].warnings.length)invalid('Duplicate or malformed JSON keys');
  visit(docs[0],{Node(key,node,ancestors){if(ancestors.length>64||node.anchor||node.tag)invalid('Unsupported JSON structure');if(isScalar(node)&&typeof node.value==='number'&&!isLosslessInteger(node))invalid('Integer fields must be lossless safe integers');},Alias(){invalid('Aliases are not JSON');}});
  return value;
}
const safe=path=>{try{assertPortablePath(path);}catch{invalid('Unsafe workflow path');}};
export function validateArtifactShape(artifact){if(!artifactValidator(artifact))invalid('Invalid artifact shape');if(artifact.kind==='git')artifact.scope.forEach(safe);else safe(artifact.path);return artifact;}
export function validateWorkflowRecord(record,path){
  const validate=record?.record_version===1?validator:record?.record_version===2?validator2:null;
  if(!validate)invalid('Unsupported workflow record version');
  if(!validate(record))invalid('Record does not match schema v'+record.record_version+': '+validate.errors.map(e=>e.instancePath+' '+e.message).join('; '));
  safe(record.iteration);safe(path);
  const expected=record.iteration+'/'+(record.kind==='task'?'tasks.md':record.kind==='spec_delta'?'scope.md':'verification.md');
  if(path!==expected||record.kind==='task'&&record.task!==record.id)invalid('Record identity or document location differs');
  if(!record.source.reference.trim()||!record.source.text.trim())invalid('Record source must be explicit');
  const walk=value=>{if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(key==='path')safe(item);if(key==='scope'&&Array.isArray(item))item.forEach(safe);walk(item);}};walk(record.data);
  if(record.kind==='task'&&!record.data.title.trim())invalid('Task title is empty');
  if(record.kind==='task')for(const ref of record.data.depends_on)if(!/^docs\/iterations\/[^/]+\/tasks\.md$/u.test(ref.path))invalid('Dependency must name a task record');
  if(record.record_version===2){
    if(record.kind==='task'){
      taskVerificationPolicy(record);
      for(const ref of record.data.delta_refs)if(ref.path!==record.iteration+'/scope.md')invalid('Task delta must belong to its iteration scope');
      if(record.data.verification_policy)for(const ref of record.data.verification_policy.required_scenario_refs)if(!record.data.scenario_refs.some(s=>s.requirement_id===ref.requirement_id&&s.scenario_id===ref.scenario_id))invalid('Required scenario must be associated with the task');
    }
    if(record.kind==='check'){
      const type=record.data.check_type||'test_suite',d=record.data;
      const unexecuted=['not_run','not_applicable'].includes(d.result);
      if(unexecuted&&(d.exit_code!==null||d.test_count!==null))invalid('Unexecuted checks cannot declare execution results');
      if(!unexecuted&&type==='test_suite'&&(typeof d.command!=='string'||!d.command.trim()||!Number.isSafeInteger(d.exit_code)||!Number.isSafeInteger(d.test_count)||d.result==='passed'&&(d.exit_code!==0||d.test_count<1)))invalid('Test suite requires actual command, exit code and nonzero passing count');
      if(!unexecuted&&type==='command'&&(typeof d.command!=='string'||!d.command.trim()||!Number.isSafeInteger(d.exit_code)||d.test_count!==null||d.result==='passed'&&d.exit_code!==0))invalid('Command check has invalid execution fields');
      if(!unexecuted&&type==='observation'&&(d.command!==null||d.exit_code!==null||d.test_count!==null||!d.method?.trim()||!d.expected?.trim()||!d.actual?.trim()))invalid('Observation needs method, expected, actual and no invented execution fields');
      if(['not_run','not_applicable'].includes(d.result)&&!d.reason?.trim())invalid('Unexecuted or inapplicable check needs a reason');
    }
    if(record.kind==='spec_sync'&&record.data.result==='not_needed'&&(record.data.delta_refs.length||record.data.targets.length||record.data.operations.length))invalid('No-change receipt cannot contain changes');
  }
  const position=record.kind==='task'?record.data.progress:record.data.position;
  if(position){const {phase,status,waiting_for,checkpoint_ref,confirmation_refs,blocker_refs}=position;validateStateYaml(JSON.stringify({schema_version:1,revision:0,current_iteration:record.iteration,current_task:record.task,phase,status,waiting_for,checkpoint_ref,confirmation_refs,blocker_refs,basis:[],updated_at:'2026-11-14T00:00:00Z'}));}
  return record;
}
export function parseWorkflowDocument(text,path){
  if(typeof text!=='string'||Buffer.byteLength(text)>1024*1024||text.includes('\u0000')||text.includes('\ufffd'))invalid('Document must be bounded UTF-8 text');
  safe(path);
  const lines=[];let offset=0;for(const match of text.matchAll(/[^\n]*(?:\n|$)/gu)){if(!match[0].length)continue;lines.push({raw:match[0],line:match[0].replace(/\r?\n$/u,''),start:offset,end:offset+match[0].length});offset+=match[0].length;}
  const records=new Map(),spans=new Map(),identities=new Set(),body=[],visible=[],requirements=[],links=[];
  const masked=markdownLines(text).rows;
  let fence=null;
  for(let i=0;i<lines.length;i++){
    const row=lines[i],f=row.line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if(masked[i]?.inComment){body.push(row.raw);continue;}
    if(fence){body.push(row.raw);if(f&&f[1][0]===fence.character&&f[1].length>=fence.length&&!f[2].trim())fence=null;continue;}
    if(f&&!(f[1][0]==='`'&&f[2].includes('`'))){fence={character:f[1][0],length:f[1].length};body.push(row.raw);continue;}
    const begin=row.line.match(/^<!-- iterlane:record ([A-Za-z0-9][A-Za-z0-9_.-]{0,127}) -->$/u);
    if(begin){
      const id=begin[1];if(!lines[i+1]||lines[i+1].line!=='```json')invalid('Record needs a JSON fence');
      let close=i+2;while(close<lines.length&&lines[close].line!=='```')close++;
      if(close>=lines.length||lines[close+1]?.line!==`<!-- /iterlane:record ${id} -->`)invalid('Record end marker is missing or differs');
      const record=validateWorkflowRecord(parseStrictJson(lines.slice(i+2,close).map(x=>x.raw).join('')),path);
      const identity=id.toLowerCase();if(record.id!==id||identities.has(identity))invalid('Duplicate, aliased or mismatched record ID');
      identities.add(identity);records.set(id,record);spans.set(id,{start:row.start,end:lines[close+1].end});i=close+1;continue;
    }
    if(/<!--\s*\/?iterlane:record\b/u.test(row.line))invalid('Malformed or orphan record marker');
    body.push(row.raw);if(masked[i]?.hidden)continue;visible.push(row.line);
    const requirement=row.line.match(/^###\s+Requirement:\s+([A-Za-z0-9][A-Za-z0-9_.-]{0,127})\s+\S/u);
    if(requirement){if(requirements.includes(requirement[1]))invalid('Duplicate requirement ID');requirements.push(requirement[1]);}
    for(const match of row.line.matchAll(/!?\[[^\]\n]*\]\((?:<([^>\n]+)>|([^\s()]+))(?:\s+["'][^"']*["'])?\)/gu))links.push({target:match[1]||match[2]});
  }
  if(fence)invalid('Unclosed Markdown fence');
  return {path,text,body:body.join(''),visible,records,spans,requirements,links};
}
export function definitionDigest(doc){
  const definitions=[...doc.records.values()].filter(r=>r.record_version===2&&['task','spec_delta'].includes(r.kind));
  if(definitions.length){
    const records=[...doc.records.values()].filter(r=>r.kind==='task'||r.kind==='spec_delta').map(r=>{const {progress,...data}=r.data;return {record_version:r.record_version,id:r.id,kind:r.kind,iteration:r.iteration,task:r.task,data};}).sort((a,b)=>a.id.localeCompare(b.id));
    return createHash('sha256').update('iterlane-definition-v2\0').update(doc.body.replace(/(?:\r?\n)+$/u,'')).update('\0').update(canonicalJson(records)).digest('hex');
  }
  const tasks=[...doc.records.values()].filter(r=>r.kind==='task').map(r=>({id:r.id,iteration:r.iteration,task:r.task,title:r.data.title,phase:r.data.phase,depends_on:r.data.depends_on,requirements:r.data.requirements})).sort((a,b)=>a.id.localeCompare(b.id));
  const body=doc.body.replace(/(?:\r?\n)+$/u,'');
  return createHash('sha256').update('iterlane-definition-v1\0').update(body).update('\0').update(canonicalJson(tasks)).digest('hex');
}
export function renderWorkflowRecord(record){return `<!-- iterlane:record ${record.id} -->\n\`\`\`json\n${JSON.stringify(record,null,2)}\n\`\`\`\n<!-- /iterlane:record ${record.id} -->\n`;}
export function appendWorkflowRecord(text,record,path){const doc=parseWorkflowDocument(text,path);validateWorkflowRecord(record,path);if([...doc.records.keys()].some(id=>id.toLowerCase()===record.id.toLowerCase()))conflict('Record already exists');const separator=text.length?(text.endsWith('\n')?'\n':'\n\n'):'';const next=text+separator+renderWorkflowRecord(record);parseWorkflowDocument(next,path);return next;}
export function replaceWorkflowRecord(text,record,path){const doc=parseWorkflowDocument(text,path);validateWorkflowRecord(record,path);const span=doc.spans.get(record.id);if(!span)conflict('Record to replace is missing');const next=text.slice(0,span.start)+renderWorkflowRecord(record)+text.slice(span.end);parseWorkflowDocument(next,path);return next;}
