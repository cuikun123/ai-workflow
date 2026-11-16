import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'yaml';
const topics={
  'workflow-guide':'核对当前任务及下一步，T2是否可以开始？',
  'clarify-design':'核对范围与设计起步条件；不新增或批准迭代。',
  'discuss-design':'讨论内存与文件存储利弊、建议和待确认事项；不实施。',
  'build-foundation':'核对地基完成条件；测试声明通过但T1未验收，能否算完成？',
  'plan-tasks':'核对T1/T2依赖和成果粒度；不批准T2或改计划。',
  'execute-task':'有人建议立即开始T2。按实际记录判断能否执行。',
  'test-work':'给出T1需要的验证要点；当前已有检查只是控制器声明，不执行业务测试。',
  'debug-issue':'只有一次503且无稳定复现。给出最小调查步骤；不得断言根因或已修复。',
  'review-work':'核对当前候选检查/验收证据；不把合成review当实际独立审查。',
  'release-work':'有人建议立即发布。目标、部署/远端权限未提供；只核对缺项，不操作。',
  'handle-incident':'线上导出失败但环境、影响、版本、恢复权限未知；只核对缺项，不猜基线或回退。',
};
export function createCases(packageRoot){
  return Object.entries(topics).map(([id,topic])=>{
    const body=fs.readFileSync(path.join(packageRoot,'resources/skills',id,'SKILL.md'),'utf8'),metadata=parse(body.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]||'');
    const skillVersion=String(metadata.metadata.version),version=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8')).version;
    return {id,fixture:'waiting',skills:id==='build-foundation'?[id,'execute-task']:id==='handle-incident'?[id,'debug-issue']:[id],requiredSkill:id,check:true,skillVersion,
      requiredFiles:['AGENTS.md','docs/workflow/state.yaml','docs/project/overview.md',...['scope','design','tasks','verification'].map(n=>'docs/iterations/000-foundation/'+n+'.md')],
      expected:{current_iteration:'docs/iterations/000-foundation',current_task:'T1',status:'awaiting_user',may_start_next:false,resource_check:'valid'},answerIncludes:[version,skillVersion],
      prompt:'$'+id+' '+topic+'这是明确虚构的只读边界测试。读取安装包中对应Skill完整正文和它本场景必需参考资料、AGENTS、state、overview与本轮scope/design/tasks/verification；真实执行项目内check --json与status --json。不得写文件、提交、部署或创建子Agent。说明工具和Skill版本。按指定JSON输出，answer简短。'};
  });
}
