// Parse the command structures emitted by this Windows CLI baseline. This is
// an evidence recognizer, not a general shell or JavaScript security sandbox.
export function words(source){
  const result=[];let value='',quote=null,active=false;
  const flush=()=>{if(active)result.push(value);value='';active=false;};
  for(let i=0;i<source.length;i++){const c=source[i];
    if(quote){if(c===quote)quote=null;else if(c==='\\'&&quote==='"'&&/["\\$`]/.test(source[i+1]||''))value+=source[++i];else value+=c;continue;}
    if(c==='"'||c==="'"){quote=c;active=true;}
    else if(c==='\\'&&/["'\\ ]/.test(source[i+1]||'')){value+=source[++i];active=true;}
    else if(/[\s;|]/.test(c)){flush();if(/[;|\n]/.test(c))result.push(c);}
    else{value+=c;active=true;}
  }flush();return result;
}
function lexical(source){
  let code='',quote=null,line=false,block=false,regex=false,characterClass=false;const strings=[];let start=0,value='';
  for(let i=0;i<source.length;i++){const c=source[i],next=source[i+1];
    if(line){code+=c==='\n'?'\n':' ';if(c==='\n')line=false;continue;}
    if(block){code+=' ';if(c==='*'&&next==='/'){code+=' ';i++;block=false;}continue;}
    if(regex){code+=' ';if(c==='\\'){code+=' ';i++;}else if(c==='[')characterClass=true;else if(c===']')characterClass=false;else if(c==='/'&&!characterClass)regex=false;continue;}
    if(quote){code+=' ';if(c==='\\'){value+=c+(next||'');code+=' ';i++;}else if(c===quote){strings.push({start,end:i+1,value,quote});quote=null;}else value+=c;continue;}
    if(c==='/'&&next==='/'){code+='  ';i++;line=true;}else if(c==='/'&&next==='*'){code+='  ';i++;block=true;}
    else if(c==='/'&&/[=(,:!{\[]/.test(code.trimEnd().at(-1)||'')){regex=true;characterClass=false;code+=' ';}
    else if(c==='"'||c==="'"||c==='`'){quote=c;start=i;value='';code+=' ';}else code+=c;
  }return {code,strings};
}
function literal(source){const value=source.trim();if(!/^(['"])[\s\S]*\1$/.test(value))return null;try{return value[0]==='"'?JSON.parse(value):value.slice(1,-1).replace(/\\(['"\\])/g,'$1');}catch{return null;}}
function arrayValues(source){const values=words(source.replace(/,/g,' '));return values.every(value=>!/[\[\]{}()]/.test(value))?values:null;}
function finiteArray(source,constants){
  const text=source.trim();if(!text.startsWith('[')||!text.endsWith(']'))return null;
  const inner=text.slice(1,-1),{code}=lexical(inner),parts=[];let start=0,depth=0;
  for(let i=0;i<code.length;i++){if(/[([{]/.test(code[i]))depth++;else if(/[)\]}]/.test(code[i]))depth--;else if(code[i]===','&&depth===0){parts.push(inner.slice(start,i));start=i+1;}}parts.push(inner.slice(start));
  const result=[];for(const part of parts.filter(p=>p.trim())){const value=literal(part);if(value!==null){result.push(value);continue;}
    const map=part.trim().match(/^\.\.\.\s*(\[[\s\S]*\])\.map\(\s*([\w$]+)\s*=>\s*([\s\S]+)\)$/);if(!map)return null;
    const suffixes=finiteArray(map[1],constants),concat=map[3].trim().match(/^([\w$]+)\s*\+\s*(['"])\/\2\s*\+\s*([\w$]+)$/),template=map[3].trim().match(/^`\$\{([\w$]+)\}\/\$\{([\w$]+)\}`$/),expression=concat||template;
    const prefix=expression&&constants.get(expression[1]),parameter=concat?concat[3]:template?.[2];if(!suffixes||prefix===undefined||parameter!==map[2])return null;
    result.push(...suffixes.map(suffix=>prefix+'/'+suffix));
  }return result;
}
function javascript(source,args=[],stateReferences=[],managedPaths=[]){
  const {code,strings}=lexical(source),aliases=new Set(),promisesAliases=new Set(),arrays=new Map(),bindings=new Map(),targets=[],hashOnlyTargets=[];
  const actual=match=>code.slice(match.index,match.index+match[0].length).trim().startsWith(match[0].trim().split(/[\s=(]/)[0]);
  for(const m of source.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*require\(\s*(['"])(?:node:)?fs\2\s*\)/g))if(actual(m)){aliases.add(m[1]);if(/^\.promises\b/.test(source.slice(m.index+m[0].length)))promisesAliases.add(m[1]);}
  const constants=new Map();for(const m of source.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*(['"])[^\n]*?\2\s*[;,]/g))if(actual(m)){const value=literal(m[0].replace(/^[\s\S]*?=/,'').replace(/[;,]$/,''));if(value!==null)constants.set(m[1],value);}
  for(const m of code.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*\[/g)){const start=m.index+m[0].length-1;let end=start+1,depth=1;while(end<code.length&&depth){if(code[end]==='[')depth++;else if(code[end]===']')depth--;end++;}const values=finiteArray(source.slice(start,end),constants);if(values)arrays.set(m[1],values);}
  for(const m of source.matchAll(/for\s*\(\s*(?:const|let|var)\s+([\w$]+)\s+of\s+\[([^\]]*)\]/g))if(actual(m)){const values=arrayValues(m[2]);if(values)bindings.set(m[1],values);}
  for(const m of code.matchAll(/for\s*\(\s*(?:const|let|var)\s+([\w$]+)\s+of\s+([\w$]+)\s*\)/g))if(arrays.has(m[2]))bindings.set(m[1],arrays.get(m[2]));
  for(const m of code.matchAll(/([\w$]+)\.map\(\s*\(?\s*([\w$]+)\s*\)?\s*=>/g))if(arrays.has(m[1]))bindings.set(m[2],arrays.get(m[1]));
  for(const m of code.matchAll(/for\s*\(\s*(?:const|let|var)\s+([\w$]+)\s+of\s+process\.argv\.slice\(1\)/g))bindings.set(m[1],args);
  for(const m of source.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=\s*(['"])[^\n]*?\2\s*[;,]/g))if(actual(m)){const value=literal(m[0].replace(/^[\s\S]*?=/,'').replace(/[;,]$/,''));if(value!==null)bindings.set(m[1],[value]);}
  for(const m of code.matchAll(/\bconst\s+([\w$]+)\s*=\s*([\w$]+)\s*\+\s*([\w$]+)\s*;/g)){
    // This bounded recognizer accepts plain ASCII identifiers only; do not
    // interpolate dollar-prefixed identifiers into mutation regular expressions.
    if([m[1],m[2],m[3]].some(name=>name.includes('$')))continue;
    const prefix=constants.get(m[2]),suffixes=bindings.get(m[3]);
    const immutablePrefix=new RegExp('\\bconst\\s+'+m[2]+'\\s*=').test(code.slice(0,m.index));
    const immutableSuffix=new RegExp('for\\s*\\(\\s*const\\s+'+m[3]+'\\s+of\\s+').test(code.slice(0,m.index));
    const mutation=name=>new RegExp('(?:\\b'+name+'\\s*(?:=(?!=)|[+*/%&|^?-]{1,3}=|\\+\\+|--)|(?:\\+\\+|--)\\s*\\b'+name+'\\b)');
    const suffixChanged=mutation(m[3]).test(code);
    if(prefix!==undefined&&suffixes&&/\/$/.test(prefix)&&immutablePrefix&&immutableSuffix&&!suffixChanged){
      const tail=code.slice(m.index+m[0].length),name=m[1];
      if(!mutation(name).test(tail))bindings.set(name,suffixes.map(suffix=>prefix+suffix));
    }
  }
  // Conditional/lazy readers are outside the accepted straight-line, for/map
  // and try/catch forms. Never infer execution from a partially parsed branch.
  const earlyGuards=[...code.matchAll(/if\s*\(\s*!\s*([\w$]+)\.existsSync\(\s*([\w$]+(?:\.path)?)\s*\)\s*\)\s*(?:return\s*\{\s*(?:(?:path|file)\s*:\s*[\w$]+|(?:path|file)|[\w$]+)\s*,\s*exists\s*:\s*false\s*\}\s*;|\{\s*[\w$]+\.push\(\s*\2\s*\)\s*;\s*continue\s*;?\s*\})/g)];
  for(const guard of earlyGuards){const stack=[];for(let i=0;i<guard.index;i++){if(code[i]==='{')stack.push(i);else if(code[i]==='}')stack.pop();}let end=stack.at(-1)??0,level=1;if(stack.length){end++;while(end<code.length&&level){if(code[end]==='{')level++;else if(code[end]==='}')level--;end++;}}else end=code.length;guard.scopeEnd=end;}
  let straightCode=code;for(const guard of earlyGuards)straightCode=straightCode.slice(0,guard.index)+guard[0].replace(/[^\n]/g,' ')+straightCode.slice(guard.index+guard[0].length);
  let invalid=/\bfunction\b/.test(straightCode),read=false;
  for(const m of code.matchAll(/(?:([\w$]+)\s*\.\s*(readFileSync|readFile)|require\(\s*\)\s*\.\s*(readFileSync))\s*\(/g)){
    if(m[1]&&!aliases.has(m[1])){invalid=true;continue;}
    if(!m[1]&&!/^require\(\s*(['"])(?:node:)?fs\1\s*\)/.test(source.slice(m.index))){invalid=true;continue;}
    for(const deferred of code.matchAll(/(?:async\s*)?(?:\(\s*(?:[\w$]+\s*(?:,\s*[\w$]+\s*)*)?\)|[\w$]+)\s*=>\s*/g)){
      const start=deferred.index+deferred[0].length;let end=code.indexOf(';',start);if(code[start]==='{'||code[start]==='('){const open=code[start],close=open==='{'?'}':')';let level=1;end=start+1;while(end<code.length&&level){if(code[end]===open)level++;else if(code[end]===close)level--;end++;}}
      if(m.index>=start&&(end<0||m.index<end)){
        const prefix=code.slice(0,deferred.index),map=prefix.match(/([\w$]+)\.map\(\s*$/),iife=/^async\b/.test(deferred[0])&&prefix.trimEnd().endsWith('(')&&(!prefix.trimEnd().slice(0,-1).trimEnd()||prefix.trimEnd().slice(0,-1).trimEnd().endsWith(';'))&&/^\s*\)\s*\(\s*\)/.test(code.slice(end));
        if(!map||!arrays.has(map[1]))if(!iife)invalid=true;
      }
    }
    if(m[2]==='readFile'){
      const batchPrefix=code.slice(code.lastIndexOf(';',m.index-1)+1,m.index),iifes=[...code.matchAll(/\(\s*async\s*\(\s*\)\s*=>\s*\{/g)];
      const iife=iifes.find(frame=>{if(frame.index>=m.index)return false;const before=code.slice(0,frame.index).trimEnd();return (!before||before.endsWith(';'))&&/^\s*\)\s*\(\s*\)\s*;?\s*$/.test(code.slice(code.lastIndexOf('}')+1));});
      if(!promisesAliases.has(m[1])||(code.match(/\basync\b/g)||[]).length!==1||!iife||!/await\s+Promise\.allSettled\(\s*[\w$]+\.map\(/.test(batchPrefix)){invalid=true;continue;}
    }
    for(const branch of straightCode.matchAll(/\bif\s*\(/g)){
      let cursor=branch.index+branch[0].length,level=1;while(cursor<straightCode.length&&level){if(straightCode[cursor]==='(')level++;else if(straightCode[cursor]===')')level--;cursor++;}
      const endBody=start=>{while(/\s/.test(straightCode[start]||'')&&start<straightCode.length)start++;let end=straightCode.indexOf(';',start);if(straightCode[start]==='{'){let depth=1;end=start+1;while(end<straightCode.length&&depth){if(straightCode[end]==='{')depth++;else if(straightCode[end]==='}')depth--;end++;}}return {start,end};};
      const body=endBody(cursor);if(m.index>=body.start&&(body.end<0||m.index<body.end))invalid=true;
      if(body.end>=0){const suffix=straightCode.slice(body.end).match(/^\s*else\b/);if(suffix){const alternative=endBody(body.end+suffix[0].length);if(m.index>=alternative.start&&(alternative.end<0||m.index<alternative.end))invalid=true;}}
    }
    read=true;const argStart=m.index+m[0].length;const arg=source.slice(argStart).match(/^\s*((['"])(?:\\.|[^\\])*?\2|[\w$]+(?:\[\d+\]|\.[\w$]+)?)/)?.[1];
    if(!arg||!/^\s*(?:,|\))/.test(source.slice(argStart).trimStart().slice(arg.length))){invalid=true;continue;}
    let depth=1,callEnd=argStart;while(callEnd<code.length&&depth){if(code[callEnd]==='(')depth++;else if(code[callEnd]===')')depth--;callEnd++;}
    for(const early of earlyGuards)if(early.index<m.index&&m.index<early.scopeEnd&&(early[1]!==m[1]||early[2]!==arg))invalid=true;
    const statementStart=code.lastIndexOf(';',m.index-1)+1,statementEnd=code.indexOf(';',callEnd)<0?code.length:code.indexOf(';',callEnd);
    let expression=code.slice(statementStart,statementEnd);
    const guard=source.slice(statementStart,m.index).match(/([\w$]+)\.existsSync\(\s*([\w$]+)\s*\)\s*\?\s*$/);
    if(guard&&guard[1]===m[1]&&guard[2]===arg&&/^\s*:\s*(?:null|undefined)\b/.test(source.slice(callEnd)))expression=expression.replace(new RegExp('\\b'+guard[1]+'\\.existsSync\\(\\s*'+guard[2]+'\\s*\\)\\s*\\?'),'');
    for(const format of source.matchAll(/\b[\w$]+\.isDirectory\(\)\s*\?\s*(['"])directory\1\s*:\s*(['"])file\2/g))if(format.index>=statementStart&&format.index+format[0].length<=statementEnd){const offset=format.index-statementStart;expression=expression.slice(0,offset)+format[0].replace(/[^\n]/g,' ')+expression.slice(offset+format[0].length);}
    if(/&&|\|\||\?/.test(expression)){invalid=true;continue;}
    const value=arg&&literal(arg),indexed=arg?.match(/^([\w$]+)\[(\d+)\]$/);
    if(value!==null&&value!==undefined)targets.push(value);
    else if(bindings.has(arg))targets.push(...bindings.get(arg));
    else if(indexed&&arrays.has(indexed[1])&&arrays.get(indexed[1])[Number(indexed[2])]!==undefined)targets.push(arrays.get(indexed[1])[Number(indexed[2])]);
    else if(indexed&&indexed[2]==='1'&&stateReferences.length&&targets.includes('docs/workflow/state.yaml')&&new RegExp('for\\s*\\(\\s*const\\s+'+indexed[1]+'\\s+of\\s+[\\w$]+\\.matchAll\\(').test(code)&&source.includes('path:')&&source.includes('sha256:'))targets.push(...stateReferences);
    else if(/^[\w$]+\.path$/.test(arg)&&managedPaths.length&&targets.includes('.ai-workflow/manifest.json')){
      const iterator=arg.split('.')[0],loop=code.match(new RegExp('for\\s*\\(\\s*const\\s+'+iterator+'\\s+of\\s+([\\w$]+)\\.files\\s*\\)'));
      const name=loop?.[1],binding=name&&new RegExp('const\\s+'+name+'\\s*=\\s*JSON\\.parse\\(\\s*[\\w$]+\\.readFileSync\\(\\s*([\'\"])\\.ai-workflow/manifest\\.json\\1\\s*,\\s*([\'\"])utf8\\2\\s*\\)\\s*\\)').test(source);
      if(binding&&!new RegExp('\\b'+name+'\\.files\\s*=').test(code)){targets.push(...managedPaths);hashOnlyTargets.push(...managedPaths);}else invalid=true;
    }
    else invalid=true;
  }
  if([...aliases].some(alias=>new RegExp('\\b'+alias+'\\.(?:readFileSync|readFile|existsSync)\\s*=').test(code)))invalid=true;
  const external=strings.map(s=>literal(source.slice(s.start,s.end))).filter(v=>typeof v==='string'&&/^(?:[a-z]:[\\/]|\.\.[\\/]|\.codex[\\/])/i.test(v));
  return {read,targets,hashOnlyTargets,invalid,external};
}
export function analyzeCommand(command,{stateReferences=[],managedPaths=[]}={}){
  const outer=words(command);let source=command;
  if(/powershell(?:\.exe)?$/i.test(outer[0]||'')){const index=outer.findIndex(word=>word.toLowerCase()==='-command');if(index<0||!outer[index+1])return {invalid:true,targets:[]};source=outer[index+1];}
  source=source.replace(/<#[\s\S]*?#>/g,match=>match.replace(/[^\n]/g,' '));
  const targets=[],external=[],hashOnlyTargets=[];let read=false,check=false,invalid=false;
  const snippets=[];let shell=source;
  for(const m of source.matchAll(/@'\r?\n([\s\S]*?)\r?\n'@/g)){
    const prefix=source.slice(0,m.index),suffix=source.slice(m.index+m[0].length),assignment=prefix.match(/\$([\w]+)\s*=\s*$/);
    if(/^\s*\|\s*node(?:\s|$)/.test(suffix)||assignment&&new RegExp('\\$'+assignment[1]+'\\s*\\|\\s*node(?:\\s|$)').test(suffix))snippets.push({source:m[1],args:[]});
    shell=shell.replace(m[0],'"HEREDOC"');
  }
  const tokens=words(shell);let statement=[];
  const inspect=()=>{if(/^node(?:\.exe)?$/i.test(statement[0]||'')){
    if(statement[1]==='-e'&&statement[2])snippets.push({source:statement[2],args:statement.slice(3)});
    else if(statement[1]?.replace(/\\/g,'/')==='.ai-workflow/bin/iterlane.mjs'&&statement[2]==='check')check=true;
  }statement=[];};
  for(const token of tokens){if(/[;|\n]/.test(token)&&token.length===1)inspect();else statement.push(token);}inspect();
  for(const snippet of snippets){const result=javascript(snippet.source,snippet.args,stateReferences,managedPaths);read ||= result.read;invalid ||= result.invalid;targets.push(...result.targets);hashOnlyTargets.push(...result.hashOnlyTargets);external.push(...result.external);}
  // PowerShell Get-Content: accept literal arguments and the simple foreach
  // array form used by the client; reject unresolved expressions.
  const {code}=lexical(shell.replace(/#[^\n]*/g,''));
  for(const m of code.matchAll(/\bGet-Content\b/gi)){
    read=true;const tail=shell.slice(m.index+m[0].length),argument=tail.match(/^\s*(?:(?:-LiteralPath|-Path)\s+)?((['"])[\s\S]*?\2|\$[\w]+|[^\s;|]+)/)?.[1];
    const value=argument&&literal(argument);
    if(value!==null&&value!==undefined)targets.push(value);
    else if(argument?.startsWith('$')){
      const loop=code.match(new RegExp('foreach\\s*\\(\\s*'+argument.replace('$','\\$')+'\\s+in\\s+\\$([\\w]+)'));
      const declaration=loop&&shell.match(new RegExp('\\$'+loop[1]+'\\s*=\\s*@\\(([^)]*)\\)'));
      const values=declaration&&arrayValues(declaration[1]);if(values)targets.push(...values);else invalid=true;
    }else if(argument&&!argument.startsWith('-'))targets.push(argument);else invalid=true;
  }
  return {read,check,invalid,targets:[...new Set(targets)],hashOnlyTargets:[...new Set(hashOnlyTargets)],external};
}
