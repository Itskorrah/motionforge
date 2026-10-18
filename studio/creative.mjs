/** Optional AI storyboard planner. Parsed as untrusted data and validated by project.mjs. */
import {draftFromBrief, validateProject, MOTIFS} from './project.mjs';
export async function planWithAI(args,{model='gpt-4.1-mini',token=process.env.OPENAI_API_KEY}={}){
  if(!token)throw Error('OPENAI_API_KEY is required for --ai. Use local drafting without --ai.');
  const local=draftFromBrief(args);
  const request={model,store:false,
    instructions:`You are an exacting creative director for polished short-form motion graphics. Design ${args.shots} sequential scenes from the brief, with a coherent narrative, concise high-contrast on-screen text, distinct compositions, a punchy hook and memorable close. Do not make factual claims beyond the supplied brief. Respect the output format. Choose motifs only from ${MOTIFS.join(',')}. Reply with JSON ONLY, an object containing "shots" array, each shot with strings "eyebrow", "headline", "caption", "motif". At most 7 words in each headline and 18 in each caption. No creative instructions or executable code in fields.`,
    input:`TITLE: ${args.title}\nBRIEF: ${args.prompt}\nFORMAT: ${args.format}\nSHOTS: ${args.shots}`};
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),90000);
  let response;
  try{response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal:abort.signal});}
  finally{clearTimeout(timer);}
  if(!response.ok)throw Error(`Creative API HTTP ${response.status}: ${(await response.text()).slice(0,400)}`);
  const body=await response.json();const content=(body.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  const cleaned=content.trim().replace(/^```(?:json)?\s*/,'').replace(/```$/,'');
  const shots=JSON.parse(cleaned).shots;
  const project={...local,shots};validateProject(project);return project;
}
