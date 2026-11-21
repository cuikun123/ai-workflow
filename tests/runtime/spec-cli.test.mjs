import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resourcePackage,project,snapshot} from '../helpers/installation.mjs';
import {specification,requirement,task,block,specPath,iteration} from '../helpers/specs.mjs';
const entry=fileURLToPath(new URL('../../bin/iterlane.mjs',import.meta.url));
const run=(file,args,cwd)=>spawnSync(process.execPath,[file,...args,'--json'],{cwd,encoding:'utf8',windowsHide:true,timeout:180000});

test('spec CLI: installed checker is read only and reports actual identity errors with exit 5',async()=>{
  const pkg=await resourcePackage(),root=project(),cli=join(pkg,'bin/iterlane.mjs');
  assert.equal(run(cli,['init','--project',root]).status,0);
  fs.mkdirSync(join(root,iteration),{recursive:true});
  fs.writeFileSync(join(root,specPath),specification());fs.writeFileSync(join(root,iteration,'tasks.md'),block(task()));
  fs.writeFileSync(join(root,iteration,'scope.md'),'');fs.writeFileSync(join(root,iteration,'verification.md'),'');
  const installed=join(root,'.ai-workflow/bin/iterlane.mjs'),before=snapshot(root,true),good=run(installed,['spec','check'],project());
  assert.equal(good.status,0,good.stdout+good.stderr);assert.equal(JSON.parse(good.stdout).data.requirement_count,1);assert.deepEqual(snapshot(root,true),before);
  fs.writeFileSync(join(root,'docs/project/specs/duplicate.md'),specification(requirement('CAP-001')));
  const bad=run(installed,['spec','check'],root);assert.equal(bad.status,5,bad.stdout+bad.stderr);assert.ok(JSON.parse(bad.stdout).error.details.some(x=>x.code==='DUPLICATE_REQUIREMENT'));
});
test('spec CLI: explicit project and complete operation parameters are required',()=>{
  for(const args of [['spec'],['spec','sync'],['spec','check'],['spec','check','--package','x'],['spec','check','--task','T1']]){
    assert.equal(run(entry,args).status,2,JSON.stringify(args));
  }
});
