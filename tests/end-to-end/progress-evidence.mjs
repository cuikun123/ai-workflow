import {words} from '../codex-client/commands.mjs';
// Accept the actual direct Node invocation observed in the fixed client suite.
function directTest(command,file){let tokens=words(command);if(/powershell(?:\.exe)?$/i.test(tokens[0]||'')){const i=tokens.findIndex(t=>t.toLowerCase()==='-command');tokens=words(tokens[i+1]||'');}return /^node(?:\.exe)?$/i.test(tokens[0]||'')&&tokens.includes('--test')&&tokens.includes(file)&&tokens.slice(1).every(t=>['--test','--test-reporter=tap',file].includes(t));}
export function evaluateProgressEvidence(run,{tests,count}){
  const failures=[];
  const passed=(run.commands||[]).some(c=>{if(c.exitCode!==0||!directTest(c.command,tests))return false;const values={};for(const m of c.output.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\s*$/gm))values[m[1]]=Number(m[2]);return values.tests===count&&values.pass===count&&values.fail===0&&values.cancelled===0&&values.skipped===0&&values.todo===0;});
  if(!passed)failures.push('missing_complete_actual_test_execution');return {ok:failures.length===0,failures};
}
