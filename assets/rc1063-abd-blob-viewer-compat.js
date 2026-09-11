(function(w){
'use strict';
if(w.__EXPORTHUB_RC1063_ABD_BLOB_VIEWER_COMPAT__)return;
w.__EXPORTHUB_RC1063_ABD_BLOB_VIEWER_COMPAT__=true;

function q(v){return String(v==null?'':v).trim()}
function docs(){return Array.isArray(w.__EXPORTHUB_RC776_VIEW_DOCS__)?w.__EXPORTHUB_RC776_VIEW_DOCS__:[]}
function helper(){return w.ExportHUBDocumentBlob1059||null}
function fileOf(d){return d&&d.file&&typeof d.file==='object'?d.file:d}
function isBlob(d){var h=helper(),f=fileOf(d);return !!(h&&typeof h.isBlobDocument==='function'&&h.isBlobDocument(f))}
function nameOf(d){var f=fileOf(d)||{};return q(d&&d.name||f.name||f.filename||'Dokument')}
function actionButton(kind,index,label){
 var b=w.document.createElement('button');
 b.type='button';b.className='ghost';b.textContent=label;
 b.setAttribute(kind==='open'?'data-rc1063-open-blob':'data-rc1063-download-blob',String(index));
 return b
}
function patchRows(){
 if(!w.document)return false;
 var panel=w.document.getElementById('rc786ReferenceFilesPanel');if(!panel)return false;
 var list=docs(),rows=panel.querySelectorAll('.rc786-doc-row'),changed=false;
 rows.forEach(function(row,index){
  var d=list[index];if(!isBlob(d))return;
  var actions=row.querySelector('.rc786-doc-actions');if(!actions)return;
  if(!actions.querySelector('[data-rc1063-open-blob]')){actions.appendChild(actionButton('open',index,'Öffnen'));changed=true}
  if(!actions.querySelector('[data-rc1063-download-blob]')){actions.appendChild(actionButton('download',index,'Download'));changed=true}
 });
 return changed
}
async function openBlob(index,download){
 var d=docs()[Number(index)],h=helper(),f=fileOf(d);
 if(!d||!h||typeof h.open!=='function'||!isBlob(d))throw new Error('Blob-Dokument ist nicht verfügbar.');
 return h.open(f,{name:nameOf(d),download:download===true})
}
function reportError(e){try{w.alert('Die ABD-Datei konnte nicht geöffnet werden.\n\n'+q(e&&e.message||e))}catch(_){}}
if(w.document){
 w.document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('[data-rc1063-open-blob],[data-rc1063-download-blob]');if(!t)return;
  e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
  var open=t.getAttribute('data-rc1063-open-blob'),down=t.getAttribute('data-rc1063-download-blob');
  openBlob(open!=null?open:down,down!=null).catch(reportError);
 },true);
 if(typeof w.MutationObserver==='function'){
  var mo=new w.MutationObserver(function(){patchRows()});
  try{mo.observe(w.document.documentElement,{childList:true,subtree:true})}catch(_){}
 }
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:sync'].forEach(function(name){
  try{w.addEventListener(name,function(){if(typeof w.setTimeout==='function')w.setTimeout(patchRows,0);else patchRows()})}catch(_){}
 });
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',function(){patchRows()},{once:true});else patchRows();
 if(typeof w.setInterval==='function'){var tries=0,timer=w.setInterval(function(){tries++;patchRows();if(tries>=60&&typeof w.clearInterval==='function')w.clearInterval(timer)},1000)}
}
w.ExportHUBRC1063AbdBlobCompat={patch:patchRows,isBlob:isBlob,open:openBlob};
})(window);
