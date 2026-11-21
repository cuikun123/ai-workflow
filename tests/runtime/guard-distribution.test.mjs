import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {project,resourcePackage,snapshot} from '../helpers/installation.mjs';
import {guardFixture,request} from '../helpers/guard.mjs';
import {inspectOperation} from '../../src/operation-guard.mjs';
import {checkPackage} from '../../src/package.mjs';

test('complete package exports the same guard decision and rejects damaged guard resources',async()=>{
 const pkg=await resourcePackage(),root=await guardFixture({selected:false});
 const input=request(root,{kind:'workflow.query',command:'status',argv:[]},false);
 const expected=await inspectOperation(root,input);
 const guardPath=path.join(pkg,'runtime/guard.mjs');
 assert.ok(fs.existsSync(guardPath),'Complete package must include the shared runtime guard module');
 const bundled=await import(pathToFileURL(guardPath).href);
 const before=snapshot(root,true);
 const actual=await bundled.inspectOperation(root,input);
 assert.deepEqual(actual,expected);
 assert.deepEqual(await bundled.revalidateOperation(root,input,actual),expected);
 const requestPath=path.join(project(),'request.json');fs.writeFileSync(requestPath,JSON.stringify(input));
 const run=()=>spawnSync(process.execPath,[path.join(pkg,'bin/iterlane.mjs'),'guard','check','--project',root,'--input',requestPath,'--json'],{encoding:'utf8',windowsHide:true,timeout:60000});
 const cli=run();
 assert.equal(cli.status,expected.allowed?0:expected.decision==='deny'?7:8,cli.stdout+cli.stderr);
 assert.deepEqual(JSON.parse(cli.stdout).data,expected);
 fs.appendFileSync(guardPath,'\n// Changed after loading\n');
 await assert.rejects(()=>bundled.inspectOperation(root,input),e=>e.code==='PACKAGE_INVALID');
 assert.equal(run().status,4,'Damaged complete package cannot issue guard results');
 assert.deepEqual(snapshot(root,true),before);
});

test('a guard schema removed from both disk and inventory invalidates the package',async()=>{
 const pkg=await resourcePackage(),relative='resources/schemas/guard-result.schema.json';
 const manifestPath=path.join(pkg,'resource-manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
 assert.ok(manifest.files.some(entry=>entry.path===relative));
 fs.unlinkSync(path.join(pkg,relative));
 manifest.files=manifest.files.filter(entry=>entry.path!==relative);
 fs.writeFileSync(manifestPath,JSON.stringify(manifest));
 assert.throws(()=>checkPackage(pkg),error=>error.code==='PACKAGE_INVALID');
});
