import {isDeepStrictEqual} from 'node:util';
import {guardPackagePaths} from './package.mjs';
import {readInstallationManifest,inspectInstallationResources} from './installation.mjs';
import {WorkflowError} from './errors.mjs';
import {readProjectFile} from './project-paths.mjs';
import requestSchema from '../schemas/guard-request.schema.json' with {type:'json'};
import resultSchema from '../schemas/guard-result.schema.json' with {type:'json'};

// Check resources independently of project state so diagnostics remain available.
export function checkInstalledGuard(root) {
  try {
    const manifest=readInstallationManifest(root);
    if(!manifest||guardPackagePaths.some(path=>!manifest.files.some(entry=>entry.path==='.ai-workflow/'+path)))throw Error();
    const resources=inspectInstallationResources(root,manifest);
    if(Object.values(resources).some(entries=>entries.length))throw Error();
    for(const [name,schema] of [['request',requestSchema],['result',resultSchema]]) {
      if(!isDeepStrictEqual(JSON.parse(readProjectFile(root,`.ai-workflow/resources/schemas/guard-${name}.schema.json`)),schema))throw Error();
    }
  } catch {
    throw new WorkflowError('PACKAGE_INVALID','Installed guard resources are missing, incompatible or damaged');
  }
}
