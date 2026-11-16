import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {current,record,ref,definition,artifact,task} from '../helpers/workflow.mjs';
export {current,record,ref,definition,artifact};
// Test declarations are always labelled synthetic. Persistence is real CLI.
export function controller(project, evidenceDirectory){
  fs.mkdirSync(evidenceDirectory,{recursive:true});
  const f={root:project,iteration:'docs/iterations/000-foundation'};
  const prefix=createHash('sha256').update(path.resolve(evidenceDirectory)).digest('hex').slice(0,12);
  let sequence=Math.max(0,...fs.readdirSync(evidenceDirectory).map(name=>Number(name.match(/^controller-(\d+)\.json$/)?.[1]||0)));
  function cli(args){const r=spawnSync(process.execPath,[path.join(project,'.ai-workflow/bin/iterlane.mjs'),...args,'--json'],{cwd:project,encoding:'utf8',windowsHide:true,timeout:60000});let value;try{value=JSON.parse(r.stdout);}catch{}return {exitCode:r.status,value,stderr:r.stderr,error:r.error?.code};}
  function apply(action,data={}){
    const id='controller-'+String(++sequence).padStart(4,'0'),input={operation_version:1,request_id:'controller-'+prefix+'-'+sequence,expected_revision:current(project).revision,action,data},file=path.join(evidenceDirectory,id+'.json');
    fs.writeFileSync(file,JSON.stringify(input,null,2));const result=cli(['transition','--input',file]);fs.writeFileSync(path.join(evidenceDirectory,id+'-result.json'),JSON.stringify(result,null,2));
    if(result.exitCode!==0)throw Error('Installed transition '+action+' failed: '+JSON.stringify(result));return result.value;
  }
  const add=value=>apply('record',{record:value});
  function declare(id,phase='execute',dependencies=[]){const t=task(f,id,dependencies);t.data.phase=phase;add(t);}
  function approvals(){const refs=[];for(const [purpose,name]of [['scope','scope'],['design','design'],['plan','tasks']]){const id='approved-'+purpose;add(record(f,id,'confirmation',{purpose,result:'approved',artifacts:[definition(f,f.iteration+'/'+name+'.md')],supersedes:[]},null));refs.push(ref(f,id));}return refs;}
  return {f,cli,apply,add,declare,approvals};
}
export function initProject(packageRoot,project){fs.mkdirSync(project);const result=spawnSync(process.execPath,[path.join(packageRoot,'bin/iterlane.mjs'),'init','--project',project,'--json'],{encoding:'utf8',windowsHide:true,timeout:60000});if(result.status!==0)throw Error('Real package init failed: '+result.stdout+result.stderr);return JSON.parse(result.stdout);}
export function waitingFixture(packageRoot,project,evidenceDirectory,blocked=false){
  initProject(packageRoot,project);const d=controller(project,evidenceDirectory),{f}=d;
  for(const [name,text]of [['scope','Synthetic Node loopback bookmark project. T1 health foundation, T2 persistence after T1 acceptance.'],['design','Node built-in HTTP, JSON persistence. Local disposable tests only; no production or GitHub authority.'],['tasks','T1 foundation then T2 bookmarks.'],['verification','All initial confirmations, checks and reviews below are synthetic controller declarations. They are not actual user acceptance or independent review.']])fs.writeFileSync(path.join(project,f.iteration,name+'.md'),'# '+name+'\n'+text+'\n');
  fs.writeFileSync(path.join(project,'docs/project/overview.md'),'# Synthetic bookmark project\nT1 awaits user acceptance. T2 may not start yet.\n');fs.writeFileSync(path.join(project,'server.mjs'),'export const value=1;\n');fs.writeFileSync(path.join(project,'declared-check.json'),'{"synthetic":true}\n');
  d.declare('T1','build');d.declare('T2','execute',[ref(f,'T1','tasks')]);const confirmations=d.approvals();d.apply('prepare',{iteration:f.iteration,task:'T1',confirmations});d.apply('start');d.apply('verify');
  d.add(record(f,'check','check',{result:'passed',command:'synthetic controller declaration, no actual test',exit_code:0,test_count:1,evidence:[artifact(f,'declared-check.json')],artifacts:[artifact(f)]}));
  d.add(record(f,'review','review',{result:'passed',context_id:'synthetic-controller-only',must_fix_open:0,artifacts:[artifact(f)]}));
  d.apply('await',{waiting_for:'task_acceptance',check_refs:[ref(f,'check')],review_refs:[ref(f,'review')]});
  if(blocked){d.add(record(f,'unresolved','blocker',{reason:'Missing external prerequisite',condition:'Actual resolution evidence required'}));d.apply('block',{blocker_refs:[ref(f,'unresolved')],reason:'Synthetic unresolved blocker'});}
  return d;
}
