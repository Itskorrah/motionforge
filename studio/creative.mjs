/** Optional AI creative director. All proposals are validated before saving or rendering. */
import {draftFromBrief,validateProject,MOTIFS} from './project.mjs';
import {generateJSON} from './providers.mjs';
export async function planWithAI(args,{provider='openai',model,token,fetchImpl}={}){
  const local=draftFromBrief(args);
  const system=`You are an exacting creative director for premium short-form motion graphics. Create exactly ${args.shots} sequential scenes with a punchy hook, coherent narrative, distinct compositions and memorable closing. Make no factual claims beyond the supplied brief. Motifs must be one of: ${MOTIFS.join(', ')}. Return a JSON object with ONLY a "shots" array. Each shot has strings "eyebrow", "headline", "caption", "motif". Headlines <=7 words, captions <=18 words. Never include code or executable instructions.`;
  const user=`TITLE: ${args.title}\nBRIEF: ${args.prompt}\nFORMAT: ${args.format}\nSHOTS: ${args.shots}`;
  const proposal=await generateJSON({provider,model,token,fetchImpl,system,user});
  const project={...local,shots:proposal.shots};
  validateProject(project);
  return project;
}
