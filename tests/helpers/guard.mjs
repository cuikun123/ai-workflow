import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {project, resourcePackage, snapshot} from './installation.mjs';
import {initializeProject} from '../../src/installation.mjs';
import {inspectProjectContext} from '../../src/foundation-context.mjs';
import {applyWorkflowTransition} from '../../src/workflow-journal.mjs';
import {planWorkflowTransition} from '../../src/workflow-transitions.mjs';
import {emptyPosition} from '../../src/workflow-status.mjs';
import {appendWorkflowRecord, parseWorkflowDocument, definitionDigest, replaceWorkflowRecord} from '../../src/workflow-docs.mjs';
import {sha256} from '../../src/package.mjs';
import {validateStateYaml} from '../../src/state.mjs';

export const iteration = 'docs/iterations/000-foundation', tasks = iteration + '/tasks.md', verification = iteration + '/verification.md';
export const portable = p => p.replaceAll('\\', '/');
export const read = (root, p) => fs.readFileSync(path.join(root, p));
export const state = root => validateStateYaml(read(root, 'docs/workflow/state.yaml').toString());
export const doc = (root, p) => parseWorkflowDocument(read(root, p).toString(), p);
export const ref = id => ({path:verification, record_id:id});
export const definition = (root, p) => ({kind:'definition', path:p, sha256:definitionDigest(doc(root,p))});
export const record = (id, kind, data, task='T1') => ({record_version:2, id, kind, iteration, task,
  source:{role:kind === 'confirmation' ? 'user' : kind === 'check' ? 'tool' : 'assistant', reference:'fixture:' + id,
    text:'Synthetic isolated test input; not a real approval, check or independent review'}, data});
let base, initializing;
async function initializeBase() {
 if(!initializing) initializing=(async()=>{const pkg=await resourcePackage();base=project();initializeProject({packageRoot:pkg,projectRoot:base});})();
 await initializing;
}
export async function guardFixture(options={}) {await initializeBase();return fixture(options);}
export function git(root, args) {
  const r=spawnSync('git', ['-C',root,...args], {encoding:'utf8', windowsHide:true});
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
export function apply(root, action, data={}) {
  return applyWorkflowTransition(root, {operation_version:3, request_id:action + '-' + state(root).revision,
    expected_revision:state(root).revision, action, data});
}
function fixture({bound=true, running=true, selected=true, policy=true,commands}={}) {
  const root=project(); fs.cpSync(base,root,{recursive:true,filter:p=>!portable(path.relative(base,p)).startsWith('.ai-workflow/.local')});
  git(root,['init','-b','main']); git(root,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-m','Synthetic fixture']);
  git(root,['switch','-c','task/fixture']);
  fs.writeFileSync(path.join(root,'server.mjs'),'export const value = 1;\n');
  fs.writeFileSync(path.join(root,'result.json'),'{"synthetic":true}\n');
  for(const name of ['scope','design']) fs.writeFileSync(path.join(root,iteration,name+'.md'),'# '+name+'\nSynthetic permitted input.\n');
  const progress={...emptyPosition('execute'),status:'ready',confirmation_refs:['scope','design','plan'].map(ref)};
  const declaration={title:'Synthetic guarded task',phase:'execute',depends_on:[],requirements:[],delta_refs:[],scenario_refs:[],
    spec_change_reason:'Synthetic nonbusiness fixture',execution_mode:'light',execution_reason:'Synthetic bounded fixture',
    verification_policy:{required_check_types:['command'],required_scenario_refs:[],review_mode:'independent'}};
  if(policy) declaration.guard_policy={workspace:{worktree_root:portable(root),git_common_dir:portable(path.join(root,'.git')),task_branch:'task/fixture',main_branch:'main'},
    write_paths:[{path:'server.mjs',recursive:false},{path:'src',recursive:true},{path:verification,recursive:false}],
    closeout_paths:[{path:'docs/guide.md',recursive:false},{path:verification,recursive:false}],
    commands:[{executable:portable(process.execPath),executable_sha256:sha256(fs.readFileSync(process.execPath)),argv:['--check','server.mjs'],cwd:'.'}]};
  if(commands) declaration.guard_policy.commands=commands(root);
  let text='# Tasks\n';
  for(const id of ['T1','T2']) text=appendWorkflowRecord(text,record(id,'task',{...declaration,progress:id==='T1'&&selected?progress:emptyPosition('execute')},id),tasks);
  fs.writeFileSync(path.join(root,tasks),text);
  let evidence='# Verification\n';
  for(const purpose of ['scope','design','plan']) evidence=appendWorkflowRecord(evidence,record(purpose,'confirmation',{
    purpose,result:'approved',artifacts:[definition(root,iteration+'/'+(purpose==='plan'?'tasks':purpose)+'.md')],supersedes:[]},null),verification);
  fs.writeFileSync(path.join(root,verification),evidence);
  const s=state(root);Object.assign(s,{current_task:selected?'T1':null,phase:selected?'execute':'clarify',status:selected?'ready':'not_started',confirmation_refs:selected?progress.confirmation_refs:[]});
  s.basis=s.basis.map(e=>({path:e.path,sha256:sha256(read(root,e.path))}));
  s.basis.push({path:'docs/project/specs/README.md',sha256:sha256(read(root,'docs/project/specs/README.md'))});
  fs.writeFileSync(path.join(root,'docs/workflow/state.yaml'),JSON.stringify(s));
  if(bound&&selected) apply(root,'context_bind',{iteration,task:'T1',expected_snapshot:inspectProjectContext(root).snapshot_sha256,impact:'unaffected',reason:'Synthetic fixture uses its declared constraints.'});
  if(running&&selected&&bound) apply(root,'start');
  return root;
}
export function request(root,operation,task=true) {
  return {schema_version:1,operation,task_ref:task?{path:tasks,record_id:'T1'}:null,
    expected:task?{revision:state(root).revision,context_snapshot_sha256:inspectProjectContext(root).snapshot_sha256,
      task_definition_sha256:definitionDigest(doc(root,tasks))}:{revision:state(root).revision},authorization_refs:[]};
}
export function change(root,p='server.mjs',text='export const value = 2;\n') {
  const absolute=path.join(root,p);return {path:p,before_sha256:fs.existsSync(absolute)?sha256(read(root,p)):null,after:text===null?null:{encoding:'utf8',text}};
}
