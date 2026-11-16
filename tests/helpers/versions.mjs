import fs from 'node:fs';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {project,snapshot} from './installation.mjs';
export {snapshot,project};
export async function versionPackages(){
  const extracted=[];
  for(const version of ['0.3.0-dev.5','0.3.0-dev.6']){
    const root=project(),archive=fileURLToPath(new URL('../fixtures/iterlane-'+version+'.tgz',import.meta.url));
    if(version==='0.3.0-dev.6')assert.equal(createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),'144e327b3d8ea284b54bc00318b2b403ac17341b1b07ed5eaa15d72db5ae4e34','Fixed dev.6 delivery must retain its original bytes');
    const result=spawnSync('tar',['-xzf',archive,'-C',root],{windowsHide:true,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
    extracted.push(join(root,'package'));
  }
  return {old:extracted[0],next:extracted[1]};
}
export function cli(root,args,source=null){const executable=source?join(source,'bin/iterlane.mjs'):join(root,'.ai-workflow/bin/iterlane.mjs'),r=spawnSync(process.execPath,[executable,...args,'--json'],{cwd:root,windowsHide:true,encoding:'utf8',timeout:30000});assert.equal(r.error,undefined);return {exit:r.status,data:JSON.parse(r.stdout),stderr:r.stderr};}
export function initialized(old){const root=project(),r=cli(root,['init','--project',root],old);assert.equal(r.exit,0,JSON.stringify({root,error:r.data.error}));return root;}
export function versionOperation(root){const dir=join(root,'.ai-workflow/.local/operations');const id=fs.readdirSync(dir).find(id=>fs.existsSync(join(dir,id,'journal.json'))&&JSON.parse(fs.readFileSync(join(dir,id,'journal.json'))).journal_version===2);assert.ok(id,'A recorded version operation is required');return id;}
export function state(root){return JSON.parse(cli(root,['status']).data.data.state?JSON.stringify(cli(root,['status']).data.data.state):'null');}
