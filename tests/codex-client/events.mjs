export function eventEvidence(stdout){
  const events=stdout.split('\n').filter(line=>line.trim()).map(line=>{try{return JSON.parse(line);}catch{return {type:'unparsed',line};}});
  return {
    completed:events.some(event=>event.type==='turn.completed'),
    errors:events.filter(event=>['error','unparsed','turn.failed'].includes(event.type)),
    final:events.filter(event=>event.type==='item.completed'&&event.item?.type==='agent_message').map(event=>event.item.text).at(-1),
    commands:events.filter(event=>event.type==='item.completed'&&event.item?.type==='command_execution').map(event=>({command:event.item.command,exitCode:event.item.exit_code,output:event.item.aggregated_output||''})),
  };
}
