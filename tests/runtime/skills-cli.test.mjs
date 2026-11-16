import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {join} from 'node:path';
import {resourcePackage,snapshot} from '../helpers/installation.mjs';
test('skills CLI: the complete fixed package exposes a read-only shared-resource and capability check',async()=>{
  const root=await resourcePackage(),before=snapshot(root,true),result=spawnSync(process.execPath,[join(root,'bin/iterlane.mjs'),'skills','check','--package',root,'--json'],{encoding:'utf8',windowsHide:true,timeout:60000});
  assert.equal(result.status,0,result.stdout+result.stderr);const data=JSON.parse(result.stdout).data;assert.equal(data.providers,11);assert.equal(data.capabilities,10);assert.equal(data.shared_resources_consistent,true);assert.deepEqual(snapshot(root,true),before);
});
