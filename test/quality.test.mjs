import test from 'node:test';
import assert from 'node:assert/strict';
import { frameFeatures, inspectData, selectSamples } from '../quality.mjs';
import { improveTuning } from '../critic.mjs';
const W=160,H=90,B=W*H*3;
function makeFrame(type){
 const a=Buffer.alloc(B);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*3;
  const bright=type==='composed' && x>24&&x<136&&y>17&&y<73 && ((x+y)%4!==0);
  a[i]=bright?215:18;a[i+1]=bright?230:22;a[i+2]=bright?240:26;
 }
 return a;
}
test('blank or monochrome frames have almost no salience or edges',()=>{
 const black=frameFeatures(Buffer.alloc(B),null);
 assert.equal(black.mean,0);assert.equal(black.detail,0);assert.equal(black.brightCore,0);
});
test('early offscreen art is caught as a weak opening even if technically nonblack',()=>{
 const sequence=[makeFrame('empty'),...Array.from({length:29},()=>makeFrame('composed'))];
 const review=inspectData(Buffer.concat(sequence),{fps:30,frames:30,cutInterval:30});
 assert.ok(review.scenes[0].issues.includes('weak_opening'));
 assert.ok(review.scenes[0].technicalScore<8);
});
test('frozen and blank video frames are independently flagged',()=>{
 const zeros=Buffer.alloc(B*30);
 const report=inspectData(zeros,{fps:30,frames:30,cutInterval:30});
 assert.ok(report.scenes[0].issues.includes('blank_frames'));
 assert.ok(report.scenes[0].issues.includes('frozen_run'));
});
test('safe scene-level physical re-tuning changes only failing scenes',()=>{
 const {tuning,changes}=improveTuning({shots:{}},[
  {scene:0,passed:false,technical:{issues:['weak_opening','frozen_run']},visual:null},
  {scene:1,passed:true,technical:{issues:[]},visual:{score:9,issues:[]}}
 ]);
 assert.equal(changes.length,1);
 assert.equal(tuning.shots[0].preRoll,.22);
 assert.equal(tuning.shots[0].pulseGain,1.35);
 assert.equal(tuning.shots[1],undefined);
});
test('every contact-sheet scene samples its opening and holds in order',()=>{
 assert.deepEqual(selectSamples(60,119),[60,71,90,112]);
});

test('vision critic sends actual storyboard image and verifies the structured score (mocked HTTP)',async()=>{
 const {critiqueScene}=await import('../critic.mjs');
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
 const {tmpdir}=await import('node:os');
 const {join}=await import('node:path');
 const d=await mkdtemp(join(tmpdir(),'vision-mock-'));
 const png=join(d,'sheet.png');await writeFile(png,Buffer.from([137,80,78,71]));
 const originalFetch=globalThis.fetch;let sent;
 globalThis.fetch=async(url,init)=>{
  sent=JSON.parse(init.body);
  return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({score:7,issues:['weak_opening'],critique:'Opening is offscreen'})}]}]})};
 };
 try{
  const out=await critiqueScene({image:png,scene:0,metrics:{technicalScore:7},token:'mock-key'});
  assert.equal(out.score,7); assert.equal(out.issues[0],'weak_opening');
  assert.equal(sent.input[0].content[1].type,'input_image');
  assert.match(sent.input[0].content[1].image_url,/^data:image\/png;base64,/);
  assert.equal(sent.text.format.strict,true);
 } finally {globalThis.fetch=originalFetch;await rm(d,{recursive:true,force:true});}
});
