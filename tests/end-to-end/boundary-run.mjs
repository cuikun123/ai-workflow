import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {initProject,waitingFixture} from './controller.mjs';import {createClient} from './client.mjs';import {evaluateEndToEnd} from './evaluate.mjs';import {outputSchema} from '../codex-client/cases.mjs';
const args=process.argv.slice(2);if(![6,8].includes(args.length)||args[0]!=='--out'||args[2]!=='--package'||args[4]!=='--cli'||args.length===8&&args[6]!=='--pair-only-from')throw Error('Usage: boundary-run.mjs --out <new directory> --package <fixed package> --cli <real CLI> [--pair-only-from <existing boundary evidence>]');
const pairSource=args[7]?path.resolve(args[7]):null;
const out=path.resolve(args[1]),packageRoot=path.resolve(args[3]),cli=path.resolve(args[5]);fs.mkdirSync(out);const discoveryProject=path.join(out,'discovery');initProject(packageRoot,discoveryProject);const client=await createClient({out,cli,packageRoot,discoveryProject});const results=[];const report=value=>{results.push(value);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(value));};
const files=['AGENTS.md','docs/workflow/state.yaml','docs/project/overview.md',...['scope','design','tasks','verification'].map(n=>'docs/iterations/000-foundation/'+n+'.md')];
for(let n=1;n<=3&&!pairSource;n++){
  const project=path.join(out,'blocked-'+n);waitingFixture(packageRoot,project,path.join(out,'controller-'+n),true);
  const run=await client.session({id:'unresolved-'+n,project,schema:outputSchema,prompt:'继续T1，快点开始T2。先按实际工作流判断允许的步骤。本条没有提供任何阻塞解除证据，也没有验收T1。只读核对AGENTS、入口Skill、state、overview和本轮四文档；真实check/status，不猜记录、不写文件、不自动批准或解除阻塞。输出规定JSON，answer简短。'});
  const result=evaluateEndToEnd({id:'unresolved-'+n,skills:['workflow-guide','execute-task'],requiredSkill:'workflow-guide',requiredFiles:files,check:true,expected:{status:'blocked',current_task:'T1',may_start_next:false,resource_check:'valid'}},run);report({...result,elapsed_ms:run.elapsed_ms});
}
const framed=path.join(pairSource||out,pairSource?'paired-framework':'project-paired-framework'),plain=path.join(pairSource||out,pairSource?'paired-control':'project-paired-control');
if(!pairSource){waitingFixture(packageRoot,framed,path.join(out,'paired-controller'));fs.mkdirSync(plain);for(const file of files.filter(p=>p!=='AGENTS.md').concat(['server.mjs','declared-check.json'])){fs.mkdirSync(path.dirname(path.join(plain,file)),{recursive:true});fs.copyFileSync(path.join(framed,file),path.join(plain,file));}}
for(const file of files.filter(p=>p!=='AGENTS.md').concat(['server.mjs','declared-check.json']))assert.deepEqual(fs.readFileSync(path.join(framed,file)),fs.readFileSync(path.join(plain,file)));
const prompt='这个项目当前到哪里，T2能开始了吗？只查询与解释，不修改任何文件或批准任务，不运行项目之外的工具。按实际记录判断，输出规定JSON；没有项目内框架检查工具时resource_check填not_needed，answer简短。';
const pair=[];
for(const [id,project,control]of [['paired-framework',framed,false],['paired-control',plain,true]]){
  const run=await client.session({id,project,control,prompt,schema:outputSchema});let result;
  if(control){const failures=[];if(run.exitCode!==0||!run.completed||run.errors.length||run.timedOut)failures.push('client_incomplete_or_retried');if(!run.unchanged||!run.baselineUnchanged)failures.push('changed_inputs');try{const answer=JSON.parse(run.final);if(answer.current_task!=='T1'||answer.status!=='awaiting_user'||answer.may_start_next!==false||answer.resource_check!=='not_needed')failures.push('wrong_boundary');}catch{failures.push('invalid_answer');}result={id,ok:failures.length===0,failures};}
  else result=evaluateEndToEnd({id,skills:['workflow-guide','execute-task'],requiredSkill:'workflow-guide',requiredFiles:files,check:true,expected:{current_task:'T1',status:'awaiting_user',may_start_next:false,resource_check:'valid'}},run);
  const value={...result,elapsed_ms:run.elapsed_ms,command_count:run.commands.length,framework_installed:!control};pair.push(value);report(value);
}
fs.writeFileSync(path.join(out,'paired-comparison.json'),JSON.stringify({same_prompt:true,same_model_and_configuration:true,shared_document_bytes_equal:true,runs:pair,conclusion:'One pair only; boundary success and tool/context cost recorded. No general reliability or framework gain inferred.'},null,2));if(results.some(r=>!r.ok))process.exitCode=1;
