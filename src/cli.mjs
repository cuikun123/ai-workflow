import { readFileSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';
import { checkPackage, sha256 } from './package.mjs';
import { WorkflowError, asWorkflowError, exitCodes } from './errors.mjs';
import metadata from '../package.json' with { type: 'json' };

const help = `Iterlane development tools ${metadata.version}
Usage:
  --help
  --version
  check [--package <directory> | --project <directory>] [--json]
  validate --state <file> [--json]
  artifacts inspect [--project <directory>] [--kind file|definition] --path <relative-file>... [--json]
  spec check [--project <directory>] [--iteration <path> --task <id>] [--json]
  spec sync [--project <directory>] --iteration <path> --task <id> --request-id <id> --expected-revision <n> [--preview] [--json]
  skills check [--package <directory> | --project <directory>] [--json]
  init --project <directory> [--example bookmarks] [--preview | --repair | --resume | --undo] [--json]
  status [--project <directory>] [--json]
  context inspect [--project <directory>] [--json]
  context guard [--project <directory>] --expected-snapshot <sha256> [--json]
  context bind [--project <directory>] --iteration <path> --task <id> --expected-snapshot <sha256> --expected-revision <n> --request-id <id> --impact unaffected|affected --reason <text> [--preview] [--json]
  doctor [--project <directory>] [--package <fixed-source>] [--client-evidence <json> | --client [--client-cli <file>] [--timeout-ms <n>]] [--json]
  recover [--project <directory>] --repair --package <fixed-source> [--preview] [--json]
  recover [--project <directory>] --resume|--undo --operation-id <uuid> [--package <fixed-source>] [--expected-revision <n>] [--preview] [--json]
  recover [--project <directory>] --refresh --expected-revision <n> --request-id <id> [--preview] [--json]
  check --project <directory> --documents [--json]
  transition [--project <directory>] --input <operation-json> [--json]
  transition [--project <directory>] --resume|--undo --expected-revision <integer> [--json]
  upgrade --project <directory> --from-package <fixed-dev5> --expected-revision <integer> [--preview] [--json]
  rollback --project <directory> --operation-id <upgrade-uuid> --expected-revision <integer> [--preview] [--json]
Installation and resource checks do not verify client integration or user acceptance.
State validation checks syntax and structure only; references and acceptance are not verified.
`;
function parse(args) {
  if (args.filter(value => value === '--json').length > 1) throw new WorkflowError('USAGE', 'Duplicate option: --json');
  const json = args.includes('--json'); args = args.filter(value => value !== '--json');
  if (args.length === 1 && ['--help', '-h', '--version'].includes(args[0])) return { command: args[0], json };
  const command = args.shift();
  const contextAction=command==='context'?args.shift():null;
  if(command==='context'&&!['inspect','guard','bind'].includes(contextAction))throw new WorkflowError('USAGE','Expected context inspect, guard or bind');
  if(command==='artifacts'&&args.shift()!=='inspect')throw new WorkflowError('USAGE','Expected artifacts inspect');
  if(command==='skills'&&args.shift()!=='check')throw new WorkflowError('USAGE','Expected skills check');
  const specAction=command==='spec'?args.shift():null;
  if(command==='spec'&&!['check','sync'].includes(specAction))throw new WorkflowError('USAGE','Expected spec check or spec sync');
  if (!['context','artifacts','skills','spec','check', 'validate', 'init','status','transition','doctor','recover','upgrade','rollback'].includes(command)) throw new WorkflowError('USAGE', 'Expected artifacts inspect, skills check, spec check, check, validate, init, status, transition, doctor, recover, upgrade, rollback, --help or --version');
  const options = {};
  while (args.length) {
    const key = args.shift();
    const flags = command==='context'&&contextAction==='bind'?['--preview']:command==='spec'&&specAction==='sync'?['--preview']:['upgrade','rollback'].includes(command)?['--preview']:command === 'init' ? ['--preview', '--repair', '--resume', '--undo'] : command==='transition'?['--resume','--undo']:command==='check'?['--documents']:command==='doctor'?['--client']:command==='recover'?['--repair','--resume','--undo','--refresh','--preview']:[];
    const values = command==='context'?['--project',...(contextAction==='bind'?['--iteration','--task','--expected-snapshot','--expected-revision','--request-id','--impact','--reason']:contextAction==='guard'?['--expected-snapshot']:[])]:command==='init'?['--project','--example']:command==='artifacts'?['--project','--path','--kind']:command==='skills'?['--project','--package']:command==='spec'?['--project','--iteration','--task',...(specAction==='sync'?['--request-id','--expected-revision']:[])]:command==='upgrade'?['--project','--from-package','--expected-revision']:command==='rollback'?['--project','--operation-id','--expected-revision']:command === 'check' ? ['--package', '--project'] : command === 'validate' ? ['--state'] : command==='transition'?['--project','--input','--expected-revision']:command==='doctor'?['--project','--package','--client-evidence','--client-cli','--timeout-ms']:command==='recover'?['--project','--package','--operation-id','--expected-revision','--request-id']:['--project'];
    if (options[key] !== undefined && !(command==='artifacts'&&key==='--path') || !flags.includes(key) && !values.includes(key)) throw new WorkflowError('USAGE', 'Invalid or duplicate option: ' + key);
    if (flags.includes(key)) options[key] = true;
    else {
      if (!args[0] || args[0].startsWith('--')) throw new WorkflowError('USAGE', 'Option requires a value: ' + key);
      const value=args.shift();options[key]=command==='artifacts'&&key==='--path'?[...(options[key]||[]),value]:value;
    }
  }
  if (command === 'validate' && !options['--state']) throw new WorkflowError('USAGE', 'validate requires --state <file>');
  if(command==='artifacts'&&(!options['--path']?.length||options['--kind']&&!['file','definition'].includes(options['--kind'])))throw new WorkflowError('USAGE','Artifact inspection requires paths and a supported kind');
  if(command==='doctor'&&(options['--client']&&options['--client-evidence']||!options['--client']&&(options['--client-cli']||options['--timeout-ms'])||options['--timeout-ms']&&(!/^[1-9][0-9]*$/.test(options['--timeout-ms'])||Number(options['--timeout-ms'])<1000||Number(options['--timeout-ms'])>180000)))throw new WorkflowError('USAGE','Client probe options need --client and a timeout from 1000 to 180000ms');
  if(command==='spec'&&(!!options['--iteration']!==!!options['--task']||options['--iteration']&&!/^docs\/iterations\/[^/]+$/u.test(options['--iteration'])||options['--task']&&!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(options['--task'])))throw new WorkflowError('USAGE','Task selection requires an iteration path and exact task ID');
  if(command==='spec'&&specAction==='sync'&&(!options['--iteration']||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(options['--request-id']||'')||!/^(?:0|[1-9][0-9]*)$/u.test(options['--expected-revision']||'')||!Number.isSafeInteger(Number(options['--expected-revision']))))throw new WorkflowError('USAGE','Specification synchronization requires task, request ID and exact safe revision');
  if (['check','skills'].includes(command) && options['--package'] && options['--project']) throw new WorkflowError('USAGE', '--package and --project are mutually exclusive');
  if (command === 'init' && (!options['--project'] || ['--preview', '--repair', '--resume', '--undo'].filter(key => options[key]).length > 1)) throw new WorkflowError('USAGE', 'init requires --project and at most one operation mode');
  if(command==='init'&&options['--example']&&(options['--example']!=='bookmarks'||options['--repair']||options['--resume']||options['--undo']))throw new WorkflowError('USAGE','Examples require a supported name and new initialization; recovery reads the saved journal');
  if(command==='check'&&options['--documents']&&options['--package'])throw new WorkflowError('USAGE','Document validation requires a project');
  if(command==='transition'){
    if([options['--input'],options['--resume'],options['--undo']].filter(Boolean).length!==1)throw new WorkflowError('USAGE','transition requires exactly one input or recovery mode');
    if(options['--input']&&options['--expected-revision']||!options['--input']&&!/^(?:0|[1-9][0-9]*)$/u.test(options['--expected-revision']||'')||!options['--input']&&!Number.isSafeInteger(Number(options['--expected-revision'])))throw new WorkflowError('USAGE','Recovery requires an exact safe revision');
  }
  if(command==='recover'){
    if(['--repair','--resume','--undo','--refresh'].filter(k=>options[k]).length!==1)throw new WorkflowError('USAGE','recover requires exactly one operation');
    if(options['--expected-revision']!==undefined&&(!/^(?:0|[1-9][0-9]*)$/u.test(options['--expected-revision'])||!Number.isSafeInteger(Number(options['--expected-revision']))))throw new WorkflowError('USAGE','Recovery requires an exact safe revision');
  }
  if(['upgrade','rollback'].includes(command)){if(!options['--project']||! /^(?:0|[1-9][0-9]*)$/u.test(options['--expected-revision']||'')||!Number.isSafeInteger(Number(options['--expected-revision']))||command==='upgrade'&&!options['--from-package']||command==='rollback'&&!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(options['--operation-id']||''))throw new WorkflowError('USAGE','Version operation requires explicit project, exact revision and fixed source or upgrade ID');}
  if(command==='context'&&contextAction==='guard'&&!/^[a-f0-9]{64}$/u.test(options['--expected-snapshot']||''))throw new WorkflowError('USAGE','Context guard requires an exact SHA256 snapshot');
  if(command==='context'&&contextAction==='bind'&&(!/^docs\/iterations\/[^/]+$/u.test(options['--iteration']||'')||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(options['--task']||'')||!/^[a-f0-9]{64}$/u.test(options['--expected-snapshot']||'')||!/^(?:0|[1-9][0-9]*)$/u.test(options['--expected-revision']||'')||!Number.isSafeInteger(Number(options['--expected-revision']))||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u.test(options['--request-id']||'')||!['unaffected','affected'].includes(options['--impact'])||!options['--reason']?.trim()))throw new WorkflowError('USAGE','Context bind requires the task, exact snapshot/revision, stable request ID, impact and reason');
  return { command, json, specAction, contextAction, ...options };
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
    if(options.command==='context'){
      const root=options['--project']?resolve(options['--project']):context.projectRoot;if(!root)throw new WorkflowError('USAGE','Context requires an explicit project');
      const {inspectProjectContext,guardProjectContext}=await import('./foundation-context.mjs');
      if(options.contextAction==='bind'){
        const {planContextBinding}=await import('./context-binding.mjs'),{applyWorkflowTransition}=await import('./workflow-journal.mjs');
        const request={operation_version:3,request_id:options['--request-id'],expected_revision:Number(options['--expected-revision']),action:'context_bind',data:{iteration:options['--iteration'],task:options['--task'],expected_snapshot:options['--expected-snapshot'],impact:options['--impact'],reason:options['--reason']}};
        if(options['--preview']){const plan=planContextBinding(root,request);data={action:'preview',revision:plan.beforeState.revision,next_revision:plan.afterState.revision,files:plan.files.map(f=>({path:f.path,kind:f.kind,action:f.before===null?'create':'update',before_sha256:f.before===null?null:sha256(f.before),after_sha256:sha256(f.after)})),snapshot_sha256:request.data.expected_snapshot,semantic_completeness_verified:false,acceptance_verified:false};}
        else data=applyWorkflowTransition(root,request);
      }else data=options.contextAction==='inspect'?inspectProjectContext(root):guardProjectContext(root,options['--expected-snapshot']);
      if(options.contextAction==='guard'){
        const fresh=data.freshness==='fresh';write(options.json?JSON.stringify({ok:fresh,command:'context',version:metadata.version,data})+'\n':`${data.freshness.toUpperCase()} context: ${JSON.stringify(data)}\n`);
        return fresh?0:exitCodes[data.error_code||'CONFLICT']||exitCodes.IO;
      }
    }else if(options.command==='artifacts'){
      const projectRoot=options['--project']?resolve(options['--project']):context.projectRoot;if(!projectRoot)throw new WorkflowError('USAGE','Artifact inspection requires an explicit project');
      const {inspectArtifacts}=await import('./artifact-inspect.mjs');data=inspectArtifacts(projectRoot,options['--path'],{kind:options['--kind']||'file'});
    }else if(options.command==='skills'){
      if(options['--project']||context.projectRoot&&!options['--package']){const {checkInstallation}=await import('./installation.mjs');const result=checkInstallation(options['--project']?resolve(options['--project']):context.projectRoot);data=result.skills;}
      else{const sourceRoot=fileURLToPath(new URL('../',import.meta.url)),result=checkPackage(options['--package']?resolve(options['--package']):context.packageRoot||join(sourceRoot,'dist'));data=result.skills;}
    }else if(options.command==='spec'){
      const projectRoot=options['--project']?resolve(options['--project']):context.projectRoot;
      if(!projectRoot)throw new WorkflowError('USAGE','Specification checks require an explicit project');
      const {checkInstallation}=await import('./installation.mjs'),{inspectSpecifications}=await import('./spec-deltas.mjs');
      checkInstallation(projectRoot);
      if(options.specAction==='check'){
        data=inspectSpecifications(projectRoot,{taskRef:options['--task']?{path:options['--iteration']+'/tasks.md',record_id:options['--task']}:null});
        if(!data.valid)throw new WorkflowError('STATE_INVALID','Specification identities, declared changes or references are inconsistent',data.issues);
      }else{
        const {planWorkflowOperation,applyWorkflowTransition}=await import('./workflow-journal.mjs'),{sha256}=await import('./package.mjs');
        const request={operation_version:3,request_id:options['--request-id'],expected_revision:Number(options['--expected-revision']),action:'spec_sync',data:{iteration:options['--iteration'],task:options['--task']}};
        if(options['--preview']){const plan=planWorkflowOperation(projectRoot,request);data={action:'preview',revision:plan.beforeState.revision,next_revision:plan.afterState.revision,files:plan.files.map(f=>({path:f.path,kind:f.kind,action:f.before===null?'create':'update',before_sha256:f.before===null?null:sha256(f.before),after_sha256:sha256(f.after)})),targets:plan.files.filter(f=>f.path.startsWith('docs/project/specs/')).map(f=>({path:f.path,action:f.before===null?'create':'update',before_sha256:f.before===null?null:sha256(f.before),after_sha256:sha256(f.after)})),acceptance_verified:false,source_authenticity_verified:false};}
        else data=applyWorkflowTransition(projectRoot,request);
      }
    }else if(['upgrade','rollback'].includes(options.command)){
      if(context.projectRoot)throw new WorkflowError('USAGE','Use the complete fixed dev.6 distribution for version changes');
      const {applyVersionChange}=await import('./version-journal.mjs'),sourceRoot=fileURLToPath(new URL('../',import.meta.url));
      data=applyVersionChange(resolve(options['--project']),{mode:options.command,packageRoot:context.packageRoot||join(sourceRoot,'dist'),fromPackageRoot:options['--from-package']?resolve(options['--from-package']):undefined,operationId:options['--operation-id'],expectedRevision:Number(options['--expected-revision']),preview:!!options['--preview']});
    }else if(options.command==='doctor'||options.command==='recover'){
      const projectRoot=options['--project']?resolve(options['--project']):context.projectRoot;if(!projectRoot)throw new WorkflowError('USAGE','Project diagnostics/recovery requires an explicit project');
      if(options.command==='doctor'){
        const {diagnoseProject}=await import('./diagnostics.mjs');let clientEvidence;
        if(options['--client-evidence']){const file=resolve(options['--client-evidence']),stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536)throw new WorkflowError('USAGE','Client evidence must be a bounded regular JSON file');const {parseStrictJson}=await import('./workflow-docs.mjs');clientEvidence=parseStrictJson(new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(file)),65536);}
        if(options['--client']){const {probeClient}=await import('./client-probe.mjs');data=await probeClient(projectRoot,{cli:options['--client-cli'],timeoutMs:options['--timeout-ms']?Number(options['--timeout-ms']):120000});if(!data.local_valid||data.client.status!=='connected')throw new WorkflowError('ENVIRONMENT','Client read-only check did not complete',[data]);}
        else data=diagnoseProject(projectRoot,{packageRoot:options['--package']?resolve(options['--package']):undefined,clientEvidence});
      }else{const {recoverProject}=await import('./recovery.mjs');data=recoverProject(projectRoot,{mode:options['--repair']?'repair':options['--resume']?'resume':options['--undo']?'undo':'refresh',packageRoot:options['--package']?resolve(options['--package']):undefined,operationId:options['--operation-id'],expectedRevision:options['--expected-revision']!==undefined?Number(options['--expected-revision']):undefined,requestId:options['--request-id'],preview:!!options['--preview']});}
    }else if(options.command==='status'){
      const projectRoot=options['--project']?resolve(options['--project']):context.projectRoot;if(!projectRoot)throw new WorkflowError('USAGE','status requires an explicit project');
      const {inspectWorkflowState}=await import('./workflow-status.mjs');const {checkInstallation}=await import('./installation.mjs');
      data=inspectWorkflowState(projectRoot);try{data.installation=checkInstallation(projectRoot);}catch(error){data.valid=false;data.issues.push({code:error.code||'INCOMPLETE',message:error.message,path:null});data.diagnostic='incomplete';}
    }else if(options.command==='transition'){
      const projectRoot=options['--project']?resolve(options['--project']):context.projectRoot;if(!projectRoot)throw new WorkflowError('USAGE','transition requires an explicit project');
      const {applyWorkflowTransition,recoverWorkflowTransition}=await import('./workflow-journal.mjs');
      if(options['--input']){const file=resolve(options['--input']),stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw new WorkflowError('STATE_INVALID','Operation input must be a bounded regular JSON file');const {parseStrictJson}=await import('./workflow-docs.mjs');data=applyWorkflowTransition(projectRoot,parseStrictJson(new TextDecoder('utf-8',{fatal:true}).decode(readFileSync(file))));}
      else data=recoverWorkflowTransition(projectRoot,options['--resume']?'resume':'undo',Number(options['--expected-revision']));
    }else if (options.command === 'init') {
      if (context.projectRoot) throw new WorkflowError('USAGE', 'init requires the distribution entry; installed projects are not distribution sources');
      const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
      const packageRoot = context.packageRoot || join(sourceRoot, 'dist');
      const { initializeProject, planInstallation } = await import('./installation.mjs');
      const projectRoot = resolve(options['--project']);
      if (options['--preview']) {
        const plan = planInstallation({ packageRoot, projectRoot,example:options['--example'] });
        data = { action: 'preview', project: plan.root, version: plan.package.version, files: plan.files.map(file => ({ path: file.path, kind: file.kind, bytes_before: file.before?.length ?? null, bytes_after: file.after.length })), client_validation: 'not_run' };
      } else {
        const mode = options['--repair'] ? 'repair' : options['--resume'] ? 'resume' : options['--undo'] ? 'undo' : 'init';
        data = initializeProject({ packageRoot, projectRoot, mode,example:options['--example'] });
        data.resources ??= data.action === 'undone' ? 'not_installed' : 'valid';
      }
    } else if (options.command === 'check' && (options['--project'] || context.projectRoot && !options['--package'])) {
      const { checkInstallation } = await import('./installation.mjs');
      data = checkInstallation(options['--project'] ? resolve(options['--project']) : context.projectRoot);
      if(options['--documents']){const {inspectWorkflowState}=await import('./workflow-status.mjs');const documents=inspectWorkflowState(options['--project']?resolve(options['--project']):context.projectRoot);if(!documents.valid)throw new WorkflowError('STATE_INVALID','Project documents or state basis are inconsistent',documents.issues);data.document_validation=documents.document_validation;data.basis_current=documents.basis_current;data.source_authenticity_verified=false;}
    } else if (options.command === 'check') {
      if(options['--documents'])throw new WorkflowError('USAGE','Document validation requires a project');
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
