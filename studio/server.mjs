/** Loopback-only studio API; untrusted requests never reach a shell or arbitrary path. */
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile, writeFile, readdir, access, mkdir, stat} from 'node:fs/promises';
import {join, resolve, dirname} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {draftFromBrief, loadProject, saveProject, validateProject, FORMATS, PALETTES, MOTIFS, LAYOUTS} from './project.mjs';
import {auditProject, CRAFT_DIMENSIONS} from './craft.mjs';
import {planWithAI} from './creative.mjs';
import {PROVIDERS} from './providers.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const JSON_HEADER={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const FILE_HEADER={'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; media-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const VALID_ID=/^[a-z0-9][a-z0-9-]{0,47}$/;
export function projectId(value){if(typeof value!=='string'||!VALID_ID.test(value)||value==='.'||value==='..')throw Object.assign(Error('Invalid project identifier'),{status:400});return value;}
export function titleSlug(title){return String(title||'untitled').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'untitled';}
export function cleanBrief(raw){const brief={};for(const field of ['title','prompt','audience','goal','hook','callToAction','tone','references']){
 if(raw[field]!==undefined){if(typeof raw[field]!=='string'||raw[field].length>3500)throw Error(`Invalid ${field}`);brief[field]=raw[field].trim();}
 }brief.format=raw.format||'vertical';brief.palette=raw.palette||'aurora';brief.shots=Number(raw.shots??4);
 if(!FORMATS[brief.format]||!PALETTES.includes(brief.palette)||!Number.isInteger(brief.shots)||brief.shots<1||brief.shots>12)throw Error('Invalid format, palette or scene count');
 if(!brief.title||!brief.prompt)throw Error('A title and creative brief are required');return brief;
}
function respond(res,status,data){res.writeHead(status,JSON_HEADER);res.end(JSON.stringify(data));}
function fail(res,e){const code=e.status&&e.status>=400&&e.status<500?e.status:400;respond(res,code,{error:e.message||'Invalid request'});}
async function body(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>96000)throw Object.assign(Error('Payload exceeds 96 KB'),{status:413});chunks.push(chunk);}let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('Request body must be valid JSON');}if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Request body must be an object');return data;}
function binaryReady(name){try{return spawnSync(name,['-version'],{stdio:'ignore',timeout:2500}).status===0;}catch{return false;}}
const PUBLIC_FILES=new Map([['/app.js','web/app.js'],['/style.css','web/style.css']]);
export function createStudioServer({root=ROOT,projectRoot=join(root,'projects'),exportRoot=join(root,'exports','studio'),port=4177,host='127.0.0.1'}={}){
 if(host!=='127.0.0.1'&&host!=='::1')throw Error('Studio only binds to loopback addresses');
 const session=randomBytes(24).toString('hex');const keys=new Map();let running=null;const jobs=new Map();
 const projectPath=id=>join(projectRoot,projectId(id),'project.json');
 const ensureProject=async id=>{const loaded=await loadProject(projectPath(id));return {id,project:loaded.project,audit:auditProject(loaded.project)};};
 const configured=()=>Object.fromEntries(Object.entries(PROVIDERS).map(([id,v])=>[id,{configured:keys.has(id)||Boolean(process.env[v.env]),model:v.model,source:keys.has(id)?'session':process.env[v.env]?'environment':'none'}]));
 const server=createServer(async(req,res)=>{
 try{
   const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
   // Browser-side cross-origin requests cannot make authenticated writes.
   if(['POST','PUT','DELETE'].includes(req.method)){
     if(req.headers['x-motionforge-session']!==session)throw Object.assign(Error('Invalid studio session'),{status:403});
     if(req.headers.origin && !['http://127.0.0.1','http://localhost','http://[::1]'].some(a=>req.headers.origin.startsWith(`${a}:`)))throw Object.assign(Error('Cross-origin writes are blocked'),{status:403});
   }
   if(req.method==='GET'&&url.pathname==='/'){
     const html=(await readFile(join(root,'web/index.html'),'utf8')).replace('__MOTIONFORGE_SESSION__',session);
     res.writeHead(200,{...FILE_HEADER,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html);
   }
   if(req.method==='GET'&&PUBLIC_FILES.has(url.pathname)){
     const kind=url.pathname.endsWith('.css')?'text/css':'text/javascript';const data=await readFile(join(root,PUBLIC_FILES.get(url.pathname)));
     res.writeHead(200,{...FILE_HEADER,'Content-Type':`${kind}; charset=utf-8`});return res.end(data);
   }
   if(req.method==='GET'&&url.pathname==='/stage'){
     let html=await readFile(join(root,'studio/scene.html'),'utf8');
     html=html.replace('<!-- ENGINE_SPRING_SOURCE -->',`<script>${await readFile(join(root,'physics.cjs'),'utf8')}</script>`);
     res.writeHead(200,{...FILE_HEADER,'X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'",'Content-Type':'text/html; charset=utf-8'});return res.end(html);
   }
   if(req.method==='GET'&&url.pathname==='/api/status')return respond(res,200,{app:'MotionForge Studio',version:'0.2.0',providers:configured(),engines:{ffmpeg:binaryReady('ffmpeg'),chrome:binaryReady('chromium')||binaryReady('google-chrome')},formats:FORMATS,palettes:PALETTES,motifs:MOTIFS,layouts:LAYOUTS,craftDimensions:CRAFT_DIMENSIONS});
   if(req.method==='GET'&&url.pathname==='/api/projects'){
     let dirs=[];try{dirs=await readdir(projectRoot,{withFileTypes:true});}catch(e){if(e.code!=='ENOENT')throw e;}
     const values=[];for(const dir of dirs){if(!dir.isDirectory()||!VALID_ID.test(dir.name))continue;
       try{const {project,audit}=await ensureProject(dir.name);values.push({id:dir.name,title:project.title,format:project.format,shots:project.shots.length,ready:audit.ready});}catch{ /* hide invalid project */ }
     }return respond(res,200,{projects:values});
   }
   if(req.method==='GET'&&url.pathname==='/api/project')return respond(res,200,await ensureProject(url.searchParams.get('id')));
   if(req.method==='POST'&&url.pathname==='/api/projects'){
     const b=await body(req),brief=cleanBrief(b);
     const id=titleSlug(brief.title);try{await access(projectPath(id));throw Object.assign(Error('A project with this title already exists'),{status:409});}catch(e){if(e.code!=='ENOENT')throw e;}
     let project=b.ai?await planWithAI(brief,{provider:b.provider||'openai',model:b.model||undefined,token:keys.get(b.provider||'openai')||undefined}):draftFromBrief(brief);
     project.creative={audience:brief.audience||'',goal:brief.goal||'',hook:brief.hook||'',callToAction:brief.callToAction||'',tone:brief.tone||'',references:brief.references||'',brief:brief.prompt};
     await saveProject(projectPath(id),project);return respond(res,201,{id,project,audit:auditProject(project)});
   }
   if(req.method==='POST'&&url.pathname==='/api/ai/refine'){
     const b=await body(req),id=projectId(b.id),{project}=await ensureProject(id);
     const provider=b.provider||'openai';if(!Object.hasOwn(PROVIDERS,provider))throw Error('Unsupported provider');
     const c=project.creative||{},prompt=String(c.brief||project.shots.map(s=>s.caption).join('. '));
     const args={title:project.title,prompt,format:project.format,palette:project.brand.palette,shots:project.shots.length,
       audience:c.audience,goal:c.goal,hook:c.hook,callToAction:c.callToAction,tone:c.tone,references:c.references};
     const proposed=await planWithAI(args,{provider,token:keys.get(provider)||undefined});
     // Return a proposal, never overwrite edited project files without explicit Save.
     return respond(res,200,{shots:proposed.shots});
   }
   if(req.method==='PUT'&&url.pathname==='/api/project'){
     const id=projectId(url.searchParams.get('id')),request=await body(req);
     await access(projectPath(id));validateProject(request.project);
     await saveProject(projectPath(id),request.project);return respond(res,200,{id,project:request.project,audit:auditProject(request.project)});
   }
   if(req.method==='POST'&&url.pathname==='/api/provider'){
     const b=await body(req);if(!Object.hasOwn(PROVIDERS,b.provider))throw Error('Unsupported provider');
     if(b.action==='disconnect')keys.delete(b.provider);
     else if(b.action==='connect'&&typeof b.key==='string'&&b.key.trim().length>=10&&b.key.length<=512)keys.set(b.provider,b.key.trim());
     else throw Error('Provide a valid key or choose disconnect');return respond(res,200,{providers:configured()});
   }
   if(req.method==='POST'&&url.pathname==='/api/render'){
     if(running)throw Object.assign(Error('A render is already running'),{status:409});
     const b=await body(req),id=projectId(b.id),{project}=await ensureProject(id);
     const mode=b.mode==='produce'?'produce':b.mode==='render'?'render':null;if(!mode)throw Error('Select render or produce');
     const provider=b.provider||'openai';if(!Object.hasOwn(PROVIDERS,provider))throw Error('Unsupported provider');
     if(b.vision&&!configured()[provider].configured)throw Error('Connect this provider before enabling visual criticism');
     const maxPasses=Math.max(1,Math.min(5,Number(b.maxPasses||2)));if(!Number.isInteger(maxPasses))throw Error('Invalid retry count');
     const prefix=`${id}-${b.preview===false?'master':'preview'}`,output=join(exportRoot,`${prefix}.mp4`);
     await mkdir(exportRoot,{recursive:true});const stamp=randomBytes(9).toString('hex');
     const args=[join(root,'studio.mjs'),mode,projectPath(id),'--out',output,'--max-passes',String(maxPasses),'--min-score','8',...(b.preview===false?[]:['--preview']),...(b.vision?['--vision','--critic-provider',provider]:[])];
     // Keys never appear in argv, logs or project files. Child inherits only this process' session keys.
     const env={...process.env};for(const [p,key]of keys)env[PROVIDERS[p].env]=key;
     const child=spawn(process.execPath,args,{cwd:root,env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
     const job={id:stamp,project:id,title:project.title,mode,status:'running',startedAt:Date.now(),lines:[],progress:0,output:prefix};running=job;jobs.set(stamp,job);
     function feed(chunk){const lines=String(chunk).split(/[\r\n]+/).map(x=>x.trim()).filter(Boolean);for(const line of lines){job.lines.push(line.slice(0,500));if(job.lines.length>120)job.lines.shift();const f=line.match(/(?:frame\s*[:=]\s*|frame-)(\d+)/i);if(f){try{job.progress=Math.min(99,Math.floor(Number(f[1])/validateProject(project).frames*100));}catch{}}}}
     child.stdout.on('data',feed);child.stderr.on('data',feed);
     child.on('error',e=>{job.status='failed';job.lines.push(e.message);job.finishedAt=Date.now();running=null;});
     child.on('close',code=>{if(job.status==='cancelled')return;job.status=code===0?'finished':'failed';job.exitCode=code;job.progress=code===0?100:job.progress;job.finishedAt=Date.now();running=null;});
     job.kill=()=>{if(job.status!=='running')return;job.status='cancelled';job.finishedAt=Date.now();running=null;
       try{if(process.platform!=='win32')process.kill(-child.pid,'SIGTERM');else child.kill('SIGTERM');}catch{child.kill('SIGTERM');}};
     return respond(res,202,{job:{...job,kill:undefined}});
   }
   if(req.method==='GET'&&url.pathname==='/api/jobs')return respond(res,200,{jobs:[...jobs.values()].slice(-12).reverse().map(({kill,...j})=>j)});
   if(req.method==='POST'&&url.pathname==='/api/cancel'){
     const b=await body(req),job=jobs.get(b.id);if(!job)throw Error('Job not found');job.kill();return respond(res,200,{status:job.status});
   }
   if(req.method==='GET'&&url.pathname==='/api/video'){
     const id=projectId(url.searchParams.get('id')),variant=url.searchParams.get('variant');if(!['preview','master'].includes(variant))throw Error('Invalid video variant');
     const target=join(exportRoot,`${id}-${variant}.mp4`),info=await stat(target);if(!info.isFile())throw Error('Video not found');
     const range=req.headers.range;const size=info.size;const match=range?.match(/^bytes=(\d*)-(\d*)$/);
     const from=match?(match[1]?Number(match[1]):0):0,to=match?(match[2]?Math.min(size-1,Number(match[2])):size-1):size-1;
     if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from>to||to>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
     const {createReadStream}=await import('node:fs');res.writeHead(match?206:200,{...FILE_HEADER,'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':to-from+1,...(match?{'Content-Range':`bytes ${from}-${to}/${size}`}:{})});
     return createReadStream(target,{start:from,end:to}).pipe(res);
   }
   respond(res,404,{error:'Route not found'});
 }catch(e){if(!res.headersSent)fail(res,e);else res.destroy();}
 });
 return {server,session,listen:()=>new Promise((yes,no)=>{server.once('error',no);server.listen(port,host,()=>yes(server.address()));}),close:()=>new Promise(resolve=>{if(running)running.kill();server.close(resolve);})};
}
