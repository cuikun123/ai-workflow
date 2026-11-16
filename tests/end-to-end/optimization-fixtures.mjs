import * as fs from 'node:fs';import {join} from 'node:path';import {parseWorkflowDocument,renderWorkflowRecord} from '../../src/workflow-docs.mjs';
// Test draft setup only. Protected progress is created by the real record action.
export function registerDraftTasks({project,iteration,tasks,apply}){
 const taskPath=iteration+'/tasks.md',scopePath=iteration+'/scope.md',taskDoc=parseWorkflowDocument(fs.readFileSync(join(project,taskPath),'utf8'),taskPath),scope=fs.readFileSync(join(project,scopePath),'utf8'),scopeDoc=parseWorkflowDocument(scope,scopePath);
 fs.writeFileSync(join(project,taskPath),taskDoc.body);fs.writeFileSync(join(project,scopePath),scopeDoc.body);
 for(const original of tasks){const record=structuredClone(original);delete record.data.progress;record.data.delta_refs=[];apply('record',{record});}
 const generated=parseWorkflowDocument(fs.readFileSync(join(project,taskPath),'utf8'),taskPath);
 const linked=tasks.map(original=>{const record=structuredClone(original),progress=generated.records.get(original.id)?.data.progress;if(!progress||progress.status!=='not_started')throw Error('Actual task registration did not initialize progress');record.data.progress=progress;return record;});
 fs.writeFileSync(join(project,taskPath),taskDoc.body+'\n'+linked.map(renderWorkflowRecord).join('\n'));fs.writeFileSync(join(project,scopePath),scope);
}
