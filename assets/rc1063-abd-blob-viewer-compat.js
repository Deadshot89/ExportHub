(function(w){
'use strict';
if(w.__EXPORTHUB_RC1063_ABD_BLOB_VIEWER_COMPAT__)return;
w.__EXPORTHUB_RC1063_ABD_BLOB_VIEWER_COMPAT__=true;
w.__EXPORTHUB_RC1151_DOCUMENT_ACTIONS__=true;

function q(v){return String(v==null?'':v).trim()}
function tr(key,vars){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars)}catch(_){}return key}
function typeDisplay(type){var map={Rechnung:'shipmentHistory.document.invoice',Lieferschein:'shipmentHistory.document.deliveryNote',Ladeliste:'shipmentHistory.document.loadingList',Dokument:'shipmentHistory.document.generic'};return map[type]?tr(map[type]):type}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function identity(sh){return q(sh&&(sh.id||sh.shipmentId||sh.reference||sh.referenceNumber||sh.ref||sh.sendungsreferenz)).toLocaleUpperCase('de-DE')}
function currentShipment(){
 var s=state(),direct=s.currentShipment||s.shipment||s.activeShipment||null;if(direct&&typeof direct==='object')return direct;
 var id=q(s.currentShipmentId||s.selectedShipmentId||s.shipmentId),ref=q(s.currentShipmentRef||s.selectedShipmentRef||s.reference).toLocaleUpperCase('de-DE');
 var lists=[s.shipments,s.savedShipments,s.shipmentArchive,s.archivedShipments,s.salesSharedShipments,s.sharedShipments];
 for(var i=0;i<lists.length;i++){var list=arr(lists[i]);for(var j=0;j<list.length;j++){var sh=list[j];if(!sh)continue;if(id&&q(sh.id||sh.shipmentId)===id)return sh;if(ref&&identity(sh)===ref)return sh}}
 return null
}
function baseDocs(){return Array.isArray(w.__EXPORTHUB_RC776_VIEW_DOCS__)?w.__EXPORTHUB_RC776_VIEW_DOCS__:[]}
function helper(){return w.ExportHUBDocumentBlob1059||null}
function fileOf(d){return d&&d.file&&typeof d.file==='object'?d.file:d}
function isBlob(d){var h=helper(),f=fileOf(d);return !!(h&&typeof h.isBlobDocument==='function'&&h.isBlobDocument(f))}
function sourceAvailable(d){var h=helper(),f=fileOf(d);if(!h||!f)return false;if(typeof h.isBlobDocument==='function'&&h.isBlobDocument(f))return true;return typeof h.legacyUrl==='function'&&!!h.legacyUrl(f)}
function nameOf(d){var f=fileOf(d)||{};return q(d&&d.name||f.name||f.fileName||f.filename||f.originalName)||tr('shipmentHistory.document.generic')}
function inferType(d,fallback){
 var raw=low((d&&d.documentType)+' '+(d&&d.category)+' '+nameOf(d));
 if(/rechnung|invoice/.test(raw))return'Rechnung';
 if(/lieferschein|delivery.?note/.test(raw))return'Lieferschein';
 if(/\babd\b|ausfuhrbegleit/.test(raw))return'ABD';
 if(/\bpod\b|proof.?of.?delivery|abliefer/.test(raw))return'POD';
 if(/cmr/.test(raw))return'CMR';
 if(/ladeliste/.test(raw))return'Ladeliste';
 return fallback||'Dokument'
}
function docKey(d){var f=fileOf(d)||{},type=inferType(d,'Dokument');return q(f.blobName||f.id||f.url||f.downloadUrl||f.href||nameOf(d))+'|'+type}
function wrapped(file,type,field){return{file:file,name:q(file&&file.name||file&&file.fileName||file&&file.filename)||type,documentType:type,sourceField:field}}
function docs(){
 var out=[],seen=Object.create(null),add=function(d){if(!d)return;var key=docKey(d);if(!key||seen[key])return;seen[key]=1;out.push(d)};
 baseDocs().forEach(add);
 var sh=currentShipment();
 if(sh){
  [
   ['invoiceFiles','Rechnung'],
   ['deliveryFiles','Lieferschein'],
   ['deliveryNotesFiles','Lieferschein'],
   ['lieferscheine','Lieferschein'],
   ['abdFiles','ABD'],
   ['podFiles','POD'],
   ['generatedDocuments','Dokument'],
   ['documents','Dokument'],
   ['files','Dokument'],
   ['attachments','Dokument'],
   ['mailAttachments','Dokument']
  ].forEach(function(def){arr(sh[def[0]]).forEach(function(file){add(wrapped(file,inferType(file,def[1]),def[0]))})})
 }
 return out
}
function typeOf(d){return inferType(d,q(d&&d.documentType)||'Dokument')}
function actionButton(kind,index,label){
 var b=w.document.createElement('button');
 b.type='button';b.className='ghost';b.textContent=label;
 b.setAttribute(kind==='open'?'data-rc1063-open-blob':'data-rc1063-download-blob',String(index));
 return b
}
function createRow(d,index){
 var row=w.document.createElement('div');row.className='rc786-doc-row';row.setAttribute('data-rc1151-document-row',docKey(d));
 var main=w.document.createElement('div');main.className='rc786-doc-main';
 var title=w.document.createElement('strong');title.textContent=typeDisplay(typeOf(d));
 var name=w.document.createElement('span');name.className='muted';name.textContent=nameOf(d);
 main.appendChild(title);main.appendChild(name);
 var actions=w.document.createElement('div');actions.className='rc786-doc-actions';
 actions.appendChild(actionButton('open',index,tr('documentViewer.open')));actions.appendChild(actionButton('download',index,tr('documentViewer.download')));
 row.appendChild(main);row.appendChild(actions);return row
}
function patchRows(){
 if(!w.document)return false;
 var panel=w.document.getElementById('rc786ReferenceFilesPanel');if(!panel)return false;
 var list=docs(),rows=Array.prototype.slice.call(panel.querySelectorAll('.rc786-doc-row')),changed=false;
 rows.forEach(function(row,index){
  var d=list[index];if(!sourceAvailable(d))return;
  var actions=row.querySelector('.rc786-doc-actions');if(!actions)return;
  if(!actions.querySelector('[data-rc1063-open-blob]')){actions.appendChild(actionButton('open',index,tr('documentViewer.open')));changed=true}
  if(!actions.querySelector('[data-rc1063-download-blob]')){actions.appendChild(actionButton('download',index,tr('documentViewer.download')));changed=true}
 });
 for(var i=rows.length;i<list.length;i++){
  var d=list[i];if(!sourceAvailable(d))continue;
  panel.appendChild(createRow(d,i));changed=true
 }
 return changed
}
function emitAction(d,download){
 var detail={action:download?'download':'open',document:typeOf(d),fileName:nameOf(d)};
 try{if(typeof w.CustomEvent==='function'&&typeof w.dispatchEvent==='function'){w.dispatchEvent(new w.CustomEvent('exporthub:document-action',{detail:detail}));return}}catch(_){}
 try{if(w.document&&typeof w.document.createEvent==='function'&&typeof w.dispatchEvent==='function'){var ev=w.document.createEvent('CustomEvent');ev.initCustomEvent('exporthub:document-action',false,false,detail);w.dispatchEvent(ev)}}catch(_){}
}
async function openBlob(index,download){
 var d=docs()[Number(index)],h=helper(),f=fileOf(d);
 if(!d||!h||typeof h.open!=='function'||!sourceAvailable(d))throw new Error(tr('documentViewer.unavailable'));
 var result=await h.open(f,{name:nameOf(d),download:download===true});
 emitAction(d,download===true);return result
}
function reportError(e){try{w.alert(tr('documentViewer.openFailed')+'\n\n'+q(e&&e.message||e))}catch(_){}}
var panelObserver=null,observedPanel=null,probeTimer=0;
function stopViewerProbe(){
 if(!probeTimer)return;
 try{if(typeof w.clearInterval==='function')w.clearInterval(probeTimer)}catch(_){}
 probeTimer=0
}
function disconnectPanelObserver(){
 if(panelObserver){try{panelObserver.disconnect()}catch(_){}}
 panelObserver=null;observedPanel=null
}
function bindViewerPanel(){
 if(!w.document)return false;
 var panel=w.document.getElementById('rc786ReferenceFilesPanel');
 if(!panel){if(observedPanel&&observedPanel.isConnected===false)disconnectPanelObserver();return false}
 if(observedPanel!==panel){
  disconnectPanelObserver();observedPanel=panel;
  if(typeof w.MutationObserver==='function'){
   panelObserver=new w.MutationObserver(function(){patchRows()});
   try{panelObserver.observe(panel,{childList:true,subtree:true})}catch(_){panelObserver=null}
  }
 }
 patchRows();stopViewerProbe();return true
}
function startViewerProbe(){
 if(bindViewerPanel())return true;
 if(probeTimer||typeof w.setInterval!=='function')return false;
 var tries=0;
 probeTimer=w.setInterval(function(){tries++;if(bindViewerPanel()||tries>=8)stopViewerProbe()},500);
 return false
}
function scheduleViewerRefresh(allowProbe){
 var run=function(){if(!bindViewerPanel()&&allowProbe!==false)startViewerProbe()};
 if(typeof w.setTimeout==='function')w.setTimeout(run,0);else run()
}
if(w.document){
 w.document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('[data-rc1063-open-blob],[data-rc1063-download-blob]');if(!t)return;
  e.preventDefault();e.stopPropagation();if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
  var open=t.getAttribute('data-rc1063-open-blob'),down=t.getAttribute('data-rc1063-download-blob');
  openBlob(open!=null?open:down,down!=null).catch(reportError);
 },true);
 ['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed'].forEach(function(name){
  try{w.addEventListener(name,function(){scheduleViewerRefresh(true)})}catch(_){}
 });
 try{w.addEventListener('exporthub:sync',function(){scheduleViewerRefresh(false)})}catch(_){}
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',function(){startViewerProbe()},{once:true});else startViewerProbe();
}
w.ExportHUBRC1063AbdBlobCompat={version:'RC1248',patch:patchRows,isBlob:isBlob,open:openBlob,documents:docs};
w.ExportHUBDocumentActions1151={version:'RC1248',patch:patchRows,documents:docs,open:openBlob};
})(window);
