import { parseAllDocuments, visit, isScalar, isMap, isSeq } from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../schemas/state-v1.schema.json' with { type: 'json' };
import { assertPortablePath } from './paths.mjs';
import { WorkflowError } from './errors.mjs';
const invalid = (message, details = []) => { throw new WorkflowError('STATE_INVALID', message, details); };
const validator = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, coerceTypes: false, useDefaults: false }).compile(schema);
const standardTags = new Set(['tag:yaml.org,2002:map', 'tag:yaml.org,2002:seq', 'tag:yaml.org,2002:str', 'tag:yaml.org,2002:null', 'tag:yaml.org,2002:bool', 'tag:yaml.org,2002:int', 'tag:yaml.org,2002:float']);

export function isLosslessInteger(node) {
  if (!Number.isSafeInteger(node.value)) return false;
  const source = node.source;
  if (/^[+-]?0[ox]/i.test(source)) {
    const sign = source.startsWith('-') ? -1n : 1n;
    try { return sign * BigInt(source.replace(/^[+-]/, '')) === BigInt(node.value); } catch { return false; }
  }
  const match = source.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match) return false;
  const fraction = match[3] || '', digits = (match[2] + fraction).replace(/^0+/, '');
  if (!digits) return node.value === 0;
  const shift = Number(match[4] || 0) - fraction.length;
  if (!Number.isSafeInteger(shift) || digits.length + shift < 1 || digits.length + shift > 16) return false;
  if (shift < 0 && /[1-9]/.test(digits.slice(shift))) return false;
  const integer = shift < 0 ? digits.slice(0, shift) : digits + '0'.repeat(shift);
  return (match[1] === '-' ? -1n : 1n) * BigInt(integer) === BigInt(node.value);
}

export function validateStateYaml(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 * 1024) invalid('State must be UTF-8 text of at most 1 MiB');
  if (text.includes('\u0000') || text.includes('\ufffd')) invalid('Invalid text encoding');
  let docs;
  try { docs = parseAllDocuments(text, { version: '1.2', uniqueKeys: true, strict: true, stringKeys: true }); }
  catch { invalid('Invalid YAML'); }
  if (docs.length !== 1) invalid('Exactly one YAML document is required');
  const doc = docs[0];
  if (doc.errors.length || doc.warnings.length || doc.directives.yaml.version !== '1.2' || Object.keys(doc.directives.tags).some(k => k !== '!!')) invalid('Unsupported or malformed YAML');
  try {
    visit(doc, {
      Node(key, node, ancestors) {
        if (ancestors.length > 64 || node.anchor || (node.tag && !standardTags.has(node.tag))) invalid('YAML aliases, custom tags and deep nesting are not supported');
        if (isMap(node)) for (const item of node.items) if (!isScalar(item.key) || typeof item.key.value !== 'string' || item.key.value === '<<') invalid('YAML keys must be strings without merges');
        if (isScalar(node) && typeof node.value === 'number' && !Number.isFinite(node.value)) invalid('Non-finite number');
        if (!isScalar(node) && !isMap(node) && !isSeq(node)) invalid('Unsupported YAML node');
      },
      Alias() { invalid('YAML aliases are not supported'); },
    });
  } catch (error) { if (error instanceof WorkflowError) throw error; invalid('Unsupported YAML structure'); }
  if (isMap(doc.contents)) for (const item of doc.contents.items) {
    if (['schema_version', 'revision'].includes(item.key.value) && isScalar(item.value) && typeof item.value.value === 'number' && !isLosslessInteger(item.value)) invalid('State integer fields must be exact safe integers');
  }
  let state; try { state = doc.toJS({ maxAliasCount: 0 }); } catch { invalid('Cannot decode YAML'); }
  if (!validator(state)) invalid('State does not match schema v1', validator.errors.map(e => ({ path: e.instancePath, rule: e.keyword, message: e.message })));
  const timestamp = new Date(state.updated_at);
  if (!Number.isFinite(timestamp.valueOf()) || timestamp.toISOString().replace('.000Z', 'Z') !== state.updated_at.replace('.000Z', 'Z')) invalid('Invalid UTC timestamp');
  const safe = path => { try { assertPortablePath(path); } catch { invalid('Unsafe project-relative state path'); } };
  if (state.current_iteration !== null) { safe(state.current_iteration); if (!/^docs\/iterations\/[^/]+$/u.test(state.current_iteration)) invalid('Iteration must reference one directory in docs/iterations'); }
  const refs = [...state.confirmation_refs, ...state.blocker_refs, ...(state.checkpoint_ref ? [state.checkpoint_ref] : [])];
  for (const ref of refs) safe(ref.path);
  const paths = new Set();
  for (const entry of state.basis) {
    safe(entry.path); const id = entry.path.normalize('NFC').toLowerCase();
    if (id === 'docs/workflow/state.yaml' || paths.has(id)) invalid('Duplicate basis path or state self-reference'); paths.add(id);
  }
  return state;
}
