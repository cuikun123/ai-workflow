import { readFileSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { checkPackage } from './package.mjs';
import { WorkflowError, asWorkflowError, exitCodes } from './errors.mjs';
import metadata from '../package.json' with { type: 'json' };

const help = `Iterlane development tools ${metadata.version}
Usage:
  --help
  --version
  check [--package <directory> | --project <directory>] [--json]
  validate --state <file> [--json]
  init --project <directory> [--preview | --repair | --resume | --undo] [--json]
Installation and resource checks do not verify client integration or user acceptance.
State validation checks syntax and structure only; references and acceptance are not verified.
`;
function parse(args) {
  if (args.filter(value => value === '--json').length > 1) throw new WorkflowError('USAGE', 'Duplicate option: --json');
  const json = args.includes('--json'); args = args.filter(value => value !== '--json');
  if (args.length === 1 && ['--help', '-h', '--version'].includes(args[0])) return { command: args[0], json };
  const command = args.shift(); if (!['check', 'validate', 'init'].includes(command)) throw new WorkflowError('USAGE', 'Expected check, validate, init, --help or --version');
  const options = {};
  while (args.length) {
    const key = args.shift();
    const flags = command === 'init' ? ['--preview', '--repair', '--resume', '--undo'] : [];
    const values = command === 'check' ? ['--package', '--project'] : command === 'validate' ? ['--state'] : ['--project'];
    if (options[key] !== undefined || !flags.includes(key) && !values.includes(key)) throw new WorkflowError('USAGE', 'Invalid or duplicate option: ' + key);
    if (flags.includes(key)) options[key] = true;
    else {
      if (!args[0] || args[0].startsWith('--')) throw new WorkflowError('USAGE', 'Option requires a value: ' + key);
      options[key] = args.shift();
    }
  }
  if (command === 'validate' && !options['--state']) throw new WorkflowError('USAGE', 'validate requires --state <file>');
  if (command === 'check' && options['--package'] && options['--project']) throw new WorkflowError('USAGE', '--package and --project are mutually exclusive');
  if (command === 'init' && (!options['--project'] || ['--preview', '--repair', '--resume', '--undo'].filter(key => options[key]).length > 1)) throw new WorkflowError('USAGE', 'init requires --project and at most one operation mode');
  return { command, json, ...options };
}

export async function runCli(args = process.argv.slice(2), context = {}) {
  const write = context.write || (text => process.stdout.write(text));
  try {
    const options = parse(args);
    if (options.command === '--help' || options.command === '-h') { write(options.json ? JSON.stringify({ ok: true, command: 'help', version: metadata.version, data: { usage: help } }) + '\n' : help); return 0; }
    if (options.command === '--version') { write(options.json ? JSON.stringify({ ok: true, command: 'version', version: metadata.version, data: { name: metadata.name } }) + '\n' : metadata.version + '\n'); return 0; }
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major !== 24 || minor < 18) throw new WorkflowError('ENVIRONMENT', 'Node 24.18.0 or later within major 24 is required');
    let data;
    if (options.command === 'init') {
      if (context.projectRoot) throw new WorkflowError('USAGE', 'init requires the distribution entry; installed projects are not distribution sources');
      const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
      const packageRoot = context.packageRoot || join(sourceRoot, 'dist');
      const { initializeProject, planInstallation } = await import('./installation.mjs');
      const projectRoot = resolve(options['--project']);
      if (options['--preview']) {
        const plan = planInstallation({ packageRoot, projectRoot });
        data = { action: 'preview', project: plan.root, version: plan.package.version, files: plan.files.map(file => ({ path: file.path, kind: file.kind, bytes_before: file.before?.length ?? null, bytes_after: file.after.length })), client_validation: 'not_run' };
      } else {
        const mode = options['--repair'] ? 'repair' : options['--resume'] ? 'resume' : options['--undo'] ? 'undo' : 'init';
        data = initializeProject({ packageRoot, projectRoot, mode });
        data.resources ??= data.action === 'undone' ? 'not_installed' : 'valid';
      }
    } else if (options.command === 'check' && (options['--project'] || context.projectRoot && !options['--package'])) {
      const { checkInstallation } = await import('./installation.mjs');
      data = checkInstallation(options['--project'] ? resolve(options['--project']) : context.projectRoot);
    } else if (options.command === 'check') {
      const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
      const root = options['--package'] ? resolve(options['--package']) : (context.packageRoot || join(sourceRoot, 'dist'));
      data = checkPackage(root);
    } else {
      const path = resolve(options['--state']), stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1024 * 1024) throw new WorkflowError('STATE_INVALID', 'State input must be a regular file of at most 1 MiB');
      let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path)); } catch { throw new WorkflowError('STATE_INVALID', 'State input is not valid UTF-8'); }
      const { validateStateYaml } = await import('./state.mjs');
      const state = validateStateYaml(text); data = { schema_version: state.schema_version, revision: state.revision, validation: 'structure_only', references_verified: false, acceptance_verified: false };
    }
    write(options.json ? JSON.stringify({ ok: true, command: options.command, version: metadata.version, data }) + '\n' : `OK ${options.command}: ${JSON.stringify(data)}\n`); return 0;
  } catch (caught) {
    const error = asWorkflowError(caught);
    write(args.includes('--json') ? JSON.stringify({ ok: false, error: { code: error.code, message: error.message, details: error.details } }) + '\n' : `${error.code}: ${error.message}\n`);
    return exitCodes[error.code];
  }
}
