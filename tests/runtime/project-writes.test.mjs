import test from 'node:test';import assert from 'node:assert/strict';import * as fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {durableWrite} from '../../src/project-writes.mjs';
const contention=()=>Object.assign(new Error('Native Windows transient contention'),{code:'EPERM'});
const setup=()=>{const root=fs.mkdtempSync(join(tmpdir(),'durable contention '));fs.writeFileSync(join(root,'target.txt'),'before');return root;};
test('durable writes: a short Windows rename refusal retries the same verified bytes',()=>{
 assert.equal(process.platform,'win32');const root=setup();let attempts=0;
 durableWrite(root,'target.txt',Buffer.from('after'),Buffer.from('before'),{...fs,renameSync(a,b){if(++attempts===1)throw contention();return fs.renameSync(a,b);}},[]);
 assert.equal(attempts,2);assert.equal(fs.readFileSync(join(root,'target.txt'),'utf8'),'after');
});
test('durable writes: contention followed by user edits never replaces the changed target',()=>{
 const root=setup();let attempts=0;const io={...fs,renameSync(){attempts++;fs.writeFileSync(join(root,'target.txt'),'user edit');throw contention();}};
 assert.throws(()=>durableWrite(root,'target.txt',Buffer.from('after'),Buffer.from('before'),io,[]),e=>e.code==='CONFLICT');assert.equal(attempts,1);assert.equal(fs.readFileSync(join(root,'target.txt'),'utf8'),'user edit');
});
test('durable writes: changed temporary content is preserved and never published',()=>{
 const root=setup();let temporary;const io={...fs,renameSync(a){temporary=a;fs.writeFileSync(a,'foreign temporary');throw contention();}};
 assert.throws(()=>durableWrite(root,'target.txt',Buffer.from('after'),Buffer.from('before'),io,[]),e=>e.code==='CONFLICT');assert.equal(fs.readFileSync(join(root,'target.txt'),'utf8'),'before');assert.equal(fs.readFileSync(temporary,'utf8'),'foreign temporary');
});
test('durable writes: persistent contention is bounded and unrelated IO errors are not retried',()=>{
 for(const code of ['EPERM','EIO']){const root=setup();let attempts=0;assert.throws(()=>durableWrite(root,'target.txt',Buffer.from('after'),Buffer.from('before'),{...fs,renameSync(){attempts++;throw Object.assign(new Error('Refused'),{code});}},[]),e=>e.code===code);assert.equal(attempts,code==='EPERM'?4:1);assert.equal(fs.readFileSync(join(root,'target.txt'),'utf8'),'before');}
});
