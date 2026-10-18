/** 100% code-generated stereo PCM score: kick/snare/hat, bass, and synth plucks.
    All note onsets sit on sample-exact beat subdivisions. Zero audio files used. */
import { writeFile } from 'node:fs/promises';
import { SAMPLE_RATE } from './timeline.mjs';
const TAU = 2*Math.PI;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
function noise(n, salt=0) {
  let x = (n ^ Math.imul(salt+1, 0x9e3779b9)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return x / 2147483648 - 1;
}
const noteHz = midi => 440*Math.pow(2, (midi-69)/12);

export async function synthesizeWav(path, timeline, seed = 7) {
  const { fps, frames, samplesPerBeat, framesPerBeat, beatsPerCut } = timeline;
  if (SAMPLE_RATE % fps !== 0) {
    throw new Error(`FPS ${fps} must divide ${SAMPLE_RATE} exactly to align PCM sample and video frame edges.`);
  }
  const samples = frames * SAMPLE_RATE / fps;
  const left = new Float32Array(samples), right = new Float32Array(samples);

  // Each instrument is generated directly into the PCM buffers; no DAW or files.
  function voice(start, lengthSeconds, gain, pan, signal) {
    const startSample = Math.round(start);
    const length = Math.min(Math.ceil(lengthSeconds*SAMPLE_RATE), samples - startSample);
    if (length < 1) return;
    const l = Math.sqrt((1-pan)*0.5)*gain;
    const r = Math.sqrt((1+pan)*0.5)*gain;
    for (let n=0; n<length; n++) {
      const v = signal(n/SAMPLE_RATE, n, length/SAMPLE_RATE);
      left[startSample+n] += v*l;
      right[startSample+n] += v*r;
    }
  }

  const countBeats = Math.ceil(frames / framesPerBeat);
  for (let beat=0; beat<countBeats; beat++) {
    const start = beat*samplesPerBeat;
    const inBar = beat % 4;
    const shot = Math.floor(beat/beatsPerCut);
    // Strong kick on beat 1, softer kick on beat 3, syncopated ghost at 3&.
    if (inBar===0 || inBar===2) {
      voice(start, 0.32, inBar===0?0.94:0.78, 0, (t,n) => {
        const phase = TAU*(48*t + 112*(1-Math.exp(-t*35))/35);
        return Math.sin(phase)*Math.exp(-t*17) + 0.11*noise(n,seed)*Math.exp(-t*130);
      });
    }
    if (inBar===2) voice(start+samplesPerBeat/2, 0.23, 0.28, 0, (t,n) =>
      Math.sin(TAU*(56*t + 55*(1-Math.exp(-t*28))/28))*Math.exp(-t*23));
    // Snare on beats 2/4: clipped, filtered noise + a pitched body.
    if (inBar===1 || inBar===3) {
      voice(start, 0.19, 0.50, 0.06, (t,n) => {
        const high = noise(n, seed+71) - 0.76*noise(n-1, seed+71);
        return (0.50*high + 0.43*Math.sin(TAU*176*t))*Math.exp(-t*23);
      });
    }
    // Tight eighth-note hats, alternate left/right, open hat at end of bar.
    for (let sub=0; sub<2; sub++) {
      const index=beat*2+sub;
      voice(start+sub*samplesPerBeat/2, (inBar===3 && sub===1)?0.21:0.066,
        sub?0.17:0.23, sub?0.37:-0.37, (t,n) => {
          const bright = noise(n,seed+index*89) - noise(n-1,seed+index*89);
          return bright*Math.exp(-t*((inBar===3&&sub===1)?18:72));
        });
    }
    // Bass progression (A, F, C, G). Root note each beat; no presets/samples.
    const progression = [45,41,48,43];
    const root = progression[shot % progression.length];
    const bassMidi = root + ((inBar===3)?7:0);
    const freq = noteHz(bassMidi);
    voice(start, 0.40, 0.33, 0, t => {
      const env = (1-Math.exp(-t*150))*Math.exp(-t*6);
      const p = freq*t;
      return env*(0.78*Math.sin(TAU*p)+0.20*Math.sin(TAU*p*2)+0.09*Math.sin(TAU*p*3));
    });
    // Bar-specific glossy pluck; notes are locked to beat ticks.
    const melody = [
      [69,72,76,79], [65,69,72,77], [72,76,79,83], [67,71,74,79]
    ][shot%4];
    const tone = noteHz(melody[inBar]);
    voice(start, 0.46, 0.21, [-0.26,0.23,-0.1,0.3][inBar], t => {
      const env=(1-Math.exp(-t*350))*Math.exp(-t*10);
      return env*(Math.sin(TAU*tone*t)+0.36*Math.sin(TAU*2*tone*t)+0.11*Math.sin(TAU*3*tone*t));
    });
    // Extra major transient on every edit point to accentuate the cut.
    if (beat%beatsPerCut===0) {
      voice(start, 0.52, 0.18, 0, (t,n) => {
        const shimmer = 0.6*Math.sin(TAU*(900*t + 400*t*t)) + 0.4*noise(n,seed+42);
        return shimmer*Math.exp(-t*14);
      });
    }
  }

  // Soft saturator, end fade to zero, signed little-endian stereo PCM WAV.
  const raw = Buffer.alloc(44+samples*4);
  raw.write('RIFF',0); raw.writeUInt32LE(raw.length-8,4); raw.write('WAVEfmt ',8);
  raw.writeUInt32LE(16,16); raw.writeUInt16LE(1,20); raw.writeUInt16LE(2,22);
  raw.writeUInt32LE(SAMPLE_RATE,24); raw.writeUInt32LE(SAMPLE_RATE*4,28);
  raw.writeUInt16LE(4,32); raw.writeUInt16LE(16,34);
  raw.write('data',36); raw.writeUInt32LE(samples*4,40);
  let peak=0, sumSq=0;
  for (let i=0; i<samples; i++) {
    const fade = Math.min(1, (samples-i)/(SAMPLE_RATE*0.09));
    const l=clamp(Math.tanh(left[i]*0.95)*fade,-1,1);
    const r=clamp(Math.tanh(right[i]*0.95)*fade,-1,1);
    peak=Math.max(peak,Math.abs(l),Math.abs(r)); sumSq+=l*l+r*r;
    raw.writeInt16LE(Math.round(l*32767),44+i*4);
    raw.writeInt16LE(Math.round(r*32767),46+i*4);
  }
  await writeFile(path,raw);
  return { samples, seconds: samples/SAMPLE_RATE, peak, rms:Math.sqrt(sumSq/(2*samples)) };
}
