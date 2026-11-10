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
  s.textContent+='.eh-avis-review{margin:10px 0;padding:12px;border:1px solid rgba(127,127,127,.35);border-radius:12px;display:grid;gap:10px}'+
   '.eh-avis-review table{border-collapse:collapse;width:100%;min-width:620px}.eh-avis-review th,.eh-avis-review td{padding:6px;text-align:left;border-bottom:1px solid rgba(127,127,127,.2)}'+
   '.eh-avis-review input{min-width:0;width:100%;padding:7px;border:1px solid #a5afba;border-radius:6px;color:inherit;background:transparent}'+
   '.eh-avis-review .eh-review-table{overflow-x:auto}.eh-avis-review .eh-review-box{padding:10px;border:1px solid rgba(127,127,127,.2);border-radius:8px;display:grid;gap:9px}'+
   '.eh-avis-review .eh-review-note{font-size:12px;opacity:.8}.eh-avis-review .eh-review-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}';
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
// RC1349 – Prüfpanel für Lieferscheine in derselben Sendungsansicht.
// Kein externer Parser, keine automatische öffentliche Freigabe.
function reviewPanel(){var c=card();return c&&c.querySelector('[data-avis-review-panel]')}
function reviewStatus(message){var p=reviewPanel(),node=p&&p.querySelector('[data-review-status]');if(node)node.textContent=q(message)}
function apiReview(ref,action,body){
 var url='/api/reference-files',opt={credentials:'same-origin',cache:'no-store',headers:requestHeaders()};
 if(action==='GET')url+='?reference='+encodeURIComponent(ref)+'&action=delivery-items-review';
 else{opt.method='POST';opt.body=JSON.stringify(Object.assign({action:'approve-delivery-items',reference:ref},body||{}))}
 return fetch(url,opt).then(async function(response){var data={};try{data=await response.json()}catch(_){}if(!response.ok||data.ok===false)throw new Error(q(data.message)||('HTTP '+response.status));return data});
}
function reviewInput(field,value){
 var input=el('input',{type:'text','data-review-field':field,autocomplete:'off',maxlength:field==='customerItemNumber'?'60':field==='customerOrderNumber'?'40':'20',value:q(value)});
 input.setAttribute('aria-label',({customerOrderNumber:t('reviewOrder'),customerItemNumber:t('reviewPart'),deliveredQuantity:t('reviewQuantity'),quantityUnit:t('reviewUnit')}[field]||field));return input;
}
function appendReviewRow(tbody,value){
 var row=el('tr',{'data-review-row':'1'}),fields=['customerOrderNumber','customerItemNumber','deliveredQuantity','quantityUnit'];
 fields.forEach(function(key){var cell=el('td',{});cell.appendChild(reviewInput(key,value&&value[key]));row.appendChild(cell)});
 var c=el('td',{}),remove=el('button',{type:'button',class:'ghost'},t('reviewRemove'));
 remove.addEventListener('click',function(){row.remove()});c.appendChild(remove);row.appendChild(c);tbody.appendChild(row);
}
function showReviewDocuments(ref,items){
 var panelNode=reviewPanel();if(!panelNode||ref!==refOf(currentShipment()))return;
 var host=panelNode.querySelector('[data-review-documents]');host.textContent='';
 if(!items.length){host.appendChild(el('p',{},t('reviewNoDocuments')));reviewStatus(t('reviewEmpty'));return}
 items.filter(function(x){return x.current!==false}).forEach(function(doc){
  var box=el('div',{class:'eh-review-box'});box.appendChild(el('strong',{},doc.name||t('lieferschein')));
  var states={scan_pending:t('reviewPending'),blocked:t('reviewBlocked'),review_required:t('reviewNeedsReview'),manual_review_required:t('reviewManualReview'),approved:t('reviewApproved'),hash_mismatch:t('reviewHashMismatch')};
  box.appendChild(el('div',{class:'eh-review-note'},states[doc.status]||doc.status||t('reviewUnknown')));
  var editable=doc.scanStatus==='clean'&&['review_required','manual_review_required','approved'].includes(doc.status);
  if(editable){
   var wrap=el('div',{class:'eh-review-table'}),table=el('table',{}),head=el('thead',{}),tr=el('tr',{});
   [t('reviewOrder'),t('reviewPart'),t('reviewQuantity'),t('reviewUnit'),''].forEach(function(label){tr.appendChild(el('th',{},label))});
   head.appendChild(tr);table.appendChild(head);var tbody=el('tbody',{});
   (doc.rows&&doc.rows.length?doc.rows:[{}]).forEach(function(r){appendReviewRow(tbody,r)});
   table.appendChild(tbody);wrap.appendChild(table);box.appendChild(wrap);
   var actions=el('div',{class:'eh-review-actions'}),plus=el('button',{type:'button',class:'ghost'},t('reviewAdd')),approve=el('button',{type:'button',class:'btn primary'},t('reviewConfirm'));
   plus.addEventListener('click',function(){if(tbody.children.length<100)appendReviewRow(tbody,{})});
   approve.addEventListener('click',async function(){
    if(ref!==refOf(currentShipment()))return;
    var rows=Array.from(tbody.querySelectorAll('[data-review-row]')).map(function(row){
     var data={};row.querySelectorAll('[data-review-field]').forEach(function(input){data[input.getAttribute('data-review-field')]=q(input.value)});return data
    });
    approve.disabled=true;reviewStatus(t('reviewSaving'));
    try{
     await apiReview(ref,'POST',{documentId:doc.id,sha256:doc.sha256,rows:rows});
     reviewStatus(t('reviewSaved'));
     await loadReview(ref);
    }catch(e){reviewStatus(q(e&&e.message)||t('reviewError'));approve.disabled=false}
   });
   actions.appendChild(plus);actions.appendChild(approve);box.appendChild(actions);
  }
  if(Array.isArray(doc.issues)&&doc.issues.length)box.appendChild(el('small',{class:'eh-review-note'},doc.issues.join(' · ')));
  host.appendChild(box);
 });
}
async function loadReview(ref){
 if(!reviewPanel()||ref!==refOf(currentShipment()))return;
 reviewStatus(t('reviewLoading'));
 try{
  var result=await apiReview(ref,'GET');
  if(ref!==refOf(currentShipment())||!reviewPanel())return;
  showReviewDocuments(ref,result.documents||[]);
  reviewStatus(t('reviewUpdated'));
 }catch(e){reviewStatus(q(e&&e.message)||t('reviewUnavailable'))}
}
function toggleReview(){
 var c=card(),ref=refOf(currentShipment());if(!c||!ref)return;
 var current=reviewPanel();if(current){current.remove();return}
 ensureStyle();var panelNode=el('section',{class:'eh-avis-review','data-avis-review-panel':'1','aria-label':t('reviewAriaTitle')});
 panelNode.appendChild(el('h4',{},t('reviewTitle')));
 var controls=el('div',{class:'eh-review-actions'}),refresh=el('button',{type:'button',class:'ghost'},t('reviewRefresh')),close=el('button',{type:'button',class:'ghost'},t('reviewClose'));
 refresh.addEventListener('click',function(){loadReview(ref)});close.addEventListener('click',function(){panelNode.remove()});
 controls.appendChild(refresh);controls.appendChild(close);panelNode.appendChild(controls);
 panelNode.appendChild(el('p',{'data-review-status':'1',role:'status',class:'eh-review-note'},t('reviewStarting')));
 panelNode.appendChild(el('div',{'data-review-documents':'1'}));
 var uploadPanel=panel();if(uploadPanel)uploadPanel.insertAdjacentElement('afterend',panelNode);
 else c.appendChild(panelNode);
 loadReview(ref);
}
function ensureButton(){
  scheduled=false;
  var actions=document.querySelector('#rc786ReferenceFilesCard .rc786-doc-head-actions');
  if(!actions)return;
  if(!actions.querySelector('[data-doc-upload]')){var b=el('button',{type:'button',class:'ghost','data-doc-upload':'1'},t('button'));actions.insertBefore(b,actions.firstChild)}
  if(!actions.querySelector('[data-avis-review]')){var review=el('button',{type:'button',class:'ghost','data-avis-review':'1'},t('reviewButton'));actions.appendChild(review)}
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
  var info=body.file||{};info.sharepointSaved=body.sharepointSaved;info.azureSaved=body.azureSaved;return info;
}
async function uploadAll(){
  var ref=refOf(currentShipment());
  if(!ref||busy)return false;
  if(!picked.length){window.alert(t('noFiles'));return false}
  busy=true;var files=picked.slice(),docKind=KINDS.indexOf(kind)>=0?kind:'sonstiges',ok=0;
  log=files.map(function(f){return{state:'',text:f.name}});renderList();
  for(var i=0;i<files.length;i++){
    log[i]={state:'busy',text:t('busy',{name:files[i].name})};renderList();
    try{var info=await uploadOne(ref,files[i],docKind);ok++;log[i]={state:'ok',text:t(info.sharepointSaved===false?'savedAzureOnly':'saved',{name:files[i].name})}}
    catch(e){log[i]={state:'error',text:t('failed',{name:files[i].name,message:q(e&&e.message||e)})}}
    renderList();
  }
  log.push({state:ok===files.length?'ok':'error',text:t('summary',{ok:ok,total:files.length})});
  picked=[];busy=false;renderList();
  if(ok&&reviewPanel())loadReview(ref);
  if(ok){try{window.dispatchEvent(new CustomEvent('exporthub:shipment-document-uploaded',{detail:{reference:ref,kind:docKind,count:ok,referenceFolder:true}}))}catch(_){}
    var view=window.ExportHUBShipmentView;if(view&&typeof view.refreshReferenceFiles==='function')view.refreshReferenceFiles()}
  return ok===files.length;
}
document.addEventListener('click',function(e){
  var target=e.target&&e.target.closest?e.target:null;if(!target)return;
  if(target.closest('[data-avis-review]')){e.preventDefault();e.stopImmediatePropagation();toggleReview();return}
  if(target.closest('[data-doc-upload]')){e.preventDefault();e.stopImmediatePropagation();togglePanel();return}
  if(target.closest('[data-docup-start]')){e.preventDefault();uploadAll();return}
  if(target.closest('[data-docup-close]')){e.preventDefault();if(!busy){var p=panel();if(p)p.remove();picked=[];log=[]}}
},true);
function start(){ensureButton();if(window.MutationObserver)new MutationObserver(scheduleEnsure).observe(document.body,{childList:true,subtree:true})}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
window.ExportHUBShipmentDocUpload=Object.freeze({version:'DOC1',kinds:KINDS.slice(),extensions:EXT.slice(),upload:uploadOne,uploadAll:uploadAll,addFiles:addFiles,ensureButton:ensureButton});
})();
