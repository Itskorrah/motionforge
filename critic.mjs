/** Optional OpenAI vision critic. Real image input, one self-contained storyboard per scene.
 * Network/API access requires an explicit OPENAI_API_KEY. Never fabricates scores.
 */
import { readFile } from 'node:fs/promises';
import { generateJSON,providerConfig } from './studio/providers.mjs';

const ISSUE_TYPES=['none','weak_opening','too_static','poor_hierarchy','unreadable_text',
  'collision','cluttered','too_empty','weak_contrast','weak_colour','cut_continuity'];
const schema={type:'object',additionalProperties:false,required:['score','issues','critique'],properties:{
  score:{type:'integer'},issues:{type:'array',items:{type:'string',enum:ISSUE_TYPES}},
  critique:{type:'string'}
}};

export async function critiqueScene({image,provider='openai',model,scene,metrics,token,fetchImpl}) {
  const imageBase64=(await readFile(image)).toString('base64');
  const system=`You are an uncompromising motion-design art director. Evaluate the 2x2 storyboard in order: top-left opening, top-right early, bottom-left middle, bottom-right near end. Give conservative visual scores from 1 to 10; an 8 requires strong hierarchy, legible type, considered composition, meaningful movement and high polish. Penalise blank openings, weak contrast, overlap, lifeless holds and poor cut continuity. Storyboards alone cannot prove motion quality: use provided frame diagnostics for freezes. Return JSON with integer "score", string array "issues" chosen ONLY from ${ISSUE_TYPES.join(', ')}, and a concise "critique" string. No other fields.`;
  const user=`Evaluate scene ${scene+1} using the four frame samples and full-frame technical measurements: ${JSON.stringify(metrics)}`;
  const out=await generateJSON({imageBase64,system,user,provider,model,token,fetchImpl,schema});
  if(!Number.isInteger(out.score)||out.score<1||out.score>10||
     !Array.isArray(out.issues)||out.issues.some(x=>!ISSUE_TYPES.includes(x))||
     typeof out.critique!=='string'||out.critique.length>2000)
    throw Error('Invalid vision critique; rejecting artistic score');
  return {score:out.score,issues:out.issues,critique:out.critique,scene,provider,model:model||providerConfig(provider).model};
}

export function improveTuning(current, scenes) {
  const updated=structuredClone(current);
  updated.shots??={};
  const changes=[];
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,+x.toFixed(3)));
  for(const review of scenes){
    if(review.passed)continue;
    const id=review.scene;
    const edit={...updated.shots[id]};
    const issues=[...new Set([...review.technical.issues,...(review.visual?.issues||[])])];
    const changed=[];
    function set(key,value){ if(value!==edit[key]){changed.push(`${key}: ${edit[key]??'(default)'} -> ${value}`);edit[key]=value;} }
    if(issues.includes('blank_frames')||issues.includes('weak_opening') || issues.includes('too_empty'))
      set('preRoll',clamp((edit.preRoll||0)+.22,0,.4));
    if(issues.includes('frozen_run')||issues.includes('too_static'))
      set('pulseGain',clamp((edit.pulseGain??1)+.35,.7,2.1));
    if(issues.includes('collision')||issues.includes('cluttered')||issues.includes('unreadable_text'))
      set('artScale',clamp((edit.artScale??1)-.05,.85,1.13));
    if(issues.includes('poor_hierarchy')) set('artScale',clamp((edit.artScale??1)+.025,.85,1.13));
    if(issues.includes('weak_colour')||issues.includes('weak_contrast'))
      set('paletteShift',((edit.paletteShift||0)+1)%4);
    if(issues.includes('low_visual_detail') && !issues.includes('too_empty'))
      set('pulseGain',clamp((edit.pulseGain??1)+.3,.7,2.1));
    // If the AI identifies an aesthetic problem it cannot solve with the safe knobs,
    // we still apply a small physical pre-roll; report it as an experiment, not a fix.
    if(!changed.length && review.visual?.score<8)
      set('preRoll',clamp((edit.preRoll||0)+.08,0,.4));
    if(changed.length){updated.shots[id]=edit;changes.push({scene:id,issues,changes:changed});}
  }
  return {tuning:updated,changes};
}
