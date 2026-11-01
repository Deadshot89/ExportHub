(function(){
'use strict';
// Dokument-Upload in der Sendungsansicht: Lieferscheine, Rechnungen, Packlisten, Excel- und
// sonstige Dateien landen über /api/reference-files direkt im REF-Ordner der Sendung und
// erscheinen danach unter "Dateien & Dokumente".
if(window.__EXPORTHUB_SHIPMENT_DOC_UPLOAD__)return;window.__EXPORTHUB_SHIPMENT_DOC_UPLOAD__=true;
var MAX_BYTES=15*1024*1024,busy=false,scheduled=false,picked=[],kind='lieferschein',log=[];
var KINDS=['lieferschein','rechnung','packliste','excel','sonstiges'];
var EXT=['.pdf','.jpg','.jpeg','.png','.xlsx','.xlsm','.xls','.csv','.docx','.doc','.txt','.msg','.eml'];
function q(v){return String(v==null?'':v).trim()}
// Texte liegen in assets/i18n/shipment-document-upload.js (wird vorher geladen)
function packs(){var p=window.ExportHUBShipmentDocUploadI18n;return p&&p.packs||{de:{}}}
function lang(){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.language==='function'){var l=q(window.ExportHUBI18n.language()).toLowerCase();if(packs()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=packs(),pack=all[lang()]||all.de||{},text=pack[key]||(all.de||{})[key]||key;if(vars)Object.keys(vars).forEach(function(k){text=text.split('{'+k+'}').join(String(vars[k]))});return text}
function currentShipment(){var sh=window.__EXPORTHUB_RC776_VIEW_SHIPMENT__;return sh&&typeof sh==='object'?sh:null}
function refOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef)).toUpperCase()}
function extOf(name){var m=q(name).toLowerCase().match(/(\.[a-z0-9]+)$/);return m?m[1]:''}
function requestHeaders(){var rt=window.ExportHUBClean&&window.ExportHUBClean.runtime||{},token=q(rt.authToken),h={Accept:'application/json','Content-Type':'application/json'};if(token){h['X-ExportHUB-Token']=token;h['X-ExportHUB-Session']=token;h.Authorization='Bearer '+token}return h}
function el(tag,attrs,text){var n=document.createElement(tag);Object.keys(attrs||{}).forEach(function(k){n.setAttribute(k,attrs[k])});if(text!=null)n.textContent=text;return n}
function ensureStyle(){
  if(document.getElementById('exporthub-shipment-doc-upload-style'))return;
  var s=el('style',{id:'exporthub-shipment-doc-upload-style'});
  s.textContent='.eh-docup{margin:10px 0 12px;padding:12px;border:1px solid rgba(127,127,127,.35);border-radius:12px;display:grid;gap:10px}'+
    '.eh-docup h4{margin:0;font-size:14px}.eh-docup-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'+
    '.eh-docup label{font-size:12px;font-weight:700;display:grid;gap:4px}.eh-docup select{min-width:200px}'+
    '.eh-docup-drop{border:2px dashed rgba(127,127,127,.45);border-radius:10px;padding:14px;text-align:center;cursor:pointer;font-weight:600}'+
    '.eh-docup-drop.is-over{border-color:currentColor;background:rgba(127,127,127,.08)}'+
    '.eh-docup-hint{font-size:12px;opacity:.75;margin:0}.eh-docup-list{margin:0;padding-left:18px;font-size:13px;display:grid;gap:2px}'+
    '.eh-docup-list li[data-state=error]{color:#b42318}.eh-docup-list li[data-state=ok]{color:#067647}'+
    'html[data-eh-design="neon"] .eh-docup-list li[data-state=error]{color:#ff8a80}html[data-eh-design="neon"] .eh-docup-list li[data-state=ok]{color:#7ee2a8}';
  document.head.appendChild(s);
}
function card(){return document.getElementById('rc786ReferenceFilesCard')}
function panel(){var c=card();return c&&c.querySelector('[data-docup-panel]')}
function renderList(){
  var p=panel();if(!p)return;var list=p.querySelector('[data-docup-list]');list.textContent='';
  var rows=log.length?log:picked.map(function(f){return{state:'',text:f.name+' · '+Math.max(1,Math.round(f.size/1024))+' KB'}});
  rows.forEach(function(r){list.appendChild(el('li',{'data-state':r.state||''},r.text))});
  var up=p.querySelector('[data-docup-start]');if(up)up.disabled=busy||!picked.length;
}
function addFiles(files){if(busy)return;log=[];Array.prototype.forEach.call(files||[],function(f){if(!picked.some(function(x){return x.name===f.name&&x.size===f.size}))picked.push(f)});renderList()}
function buildPanel(){
  var p=el('div',{class:'eh-docup','data-docup-panel':'1',role:'group','aria-label':t('title')});
  p.appendChild(el('h4',{},t('title')));
  var row=el('div',{class:'eh-docup-row'}),lab=el('label',{},t('kind')),sel=el('select',{'data-docup-kind':'1'});
  KINDS.forEach(function(k){var o=el('option',{value:k},t(k));if(k===kind)o.selected=true;sel.appendChild(o)});
  sel.addEventListener('change',function(){kind=sel.value});
  lab.appendChild(sel);row.appendChild(lab);p.appendChild(row);
  var input=el('input',{type:'file',multiple:'multiple',accept:EXT.join(','),'data-docup-input':'1',style:'display:none'});
  input.addEventListener('change',function(){addFiles(input.files);input.value=''});
  var drop=el('div',{class:'eh-docup-drop','data-docup-drop':'1',role:'button',tabindex:'0'},t('drop'));
  drop.addEventListener('click',function(){input.click()});
  drop.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click()}});
  drop.addEventListener('dragover',function(e){e.preventDefault();drop.classList.add('is-over')});
  drop.addEventListener('dragleave',function(){drop.classList.remove('is-over')});
  drop.addEventListener('drop',function(e){e.preventDefault();drop.classList.remove('is-over');addFiles(e.dataTransfer&&e.dataTransfer.files)});
  p.appendChild(input);p.appendChild(drop);
  p.appendChild(el('p',{class:'eh-docup-hint'},t('hint')));
  p.appendChild(el('ul',{class:'eh-docup-list','data-docup-list':'1','aria-live':'polite'}));
  var actions=el('div',{class:'eh-docup-row'}),start=el('button',{type:'button',class:'btn primary','data-docup-start':'1'},t('upload')),close=el('button',{type:'button',class:'ghost','data-docup-close':'1'},t('cancel'));
  actions.appendChild(start);actions.appendChild(close);p.appendChild(actions);
  return p;
}
function togglePanel(){
  var c=card();if(!c)return;var p=panel();
  if(p){if(!busy){p.remove();picked=[];log=[]}return}
  ensureStyle();p=buildPanel();
  var actions=c.querySelector('.rc786-doc-head-actions'),head=actions&&actions.parentElement;
  if(head&&head.parentElement===c)head.insertAdjacentElement('afterend',p);else c.appendChild(p);
  renderList();
}
function ensureButton(){
  scheduled=false;
  var actions=document.querySelector('#rc786ReferenceFilesCard .rc786-doc-head-actions');
  if(!actions||actions.querySelector('[data-doc-upload]'))return;
  var b=el('button',{type:'button',class:'ghost','data-doc-upload':'1'},t('button'));
  actions.insertBefore(b,actions.firstChild);
}
function scheduleEnsure(){if(scheduled)return;scheduled=true;(window.requestAnimationFrame||setTimeout)(ensureButton)}
function readBase64(file){return new Promise(function(resolve,reject){var r=new FileReader();r.onload=function(){var s=String(r.result||''),i=s.indexOf(',');resolve(i>=0?s.slice(i+1):s)};r.onerror=function(){reject(r.error||new Error('read'))};r.readAsDataURL(file)})}
async function uploadOne(ref,file,docKind){
  if(EXT.indexOf(extOf(file.name))<0)throw new Error(t('typeInvalid'));
  if(file.size>MAX_BYTES)throw new Error(t('tooLarge'));
  var data=await readBase64(file);
  var res=await fetch('/api/reference-files',{method:'POST',headers:requestHeaders(),credentials:'same-origin',cache:'no-store',body:JSON.stringify({action:'upload-document',kind:docKind,reference:ref,fileName:file.name,mimeType:file.type,data:data})}),body={};
  try{body=await res.json()}catch(_){}
  if(!res.ok||body.ok===false)throw new Error(q(body.message)||('HTTP '+res.status));
  return body.file||{};
}
async function uploadAll(){
  var ref=refOf(currentShipment());
  if(!ref||busy)return false;
  if(!picked.length){window.alert(t('noFiles'));return false}
  busy=true;var files=picked.slice(),docKind=KINDS.indexOf(kind)>=0?kind:'sonstiges',ok=0;
  log=files.map(function(f){return{state:'',text:f.name}});renderList();
  for(var i=0;i<files.length;i++){
    log[i]={state:'busy',text:t('busy',{name:files[i].name})};renderList();
    try{await uploadOne(ref,files[i],docKind);ok++;log[i]={state:'ok',text:t('saved',{name:files[i].name})}}
    catch(e){log[i]={state:'error',text:t('failed',{name:files[i].name,message:q(e&&e.message||e)})}}
    renderList();
  }
  log.push({state:ok===files.length?'ok':'error',text:t('summary',{ok:ok,total:files.length})});
  picked=[];busy=false;renderList();
  if(ok){try{window.dispatchEvent(new CustomEvent('exporthub:shipment-document-uploaded',{detail:{reference:ref,kind:docKind,count:ok,referenceFolder:true}}))}catch(_){}
    var view=window.ExportHUBShipmentView;if(view&&typeof view.refreshReferenceFiles==='function')view.refreshReferenceFiles()}
  return ok===files.length;
}
document.addEventListener('click',function(e){
  var target=e.target&&e.target.closest?e.target:null;if(!target)return;
  if(target.closest('[data-doc-upload]')){e.preventDefault();e.stopImmediatePropagation();togglePanel();return}
  if(target.closest('[data-docup-start]')){e.preventDefault();uploadAll();return}
  if(target.closest('[data-docup-close]')){e.preventDefault();if(!busy){var p=panel();if(p)p.remove();picked=[];log=[]}}
},true);
function start(){ensureButton();if(window.MutationObserver)new MutationObserver(scheduleEnsure).observe(document.body,{childList:true,subtree:true})}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
window.ExportHUBShipmentDocUpload=Object.freeze({version:'DOC1',kinds:KINDS.slice(),extensions:EXT.slice(),upload:uploadOne,uploadAll:uploadAll,addFiles:addFiles,ensureButton:ensureButton});
})();
