'use strict';

function text(value,max=12000){return String(value==null?'':value).trim().slice(0,max)}
function int(value,fallback,min,max){
 const n=Number.parseInt(value,10);
 if(!Number.isFinite(n))return fallback;
 return Math.min(max,Math.max(min,n))
}
function safeHttpsUrl(value,fallback){
 const raw=text(value,500)||fallback;
 try{const url=new URL(raw);return url.protocol==='https:'?url.toString():''}catch(_){return''}
}
function resolveConfig(env){
 env=env&&typeof env==='object'?env:{};
 const apiKey=text(env.EXPORTHUB_CUSTOMS_AI_API_KEY||env.OPENAI_API_KEY,8000);
 const provider=text(env.EXPORTHUB_CUSTOMS_AI_PROVIDER||'openai',40).toLowerCase();
 const model=text(env.EXPORTHUB_CUSTOMS_AI_MODEL||'gpt-6-sol',120);
 const endpoint=safeHttpsUrl(env.EXPORTHUB_CUSTOMS_AI_ENDPOINT,'https://api.openai.com/v1/responses');
 const timeoutMs=int(env.EXPORTHUB_CUSTOMS_AI_TIMEOUT_MS,18000,1000,30000);
 const maxOutputTokens=int(env.EXPORTHUB_CUSTOMS_AI_MAX_OUTPUT_TOKENS,1200,200,3000);
 return{apiKey,provider,model,endpoint,timeoutMs,maxOutputTokens,available:Boolean(apiKey&&model&&endpoint&&provider==='openai')}
}
function cleanSource(source,index){
 source=source&&typeof source==='object'?source:{};
 const id=text(source.id||`S${index+1}`,48).replace(/[^A-Za-z0-9._:-]/g,'');
 if(!id)return null;
 return{
  id,
  title:text(source.title,240),
  excerpt:text(source.excerpt,1600),
  sourceName:text(source.sourceName,160),
  sourceUrl:text(source.sourceUrl,500),
  publishedAt:text(source.publishedAt,40),
  checkedAt:text(source.checkedAt,40)
 }
}
function sourceBlock(sources){
 return sources.map(source=>[
  `[${source.id}] ${source.title||source.sourceName||'Quelle'}`,
  source.sourceName?`Quelle: ${source.sourceName}`:'',
  source.publishedAt?`Veröffentlicht: ${source.publishedAt}`:'',
  source.checkedAt?`Geprüft: ${source.checkedAt}`:'',
  source.sourceUrl?`URL: ${source.sourceUrl}`:'',
  source.excerpt?`Inhalt: ${source.excerpt}`:''
 ].filter(Boolean).join('\n')).join('\n\n')
}
function buildUserInput(question,context,sources){
 const contextJson=JSON.stringify(context&&typeof context==='object'?context:{});
 const verified=sourceBlock(sources);
 return [
  'NUTZERFRAGE:',text(question,5000),
  '',
  'SICHERER ANALYSEKONTEXT (deterministische Daten, nicht neu berechnen):',contextJson,
  '',
  'VERIFIZIERTE QUELLEN:',verified||'Keine verifizierte Quelle für diese Frage verfügbar.',
  '',
  'ZITIERREGEL: Verwende für belegte Aussagen ausschließlich Marker im Format [[S1]], [[S2]] usw. Nutze nur IDs aus VERIFIZIERTE QUELLEN. Wenn keine Quelle passt, sage ausdrücklich, dass die Wissensbasis nicht ausreicht.'
 ].join('\n')
}
function extractAnswer(payload){
 if(payload&&typeof payload.output_text==='string'&&payload.output_text.trim())return payload.output_text.trim();
 const output=Array.isArray(payload&&payload.output)?payload.output:[];
 const parts=[];
 for(const item of output){
  const content=Array.isArray(item&&item.content)?item.content:[];
  for(const part of content){
   if(part&&part.type==='output_text'&&typeof part.text==='string'&&part.text.trim())parts.push(part.text.trim())
  }
 }
 return parts.join('\n').trim()
}
function citationIds(answer,sources){
 const allowed=new Set(sources.map(source=>source.id)),out=[];
 const pattern=/\[\[([A-Za-z0-9._:-]{1,48})\]\]/g;
 let match;
 while((match=pattern.exec(answer))){if(allowed.has(match[1])&&!out.includes(match[1]))out.push(match[1])}
 return out
}
function failure(code,message,extra={}){
 return Object.assign({ok:false,code,recoverable:true,message:text(message,240),answer:'',citations:[],modelInfo:{provider:'openai',model:''}},extra)
}

async function askCustomsModel(options={}){
 const env=options.env&&typeof options.env==='object'?options.env:process.env;
 const config=resolveConfig(env);
 if(!config.available)return failure('AI_UNAVAILABLE','Der KI-Zollexperte ist serverseitig noch nicht konfiguriert.',{modelInfo:{provider:config.provider||'openai',model:config.model||''}});
 const sources=(Array.isArray(options.sources)?options.sources:[]).slice(0,12).map(cleanSource).filter(Boolean);
 const question=text(options.question,5000);
 if(!question)return failure('AI_QUESTION_REQUIRED','Bitte eine Zollfrage eingeben.',{modelInfo:{provider:config.provider,model:config.model}});
 const instructions=text(options.systemInstructions,12000);
 const input=buildUserInput(question,options.context,sources);
 const body={
  model:config.model,
  store:false,
  instructions,
  input:[{role:'user',content:[{type:'input_text',text:input}]}],
  max_output_tokens:config.maxOutputTokens
 };
 const fetchImpl=typeof options.fetchImpl==='function'?options.fetchImpl:globalThis.fetch;
 if(typeof fetchImpl!=='function')return failure('AI_UNAVAILABLE','Der KI-Provider ist in dieser Runtime nicht verfügbar.',{modelInfo:{provider:config.provider,model:config.model}});
 const timeoutMs=int(options.timeoutMs,config.timeoutMs,1,30000),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const response=await fetchImpl(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':`Bearer ${config.apiKey}`},body:JSON.stringify(body),signal:controller.signal});
  if(!response||response.ok!==true){
   const status=Number(response&&response.status)||0;
   return failure('AI_PROVIDER_ERROR','Der KI-Dienst ist vorübergehend nicht verfügbar.',{status,modelInfo:{provider:config.provider,model:config.model}})
  }
  const payload=await response.json();
  const answer=extractAnswer(payload);
  if(!answer)return failure('AI_PROVIDER_ERROR','Der KI-Dienst hat keine verwertbare Antwort geliefert.',{status:Number(response.status)||200,modelInfo:{provider:config.provider,model:text(payload&&payload.model,120)||config.model}});
  return{
   ok:true,
   answer,
   citations:citationIds(answer,sources),
   modelInfo:{provider:config.provider,model:text(payload&&payload.model,120)||config.model},
   recoverable:true
  }
 }catch(error){
  if(error&&error.name==='AbortError')return failure('AI_TIMEOUT','Die KI-Antwort hat zu lange gedauert.',{modelInfo:{provider:config.provider,model:config.model}});
  return failure('AI_PROVIDER_ERROR','Der KI-Dienst ist vorübergehend nicht erreichbar.',{modelInfo:{provider:config.provider,model:config.model}})
 }finally{clearTimeout(timer)}
}

module.exports={resolveConfig,askCustomsModel};
