import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStateYaml } from '../../src/state.mjs';
import { stringify } from 'yaml';

export const initial = () => ({
  schema_version: 1, revision: 0, current_iteration: 'docs/iterations/000-foundation',
  current_task: null, phase: 'clarify', status: 'not_started', waiting_for: null,
  checkpoint_ref: null, confirmation_refs: [], blocker_refs: [], basis: [],
  updated_at: '2026-11-13T00:00:00Z',
});
const encode = state => JSON.stringify(state);
const invalid = text => assert.throws(() => validateStateYaml(text), error => error.code === 'STATE_INVALID');

test('state: valid initial and waiting states remain unchanged', () => {
  assert.deepEqual(validateStateYaml(encode(initial())), initial());
  assert.deepEqual(validateStateYaml(stringify(initial())), initial());
  validateStateYaml(encode({ ...initial(), updated_at: '2026-11-13T00:00:00.123Z' }));
  validateStateYaml(encode({ ...initial(), updated_at: '2026-11-13T00:00:00.000Z' }));
  const waiting = { ...initial(), current_task: 'T1', phase: 'accept', status: 'awaiting_user', waiting_for: 'task_acceptance' };
  assert.deepEqual(validateStateYaml(encode(waiting)), waiting);
});

test('state: schema rejects unknown fields, versions, coerced values and missing fields', () => {
  for (const patch of [{ unexpected: true }, { schema_version: 2 }, { revision: '0' }, { revision: -1 }, { updated_at: '2026-02-30T00:00:00Z' }, { updated_at: 'yesterday' }]) invalid(encode({ ...initial(), ...patch }));
  const state = initial(); delete state.revision; invalid(encode(state));
});

test('state: waiting, blocked, paused and task combinations are constrained', () => {
  for (const patch of [
    { status: 'awaiting_user' }, { waiting_for: 'task_acceptance' }, { status: 'blocked' },
    { status: 'paused' }, { current_iteration: null }, { phase: 'execute', status: 'running' },
    { current_task: 'T1', phase: 'accept', status: 'awaiting_user', waiting_for: 'plan_confirmation' },
    { phase: 'closeout', status: 'ready', current_task: 'T1' },
  ]) invalid(encode({ ...initial(), ...patch }));
  const ref = { path: 'docs/iterations/000-foundation/verification.md', record_id: 'check-1' };
  validateStateYaml(encode({ ...initial(), status: 'blocked', blocker_refs: [ref] }));
  validateStateYaml(encode({ ...initial(), status: 'paused', checkpoint_ref: ref }));
  validateStateYaml(encode({ ...initial(), current_task: 'T1', phase: 'closeout', status: 'ready', confirmation_refs: [ref] }));
});

test('state: references and basis reject unsafe paths, duplicates and self hashing', () => {
  for (const path of ['../secret', '/etc/passwd', 'C:/secret', 'docs/../secret', 'docs\\secret', 'docs/NUL.md', 'docs/a:stream', 'docs/a.', 'docs//a']) {
    invalid(encode({ ...initial(), basis: [{ path, sha256: 'a'.repeat(64) }] }));
  }
  const entry = { path: 'docs/project/overview.md', sha256: 'a'.repeat(64) };
  invalid(encode({ ...initial(), basis: [entry, entry] }));
  invalid(encode({ ...initial(), basis: [{ ...entry, path: 'docs/workflow/state.yaml' }] }));
  invalid(encode({ ...initial(), confirmation_refs: [{ path: 'docs/a.md', record_id: '' }] }));
});

test('state: strict YAML rejects duplicate keys, tags, aliases, merges and multiple documents', () => {
  for (const text of ['revision: 0\nrevision: 1', 'a: &x 1\nb: *x', 'a: !custom hi', 'a: !!timestamp 2026-11-13', 'a: 1\n---\na: 2', '%YAML 1.1\n---\na: 1', 'a: {<<: {b: 1}}', '? [a,b]\n: c', 'a: .nan', 'a: .inf']) invalid(text);
  invalid('['.repeat(150));
  invalid('x'.repeat(1024 * 1024 + 1));
});

test('state: integer fields reject fractions lost by floating-point rounding', () => {
  for (const token of ['9007199254740991.1', '-1e-999', '1e-999', '0.99999999999999999']) {
    invalid(encode(initial()).replace('"revision":0', '"revision":' + token));
  }
  invalid(encode(initial()).replace('"schema_version":1', '"schema_version":0.99999999999999999'));
  validateStateYaml(encode({ ...initial(), revision: 9007199254740991 }));
  for (const token of ['1.0', '1e0', '0x1', '0o1', '0e-999']) {
    validateStateYaml(stringify(initial()).replace('revision: 0', 'revision: ' + token));
  }
});
