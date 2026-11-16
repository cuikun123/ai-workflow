const slash=s=>String(s).replace(/\\+/gu,'/'),norm=s=>s.replace(/\r\n/gu,'\n').trimEnd();
function decodedTexts(output){const texts=[output],visit=value=>{if(typeof value==='string')texts.push(value);else if(value&&typeof value==='object')for(const v of Object.values(value))visit(v);};try{visit(JSON.parse(output));}catch{for(const line of output.split('\n'))try{visit(JSON.parse(line));}catch{}}return texts.map(norm);}
function guidanceRead(actual,required){const actions=[...(actual.commands||[]).filter(c=>c.exitCode===0).map(c=>({code:c.command,outputs:[c.output]})),...(actual.toolReads||[])];return required.every(file=>actions.some(a=>/(?:readFile(?:Sync)?|Get-Content|\bcat\b)/u.test(a.code)&&slash(a.code).includes(file.path)&&a.outputs.some(out=>decodedTexts(out).some(text=>text.includes(norm(file.text))))));}
export function toolReadsFromEvents(stdout){const reads=[];for(const line of stdout.split('\n'))try{const e=JSON.parse(line),i=e.item;if(e.type==='item.completed'&&i?.type==='mcp_tool_call'&&i.status==='completed'&&!i.error)reads.push({code:i.arguments?.code||'',outputs:(i.result?.content||[]).filter(c=>c.type==='text').map(c=>c.text)});}catch{}return reads;}
export function evaluateDoctorEvidence(id,actual,{packageRoot,guidance=[]}={}){
  const failures=[],commands=actual.commands||[];
  if(id==='reference'){
    const a=actual.answer,doctor=a?.doctor_command||'',preview=a?.recovery_preview||'';
    if(!a?.found_doctor||!/^node\s+["']?\.ai-workflow\/bin\/iterlane\.mjs["']?\s+doctor\b/u.test(doctor)||!doctor.includes('--json')||!/^node\s+["']?\.ai-workflow\/bin\/iterlane\.mjs["']?\s+recover\b/u.test(preview)||!['--repair','--preview','--json'].every(flag=>preview.includes(flag))||!/--package\s+\S/u.test(preview))failures.push('installed guide does not supply complete valid doctor/repair-preview interfaces');
    if(!guidanceRead(actual,guidance))failures.push('complete required installed guidance reads not observed');return failures;
  }
  const reports=[];for(const c of commands)if(c.exitCode===0&&/iterlane\.mjs.*\bdoctor\b/u.test(c.command))try{const r=JSON.parse(c.output);if(r.ok===true&&r.command==='doctor')reports.push(r.data);}catch{}
  if(!reports.length)failures.push('no supported successful doctor invocation');
  if(id==='resource'){
    if(!reports.some(r=>r.findings?.some(f=>f.code==='RESOURCE_MISSING')&&r.findings?.some(f=>f.code==='STATE_STALE')))failures.push('both resource and stale state findings not observed');
    const expected=slash(packageRoot).toLowerCase();const repair=commands.some(c=>{if(c.exitCode!==0||!/iterlane\.mjs.*\brecover\b/u.test(c.command)||!c.command.includes('--repair')||!c.command.includes('--preview')||!c.command.includes('--package')||!slash(c.command).toLowerCase().includes(expected))return false;try{const r=JSON.parse(c.output);return r.ok===true&&r.command==='recover'&&r.data?.action==='preview'&&r.data.kind==='repair';}catch{return false;}});if(!repair)failures.push('matching-source repair preview not observed');
  }else if(!reports.some(r=>r.local_valid===true&&r.findings?.some(f=>f.code==='CLIENT_TRANSPORT')))failures.push('client observation conflated with resource health');
  return failures;
}
