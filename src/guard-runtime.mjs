import {fileURLToPath} from 'node:url';
import {checkPackage} from './package.mjs';
import {parseGuardRequest,validateGuardRequest} from './guard-request.mjs';
import {inspectOperation as inspect,revalidateOperation as revalidate} from './operation-guard.mjs';
import {checkInstalledGuard} from './guard-installation.mjs';
import {existsSync} from 'node:fs';
import {basename,dirname,join} from 'node:path';

const packageRoot=fileURLToPath(new URL('../',import.meta.url));
function verifySource() {
  if(basename(packageRoot)==='.ai-workflow'&&!existsSync(join(packageRoot,'resource-manifest.json')))checkInstalledGuard(dirname(packageRoot));
  else checkPackage(packageRoot);
}
export {parseGuardRequest,validateGuardRequest};
export async function inspectOperation(projectRoot,request,options={}) {
  verifySource();
  return inspect(projectRoot,request,options);
}
export async function revalidateOperation(projectRoot,request,previousResult,options={}) {
  verifySource();
  return revalidate(projectRoot,request,previousResult,options);
}
