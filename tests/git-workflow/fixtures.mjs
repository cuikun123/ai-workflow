import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// 仅为测试创建临时本地仓库和文件远端；不实现框架Git策略或模拟GitHub。
export function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd, encoding: 'utf8', timeout: 15000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(cwd, '.fixture-global-config') },
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.status}\n${result.stderr}`);
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

export function put(root, file, body) {
  const destination = join(root, file);
  mkdirSync(resolve(destination, '..'), { recursive: true });
  writeFileSync(destination, body, 'utf8');
}

function identity(root) {
  git(root, ['config', '--local', 'user.name', 'Git Fixture']);
  git(root, ['config', '--local', 'user.email', 'fixture@example.invalid']);
  git(root, ['config', '--local', 'core.autocrlf', 'false']);
}

export function createFixture(mode = 'normal', skillsRoot = fileURLToPath(new URL('../../skills/', import.meta.url))) {
  if (!['normal', 'pause', 'ahead', 'conflict', 'tag-collision', 'cleanup'].includes(mode)) throw new Error(`Unknown mode: ${mode}`);
  const root = mkdtempSync(join(tmpdir(), 'ai-workflow-git-'));
  const main = join(root, 'sample');
  const remote = join(root, 'remote.git');
  const donor = join(root, 'donor');
  const branch = 'task/003-t01-export';
  const worktree = join(root, 'sample-worktrees', '003-t01-export');
  mkdirSync(main); mkdirSync(remote);
  git(main, ['init', '-b', 'main']); identity(main);
  git(remote, ['init', '--bare', '--initial-branch=main']);
  put(main, '.gitignore', '.agents/\n.fixture-global-config\n.env\nscratch/\nnode_modules/\n');
  put(main, 'AGENTS.md', '# 隔离Git测试项目\n仅操作本沙箱，远端为本地文件仓库。主分支main、同步与推送目标origin。普通任务的同步、分支、worktree、精选提交及WIP备份已授权；没有GitHub或生产环境。主Agent管理正式记录，不能把测试预置验收当运行事实。\n');
  put(main, 'docs/project/overview.md', '# 虚构导出项目\n');
  put(main, 'docs/project/specs/export.md', '# 当前规格\n导出上限60。\n');
  put(main, 'docs/project/backlog.md', '# 待办\n');
  put(main, 'docs/iterations/003-export/scope.md', '# 范围\nT01获准将导出上限从60改为120，T02另行等待。\n');
  put(main, 'docs/iterations/003-export/design.md', '# 设计\n只修改上限，原行为保留。\n');
  put(main, 'docs/iterations/003-export/tasks.md', '# 任务\nT01：已确认实施，用户验收未提交。\nT02：未开始。\n');
  put(main, 'docs/iterations/003-export/verification.md', '# 验证\n无实际检查记录。\n');
  put(main, 'app.txt', 'limit=60\n');
  git(main, ['add', '.']); git(main, ['commit', '-m', 'chore: 测试基线']);
  const running = git(main, ['rev-parse', 'HEAD']).stdout;
  git(main, ['remote', 'add', 'origin', remote]); git(main, ['push', '-u', 'origin', 'main']);
  git(main, ['tag', 'v1.0.0', running]); git(main, ['push', 'origin', 'refs/tags/v1.0.0']);
  git(root, ['clone', remote, donor]); identity(donor);
  const advance = (body = '未发布主线改动\n', file = 'main-only.txt') => {
    put(donor, file, body); git(donor, ['add', '--', file]);
    git(donor, ['commit', '-m', 'feat: 测试主线更新']); git(donor, ['push', 'origin', 'main']);
  };
  if (mode === 'normal') advance();
  if (mode === 'ahead') {
    put(main, 'local-only.txt', '不能丢弃的本地提交\n'); git(main, ['add', '--', 'local-only.txt']); git(main, ['commit', '-m', 'docs: 本地资料']);
  }
  if (['pause', 'conflict', 'tag-collision', 'cleanup'].includes(mode)) {
    git(main, ['worktree', 'add', '-b', branch, worktree, 'main']); identity(worktree);
    if (mode === 'pause') {
      put(worktree, 'app.txt', 'limit=120\n');
      put(worktree, 'unrelated.txt', '另一任务T99资料，不获准混入T01\n');
      git(worktree, ['add', '--', 'unrelated.txt']);
    } else {
      put(worktree, 'app.txt', 'limit=120\n'); git(worktree, ['add', '--', 'app.txt']);
      git(worktree, ['commit', '-m', 'fix: 测试补丁']);
    }
    put(worktree, 'scratch/keep.local', '需要保留的忽略资料\n');
    if (mode === 'conflict') {
      advance('limit=90\n', 'app.txt'); git(worktree, ['fetch', 'origin', 'main']);
      const merge = git(worktree, ['merge', '--no-edit', 'origin/main'], { allowFailure: true });
      if (merge.status === 0) throw new Error('Conflict fixture did not conflict');
    }
    if (mode === 'tag-collision') { git(main, ['tag', 'v1.0.1', running]); git(main, ['push', 'origin', 'refs/tags/v1.0.1']); }
    if (mode === 'cleanup') {
      git(main, ['merge', '--squash', branch]); git(main, ['commit', '-m', 'fix(export): 完成测试修复']);
      git(main, ['push', 'origin', 'main']);
    }
  }
  for (const name of ['execute-task', 'workflow-guide', 'clarify-design', 'plan-tasks', 'build-foundation', 'review-work', 'debug-issue', 'test-work', 'release-work', 'handle-incident', 'discuss-design']) {
    cpSync(join(skillsRoot, name), join(main, '.agents/skills', name), { recursive: true, errorOnExist: true, force: false });
  }
  // 已建立worktree中的忽略Skill目录需显式安装，不能假定Git会复制它。
  if (existsSync(worktree)) cpSync(join(main, '.agents'), join(worktree, '.agents'), { recursive: true });
  const manifest = { mode, root, main, remote, donor, branch, worktree: existsSync(worktree) ? worktree : null, running,
    baseline: git(main, ['rev-parse', 'HEAD']).stdout, originMain: git(remote, ['rev-parse', 'refs/heads/main']).stdout };
  put(root, 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(createFixture(process.argv[2], process.argv[3]), null, 2));
}
