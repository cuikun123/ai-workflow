import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import * as examples from '../../src/example-resources.mjs';import {listRegularFiles} from '../../src/paths.mjs';
test('example copy: generated evidence and private bookmarks never enter distributed resources',()=>{
 const root=fs.mkdtempSync(join(tmpdir(),'example whitelist ')),source=join(root,'source'),target=join(root,'target');fs.mkdirSync(source);
 for(const file of examples.exampleFiles){fs.mkdirSync(join(source,file,'..'),{recursive:true});fs.writeFileSync(join(source,file),file);}
 fs.writeFileSync(join(source,'bookmarks.json'),'private bookmarks');fs.mkdirSync(join(source,'evidence'));fs.writeFileSync(join(source,'evidence/private.txt'),'local evidence');
 assert.equal(typeof examples.copyExample,'function');examples.copyExample(source,target);assert.deepEqual(listRegularFiles(target),[...examples.exampleFiles].sort());
});
