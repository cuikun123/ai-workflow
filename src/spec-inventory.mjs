import * as fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectPath} from './project-paths.mjs';
import {assertPortablePath} from './paths.mjs';
import {WorkflowError} from './errors.mjs';

const roots=['docs/iterations','docs/project/specs'];
const fail=message=>{throw new WorkflowError('STATE_INVALID',message);};
const sha=paths=>createHash('sha256').update(JSON.stringify(paths)).digest('hex');
const belongs=(root,path)=>path.startsWith(root+'/')&&(root==='docs/project/specs'?/\.md$/iu.test(path):/\/(?:scope|tasks|verification)\.md$/u.test(path));
export function validateSpecInventory(value){
  if(!Array.isArray(value)||value.length!==2)fail('Invalid specification inventory');
  let count=0;const aliases=new Set();
  for(let i=0;i<roots.length;i++){
    const entry=value[i];
    if(!entry||Object.keys(entry).sort().join(',')!=='paths,root,sha256'||entry.root!==roots[i]||!Array.isArray(entry.paths)||entry.paths.some(p=>typeof p!=='string'||!belongs(entry.root,p)))fail('Invalid specification inventory root/member');
    if(JSON.stringify(entry.paths)!==JSON.stringify([...entry.paths].sort())||entry.sha256!==sha(entry.paths))fail('Specification inventory is unsorted or damaged');
    for(const path of entry.paths){assertPortablePath(path);const id=path.normalize('NFC').toLowerCase();if(aliases.has(id))fail('Aliased specification inventory member');aliases.add(id);}
    count+=entry.paths.length;
  }
  if(count>1000)fail('Specification/record inventory exceeds 1000 documents');
  return value;
}
export function readSpecInventory(root,{additionalPaths=[]}={}){
  let count=0,directories=0;const directoryPaths=new Set();
  const result=roots.map(base=>{
    const paths=[];
    function scan(folder){
      const file=projectPath(root,folder),stat=fs.lstatSync(file,{throwIfNoEntry:false});if(!stat)return;
      if(!stat.isDirectory())fail('Expected a real specification/record directory');
      if(++directories>1000)fail('Specification/record directory inventory exceeds 1000 directories');
      directoryPaths.add(folder);
      for(const entry of fs.readdirSync(file,{withFileTypes:true})){
        const path=folder+'/'+entry.name;projectPath(root,path);
        if(entry.isDirectory())scan(path);
        else if(!entry.isFile())fail('Nonregular specification inventory entry');
        else if(belongs(base,path)){if(++count>1000)fail('Specification/record inventory exceeds 1000 documents');paths.push(path);}
      }
    }
    scan(base);paths.sort();return {root:base,paths,sha256:sha(paths)};
  });
  for(const path of additionalPaths){
    const base=roots.find(root=>belongs(root,path));if(!base)continue;projectPath(root,path);
    let parent=path.slice(0,path.lastIndexOf('/'));
    while(parent===base||parent.startsWith(base+'/')){if(!directoryPaths.has(parent)){directoryPaths.add(parent);if(++directories>1000)fail('Planned specification/record directory inventory exceeds its 1000 directory limit');}if(parent===base)break;parent=parent.slice(0,parent.lastIndexOf('/'));}
  }
  return validateSpecInventory(result);
}
export function changeSpecInventory(inventory,changes){
  validateSpecInventory(inventory);
  return inventory.map(entry=>{
    const paths=new Set(entry.paths);
    for(const {path,exists}of changes)if(belongs(entry.root,path)){if(exists)paths.add(path);else paths.delete(path);}
    const sorted=[...paths].sort();return {root:entry.root,paths:sorted,sha256:sha(sorted)};
  });
}
