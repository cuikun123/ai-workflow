import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {resourcePackage,project,snapshot} from '../helpers/installation.mjs';import {initializeProject} from '../../src/installation.mjs';
import {validateStateYaml} from '../../src/state.mjs';
test('example init: explicit preview is zero-write and installed example runs without fake task approval',async()=>{
 const pkg=await resourcePackage(),root=project(),run=args=>spawnSync(process.execPath,[join(pkg,'bin/iterlane.mjs'),'init','--project',root,'--example','bookmarks',...args,'--json'],{encoding:'utf8',windowsHide:true,timeout:60000});
 const before=snapshot(root,true),preview=run(['--preview']);assert.equal(preview.status,0,preview.stdout+preview.stderr);assert.deepEqual(snapshot(root,true),before);const result=run([]);assert.equal(result.status,0,result.stdout+result.stderr);
 const state=validateStateYaml(fs.readFileSync(join(root,'docs/workflow/state.yaml'),'utf8'));assert.equal(state.current_task,null);assert.equal(state.status,'not_started');assert(fs.existsSync(join(root,'scripts/check.mjs')));
 const checked=spawnSync(process.execPath,['scripts/check.mjs'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(checked.status,0,checked.stdout+checked.stderr);const report=JSON.parse(checked.stdout);assert.equal(report.passed,true);assert(report.test_count>0);assert(fs.existsSync(join(root,report.evidence[0])));
 const saved=snapshot(root,true),repeat=run([]);assert.notEqual(repeat.status,0);assert.deepEqual(snapshot(root,true),saved);
});
test('example init: undo removes its written sample but preserves later user edits',async()=>{
 const pkg=await resourcePackage();
 for(const changed of [false,true]){const root=project(),io={...fs,renameSync(a,b){fs.renameSync(a,b);if(b===join(root,'server.mjs'))throw Error('Test interruption for undo');}};
 assert.throws(()=>initializeProject({packageRoot:pkg,projectRoot:root,example:'bookmarks',io}),/Test interruption/);
 if(changed){fs.writeFileSync(join(root,'server.mjs'),'User edits');const before=snapshot(root,true);assert.throws(()=>initializeProject({packageRoot:pkg,projectRoot:root,mode:'undo'}));assert.deepEqual(snapshot(root,true),before);}
 else{initializeProject({packageRoot:pkg,projectRoot:root,mode:'undo'});assert(!fs.existsSync(join(root,'server.mjs')));assert(!fs.existsSync(join(root,'scripts/check.mjs')));}
 }
});
test('example init: defaults stay empty and recovery protects user edits',async()=>{
 const pkg=await resourcePackage(),ordinary=project();initializeProject({packageRoot:pkg,projectRoot:ordinary});assert(!fs.existsSync(join(ordinary,'server.mjs')));
 const root=project(),io={...fs,renameSync(a,b){fs.renameSync(a,b);if(b===join(root,'server.mjs'))throw Error('Test interruption after example write');}};
 assert.throws(()=>initializeProject({packageRoot:pkg,projectRoot:root,example:'bookmarks',io}),/Test interruption/);initializeProject({packageRoot:pkg,projectRoot:root,mode:'resume'});assert(fs.existsSync(join(root,'scripts/check.mjs')));
 const conflict=project(),io2={...fs,renameSync(a,b){fs.renameSync(a,b);if(b===join(conflict,'server.mjs'))throw Error('Test interruption');}};assert.throws(()=>initializeProject({packageRoot:pkg,projectRoot:conflict,example:'bookmarks',io:io2}));fs.writeFileSync(join(conflict,'server.mjs'),'User changes');const before=snapshot(conflict,true);assert.throws(()=>initializeProject({packageRoot:pkg,projectRoot:conflict,mode:'resume'}));assert.deepEqual(snapshot(conflict,true),before);
});
