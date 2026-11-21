import * as fs from 'node:fs';
import {join,relative} from 'node:path';
import {project,resourcePackage,snapshot} from './installation.mjs';
import {initializeProject} from '../../src/installation.mjs';
import {parseWorkflowDocument,renderWorkflowRecord,definitionDigest} from '../../src/workflow-docs.mjs';
import {emptyPosition} from '../../src/workflow-status.mjs';
import {parseSpecification,digest} from '../../src/spec-docs.mjs';
import {applyWorkflowTransition} from '../../src/workflow-journal.mjs';
import {validateStateYaml} from '../../src/state.mjs';import {inspectProjectContext} from '../../src/foundation-context.mjs';import {initialFoundationPaths} from '../../src/managed-blocks.mjs';

export {snapshot};
export const iteration='docs/iterations/001-sync',specPath='docs/project/specs/title.md';
export const req=(id,limit)=>'### Requirement: '+id+' Limit\nThe limit MUST be '+limit+'.\n\n#### Scenario: S01 Boundary\n- **WHEN** the limit is checked\n- **THEN** '+limit+' is accepted\n';
export const header='# Synthetic capability\n\n## Purpose\nExplicit fictitious test input.\n\n## Scope\nThis test only.\n\n## Requirements\n\n';
export const ref=(id,name='verification')=>({path:iteration+'/'+name+'.md',record_id:id});
export const record=(id,kind,data,task='T1')=>({record_version:2,id,kind,iteration,task,source:{role:['confirmation'].includes(kind)?'user':['check','spec_sync'].includes(kind)?'tool':'assistant',reference:'fixture:'+id,text:'Synthetic test input; not actual user approval or execution'},data});
let packagePromise,installedBasePromise;
export async function syncFixture({mode='MODIFIED',accepted=true,nextTask=false,onlyRequirement=false,crlf=false,bom=false,verification=null,fixedPackage=null,projectRoot=null,initialize=true,guardPolicy}={}){
  const packageRoot=fixedPackage||await(packagePromise??=resourcePackage()),root=projectRoot||project();if(initialize){if(!fixedPackage&&!projectRoot){const base=await(installedBasePromise??=Promise.resolve().then(()=>{const base=project();initializeProject({packageRoot,projectRoot:base});return base;}));fs.cpSync(base,root,{recursive:true,filter:path=>!relative(base,path).replaceAll('\\','/').startsWith('.ai-workflow/.local')});}else initializeProject({packageRoot,projectRoot:root});}
  fs.mkdirSync(join(root,iteration),{recursive:true});
  const write=(path,text)=>fs.writeFileSync(join(root,path),text),read=path=>fs.readFileSync(join(root,path),'utf8');
  for(const name of ['scope','design','tasks','verification'])write(iteration+'/'+name+'.md','# '+name+'\nSynthetic fixture only.\n');
  write('candidate.txt','Actual delivered fixture content\n');write('evidence.txt','Explicit synthetic check input\n');
  const source=header+req('CAP-001',60)+(onlyRequirement?'':'\n'+req('CAP-002',10)),before=(bom?'\ufeff':'')+(crlf?source.replaceAll('\n','\r\n'):source);write(specPath,before);
  const path=mode==='ADDED'?'docs/project/specs/nested/new.md':specPath;
  const oldRaw=parseSpecification(before,specPath).sections.get('CAP-001').raw;
  const replacement=mode==='ADDED'?req('CAP-003',120):oldRaw.replaceAll('60','120');
  const id=mode==='ADDED'?'CAP-003':'CAP-001';
  const d=mode==='NONE'?null:record('D1','spec_delta',{base:[{path,sha256:mode==='ADDED'?null:digest(before)}],new_spec_headers:mode==='ADDED'?[{path,markdown:header}]:[],operations:[{operation_id:'O1',action:mode,path,requirement_id:id,before_sha256:mode==='ADDED'?null:digest(oldRaw),after_markdown:mode==='REMOVED'?null:replacement,removed_scenarios:mode==='REMOVED'?['S01']:[],reason:'Explicit synthetic accepted change'}]});
  const progress={...emptyPosition(accepted?'closeout':'accept'),status:accepted?'ready':'awaiting_user',waiting_for:accepted?null:'task_acceptance',confirmation_refs:accepted?[ref('A1')]:[],check_refs:[ref('C1')],review_refs:[ref('R1')]};
  const t=record('T1','task',{title:'Deliver the first synthetic result',phase:'execute',depends_on:[],requirements:mode==='NONE'?[]:[id],delta_refs:d?[ref('D1','scope')]:[],scenario_refs:mode==='NONE'?[]:[{requirement_id:id,scenario_id:'S01'}],spec_change_reason:mode==='NONE'?'Only an engineering result':'Explicit declared fixture change',progress});
  if(guardPolicy)t.data.guard_policy=guardPolicy(root);
  if(verification)Object.assign(t.data,{execution_mode:verification.mode,execution_reason:'Explicit synthetic verification policy; no claim of actual risk',verification_policy:{required_check_types:[verification.check_type],required_scenario_refs:t.data.scenario_refs,review_mode:verification.review_mode}});
  const extra=nextTask?record('T2','task',{title:'Not accepted second fixture result',phase:'execute',depends_on:[ref('T1','tasks')],requirements:['CAP-002'],delta_refs:[ref('D2','scope')],scenario_refs:[{requirement_id:'CAP-002',scenario_id:'S01'}],spec_change_reason:'Not yet accepted fixture',progress:emptyPosition('execute')},'T2'):null;
  const d2=nextTask?record('D2','spec_delta',{base:[{path:specPath,sha256:digest(before)}],new_spec_headers:[],operations:[{operation_id:'O2',action:'MODIFIED',path:specPath,requirement_id:'CAP-002',before_sha256:digest(parseSpecification(before,specPath).sections.get('CAP-002').raw),after_markdown:req('CAP-002',20),removed_scenarios:[],reason:'Second task remains unaccepted'}]},'T2'):null;
  write(iteration+'/scope.md','# Scope\nExplicitly synthetic first and second task plan.\n'+[d,d2].filter(Boolean).map(renderWorkflowRecord).join('\n'));
  write(iteration+'/tasks.md','# Tasks\n'+[t,extra].filter(Boolean).map(renderWorkflowRecord).join('\n'));
  const definition=path=>({kind:'definition',path,sha256:definitionDigest(parseWorkflowDocument(read(path),path))});
  const artifacts=[{kind:'file',path:'candidate.txt',sha256:digest(read('candidate.txt'))},definition(iteration+'/scope.md'),definition(iteration+'/tasks.md')];
  const covers=t.data.scenario_refs;
  const c=record('C1','check',{result:'passed',command:'Explicit synthetic test input, not an execution claim',exit_code:0,test_count:1,evidence:[{kind:'file',path:'evidence.txt',sha256:digest(read('evidence.txt'))}],artifacts,covers});
  const r=record('R1','review',{result:'passed',context_id:'fixture:independent-context',must_fix_open:0,artifacts,covers,mode:'independent'});
  if(verification){const type=verification.check_type;Object.assign(c.data,{check_type:type,command:type==='observation'?null:c.data.command,exit_code:type==='observation'?null:0,test_count:type==='test_suite'?1:null});if(type==='observation')Object.assign(c.data,{method:'Synthetic observed input',expected:'fixture',actual:'fixture'});r.data.mode=verification.review_mode;if(r.data.mode==='simplified')r.data.context_id='fixture:main-context';}
  const a=accepted?record('A1','confirmation',{purpose:'task_acceptance',result:'approved',artifacts,supersedes:[]}):null;
  const approvals=['scope','design','plan'].map(purpose=>record('approved-'+purpose,'confirmation',{purpose,result:'approved',artifacts:[definition(iteration+'/'+(purpose==='plan'?'tasks':purpose)+'.md')],supersedes:[]},null));
  write(iteration+'/verification.md','# Verification\n'+[...approvals,c,r,a].filter(Boolean).map(renderWorkflowRecord).join('\n'));
  const state={schema_version:1,revision:0,current_iteration:iteration,current_task:'T1',phase:progress.phase,status:progress.status,waiting_for:progress.waiting_for,checkpoint_ref:null,confirmation_refs:progress.confirmation_refs,blocker_refs:[],basis:[...['scope','design','tasks','verification'].map(name=>iteration+'/'+name+'.md'),'docs/project/specs/README.md',specPath,...initialFoundationPaths].map(path=>({path,sha256:digest(read(path))})),updated_at:'2026-11-15T00:00:00Z'};
  write('docs/workflow/state.yaml',JSON.stringify(state));
  let serial=0;
  const current=()=>validateStateYaml(read('docs/workflow/state.yaml'));
  const request=(action,data={},id='fixture-'+(++serial))=>({operation_version:3,request_id:id,expected_revision:current().revision,action,data});
  const bindContext=(id='fixture-context-T1')=>applyWorkflowTransition(root,request('context_bind',{iteration,task:current().current_task,expected_snapshot:inspectProjectContext(root).snapshot_sha256,impact:'unaffected',reason:'Synthetic context prerequisite for the explicitly staged fixture.'},id));
  bindContext();
  const syncRequest=id=>request('spec_sync',{iteration,task:'T1'},id||'sync-T1');
  return {root,packageRoot,path,before,replacement,id,task:t,delta:d,artifacts,bind:()=>bindContext('fixture-context-'+(++serial)),write,read,current,request,syncRequest,apply:(action,data,id)=>applyWorkflowTransition(root,request(action,data,id))};
}
