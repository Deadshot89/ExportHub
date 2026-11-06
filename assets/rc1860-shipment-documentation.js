(function(w,d){
'use strict';
if(w.__EXPORTHUB_RC1860_SHIPMENT_DOCUMENTATION__)return;
w.__EXPORTHUB_RC1860_SHIPMENT_DOCUMENTATION__=true;
var activeRef='',activeCard=null,activeRecord=null,loadSerial=0,scheduled=false,busy=false;
function q(v){return String(v==null?'':v).trim()}
function el(tag,klass,value){var x=d.createElement(tag);if(klass)x.className=klass;if(value!=null)x.textContent=value;return x}
function sh(){var s=w.__EXPORTHUB_RC776_VIEW_SHIPMENT__;return s&&typeof s==='object'?s:null}
function refOf(v){return q(v&&(v.ref||v.reference||v.shipmentRef)).toUpperCase()}
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
 '.eh1860-status{margin:8px 0 0;font-size:13px;overflow-wrap:anywhere}.eh1860-status[data-kind=error]{color:#b42318}.eh1860-status[data-kind=ok]{color:#027a48}.eh1860-block{margin-top:16px;border-top:1px solid #dce3ec;padding-top:14px}.eh1860-upload-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.eh1860-file{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:5px 0;font-size:12px}.eh1860-file span{flex:1;overflow-wrap:anywhere}.eh1860-file button{padding:6px 10px}.eh1860-list{list-style:none;padding:0;margin:8px 0;display:grid;gap:8px}.eh1860-complaint{padding:10px;border:1px solid #d6dfe8;border-radius:9px;font-size:13px;display:grid;gap:5px}.eh1860-complaint small{opacity:.75}.eh1860-complaint p{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.eh1860-complaint select{max-width:190px}'+
 '@media(max-width:900px){.eh1860-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.eh1860-grid,.eh1860-upload-grid{grid-template-columns:1fr}.eh1860{padding:12px!important}}@media print{.eh1860{break-inside:avoid}.eh1860-actions,.eh1860 input[type=file]{display:none!important}}';
 (d.head||d.documentElement).appendChild(s);
}
function addField(grid,key,label,type,wide){
 var labelEl=el('label',wide?'wide':'',label),input=el(type==='textarea'?'textarea':'input');
 if(type!=='textarea')input.type=type||'text';
 input.setAttribute('data-proof-field',key);
 if(key==='reference')input.readOnly=true;
 if(key==='colli'){input.min='0';input.max='100000';input.step='1'}
 if(key==='weightKg'){input.min='0';input.max='100000000';input.step='0.001'}
 labelEl.appendChild(input);grid.appendChild(labelEl);return input;
}
function build(ref){
 styles();
 var box=el('section','card eh1860');box.setAttribute('data-shipment-documentation',ref);
 var head=el('div','eh1860-head'),intro=el('div'),h=el('h3',null,'Sendungsdokumentation'),sub=el('p',null,'Versandnachweis mit Fotos, Lieferscheinen und Kundenbeschwerden');
 intro.appendChild(h);intro.appendChild(sub);head.appendChild(intro);
 var badge=el('span','eh1860-badge','Noch nicht gespeichert');badge.setAttribute('data-proof-badge','1');head.appendChild(badge);box.appendChild(head);
 var grid=el('div','eh1860-grid');
 [
  ['reference','Sendungsreferenz','text'],['shipmentNumber','Sendungsnummer / Tracking','text'],['customer','Kunde','text'],
  ['dispatchDate','Versanddatum','date'],['colli','Colli-Anzahl','number'],['weightKg','Gesamtgewicht (kg)','number'],
  ['packaging','Verpackungsart (Palette, Karton, …)','text'],['shippingMethod','Versandart (LKW, Paketdienst, …)','text'],['carrier','Spedition / Versanddienst','text'],
  ['trackingNumber','Frachtbrief- / Sendungsverfolgungsnummer','text'],
  ['contents','Was wurde verschickt? / Inhalt','textarea',true],
  ['loadSecuring','Wie wurde verpackt und gesichert?','textarea',true],
  ['remarks','Besonderheiten / interne Bemerkungen','textarea',true]
 ].forEach(function(f){addField(grid,f[0],f[1],f[2],!!f[3])});
 box.appendChild(grid);
 var action=el('div','eh1860-actions'),save=el('button','primary','Versanddokumentation speichern');save.type='button';save.setAttribute('data-proof-save','1');action.appendChild(save);
 var reload=el('button',null,'Neu laden');reload.type='button';reload.setAttribute('data-proof-reload','1');action.appendChild(reload);box.appendChild(action);
 var status=el('p','eh1860-status','');status.setAttribute('data-proof-status','1');status.setAttribute('aria-live','polite');box.appendChild(status);
 var filesBlock=el('div','eh1860-block'),filesHeading=el('h4',null,'Fotos und Lieferscheine');filesBlock.appendChild(filesHeading);
 filesBlock.appendChild(el('p','eh1860-status','Dateien werden nach dem Upload automatisch mit Sendungsreferenz und Zeitstempel im REF-Ordner gespeichert.'));
 var upGrid=el('div','eh1860-upload-grid');
 [['photo','Versandfotos aufnehmen oder auswählen','image/jpeg,image/png'],['note','Lieferscheine auswählen','application/pdf,image/jpeg,image/png']].forEach(function(item){
  var label=el('label',null,item[1]),input=el('input');
  input.type='file';input.multiple=true;input.accept=item[2];input.setAttribute('data-proof-upload',item[0]);label.appendChild(input);upGrid.appendChild(label);
 });
 filesBlock.appendChild(upGrid);
 var fileNote=el('p','eh1860-status','');fileNote.setAttribute('data-proof-file-status','1');fileNote.setAttribute('aria-live','polite');filesBlock.appendChild(fileNote);
 var fileList=el('div');fileList.setAttribute('data-proof-files','1');filesBlock.appendChild(fileList);box.appendChild(filesBlock);
 var complaintBlock=el('div','eh1860-block');complaintBlock.appendChild(el('h4',null,'Kundenbeschwerden'));
 complaintBlock.appendChild(el('p','eh1860-status','Beschwerden bleiben mit Bearbeiter, Datum und Status nachvollziehbar.'));
 var complaintGrid=el('div','eh1860-grid');
 var cDate=addField(complaintGrid,'complaintDate','Beschwerdedatum','date'),cText=addField(complaintGrid,'complaintText','Beschwerde des Kunden','textarea',true);
 cDate.setAttribute('data-proof-complaint-date','1');cText.setAttribute('data-proof-complaint-text','1');
 complaintBlock.appendChild(complaintGrid);
 var complaintActions=el('div','eh1860-actions'),add=el('button',null,'Beschwerde hinzufügen');add.type='button';add.setAttribute('data-proof-add-complaint','1');complaintActions.appendChild(add);complaintBlock.appendChild(complaintActions);
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
 customer:q(shipment&&(shipment.customerName||shipment.customer||shipment.customerDisplayName||shipment.customerId)),
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
function setBusy(box,on){busy=!!on;box.querySelectorAll('button,input[type=file]').forEach(function(btn){btn.disabled=!!on})}
function annotate(box){
 var badge=box.querySelector('[data-proof-badge]');if(!badge)return;
 if(!activeRecord||!activeRecord.revision){badge.textContent='Noch nicht gespeichert';return}
 badge.textContent='Gespeichert · Version '+activeRecord.revision+' · '+(activeRecord.updatedAt?new Date(activeRecord.updatedAt).toLocaleString('de-DE'):'');
}
async function load(box,ref){
 var serial=++loadSerial;status(box,'Lade Versanddokumentation …');
 try{
  var data=await api('GET',ref);
  if(serial!==loadSerial||activeRef!==ref||!box.isConnected)return;
  activeRecord=data.record||null;
  fill(box,activeRecord&&activeRecord.fields);annotate(box);renderComplaints(box,ref);
  status(box,activeRecord&&activeRecord.revision?'Dokumentation geladen.':'Neue Dokumentation – bitte Angaben prüfen und speichern.','ok');
  loadFiles(box,ref);
 }catch(e){if(serial===loadSerial&&activeRef===ref&&box.isConnected)status(box,q(e.message),'error')}
}
async function saveRecord(box,ref){
 if(busy||activeRef!==ref)return;
 var fields=values(box),expectedRevision=activeRecord?activeRecord.revision:0;
 setBusy(box,true);status(box,'Speichere Versandnachweis …');
 try{
  var d=await api('POST',ref,{action:'save',expectedRevision:expectedRevision,fields:fields});
  activeRecord=d.record;annotate(box);renderComplaints(box,ref);status(box,'Versandnachweis ist dauerhaft gespeichert.','ok');
 }catch(e){status(box,q(e.message),'error')}finally{setBusy(box,false)}
}
function renderComplaints(box,ref){
 var list=box.querySelector('[data-proof-complaints]');if(!list)return;list.textContent='';
 var complaints=activeRecord&&Array.isArray(activeRecord.complaints)?activeRecord.complaints:[];
 if(!complaints.length){list.appendChild(el('p','eh1860-status','Noch keine Kundenbeschwerden erfasst.'));return}
 complaints.slice().reverse().forEach(function(c){
  var item=el('div','eh1860-complaint'),header=el('strong',null,'Beschwerde · '+q(c.reportedDate||c.date).slice(0,10));
  item.appendChild(header);item.appendChild(el('p',null,q(c.text)));
  item.appendChild(el('small',null,'Erfasst von '+q(c.createdBy)+' · '+new Date(c.date).toLocaleString('de-DE')));
  var states=el('select');
  [['offen','Offen'],['in_pruefung','In Prüfung'],['abgeschlossen','Abgeschlossen']].forEach(function(k){var o=el('option');o.value=k[0];o.textContent=k[1];o.selected=k[0]===c.state;states.appendChild(o)});
  states.setAttribute('aria-label','Beschwerdestatus');
  states.addEventListener('change',async function(){
   if(busy)return;setBusy(box,true);
   try{
    var d=await api('POST',ref,{action:'complaint-status',expectedRevision:activeRecord.revision,complaintId:c.id,state:states.value});
    activeRecord=d.record;annotate(box);renderComplaints(box,ref);status(box,'Beschwerdestatus gespeichert.','ok');
   }catch(e){status(box,q(e.message),'error');states.value=c.state}finally{setBusy(box,false)}
  });
  item.appendChild(states);list.appendChild(item);
 });
}
async function addComplaint(box,ref){
 if(busy)return;
 var textInput=box.querySelector('[data-proof-complaint-text]'),date=box.querySelector('[data-proof-complaint-date]');
 if(!activeRecord||!activeRecord.revision){status(box,'Zuerst Versandnachweis speichern.','error');return}
 if(!q(textInput.value)){status(box,'Bitte Kundenbeschwerde eintragen.','error');return}
 setBusy(box,true);
 try{
  var d=await api('POST',ref,{action:'complaint',expectedRevision:activeRecord.revision,text:textInput.value,reportedDate:date.value});
  activeRecord=d.record;textInput.value='';annotate(box);renderComplaints(box,ref);
  status(box,'Kundenbeschwerde ist dauerhaft dokumentiert.','ok');
 }catch(e){status(box,q(e.message),'error')}finally{setBusy(box,false)}
}
async function uploadFiles(box,ref,input,type){
 if(busy||activeRef!==ref)return;
 var files=Array.from(input.files||[]);input.value='';if(!files.length)return;
 var runtime=w.ExportHUBShipmentDocUpload;
 if(!runtime||typeof runtime.upload!=='function'){status(box,'Dokument-Upload derzeit nicht verfügbar.','error',true);return}
 setBusy(box,true);var ok=0,errors=[];
 for(var i=0;i<files.length;i++){
  var f=files[i],ext=q(f.name).toLowerCase();
  if(!(/\.(jpe?g|png)$/.test(ext))&&(type==='photo'||!(/\.pdf$/.test(ext)))){errors.push(f.name+': Dateityp nicht erlaubt');continue}
  if(f.size>15*1024*1024){errors.push(f.name+': über 15 MB');continue}
  try{
   var prepared=type==='photo'?new File([f],'Versandfoto_'+f.name,{type:f.type}):f;
   await runtime.upload(ref,prepared,type==='photo'?'sonstiges':'lieferschein');ok++;
  }catch(e){errors.push(f.name+': '+q(e.message))}
  status(box,'Dateien hochgeladen: '+ok+' / '+files.length+(errors.length?' · '+errors.join('; '):''),errors.length?'error':'ok',true);
 }
 setBusy(box,false);
 if(ok){status(box,ok+' Datei(en) im REF-Ordner gespeichert.'+(errors.length?' Fehlgeschlagen: '+errors.join('; '):''),errors.length?'error':'ok',true);
  try{w.dispatchEvent(new CustomEvent('exporthub:shipment-document-uploaded',{detail:{reference:ref,kind:type==='photo'?'versandfoto':'lieferschein',count:ok,referenceFolder:true}}))}catch(_){}
  if(w.ExportHUBShipmentView&&typeof w.ExportHUBShipmentView.refreshReferenceFiles==='function')w.ExportHUBShipmentView.refreshReferenceFiles();
  loadFiles(box,ref);
 }else status(box,'Kein Upload erfolgreich: '+errors.join('; '),'error',true);
}
async function loadFiles(box,ref){
 var host=box.querySelector('[data-proof-files]');if(!host)return;host.textContent='';
 try{
  var res=await fetch('/api/reference-files?reference='+encodeURIComponent(ref),{headers:headers(),credentials:'same-origin',cache:'no-store'}),data=await res.json();
  if(!res.ok||!data.ok)throw new Error(q(data.message)||'Dateien nicht verfügbar');
  if(activeRef!==ref||!box.isConnected)return;
  var photos=(data.files||[]).filter(function(f){return /^Dokument_[A-Z0-9]{6}_\d{8}-\d{6}_Versandfoto_/i.test(q(f.name))});
  var notes=(data.files||[]).filter(function(f){return /^Lieferschein_[A-Z0-9]{6}_\d{8}-\d{6}_/i.test(q(f.name))});
  host.appendChild(el('strong',null,photos.length+' Versandfotos · '+notes.length+' Lieferscheine im REF-Ordner'));
  photos.concat(notes).slice(0,50).forEach(function(f){
   var row=el('div','eh1860-file'),txt=el('span',null,q(f.name)),btn=el('button',null,'Ansehen');
   btn.type='button';btn.addEventListener('click',function(){preview(ref,f,box)});
   row.appendChild(txt);row.appendChild(btn);host.appendChild(row);
  });
 }catch(e){host.appendChild(el('p','eh1860-status','REF-Dateiliste derzeit nicht lesbar: '+q(e.message)))}
}
async function preview(ref,file,box){
 status(box,'Lade '+q(file.name)+' …','',true);
 try{
  var url='/api/reference-files?reference='+encodeURIComponent(ref)+'&itemId='+encodeURIComponent(file.id);
  var res=await fetch(url,{headers:headers(),credentials:'same-origin',cache:'no-store'});
  if(!res.ok)throw new Error('Datei nicht abrufbar (HTTP '+res.status+')');
  var blob=await res.blob(),obj=URL.createObjectURL(blob);
  if(w.ExportHUBFilePreview1460&&typeof w.ExportHUBFilePreview1460.open==='function')w.ExportHUBFilePreview1460.open(obj,q(file.name));
  else w.open(obj,'_blank','noopener');
  setTimeout(function(){URL.revokeObjectURL(obj)},120000);
  status(box,'Datei geöffnet.','ok',true);
 }catch(e){status(box,q(e.message),'error',true)}
}
function ensure(){
 scheduled=false;
 var host=d.getElementById('rc786ReferenceFilesCard'),shipment=sh(),ref=refOf(shipment);
 if(!host||!/^[A-Z0-9]{6}$/.test(ref)){if(activeCard&&activeCard.isConnected)activeCard.remove();activeCard=null;activeRef='';return}
 if(activeRef===ref&&activeCard&&activeCard.isConnected&&activeCard.previousElementSibling===host)return;
 if(activeCard&&activeCard.isConnected)activeCard.remove();
 activeRef=ref;activeRecord=null;
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
