#!/usr/bin/env node
/** MotionForge production CLI: brief → plan → render → review → deliver. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { loadProject, draftFromBrief, saveProject, FORMATS, PALETTES } from './studio/project.mjs';
import { planWithAI } from './studio/creative.mjs';
const ROOT=dirname(fileURLToPath(import.meta.url));
const SCENE=join(ROOT,'studio','scene.html');
const help=`MotionForge — reusable, code-first motion-graphics studio
  node studio.mjs init --title "My video" --prompt "A punchy script. A second beat. A third idea. Final CTA." [--format vertical] [--shots 4] [--ai] [--out projects/my-video/project.json]
  node studio.mjs plan projects/my-video/project.json
  node studio.mjs render projects/my-video/project.json [--out exports/video.mp4] [--preview]
  node studio.mjs produce projects/my-video/project.json [--vision] [--min-score 8] [--max-passes 3] [--out exports/final.mp4] [--preview]
  node studio.mjs presets
  Extra: --chrome PATH --ffmpeg PATH --no-sandbox; --model MODEL for --ai/--vision
  All videos are beat-locked. --vision needs OPENAI_API_KEY (billed separately).
`;
function parse(argv){
  const [command,...args]=argv;
  const flags={},positions=[];
  const bool=new Set(['--ai','--vision','--preview','--no-sandbox','--keep-frames','--keep-attempt-frames']);
  const valid=new Set(['--title','--prompt','--format','--palette','--shots','--out','--model','--work','--max-passes','--min-score','--chrome','--ffmpeg',...bool]);
  for(let i=0;i<args.length;i++){
    const t=args[i];if(!t.startsWith('--')){positions.push(t);continue;}
    if(!valid.has(t))throw Error(`Unknown option ${t}`);
    if(bool.has(t)){flags[t.slice(2)]=true;continue;}
    if(!args[i+1]||args[i+1].startsWith('--'))throw Error(`Missing value for ${t}`);
    flags[t.slice(2)]=args[++i];
  }
  return {command,flags,positions};
}
function launch(script,args){return new Promise((ok,fail)=>{const p=spawn(process.execPath,[join(ROOT,script),...args],{stdio:'inherit'});p.on('error',fail);p.on('close',code=>code===0?ok():fail(Error(`Production command failed (exit ${code})`)));});}
async function main(){
 const {command,flags:f,positions}=parse(process.argv.slice(2));
 if(!command||['help','--help'].includes(command)){console.log(help);return;}
 if(command==='presets'){console.log(JSON.stringify({formats:FORMATS,palettes:PALETTES,motifs:['orbit','cards','wave','type']},null,2));return;}
 if(command==='init'){
  const args={title:f.title,prompt:f.prompt,format:f.format||'vertical',palette:f.palette||'aurora',shots:Number(f.shots||4)};
  const project=f.ai?await planWithAI(args,{model:f.model}):draftFromBrief(args);
  const safe=project.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'video';
  const out=f.out||join('projects',safe,'project.json');
  if(existsSync(resolve(out)))throw Error(`Will not overwrite project: ${out}`);
  console.log(`Created project: ${await saveProject(out,project)}`);console.log('Review headlines, captions and brand settings in the JSON before rendering.');return;
 }
 if(!['plan','render','produce'].includes(command))throw Error(`Unknown command ${command}\n${help}`);
 if(positions.length!==1)throw Error('Provide exactly one project.json path');
 const path=resolve(positions[0]);const {project:p,frames,seconds,timeline}=await loadProject(path);
 if(command==='plan'){
   console.log(JSON.stringify({title:p.title,format:p.format,size:`${p.width}x${p.height}`,durationSeconds:seconds,frames,bpm:p.bpm,fps:p.fps,cuts:timeline.cuts.map((cut,i)=>({...cut,headline:p.shots[i].headline,motif:p.shots[i].motif}))},null,2));return;
 }
 const [width,height]=f.preview?(p.format==='vertical'?[360,640]:p.format==='square'?[480,480]:[640,360]):[p.width,p.height];
 const out=resolve(f.out||join(ROOT,'exports',basename(dirname(path))+(command==='produce'?'-polished.mp4':'.mp4')));
 const common=['--project',path,'--scene',SCENE,'--width',String(width),'--height',String(height),'--fps',String(p.fps),'--bpm',String(p.bpm),'--beats-per-cut',String(p.beatsPerCut),'--seed',String(p.seed),...(f.chrome?['--chrome',f.chrome]:[]),...(f.ffmpeg?['--ffmpeg',f.ffmpeg]:[]),...(f['no-sandbox']?['--no-sandbox']:[])];
 if(command==='render')await launch('render.mjs',[...common,'--frames',String(frames),'--out',out,...(f['keep-frames']?['--keep-frames']:[])]);
 else await launch('qa-loop.mjs',[...common,'--seconds',String(seconds),'--out',out,'--work',resolve(f.work||join(dirname(out),basename(out,'.mp4')+'-review')),'--max-passes',String(f['max-passes']||3),'--min-score',String(f['min-score']||8),...(f.vision?['--vision']:[]),...(f.model?['--model',f.model]:[]),...(f['keep-attempt-frames']?['--keep-attempt-frames']:[])]);
 console.log(`Studio output: ${out}`);
}
main().catch(e=>{console.error(`MotionForge: ${e.message}`);process.exitCode=1;});
