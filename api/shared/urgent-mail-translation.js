'use strict';
// Optional server-side translation of free-text Urgent Order issue notes.
// Text is never silently presented as translated when the provider is unavailable.
const {translatorConfig}=require('./dynamic-i18n');
const LANGUAGES=new Set(['de','en']);
function language(raw){return LANGUAGES.has(String(raw||'').toLowerCase())?String(raw).toLowerCase():'de';}
async function translateIssueNote(note,sourceLanguage,targetLanguage,options={}){
 const original=String(note==null?'':note).trim().slice(0,2000);
 const source=language(sourceLanguage),target=language(targetLanguage);
 if(!original||source===target)return{text:original,translated:false,translationWarning:false};
 const cfg=options.config||translatorConfig();
 const fetchImpl=options.fetchImpl||globalThis.fetch;
 if(!cfg.configured||typeof fetchImpl!=='function')
  return{text:original,translated:false,translationWarning:true};
 const ctrl=typeof AbortController==='function'?new AbortController():null;
 const delay=Math.max(500,Math.min(4000,Number(options.timeoutMs||2500)));
 const timeout=ctrl?setTimeout(()=>ctrl.abort(),delay):null;
 try{
  // Azure detects the language of the original problem text; the currently
  // selected website language is not necessarily the language staff typed.
  const url=String(cfg.endpoint).replace(/\/+$/,'')+'/translate?api-version=3.0&textType=plain&to='+encodeURIComponent(target);
  const headers={'Content-Type':'application/json; charset=utf-8','Ocp-Apim-Subscription-Key':cfg.key};
  if(cfg.region)headers['Ocp-Apim-Subscription-Region']=cfg.region;
  const res=await fetchImpl(url,{method:'POST',headers,body:JSON.stringify([{Text:original}]),...(ctrl?{signal:ctrl.signal}:{})});
  if(!res||!res.ok)throw Error('TRANSLATION_HTTP');
  const data=await res.json();
  const translated=data&&data[0]&&data[0].translations&&data[0].translations.find(x=>String(x.to||'').toLowerCase()===target);
  const output=String(translated&&translated.text||'').trim();
  if(!output||output.length>4000)throw Error('TRANSLATION_EMPTY');
  return{text:output,translated:true,translationWarning:false};
 }catch(_){
  // Keep an editable original; do not fabricate a translation or block the email.
  return{text:original,translated:false,translationWarning:true};
 }finally{if(timeout)clearTimeout(timeout);}
}
module.exports={translateIssueNote};
