import test from 'node:test';import assert from 'node:assert/strict';import * as fs from 'node:fs';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {project,snapshot} from '../helpers/installation.mjs';import {renderSingleSkill,renderSkillResources} from '../../src/skill-bundles.mjs';import {inspectSkillProvider,skillPolicy,validateSkillManifest} from '../../src/skill-resources.mjs';
const source=fileURLToPath(new URL('../../skills',import.meta.url));
test('skill bundles: source rule edits can rebuild an intact previous output while corruption still blocks replacement',()=>{
  const repo=fileURLToPath(new URL('../../',import.meta.url)),artifacts=join(repo,'.artifacts');fs.mkdirSync(artifacts,{recursive:true});const copy=fs.mkdtempSync(join(artifacts,'skills-rebuild-'));
  for(const path of ['src','scripts','skills','schemas','templates','sources','examples','docs','adapters','package.json','package-lock.json','LICENSE','AGENTS.md','CONTRIBUTING.md','CHANGELOG.md','SECURITY.md'])fs.cpSync(join(repo,path),join(copy,path),{recursive:true});
  fs.mkdirSync(join(copy,'tests'));fs.copyFileSync(join(repo,'tests/README.md'),join(copy,'tests/README.md'));
  const out=join(project(),'bundle'),build=()=>spawnSync(process.execPath,[join(copy,'scripts/build.mjs'),'--out',out],{cwd:copy,encoding:'utf8',windowsHide:true,timeout:60000});
  const first=build();assert.equal(first.status,0,first.stdout+first.stderr);
  const policyPath=join(copy,'skills/_shared/manifest.json'),policy=JSON.parse(fs.readFileSync(policyPath));policy.rules[0].retire_when+=' New source revision.';fs.writeFileSync(policyPath,JSON.stringify(policy,null,2));
  fs.appendFileSync(join(copy,'skills/_shared/references/work-contract.md'),'\nUpdated shared source.\n');const rebuilt=build();assert.equal(rebuilt.status,0,rebuilt.stdout+rebuilt.stderr);
  assert.match(fs.readFileSync(join(out,'resources/skills/execute-task/references/common/work-contract.md'),'utf8'),/Updated shared source/);
  fs.appendFileSync(join(out,'resources/skills/execute-task/references/common/work-contract.md'),'\nCorrupt generated copy\n');const before=snapshot(out,true),blocked=build();assert.notEqual(blocked.status,0);assert.deepEqual(snapshot(out,true),before);
});
test('skill bundles: execution entry and its references remain usable without sibling skills or a source checkout',()=>{
  const out=join(project(),'execute-task');renderSingleSkill(source,'execute-task',out);const before=snapshot(out,true),result=inspectSkillProvider(out,'execute-task');assert.equal(result.valid,true,JSON.stringify(result.issues));assert.ok(result.bytes<=10240);assert.ok(result.lines<=150);assert.ok(fs.existsSync(join(out,'references/common/spec-runtime.md')));assert.deepEqual(snapshot(out,true),before);
});
test('skill manifest: unknown providers, capability IDs and missing rule ownership are rejected',()=>{
  for(const edit of [p=>p.capabilities[0].provider='missing-provider',p=>p.capabilities[0].id='unknown-capability',p=>p.rules[0].layers=[],p=>p.rules[0].retire_when='']){const p=structuredClone(skillPolicy);edit(p);assert.throws(()=>validateSkillManifest(p));}
});
test('skill bundles: generated common resources cannot be silently maintained inside the source provider',()=>{
  const root=project(),copy=join(root,'skills');fs.cpSync(source,copy,{recursive:true});fs.mkdirSync(join(copy,'execute-task/references/common'),{recursive:true});fs.writeFileSync(join(copy,'execute-task/references/common/work-contract.md'),'Manual stale copy');assert.throws(()=>renderSingleSkill(copy,'execute-task',join(root,'out')));
});

test('skill bundles: undeclared source documentation is not copied into user skills',()=>{
  const root=project(),copy=join(root,'skills'),out=join(root,'bundle');fs.cpSync(source,copy,{recursive:true});
  fs.writeFileSync(join(copy,'execute-task/README.md'),'# Maintainer notes\n');
  fs.writeFileSync(join(copy,'_shared/README.md'),'# Maintainer shared notes\n');
  renderSkillResources(copy,out);
  assert(!fs.existsSync(join(out,'execute-task/README.md')));
  assert(!fs.existsSync(join(out,'_shared/README.md')));
  assert.equal(inspectSkillProvider(join(out,'execute-task'),'execute-task').valid,true);
});
