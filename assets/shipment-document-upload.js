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
    'html[data-eh-design="neon"] .eh-docup-list li[data-state=error]{color:#ff8a80}html[data-eh-design="neon"] .eh-docup-list li[data-state=ok]{color:#7ee2a8}'+
    '.eh-docup-preview{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.8);display:grid;place-items:center;padding:16px}'+
    '.eh-docup-preview-panel{background:var(--pc-card-bg,#fff);color:var(--pc-text,#0f172a);width:min(1100px,96vw);height:min(840px,94vh);border-radius:14px;display:flex;flex-direction:column;overflow:hidden}'+
    '.eh-docup-preview-head{display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:12px;border-bottom:1px solid #ccd4dc}'+
    '.eh-docup-preview-head strong{flex:1;min-width:170px;overflow-wrap:anywhere}'+
    '.eh-docup-preview-media{flex:1;min-height:0;width:100%;border:0;object-fit:contain}'+
    '.eh-docup-no-preview{padding:24px}.rc786-doc-actions[data-docup-managed]{display:flex!important;gap:8px!important;flex-wrap:wrap!important}';
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
  if(!actions)return;
  if(actions.querySelector('[data-doc-upload]')){syncFileActions();return;}
  var b=el('button',{type:'button',class:'ghost','data-doc-upload':'1'},t('button'));
  actions.insertBefore(b,actions.firstChild);
  syncFileActions();
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
    try{
      var info=await uploadOne(ref,files[i],docKind);
      ok++;
      var original=q(files[i].name).replace(/[\\/:*?"<>|\\r\\n]+/g,'_').replace(/\\s+/g,' ').trim();
      var unexpected=info.name&&info.name.slice(-original.length-1)!=='_'+original;
      log[i]={state:unexpected?'error':'ok',text:t(info.sharepointSaved===false?'savedAzureOnly':'saved',{name:files[i].name})+
        (info.name?' → '+info.name:'')+(unexpected?' · WARNUNG: Server-Dateiname weicht von der Auswahl ab.':'')};
    }
    catch(e){log[i]={state:'error',text:t('failed',{name:files[i].name,message:q(e&&e.message||e)})}}
    renderList();
  }
  log.push({state:ok===files.length?'ok':'error',text:t('summary',{ok:ok,total:files.length})});
  picked=[];busy=false;renderList();
  if(ok){try{window.dispatchEvent(new CustomEvent('exporthub:shipment-document-uploaded',{detail:{reference:ref,kind:docKind,count:ok,referenceFolder:true}}))}catch(_){}
    var view=window.ExportHUBShipmentView;if(view&&typeof view.refreshReferenceFiles==='function')view.refreshReferenceFiles()}
  return ok===files.length;
}

function docRows(){var c=card();return c?Array.prototype.slice.call(c.querySelectorAll('#rc786ReferenceFilesPanel .rc786-doc-row')):[]}
function documentRows(){return Array.isArray(window.__EXPORTHUB_RC776_VIEW_DOCS__)?window.__EXPORTHUB_RC776_VIEW_DOCS__:[]}
function syncFileActions(){
  var rows=docRows(),docs=documentRows();
  rows.forEach(function(row,i){
    var d=docs[i],actions=row.querySelector('.rc786-doc-actions');
    if(!d||!actions||d.source!=='referenceFolder'||!q(d.itemId))return;
    if(actions.getAttribute('data-docup-managed')===q(d.itemId))return;
    actions.textContent='';actions.setAttribute('data-docup-managed',q(d.itemId));
    [['open','Öffnen'],['download','Herunterladen']].concat(/^refdoc:[0-9a-f]{32}$/.test(q(d.itemId))?[['delete','Löschen']]:[]).forEach(function(action){
      var b=el('button',{type:'button',class:'ghost eh-docup-file-action','data-docup-file-action':action[0],'data-docup-index':String(i),'data-docup-id':q(d.itemId)},action[1]);
      actions.appendChild(b);
    });
    var name=row.querySelector('.rc786-doc-main b'),meta=row.querySelector('.rc786-doc-main small');
    if(name)name.style.cssText='display:block;overflow-wrap:anywhere;word-break:break-word';
    if(meta)meta.style.cssText='display:block;margin-top:5px;overflow-wrap:anywhere';
  });
}
function fileContext(btn){
  var index=Number(btn.getAttribute('data-docup-index')),docs=documentRows(),d=docs[index],sh=currentShipment(),ref=refOf(sh);
  if(!d||!ref||d.source!=='referenceFolder'||q(d.reference)!==ref||q(d.itemId)!==q(btn.getAttribute('data-docup-id')))
    throw new Error('Die Dateiliste hat sich geändert. Bitte die Sendung erneut öffnen.');
  return {document:d,reference:ref};
}
async function fetchStoredFile(ref,d){
  var url='/api/reference-files?reference='+encodeURIComponent(ref)+'&itemId='+encodeURIComponent(d.itemId)+'&mode=inline';
  var res=await fetch(url,{method:'GET',headers:requestHeaders(),credentials:'same-origin',cache:'no-store'});
  if(!res.ok){var result={};try{result=await res.json()}catch(_){}throw new Error(q(result.message)||('HTTP '+res.status))}
  var blob=await res.blob();
  if(!blob.size)throw new Error('Die gespeicherte Datei ist leer.');
  return blob;
}
function downloadBlob(blob,name){
  var url=URL.createObjectURL(blob),a=el('a',{href:url,download:name||'Dokument'});
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url)},30000);
}
function previewBlob(blob,name){
  var existing=document.getElementById('eh-docup-preview');if(existing&&existing.closePreview)existing.closePreview();
  var url=URL.createObjectURL(blob),mime=q(blob.type).toLowerCase(),ext=extOf(name);
  var overlay=el('div',{id:'eh-docup-preview',class:'eh-docup-preview',role:'dialog','aria-modal':'true','aria-label':'Dateivorschau'});
  var panel=el('div',{class:'eh-docup-preview-panel'}),head=el('div',{class:'eh-docup-preview-head'});
  var title=el('strong',{},name),download=el('button',{type:'button',class:'ghost'},'Herunterladen'),close=el('button',{type:'button',class:'ghost'},'Schließen');
  overlay.closePreview=function(){overlay.remove();URL.revokeObjectURL(url)};
  download.addEventListener('click',function(){downloadBlob(blob,name)});
  close.addEventListener('click',overlay.closePreview);
  overlay.addEventListener('click',function(e){if(e.target===overlay)overlay.closePreview()});
  head.appendChild(title);head.appendChild(download);head.appendChild(close);panel.appendChild(head);
  var content;
  if(mime==='application/pdf'||ext==='.pdf')content=el('iframe',{src:url,title:name,class:'eh-docup-preview-media'});
  else if(mime.indexOf('image/')===0||['.jpg','.jpeg','.png'].indexOf(ext)>=0)content=el('img',{src:url,alt:name,class:'eh-docup-preview-media'});
  else content=el('p',{class:'eh-docup-no-preview'},'Für diesen Dateityp ist keine direkte Vorschau verfügbar. Du kannst die Originaldatei herunterladen.');
  panel.appendChild(content);overlay.appendChild(panel);document.body.appendChild(overlay);close.focus();
}
async function actOnFile(btn){
  if(btn.disabled)return;
  var action=btn.getAttribute('data-docup-file-action'),ctx=fileContext(btn),d=ctx.document;
  if(action==='delete'){
    if(!/^refdoc:[0-9a-f]{32}$/.test(q(d.itemId)))throw new Error('Geschützte Originale dürfen hier nicht gelöscht werden.');
    if(!window.confirm('Dokument "'+d.name+'" aus dieser Sendung entfernen?\n\nEs verschwindet aus der Sendungsansicht und dem Kundenavis. Original- und Archivkopien bleiben für die Nachvollziehbarkeit geschützt.'))return;
    btn.disabled=true;
    try{
      var res=await fetch('/api/reference-files',{method:'POST',headers:requestHeaders(),credentials:'same-origin',cache:'no-store',body:JSON.stringify({action:'delete-document',reference:ctx.reference,itemId:d.itemId})}),result={};
      try{result=await res.json()}catch(_){}
      if(!res.ok||result.ok===false)throw new Error(q(result.message)||('HTTP '+res.status));
      var view=window.ExportHUBShipmentView;
      if(view&&typeof view.refreshReferenceFiles==='function')await view.refreshReferenceFiles();
      window.alert('Das Dokument wurde aus der Sendung entfernt. Archivkopien bleiben geschützt.');
    }finally{btn.disabled=false}
    return;
  }
  btn.disabled=true;
  try{
    var blob=await fetchStoredFile(ctx.reference,d);
    if(action==='download')downloadBlob(blob,d.name);
    else if(action==='open')previewBlob(blob,d.name);
  }finally{btn.disabled=false}
}
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('[data-docup-file-action]');
  if(!b)return;
  e.preventDefault();e.stopPropagation();
  actOnFile(b).catch(function(error){window.alert('Datei-Aktion fehlgeschlagen:\n'+q(error&&error.message||error))});
},true);

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
