import * as fs from 'node:fs';import {posix} from 'node:path';import {TextDecoder,isDeepStrictEqual} from 'node:util';
import {projectPath,readProjectFile} from './project-paths.mjs';import {sha256} from './package.mjs';import {validateStateYaml} from './state.mjs';
import {parseWorkflowDocument,parseStrictJson} from './workflow-docs.mjs';import {WorkflowError} from './errors.mjs';
import {inspectSpecifications} from './spec-deltas.mjs';
import {foundationRoot,readFoundationSnapshot} from './foundation-context.mjs';
import {initialFoundationPaths} from './managed-blocks.mjs';

const error=(code,message)=>{throw new WorkflowError(code,message);};
export const emptyPosition=(phase='clarify')=>({phase,status:'not_started',waiting_for:null,checkpoint_ref:null,confirmation_refs:[],blocker_refs:[],check_refs:[],review_refs:[],closeout_ref:null});
export const positionFromState=(state,task)=>({...emptyPosition(state.phase),...task?.data.progress,phase:state.phase,status:state.status,waiting_for:state.waiting_for,checkpoint_ref:state.checkpoint_ref,confirmation_refs:state.confirmation_refs,blocker_refs:state.blocker_refs});
export function loadWorkflowView(root,{read=path=>readProjectFile(root,path),inventory=null}={}){
  const raw=new Map(),docs=new Map();
  const readFile=path=>{if(!raw.has(path)){const bytes=read(path);raw.set(path,bytes===null?null:Buffer.from(bytes));}return raw.get(path);};
  const text=path=>{const bytes=readFile(path);if(bytes===null)error('STATE_INVALID','Missing workflow input: '+path);try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{error('STATE_INVALID','Invalid UTF-8 workflow input');}};
  const getDoc=path=>{if(!docs.has(path))docs.set(path,parseWorkflowDocument(text(path),path));return docs.get(path);};
  const getRef=(ref,kind=null)=>{if(!ref||typeof ref.path!=='string'||typeof ref.record_id!=='string')error('STATE_INVALID','Invalid record reference');const record=getDoc(ref.path).records.get(ref.record_id);if(!record||kind&&record.kind!==kind)error('STATE_INVALID','Missing or wrong-kind record reference: '+ref.record_id);return record;};
  const state=validateStateYaml(text('docs/workflow/state.yaml'));
  const getTask=(iteration,id)=>{const task=getDoc(iteration+'/tasks.md').records.get(id);if(!task||task.kind!=='task'||task.task!==id)error('STATE_INVALID','Current task has no unique declaration');return task;};
  return {root,state,raw,docs,readFile,text,getDoc,getRef,getTask,inventory};
}
function specFiles(root,path='docs/project/specs'){
  const absolute=projectPath(root,path),stat=fs.lstatSync(absolute,{throwIfNoEntry:false});if(!stat)return [];
  if(!stat.isDirectory())error('STATE_INVALID','Specification root is not a directory');
  const files=[];for(const name of fs.readdirSync(absolute)){const child=path+'/'+name,info=fs.lstatSync(projectPath(root,child));if(info.isDirectory())files.push(...specFiles(root,child));else if(info.isFile()&&name.endsWith('.md'))files.push(child);else if(!info.isFile())error('STATE_INVALID','Unsupported specification filesystem entry');}
  if(files.length>1000)error('STATE_INVALID','Too many specification files');return files;
}
const headerSlug=line=>line.replace(/^#{1,6}\s+/u,'').trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s_-]/gu,'').replace(/\s/gu,'-');
export function inspectWorkflowView(view){
  const {state,root}=view,issues=[];
  const note=(code,message,path=null)=>issues.push({code,message,path});
  const visit=fn=>{try{return fn();}catch(e){note('INVALID_DOCUMENT',e.message);return null;}};
  const foundationBasis=state.basis.filter(e=>e.path.startsWith(foundationRoot+'/'));
  let foundationTracked=foundationBasis.length>0,foundationCurrent=true;
  try{const raw=view.readFile('.ai-workflow/manifest.json');if(raw){const manifest=parseStrictJson(new TextDecoder('utf-8',{fatal:true}).decode(raw));foundationTracked ||= manifest.state_document_paths?.some(path=>typeof path==='string'&&path.startsWith(foundationRoot+'/'))||false;}}
  catch(error){note('INVALID_INSTALLATION',error.message,'.ai-workflow/manifest.json');}
  if(foundationTracked){
    try{const snapshot=readFoundationSnapshot(root,{read:view.readFile}),wanted=foundationBasis.map(e=>e.path).sort();
      if(!isDeepStrictEqual(snapshot.entries.map(e=>e.path),wanted)){foundationCurrent=false;note('FOUNDATION_MEMBERSHIP_CHANGED','Foundation membership differs from the bookmark',foundationRoot);}
    }catch(error){foundationCurrent=false;for(const item of error.details?.length?error.details:[{code:'INVALID_FOUNDATION',message:error.message,path:foundationRoot}])note(item.code,item.message,item.path);}
  }
  visit(()=>view.getDoc('docs/project/overview.md'));
  if(state.current_iteration)for(const name of ['scope','design','tasks','verification'])visit(()=>view.getDoc(state.current_iteration+'/'+name+'.md'));
  for(const entry of state.basis)if(/^docs\/iterations\/[^/]+\/(?:tasks|verification)\.md$/u.test(entry.path))visit(()=>view.getDoc(entry.path));
  for(const file of view.inventory?view.inventory.find(x=>x.root==='docs/project/specs').paths:specFiles(root))visit(()=>view.getDoc(file));
  let task=null;
  if(state.current_task){task=visit(()=>view.getTask(state.current_iteration,state.current_task));if(task){const declared=task.data.progress||emptyPosition(task.data.phase);for(const key of ['phase','status','waiting_for','checkpoint_ref','confirmation_refs','blocker_refs'])if(!isDeepStrictEqual(declared[key],state[key]))note('INCONSISTENT_POSITION','Task progress and bookmark differ: '+key);}}
  for(const [refs,kind]of [[state.confirmation_refs,'confirmation'],[state.blocker_refs,'blocker'],[state.checkpoint_ref?[state.checkpoint_ref]:[],'checkpoint']])for(const ref of refs){try{const record=view.getRef(ref,kind);if(record.iteration!==state.current_iteration||record.task!==null&&record.task!==state.current_task)note('BAD_RECORD_REFERENCE','Reference points to another work item',ref.path);}catch(e){note('BAD_RECORD_REFERENCE',e.message,ref.path);}}
  if(task?.data.progress)for(const [refs,kind]of [[task.data.progress.check_refs,'check'],[task.data.progress.review_refs,'review'],[task.data.progress.closeout_ref?[task.data.progress.closeout_ref]:[],'closeout']])for(const ref of refs||[]){try{const record=view.getRef(ref,kind);if(record.task!==task.id||record.iteration!==task.iteration)note('BAD_RECORD_REFERENCE','Task evidence names another work item',ref.path);}catch(e){note('BAD_RECORD_REFERENCE',e.message,ref.path);}}
  const edges=new Map();
  // Iterate the live map so explicitly referenced historical documents are checked too.
  for(const doc of view.docs.values()){
    if(view.docs.size>1000)error('STATE_INVALID','Too many referenced workflow documents');
    for(const record of doc.records.values()){
      const key=doc.path+'#'+record.id,out=[];edges.set(key,out);const groups=[];
      if(record.kind==='task')groups.push([record.data.depends_on,'task',true]);
      if(record.kind==='confirmation')groups.push([record.data.supersedes,'confirmation',true]);
      if(record.kind==='resolution')groups.push([record.data.blockers,'blocker',false]);
      const position=record.kind==='task'?record.data.progress:record.data.position;
      if(position)groups.push([position.confirmation_refs,'confirmation',false],[position.blocker_refs,'blocker',false],[position.checkpoint_ref?[position.checkpoint_ref]:[],'checkpoint',false],[position.check_refs,'check',false],[position.review_refs,'review',false],[position.closeout_ref?[position.closeout_ref]:[],'closeout',false]);
      for(const [refs,kind,acyclic]of groups)for(const ref of refs||[])try{view.getRef(ref,kind);if(acyclic)out.push(ref.path+'#'+ref.record_id);}catch(e){note('BAD_RECORD_REFERENCE',e.message,ref.path);}
    }
  }
  const visiting=new Set(),visited=new Set();
  const walk=key=>{if(visiting.has(key)){note('CYCLIC_REFERENCE','Task dependency or confirmation supersedes cycle: '+key,key.split('#')[0]);return;}if(visited.has(key))return;visiting.add(key);for(const next of edges.get(key)||[])walk(next);visiting.delete(key);visited.add(key);};
  for(const key of edges.keys())walk(key);
  const requirements=new Map();
  for(const doc of view.docs.values())for(const id of doc.requirements){const key=id.toLowerCase();if(requirements.has(key))note('DUPLICATE_REQUIREMENT','Requirement ID is not unique: '+id,doc.path);else requirements.set(key,{id,path:doc.path});}
  for(const doc of view.docs.values())for(const record of doc.records.values())if(record.kind==='task'&&record.record_version===1)for(const id of record.data.requirements)if(!requirements.has(id.toLowerCase())||requirements.get(id.toLowerCase()).id!==id)note('BAD_REQUIREMENT_REFERENCE','Task requirement is missing: '+id,doc.path);
  if(task?.record_version===2)issues.push(...inspectSpecifications(root,{read:view.readFile,taskRef:{path:state.current_iteration+'/tasks.md',record_id:task.id},inventory:view.inventory}).issues);
  const checked=new Set();
  for(const doc of view.docs.values()){
    if(checked.has(doc.path))continue;checked.add(doc.path);
    for(const link of doc.links){
      if(/^[A-Za-z]:[\\/]/u.test(link.target)||link.target.startsWith('/')){note('BROKEN_LINK','Absolute filesystem links are unsupported',doc.path);continue;}
      if(/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(link.target))continue;
      try{
        const [pathname,fragment]=link.target.split('#');const target=pathname?posix.normalize(posix.join(posix.dirname(doc.path),decodeURIComponent(pathname))):doc.path;
        const absolute=projectPath(root,target),stat=fs.lstatSync(absolute,{throwIfNoEntry:false});if(!stat)throw Error('Local link target does not exist');
        if(fragment&&target.endsWith('.md')){const linked=view.getDoc(target),wanted=decodeURIComponent(fragment).toLowerCase();if(!linked.visible.some(line=>/^#{1,6}\s/u.test(line)&&headerSlug(line)===wanted))throw Error('Markdown heading anchor does not exist');}
      }catch(e){note('BROKEN_LINK',e.message,doc.path);}
    }
    if(checked.size>1000)error('STATE_INVALID','Too many linked documents');
  }
  let basisCurrent=foundationCurrent;for(const entry of state.basis){const bytes=view.readFile(entry.path),isFoundation=entry.path.startsWith(foundationRoot+'/');
    if(isFoundation&&(bytes===null||sha256(bytes)!==entry.sha256))foundationCurrent=false;
    if(bytes===null){basisCurrent=false;if(isFoundation&&!initialFoundationPaths.includes(entry.path)){if(!issues.some(e=>e.code==='FOUNDATION_MEMBERSHIP_CHANGED'))note('FOUNDATION_MEMBERSHIP_CHANGED','A bound foundation member was removed',entry.path);}else note('MISSING_BASIS','State basis file is missing',entry.path);}
    else if(sha256(bytes)!==entry.sha256){basisCurrent=false;note(isFoundation?'STALE_FOUNDATION':'STALE_BASIS','State basis content changed',entry.path);}}
  const policyCurrent=!issues.some(x=>x.code==='STALE_PLAN_CONFIRMATION'),structuralIssues=issues.filter(x=>!['STALE_BASIS','STALE_PLAN_CONFIRMATION','STALE_FOUNDATION','FOUNDATION_MEMBERSHIP_CHANGED'].includes(x.code));
  return {valid:issues.length===0,diagnostic:structuralIssues.length?'inconsistent':basisCurrent&&policyCurrent?'valid':'stale',state,basis_current:basisCurrent,foundation_tracking:foundationTracked?'tracked':'untracked',foundation_current:foundationTracked?foundationCurrent:null,policy_confirmation_current:policyCurrent,position_consistent:!issues.some(x=>x.code==='INCONSISTENT_POSITION'),issues,task,acceptance_verified:false,source_authenticity_verified:false,checks_execution_verified:false,review_independence_verified:false,document_validation:'supported_local_markdown_and_record_subset'};
}
export function inspectWorkflowState(root,options={}){try{return inspectWorkflowView(loadWorkflowView(root,options));}catch(e){return {valid:false,diagnostic:'invalid',state:null,basis_current:false,position_consistent:false,issues:[{code:e.code||'STATE_INVALID',message:e.message,path:null}],acceptance_verified:false,source_authenticity_verified:false};}}
