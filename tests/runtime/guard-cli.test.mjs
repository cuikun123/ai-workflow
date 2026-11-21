import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {project,snapshot} from '../helpers/installation.mjs';
import {guardFixture,request} from '../helpers/guard.mjs';
import {runCli} from '../../src/cli.mjs';
import {inspectOperation} from '../../src/operation-guard.mjs';

const sourceRoot=fileURLToPath(new URL('../../',import.meta.url));
const entry=path.join(sourceRoot,'bin','iterlane.mjs');
const json=(operation,expected={})=>JSON.stringify({schema_version:1,operation,task_ref:null,expected,authorization_refs:[]});
const run=(args,cwd)=>spawnSync(process.execPath,[entry,...args],{cwd,encoding:'utf8',windowsHide:true,timeout:60000});

test('guard CLI returns the shared read-only query result without writing the project',async()=>{
 const root=await guardFixture({selected:false});
 const input=json({kind:'workflow.query',command:'status',argv:['--json']});
 const request=path.join(project(),'guard-request.json');fs.writeFileSync(request,input);
 const before=snapshot(root,true),expected=await inspectOperation(root,JSON.parse(input));
 let output='';const exit=await runCli(['guard','check','--project',root,'--input',request,'--json'],{write:s=>output+=s});
 assert.equal(exit,expected.decision==='allow'?0:7,output);assert.deepEqual(JSON.parse(output).data,expected);assert.deepEqual(snapshot(root,true),before);
});
test('guard CLI maps deny, unknown and malformed requests to stable exit categories',async()=>{
 const root=await guardFixture(),input=path.join(project(),'request.json');
 fs.writeFileSync(input,JSON.stringify(request(root,{kind:'file.mutate',changes:[{path:'outside.mjs',before_sha256:null,after:{encoding:'utf8',text:'unauthorized'}}]})));
 let output='';assert.equal(await runCli(['guard','check','--project',root,'--input',input,'--json'],{write:s=>output+=s}),7);assert.equal(JSON.parse(output).data.decision,'deny');
 fs.writeFileSync(input,JSON.stringify(request(root,{kind:'git.integrate',remote_url:'https://example.invalid/repo.git',target_branch:'main',pr:'https://example.invalid/pull/1',candidate_commit:'a'.repeat(40),base_commit:'b'.repeat(40),integration_check_ref:{path:'docs/iterations/000-foundation/verification.md',record_id:'check'},cwd:'.'})));
 output='';assert.equal(await runCli(['guard','check','--project',root,'--input',input,'--json'],{write:s=>output+=s}),8);assert.equal(JSON.parse(output).data.decision,'unknown');
 fs.writeFileSync(input,'{"schema_version":1,"schema_version":1}');output='';assert.equal(await runCli(['guard','check','--project',root,'--input',input,'--json'],{write:s=>output+=s}),2);assert.equal(JSON.parse(output).error.code,'USAGE');
 fs.writeFileSync(input,'{');output='';assert.equal(await runCli(['guard','check','--project',root,'--input',input,'--json'],{write:s=>output+=s}),2);assert.equal(JSON.parse(output).error.code,'USAGE');
});
test('guard CLI rejects symlinked and oversized request files before inspection',async()=>{
 const root=await guardFixture({selected:false}),outside=path.join(project(),'input.json'),link=path.join(project(),'linked.json');
 fs.writeFileSync(outside,json({kind:'workflow.query',command:'status',argv:[]}));fs.symlinkSync(outside,link,'file');
 let output='';assert.equal(await runCli(['guard','check','--project',root,'--input',link,'--json'],{write:s=>output+=s}),2);assert.equal(JSON.parse(output).error.code,'USAGE');
 fs.writeFileSync(outside,' '.repeat(16*1024*1024+1));output='';assert.equal(await runCli(['guard','check','--project',root,'--input',outside,'--json'],{write:s=>output+=s}),2);assert.equal(JSON.parse(output).error.code,'USAGE');
});
