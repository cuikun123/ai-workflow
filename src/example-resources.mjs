import fs from 'node:fs';import {join} from 'node:path';import {listRegularFiles,resolveRegularFile} from './paths.mjs';import {WorkflowError} from './errors.mjs';
export const exampleFiles=['README.md','package.json','server.mjs','public/index.html','scripts/check.mjs','test/linked-contract.test.mjs','test/page-race.test.mjs','test/server.test.mjs'];
export function copyExample(source,target){
 const files=exampleFiles.map(path=>({path,bytes:fs.readFileSync(resolveRegularFile(source,path))}));
 for(const {path,bytes}of files){fs.mkdirSync(join(target,path,'..'),{recursive:true});fs.writeFileSync(join(target,path),bytes,{flag:'wx'});}
}
export function exampleResources(packageRoot,name){
 if(name!=='bookmarks')throw new WorkflowError('USAGE','Unknown example');const root=join(packageRoot,'resources/examples/bookmarks'),paths=listRegularFiles(root);
 if(JSON.stringify(paths)!==JSON.stringify([...exampleFiles].sort()))throw new WorkflowError('PACKAGE_INVALID','Example resource inventory differs');
 return paths.map(path=>{const after=fs.readFileSync(resolveRegularFile(root,path));if(after.length>1024*1024)throw new WorkflowError('PACKAGE_INVALID','Example file exceeds supported size');return {path,kind:'file',before:null,after};});
}
