import fs from 'node:fs';import path from 'node:path';
export function createClientJournal(directory, token) {
  if(typeof token!=='string'||!token.length)throw Error('A redaction token is required');
  const files={stdout:path.join(directory,'events.jsonl'),stderr:path.join(directory,'stderr.txt')},pending={stdout:'',stderr:''},received={stdout:0,stderr:0};
  for(const file of Object.values(files))fs.writeFileSync(file,'',{flag:'wx'});
  const progress=(completed,metadata={})=>fs.writeFileSync(path.join(directory,'progress.json'),JSON.stringify({completed,received_bytes:received,withheld_chars:{stdout:pending.stdout.length,stderr:pending.stderr.length},...metadata},null,2));
  const safe=text=>text.split(token).join('[REDACTED]');progress(false);
  return {write(stream,chunk){if(!files[stream])throw Error('Unknown journal stream');received[stream]+=Buffer.byteLength(chunk);pending[stream]=safe(pending[stream]+chunk);let cut=Math.max(0,pending[stream].length-token.length);if(cut>0&&/[\uD800-\uDBFF]/u.test(pending[stream][cut-1]))cut--;if(cut)fs.appendFileSync(files[stream],pending[stream].slice(0,cut));pending[stream]=pending[stream].slice(cut);progress(false);},finish(metadata={}){for(const stream of Object.keys(files)){fs.appendFileSync(files[stream],safe(pending[stream]));pending[stream]='';}progress(true,metadata);}};
}
