import fs from 'node:fs';import {join,resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),files=['test/server.test.mjs','test/linked-contract.test.mjs','test/page-race.test.mjs'];
const env={...process.env};delete env.NODE_TEST_CONTEXT;
const args=['--test','--test-reporter=tap',...files],r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000,env});
const output=(r.stdout||'')+(r.stderr||''),count=Number(output.match(/^# tests (\d+)$/m)?.[1]||0),failed=Number(output.match(/^# fail (\d+)$/m)?.[1]??-1),skipped=Number(output.match(/^# skipped (\d+)$/m)?.[1]??-1),todo=Number(output.match(/^# todo (\d+)$/m)?.[1]??-1);
const passed=r.status===0&&count>0&&failed===0&&skipped===0&&todo===0,dir='evidence/checks/'+randomUUID();fs.mkdirSync(join(root,dir),{recursive:true});fs.writeFileSync(join(root,dir,'tests.tap'),output);
const report={passed,command:[process.execPath,...args],exit_code:r.status,test_count:count||null,evidence:[dir+'/tests.tap'],result_file:dir+'/result.json'};fs.writeFileSync(join(root,report.result_file),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exitCode=passed?0:1;
