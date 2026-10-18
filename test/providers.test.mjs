import test from 'node:test';
import assert from 'node:assert/strict';
import {generateJSON,providerConfig,PROVIDERS} from '../studio/providers.mjs';
import {planWithAI} from '../studio/creative.mjs';
import {critiqueScene} from '../critic.mjs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const expected={score:8,issues:[],critique:'Readable, dynamic and considered'};
const image=Buffer.from([137,80,78,71]).toString('base64');
function fakeResponse(provider,content){
 const text=JSON.stringify(content);
 return provider==='openai'?{output:[{content:[{type:'output_text',text}]}]}:
 provider==='claude'?{content:[{type:'text',text}]}:
 provider==='gemini'?{candidates:[{content:{parts:[{text}]}}]}:
 {choices:[{message:{content:text}}]};
}
for(const name of Object.keys(PROVIDERS)){
 test(`${name} supports JSON planning and PNG storyboard review with correct auth and payload`,async()=>{
  const requests=[];
  const fetchImpl=async(url,opts)=>{
   requests.push({url,headers:opts.headers,payload:JSON.parse(opts.body)});
   return {ok:true,json:async()=>fakeResponse(name,expected)};
  };
  const result=await generateJSON({provider:name,token:'FAKE_KEY',fetchImpl,
   system:'Output valid JSON',user:'Storyboard review',imageBase64:image});
  assert.deepEqual(result,expected);
  assert.equal(requests.length,1);
  const [{url,headers,payload}]=requests;
  assert.ok(url.startsWith('https://'));
  assert.ok(!url.includes('FAKE_KEY'));
  if(name==='claude'){
   assert.equal(headers['x-api-key'],'FAKE_KEY');
   assert.equal(payload.messages[0].content[1].type,'image');
   assert.equal(payload.messages[0].content[1].source.data,image);
  }else if(name==='gemini'){
   assert.equal(headers['x-goog-api-key'],'FAKE_KEY');
   assert.equal(payload.contents[0].parts[1].inlineData.data,image);
  }else if(name==='grok'){
   assert.equal(headers.Authorization,'Bearer FAKE_KEY');
   assert.match(payload.messages[1].content[1].image_url.url,/^data:image\/png;base64,/);
  }else{
   assert.equal(headers.Authorization,'Bearer FAKE_KEY');
   assert.match(payload.input[0].content[1].image_url,/^data:image\/png;base64,/);
   assert.equal(payload.store,false);
  }
 });
}
test('missing credentials fail before network; provider choice is explicit',async()=>{
 assert.throws(()=>providerConfig('untrusted-provider'),/Unknown AI provider/);
 await assert.rejects(generateJSON({provider:'claude',token:'',system:'s',user:'u',fetchImpl:()=>{throw Error('should not call');}}),/ANTHROPIC_API_KEY/);
 await assert.rejects(generateJSON({provider:'grok',token:'secret',system:'s',user:'u',fetchImpl:async()=>({ok:false,status:429})}),/quota\/rate limit/);
 await assert.rejects(generateJSON({provider:'gemini',token:'secret',system:'s',user:'u',fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'not real JSON'}]}}]})})}),/invalid JSON/);
});
test('selected AI planner output must conform to project schema',async()=>{
 const args={title:'My video',prompt:'Explore the creative process.',shots:2,format:'vertical'};
 const fetchImpl=async()=>({ok:true,json:async()=>fakeResponse('claude',{shots:[
  {eyebrow:'01',headline:'A strong hook',caption:'A memorable statement',motif:'orbit'},
  {eyebrow:'02',headline:'The final idea',caption:'A useful finish',motif:'type'}]})});
 const plan=await planWithAI(args,{provider:'claude',token:'fake',fetchImpl});
 assert.equal(plan.shots.length,2);
 assert.equal(plan.shots[0].motif,'orbit');
 const unsafe=async()=>({ok:true,json:async()=>fakeResponse('claude',{shots:[
  {eyebrow:'01',headline:'Invalid',caption:'No',motif:'<script>'},
  {eyebrow:'02',headline:'Good',caption:'Good',motif:'type'}]})});
 await assert.rejects(planWithAI(args,{provider:'claude',token:'fake',fetchImpl:unsafe}),/motif/);
});
test('Claude/Gemini/Grok criticism is validated and retains provider provenance',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mf-providers-'));
 try{
  const path=join(dir,'board.png');await writeFile(path,Buffer.from(image,'base64'));
  for(const provider of ['claude','gemini','grok']){
   const fetchImpl=async()=>({ok:true,json:async()=>fakeResponse(provider,expected)});
   const critique=await critiqueScene({image:path,scene:0,metrics:{technicalScore:9},provider,token:'fake',fetchImpl});
   assert.equal(critique.score,8);assert.equal(critique.provider,provider);
  }
  const bad=async()=>({ok:true,json:async()=>fakeResponse('claude',{score:11,issues:['nonexistent'],critique:'Fine'})});
  await assert.rejects(critiqueScene({image:path,scene:0,metrics:{},provider:'claude',token:'fake',fetchImpl:bad}),/Invalid vision critique/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
