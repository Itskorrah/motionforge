/** Editorial preflight: actionable heuristics, NOT an aesthetic score. */
import {validateProject} from './project.mjs';
const words = s => String(s||'').trim().split(/\s+/).filter(Boolean).length;
const normal = s => String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
export const CRAFT_DIMENSIONS = Object.freeze([
  {id:'story',title:'Story',why:'A hook, coherent progression and intentional finish.'},
  {id:'type',title:'Typography',why:'A single visual headline, short captions and legible pacing.'},
  {id:'composition',title:'Composition',why:'Deliberate shot variety, negative space and safe-zone awareness.'},
  {id:'motion',title:'Motion',why:'One motivated focal movement; secondary animation stays subordinate.'},
  {id:'sound',title:'Sound',why:'Sound communicates emphasis; cuts obey the shared beat clock.'},
  {id:'identity',title:'Brand',why:'A consistent system with a distinctive visual point of view.'},
  {id:'delivery',title:'Delivery',why:'Correct format, sharp output and a manual final watch.'},
]);
function issue(id,level,message,action,shot=null){return {id,level,message,action,shot};}
export function auditProject(project){
  const {frames,seconds,timeline}=validateProject(project),shots=project.shots;
  const issues=[];
  const add=(...args)=>issues.push(issue(...args));
  if(shots.length<3)add('story','advice','The narrative has fewer than three shots.','Try a hook, proof or explanation, and an ending.');
  const creative=project.creative||{};
  if(!String(creative.audience||'').trim())add('story','advice','Audience is undefined.','Identify who should care about the message.');
  if(!String(creative.goal||'').trim())add('story','advice','The viewer outcome is undefined.','State what the viewer should know, feel or do.');
  if(!String(creative.hook||'').trim())add('story','advice','No explicit opening hook.','Make the first shot earn attention immediately.');
  if(!String(creative.callToAction||'').trim())add('story','advice','The ending lacks an explicit intent.','Decide whether to prompt action or leave one memorable thought.');
  const seen=new Set();
  shots.forEach((s,i)=>{
    const h=words(s.headline),c=words(s.caption),key=normal(s.headline);
    if(h>7)add('type','warning',`Shot ${i+1} headline has ${h} words.`, 'Aim for one focal thought in 3–7 words.',i);
    if(c>18)add('type','warning',`Shot ${i+1} caption has ${c} words.`, 'Remove secondary claims or create another shot.',i);
    if(h<2)add('type','advice',`Shot ${i+1} headline is very short.`, 'Confirm a single word delivers the intended meaning.',i);
    if(seen.has(key))add('story','warning',`Shot ${i+1} repeats a previous headline.`,'Give every beat a new piece of information.',i);
    seen.add(key);
    if(normal(s.caption)===key)add('story','advice',`Shot ${i+1} caption duplicates its headline.`,'Use the caption for supporting evidence or remove it.',i);
  });
  if(new Set(shots.map(s=>s.motif)).size===1&&shots.length>2)
    add('composition','warning','Every shot uses the same visual motif.','Vary scale or visual grammar to create a clear progression.');
  if(seconds>32)add('delivery','advice',`This cut is ${seconds}s long.`, 'Check whether every hold earns its duration.');
  if(project.format==='vertical')add('composition','note','Platform interface overlays differ.','Preview the safe-zone guide and inspect on an actual phone.');
  add('sound','note',`${timeline.cuts.length} cuts are frame-locked at ${project.bpm} BPM.`,'Listen to transitions on speakers and headphones.');
  const blocking=issues.filter(x=>x.level==='warning');
  return {ready:blocking.length===0,warningCount:blocking.length,adviceCount:issues.filter(x=>x.level==='advice').length,
    durationSeconds:seconds,totalFrames:frames,issues,method:'Editorial heuristics only. This is not an artistic score or human sign-off.'};
}
