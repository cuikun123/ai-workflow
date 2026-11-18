import * as fs from 'node:fs';import {join,dirname} from 'node:path';import {WorkflowError} from './errors.mjs';import {listRegularFiles,resolveRegularFile,assertSafeRoot,isWithin} from './paths.mjs';
import {skillNames} from './skill-names.mjs';import {skillPolicy,providerResources,sharedResourceBytes,sharedGeneratedPath,sharedSourcePaths} from './skill-resources.mjs';import {digest} from './spec-docs.mjs';
const fail=message=>{throw new WorkflowError('PACKAGE_INVALID',message);};
function newDirectory(out,source){assertSafeRoot(dirname(out));if(fs.existsSync(out)||isWithin(out,source)||isWithin(source,out))fail('Skill output must be new and outside its source');fs.mkdirSync(out,{recursive:true});}
function copyDeclared(source,out,paths){for(const path of new Set(paths)){const target=join(out,path);fs.mkdirSync(dirname(target),{recursive:true});fs.copyFileSync(resolveRegularFile(source,path),target,fs.constants.COPYFILE_EXCL);}}
export function renderSingleSkill(sourceRoot,provider,out){
  if(!skillNames.includes(provider))fail('Unknown skill provider');const source=join(sourceRoot,provider),shared=join(sourceRoot,'_shared'),files=listRegularFiles(source);
  if(files.some(path=>path.startsWith('references/common/')))fail('Generated shared resources must not be manually maintained');newDirectory(out,sourceRoot);
  copyDeclared(source,out,['SKILL.md','NOTICE.md',...providerResources(skillPolicy,provider).filter(path=>!path.startsWith('references/common/'))]);
  for(const r of skillPolicy.shared_resources)if(providerResources(skillPolicy,provider).includes(r.target)){const bytes=sharedResourceBytes(skillPolicy,r,path=>fs.readFileSync(resolveRegularFile(shared,path))),target=join(out,r.target);if(fs.existsSync(target))fail('Generated shared resources must not be manually maintained');fs.mkdirSync(dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
  return out;
}
export function renderSkillResources(sourceRoot,out){
  newDirectory(out,sourceRoot);const source=join(sourceRoot,'_shared'),shared=join(out,'_shared');listRegularFiles(source);fs.mkdirSync(shared);copyDeclared(source,shared,sharedSourcePaths());
  const manifest=fs.readFileSync(resolveRegularFile(source,'manifest.json')),resources=[];
  for(const name of skillNames)renderSingleSkill(sourceRoot,name,join(out,name));
  for(const r of skillPolicy.shared_resources){const bytes=sharedResourceBytes(skillPolicy,r,path=>fs.readFileSync(resolveRegularFile(source,path))),generated=sharedGeneratedPath(r);if(generated){const target=join(shared,generated);fs.mkdirSync(dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}resources.push({id:r.id,source:r.source,target:r.target,sha256:digest(bytes),providers:skillNames.filter(name=>providerResources(skillPolicy,name).includes(r.target))});}
  const index={schema_version:1,source_manifest_sha256:digest(manifest),resources};fs.writeFileSync(join(shared,'resource-index.json'),JSON.stringify(index,null,2)+'\n');
  return {output:out,expectedDigests:{manifest:digest(manifest),...Object.fromEntries(resources.map(r=>[r.id,r.sha256]))}};
}
