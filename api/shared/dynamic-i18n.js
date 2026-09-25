'use strict';

const crypto=require('crypto');

const LANGUAGES=Object.freeze(['de','en','pl','es','fr','it']);
const SIDE_CAR='_localizedText';
const LOCALIZABLE_FIELD=/^(?:note|notes|hints?|processNotes|pickupHint|pickupNotes|pickupInstruction|pickupInstructions|shippingHint|shippingNotes|shippingInstruction|shippingInstructions|description|taskDescription|documentDescription|message|instruction|instructions|remark|remarks|bemerkung|bemerkungen|hinweis|hinweise|beschreibung|abholhinweis|versandhinweis|aufgabenbeschreibung|dokumentbeschreibung)$/i;
const SKIP_BRANCH=/^(?:_localizedText|customerHistory|shipmentHistory|mailHistory|auditLog|history|files|attachments|deliveryFiles|deliveryNotesFiles|podFiles|abdFiles|documents|generatedDocuments|invoiceFiles|mailAttachments|containerPhotos)$/i;

function text(v){return String(v==null?'':v).trim()}
function normalizeLanguage(v,fallback='de'){
 const raw=text(v).toLowerCase().replace('_','-');
 const m=raw.match(/^(de|en|pl|es|fr|it)(?:-|$)/);
 return m?m[1]:(LANGUAGES.includes(fallback)?fallback:'de')
}
function hashText(value){return crypto.createHash('sha256').update(String(value==null?'':value),'utf8').digest('hex')}
function useful(value){
 const s=text(value);if(s.length<2)return false;
 if(/^https?:\/\/\S+$/i.test(s)||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))return false;
 if(/^[A-Z0-9._\/-]{2,40}$/.test(s)&&!/[a-zäöüßà-ÿ]/.test(s))return false;
 return true
}
function complete(meta){
 if(!meta||meta.status!=='complete'||!meta.translations)return false;
 return LANGUAGES.every(lang=>text(meta.translations[lang]).length>0)
}
function stableMeta(original,source,previous){
 const hash=hashText(original),same=previous&&text(previous.originalText)===original&&text(previous.sourceHash)===hash;
 if(same)return previous;
 const translations={};LANGUAGES.forEach(lang=>{translations[lang]=lang===source?original:''});
 return{
  originalText:original,
  sourceLanguage:source,
  translations,
  translationVersion:'sha256:'+hash.slice(0,16),
  sourceHash:hash,
  translatedAt:null,
  translationStatus:'pending',
  status:'pending',
  translationError:null
 }
}
function sourceLanguageFor(obj,key,fallback){
 return normalizeLanguage(
  obj&&(
   obj[key+'Language']||
   obj[key+'Lang']||
   obj.sourceLanguage||
   obj.language||
   obj.locale
  ),
  fallback
 )
}
function collect(root,fallback='de'){
 const rows=[],seen=new WeakSet();
 function walk(value,depth){
  if(value==null||depth>12||typeof value!=='object'||seen.has(value))return;
  seen.add(value);
  if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return}
  if(!value[SIDE_CAR]||typeof value[SIDE_CAR]!=='object'||Array.isArray(value[SIDE_CAR]))value[SIDE_CAR]={};
  for(const [key,current] of Object.entries(value)){
   if(key===SIDE_CAR||SKIP_BRANCH.test(key))continue;
   if(typeof current==='string'&&LOCALIZABLE_FIELD.test(key)&&useful(current)){
    const original=text(current),source=sourceLanguageFor(value,key,fallback),previous=value[SIDE_CAR][key];
    const meta=stableMeta(original,source,previous);
    value[SIDE_CAR][key]=meta;
    if(!complete(meta)||text(meta.originalText)!==original)rows.push({object:value,key,original,source,meta});
    continue
   }
   if(current&&typeof current==='object')walk(current,depth+1)
  }
  if(!Object.keys(value[SIDE_CAR]).length)delete value[SIDE_CAR]
 }
 walk(root,0);return rows
}
function translatorConfig(){
 const key=text(process.env.EXPORTHUB_TRANSLATOR_KEY||process.env.AZURE_TRANSLATOR_KEY);
 const region=text(process.env.EXPORTHUB_TRANSLATOR_REGION||process.env.AZURE_TRANSLATOR_REGION);
 const endpoint=text(process.env.EXPORTHUB_TRANSLATOR_ENDPOINT||process.env.AZURE_TRANSLATOR_ENDPOINT||'https://api.cognitive.microsofttranslator.com').replace(/\/+$/,'');
 return{key,region,endpoint,configured:!!key}
}
async function azureTranslateBatch(items,source,fetchImpl=globalThis.fetch){
 const cfg=translatorConfig();
 if(!cfg.configured)throw Object.assign(new Error('Azure Translator ist nicht konfiguriert.'),{code:'TRANSLATOR_NOT_CONFIGURED'});
 if(typeof fetchImpl!=='function')throw Object.assign(new Error('fetch ist für den Übersetzungsdienst nicht verfügbar.'),{code:'TRANSLATOR_FETCH_UNAVAILABLE'});
 const targets=LANGUAGES.filter(lang=>lang!==source);
 if(!targets.length)return items.map(original=>({original,translations:{[source]:original}}));
 const query=['api-version=3.0','from='+encodeURIComponent(source)].concat(targets.map(lang=>'to='+encodeURIComponent(lang))).join('&');
 const headers={'Content-Type':'application/json','Ocp-Apim-Subscription-Key':cfg.key,'X-ClientTraceId':crypto.randomUUID()};
 if(cfg.region)headers['Ocp-Apim-Subscription-Region']=cfg.region;
 const timeoutMs=Math.max(500,Math.min(10000,Number(process.env.EXPORTHUB_TRANSLATOR_TIMEOUT_MS||2500)||2500));
 const controller=typeof AbortController!=='undefined'?new AbortController():null;
 const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
 let response;
 try{
  response=await fetchImpl(cfg.endpoint+'/translate?'+query,{method:'POST',headers,body:JSON.stringify(items.map(Text=>({Text}))),signal:controller&&controller.signal});
 }catch(e){
  if(e&&e.name==='AbortError')throw Object.assign(new Error('Übersetzungsdienst Timeout nach '+timeoutMs+' ms.'),{code:'TRANSLATOR_TIMEOUT'});
  throw e
 }finally{if(timer)clearTimeout(timer)}
 const raw=await response.text();let data;
 try{data=raw?JSON.parse(raw):[]}catch(_){data=[]}
 if(!response.ok)throw Object.assign(new Error('Übersetzungsdienst HTTP '+response.status),{code:'TRANSLATOR_HTTP_'+response.status,detail:data});
 if(!Array.isArray(data)||data.length!==items.length)throw Object.assign(new Error('Ungültige Antwort des Übersetzungsdienstes.'),{code:'TRANSLATOR_RESPONSE_INVALID'});
 return data.map((row,index)=>{
  const translations={[source]:items[index]};
  (Array.isArray(row&&row.translations)?row.translations:[]).forEach(t=>{const lang=normalizeLanguage(t&&t.to,'');if(lang)translations[lang]=text(t&&t.text)});
  return{original:items[index],translations}
 })
}
async function enrichDynamicTranslations(root,fallbackLanguage='de',options={}){
 const sourceFallback=normalizeLanguage(fallbackLanguage),rows=collect(root,sourceFallback),limit=Math.max(1,Math.min(1000,Number(options.limit||50)||50));
 const selected=rows.slice(0,limit),translator=typeof options.translator==='function'?options.translator:async(items,source)=>azureTranslateBatch(items,source,options.fetchImpl);
 const groups=new Map();
 selected.forEach(row=>{const list=groups.get(row.source)||[];list.push(row);groups.set(row.source,list)});
 let completed=0,failed=0;
 for(const [source,list] of groups){
  try{
   const translated=await translator(list.map(x=>x.original),source);
   list.forEach((row,index)=>{
    const data=translated[index]&&translated[index].translations||{},translations={};
    LANGUAGES.forEach(lang=>{translations[lang]=text(data[lang])||(lang===source?row.original:'')});
    const ok=LANGUAGES.every(lang=>translations[lang]);
    row.meta.translations=translations;
    row.meta.translatedAt=ok?new Date().toISOString():null;
    row.meta.translationStatus=ok?'complete':'pending';
    row.meta.status=row.meta.translationStatus;
    row.meta.translationError=ok?null:'MISSING_TARGET_TRANSLATION';
    if(ok)completed++;else failed++
   })
  }catch(e){
   list.forEach(row=>{
    row.meta.translationStatus='pending';row.meta.status='pending';row.meta.translatedAt=null;
    row.meta.translationError=text(e&&e.code||e&&e.message||'TRANSLATION_FAILED').slice(0,180);
    failed++
   })
  }
 }
 const status=translationStatus(root);
 return Object.assign(status,{attempted:selected.length,completedNow:completed,failedNow:failed,remaining:Math.max(0,rows.length-selected.length),provider:translatorConfig().configured?'azure-translator':'not-configured'})
}
function translationStatus(root){
 let total=0,completeCount=0,pending=0,stale=0,seen=new WeakSet();
 function walk(value,depth){
  if(value==null||depth>12||typeof value!=='object'||seen.has(value))return;seen.add(value);
  if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return}
  const side=value[SIDE_CAR];
  if(side&&typeof side==='object'){
   for(const [key,meta] of Object.entries(side)){
    if(!meta||typeof meta!=='object')continue;total++;
    const current=typeof value[key]==='string'?text(value[key]):'',same=current&&current===text(meta.originalText)&&hashText(current)===text(meta.sourceHash);
    if(!same)stale++;else if(complete(meta))completeCount++;else pending++
   }
  }
  for(const [key,next] of Object.entries(value)){if(key!==SIDE_CAR&&!SKIP_BRANCH.test(key))walk(next,depth+1)}
 }
 walk(root,0);return{total,complete:completeCount,pending,stale,languages:LANGUAGES.slice()}
}
function localizedValue(record,key,language){
 if(!record||typeof record!=='object')return'';
 const original=text(record[key]),meta=record[SIDE_CAR]&&record[SIDE_CAR][key],lang=normalizeLanguage(language);
 if(!meta||text(meta.originalText)!==original)return original;
 return text(meta.translations&&meta.translations[lang])||original
}

module.exports={LANGUAGES,SIDE_CAR,normalizeLanguage,hashText,collect,enrichDynamicTranslations,translationStatus,localizedValue,azureTranslateBatch,translatorConfig};
