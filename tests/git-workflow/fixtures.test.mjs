import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createFixture, git, put } from './fixtures.mjs';

test('Git装置：fetch和快进更新后同级worktree基于一致main', () => {
  const f = createFixture('normal');
  assert.notEqual(f.baseline, f.originMain);
  git(f.main, ['fetch', 'origin', 'main']); git(f.main, ['merge', '--ff-only', 'origin/main']);
  assert.equal(git(f.main, ['rev-parse', 'HEAD']).stdout, f.originMain);
  const target = join(f.root, 'sample-worktrees/003-t02-next');
  git(f.main, ['worktree', 'add', '-b', 'task/003-t02-next', target, 'main']);
  assert.equal(git(target, ['rev-parse', 'HEAD']).stdout, f.originMain);
  assert.equal(git(f.main, ['branch', '--show-current']).stdout, 'main');
  assert.equal(readFileSync(join(target, 'main-only.txt'), 'utf8'), '未发布主线改动\n');
});

test('Git装置：精选WIP不混入其他暂存内容，本地保存与远端备份分开核对', () => {
  const f = createFixture('pause');
  git(f.worktree, ['restore', '--staged', '--', 'unrelated.txt']);
  git(f.worktree, ['add', '--', 'app.txt']);
  assert.equal(git(f.worktree, ['diff', '--cached', '--name-only']).stdout, 'app.txt');
  git(f.worktree, ['commit', '-m', 'wip: 保存导出任务断点']);
  const saved = git(f.worktree, ['rev-parse', 'HEAD']).stdout;
  assert.equal(git(f.remote, ['show-ref', '--verify', `refs/heads/${f.branch}`], { allowFailure: true }).status, 128);
  git(f.worktree, ['push', '-u', 'origin', f.branch]);
  assert.equal(git(f.remote, ['rev-parse', `refs/heads/${f.branch}`]).stdout, saved);
  assert.equal(readFileSync(join(f.worktree, 'unrelated.txt'), 'utf8'), '另一任务T99资料，不获准混入T01\n');
  assert.equal(git(f.worktree, ['ls-files', '--', 'unrelated.txt']).stdout, '');
});

test('Git装置：主分支领先与未解决Merge冲突可真实观察', () => {
  const f = createFixture('ahead');
  assert.equal(git(f.main, ['rev-list', '--left-right', '--count', 'main...origin/main']).stdout, '1\t0');
  const c = createFixture('conflict');
  assert.ok(git(c.worktree, ['ls-files', '-u']).stdout);
  assert.ok(existsSync(join(c.main, '.git/worktrees/003-t01-export/MERGE_HEAD')));
});

test('Git装置：固定发布标签保留原补丁，与Squash主线提交分别定位', () => {
  const f = createFixture('cleanup');
  const patch = git(f.worktree, ['rev-parse', 'HEAD']).stdout;
  git(f.worktree, ['tag', 'v1.0.1', patch]); git(f.worktree, ['push', 'origin', 'refs/tags/v1.0.1']);
  assert.notEqual(patch, git(f.main, ['rev-parse', 'HEAD']).stdout);
  assert.equal(git(f.remote, ['rev-parse', 'refs/tags/v1.0.1']).stdout, patch);
  // Squash后普通祖先检查不会报告任务分支已合并，不能代替PR/内容核对。
  assert.equal(git(f.main, ['merge-base', '--is-ancestor', patch, 'main'], { allowFailure: true }).status, 1);
});

test('Git装置：标签冲突失败保留原引用，失败推送保留本地提交', () => {
  const f = createFixture('tag-collision');
  const original = git(f.main, ['rev-parse', 'v1.0.1']).stdout;
  assert.equal(git(f.worktree, ['tag', 'v1.0.1', 'HEAD'], { allowFailure: true }).status, 128);
  assert.equal(git(f.main, ['rev-parse', 'v1.0.1']).stdout, original);
  put(f.remote, 'hooks/pre-receive', '#!/bin/sh\nexit 1\n');
  assert.notEqual(git(f.worktree, ['push', 'origin', f.branch], { allowFailure: true }).status, 0);
  assert.ok(git(f.worktree, ['rev-parse', 'HEAD']).stdout);
  assert.equal(git(f.remote, ['show-ref', '--verify', `refs/heads/${f.branch}`], { allowFailure: true }).status, 128);
});

test('Git装置：干净status仍有忽略资料，普通worktree移除会删除它', () => {
  const f = createFixture('cleanup');
  assert.equal(git(f.worktree, ['status', '--porcelain']).stdout, '');
  assert.match(git(f.worktree, ['ls-files', '--others', '--ignored', '--exclude-standard']).stdout, /scratch\/keep\.local/);
  const retained = readFileSync(join(f.worktree, 'scratch/keep.local'), 'utf8');
  put(f.root, 'retained/keep.local', retained);
  assert.equal(readFileSync(join(f.root, 'retained/keep.local'), 'utf8'), retained);
  git(f.main, ['worktree', 'remove', f.worktree]);
  assert.equal(existsSync(f.worktree), false);
  assert.ok(git(f.main, ['branch', '--list', f.branch]).stdout);
});
