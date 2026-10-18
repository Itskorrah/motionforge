/** Review every decoded video frame (not merely chosen thumbnails).
 * This is a technical fault detector, NOT a substitute for a vision critic.
 * Requires FFmpeg, but no npm packages or network access.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

function run(binary, argv, stdoutBinary = false) {
  return new Promise((ok, no) => {
    const p = spawn(binary, argv, {stdio: ['ignore','pipe','pipe']});
    const chunks = []; let err = '';
    p.stdout.on('data', c => chunks.push(c));
    p.stderr.on('data', c => { err = (err + String(c)).slice(-7000); });
    p.on('error', no);
    p.on('close', code => code === 0 ? ok(stdoutBinary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8'))
      : no(new Error(`${binary} failed (${code}): ${err}`)));
  });
}

const WIDTH = 160, HEIGHT = 90;
export function frameFeatures(rgb, previous) {
  if (rgb.length !== WIDTH*HEIGHT*3) throw Error('Unexpected RGB frame size');
  let sum=0, sq=0, colourful=0, dark=0, edges=0, changed=0, delta=0, brightCore=0, corePixels=0;
  const y = new Uint8Array(WIDTH*HEIGHT);
  for(let i=0; i<y.length; i++) {
    const j=i*3, r=rgb[j],g=rgb[j+1],b=rgb[j+2];
    const v=.2126*r+.7152*g+.0722*b;
    y[i] = v; sum+=v; sq+=v*v;
    const xx=i%WIDTH, yy=Math.floor(i/WIDTH);
    if(xx>=.15*WIDTH && xx<=.85*WIDTH && yy>=.15*HEIGHT && yy<=.85*HEIGHT){
      corePixels++; if(v>140)brightCore++;
    }
    if (v<14) dark++;
    if (Math.max(r,g,b)-Math.min(r,g,b)>27) colourful++;
    if(previous){
      const d=(Math.abs(previous[j]-r)+Math.abs(previous[j+1]-g)+Math.abs(previous[j+2]-b))/3;
      delta+=d; if(d>6) changed++;
    }
  }
  for(let yy=1;yy<HEIGHT;yy++) for(let xx=1;xx<WIDTH;xx++) {
    const i=yy*WIDTH+xx;
    if(Math.abs(y[i]-y[i-1])>20 || Math.abs(y[i]-y[i-WIDTH])>20) edges++;
  }
  const count=y.length, mean=sum/count;
  return {mean:+mean.toFixed(2),contrast:+Math.sqrt(Math.max(0,sq/count-mean*mean)).toFixed(2),
    colour:+(colourful/count).toFixed(4), darkness:+(dark/count).toFixed(4),
    brightCore:+(brightCore/corePixels).toFixed(4),
    detail:+(edges/((WIDTH-1)*(HEIGHT-1))).toFixed(4),
    motion:previous ? +(delta/count).toFixed(3) : null,
    changed:previous ? +(changed/count).toFixed(4) : null};
}

export function inspectData(data,{fps,frames,cutInterval}) {
  const bytes=WIDTH*HEIGHT*3;
  if(data.length !== bytes*frames) throw Error(`Decoded ${data.length/bytes} frames but expected ${frames}`);
  const features=[];
  let prev=null;
  for(let f=0;f<frames;f++){
    const b=data.subarray(f*bytes,(f+1)*bytes);
    const feat=frameFeatures(b,prev);
    features.push(feat); prev=b;
  }
  const scenes=[];
  for(let from=0, scene=0;from<frames;from+=cutInterval,scene++) {
    const to=Math.min(from+cutInterval,frames), rows=features.slice(from,to);
    const blanks=[], frozen=[];
    let streak=0, longest=0, streakStart=-1;
    for(let i=0;i<rows.length;i++) {
      const f=from+i, m=rows[i];
      if(m.mean<8 || (m.contrast<10 && m.detail<.003)) blanks.push(f);
      // Scene cuts are never compared with the previous scene.
      const freeze=i>0 && m.changed<.0015 && m.motion<.35;
      if(freeze){
        if(streak===0)streakStart=f-1;
        streak++;
        if(streak>longest)longest=streak;
      } else { if(streak>=Math.ceil(.35*fps)) frozen.push({from:streakStart,to:f-1}); streak=0; }
    }
    if(streak>=Math.ceil(.35*fps)) frozen.push({from:streakStart,to:to-1});
    const avg=(field)=>+(rows.reduce((a,b)=>a+(b[field]||0),0)/rows.length).toFixed(3);
    const issues=[];
    if(blanks.length)issues.push('blank_frames');
    if(frozen.length)issues.push('frozen_run');
    if(avg('contrast')<18 || avg('detail')<.006) issues.push('low_visual_detail');
    // A scene might be colourful yet open nearly empty because the title and
    // hero object start outside the frame. Compare first-frame content presence
    // against that SAME scene's established composition, not an arbitrary global
    // luminance threshold. This catches the four dead cut openings in the demo.
    const established=rows.slice(Math.floor(rows.length*.30),Math.max(1,Math.floor(rows.length*.85)));
    const typicalPresence=established.length?established.reduce((n,r)=>n+r.brightCore,0)/established.length:0;
    const openingPresence=rows[0].brightCore;
    if(typicalPresence>.035 && openingPresence<typicalPresence*.32)issues.push('weak_opening');
    // These are explicitly technical/proxy scores, not visual-art scores.
    const technicalScore=Math.max(1,10-(blanks.length?4:0)-(frozen.length?3:0)-
      (issues.includes('low_visual_detail')?2:0)-(issues.includes('weak_opening')?3:0));
    scenes.push({scene,firstFrame:from,lastFrame:to-1,technicalScore,issues,
      blankFrames:blanks, frozenRuns:frozen, longestStaticFrames:longest,
      averageMotion:avg('motion'),averageContrast:avg('contrast'),averageDetail:avg('detail'),
      minContrast:Math.min(...rows.map(x=>x.contrast)),
      openingPresence:+openingPresence.toFixed(4), typicalPresence:+typicalPresence.toFixed(4)});
  }
  return {frames,fps,cutInterval,scenes,frameMetrics:features};
}

export async function analyseFrames({ffmpeg='ffmpeg',framesDir,fps,frames,cutInterval}) {
  const raw=await run(ffmpeg,['-hide_banner','-loglevel','error','-framerate',String(fps),
    '-start_number','0','-i',join(framesDir,'frame-%06d.png'),'-vf',`scale=${WIDTH}:${HEIGHT}:flags=area`,
    '-pix_fmt','rgb24','-f','rawvideo','pipe:1'],true);
  return inspectData(raw,{fps,frames,cutInterval});
}

export function selectSamples(first,last) {
  const len=last-first+1;
  const ratios=[0,.18,.50,.88];
  return ratios.map(r=>Math.min(last,first+Math.round(r*(len-1))));
}

export async function contactSheet({ffmpeg='ffmpeg',framesDir,output,frames,aspect='landscape'}) {
  const list=resolve(output.replace(/\.png$/i,'.txt'));
  const esc=p=>resolve(p).replaceAll("'","'\\''");
  await writeFile(list,frames.map(f=>`file '${esc(join(framesDir,`frame-${String(f).padStart(6,'0')}.png`))}'`).join('\n')+'\n');
  await mkdir(resolve(output,'..'),{recursive:true}).catch(()=>{});
  await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,
    '-vf',`scale=${aspect==='vertical'?'270:480':aspect==='square'?'360:360':'480:270'}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${aspect==='vertical'?'270:480':aspect==='square'?'360:360':'480:270'}:(ow-iw)/2:(oh-ih)/2:color=0x10151c,tile=2x2:nb_frames=4:margin=8:padding=8:color=0x10151c`,
    '-frames:v','1',output]);
  return output;
}
