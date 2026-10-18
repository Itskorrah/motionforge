/** Optional OpenAI vision critic. Real image input, one self-contained storyboard per scene.
 * Network/API access requires an explicit OPENAI_API_KEY. Never fabricates scores.
 */
import { readFile } from 'node:fs/promises';

const ISSUE_TYPES=['none','weak_opening','too_static','poor_hierarchy','unreadable_text',
  'collision','cluttered','too_empty','weak_contrast','weak_colour','cut_continuity'];
const schema={type:'object',additionalProperties:false,required:['score','issues','critique'],properties:{
  score:{type:'integer'},issues:{type:'array',items:{type:'string',enum:ISSUE_TYPES}},
  critique:{type:'string'}
}};

export async function critiqueScene({image,model='gpt-4.1-mini',scene,metrics,token=process.env.OPENAI_API_KEY}) {
  if(!token) throw Error('OPENAI_API_KEY is missing; cannot claim a vision-based 8/10 score');
  const imageData=(await readFile(image)).toString('base64');
  const payload={model,store:false,
    instructions:`You are an uncompromising motion design art director. Examine the actual 2x2 frame storyboard (reading order: top-left opening, top-right early, bottom-left middle, bottom-right near end), and accompanying all-frame diagnostic metrics. Return conservative visual scores 1-10: 8 requires strong hierarchy, legible type, compelling composition, meaningful motion and high production polish; 9+ is exceptional. Never give 8 by default. Empty opening frames, overlap, weak or illegible text, awkward balances and lifeless holds must be penalised. A storyboard alone does not show all animation; rely on diagnostics for dead/frozen intervals. Choose actionable issue types. JSON only.`,
    input:[{role:'user',content:[{type:'input_text',text:`Evaluate visual scene ${scene+1}. The four images are frame samples at opening, early, middle and near end. These full-sequence objective measurements are factual: ${JSON.stringify(metrics)}. Return your honest visual rating and a concise actionable critique.`},
      {type:'input_image',image_url:`data:image/png;base64,${imageData}`,detail:'high'}]}],
    text:{format:{type:'json_schema',name:'scene_review',strict:true,schema}}};
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),90000);
  let response;
  try {response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(payload),signal:controller.signal});} finally{clearTimeout(timeout);}
  if(!response.ok) throw Error(`Vision API HTTP ${response.status}: ${(await response.text()).slice(0,700)}`);
  const body=await response.json();
  const txt=(body.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  if(!txt)throw Error(`Vision API returned no review: ${JSON.stringify(body).slice(0,600)}`);
  const out=JSON.parse(txt);
  if(!Number.isInteger(out.score)||out.score<1||out.score>10||!Array.isArray(out.issues)||typeof out.critique!=='string')
    throw Error('Invalid vision critique, rejecting grade');
  return {...out,scene,provider:'OpenAI Responses vision',model};
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
