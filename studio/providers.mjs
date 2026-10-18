/** Model-provider boundary. No SDK, no shell execution, no implicit cross-provider fallback.
 * All model output remains untrusted: callers must validate the returned JSON.
 */
export const PROVIDERS = Object.freeze({
  openai:{env:'OPENAI_API_KEY',model:'gpt-4.1-mini'},
  claude:{env:'ANTHROPIC_API_KEY',model:'claude-sonnet-4-5'},
  gemini:{env:'GEMINI_API_KEY',model:'gemini-2.5-flash'},
  grok:{env:'XAI_API_KEY',model:'grok-4'}
});
const ENDPOINTS={
  openai:'https://api.openai.com/v1/responses',
  claude:'https://api.anthropic.com/v1/messages',
  gemini:'https://generativelanguage.googleapis.com/v1beta/models/',
  grok:'https://api.x.ai/v1/chat/completions'
};
export function providerConfig(provider='openai',model,env=process.env){
  const key=String(provider).toLowerCase();
  if(!Object.hasOwn(PROVIDERS,key))throw Error(`Unknown AI provider "${provider}". Choose: ${Object.keys(PROVIDERS).join(', ')}`);
  const spec=PROVIDERS[key];
  return {provider:key,model:model||spec.model,apiKey:env[spec.env],envName:spec.env};
}
function extractText(provider,body){
  if(provider==='claude')return (body.content||[]).filter(v=>v.type==='text').map(v=>v.text).join('');
  if(provider==='gemini')return (body.candidates?.[0]?.content?.parts||[]).map(v=>v.text||'').join('');
  if(provider==='grok')return body.choices?.[0]?.message?.content||'';
  return (body.output||[]).flatMap(v=>v.content||[]).filter(v=>v.type==='output_text').map(v=>v.text).join('');
}
export function parseModelJSON(text){
  if(typeof text!=='string'||!text.trim())throw Error('AI provider returned no text');
  const clean=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(clean);}catch{throw Error('AI provider returned invalid JSON; rejecting output');}
}
/**
 * @param {object} args - { provider, model, system, user, imageBase64?, schema?, token?, fetchImpl? }
 * Base64 images are never sent except to the explicitly selected provider.
 */
export async function generateJSON({provider='openai',model,system,user,imageBase64,schema,
  token,fetchImpl=globalThis.fetch,timeoutMs=90000}){
  const cfg=providerConfig(provider,model);
  const apiKey=token??cfg.apiKey;
  if(!apiKey)throw Error(`${cfg.envName} is required for ${cfg.provider}. Configure a separate provider API key or use local mode.`);
  if(typeof system!=='string'||typeof user!=='string')throw Error('system and user prompts are required');
  if(imageBase64 && !/^[A-Za-z0-9+/\r\n]+=*$/.test(imageBase64))throw Error('Image must be valid base64 PNG data');
  const prompt=`${system}\nReturn a single JSON object. Do not add markdown fences.`;
  let url=ENDPOINTS[cfg.provider], headers={'Content-Type':'application/json'},body;
  if(cfg.provider==='openai'){
    headers.Authorization=`Bearer ${apiKey}`;
    body={model:cfg.model,store:false,instructions:prompt,
      input:[{role:'user',content:[{type:'input_text',text:user},...(imageBase64?[{type:'input_image',image_url:`data:image/png;base64,${imageBase64}`,detail:'high'}]:[])]}]};
    if(schema)body.text={format:{type:'json_schema',name:'motionforge_output',strict:true,schema}};
  }else if(cfg.provider==='claude'){
    headers['x-api-key']=apiKey;headers['anthropic-version']='2023-06-01';
    body={model:cfg.model,max_tokens:4096,system:prompt,messages:[{role:'user',content:[
      {type:'text',text:user},...(imageBase64?[{type:'image',source:{type:'base64',media_type:'image/png',data:imageBase64}}]:[])
    ]}]};
    // Prefer broad model compatibility; JSON is parsed and validated locally.
  }else if(cfg.provider==='gemini'){
    headers['x-goog-api-key']=apiKey;
    // model is encoded as one path segment; cannot change origin/endpoint.
    url+=`${encodeURIComponent(cfg.model)}:generateContent`;
    body={systemInstruction:{parts:[{text:prompt}]},contents:[{role:'user',parts:[
      {text:user},...(imageBase64?[{inlineData:{mimeType:'image/png',data:imageBase64}}]:[])
    ]}],generationConfig:{responseMimeType:'application/json'}};
  }else{
    headers.Authorization=`Bearer ${apiKey}`;
    body={model:cfg.model,messages:[{role:'system',content:prompt},{role:'user',content:imageBase64?[
      {type:'text',text:user},{type:'image_url',image_url:{url:`data:image/png;base64,${imageBase64}`}}
    ]:user}],response_format:{type:'json_object'}};
  }
  const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),timeoutMs);
  try{
    const resp=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify(body),signal:abort.signal});
    // Don't echo response bodies: they can contain secret/account details.
    if(!resp.ok)throw Error(`${cfg.provider} API HTTP ${resp.status}${resp.status===401?' (check API key)':''}${resp.status===429?' (quota/rate limit)':''}`);
    const output=await resp.json();
    return parseModelJSON(extractText(cfg.provider,output));
  }catch(err){if(err.name==='AbortError')throw Error(`${cfg.provider} API request timed out`);throw err;}
  finally{clearTimeout(timer);}
}
