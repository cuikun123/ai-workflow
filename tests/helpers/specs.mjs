import * as fs from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {project} from './installation.mjs';

export const iteration='docs/iterations/001-test';
export const specPath='docs/project/specs/sample.md';
export const hash=text=>createHash('sha256').update(text).digest('hex');
export const requirement=(id='CAP-001',scenarios=['S01'])=>
  '### Requirement: '+id+' Observable behavior\nThe system MUST preserve the declared behavior.\n\n'+
  scenarios.map(s=>'#### Scenario: '+s+' Example\n- **WHEN** the operation occurs\n- **THEN** the expected result is visible\n').join('\n');
export const specification=(body=requirement())=>'# Test fixture\n\n## Purpose\nA fictitious capability.\n\n## Scope\nThis test only.\n\n## Requirements\n\n'+body;
export const block=r=>'<!-- iterlane:record '+r.id+' -->\n```json\n'+JSON.stringify(r,null,2)+'\n```\n<!-- /iterlane:record '+r.id+' -->\n';
export function record(id,kind,data,task='T1'){
  return {record_version:2,id,kind,iteration,task,source:{role:kind==='check'||kind==='spec_sync'?'tool':kind==='confirmation'?'user':'assistant',reference:'fixture:'+id,text:'Explicit synthetic test input, not real approval or execution'},data};
}
export const task=(extra={})=>record('T1','task',{title:'A fictitious task',phase:'execute',depends_on:[],requirements:['CAP-001'],delta_refs:[],scenario_refs:[{requirement_id:'CAP-001',scenario_id:'S01'}],spec_change_reason:'No behavior change in this fixture',...extra});
export const check=(covers=[{requirement_id:'CAP-001',scenario_id:'S01'}])=>record('C1','check',{result:'passed',command:'node --test fixture.test.mjs',exit_code:0,test_count:1,evidence:[{kind:'file',path:'evidence.txt',sha256:hash('fixture')}],artifacts:[{kind:'file',path:'candidate.txt',sha256:hash('fixture')}],covers});
export function fixture(body=specification()){
  const root=project();
  for(const p of ['docs/project/specs',iteration])fs.mkdirSync(join(root,p),{recursive:true});
  for(const name of ['scope','design','tasks','verification'])fs.writeFileSync(join(root,iteration,name+'.md'),'');
  fs.writeFileSync(join(root,specPath),body);
  return {root,write:(p,text)=>fs.writeFileSync(join(root,p),text)};
}
export function historicalFixture(){
  const after=specification(requirement('CAP-002')),f=fixture(after),beforeBlock=requirement()+'\n',before=specification(beforeBlock+requirement('CAP-002'));
  const scope=iteration+'/scope.md',verification=iteration+'/verification.md',ref=id=>({path:verification,record_id:id});
  const d=record('D0','spec_delta',{base:[{path:specPath,sha256:hash(before)}],new_spec_headers:[],operations:[{operation_id:'O0',action:'REMOVED',path:specPath,requirement_id:'CAP-001',before_sha256:hash(beforeBlock),after_markdown:null,removed_scenarios:['S01'],reason:'Synthetic historical removal'}]},'T0');
  const t=task({delta_refs:[{path:scope,record_id:'D0'}],progress:{phase:'closeout',status:'completed',waiting_for:null,checkpoint_ref:null,confirmation_refs:[ref('A0')],blocker_refs:[],check_refs:[ref('C0')],review_refs:[ref('R0')],closeout_ref:ref('CL0')}});t.id=t.task='T0';
  const artifacts=[{kind:'file',path:'candidate.txt',sha256:hash('fixture')}];
  const receipt=record('S0','spec_sync',{delta_refs:[{path:scope,record_id:'D0'}],acceptance_ref:ref('A0'),check_refs:[ref('C0')],review_refs:[ref('R0')],request_id:'r0',operation_id:'o0',targets:[{path:specPath,before_sha256:hash(before),after_sha256:hash(after)}],operations:[{path:scope,record_id:'D0',operation_id:'O0'}],result:'synced'},'T0');
  const c=check();c.id='C0';c.task='T0';
  const a=record('A0','confirmation',{purpose:'task_acceptance',result:'approved',artifacts,supersedes:[]},'T0');
  const r=record('R0','review',{result:'passed',context_id:'fixture:synthetic-context',must_fix_open:0,artifacts,covers:[{requirement_id:'CAP-001',scenario_id:'S01'}],mode:'independent'},'T0');
  const close=record('CL0','closeout',{result:'completed',specs:'synced',git:'not_applicable',reason:'Synthetic historical fixture',reference:'fixture:history',artifacts,sync_ref:ref('S0')},'T0');
  f.write(scope,block(d));f.write(iteration+'/tasks.md',block(t));
  const writeReceipt=value=>f.write(verification,[c,a,r,close,value].map(block).join('\n'));writeReceipt(receipt);
  return {...f,receipt,writeReceipt,task:t};
}
