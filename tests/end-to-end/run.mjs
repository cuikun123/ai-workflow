// Explicit authenticated validation, never executed by ordinary CI.
import fs from 'node:fs';import path from 'node:path';
import {createCases} from './cases.mjs';import {createClient} from './client.mjs';import {waitingFixture,initProject} from './controller.mjs';import {evaluateEndToEnd} from './evaluate.mjs';import {outputSchema} from '../codex-client/cases.mjs';
const args=process.argv.slice(2);if(args.length!==6||args[0]!=='--out'||args[2]!=='--package'||args[4]!=='--cli')throw Error('Usage: run.mjs --out <new evidence directory> --package <fixed package> --cli <real CLI>');
const out=path.resolve(args[1]),packageRoot=path.resolve(args[3]),cli=path.resolve(args[5]);fs.mkdirSync(out);const discoveryProject=path.join(out,'discovery-project');initProject(packageRoot,discoveryProject);const client=await createClient({out,cli,packageRoot,discoveryProject});
const scenarios=createCases(packageRoot);fs.writeFileSync(path.join(out,'cases.json'),JSON.stringify(scenarios,null,2));const results=[];
for(const scenario of scenarios){
  const project=path.join(out,'project-'+scenario.id);waitingFixture(packageRoot,project,path.join(out,'controller-'+scenario.id));
  const run=await client.session({id:scenario.id,project,prompt:scenario.prompt,schema:outputSchema}),result=evaluateEndToEnd(scenario,run);results.push({...result,elapsed_ms:run.elapsed_ms,exit_code:run.exitCode,timed_out:run.timedOut});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.at(-1)));
}
if(results.some(r=>!r.ok))process.exitCode=1;console.log(JSON.stringify({runs:results.length,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length}));
