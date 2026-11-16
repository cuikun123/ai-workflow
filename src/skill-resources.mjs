import * as fs from 'node:fs';import {join,dirname,posix} from 'node:path';import {fileURLToPath} from 'node:url';import {isDeepStrictEqual,TextDecoder} from 'node:util';import {parseDocument} from 'yaml';
import policy from '../skills/_shared/manifest.json' with {type:'json'};
import {skillNames} from './skill-names.mjs';import {assertPortablePath,listRegularFiles,resolveRegularFile} from './paths.mjs';import {parseStrictJson} from './workflow-docs.mjs';import {markdownLines,heading,digest} from './spec-docs.mjs';import {WorkflowError} from './errors.mjs';

const ids=['clarify','design_discussion','planning','implementation','foundation','testing','diagnosis','review','release','incident'];
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const fail=message=>{throw new WorkflowError('PACKAGE_INVALID',message);};
const strings=(v,min=1)=>Array.isArray(v)&&v.length>=min&&v.length<=1000&&v.every(x=>typeof x==='string'&&x.length>0&&x.length<=16384)&&new Set(v).size===v.length;
const safe=path=>{assertPortablePath(path);if(path.startsWith('references/common/')||path.startsWith('references/')||path.startsWith('scripts/')||path.startsWith('assets/'))return path;fail('Unknown skill resource path');};
export function validateSkillManifest(value){
  if(!exact(value,['schema_version','entry','entry_budget','capabilities','shared_resources','rules'])||value.schema_version!==1||!exact(value.entry,['provider','required_resources'])||value.entry.provider!=='workflow-guide'||!strings(value.entry.required_resources))fail('Invalid shared skill manifest');
  if(!exact(value.entry_budget,['max_lines','max_bytes','exceptions'])||value.entry_budget.max_lines!==150||value.entry_budget.max_bytes!==10240||!Array.isArray(value.entry_budget.exceptions))fail('Invalid entry budget');
  for(const item of value.entry_budget.exceptions)if(!exact(item,['provider','reason'])||!skillNames.includes(item.provider)||typeof item.reason!=='string'||!item.reason.trim())fail('Entry budget exception needs an explicit responsibility');
  if(!Array.isArray(value.capabilities)||value.capabilities.length!==ids.length)fail('Missing capability declarations');
  const capabilities=new Set(),targets=new Set();
  for(const c of value.capabilities){if(!exact(c,['id','provider','request_modes','required_resources','fallback','return_contract'])||!ids.includes(c.id)||capabilities.has(c.id)||!skillNames.includes(c.provider)||!strings(c.request_modes)||c.request_modes.some(x=>!['query','prepare','execute'].includes(x))||!strings(c.required_resources)||!['report_gap','basic_method'].includes(c.fallback)||!strings(c.return_contract))fail('Invalid capability or provider');capabilities.add(c.id);c.required_resources.forEach(safe);}
  value.entry.required_resources.forEach(safe);
  if(!Array.isArray(value.shared_resources)||!value.shared_resources.length||value.shared_resources.length>100)fail('Invalid shared resources');
  const resourceIds=new Set();
  for(const r of value.shared_resources){if(!exact(r,['id','source','target'])||typeof r.id!=='string'||!/^[a-z][a-z0-9-]*$/u.test(r.id)||resourceIds.has(r.id)||typeof r.source!=='string'||typeof r.target!=='string'||!r.target.startsWith('references/common/'))fail('Invalid shared resource');resourceIds.add(r.id);safe(r.target);const folded=r.target.toLowerCase();if(targets.has(folded))fail('Aliased shared target');targets.add(folded);if(!['@capabilities','@rules'].includes(r.source)){safe(r.source);if(!r.source.startsWith('references/'))fail('Shared source must be a reference');}}
  if(!Array.isArray(value.rules)||!value.rules.length||value.rules.length>1000)fail('Missing rule ownership');const rules=new Set();
  for(const r of value.rules){if(!exact(r,['id','layers','source','applies_when','enforced_by','retire_when','resources'])||typeof r.id!=='string'||rules.has(r.id)||!strings(r.layers)||r.layers.some(x=>!['environment','preference','accountability','compensation'].includes(x))||!strings(r.source)||!strings(r.resources)||['applies_when','enforced_by','retire_when'].some(k=>typeof r[k]!=='string'||!r[k].trim()))fail('Invalid rule ownership or retirement condition');rules.add(r.id);r.resources.forEach(x=>safe(x.split('#')[0]));}
  return value;
}
export const skillPolicy=validateSkillManifest(policy);
export function providerResources(manifest,provider){return [...new Set(provider===manifest.entry.provider?manifest.entry.required_resources:manifest.capabilities.filter(c=>c.provider===provider).flatMap(c=>c.required_resources))].sort();}
export function sharedResourceBytes(manifest,resource,read){
  if(resource.source==='@capabilities')return Buffer.from(JSON.stringify({schema_version:1,entry_provider:manifest.entry.provider,capabilities:manifest.capabilities.map(({required_resources,...c})=>c)},null,2)+'\n');
  if(resource.source==='@rules')return Buffer.from(JSON.stringify({schema_version:1,rules:manifest.rules},null,2)+'\n');
  return read(resource.source);
}
export function sourceSharedDigests(sourceRoot=join(dirname(fileURLToPath(import.meta.url)),'../skills/_shared'),manifest=skillPolicy){
  const result={manifest:digest(fs.readFileSync(resolveRegularFile(sourceRoot,'manifest.json')))};
  for(const r of manifest.shared_resources)result[r.id]=digest(sharedResourceBytes(manifest,r,path=>fs.readFileSync(resolveRegularFile(sourceRoot,path))));return result;
}
function decode(bytes){return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
const slug=title=>title.trim().toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu,'').replace(/\s/gu,'-');
function links(text){return markdownLines(text).rows.filter(r=>!r.hidden).flatMap(r=>[...r.line.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)].map(m=>m[1]));}
export function inspectSkillProvider(root,provider,{manifest=skillPolicy}={}){
  const issues=[],note=(code,message,path=null)=>issues.push({code,message,path}),required=providerResources(manifest,provider);let lines=0,bytes=0;
  try{
    const files=listRegularFiles(root);if(!files.includes('SKILL.md')||!files.includes('NOTICE.md'))fail('Skill and attribution must travel together');
    const content=fs.readFileSync(resolveRegularFile(root,'SKILL.md'));bytes=content.length;const text=decode(content),rows=text.split(/\r?\n/u);if(rows.at(-1)==='')rows.pop();lines=rows.length;
    const front=text.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/u);if(!front)fail('Missing skill metadata');const doc=parseDocument(front[1],{uniqueKeys:true});if(doc.errors.length)fail('Invalid skill metadata');const data=doc.toJS({maxAliasCount:0});
    if(data.name!==provider||typeof data.description!=='string'||!data.description.trim()||data.description.length>1024)fail('Skill identity or discovery description is invalid');
    const declared=data.metadata?.capability?.split(',').map(x=>x.trim())||[];for(const id of declared)if(!manifest.capabilities.some(c=>c.id===id&&c.provider===provider))note('UNKNOWN_CAPABILITY','Entrypoint declares an unknown or differently owned capability');
    if((lines>manifest.entry_budget.max_lines||bytes>manifest.entry_budget.max_bytes)&&!manifest.entry_budget.exceptions.some(e=>e.provider===provider))note('ENTRY_BUDGET','Entrypoint exceeds 150 lines or 10 KiB; move conditional detail into references','SKILL.md');
    for(const path of required)if(!files.includes(path))note('MISSING_RESOURCE','Required skill resource is missing',path);
    const seen=new Set(),queue=['SKILL.md'];
    while(queue.length){const path=queue.shift();if(seen.has(path))continue;seen.add(path);const current=decode(fs.readFileSync(resolveRegularFile(root,path)));
      if(path!=='NOTICE.md')for(const other of skillNames.filter(x=>x!==provider))if(new RegExp('(?<![A-Za-z0-9_-])'+other+'(?![A-Za-z0-9_-])','u').test(current))note('HARD_SKILL_REFERENCE','Use the capability contract rather than another skill name',path);
      for(const link of links(current)){
        if(/^https?:\/\//u.test(link))continue;const [local,anchor]=link.split('#');
        try{const target=local?posix.normalize(posix.join(posix.dirname(path),decodeURIComponent(local))):path;assertPortablePath(target);const actual=resolveRegularFile(root,target),body=decode(fs.readFileSync(actual));if(anchor&&!markdownLines(body).rows.some(row=>!row.hidden&&heading(row.line)&&slug(heading(row.line).title)===decodeURIComponent(anchor)))fail('Missing reference heading');if(target.endsWith('.md'))queue.push(target);else seen.add(target);}catch(e){note('BROKEN_REFERENCE',e.message,path);}
      }
    }
    for(const path of required.filter(x=>x.startsWith('references/')))if(files.includes(path)&&!seen.has(path))note('UNROUTED_RESOURCE','Required reference has no entrypoint or transitive reading route',path);
  }catch(e){note('INVALID_SKILL_RESOURCE',e.message);}
  return {valid:issues.length===0,provider,lines,bytes,issues};
}
export function inspectSkillResources(root,{installed=false,expectedDigests,expectedPolicy=skillPolicy}={}){
  const issues=[],note=(code,message,path=null)=>issues.push({code,message,path}),shared=join(root,installed?'.ai-workflow/resources/skills/_shared':'resources/skills/_shared'),providers=join(root,installed?'.agents/skills':'resources/skills');let parsed;
  try{
    const raw=fs.readFileSync(resolveRegularFile(shared,'manifest.json'));parsed=validateSkillManifest(parseStrictJson(decode(raw),1024*1024));if(!isDeepStrictEqual(parsed,expectedPolicy))fail('Shared policy differs from this runtime');
    const expected=expectedDigests||(typeof __ITERLANE_SHARED_DIGESTS__==='undefined'?sourceSharedDigests():__ITERLANE_SHARED_DIGESTS__);
    if(digest(raw)!==expected.manifest)fail('Shared manifest digest differs');
    const index=parseStrictJson(decode(fs.readFileSync(resolveRegularFile(shared,'resource-index.json'))),1024*1024);
    if(!exact(index,['schema_version','source_manifest_sha256','resources'])||index.schema_version!==1||index.source_manifest_sha256!==expected.manifest||!Array.isArray(index.resources)||index.resources.length!==parsed.shared_resources.length)fail('Invalid shared resource index');
    for(const r of parsed.shared_resources){
      const source=sharedResourceBytes(parsed,r,path=>fs.readFileSync(resolveRegularFile(shared,path))),hash=digest(source),item=index.resources.find(x=>x.id===r.id);
      if(hash!==expected[r.id]||!item||!exact(item,['id','source','target','sha256','providers'])||item.source!==r.source||item.target!==r.target||item.sha256!==hash)fail('Shared source or generated index differs');
      const targets=skillNames.filter(name=>providerResources(parsed,name).includes(r.target));if(!isDeepStrictEqual(item.providers,targets))fail('Shared resource consumers differ');
      for(const name of targets){const bytes=fs.readFileSync(resolveRegularFile(join(providers,name),r.target));if(digest(bytes)!==hash)note('SHARED_RESOURCE_DRIFT','Generated common resource differs from its single source',name+'/'+r.target);}
    }
    for(const rule of parsed.rules)for(const link of rule.resources){const [path,fragment]=link.split('#'),body=decode(fs.readFileSync(resolveRegularFile(shared,path)));if(fragment&&!markdownLines(body).rows.some(row=>!row.hidden&&heading(row.line)&&slug(heading(row.line).title)===fragment))fail('Rule points to a missing source heading');}
  }catch(e){note('INVALID_SHARED_RESOURCE',e.message);}
  const budgets=[];for(const name of skillNames){const result=inspectSkillProvider(join(providers,name),name,{manifest:parsed||skillPolicy});budgets.push({provider:name,lines:result.lines,bytes:result.bytes});issues.push(...result.issues.map(x=>({...x,path:x.path?name+'/'+x.path:name})));}
  return {valid:issues.length===0,providers:skillNames.length,capabilities:skillPolicy.capabilities.length,rules:skillPolicy.rules.length,shared_resources_consistent:!issues.some(x=>['INVALID_SHARED_RESOURCE','SHARED_RESOURCE_DRIFT'].includes(x.code)),budgets,issues};
}
