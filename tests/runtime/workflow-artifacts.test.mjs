import test from 'node:test';import assert from 'node:assert/strict';
import * as fs from 'node:fs';import {join} from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {project} from '../helpers/installation.mjs';
import {parseWorkflowDocument,definitionDigest} from '../../src/workflow-docs.mjs';
const load=()=>import('../../src/workflow-artifacts.mjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
function git(root,args){const r=spawnSync('git',['-c','core.autocrlf=true','-c','core.safecrlf=false','-c','commit.gpgSign=false','-c','core.hooksPath='+join(root,'disabled-hooks'),'-c','user.name=Workflow Fixture','-c','user.email=workflow@example.invalid',...args],{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}

test('workflow artifacts: bytes, definition and Git are distinct evidence domains',async()=>{
  const {checkArtifact}=await load(),root=project(),path='docs/iterations/001-work/scope.md';fs.mkdirSync(join(root,'docs/iterations/001-work'),{recursive:true});
  const bytes=Buffer.from('# Approved scope\r\n');fs.writeFileSync(join(root,path),bytes);
  assert.equal(checkArtifact(root,{kind:'file',path,sha256:hash(bytes)}).valid,true);
  const definition=definitionDigest(parseWorkflowDocument(bytes.toString(),path));assert.notEqual(definition,hash(bytes));
  assert.equal(checkArtifact(root,{kind:'definition',path,sha256:definition}).valid,true);
  assert.equal(checkArtifact(root,{kind:'file',path,sha256:definition}).valid,false);
  fs.appendFileSync(join(root,path),'A real changed requirement\n');assert.equal(checkArtifact(root,{kind:'definition',path,sha256:definition}).valid,false);
});

test('workflow artifacts: unsafe paths and invented kinds cannot become valid evidence',async()=>{
  const {checkArtifact}=await load(),root=project();
  for(const artifact of [{kind:'file',path:'../outside',sha256:'a'.repeat(64)},{kind:'anything',path:'safe',sha256:'a'.repeat(64)},{kind:'git',commit:'HEAD',scope:['server.mjs']}])assert.throws(()=>checkArtifact(root,artifact),e=>e.code==='STATE_INVALID');
  assert.equal(checkArtifact(root,{kind:'file',path:'missing',sha256:'a'.repeat(64)}).valid,false);
});

test('workflow Git artifacts: actual commit survives line conversion and detects changed or untracked scoped code',async()=>{
  const {checkArtifact}=await load(),root=project(),clone=project();fs.mkdirSync(join(root,'src'));fs.writeFileSync(join(root,'src/server.mjs'),'export const value = 1;\n');
  git(root,['init','-b','main']);git(root,['add','--all']);git(root,['commit','-m','Workflow evidence']);const commit=git(root,['rev-parse','HEAD']);git(clone,['clone','--no-local','--',root,clone]);
  const artifact={kind:'git',commit,scope:['src']};assert.equal(checkArtifact(clone,artifact).valid,true);
  fs.writeFileSync(join(clone,'src/server.mjs'),'export const value = 2;\n');assert.equal(checkArtifact(clone,artifact).valid,false);assert.equal(checkArtifact(clone,artifact,{current:false}).valid,true);
  git(clone,['restore','--','src/server.mjs']);fs.writeFileSync(join(clone,'src/new.mjs'),'new code\n');assert.equal(checkArtifact(clone,artifact).valid,false);
});

test('workflow Git artifacts: filters and ancestor repositories are not silently trusted',async()=>{
  const {checkArtifact}=await load(),root=project();fs.writeFileSync(join(root,'server.mjs'),'export const value=1;\n');git(root,['init','-b','main']);git(root,['add','--all']);git(root,['commit','-m','Scope']);const commit=git(root,['rev-parse','HEAD']);
  fs.writeFileSync(join(root,'.gitattributes'),'*.mjs filter=custom\n');const result=checkArtifact(root,{kind:'git',commit,scope:['server.mjs']});assert.equal(result.valid,false);assert.match(result.reason,/filter|encoding/i);
  const child=join(root,'child');fs.mkdirSync(child);assert.equal(checkArtifact(child,{kind:'git',commit,scope:['server.mjs']}).valid,false);
});

test('workflow Git artifacts: newly staged scoped files cannot execute external clean filters',async()=>{
  const {checkArtifact}=await load(),root=project();fs.mkdirSync(join(root,'src'));fs.writeFileSync(join(root,'src/a.mjs'),'old\n');git(root,['init','-b','main']);git(root,['add','--all']);git(root,['commit','-m','Accepted']);const commit=git(root,['rev-parse','HEAD']);
  const script=join(root,'filter.cjs'),marker=join(root,'filter-ran');fs.writeFileSync(script,"const fs=require('node:fs');fs.writeFileSync("+JSON.stringify(marker)+",'executed');process.stdout.write(fs.readFileSync(0));");
  git(root,['config','filter.fixture.clean','"'+process.execPath.replaceAll('\\','/')+'" "'+script.replaceAll('\\','/')+'"']);fs.writeFileSync(join(root,'.gitattributes'),'src/new.mjs filter=fixture\n');fs.writeFileSync(join(root,'src/new.mjs'),'export const n=1;\n');git(root,['add','--','src/new.mjs']);fs.unlinkSync(marker);fs.writeFileSync(join(root,'src/new.mjs'),'export const n=2;\n');
  assert.equal(checkArtifact(root,{kind:'git',commit,scope:['src']}).valid,false);assert.equal(fs.existsSync(marker),false,'read-only evidence check must reject before any filter executes');
});

test('workflow Git artifacts: ignored new files inside an explicit accepted scope invalidate it',async()=>{
  const {checkArtifact}=await load(),root=project();fs.mkdirSync(join(root,'src'));fs.writeFileSync(join(root,'src/a.mjs'),'old\n');fs.writeFileSync(join(root,'.gitignore'),'src/ignored.mjs\n');git(root,['init','-b','main']);git(root,['add','--all']);git(root,['commit','-m','Accepted']);const commit=git(root,['rev-parse','HEAD']);fs.writeFileSync(join(root,'src/ignored.mjs'),'new ignored source\n');
  assert.equal(checkArtifact(root,{kind:'git',commit,scope:['src']}).valid,false);
});
