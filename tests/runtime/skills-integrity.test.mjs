import test from 'node:test';import assert from 'node:assert/strict';import * as fs from 'node:fs';import {join} from 'node:path';
import {resourcePackage,project,snapshot} from '../helpers/installation.mjs';import {checkPackage,sha256} from '../../src/package.mjs';import {initializeProject,checkInstallation} from '../../src/installation.mjs';
const refreshed=root=>{const p=join(root,'resource-manifest.json'),m=JSON.parse(fs.readFileSync(p));m.files=m.files.filter(e=>fs.existsSync(join(root,e.path))).map(e=>{const bytes=fs.readFileSync(join(root,e.path));return {...e,bytes:bytes.length,sha256:sha256(bytes)};});fs.writeFileSync(p,JSON.stringify(m));};
test('skills integrity: one changed generated copy fails even if the outer resource manifest is refreshed',async()=>{
  const root=await resourcePackage(),file=join(root,'resources/skills/execute-task/references/common/work-contract.md');fs.appendFileSync(file,'\nChanged copy\n');refreshed(root);const before=snapshot(root,true);assert.throws(()=>checkPackage(root),e=>e.code==='PACKAGE_INVALID'&&e.details.some(x=>x.code==='SHARED_RESOURCE_DRIFT'));assert.deepEqual(snapshot(root,true),before);
});
test('skills integrity: removing a provider or shared dependency cannot be hidden by refreshing the inventory',async()=>{
  for(const file of ['resources/skills/review-work/SKILL.md','resources/skills/execute-task/references/common/spec-runtime.md']){const root=await resourcePackage();fs.unlinkSync(join(root,file));refreshed(root);const before=snapshot(root,true);assert.throws(()=>checkPackage(root),e=>e.code==='PACKAGE_INVALID');assert.deepEqual(snapshot(root,true),before);}
});
test('skills integrity: rule ownership and expected common source cannot be replaced consistently in one package',async()=>{
  const root=await resourcePackage(),path=join(root,'resources/skills/_shared/manifest.json'),m=JSON.parse(fs.readFileSync(path));m.rules[0].layers=['compensation'];fs.writeFileSync(path,JSON.stringify(m));refreshed(root);assert.throws(()=>checkPackage(root),e=>e.code==='PACKAGE_INVALID');
});
test('skills integrity: installed shared metadata stays outside native skill roots and every packaged reference is checked',async()=>{
  const packageRoot=await resourcePackage(),root=project();initializeProject({packageRoot,projectRoot:root});assert.ok(fs.existsSync(join(root,'.ai-workflow/resources/skills/_shared/manifest.json')));assert.ok(!fs.existsSync(join(root,'.agents/skills/_shared')));assert.equal(checkInstallation(root).skills.providers,11);
  fs.unlinkSync(join(root,'.agents/skills/execute-task/references/common/spec-runtime.md'));const before=snapshot(root,true);assert.throws(()=>checkInstallation(root),e=>['PACKAGE_INVALID','INCOMPLETE'].includes(e.code));assert.deepEqual(snapshot(root,true),before);
});
