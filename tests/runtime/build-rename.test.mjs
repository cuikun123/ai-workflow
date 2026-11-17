import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {renameDirectory} from '../../scripts/build-rename.mjs';
test('build rename: transient sharing denial retries the unchanged directory and preserves its data',()=>{
 const root=fs.mkdtempSync(join(tmpdir(),'iterlane rename ')),from=join(root,'from'),to=join(root,'to');fs.mkdirSync(from);fs.writeFileSync(join(from,'source.txt'),'Source bytes');let first=true;
 renameDirectory(from,to,{rename(a,b){if(first){first=false;throw Object.assign(Error('Sharing denied'),{code:'EPERM'});}return fs.renameSync(a,b);},delays:[1]});assert.equal(fs.readFileSync(join(to,'source.txt'),'utf8'),'Source bytes');assert(!fs.existsSync(from));
});
test('build rename: an output created during denial is not replaced or deleted',()=>{
 const root=fs.mkdtempSync(join(tmpdir(),'iterlane rename ')),from=join(root,'from'),to=join(root,'to');fs.mkdirSync(from);fs.writeFileSync(join(from,'source.txt'),'Source bytes');
 assert.throws(()=>renameDirectory(from,to,{rename(){fs.mkdirSync(to);fs.writeFileSync(join(to,'user.txt'),'User bytes');throw Object.assign(Error('Sharing denied'),{code:'EPERM'});},delays:[1]}));assert.equal(fs.readFileSync(join(from,'source.txt'),'utf8'),'Source bytes');assert.equal(fs.readFileSync(join(to,'user.txt'),'utf8'),'User bytes');
});
