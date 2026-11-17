import fs from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {listRegularFiles,resolveRegularFile,isWithin,assertSafeRoot} from '../src/paths.mjs';
import {copyExample} from '../src/example-resources.mjs';
import metadata from '../package.json' with {type:'json'};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(code,message)=>{const error=new Error(message);error.deliveryCode=code;throw error;};
const run=(command,args,options={})=>{const r=spawnSync(command,args,{encoding:'utf8',windowsHide:true,timeout:60000,...options});if(r.status!==0)fail('TOOL_FAILED','Delivery tool failed: '+command);return r.stdout;};
function validateSource(root,expected){
 const paths=listRegularFiles(root),bytes=fs.readFileSync(resolveRegularFile(root,'resource-manifest.json'));
 if(!/^[a-f0-9]{64}$/.test(expected)||hash(bytes)!==expected)fail('SOURCE_MISMATCH','Source manifest digest differs');
 const manifest=JSON.parse(bytes),pkg=JSON.parse(fs.readFileSync(resolveRegularFile(root,'package.json'),'utf8'));
 if(manifest.kind!=='ai-workflow-resource-package'||manifest.package.name!=='iterlane'||pkg.name!=='iterlane'||pkg.version!==manifest.package.version||!Array.isArray(manifest.files))fail('SOURCE_MISMATCH','Source package identity differs');
 const wanted=['resource-manifest.json',...manifest.files.map(e=>e.path)].sort();if(JSON.stringify(wanted)!==JSON.stringify(paths))fail('SOURCE_MISMATCH','Source inventory differs');
 for(const e of manifest.files){const content=fs.readFileSync(resolveRegularFile(root,e.path));if(content.length!==e.bytes||hash(content)!==e.sha256)fail('SOURCE_MISMATCH','Source bytes differ');}
 // Only execute a source explicitly selected and pinned by the caller.
 const checked=JSON.parse(run(process.execPath,[join(root,'bin/iterlane.mjs'),'check','--json']));if(!checked.ok||checked.version!==pkg.version)fail('SOURCE_MISMATCH','Source runtime check did not match');
 return pkg;
}
export function assembleDelivery({packageRoot,expectedManifest,outputDir}){
 const source=resolve(packageRoot),out=resolve(outputDir),pkg=validateSource(source,expectedManifest);
 if(isWithin(source,out)||isWithin(out,source))fail('OUTPUT_EXISTS','Source and output must not overlap');
 assertSafeRoot(dirname(out));
 const realParent=fs.realpathSync(dirname(out)),realOut=join(realParent,out.split(/[\\/]/).at(-1)),realSource=fs.realpathSync(source);
 if(isWithin(realSource,realOut)||isWithin(realOut,realSource))fail('OUTPUT_EXISTS','Source and output must not overlap');
 if(fs.existsSync(out))fail('OUTPUT_EXISTS','Output must be a new directory');
 fs.mkdirSync(out,{recursive:false});const stage=join(out,'contents');fs.mkdirSync(stage);
 fs.cpSync(source,join(stage,'runtime'),{recursive:true,errorOnExist:true,force:false});
 const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 fs.mkdirSync(join(stage,'examples'));copyExample(fs.existsSync(join(source,'resources/examples/bookmarks'))?join(source,'resources/examples/bookmarks'):join(repo,'examples/bookmarks'),join(stage,'examples/bookmarks'));
 fs.copyFileSync(join(source,'LICENSE'),join(stage,'LICENSE'));
 fs.writeFileSync(join(stage,'README.md'),'# Iterlane 试用包\n\n安装版本：'+pkg.version+'。本包用于内部试用，完整工具位于runtime，参考应用位于examples/bookmarks。\n\n先按quickstart.md在新目录安装，再向项目中的AI提出需求。运行例子不预置你的业务批准或验收。\n');
 fs.writeFileSync(join(stage,'quickstart.md'),'# 开始试用\n\n准备Node.js 24.18.0，将本ZIP解压并在解压目录打开终端。runtime已经是完整工具，无需再解开tgz。\n\n```powershell\nnode runtime/bin/iterlane.mjs check --json\nmkdir my-new-project\nnode runtime/bin/iterlane.mjs init --project my-new-project --preview --json\nnode runtime/bin/iterlane.mjs init --project my-new-project --json\nnode my-new-project/.ai-workflow/bin/iterlane.mjs status --json\n```\n\n本包版本为'+pkg.version+'。核对预览后再安装；当前仅用于本地新项目，不覆盖旧业务目录。打开新项目创建AI会话，先做只读状态查询，再提出自己的需求。\n\n想看应用：\n\n```powershell\nnode examples/bookmarks/server.mjs\n```\n\n终端打印端口后，在浏览器打开对应localhost地址，试添加收藏、刷新和重启后数据保留。按Ctrl+C结束。若要改应用，将examples/bookmarks内的业务源码复制到自己的新项目，不复制项目状态或批准。\n');
 if(pkg.version===metadata.version){const guide=fs.readFileSync(join(repo,'docs/quickstart.md'),'utf8').replaceAll('../scripts/README.md','runtime/README.md').replaceAll('../tests/README.md','README.md');fs.writeFileSync(join(stage,'quickstart.md'),guide);}
 const entries=listRegularFiles(stage).map(path=>({path,sha256:hash(fs.readFileSync(join(stage,path)))}));
 fs.writeFileSync(join(stage,'SHA256SUMS'),entries.map(e=>e.sha256+'  '+e.path).join('\n')+'\n');
 const archive=join(out,'iterlane-'+pkg.version+'-trial.zip');run('tar',['-a','-cf',archive,'-C',stage,...fs.readdirSync(stage).sort()]);
 const verified=join(out,'verified');fs.mkdirSync(verified);run('tar',['-xf',archive,'-C',verified]);
 if(JSON.stringify(listRegularFiles(verified))!==JSON.stringify([...entries.map(e=>e.path),'SHA256SUMS'].sort()))fail('SOURCE_MISMATCH','Archive inventory differs');
 for(const e of entries)if(hash(fs.readFileSync(resolveRegularFile(verified,e.path)))!==e.sha256)fail('SOURCE_MISMATCH','Archive bytes differ');
 validateSource(source,expectedManifest);validateSource(join(verified,'runtime'),expectedManifest);
 const result={name:pkg.name,version:pkg.version,archive,archive_sha256:hash(fs.readFileSync(archive)),source_manifest_sha256:expectedManifest,files:entries.length,source_bytes_preserved:true};
 fs.writeFileSync(join(out,'delivery.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(join(out,'SHA256SUMS'),result.archive_sha256+'  '+archive.split(/[\\/]/).at(-1)+'\n');return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const args=process.argv.slice(2);if(args.length!==6||args[0]!=='--package'||args[2]!=='--expected-manifest'||args[4]!=='--out')fail('USAGE','deliver --package <complete package> --expected-manifest <sha256> --out <new directory>');console.log(JSON.stringify(assembleDelivery({packageRoot:args[1],expectedManifest:args[3],outputDir:args[5]})));}
 catch(error){console.log(JSON.stringify({ok:false,error:{code:error.deliveryCode||'SOURCE_MISMATCH',message:error.message}}));process.exitCode=1;}
}
