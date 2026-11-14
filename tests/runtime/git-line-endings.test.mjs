import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {project, resourcePackage, snapshot} from '../helpers/installation.mjs';
import {initializeProject, planInstallation, checkInstallation} from '../../src/installation.mjs';
import {validateStateYaml} from '../../src/state.mjs';

let packageRoot;
before(async()=>{packageRoot=await resourcePackage();});
const original=Buffer.from('# Existing project rules\r\n* text=auto\r\n*.js eol=crlf\r\n');
const options=root=>({packageRoot,projectRoot:root});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const conflict=fn=>assert.throws(fn,e=>['CONFLICT','INCOMPLETE'].includes(e.code));
const evidence=(name,value)=>{if(process.env.ITERLANE_GIT_EOL_EVIDENCE)fs.writeFileSync(join(process.env.ITERLANE_GIT_EOL_EVIDENCE,name),JSON.stringify(value,null,2));};
function interrupted(root,target,after=false){let fired=false;const io={...fs,renameSync(from,to){if(!fired&&to===join(root,target)){fired=true;if(after)fs.renameSync(from,to);throw Object.assign(new Error('Injected write interruption'),{code:'EIO'});}return fs.renameSync(from,to);}};assert.throws(()=>initializeProject({...options(root),io}),e=>e.code==='EIO');assert.equal(fired,true);}
function git(root,args){const result=spawnSync('git',['-c','core.autocrlf=true','-c','core.safecrlf=false','-c','commit.gpgSign=false','-c','core.hooksPath='+join(root,'disabled-hooks'),'-c','user.name=Line Ending Fixture','-c','user.email=eol@example.invalid',...args],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000});assert.equal(result.status,0,result.stderr||result.error?.message);return result.stdout;}

test('Git checkout preserves installed bytes and basis while unrelated files retain text conversion',()=>{
  const root=project(),checkout=project();fs.writeFileSync(join(root,'.gitattributes'),original);
  fs.writeFileSync(join(root,'main.js'),'export const value = 1;\n');
  fs.mkdirSync(join(root,'.agents/skills/foreign'),{recursive:true});fs.writeFileSync(join(root,'.agents/skills/foreign/SKILL.md'),'External skill\n');
  initializeProject(options(root));
  const stateFile=join(root,'docs/workflow/state.yaml'),state=validateStateYaml(fs.readFileSync(stateFile,'utf8'));
  for(const entry of state.basis){const bytes=Buffer.from('First evidence line\r\nSecond evidence line\n');fs.writeFileSync(join(root,entry.path),bytes);entry.sha256=hash(bytes);}
  fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n');
  const manifest=JSON.parse(fs.readFileSync(join(root,'.ai-workflow/manifest.json')));
  const protectedPaths=[...manifest.files.map(x=>x.path),...manifest.blocks.map(x=>x.path),'.ai-workflow/manifest.json','docs/workflow/state.yaml',...state.basis.map(x=>x.path)];
  const before=Object.fromEntries(protectedPaths.map(p=>[p,hash(fs.readFileSync(join(root,p)))]));
  git(root,['init','-b','main']);git(root,['add','--all']);git(root,['commit','-m','Fixture installed framework']);git(checkout,['clone','--no-local','--',root,checkout]);
  const after=Object.fromEntries(protectedPaths.map(p=>[p,hash(fs.readFileSync(join(checkout,p)))]));
  let check,error;try{check=checkInstallation(checkout);}catch(e){error={code:e.code,message:e.message};}
  const report={fixtureOnly:true,root,checkout,before,after,check,error,ordinaryCode:fs.readFileSync(join(checkout,'main.js'),'utf8'),foreignSkill:fs.readFileSync(join(checkout,'.agents/skills/foreign/SKILL.md'),'utf8')};evidence('git-checkout-'+(check?'green':'red')+'.json',report);
  assert.equal(error,undefined,JSON.stringify(error));assert.equal(check.resources,'valid');assert.deepEqual(after,before);
  const restored=validateStateYaml(fs.readFileSync(join(checkout,'docs/workflow/state.yaml'),'utf8'));
  for(const entry of restored.basis)assert.equal(hash(fs.readFileSync(join(checkout,entry.path))),entry.sha256);
  assert.equal(report.ordinaryCode,'export const value = 1;\r\n');assert.equal(report.foreignSkill,'External skill\r\n');
  evidence('git-checkout-green.json',{...report,protectedFilesVerified:protectedPaths.length,unrelatedConversionVerified:true});
});

test('attributes preview is read-only and repeated init preserves existing rules',()=>{
  const root=project();fs.writeFileSync(join(root,'.gitattributes'),original);const initial=snapshot(root,true);
  assert.ok(planInstallation(options(root)).files.some(f=>f.path==='.gitattributes'));
  assert.deepEqual(snapshot(root,true),initial);initializeProject(options(root));
  const bytes=fs.readFileSync(join(root,'.gitattributes'));assert.ok(bytes.subarray(0,original.length).equals(original));
  const installed=snapshot(root,true);assert.equal(initializeProject(options(root)).action,'unchanged');assert.deepEqual(snapshot(root,true),installed);
});

test('attributes missing block needs explicit repair and changed block cannot be overwritten',()=>{
  const root=project();fs.writeFileSync(join(root,'.gitattributes'),original);initializeProject(options(root));
  const file=join(root,'.gitattributes'),installed=fs.readFileSync(file);
  fs.writeFileSync(file,original);conflict(()=>initializeProject(options(root)));
  assert.equal(initializeProject({...options(root),mode:'repair'}).action,'repaired');assert.ok(fs.readFileSync(file).equals(installed));assert.equal(checkInstallation(root).resources,'valid');
  fs.writeFileSync(file,installed.toString().replace('/.ai-workflow/** -text','/.ai-workflow/** text'));
  const changed=snapshot(root,true);conflict(()=>checkInstallation(root));conflict(()=>initializeProject({...options(root),mode:'repair'}));assert.deepEqual(snapshot(root,true),changed);
});

test('attributes interruption before or after replacement safely resumes',()=>{
  for(const after of [false,true]){const root=project();fs.writeFileSync(join(root,'.gitattributes'),original);interrupted(root,'.gitattributes',after);
    assert.equal(initializeProject({...options(root),mode:'resume'}).action,'resumed');assert.equal(checkInstallation(root).resources,'valid');assert.ok(fs.readFileSync(join(root,'.gitattributes')).subarray(0,original.length).equals(original));}
});

test('attributes undo restores original bytes and preserves rules added outside the block',()=>{
  for(const additions of [false,true]){const root=project();fs.writeFileSync(join(root,'.gitattributes'),original);interrupted(root,'.ai-workflow/manifest.json');
    const file=join(root,'.gitattributes'),extra=Buffer.from('\n# User additions\r\n*.png binary\r\n');assert.ok(fs.readFileSync(file).includes(Buffer.from('# iterlane:attributes:begin')));if(additions)fs.appendFileSync(file,extra);
    assert.equal(initializeProject({...options(root),mode:'undo'}).action,'undone');const bytes=fs.readFileSync(file);assert.ok(bytes.subarray(0,original.length).equals(original));
    assert.equal(bytes.includes(Buffer.from('# iterlane:attributes:begin')),false);if(additions)assert.ok(bytes.includes(extra));else assert.ok(bytes.equals(original));}
  const root=project();interrupted(root,'.ai-workflow/manifest.json');assert.equal(initializeProject({...options(root),mode:'undo'}).action,'undone');assert.equal(fs.existsSync(join(root,'.gitattributes')),false);
});

test('malformed or unowned attributes markers fail before any installation write',()=>{
  for(const content of ['# iterlane:attributes:begin\n','x\n# iterlane:attributes:end\n','# iterlane:attributes:begin\n* -text\n# iterlane:attributes:end\n']){const root=project();fs.writeFileSync(join(root,'.gitattributes'),content);const initial=snapshot(root,true);conflict(()=>initializeProject(options(root)));assert.deepEqual(snapshot(root,true),initial);}
});

test('ambiguous attributes preimages cannot lose a newline or delete an existing empty file during recovery',()=>{
  for(const mode of ['resume','undo'])for(const kind of ['trailing-newline','empty-file']){
    const root=project(),file=join(root,'.gitattributes');fs.writeFileSync(file,kind==='empty-file'?Buffer.alloc(0):original);interrupted(root,'.ai-workflow/manifest.json');
    const operations=join(root,'.ai-workflow/.local/operations'),journalFile=join(operations,fs.readdirSync(operations)[0],'journal.json'),journal=JSON.parse(fs.readFileSync(journalFile));
    const entry=journal.files.find(entry=>entry.path==='.gitattributes');
    entry.before=kind==='empty-file'?null:Buffer.from(entry.before,'base64').subarray(0,-1).toString('base64');fs.writeFileSync(journalFile,JSON.stringify(journal));
    const changed=snapshot(root,true);conflict(()=>initializeProject({...options(root),mode}));assert.deepEqual(snapshot(root,true),changed);
  }
});
