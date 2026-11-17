import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {resourcePackage,project,snapshot} from '../helpers/installation.mjs';import {initializeProject} from '../../src/installation.mjs';import {checkArtifact} from '../../src/workflow-artifacts.mjs';
const run=(root,args)=>spawnSync(process.execPath,[join(root,'.ai-workflow/bin/iterlane.mjs'),'artifacts','inspect',...args,'--json'],{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000});
const packageForTest=()=>process.env.ITERLANE_ARTIFACT_TEST_PACKAGE||resourcePackage();
test('artifact inspect: actual Unicode file bytes become a directly valid file reference without writes',async()=>{
 const pkg=await packageForTest(),root=project();initializeProject({packageRoot:pkg,projectRoot:root});fs.mkdirSync(join(root,'src'));fs.writeFileSync(join(root,'src','中文 file.txt'),'abc');const before=snapshot(root,true);
 const result=run(root,['--path','src/中文 file.txt']);assert.equal(result.status,0,result.stdout+result.stderr);const data=JSON.parse(result.stdout).data;
 assert.deepEqual(data.artifacts,[{kind:'file',path:'src/中文 file.txt',sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'}]);assert.equal(checkArtifact(root,data.artifacts[0]).valid,true);assert.deepEqual(snapshot(root,true),before);
 fs.writeFileSync(join(root,'src','中文 file.txt'),'abcd');assert.equal(checkArtifact(root,data.artifacts[0]).valid,false);
});
test('artifact inspect: missing paths, escape, links and wrong definition fail without changing the project',async()=>{
 const pkg=await packageForTest(),root=project();initializeProject({packageRoot:pkg,projectRoot:root});fs.writeFileSync(join(root,'plain.txt'),'abc');fs.symlinkSync(join(root,'plain.txt'),join(root,'alias.txt'),'file');const before=snapshot(root,true);
 for(const args of [['--path','missing.txt'],['--path','../outside.txt'],['--path','alias.txt'],['--kind','definition','--path','plain.txt'],['--path','plain.txt','--path','plain.txt']]){const r=run(root,args);assert.notEqual(r.status,0,r.stdout);assert.equal(JSON.parse(r.stdout).ok,false);}assert.deepEqual(snapshot(root,true),before);
});
