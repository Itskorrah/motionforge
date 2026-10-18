import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createStudioServer} from '../studio/server.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
async function harness(fn){const temp=await mkdtemp(join(tmpdir(),'mf-server-test-'));const app=createStudioServer({root,projectRoot:join(temp,'projects'),exportRoot:join(temp,'exports'),port:0});const listen=await app.listen();
 const url=`http://127.0.0.1:${listen.port}`;
 const call=async(path,options={})=>{
 const response=await fetch(url+path,{...options,headers:{...(options.method&&options.method!=='GET'?{'x-motionforge-session':app.session}:{}),...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
 return {status:response.status,data:await response.json()};
 };
 try{await fn({call,url,app,temp});}finally{await app.close();await rm(temp,{recursive:true,force:true});}}
test('studio runs on loopback, creates and edits validated projects',()=>harness(async({call})=>{
 let r=await call('/api/projects');assert.deepEqual(r.data.projects,[]);
 r=await call('/api/projects',{method:'POST',body:JSON.stringify({title:'Beautiful Motion',prompt:'A striking hook. Show the truth. Explain the point. Close with intention.',audience:'creators',goal:'learn something',format:'vertical'})});
 assert.equal(r.status,201);assert.equal(r.data.id,'beautiful-motion');assert.equal(r.data.project.creative.audience,'creators');
 let p=r.data.project;p.shots[0].motif='prism';
 r=await call('/api/project?id=beautiful-motion',{method:'PUT',body:JSON.stringify({project:p})});assert.equal(r.status,200);
 r=await call('/api/project?id=beautiful-motion');assert.equal(r.data.project.shots[0].motif,'prism');
 r=await call('/api/projects',{method:'POST',body:JSON.stringify({title:'Beautiful Motion',prompt:'Another idea'})});assert.equal(r.status,409);
}));
test('studio refuses unauthenticated writes, path traversal and arbitrary code',()=>harness(async({call,url})=>{
 const b=JSON.stringify({title:'No',prompt:'Not allowed.'});
 let r=await fetch(url+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:b});assert.equal(r.status,403);
 r=await fetch(url+'/api/projects',{method:'POST',headers:{'Content-Type':'application/json','x-motionforge-session':'wrong'},body:b});assert.equal(r.status,403);
 assert.equal((await call('/api/project?id=../../secret')).status,400);
 assert.equal((await call('/api/video?id=../../etc/passwd&variant=preview')).status,400);
 assert.equal((await call('/api/provider',{method:'POST',body:JSON.stringify({provider:'not-a-provider',action:'connect',key:'123456789abcd'})})).status,400);
}));
test('keys remain secret and can be cleared; cross-origin write denied',()=>harness(async({call})=>{
 const key='test-API-key-123456';
 let r=await call('/api/provider',{method:'POST',body:JSON.stringify({provider:'gemini',action:'connect',key})});
 assert.equal(r.data.providers.gemini.configured,true);assert.equal(JSON.stringify(r.data).includes(key),false);
 r=await call('/api/projects',{method:'POST',headers:{origin:'https://evil.example'},body:JSON.stringify({title:'bad',prompt:'bad'})});assert.equal(r.status,403);
 r=await call('/api/provider',{method:'POST',body:JSON.stringify({provider:'gemini',action:'disconnect'})});assert.equal(r.data.providers.gemini.configured,false);
}));
test('browser security policies permit trusted frame preview, not arbitrary UI scripts',()=>harness(async({url})=>{
 const ui=await fetch(url+'/');assert.equal(ui.status,200);
 assert.match(ui.headers.get('content-security-policy'),/script-src 'self'/);
 assert.doesNotMatch(ui.headers.get('content-security-policy'),/unsafe-inline/);
 const html=await ui.text();assert.match(html,/motionforge-session/);assert.doesNotMatch(html,/<script>window\.MOTIONFORGE_SESSION/);
 const stage=await fetch(url+'/stage');assert.equal(stage.status,200);
 assert.equal(stage.headers.get('x-frame-options'),'SAMEORIGIN');
 assert.match(stage.headers.get('content-security-policy'),/frame-ancestors 'self'/);
 assert.match(await stage.text(),/springState/);
}));
