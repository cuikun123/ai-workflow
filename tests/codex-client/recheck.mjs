// Re-evaluate preserved client events offline; original evidence is never edited.
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { cases } from './cases.mjs';
import { evaluateRun, evaluateBatch } from './evaluate.mjs';
import { captureEvidence, createSuite, sha256, snapshot } from './evidence.mjs';
import { eventEvidence } from './events.mjs';
const args=process.argv.slice(2),seen=new Set();
for(let i=0;i<args.length;i+=2){if(!['--evidence','--suite','--out'].includes(args[i])||seen.has(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw Error('Invalid offline recheck arguments');seen.add(args[i]);}
const option=key=>args[args.indexOf(key)+1],root=path.resolve(seen.has('--evidence')?option('--evidence'):fs.readFileSync('.artifacts/step3/evidence-path.txt','utf8').trim());
if(!seen.has('--suite')||!seen.has('--out')||!args.every((arg,index)=>index%2===0||/^[a-z0-9-]{1,64}$/.test(arg)||args[index-1]==='--evidence'))throw Error('A source suite and new output name are required');
const source=path.join(root,option('--suite')),out=createSuite(root,option('--out')),results=[];
for(const scenario of cases)for(let repeat=1;repeat<=3;repeat++){
  const id=scenario.id+'-'+repeat,dir=path.join(source,id),inputFile=path.join(dir,'input.json'),resultFile=path.join(dir,'result.json'),eventsFile=path.join(dir,'events.jsonl');
  const input=JSON.parse(fs.readFileSync(inputFile,'utf8')),{run}=JSON.parse(fs.readFileSync(resultFile,'utf8'));
  const raw=eventEvidence(fs.readFileSync(eventsFile,'utf8'));
  for(const key of ['completed','errors','final','commands'])if(!isDeepStrictEqual(run[key],raw[key]))throw Error('Cached client fields differ from raw events: '+id+'/'+key);
  Object.assign(run,raw);
  if(input.id!==id||input.scenario.id!==scenario.id||input.prompt!==scenario.prompt)throw Error('Saved input is not the specified scenario: '+id);
  const current=snapshot(path.join(dir,'project')),before=JSON.parse(fs.readFileSync(path.join(dir,'before.json'))),after=JSON.parse(fs.readFileSync(path.join(dir,'after.json')));
  if(!isDeepStrictEqual(current,before)||!isDeepStrictEqual(current,after))throw Error('Saved project changed: '+id);
  run.evidence=captureEvidence(path.join(dir,'project'));
  const evaluation={...evaluateRun(scenario,run),id};results.push(evaluation);
  fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify({provenance:'offline_recheck_of_preserved_events',input_sha256:sha256(fs.readFileSync(inputFile)),events_sha256:sha256(fs.readFileSync(eventsFile)),original_result_sha256:sha256(fs.readFileSync(resultFile)),evaluation,evidence:run.evidence},null,2),{flag:'wx'});
  console.log(JSON.stringify({id,ok:evaluation.ok,failures:evaluation.failures}));
}
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2),{flag:'wx'});
try{console.log(JSON.stringify(evaluateBatch(results,cases.flatMap(c=>[1,2,3].map(n=>c.id+'-'+n)))));}catch(error){console.error(error.message);process.exitCode=1;}
