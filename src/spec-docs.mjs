// Fence/ATX and section-boundary methods adapted from OpenSpec (MIT).
// Fixed source and full license: sources/openspec-NOTICE.md.
import {createHash} from 'node:crypto';
import {assertPortablePath} from './paths.mjs';
import {WorkflowError} from './errors.mjs';

export const specId=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/u;
export const digest=text=>createHash('sha256').update(text).digest('hex');
export const issue=(code,path,message,line=null,record_id=null)=>({code,path,record_id,line,message});
const invalid=message=>{throw new WorkflowError('STATE_INVALID',message);};

export function markdownLines(text){
  const rows=[];let offset=0,fence=null,comment=false;
  for(const match of text.matchAll(/[^\n]*(?:\n|$)/gu)){
    const raw=match[0];if(!raw.length)continue;
    const line=raw.replace(/\r?\n$/u,'').replace(/^\ufeff/u,'');
    const row={raw,line,start:offset,end:offset+raw.length,hidden:false,inComment:comment};offset+=raw.length;
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if(fence){
      row.hidden=true;
      if(marker&&marker[1][0]===fence.marker&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;
    }else if(comment){
      row.hidden=true;if(line.includes('-->'))comment=false;
    }else if(marker&&!(marker[1][0]==='`'&&marker[2].includes('`'))){
      row.hidden=true;fence={marker:marker[1][0],length:marker[1].length};
    }else if(line.includes('<!--')){
      row.hidden=true;comment=!line.slice(line.indexOf('<!--')+4).includes('-->');
    }
    rows.push(row);
  }
  return {rows,unclosedFence:!!fence,unclosedComment:comment};
}
export function heading(line){
  const match=line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/u);
  return match?{level:match[1].length,title:match[2].replace(/[ \t]+#+[ \t]*$/u,'').trim()}:null;
}
const identity=(title,label)=>{
  const match=title.match(new RegExp('^'+label+':[ \\t]+([^ \\t]+)[ \\t]+(\\S.*)$','u'));
  return match&&specId.test(match[1])?{id:match[1],title:match[2]}:null;
};
export function parseSpecification(text,path,{legacy=false}={}){
  try{assertPortablePath(path);}catch{invalid('Specification path must be a safe relative path');}
  if(typeof text!=='string'||Buffer.byteLength(text)>1024*1024||/[\u0000\ufffd]/u.test(text))invalid('Specification must be bounded UTF-8 text');
  const requirements=new Map(),sections=new Map(),issues=[],parsed=markdownLines(text),rows=parsed.rows,top=new Map(),reqAliases=new Set();
  const note=(code,message,index=0)=>issues.push(issue(code,path,message,index+1));
  if(!text.trim())return {text,path,requirements,sections,issues,has_requirement_header:false};
  if(parsed.unclosedFence)note('UNCLOSED_FENCE','Unclosed fenced example');
  if(parsed.unclosedComment)note('UNCLOSED_COMMENT','Unclosed HTML comment');
  let section=null,current=null,scene=null,hasRequirementHeader=false;
  function finishScene(end){
    if(!scene)return;
    scene.raw=text.slice(scene.start,end);
    const steps=rows.filter(r=>!r.hidden&&r.start>=scene.start&&r.start<end).map(r=>r.line).join('\n');
    for(const name of ['WHEN','THEN'])if(!new RegExp('^[ \\t]*(?:[-*+]|[0-9]+[.)])?[ \\t]*\\*\\*'+name+'\\*\\*[ \\t]+\\S','mu').test(steps))note('MISSING_SCENARIO_STEP','Scenario '+scene.id+' needs '+name,scene.line-1);
    scene=null;
  }
  function finishRequirement(end){
    finishScene(end);if(!current)return;
    const raw=text.slice(current.start,end);
    sections.set(current.id,{start:current.start,end,raw,sha256:digest(raw)});
    if(!current.scenarios.size)note('MISSING_SCENARIO','Requirement '+current.id+' has no identified scenario',current.line-1);
    current=null;
  }
  for(let index=0;index<rows.length;index++){
    const row=rows[index];if(row.hidden)continue;
    const h=heading(row.line);if(!h)continue;
    if(h.level<=2){
      finishRequirement(row.start);section=h.level===2?h.title:null;
      if(h.level===2&&['Purpose','Scope','Requirements'].includes(h.title)){
        if(top.has(h.title))note('DUPLICATE_SECTION','Section '+h.title+' is repeated',index);
        else top.set(h.title,{index,start:row.end,end:text.length});
      }
      if(h.level===2&&/^(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements$/iu.test(h.title))note('DELTA_IN_EFFECTIVE_SPEC','Delta sections do not belong in effective specifications',index);
      for(const item of top.values())if(item.index!==index&&item.end===text.length&&item.start<row.start)item.end=row.start;
      continue;
    }
    if(h.level===3&&h.title.startsWith('Requirement:')){
      hasRequirementHeader=true;finishRequirement(row.start);
      const id=identity(h.title,'Requirement');
      if(!id){note(legacy?'LEGACY_SPEC':'MISSING_REQUIREMENT_ID','Requirement needs a stable ID and a title',index);continue;}
      if(section!=='Requirements'){note('REQUIREMENT_OUTSIDE_SECTION','Requirement '+id.id+' is outside Requirements',index);continue;}
      if(reqAliases.has(id.id.toLowerCase())){note('DUPLICATE_REQUIREMENT','Requirement ID is repeated or aliased: '+id.id,index);continue;}
      reqAliases.add(id.id.toLowerCase());
      current={...id,start:row.start,line:index+1,scenarios:new Map(),aliases:new Set()};requirements.set(id.id,current);continue;
    }
    if(h.level===4&&h.title.startsWith('Scenario:')){
      finishScene(row.start);
      if(!current){note('ORPHAN_SCENARIO','Scenario has no owning requirement',index);continue;}
      const id=identity(h.title,'Scenario');
      if(!id){note(legacy?'LEGACY_SPEC':'MISSING_SCENARIO_ID','Scenario needs a stable ID and a title',index);continue;}
      if(current.aliases.has(id.id.toLowerCase())){note('DUPLICATE_SCENARIO','Scenario ID is repeated or aliased: '+id.id,index);continue;}
      current.aliases.add(id.id.toLowerCase());scene={...id,start:row.start,line:index+1};current.scenarios.set(id.id,scene);continue;
    }
    if(h.level===3){finishRequirement(row.start);note('UNRECOGNIZED_SPEC_HEADING','Expected a Requirement heading',index);}
    else if(h.level===4){finishScene(row.start);note('UNRECOGNIZED_SPEC_HEADING','Expected a Scenario heading',index);}
  }
  finishRequirement(text.length);
  for(const name of ['Purpose','Scope','Requirements']){
    const item=top.get(name);
    if(!item)note(legacy?'LEGACY_SPEC':'MISSING_SECTION','Specification needs '+name);
    else if(name!=='Requirements'&&!rows.some(r=>r.start>=item.start&&r.start<item.end&&!r.hidden&&r.line.trim()))note('EMPTY_SECTION',name+' must describe the actual capability',item.index);
  }
  if(!requirements.size)note(legacy?'LEGACY_SPEC':'MISSING_REQUIREMENT','No identified requirement is present');
  return {text,path,requirements,sections,issues,has_requirement_header:hasRequirementHeader};
}
