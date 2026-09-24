// ExportHUB RC1267 – central six-language i18n runtime.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1267_I18N__)return;
w.__EXPORTHUB_RC1267_I18N__=true;

var VERSION='RC1267';
var STORAGE_KEY='exporthub.language';
var COOKIE_KEY='exporthub_language';
var SUPPORTED=Object.freeze(['de','en','pl','es','fr','it']);
var LANGUAGE_NAMES=Object.freeze({de:'Deutsch',en:'English',pl:'Polski',es:'Español',fr:'Français',it:'Italiano'});
var resources=Object.create(null);
var sourceByText=Object.create(null);
var textOriginal=new WeakMap();
var attrOriginal=new WeakMap();
var observer=null;
var current='de';
var loadPromise=null;
var selector=null;

function q(v){return String(v==null?'':v).trim()}
function normalize(value){
 var v=q(value).toLowerCase().replace('_','-');
 if(/^de(?:-|$)/.test(v)||v==='deutsch'||v==='german')return'de';
 if(/^en(?:-|$)/.test(v)||v==='english'||v==='englisch')return'en';
 if(/^pl(?:-|$)/.test(v)||v==='polski'||v==='polish'||v==='polnisch')return'pl';
 if(/^es(?:-|$)/.test(v)||v==='español'||v==='espanol'||v==='spanish'||v==='spanisch')return'es';
 if(/^fr(?:-|$)/.test(v)||v==='français'||v==='francais'||v==='french'||v==='französisch'||v==='franzoesisch')return'fr';
 if(/^it(?:-|$)/.test(v)||v==='italiano'||v==='italian'||v==='italienisch')return'it';
 return'';
}
function cookieGet(){
 try{
  var part=('; '+d.cookie).split('; '+COOKIE_KEY+'=').pop();
  if(part&&part.indexOf(';')>=0)part=part.split(';').shift();
  return normalize(decodeURIComponent(part||''));
 }catch(_){return''}
}
function cookieSet(lang){
 try{d.cookie=COOKIE_KEY+'='+encodeURIComponent(lang)+'; Path=/; Max-Age=31536000; SameSite=Lax'}catch(_){}
}
function profileLanguage(){
 var candidates=[];
 try{if(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.user)candidates.push(w.ExportHUBClean.runtime.user)}catch(_){}
 try{if(w.appState){candidates.push(w.appState.currentUser,w.appState.activeUser,w.appState.user)}}catch(_){}
 try{
  if(w.sessionStorage){
   for(var i=0;i<w.sessionStorage.length;i++){
    var raw=w.sessionStorage.getItem(w.sessionStorage.key(i));
    if(!raw||raw.charAt(0)!=='{')continue;
    var parsed=JSON.parse(raw);
    if(parsed&&parsed.user)candidates.push(parsed.user);
   }
  }
 }catch(_){}
 for(var j=0;j<candidates.length;j++){
  var u=candidates[j],lang=normalize(u&&(u.language||u.uiLanguage||u.locale));
  if(lang)return lang;
 }
 return'';
}
function requested(){
 var profile=profileLanguage();if(profile)return profile;
 try{var p=new URL(w.location.href).searchParams.get('lang'),fromUrl=normalize(p);if(fromUrl)return fromUrl}catch(_){}
 try{var saved=normalize(w.localStorage&&w.localStorage.getItem(STORAGE_KEY));if(saved)return saved}catch(_){}
 var ck=cookieGet();if(ck)return ck;
 var nav=normalize(w.navigator&&(w.navigator.language||(w.navigator.languages&&w.navigator.languages[0])));if(nav)return nav;
 return'de';
}
function resourceUrl(lang){return'/assets/i18n/'+lang+'.json?v=1267'}
async function loadResource(lang){
 lang=normalize(lang)||'de';
 if(resources[lang])return resources[lang];
 var response=await w.fetch(resourceUrl(lang),{cache:'no-cache',credentials:'same-origin'});
 if(!response.ok)throw new Error('I18N_RESOURCE_HTTP_'+response.status+'_'+lang);
 var data=await response.json();
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('I18N_RESOURCE_INVALID_'+lang);
 resources[lang]=Object.freeze(data);
 return resources[lang];
}
function buildSourceIndex(){
 sourceByText=Object.create(null);
 var de=resources.de||{};
 Object.keys(de).forEach(function(key){
  var value=q(de[key]);
  if(value&&!sourceByText[value])sourceByText[value]=key;
 });
}
async function ensureResources(lang){
 var target=normalize(lang)||'de';
 var tasks=[loadResource('de')];
 if(target!=='de')tasks.push(loadResource(target));
 await Promise.all(tasks);
 buildSourceIndex();
 return resources[target]||resources.de||{};
}
function interpolate(value,vars){
 var text=String(value==null?'':value);
 if(!vars||typeof vars!=='object')return text;
 return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g,function(_,key){return Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):''});
}
function t(key,vars,lang){
 var wanted=normalize(lang)||current||'de';
 var pack=resources[wanted]||{},fallback=resources.de||{};
 var value=pack[key];
 if(value==null||value==='')value=fallback[key];
 if(value==null||value===''){
  try{w.dispatchEvent(new CustomEvent('exporthub:i18n-missing',{detail:{key:key,language:wanted}}))}catch(_){}
  return key;
 }
 return interpolate(value,vars);
}
function keyForSource(source){
 var trim=q(source);
 if(!trim)return'';
 return sourceByText[trim]||'';
}
function translateLegacyValue(value,lang){
 var source=q(value),key=keyForSource(source);
 return key?t(key,null,lang):value;
}
function translateTextNode(node,lang){
 if(!node||node.nodeType!==3)return;
 var parent=node.parentElement;
 if(!parent||/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/i.test(parent.tagName)||parent.closest('[data-i18n-ignore]'))return;
 if(!textOriginal.has(node))textOriginal.set(node,node.nodeValue);
 var original=textOriginal.get(node),trim=q(original);
 if(!trim)return;
 var key=parent.getAttribute&&parent.getAttribute('data-i18n');
 var translated=key?t(key,null,lang):translateLegacyValue(trim,lang);
 if(translated===trim&&lang!=='de')return;
 var lead=(original.match(/^\s*/)||[''])[0],trail=(original.match(/\s*$/)||[''])[0];
 node.nodeValue=lead+translated+trail;
}
function attrMemory(el){
 var value=attrOriginal.get(el);
 if(!value){value=Object.create(null);attrOriginal.set(el,value)}
 return value;
}
function translateAttributes(root,lang){
 if(!root||root.nodeType!==1)return;
 var list=[root].concat(Array.from(root.querySelectorAll('[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria],input[placeholder],textarea[placeholder],[title],[aria-label]')));
 list.forEach(function(el){
  var explicit={
   placeholder:el.getAttribute('data-i18n-placeholder'),
   title:el.getAttribute('data-i18n-title'),
   'aria-label':el.getAttribute('data-i18n-aria')
  },memory=attrMemory(el);
  ['placeholder','title','aria-label'].forEach(function(attr){
   if(!el.hasAttribute(attr)&&!explicit[attr])return;
   if(memory[attr]===undefined)memory[attr]=el.getAttribute(attr)||'';
   var next=explicit[attr]?t(explicit[attr],null,lang):translateLegacyValue(memory[attr],lang);
   if(next!==undefined&&next!==null)el.setAttribute(attr,next);
  });
 });
}
function translateDataKeys(root,lang){
 if(!root||root.nodeType!==1)return;
 var list=[];
 if(root.matches&&root.matches('[data-i18n]'))list.push(root);
 if(root.querySelectorAll)list=list.concat(Array.from(root.querySelectorAll('[data-i18n]')));
 list.forEach(function(el){
  var key=el.getAttribute('data-i18n');
  if(!key)return;
  var target=el.getAttribute('data-i18n-target');
  var value=t(key,null,lang);
  if(target==='value')el.value=value;
  else if(target)el.setAttribute(target,value);
  else el.textContent=value;
 });
}
function translate(root,lang){
 if(!root||!d.body)return;
 translateDataKeys(root.nodeType===1?root:d.body,lang);
 var walker=d.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[],node;
 while((node=walker.nextNode()))nodes.push(node);
 nodes.forEach(function(n){translateTextNode(n,lang)});
 translateAttributes(root.nodeType===1?root:d.body,lang);
 d.documentElement.lang=lang;
}
function persist(lang){
 try{w.localStorage&&w.localStorage.setItem(STORAGE_KEY,lang)}catch(_){}
 cookieSet(lang);
 try{
  var u=new URL(w.location.href);
  if(u.searchParams.has('lang')){u.searchParams.set('lang',lang);w.history.replaceState(null,'',u.pathname+u.search+u.hash)}
 }catch(_){}
}
async function setLanguage(lang,options){
 var next=normalize(lang)||'de',opts=options||{};
 await ensureResources(next);
 current=next;
 if(opts.persist!==false)persist(next);
 if(selector&&selector.value!==next)selector.value=next;
 translate(d.body,next);
 try{w.dispatchEvent(new CustomEvent('exporthub:language-changed',{detail:{language:next,version:VERSION}}))}catch(_){}
 return next;
}
function formatDate(value,options,lang){
 var locale=(normalize(lang)||current||'de')+'-'+({de:'DE',en:'GB',pl:'PL',es:'ES',fr:'FR',it:'IT'}[normalize(lang)||current||'de']);
 var date=value instanceof Date?value:new Date(value);
 if(Number.isNaN(date.getTime()))return q(value);
 return new Intl.DateTimeFormat(locale,options||{dateStyle:'medium'}).format(date);
}
function formatNumber(value,options,lang){
 var code=normalize(lang)||current||'de';
 var locale={de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'}[code];
 var n=Number(value);if(!Number.isFinite(n))return q(value);
 return new Intl.NumberFormat(locale,options||{}).format(n);
}
function formatCurrency(value,currency,lang){
 return formatNumber(value,{style:'currency',currency:currency||'EUR'},lang);
}
function selectorMarkup(){
 var wrap=d.createElement('label');
 wrap.id='exporthubI18nLoginSelector';
 wrap.setAttribute('data-i18n-ignore','1');
 wrap.style.cssText='position:fixed;right:14px;top:14px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(100,116,139,.3);border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 8px 24px rgba(15,23,42,.12);font:700 12px/1.2 Segoe UI,Aptos,Arial,sans-serif;color:#23384a';
 var caption=d.createElement('span');caption.id='exporthubI18nLoginCaption';caption.textContent='Sprache';
 var select=d.createElement('select');select.id='exporthubI18nLanguageSelect';select.setAttribute('aria-label','Sprache / Language');select.style.cssText='min-height:34px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;padding:5px 8px;font:inherit;color:#23384a';
 SUPPORTED.forEach(function(code){var o=d.createElement('option');o.value=code;o.textContent=LANGUAGE_NAMES[code];select.appendChild(o)});
 select.value=current;
 select.addEventListener('change',function(){setLanguage(select.value).catch(reportError)});
 wrap.appendChild(caption);wrap.appendChild(select);
 selector=select;
 return wrap;
}
function ensureSelector(){
 if(d.getElementById('exporthubI18nLoginSelector')){selector=d.getElementById('exporthubI18nLanguageSelect');return}
 (d.body||d.documentElement).appendChild(selectorMarkup());
}
function updateSelectorCaption(){
 var n=d.getElementById('exporthubI18nLoginCaption');if(n)n.textContent=t('common.language',null,current);
}
function reportError(error){
 try{console.error('[ExportHUB i18n]',error)}catch(_){}
 try{w.dispatchEvent(new CustomEvent('exporthub:i18n-error',{detail:{message:String(error&&error.message||error),language:current}}))}catch(_){}
}
function watch(){
 if(observer||typeof MutationObserver==='undefined'||!d.body)return;
 observer=new MutationObserver(function(records){
  records.forEach(function(record){
   Array.from(record.addedNodes||[]).forEach(function(node){
    if(node.nodeType===1)translate(node,current);
    else if(node.nodeType===3)translateTextNode(node,current);
   });
  });
 });
 observer.observe(d.body,{subtree:true,childList:true});
}
async function boot(){
 current=requested();
 try{await ensureResources(current)}catch(e){reportError(e);current='de';try{await ensureResources('de')}catch(inner){reportError(inner)}}
 ensureSelector();
 selector.value=current;
 translate(d.body,current);
 updateSelectorCaption();
 watch();
}
w.addEventListener('exporthub:user-profile-updated',function(ev){
 var lang=normalize(ev&&ev.detail&&ev.detail.user&&(ev.detail.user.language||ev.detail.user.uiLanguage));
 if(lang)setLanguage(lang).catch(reportError);
});
w.addEventListener('exporthub:language-changed',function(){updateSelectorCaption()});
w.ExportHUBI18n=Object.freeze({
 version:VERSION,
 supported:SUPPORTED,
 language:function(){return current},
 normalize:normalize,
 requested:requested,
 setLanguage:setLanguage,
 t:t,
 translate:translate,
 formatDate:formatDate,
 formatNumber:formatNumber,
 formatCurrency:formatCurrency,
 resourceUrl:resourceUrl
});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window,document);
