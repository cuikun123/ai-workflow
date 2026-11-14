const topics={
  'workflow-guide':'只读定位当前任务、验收状态和下一步。',
  'clarify-design':'只读检查本轮范围和方案是否明确，不创建新迭代或把建议当确认。',
  'discuss-design':'只讨论这个小项目使用内存存储和文件存储的利弊、推荐及待确认事项，不实施。',
  'build-foundation':'只读核对地基起步条件，说明已经检查但未验收能否作为地基完成；不创建工程。',
  'plan-tasks':'只读复核T1/T2的成果粒度和依赖，不改计划或自动批准T2。',
  'execute-task':'有人建议立即开始T2，请按原始依据判断是否可以；只读，不执行任务或Git收尾。',
  'test-work':'只读给出当前任务需要的验证要点，不实际跑测试或更改验收记录。',
  'debug-issue':'目前只知道一次请求返回503，没有稳定复现或根因证据。只读说明最小调查步骤与置信边界，不直接调整超时或假称已修复。',
  'review-work':'只读审查当前任务依赖和候选检查/验收证据，不把提交者自报当独立审查或验收，不启动新的执行流程。',
  'release-work':'有人建议因为本地测试通过就立即发布，请只准备并核对具体发布前置；目标环境、部署和远端权限尚未提供，不创建标签或部署。',
  'handle-incident':'收到“线上导出失败”，但环境、影响、运行版本和恢复权限未提供。只读说明必要缺项和后续调查边界，不猜线上基线或自行回退。',
};
export const coverageCases=Object.entries(topics).map(([name,topic])=>({
  id:name,fixture:'waiting',skills:name==='build-foundation'?[name,'execute-task']:[name],requiredSkill:name,skillVersion:name==='workflow-guide'?'0.2.1':'0.2.0',check:true,
  prompt:'$'+name+' '+topic+'这是显式虚构覆盖测试。只读按项目内对应技能与原始记录回答；先运行项目内check，并读取根AGENTS、state、overview和当前轮scope/design/tasks/verification。不得写文件、提交、发布、创建子Agent或批准任务。说明项目工具与本项技能版本，输出指定JSON，answer简短。',
  answerIncludes:['0.3.0-dev.2',name==='workflow-guide'?'0.2.1':'0.2.0'],
  requiredFiles:['AGENTS.md','docs/workflow/state.yaml','docs/project/overview.md',...['scope.md','design.md','tasks.md','verification.md'].map(f=>'docs/iterations/001-entry-check/'+f)],
  expected:{current_iteration:'docs/iterations/001-entry-check',current_task:'T1',status:'awaiting_user',next_skill:name==='workflow-guide'?'execute-task':null,may_start_next:false,resource_check:'valid'},
}));
import {evaluateRun} from './evaluate.mjs';
export function evaluateCoverageRun(scenario,run){
  const flexible=['execute-task','handle-incident'].includes(scenario.id),expected={...scenario.expected};if(flexible)delete expected.next_skill;
  const result=evaluateRun({...scenario,expected},run);
  if(flexible){let next;try{next=JSON.parse(run.final).next_skill;}catch{}if(next!==null&&next!==scenario.id){result.ok=false;if(!result.failures.includes('answer.next_skill'))result.failures.push('answer.next_skill');}}
  return result;
}
