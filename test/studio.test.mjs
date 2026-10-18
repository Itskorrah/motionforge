import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draftFromBrief, validateProject, loadProject, saveProject,FORMATS } from '../studio/project.mjs';
import { fileURLToPath } from 'node:url';
const CLI=fileURLToPath(new URL('../studio.mjs',import.meta.url));
test('three format presets and deterministic local creative draft',()=>{
 for(const format of Object.keys(FORMATS)){
  const args={title:'A better process',prompt:'Start with the hook. Demonstrate how it works. Show the benefit. End on a call to action.',format,shots:4};
  const p=draftFromBrief(args);
  assert.deepEqual(p,draftFromBrief(args));
  const plan=validateProject(p);assert.equal(plan.timeline.cuts.length,4);assert.equal(plan.frames,240);
 }
});
test('project spec rejects missing or unsafe scene data and timing drift',()=>{
 const p=draftFromBrief({title:'Title',prompt:'A useful hook.',shots:2});
 assert.throws(()=>validateProject({...p,bpm:117}),/exact/);
 assert.throws(()=>validateProject({...p,shots:[{...p.shots[0],motif:'<script>alert(1)</script>'}]}),/motif/);
 assert.throws(()=>validateProject({...p,shots:[]}),/shots/);
 assert.throws(()=>validateProject({...p,brand:{name:'X',palette:'not-real'}}),/palette/);
});
test('project round trip and CLI plans expected cuts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'motionforge-unit-'));
 try {
  const path=join(dir,'project.json');const p=draftFromBrief({title:'Brand film',prompt:'Open strong. Stay curious.',shots:2});
  await saveProject(path,p);const loaded=await loadProject(path);assert.equal(loaded.seconds,4);
  assert.deepEqual(JSON.parse(await readFile(path,'utf8')),p);
  const cp=spawnSync(process.execPath,[CLI,'plan',path],{encoding:'utf8'});
  assert.equal(cp.status,0,cp.stderr);
  const result=JSON.parse(cp.stdout);assert.deepEqual(result.cuts.map(c=>c.frame),[0,60]);
 } finally {await rm(dir,{recursive:true,force:true});}
});
test('init refuses to overwrite existing creative work',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'motionforge-init-'));
 try{const path=join(dir,'project.json'),argv=[CLI,'init','--title','A title','--prompt','One. Two.','--out',path];
  const first=spawnSync(process.execPath,argv,{encoding:'utf8'});
  const second=spawnSync(process.execPath,argv,{encoding:'utf8'});
  assert.equal(first.status,0,first.stderr);assert.notEqual(second.status,0);assert.match(second.stderr,/overwrite/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
