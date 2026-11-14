import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function snapshot(root,{text=false}={}){
  const files=[];
  function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name),stat=fs.lstatSync(file);
    if(stat.isSymbolicLink())throw Error('Linked validation input');
    if(stat.isDirectory())walk(file);
    else if(stat.isFile()){const bytes=fs.readFileSync(file);files.push({path:path.relative(root,file).replaceAll('\\','/'),bytes:bytes.length,sha256:sha256(bytes),...(text&&/\.(?:md|yaml)$/.test(file)?{text:bytes.toString('utf8')}:{})});}
    else throw Error('Unsupported validation input');
  }}walk(root);return files.sort((a,b)=>a.path.localeCompare(b.path));
}
export function createSuite(root,suite){
  if(!/^[a-z0-9-]{1,64}$/.test(suite))throw Error('Invalid evidence suite');
  const out=path.join(root,suite);fs.mkdirSync(out);return out;
}
export function fingerprint(inputs){
  const digest=file=>sha256(fs.readFileSync(file));
  return {node:process.version,node_sha256:digest(process.execPath),package:snapshot(inputs.packageRoot),artifact_sha256:digest(inputs.artifact),cli_sha256:digest(inputs.cli),cli_binary_sha256:digest(inputs.cliBinary),global_config_sha256:digest(inputs.globalConfigFile),isolated_config_sha256:digest(path.join(inputs.home,'config.toml')),models_sha256:digest(path.join(inputs.home,'models.json'))};
}
export function assertBaseline(baseline){
  if(!baseline?.inputs||!baseline.fingerprint||!isDeepStrictEqual(fingerprint(baseline.inputs),baseline.fingerprint))throw Error('Frozen validation baseline changed');
}
export function captureEvidence(project){
  const result=spawnSync(process.execPath,[path.join(project,'.ai-workflow/bin/iterlane.mjs'),'check','--project',project,'--json'],{cwd:project,windowsHide:true,encoding:'utf8',timeout:30000});
  if(result.error||result.status===null)throw Error('Trusted project check did not complete');
  let value;try{value=JSON.parse(result.stdout);}catch{throw Error('Trusted project check was not structured');}
  const manifest=JSON.parse(fs.readFileSync(path.join(project,'.ai-workflow/manifest.json'),'utf8'));
  return {project,files:snapshot(project,{text:true}),managedPaths:manifest.files.map(file=>file.path),check:{exitCode:result.status,value}};
}
