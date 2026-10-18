import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createTimeline, SAMPLE_RATE } from '../timeline.mjs';
import { synthesizeWav } from '../sound.mjs';
const { springState } = createRequire(import.meta.url)('../physics.cjs');
const close=(actual,expected,tol=1e-6)=>assert.ok(Math.abs(actual-expected)<tol, `${actual} != ${expected}`);

for (const [name,damping] of [['underdamped',10],['critical',20],['overdamped',35]]) {
  test(`${name} closed-form spring honours displacement, velocity and differential equation`,()=>{
    const p={position:-4,velocity:2.3,target:5,mass:1,stiffness:100,damping};
    const start=springState({...p,elapsed:0});
    close(start.position,p.position); close(start.velocity,p.velocity);
    const dt=1e-4, t=.173;
    const before=springState({...p,elapsed:t-dt});
    const at=springState({...p,elapsed:t});
    const after=springState({...p,elapsed:t+dt});
    close((after.position-before.position)/(2*dt),at.velocity,3e-5);
    const acceleration=(after.velocity-before.velocity)/(2*dt);
    close(acceleration,(-damping*at.velocity-100*(at.position-p.target)),.0009);
    const settled=springState({...p,elapsed:10});
    close(settled.position,p.target,.002);
  });
}

test('beat, cut and audio sample grids are exactly aligned',()=>{
  const tl=createTimeline({fps:30,bpm:120,beatsPerCut:4,frames:240});
  assert.equal(tl.framesPerBeat,15);
  assert.equal(tl.samplesPerBeat,24000);
  assert.equal(tl.cutInterval,60);
  assert.deepEqual(tl.cuts.map(c=>c.frame),[0,60,120,180]);
  assert.deepEqual(tl.cuts.map(c=>c.sample),[0,96000,192000,288000]);
  for (const cut of tl.cuts) close(cut.time,cut.sample/SAMPLE_RATE,1e-12);
});

test('tempo with fractional video frames per beat is rejected instead of drifting',()=>{
  assert.throws(()=>createTimeline({fps:30,bpm:127,beatsPerCut:4,frames:240}), /cannot put every beat/);
});

test('PCM is actual deterministic synthesised audio, with exact duration', async()=>{
  const tmp=await mkdtemp(join(tmpdir(),'sound-test-'));
  try {
    const tl=createTimeline({fps:30,bpm:120,beatsPerCut:4,frames:120});
    const p=join(tmp,'score.wav');
    const one=await synthesizeWav(p,tl,7);
    const wav1=await readFile(p);
    assert.equal(wav1.toString('ascii',0,4),'RIFF');
    assert.equal(wav1.toString('ascii',8,12),'WAVE');
    assert.equal(wav1.readUInt32LE(24),48000);
    assert.equal(wav1.readUInt16LE(22),2);
    assert.equal(one.samples,192000);
    assert.equal(wav1.length,44+192000*4);
    assert.ok(one.rms>.01 && one.peak>.1);
    await synthesizeWav(p,tl,7);
    const wav2=await readFile(p);
    assert.equal(createHash('sha256').update(wav1).digest('hex'),createHash('sha256').update(wav2).digest('hex'));
  } finally { await rm(tmp,{recursive:true,force:true}); }
});
