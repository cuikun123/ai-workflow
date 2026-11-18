import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resourcePackage} from '../helpers/installation.mjs';
import {snapshot} from '../helpers/installation.mjs';
import {brokenDocumentLinks} from '../helpers/document-links.mjs';
import {assertUserPackage} from '../helpers/user-package.mjs';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const scratch=()=>fs.mkdtempSync(join(tmpdir(),'iterlane delivery '));
const run=args=>spawnSync(process.execPath,['scripts/deliver.mjs',...args],{encoding:'utf8',windowsHide:true,timeout:60000});
test('delivery: exported ZIP installs the exact supplied package and runs the example',async()=>{
 const pkg=await resourcePackage(),out=join(scratch(),'output');
 const inventoryPath=join(pkg,'resource-manifest.json'),inventory=JSON.parse(fs.readFileSync(inventoryPath,'utf8'));
 for(const path of ['docs/usage.md','docs/quickstart.md']){
  const file=join(pkg,path);fs.appendFileSync(file,'\nPinned source document marker.\n');
  const entry=inventory.files.find(item=>item.path===path);entry.bytes=fs.statSync(file).size;entry.sha256=hash(file);
 }
 fs.writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+'\n');
 const r=run(['--package',pkg,'--expected-manifest',hash(join(pkg,'resource-manifest.json')),'--out',out]);assert.equal(r.status,0,r.stdout+r.stderr);
 const result=JSON.parse(r.stdout),expanded=join(scratch(),'expanded');fs.mkdirSync(expanded);
 const unzip=spawnSync('tar',['-xf',result.archive,'-C',expanded],{encoding:'utf8',windowsHide:true});assert.equal(unzip.status,0,unzip.stderr);
 assert.ok(fs.existsSync(join(expanded,'docs/usage.md')), 'The ZIP must include the usage tutorial');
 assertUserPackage(expanded);
 assertUserPackage(join(expanded,'runtime'));
 assert.deepEqual(brokenDocumentLinks(expanded), [], 'ZIP document links must resolve to the promised files and headings');
 const guide=fs.readFileSync(join(expanded,'docs/quickstart.md'),'utf8');
 assert.match(guide,/Pinned source document marker\./);
 const support=guide.match(/\[支持范围[^\]]*\]\(([^)]+)\)/);assert.ok(support, 'Installation instructions must link to user support information');
 const target=join(expanded,'docs',support[1].split('#')[0]);
 assert.notEqual(target,join(expanded,'README.md'));assert.ok(fs.existsSync(target));
 const prose=text=>text.replace(/\]\([^)]+\)/gu,']');
 assert.equal(prose(fs.readFileSync(join(expanded,'docs/usage.md'),'utf8')),prose(fs.readFileSync(join(pkg,'docs/usage.md'),'utf8')), 'Delivery preserves source tutorial prose while relocating links');
 for(const e of JSON.parse(fs.readFileSync(join(pkg,'resource-manifest.json'),'utf8')).files)assert.equal(hash(join(expanded,'runtime',e.path)),e.sha256,e.path);
 const project=join(scratch(),'project');fs.mkdirSync(project);
 const init=spawnSync(process.execPath,[join(expanded,'runtime/bin/iterlane.mjs'),'init','--project',project,'--json'],{encoding:'utf8',windowsHide:true});assert.equal(init.status,0,init.stdout+init.stderr);
 const spec=spawnSync(process.execPath,[join(project,'.ai-workflow/bin/iterlane.mjs'),'spec','check','--json'],{encoding:'utf8',windowsHide:true});assert.equal(spec.status,0,spec.stdout+spec.stderr);
 assert.equal(JSON.parse(spec.stdout).version,JSON.parse(fs.readFileSync(join(pkg,'package.json'),'utf8')).version);
 const example=spawnSync(process.execPath,['--test','test/server.test.mjs'],{cwd:join(expanded,'examples/bookmarks'),encoding:'utf8',windowsHide:true});assert.equal(example.status,0,example.stdout+example.stderr);
 assert.match(fs.readFileSync(join(expanded,'quickstart.md'),'utf8'),/runtime\/bin\/iterlane\.mjs/);
});
test('delivery: linked output parents are rejected before any source writes',async()=>{
 const pkg=await resourcePackage(),root=scratch(),alias=join(root,'alias');fs.symlinkSync(pkg,alias,process.platform==='win32'?'junction':'dir');
 const before=snapshot(pkg,true),r=run(['--package',pkg,'--expected-manifest',hash(join(pkg,'resource-manifest.json')),'--out',join(alias,'trial')]);
 assert.notEqual(r.status,0);assert(!fs.existsSync(join(pkg,'trial')));assert.deepEqual(snapshot(pkg,true),before);
});
test('delivery: wrong source digest and existing output never overwrite user files',async()=>{
 const pkg=await resourcePackage(),root=scratch(),out=join(root,'output');
 const args=['--package',pkg,'--expected-manifest','0'.repeat(64),'--out',out];const invalid=run(args);assert.notEqual(invalid.status,0);assert.equal(JSON.parse(invalid.stdout).error.code,'SOURCE_MISMATCH');assert(!fs.existsSync(out));
 fs.mkdirSync(out);fs.writeFileSync(join(out,'keep.txt'),'User data');args[3]=hash(join(pkg,'resource-manifest.json'));const conflict=run(args);assert.notEqual(conflict.status,0);assert.equal(JSON.parse(conflict.stdout).error.code,'OUTPUT_EXISTS');assert.equal(fs.readFileSync(join(out,'keep.txt'),'utf8'),'User data');assert.deepEqual(fs.readdirSync(out),['keep.txt']);
});
