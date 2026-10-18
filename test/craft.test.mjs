import test from 'node:test';
import assert from 'node:assert/strict';
import {draftFromBrief,validateProject} from '../studio/project.mjs';
import {auditProject} from '../studio/craft.mjs';
const draft=()=>draftFromBrief({title:'An idea',prompt:'A new beginning. Another fresh point. A concrete example. Now the final message.',shots:4});
test('craft review is editorial feedback, never a synthetic vision score',()=>{
  const p=draft(),a=auditProject(p);
  assert.equal(a.warningCount,0);
  assert.equal(a.method.includes('not an artistic score'),true);
  assert.equal(a.totalFrames,240);
  assert.ok(a.issues.some(i=>i.id==='story'&&i.level==='advice'));
  assert.equal('score' in a,false);
});
test('preflight catches unreadable copy and visual repetition with actionable feedback',()=>{
  const p=draft();p.shots.forEach(s=>{s.headline='WORDS THAT GO ON AND ON UNTIL NO ONE CAN READ THEM';s.motif='orbit';});
  const result=auditProject(p);assert.equal(result.ready,false);
  assert.ok(result.issues.some(i=>i.id==='type'&&i.level==='warning'));
  assert.ok(result.issues.some(i=>i.id==='composition'&&i.level==='warning'));
  assert.ok(result.issues.every(i=>i.action.length>10));
});
test('new scene motifs preserve strict project validation',()=>{
  const p=draft();p.shots[0].motif='prism';p.shots[1].motif='constellation';
  validateProject(p);p.creative.goal='A specific viewer outcome';validateProject(p);
  p.creative.hook='x'.repeat(1201);assert.throws(()=>validateProject(p),/creative.hook/);
});
