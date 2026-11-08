(function(w,d){
'use strict';
if(w.__EXPORTHUB_RC1860_SHIPMENT_DOCUMENTATION__)return;
w.__EXPORTHUB_RC1860_SHIPMENT_DOCUMENTATION__=true;
var activeRef='',activeCard=null,activeRecord=null,loadSerial=0,scheduled=false,busy=false;
function q(v){return String(v==null?'':v).trim()}
function locale(){var code='de';try{code=q(w.ExportHUBI18n&&w.ExportHUBI18n.language&&w.ExportHUBI18n.language()).slice(0,2).toLowerCase()||'de'}catch(_){}return{de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'}[code]||'de-DE'}
function tr(key){
 var available=w.ExportHUBShipmentDocumentationI18n&&w.ExportHUBShipmentDocumentationI18n.packs||{},language='de';
 try{var a=w.ExportHUBI18n;if(a&&typeof a.language==='function')language=q(a.language()).toLowerCase().slice(0,2)}catch(_){}
 return (available[language]&&available[language][key])||(available.de&&available.de[key])||key;
}
function el(tag,klass,value){var x=d.createElement(tag);if(klass)x.className=klass;if(value!=null)x.textContent=value;return x}
function sh(){
 var state={};
 try{state=typeof w.__EXPORTHUB_GET_STATE__==='function'?w.__EXPORTHUB_GET_STATE__()||{}:w.ExportHUBClean&&w.ExportHUBClean.state||{}}catch(_){}
 var view=q(state.view||state.currentView).toLowerCase();
 if(view&&view!=='shipmentview')return null;
 var wanted=q(state.shipmentViewId||state.selectedShipmentId||state.activeShipmentId).toUpperCase();
 var rows=[].concat(Array.isArray(state.shipments)?state.shipments:[],Array.isArray(state.savedShipments)?state.savedShipments:[]);
 if(wanted){
  var match=rows.find(function(v){return q(v&&(v.id||v.shipmentId)).toUpperCase()===wanted})||
   rows.find(function(v){return refOf(v)===wanted});
  // If a shipment is selected but its data is not ready, do not use a stale
  // global shipment reference from the previous customer.
  return match||null;
 }
 var current=w.__EXPORTHUB_RC776_VIEW_SHIPMENT__||state.shipment||state.currentShipment||null;
 return current&&typeof current==='object'?current:null;
}
function refOf(v){return q(v&&(v.ref||v.reference||v.shipmentRef)).toUpperCase()}
function isCurrent(box,ref){return activeRef===ref&&activeCard===box&&!!box&&box.isConnected&&refOf(sh())===ref}
function safeCustomer(v){var c=v&&(v.customerName||v.customerDisplayName||v.customer||v.customerId);return q(c&&typeof c==='object'?(c.name||c.companyName||c.displayName||c.account||''):c)}
function filenameForProof(f,type,index){var original=q(f.name),ext=(original.match(/\.[^.]+$/)||[''])[0],base=original.slice(0,Math.max(0,original.length-ext.length)).slice(0,85);var uniq=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,11)+'_'+index;return(type==='photo'?'Versandfoto_':'')+base+'__'+uniq+ext;}
function headers(){var r=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},token=q(r.authToken),h={'Content-Type':'application/json','Accept':'application/json'};if(token){h.Authorization='Bearer '+token;h['X-ExportHUB-Token']=token;h['X-ExportHUB-Session']=token}return h}
async function api(method,ref,payload){
 var path='/api/shipment-documentation'+(method==='GET'?'?reference='+encodeURIComponent(ref):'');
 var r=await fetch(path,{method:method,credentials:'same-origin',cache:'no-store',headers:headers(),body:method==='POST'?JSON.stringify(Object.assign({reference:ref},payload)):undefined}),data={};
 try{data=await r.json()}catch(_){}
 if(!r.ok||data.ok===false)throw new Error(q(data.message)||'HTTP '+r.status);
 return data;
}
function styles(){
 if(d.getElementById('eh1860-style'))return;
 var s=el('style');s.id='eh1860-style';s.textContent=
 '.eh1860{margin:14px 0;padding:18px!important;border:1px solid var(--border,#dbe2ea)!important;border-radius:16px;background:var(--card,#fff);color:inherit;box-shadow:0 4px 18px rgba(0,0,0,.04)}'+
 '.eh1860 h3,.eh1860 h4{margin:0}.eh1860-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}.eh1860-head p{font-size:13px;opacity:.75;margin:5px 0 0}.eh1860-badge{font-size:12px;font-weight:700;max-width:100%;overflow-wrap:anywhere}'+
 '.eh1860-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.eh1860 label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;min-width:0}.eh1860 input:not([type=file]),.eh1860 textarea,.eh1860 select{width:100%;min-width:0;min-height:40px;border:1px solid #aab7c8;border-radius:9px;padding:9px;font:inherit;color:#172536;background:#fff}.eh1860 textarea{min-height:78px;resize:vertical}.eh1860 .wide{grid-column:1/-1}.eh1860 input[readonly]{background:#edf2f7;color:#344054}'+
 '.eh1860-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-top:12px}.eh1860 button{cursor:pointer;padding:9px 14px;border-radius:9px;border:1px solid #9baec6;background:#f4f7fa;color:#123254;font-weight:700}.eh1860 button.primary{background:#1564ac;color:#fff;border-color:#1564ac}.eh1860 button:disabled{opacity:.5;cursor:not-allowed}'+
 '.eh1860-preview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,190px));gap:13px;margin:12px 0}.eh1860-preview-card{min-width:0;padding:9px;border:1px solid #cad6e5;border-radius:12px;background:var(--card,#fff);display:flex;flex-direction:column;gap:8px}.eh1860-preview-open{padding:0!important;width:100%;border:0!important;background:transparent!important;text-align:left}.eh1860-preview-frame{display:flex;height:126px;align-items:center;justify-content:center;overflow:hidden;border-radius:8px;background:#eae7d1;color:#334155;font-size:13px}.eh1860-preview-frame img{width:100%;height:100%;object-fit:cover;display:block}.eh1860-preview-name{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}.eh1860-preview-card>.eh1860-download{width:100%;margin-top:auto}.eh1860-preview-group{margin:15px 0}.eh1860-preview-group>h5{font-size:14px;margin:4px 0 8px}.eh1860-preview-dialog{position:fixed;inset:0;z-index:2147482000;background:rgba(10,22,37,.76);display:flex;align-items:center;justify-content:center;padding:18px}.eh1860-preview-dialog-inner{background:var(--card,#fff);color:var(--text,#152b44);width:min(960px,96vw);max-height:96vh;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 24px 70px #0005}.eh1860-preview-dialog-inner h3{overflow-wrap:anywhere;font-size:15px}.eh1860-preview-media{width:100%;height:min(72vh,740px);object-fit:contain;border:0}.eh1860-preview-dialog-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}.eh1860 button:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}'+
 '.eh1860-status{margin:8px 0 0;font-size:13px;overflow-wrap:anywhere}.eh1860-status[data-kind=error]{color:#b42318}.eh1860-status[data-kind=ok]{color:#027a48}.eh1860-block{margin-top:16px;border-top:1px solid #dce3ec;padding-top:14px}.eh1860-upload-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.eh1860-file{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 0;font-size:12px}.eh1860-file span{flex:1;overflow-wrap:anywhere}.eh1860-file button{padding:6px 10px}.eh1860-list{list-style:none;padding:0;margin:8px 0;display:grid;gap:8px}.eh1860-complaint{padding:10px;border:1px solid #d6dfe8;border-radius:9px;font-size:13px;display:grid;gap:5px}.eh1860-complaint small{opacity:.75}.eh1860-complaint p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.eh1860-complaint select{max-width:190px}'+
 '@media(max-width:900px){.eh1860-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.eh1860-grid,.eh1860-upload-grid{grid-template-columns:1fr}.eh1860{padding:12px!important}}@media print{.eh1860{break-inside:avoid}.eh1860-actions,.eh1860 input[type=file]{display:none!important}}';
 (d.head||d.documentElement).appendChild(s);
}
function addField(grid,key,label,type,wide){
 var labelEl=el('label',wide?'wide':'',label),input=el(type==='textarea'?'textarea':'input');
 if(type!=='textarea')input.type=type||'text';
 input.setAttribute('data-proof-field',key);
 var limits={shipmentNumber:100,customer:200,packaging:400,shippingMethod:80,carrier:160,trackingNumber:160,contents:3000,loadSecuring:1500,remarks:2000,complaintText:2000};
 if(limits[key])input.maxLength=limits[key];
 if(key==='reference')input.readOnly=true;
 if(key==='colli'){input.min='0';input.max='100000';input.step='1'}
 if(key==='weightKg'){input.min='0';input.max='100000000';input.step='0.001'}
 labelEl.appendChild(input);grid.appendChild(labelEl);return input;
}
function build(ref){
 styles();
 var box=el('section','card eh1860');box.setAttribute('data-shipment-documentation',ref);
 var head=el('div','eh1860-head'),intro=el('div'),h=el('h3',null,tr('title')),sub=el('p',null,tr('subtitle'));
 intro.appendChild(h);intro.appendChild(sub);head.appendChild(intro);
 var badge=el('span','eh1860-badge',tr('notSaved'));badge.setAttribute('data-proof-badge','1');head.appendChild(badge);box.appendChild(head);
 var grid=el('div','eh1860-grid');
 [
  ['reference',tr('reference'),'text'],['shipmentNumber',tr('shipmentNumber'),'text'],['customer',tr('customer'),'text'],
  ['dispatchDate',tr('dispatchDate'),'date'],['colli',tr('colliCount'),'number'],['weightKg',tr('weightKg'),'number'],
  ['packaging',tr('packaging'),'text'],['shippingMethod',tr('shippingMethod'),'text'],['carrier',tr('carrier'),'text'],
  ['trackingNumber',tr('tracking'),'text'],
  ['contents',tr('contents'),'textarea',true],
  ['loadSecuring',tr('securing'),'textarea',true],
  ['remarks',tr('remarks'),'textarea',true]
 ].forEach(function(f){addField(grid,f[0],f[1],f[2],!!f[3])});
 box.appendChild(grid);
 var action=el('div','eh1860-actions'),save=el('button','primary',tr('save'));save.type='button';save.setAttribute('data-proof-save','1');action.appendChild(save);
 var reload=el('button',null,tr('reload'));reload.type='button';reload.setAttribute('data-proof-reload','1');action.appendChild(reload);box.appendChild(action);
 var status=el('p','eh1860-status','');status.setAttribute('data-proof-status','1');status.setAttribute('aria-live','polite');box.appendChild(status);
 var filesBlock=el('div','eh1860-block'),filesHeading=el('h4',null,tr('filesTitle'));filesBlock.appendChild(filesHeading);
 filesBlock.appendChild(el('p','eh1860-status',tr('filesHint')));
 var upGrid=el('div','eh1860-upload-grid');
 [['photo',tr('photosPicker'),'image/jpeg,image/png'],['note',tr('notesPicker'),'application/pdf,image/jpeg,image/png']].forEach(function(item){
  var label=el('label',null,item[1]),input=el('input');
  input.type='file';input.multiple=true;input.accept=item[2];input.setAttribute('data-proof-upload',item[0]);label.appendChild(input);upGrid.appendChild(label);
 });
 filesBlock.appendChild(upGrid);
 var fileNote=el('p','eh1860-status','');fileNote.setAttribute('data-proof-file-status','1');fileNote.setAttribute('aria-live','polite');filesBlock.appendChild(fileNote);
 var fileList=el('div');fileList.setAttribute('data-proof-files','1');filesBlock.appendChild(fileList);box.appendChild(filesBlock);
 var complaintBlock=el('div','eh1860-block');complaintBlock.appendChild(el('h4',null,tr('complaintsTitle')));
 complaintBlock.appendChild(el('p','eh1860-status',tr('complaintsHint')));
 var complaintGrid=el('div','eh1860-grid');
 var cDate=addField(complaintGrid,'complaintDate',tr('complaintDate'),'date'),cText=addField(complaintGrid,'complaintText',tr('complaintText'),'textarea',true);
 cDate.setAttribute('data-proof-complaint-date','1');cText.setAttribute('data-proof-complaint-text','1');
 complaintBlock.appendChild(complaintGrid);
 var complaintActions=el('div','eh1860-actions'),add=el('button',null,tr('addComplaint'));add.type='button';add.setAttribute('data-proof-add-complaint','1');complaintActions.appendChild(add);complaintBlock.appendChild(complaintActions);
 var complaints=el('div','eh1860-list');complaints.setAttribute('data-proof-complaints','1');complaintBlock.appendChild(complaints);
 box.appendChild(complaintBlock);
 save.addEventListener('click',function(){saveRecord(box,ref)});
 reload.addEventListener('click',function(){load(box,ref)});
 add.addEventListener('click',function(){addComplaint(box,ref)});
 box.querySelectorAll('[data-proof-upload]').forEach(function(input){input.addEventListener('change',function(){uploadFiles(box,ref,input,input.getAttribute('data-proof-upload'))})});
 return box;
}
function status(box,msg,kind,files){
 var p=box&&box.querySelector(files?'[data-proof-file-status]':'[data-proof-status]');if(!p)return;
 p.textContent=msg;p.setAttribute('data-kind',kind||'');
}
function snapshot(shipment,ref){
 var rows=Array.isArray(shipment&&shipment.rows)?shipment.rows:[],
 count=rows.reduce(function(total,r){return total+(Number(r.count||r.qty||r.quantity)||0)},0);
 var weight=Number(shipment&&(shipment.totalWeight||shipment.grossWeight||shipment.weightKg||shipment.weight))||0;
 if(!weight&&rows.length)weight=rows.reduce(function(total,r){return total+(Number(r.weight||r.grossWeight)||0)},0);
 return{reference:ref,shipmentNumber:q(shipment&&(shipment.shipmentNumber||shipment.carrierShipmentNumber||shipment.consignmentNumber)),
 customer:safeCustomer(shipment),
 dispatchDate:'',colli:count?String(count):'',weightKg:weight?String(weight):'',
 packaging:rows.map(function(r){return q(r.type||r.packaging)}).filter(Boolean).filter(function(s,i,a){return a.indexOf(s)===i}).join(', '),
 shippingMethod:q(shipment&&(shipment.shippingMethod||shipment.transportMode||shipment.serviceName)),
 carrier:q(shipment&&(shipment.carrier||shipment.carrierName||shipment.forwarder)),
 trackingNumber:q(shipment&&(shipment.trackingNumber||shipment.waybillNumber)),
 contents:'',loadSecuring:'',remarks:''};
}
function fill(box,fields){
 var f=Object.assign({},snapshot(sh(),activeRef),fields||{});
 box.querySelectorAll('[data-proof-field]').forEach(function(input){var key=input.getAttribute('data-proof-field');if(key==='reference')input.value=activeRef;else if(key!=='complaintDate'&&key!=='complaintText')input.value=f[key]==null?'':String(f[key])});
 var date=box.querySelector('[data-proof-complaint-date]');if(date&&!date.value)date.value=new Date().toISOString().slice(0,10);
}
function values(box){
 var out={};
 box.querySelectorAll('[data-proof-field]').forEach(function(input){var key=input.getAttribute('data-proof-field');if(key!=='reference'&&key!=='complaintDate'&&key!=='complaintText')out[key]=q(input.value)});
 return out;
}
function setBusy(box,on){if(activeCard!==box)return;busy=!!on;box.querySelectorAll('button,input[type=file]').forEach(function(btn){btn.disabled=!!on})}
function annotate(box){
 var badge=box.querySelector('[data-proof-badge]');if(!badge)return;
 if(!activeRecord||!activeRecord.revision){badge.textContent=tr('notSaved');return}
 badge.textContent=tr('savedVersion')+activeRecord.revision+' · '+(activeRecord.updatedAt?new Date(activeRecord.updatedAt).toLocaleString(locale()):'');
}
async function load(box,ref){
 var serial=++loadSerial;status(box,tr('loading'));
 try{
  var data=await api('GET',ref);
  if(serial!==loadSerial||activeRef!==ref||!box.isConnected)return;
  activeRecord=data.record||null;
  fill(box,activeRecord&&activeRecord.fields);annotate(box);renderComplaints(box,ref);
  status(box,activeRecord&&activeRecord.revision?tr('loaded'):tr('newRecord'),'ok');
  loadFiles(box,ref);
 }catch(e){if(serial===loadSerial&&activeRef===ref&&box.isConnected)status(box,q(e.message),'error')}
}
async function saveRecord(box,ref){
 if(busy||!isCurrent(box,ref))return;
 var fields=values(box),expectedRevision=activeRecord?activeRecord.revision:0;
 setBusy(box,true);status(box,tr('saving'));
 try{
  var d=await api('POST',ref,{action:'save',expectedRevision:expectedRevision,fields:fields});
  if(!isCurrent(box,ref))return;
  activeRecord=d.record;annotate(box);renderComplaints(box,ref);status(box,tr('saved'),'ok');
 }catch(e){status(box,q(e.message),'error')}finally{setBusy(box,false)}
}
function renderComplaints(box,ref){
 var list=box.querySelector('[data-proof-complaints]');if(!list)return;list.textContent='';
 var complaints=activeRecord&&Array.isArray(activeRecord.complaints)?activeRecord.complaints:[];
 if(!complaints.length){list.appendChild(el('p','eh1860-status',tr('noComplaints')));return}
 complaints.slice().reverse().forEach(function(c){
  var item=el('div','eh1860-complaint'),header=el('strong',null,tr('complaintItem')+q(c.reportedDate||c.date).slice(0,10));
  item.appendChild(header);item.appendChild(el('p',null,q(c.text)));
  item.appendChild(el('small',null,tr('createdBy')+q(c.createdBy)+' · '+new Date(c.date).toLocaleString(locale())));
  var states=el('select');
  [['offen',tr('open')],['in_pruefung',tr('inReview')],['abgeschlossen',tr('closed')]].forEach(function(k){var o=el('option');o.value=k[0];o.textContent=k[1];o.selected=k[0]===c.state;states.appendChild(o)});
  states.setAttribute('aria-label',tr('statusAria'));
  states.addEventListener('change',async function(){
   if(busy)return;setBusy(box,true);
   try{
    var d=await api('POST',ref,{action:'complaint-status',expectedRevision:activeRecord.revision,complaintId:c.id,state:states.value});
    if(!isCurrent(box,ref))return;
    activeRecord=d.record;annotate(box);renderComplaints(box,ref);status(box,tr('statusSaved'),'ok');
   }catch(e){status(box,q(e.message),'error');states.value=c.state}finally{setBusy(box,false)}
  });
  item.appendChild(states);list.appendChild(item);
 });
}
async function addComplaint(box,ref){
 if(busy)return;
 var textInput=box.querySelector('[data-proof-complaint-text]'),date=box.querySelector('[data-proof-complaint-date]');
 if(!activeRecord||!activeRecord.revision){status(box,tr('saveFirst'),'error');return}
 if(!q(textInput.value)){status(box,tr('enterComplaint'),'error');return}
 setBusy(box,true);
 try{
  var d=await api('POST',ref,{action:'complaint',expectedRevision:activeRecord.revision,text:textInput.value,reportedDate:date.value});
  if(!isCurrent(box,ref))return;
  activeRecord=d.record;textInput.value='';annotate(box);renderComplaints(box,ref);
  status(box,tr('complaintSaved'),'ok');
 }catch(e){status(box,q(e.message),'error')}finally{setBusy(box,false)}
}
async function uploadFiles(box,ref,input,type){
 if(busy||activeRef!==ref)return;
 var files=Array.from(input.files||[]);input.value='';if(!files.length)return;
 var runtime=w.ExportHUBShipmentDocUpload;
 if(!runtime||typeof runtime.upload!=='function'){status(box,tr('uploadUnavailable'),'error',true);return}
 setBusy(box,true);var ok=0,errors=[];
 for(var i=0;i<files.length;i++){
  if(!isCurrent(box,ref))break;
  var f=files[i],ext=q(f.name).toLowerCase();
  if(!(/\.(jpe?g|png)$/.test(ext))&&(type==='photo'||!(/\.pdf$/.test(ext)))){errors.push(f.name+tr('wrongType'));continue}
  if(f.size>15*1024*1024){errors.push(f.name+tr('max15'));continue}
  try{
   var prepared=new File([f],filenameForProof(f,type,i),{type:f.type});
   await runtime.upload(ref,prepared,type==='photo'?'sonstiges':'lieferschein');ok++;
   if(!isCurrent(box,ref))break;
  }catch(e){errors.push(f.name+': '+q(e.message))}
  status(box,tr('uploadedProgress')+ok+' / '+files.length+(errors.length?' · '+errors.join('; '):''),errors.length?'error':'ok',true);
 }
 setBusy(box,false);
 if(!isCurrent(box,ref))return;
 if(ok){status(box,ok+tr('filesSaved')+(errors.length?tr('failed')+errors.join('; '):''),errors.length?'error':'ok',true);
  try{w.dispatchEvent(new CustomEvent('exporthub:shipment-document-uploaded',{detail:{reference:ref,kind:type==='photo'?'versandfoto':'lieferschein',count:ok,referenceFolder:true}}))}catch(_){}
  if(w.ExportHUBShipmentView&&typeof w.ExportHUBShipmentView.refreshReferenceFiles==='function')w.ExportHUBShipmentView.refreshReferenceFiles();
  loadFiles(box,ref);
 }else status(box,tr('uploadNone')+errors.join('; '),'error',true);
}
// Gallery for the actual REF files and independently stored DOK evidence linked by exact REF.
var galleryGeneration=0,thumbnailUrls=[],closeGalleryDialog=null;
function clearGallery(){
 galleryGeneration++;
 if(closeGalleryDialog)closeGalleryDialog();
 thumbnailUrls.forEach(function(url){URL.revokeObjectURL(url)});thumbnailUrls=[];
}
function isPhoto(file){return /^image\/(?:jpeg|png)$/i.test(q(file.mimeType||file.mime))||/\.(?:jpe?g|png)$/i.test(q(file.name))}
function isPdf(file){return /^application\/pdf$/i.test(q(file.mimeType||file.mime))||/\.pdf$/i.test(q(file.name))}
function fileUrl(ref,file){
 if(file.source==='evidence')return '/api/shipment-evidence?'+new URLSearchParams({action:'file',id:file.recordId,fileId:file.id});
 return '/api/reference-files?'+new URLSearchParams({reference:ref,itemId:file.id});
}
async function secureBlob(ref,file){
 var response=await fetch(fileUrl(ref,file),{headers:headers(),credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw new Error('Datei konnte nicht geladen werden (HTTP '+response.status+').');
 return response.blob();
}
function saveBlob(blob,name){
 var url=URL.createObjectURL(blob),link=el('a');
 link.href=url;link.download=name||'Dokument';d.body.appendChild(link);link.click();link.remove();
 w.setTimeout(function(){URL.revokeObjectURL(url)},1000);
}
async function downloadFile(ref,file,box){
 try{var blob=await secureBlob(ref,file);if(!isCurrent(box,ref))return;saveBlob(blob,q(file.name));}
 catch(e){if(isCurrent(box,ref))status(box,q(e.message),'error',true)}
}
async function openFilePreview(ref,file,box){
 var generation=galleryGeneration,previous=d.activeElement;
 status(box,'Datei wird geöffnet …','',true);
 try{
  var blob=await secureBlob(ref,file);
  if(generation!==galleryGeneration||!isCurrent(box,ref))return;
  if(!isPhoto(file)&&!isPdf(file)){saveBlob(blob,q(file.name));return}
  if(closeGalleryDialog)closeGalleryDialog();
  var url=URL.createObjectURL(blob),overlay=el('div','eh1860-preview-dialog');
  overlay.setAttribute('role','presentation');
  var inner=el('div','eh1860-preview-dialog-inner');inner.setAttribute('role','dialog');inner.setAttribute('aria-modal','true');
  inner.setAttribute('aria-label','Dateivorschau: '+q(file.name));
  inner.appendChild(el('h3',null,q(file.name)));
  var media=el(isPhoto(file)?'img':'iframe','eh1860-preview-media');
  if(isPhoto(file))media.alt=q(file.name);else media.title=q(file.name);
  media.src=url;inner.appendChild(media);
  var actions=el('div','eh1860-preview-dialog-actions'),download=el('button',null,'Datei herunterladen'),closeButton=el('button',null,'Schließen');
  download.type='button';closeButton.type='button';actions.appendChild(download);actions.appendChild(closeButton);inner.appendChild(actions);overlay.appendChild(inner);d.body.appendChild(overlay);
  var closed=false;
  function close(){if(closed)return;closed=true;d.removeEventListener('keydown',onKey);overlay.remove();URL.revokeObjectURL(url);if(closeGalleryDialog===close)closeGalleryDialog=null;if(previous&&previous.isConnected)previous.focus();}
  function onKey(event){if(event.key==='Escape'){event.preventDefault();close()}if(event.key==='Tab'){var target=event.shiftKey?closeButton:download;if(event.shiftKey&&d.activeElement===download){event.preventDefault();closeButton.focus()}else if(!event.shiftKey&&d.activeElement===closeButton){event.preventDefault();download.focus()}}}
  closeGalleryDialog=close;
  d.addEventListener('keydown',onKey);
  closeButton.addEventListener('click',close);
  download.addEventListener('click',function(){saveBlob(blob,q(file.name))});
  overlay.addEventListener('click',function(event){if(event.target===overlay)close()});
  closeButton.focus();
  status(box,'','',true);
 }catch(e){if(isCurrent(box,ref))status(box,q(e.message),'error',true)}
}
function galleryCard(box,ref,file,generation){
 var card=el('div','eh1860-preview-card'),opener=el('button','eh1860-preview-open');
 opener.type='button';opener.setAttribute('aria-label','Vorschau: '+q(file.name));opener.addEventListener('click',function(){openFilePreview(ref,file,box)});
 var frame=el('div','eh1860-preview-frame'),name=el('span','eh1860-preview-name',q(file.name));
 name.title=q(file.name);
 if(isPhoto(file)){
  var img=el('img');img.alt=q(file.name);img.loading='lazy';img.decoding='async';
  frame.appendChild(img);
  function loadThumb(){
   if(generation!==galleryGeneration||!isCurrent(box,ref))return;
   secureBlob(ref,file).then(function(blob){
    if(generation!==galleryGeneration||!isCurrent(box,ref)||!img.isConnected)return;
    if(!/^image\/(?:jpeg|png)$/i.test(blob.type))return;
    var url=URL.createObjectURL(blob);thumbnailUrls.push(url);img.src=url;
   }).catch(function(){frame.textContent='Vorschau nicht verfügbar'});
  }
  if('IntersectionObserver' in w){var observer=new IntersectionObserver(function(entries){if(entries.some(function(entry){return entry.isIntersecting})){observer.disconnect();loadThumb()}},{rootMargin:'250px'});observer.observe(frame)}
  else loadThumb();
 }else frame.textContent=isPdf(file)?'PDF':'Dokument';
 opener.appendChild(frame);card.appendChild(opener);card.appendChild(name);
 var download=el('button','eh1860-download','Datei herunterladen');download.type='button';download.addEventListener('click',function(){downloadFile(ref,file,box)});card.appendChild(download);
 return card;
}
function appendGallery(host,title,box,ref,files,generation){
 if(!files.length)return;
 var section=el('div','eh1860-preview-group'),heading=el('h5',null,title),grid=el('div','eh1860-preview-grid');
 section.appendChild(heading);section.appendChild(grid);
 files.slice(0,60).forEach(function(file){grid.appendChild(galleryCard(box,ref,file,generation))});
 host.appendChild(section);
 if(files.length>60)host.appendChild(el('p','eh1860-status','Weitere Dateien vorhanden. Bitte direkt im REF-Ordner oder der Dokumentation öffnen.'));
}
async function loadFiles(box,ref){
 var host=box.querySelector('[data-proof-files]');if(!host)return;
 clearGallery();var generation=galleryGeneration;host.textContent='';
 try{
  var response=await fetch('/api/reference-files?reference='+encodeURIComponent(ref),{headers:headers(),credentials:'same-origin',cache:'no-store'});
  var data=await response.json();
  if(!response.ok||!data.ok)throw new Error(q(data.message)||tr('filesUnavailable'));
  if(!isCurrent(box,ref)||generation!==galleryGeneration)return;
  var photos=(data.files||[]).filter(function(f){return /^Dokument_[A-Z0-9]{6}_\d{8}-\d{6}_Versandfoto_/i.test(q(f.name))}).map(function(f){return Object.assign({source:'reference'},f)});
  var notes=(data.files||[]).filter(function(f){return /^Lieferschein_[A-Z0-9]{6}_\d{8}-\d{6}_/i.test(q(f.name))}).map(function(f){return Object.assign({source:'reference'},f)});
  appendGallery(host,'Fotos ('+photos.length+')',box,ref,photos,generation);
  appendGallery(host,'Lieferscheine ('+notes.length+')',box,ref,notes,generation);
 }catch(e){if(isCurrent(box,ref))host.appendChild(el('p','eh1860-status',tr('refListError')+q(e.message)))}
 if(!isCurrent(box,ref)||generation!==galleryGeneration)return;
 // The standalone DOK store is separate. Show only explicitly linked evidence.
 try{
  var response=await fetch('/api/shipment-evidence?'+new URLSearchParams({action:'for-reference',reference:ref}),{headers:headers(),credentials:'same-origin',cache:'no-store'});
  var data=await response.json();
  if(!response.ok||!data.ok)throw new Error(q(data.message)||'HTTP '+response.status);
  if(!isCurrent(box,ref)||generation!==galleryGeneration)return;
  var photos=[],notes=[];
  (data.records||[]).forEach(function(record){(record.files||[]).forEach(function(file){
   var entry=Object.assign({source:'evidence',recordId:record.id},file);
   if(isPhoto(entry))photos.push(entry);else notes.push(entry);
  })});
  appendGallery(host,'Verknüpfte Dokumentation · Fotos ('+photos.length+')',box,ref,photos,generation);
  appendGallery(host,'Verknüpfte Dokumentation · Dateien ('+notes.length+')',box,ref,notes,generation);
  if(data.incomplete)host.appendChild(el('p','eh1860-status','Die Suche war nicht vollständig. Weitere Dokumentationen können vorhanden sein.'));
 }catch(e){if(isCurrent(box,ref))host.appendChild(el('p','eh1860-status','Verknüpfte DOK-Nachweise konnten nicht geladen werden: '+q(e.message)))}
 if(!host.childElementCount)host.appendChild(el('p','eh1860-status','Noch keine Fotos oder Lieferscheine zu dieser Referenz gespeichert.'));
}
function ensure(){
 scheduled=false;
 var host=d.getElementById('rc786ReferenceFilesCard'),shipment=sh(),ref=refOf(shipment);
 if(!host||!/^[A-Z0-9]{6}$/.test(ref)){if(activeCard&&activeCard.isConnected)activeCard.remove();activeCard=null;activeRef='';return}
 if(activeRef===ref&&activeCard&&activeCard.isConnected&&activeCard.previousElementSibling===host)return;
 if(activeCard&&activeCard.isConnected)activeCard.remove();
 activeRef=ref;activeRecord=null;busy=false;
 activeCard=build(ref);
 host.insertAdjacentElement('afterend',activeCard);
 fill(activeCard,snapshot(shipment,ref));
 load(activeCard,ref);
}
function schedule(){if(scheduled)return;scheduled=true;setTimeout(ensure,100)}
function start(){
 ensure();
 if(w.MutationObserver)new MutationObserver(schedule).observe(d.body,{childList:true,subtree:true});
 w.addEventListener('exporthub:shipment-saved',schedule);
 w.addEventListener('exporthub:shipment-document-uploaded',schedule);
}
if(d.body)start();else d.addEventListener('DOMContentLoaded',start);
w.ExportHUBShipmentDocumentation=Object.freeze({version:'RC1860',refresh:schedule});
})(window,document);
