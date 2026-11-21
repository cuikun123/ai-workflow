import { run } from 'node:test';
import { readdirSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateTestEvents } from './check-results.mjs';
import { buildPackage } from './build.mjs';
import { sha256 } from '../src/package.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const required = ['tests/runtime/state.test.mjs', 'tests/runtime/paths.test.mjs', 'tests/runtime/cli.test.mjs', 'tests/runtime/distribution.test.mjs', 'tests/runtime/ci.test.mjs', 'tests/git-workflow/fixtures.test.mjs', 'tests/lifecycle/fixtures.test.mjs', 'tests/lifecycle/package.test.mjs', 'tests/issue-debugging/package.test.mjs', 'tests/requirements-design/package.test.mjs', 'tests/task-execution/package.test.mjs', 'tests/task-planning/package.test.mjs', 'tests/work-review/package.test.mjs', 'tests/work-testing/package.test.mjs'];
required.push('tests/runtime/skill-resources.test.mjs');
required.push('tests/runtime/installation.test.mjs', 'tests/runtime/install-recovery.test.mjs');
required.push('tests/codex-client/evaluate.test.mjs');
required.push('tests/codex-client/coverage.test.mjs');
required.push('tests/runtime/git-line-endings.test.mjs');
required.push('tests/runtime/workflow-docs.test.mjs','tests/runtime/workflow-artifacts.test.mjs','tests/runtime/workflow-status.test.mjs','tests/runtime/workflow-transitions.test.mjs','tests/runtime/workflow-recovery.test.mjs','tests/runtime/workflow-cli.test.mjs');
required.push('tests/runtime/foundation-context.test.mjs','tests/runtime/context-binding.test.mjs');
required.push('tests/codex-client/state-events.test.mjs');
required.push('tests/runtime/diagnostics.test.mjs','tests/runtime/recovery.test.mjs','tests/runtime/diagnostics-cli.test.mjs');
required.push('tests/codex-client/doctor-evaluate.test.mjs');
required.push('tests/runtime/version-plans.test.mjs','tests/runtime/version-recovery.test.mjs','tests/runtime/version-cli.test.mjs','tests/runtime/version-faults.test.mjs');
required.push('tests/runtime/version-audit.test.mjs');
required.push('tests/runtime/version-boundaries.test.mjs');
required.push('tests/end-to-end/evaluate.test.mjs','tests/end-to-end/deployment.test.mjs','tests/end-to-end/controller.test.mjs');
required.push('tests/end-to-end/cases.test.mjs');
required.push('tests/end-to-end/review.test.mjs');
required.push('tests/end-to-end/client-journal.test.mjs','tests/end-to-end/transcript.test.mjs','tests/end-to-end/operations.test.mjs');
required.push('tests/end-to-end/audit.test.mjs');
required.push('tests/end-to-end/progress-evidence.test.mjs');
required.push('tests/codex-client/realpath-evidence.test.mjs');
required.push('tests/runtime/spec-docs.test.mjs','tests/runtime/spec-deltas.test.mjs','tests/runtime/spec-cli.test.mjs');
required.push('tests/runtime/spec-sync.test.mjs','tests/runtime/spec-sync-recovery.test.mjs','tests/runtime/spec-sync-cli.test.mjs','tests/runtime/spec-sync-workflow.test.mjs','tests/runtime/spec-sync-process.test.mjs');
required.push('tests/runtime/spec-inputs.test.mjs','tests/runtime/skill-bundles.test.mjs','tests/runtime/skills-cli.test.mjs','tests/runtime/skills-integrity.test.mjs');
required.push('tests/runtime/verification-policy.test.mjs','tests/runtime/verification-cli.test.mjs');
required.push('tests/end-to-end/chunk-evidence.test.mjs');
required.push('tests/end-to-end/chunk-gate.test.mjs');
required.push('tests/end-to-end/client-package.test.mjs','tests/end-to-end/work-metrics.test.mjs');
required.push('tests/end-to-end/optimization-fixtures.test.mjs');
required.push('tests/runtime/artifact-inspect.test.mjs','tests/runtime/client-probe.test.mjs','tests/runtime/example-init.test.mjs','tests/runtime/example-copy.test.mjs','tests/runtime/delivery.test.mjs','tests/runtime/build-rename.test.mjs','tests/end-to-end/usability-evaluate.test.mjs');
required.push('tests/runtime/project-writes.test.mjs','tests/end-to-end/usability-evidence.test.mjs');
required.push('tests/runtime/document-rules.test.mjs');
required.push('tests/runtime/guard-contract.test.mjs','tests/runtime/operation-guard.test.mjs','tests/runtime/operation-git.test.mjs','tests/runtime/guard-cli.test.mjs','tests/runtime/guard-distribution.test.mjs');
function tests(directory) { return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? tests(join(directory, entry.name)) : entry.name.endsWith('.test.mjs') ? [join(directory, entry.name)] : []); }
mkdirSync(join(root, '.artifacts'), { recursive: true });
const events = [];
try {
  for await (const event of run({ files: tests(join(root, 'tests')), concurrency: 1 })) events.push(event);
  const result = evaluateTestEvents(events, required.map(file => join(root, file)));
  const built = await buildPackage();
  const generatedDocs = spawnSync(process.execPath, ['--test', 'tests/runtime/document-rules.test.mjs'], {
    cwd: root,
    env: {...process.env, ITERLANE_DOC_ROOT: built.output},
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  });
  if (generatedDocs.status !== 0) throw new Error('Generated documentation checks failed: ' + (generatedDocs.error?.code || generatedDocs.stdout + generatedDocs.stderr));
  const artifacts = join(root, '.artifacts');
  const npmCli = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const packed = spawnSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', artifacts], { cwd: built.output, encoding: 'utf8', windowsHide: true, timeout: 60000 });
  if (packed.status !== 0) throw new Error('Evidence npm pack failed: ' + (packed.error?.code || packed.stderr));
  const filename = JSON.parse(packed.stdout)[0].filename;
  const artifact = { filename, sha256: sha256(readFileSync(join(artifacts, filename))) };
  for (const name of ['resource-manifest.json', 'dependency-manifest.json']) cpSync(join(built.output, name), join(artifacts, name));
  const evidence = { ok: true, node: process.version, platform: process.platform, tests: result, package: built, artifact, resource_manifest_sha256: sha256(readFileSync(join(built.output, 'resource-manifest.json'))) };
  writeFileSync(join(artifacts, 'check-result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.error(error.message); for (const event of events.filter(e => e.type === 'test:fail')) console.error(JSON.stringify(event));
  writeFileSync(join(root, '.artifacts/check-result.json'), JSON.stringify({ ok: false, message: error.message }, null, 2)); process.exitCode = 1;
} finally {
  writeFileSync(join(root, '.artifacts/test-events.jsonl'), events.map(e => JSON.stringify(e, (k, v) => v instanceof Error ? { message: v.message, stack: v.stack, ...v } : v)).join('\n') + '\n');
}
