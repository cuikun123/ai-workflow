import {checkInstallation} from './installation.mjs';
import {checkArtifact} from './workflow-artifacts.mjs';
import {WorkflowError} from './errors.mjs';
export function inspectArtifacts(root,paths,{kind='file'}={}){
 if(!['file','definition'].includes(kind)||!Array.isArray(paths)||!paths.length||paths.length>100||new Set(paths.map(p=>p.normalize('NFC').toLowerCase())).size!==paths.length)throw new WorkflowError('USAGE','Artifact inspection needs unique paths and file or definition kind');
 if(kind==='definition'&&paths.some(p=>!/^docs\/iterations\/[^/]+\/(?:scope|design|tasks)\.md$/.test(p)))throw new WorkflowError('USAGE','Definition inspection is limited to iteration scope, design and tasks');
 checkInstallation(root);
 const artifacts=paths.map(path=>{const item={kind,path,sha256:'0'.repeat(64)},checked=checkArtifact(root,item);if(!checked.actual_sha256)throw new WorkflowError('STATE_INVALID',checked.reason);return {...item,sha256:checked.actual_sha256};});
 return {artifacts,read_only:true,source_authenticity_verified:false};
}
