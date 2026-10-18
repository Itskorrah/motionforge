/** Validated, portable production specification. Never execute project data as code. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createTimeline } from '../timeline.mjs';
export const FORMATS = Object.freeze({
  vertical: {width:1080,height:1920,label:'9:16 · Reels / TikTok / Shorts'},
  landscape: {width:1920,height:1080,label:'16:9 · YouTube / web'},
  square: {width:1080,height:1080,label:'1:1 · social feed'},
});
export const PALETTES = ['aurora','ember','violet','mono'];
export const MOTIFS = ['orbit','cards','wave','type','prism','constellation'];
export const LAYOUTS = ['split','type-led','art-led'];
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const str = (x,name,max=180) => {if(typeof x !== 'string' || !x.trim() || x.length>max)throw Error(`${name} must be nonempty text, at most ${max} characters`);return x;};
export function validateProject(p){
  if(!object(p))throw Error('Project must be a JSON object');
  if(p.version!==1)throw Error('Project version must be 1');
  str(p.title,'title',100);
  if(!Object.hasOwn(FORMATS,p.format))throw Error(`format must be ${Object.keys(FORMATS).join(', ')}`);
  for(const field of ['width','height','fps','seed','beatsPerCut'])if(!Number.isSafeInteger(p[field]))throw Error(`${field} must be an integer`);
  if(p.width<128||p.width>3840||p.width%2||p.height<128||p.height>3840||p.height%2)throw Error('Dimensions must be even, between 128 and 3840');
  if(p.fps<1||p.fps>120||p.seed<0||p.beatsPerCut<1||p.beatsPerCut>16)throw Error('Invalid FPS, seed or beatsPerCut');
  if(!Number.isFinite(p.bpm)||p.bpm<40||p.bpm>240)throw Error('BPM must be 40–240');
  if(!object(p.brand))throw Error('brand is required');
  str(p.brand.name,'brand.name',38);
  if(!PALETTES.includes(p.brand.palette))throw Error('Unknown palette');
  if(!Array.isArray(p.shots)||p.shots.length<1||p.shots.length>12)throw Error('Expected 1–12 shots');
  for(const [i,s] of p.shots.entries()){
    if(!object(s))throw Error(`shots[${i}] must be an object`);
    str(s.headline,`shots[${i}].headline`,95);
    str(s.caption,`shots[${i}].caption`,180);
    str(s.eyebrow,`shots[${i}].eyebrow`,65);
    if(!MOTIFS.includes(s.motif))throw Error(`shots[${i}].motif must be one of ${MOTIFS.join(', ')}`);
    if(s.layout!==undefined&&!LAYOUTS.includes(s.layout))throw Error(`shots[${i}].layout must be one of ${LAYOUTS.join(', ')}`);
  }
  if(p.creative!==undefined){
    if(!object(p.creative))throw Error('creative must be an object');
    for(const field of ['audience','goal','hook','callToAction','tone','references','brief'])
      if(p.creative[field]!==undefined && (typeof p.creative[field]!=='string'||p.creative[field].length>1200))throw Error(`creative.${field} must be text <=1200 characters`);
  }
  const framesPerBeat=p.fps*60/p.bpm;
  if(!Number.isInteger(framesPerBeat)||!Number.isInteger(48000*60/p.bpm))throw Error('Choose BPM and FPS with exact frame/sample beat boundaries');
  if(48000%p.fps!==0)throw Error('FPS must divide 48000 for sample/frame alignment');
  const frames=p.shots.length*framesPerBeat*p.beatsPerCut;
  const timeline=createTimeline({...p,frames});
  return {project:p,frames,seconds:frames/p.fps,timeline};
}
export async function loadProject(path){const p=JSON.parse(await readFile(resolve(path),'utf8'));return validateProject(p);}
export async function saveProject(path,project){validateProject(project);await mkdir(dirname(resolve(path)),{recursive:true});await writeFile(resolve(path),JSON.stringify(project,null,2)+'\n');return resolve(path);}
const caps = s => s.trim().replace(/\s+/g,' ').toUpperCase();
export function draftFromBrief({title,prompt,format='vertical',palette='aurora',shots=4}){
  str(title,'title',100);str(prompt,'prompt',3000);
  if(!Object.hasOwn(FORMATS,format))throw Error('Invalid format');
  if(!PALETTES.includes(palette))throw Error('Invalid palette');
  if(!Number.isSafeInteger(shots)||shots<1||shots>12)throw Error('Shots must be 1–12');
  const statements=prompt.split(/[.!?\n]+/).map(x=>x.trim()).filter(Boolean);
  const fallbacks=['THE IDEA','WHY IT MATTERS','HOW IT WORKS','THE TAKEAWAY'];
  const sequence=Array.from({length:shots},(_,i)=>{
    const content=statements[i]||statements[i%Math.max(1,statements.length)]||title;
    const words=content.split(/\s+/);
    const headline=caps(words.slice(0,6).join(' ')).slice(0,75) || fallbacks[i%4];
    return {eyebrow:`${String(i+1).padStart(2,'0')} / ${caps(title).slice(0,35)}`,
      headline,caption:content.slice(0,180),motif:MOTIFS[i%MOTIFS.length],layout:LAYOUTS[i%LAYOUTS.length]};
  });
  return {version:1,title,format,...FORMATS[format],fps:30,bpm:120,beatsPerCut:4,seed:7,
    creative:{audience:'',goal:'',hook:'',callToAction:'',tone:'',references:'',brief:prompt},
    brand:{name:'MOTIONFORGE',palette},shots:sequence};
}
