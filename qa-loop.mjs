#!/usr/bin/env node
/** Deterministic render → inspect EVERY frame → AI vision critique → targeted tune → re-render.
 * Never silently invents vision scores or asserts unearned 8/10 quality.
 */
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyseFrames, selectSamples, contactSheet } from './quality.mjs';
import { critiqueScene, improveTuning } from './critic.mjs';
import { createTimeline } from './timeline.mjs';
import { loadProject } from './studio/project.mjs';
import {providerConfig} from './studio/providers.mjs';
const renderer=fileURLToPath(new URL('./render.mjs',import.meta.url));
const usage=`Usage: node qa-loop.mjs [--out final.mp4] [--work qa-work] [--max-passes 3]
  --vision             Require real provider image review (needs provider API key)
  --provider NAME      openai | claude | gemini | grok (default: openai)
  --model MODEL        Vision model (provider-specific default)
  --project PATH       MotionForge production spec (must exactly match timeline)
  --scene PATH         Custom HTML Canvas scene (must accept tuning for auto repairs)
  --min-score N        Minimum score for every scene (default: 8)
  --width N --height N --fps N --seconds N --bpm N --beats-per-cut N --seed N
  --chrome PATH --ffmpeg PATH --no-sandbox
  --keep-attempt-frames  Preserve every individual PNG for inspection
  --help
No API key? The loop performs technical dead-frame QA, creates contact sheets and
can repair defects, but reports artistic quality as UNVERIFIED — never fake 8/10.
Example:
  ANTHROPIC_API_KEY=... node qa-loop.mjs --vision --provider claude --max-passes 3 --out polished.mp4
`;
function opts(argv){
 const a={out:'polished.mp4',work:'quality-review',maxPasses:3,provider:'openai',model:null,minScore:8,
  width:1280,height:720,fps:30,seconds:8,bpm:120,beatsPerCut:4,seed:7,vision:false,
  keepAttemptFrames:false,noSandbox:false};
 const names={'--out':'out','--work':'work','--max-passes':'maxPasses','--model':'model','--provider':'provider',
  '--min-score':'minScore','--scene':'scene','--project':'project','--width':'width','--height':'height','--fps':'fps','--seconds':'seconds',
  '--bpm':'bpm','--beats-per-cut':'beatsPerCut','--seed':'seed','--chrome':'chrome','--ffmpeg':'ffmpeg'};
 const numbers=new Set(['maxPasses','minScore','width','height','fps','seconds','bpm','beatsPerCut','seed']);
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--help'){console.log(usage);process.exit(0);}
  if(argv[i]==='--vision'){a.vision=true;continue;}
  if(argv[i]==='--keep-attempt-frames'){a.keepAttemptFrames=true;continue;}
  if(argv[i]==='--no-sandbox'){a.noSandbox=true;continue;}
  const k=names[argv[i]];if(!k||!argv[i+1])throw Error(`Bad argument: ${argv[i]}\n${usage}`);
  a[k]=numbers.has(k)?Number(argv[++i]):argv[++i];
 }
 if(!Number.isInteger(a.maxPasses)||a.maxPasses<1||a.maxPasses>8)throw Error('max-passes must be 1..8');
 if(!Number.isInteger(a.minScore)||a.minScore<1||a.minScore>10)throw Error('min-score must be 1..10');
 for(const k of ['fps','width','height','beatsPerCut','seed'])if(!Number.isInteger(a[k]))throw Error(`${k} must be an integer`);
 if(a.width%2||a.height%2||a.width<64||a.height<64)throw Error('width/height must be even and >=64');
 if(!Number.isFinite(a.seconds)||a.seconds<=0)throw Error('seconds must be positive');
 const frames=Math.round(a.seconds*a.fps);
 a.timeline=createTimeline({...a,frames});a.frames=frames;
 a.out=resolve(a.out);a.work=resolve(a.work);
 if(a.vision){const cfg=providerConfig(a.provider,a.model);if(!cfg.apiKey)throw Error(`Vision critique needs ${cfg.envName}. Without it omit --vision for technical checks only.`);}
 return a;
}
function child(args){return new Promise((ok,no)=>{
 const p=spawn(process.execPath,[renderer,...args],{stdio:'inherit'});
 p.on('error',no);p.on('close',code=>code===0?ok():no(Error(`Renderer exited ${code}`)));
});}
const truncate=s=>String(s).length>400?String(s).slice(0,400)+'…':s;
async function main(){
 const a=opts(process.argv.slice(2));
 if(a.project){const spec=await loadProject(a.project);if(spec.frames!==a.frames||spec.project.fps!==a.fps||spec.project.bpm!==a.bpm||spec.project.beatsPerCut!==a.beatsPerCut)throw Error('QA timeline does not match project.json');}
 if(a.work===dirname(a.out))throw Error('--work must be a dedicated folder distinct from output parent');
 await mkdir(a.work,{recursive:true});await mkdir(dirname(a.out),{recursive:true});
 let tuning={shots:{}}, best=null, attempts=[];
 console.log(a.vision?`VISION QUALITY GATE: >=${a.minScore}/10 on EVERY scene`:
   'NO VISION KEY: technical dead-frame review only; 8/10 aesthetic quality CANNOT be certified');
 for(let pass=1;pass<=a.maxPasses;pass++){
  console.log(`\n===== QA PASS ${pass}/${a.maxPasses} =====`);
  const base=join(a.work,`pass-${String(pass).padStart(2,'0')}`);
  const mp4=base+'.mp4', config=base+'-tuning.json', folder=base+'-frames';
  await writeFile(config,JSON.stringify(tuning,null,2));
  await child(['--out',mp4,'--keep-frames','--tuning',config,...(a.scene?['--scene',a.scene]:[]),...(a.project?['--project',a.project]:[]),
   '--width',String(a.width),'--height',String(a.height),'--fps',String(a.fps),
   '--frames',String(a.frames),'--bpm',String(a.bpm),'--beats-per-cut',String(a.beatsPerCut),
   '--seed',String(a.seed),...(a.chrome?['--chrome',a.chrome]:[]),
   ...(a.ffmpeg?['--ffmpeg',a.ffmpeg]:[]),...(a.noSandbox?['--no-sandbox']:[])]);
  const technical=await analyseFrames({ffmpeg:a.ffmpeg||'ffmpeg',framesDir:folder,
    fps:a.fps,frames:a.frames,cutInterval:a.timeline.cutInterval});
  const scenes=[];
  for(const scene of technical.scenes){
   const sheet=base+`-scene-${String(scene.scene+1).padStart(2,'0')}.png`;
   const sampled=selectSamples(scene.firstFrame,scene.lastFrame);
   await contactSheet({ffmpeg:a.ffmpeg||'ffmpeg',framesDir:folder,output:sheet,frames:sampled,aspect:a.width<a.height?'vertical':a.width===a.height?'square':'landscape'});
   let visual=null;
   if(a.vision){
    visual=await critiqueScene({image:sheet,provider:a.provider,model:a.model,scene:scene.scene,metrics:scene});
   }
   const passed=scene.technicalScore>=a.minScore && (!a.vision || visual.score>=a.minScore);
   scenes.push({scene:scene.scene,samples:sampled,storyboard:sheet,technical:scene,visual,passed});
   console.log(`Scene ${scene.scene+1}: technical ${scene.technicalScore}/10; `+
     (a.vision?`vision ${visual.score}/10; `:'vision UNVERIFIED; ')+
     `${passed?'technical'+(a.vision?'+visual PASS':' PASS'):'REVISE'}; `+
     `flags: ${[...scene.issues,...(visual?.issues||[])].join(',')||'none'}`);
   if(visual)console.log(`  critique: ${truncate(visual.critique)}`);
  }
  const passed=scenes.every(s=>s.passed);
  const minTechnical=Math.min(...scenes.map(s=>s.technical.technicalScore));
  const minVision=a.vision?Math.min(...scenes.map(s=>s.visual.score)):null;
  const rank=a.vision?Math.min(minTechnical,minVision):minTechnical;
  const entry={pass,mp4,tuning:structuredClone(tuning),scenes,passed,
    technicalMinimum:minTechnical,visionMinimum:minVision,rank,changes:[]};
  if(!best||entry.rank>best.rank||(entry.rank===best.rank && scenes.filter(s=>s.passed).length>best.scenes.filter(s=>s.passed).length))best=entry;
  attempts.push(entry);
  // Save an incremental report even if a future Chrome/API process crashes.
  await writeFile(join(a.work,'review-history.json'),JSON.stringify({attempts,visionEnabled:a.vision},null,2));
  if(!a.keepAttemptFrames)await rm(folder,{recursive:true,force:true});
  if(passed){console.log('\nAll requested gates passed.');break;}
  if(pass<a.maxPasses){
   const revised=improveTuning(tuning,scenes);
   entry.changes=revised.changes;
   if(!revised.changes.length){console.log('No bounded safe fix is available; stopping rather than pretending to improve.');break;}
   tuning=revised.tuning;
   console.log('Targeted spring/staging changes:',JSON.stringify(revised.changes));
  }
 }
 await copyFile(best.mp4,a.out);
 const report={status:best.passed?(a.vision?'vision_approved':'technical_pass_vision_unverified'):'threshold_not_met',
  artisticQualityVerified:a.vision&&best.passed,visionProvider:a.vision?a.provider:null,visionModel:a.vision?providerConfig(a.provider,a.model).model:null,output:a.out,minimumRequired:a.minScore,
  bestPass:best.pass,bestTechnicalScore:best.technicalMinimum,bestVisionScore:best.visionMinimum,
  note:a.vision?'Vision scores are subjective model judgements, not proof of human preference.':
    'Vision API was not used. The numbers are only deterministic technical proxy scores; never claim a visual 8/10.',
  bestTuning:best.tuning,attempts};
 await writeFile(join(a.work,'review-report.json'),JSON.stringify(report,null,2));
 console.log(`\nBest render: ${a.out}`);
 console.log(`Review report: ${join(a.work,'review-report.json')}`);
 console.log(`RESULT: ${report.status}; ${a.vision?'min vision '+best.visionMinimum+'/10':'visual grade UNVERIFIED'}`);
 if(!best.passed)process.exitCode=2;
}
main().catch(err=>{console.error('\nQUALITY LOOP ERROR:',err.message);process.exitCode=1;});
