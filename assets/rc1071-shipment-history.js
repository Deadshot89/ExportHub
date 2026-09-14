(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1071_SHIPMENT_HISTORY__)return;
w.__EXPORTHUB_RC1071_SHIPMENT_HISTORY__=true;

var MAX_EVENTS=1000,FLUSH_TIMER=0,LAST_ACTIONS=Object.create(null),SNAPSHOTS=Object.create(null),LAST_MAIL_META=Object.create(null),RC1071_LEGACY_RELEASE_MARKER='Mail als versendet bestätigen';

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function now(){return new Date().toISOString()}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function currentUser(){var s=state();try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}return s.currentUser||s.activeUser||w.currentUser||{}}
function actorFrom(user){user=user||{};return{name:q(user.name||user.displayName||user.fullName||user.user||user.username||user.login)||'Unbekannt',id:q(user.id||user.userId||user.user||user.username||user.login),role:q(user.role||user.rolle)}}
function identity(sh){if(!sh)return'';return q(sh.id||sh.shipmentId||sh.reference||sh.referenceNumber||sh.ref||sh.sendungsreferenz).toLocaleUpperCase('de-DE')}
function ref(sh){return q(sh&&((sh.reference||sh.referenceNumber||sh.ref||sh.sendungsreferenz)))}
function currentShipment(){
 var s=state(),direct=s.currentShipment||s.shipment||s.activeShipment||null;if(direct&&obj(direct))return direct;
 var id=q(s.currentShipmentId||s.selectedShipmentId||s.shipmentId),r=q(s.currentShipmentRef||s.selectedShipmentRef||s.reference);
 var all=[].concat(arr(s.shipments),arr(s.savedShipments),arr(s.shipmentArchive),arr(s.archivedShipments),arr(s.salesSharedShipments),arr(s.sharedShipments));
 return all.find(function(x){return x&&((id&&q(x.id||x.shipmentId)===id)||(r&&ref(x)===r))})||null
}
function collections(){var s=state();return['shipments','savedShipments','shipmentArchive','archivedShipments','salesSharedShipments','sharedShipments'].map(function(k){return s[k]}).filter(Array.isArray)}
function copiesOf(sh){var key=identity(sh);if(!key)return sh?[sh]:[];var out=[];collections().forEach(function(list){list.forEach(function(x){if(x&&identity(x)===key&&!out.includes(x))out.push(x)})});if(sh&&!out.includes(sh))out.push(sh);return out}
function safeDetails(input){
 var d=obj(input)?input:{},out={};
 Object.keys(d).slice(0,20).forEach(function(k){
   if(/token|authorization|password|passwort|signature|base64|dataurl|content|body|mailtext/i.test(k))return;
   var v=d[k];if(v==null||typeof v==='boolean'||typeof v==='number')out[k]=v;
   else if(typeof v==='string')out[k]=q(v).slice(0,500);
 });
 return out
}
function eventId(type,at,actor,label){return'H-'+String(at||'').replace(/[^0-9]/g,'').slice(0,17)+'-'+low(type).replace(/[^a-z0-9]+/g,'-').slice(0,24)+'-'+low(actor||label).replace(/[^a-z0-9]+/g,'-').slice(0,24)+'-'+Math.random().toString(36).slice(2,7)}
function normalizeEvent(e){e=obj(e)?e:{};var at=q(e.at||e.createdAt||e.timestamp)||now(),actor=obj(e.actor)?e.actor:actorFrom({name:e.actorName||e.user||e.by});return{id:q(e.id)||eventId(e.type,at,actor.name,e.label),at:at,type:q(e.type)||'event',label:q(e.label||e.action)||'Ereignis',actor:{name:q(actor.name)||'Unbekannt',id:q(actor.id),role:q(actor.role)},source:q(e.source)||'exporthub',details:safeDetails(e.details),version:'RC1100'}}
function history(sh){return arr(sh&&sh.shipmentHistory).map(normalizeEvent)}
function mergedHistory(sh){
 var map=new Map();
 copiesOf(sh).forEach(function(copy){arr(copy&&copy.shipmentHistory).forEach(function(raw){var e=normalizeEvent(raw),key=q(raw&&raw.id)||[q(e.at),q(e.type),q(e.label),q(e.actor&&e.actor.name)].join('|');if(!map.has(key))map.set(key,e)})});
 return Array.from(map.values()).sort(function(a,b){return Date.parse(a.at||0)-Date.parse(b.at||0)})
}
function setHistory(sh,list){var clean=list.slice(-MAX_EVENTS);copiesOf(sh).forEach(function(x){x.shipmentHistory=clean.map(function(e){return Object.assign({},e,{actor:Object.assign({},e.actor),details:Object.assign({},e.details)})})})}
function duplicate(list,event){
 return list.some(function(e){return e.id===event.id||(
   e.type===event.type&&e.label===event.label&&e.actor&&event.actor&&e.actor.name===event.actor.name&&
   Math.abs(Date.parse(e.at||0)-Date.parse(event.at||0))<2000
 )})
}
function schedulePersist(reason){
 var clean=w.ExportHUBClean;if(!clean||typeof clean.queueSave!=='function')return;
 try{clean.queueSave(reason||'Sendungshistorie aktualisiert')}catch(_){}
 if(FLUSH_TIMER)clearTimeout(FLUSH_TIMER);
 FLUSH_TIMER=setTimeout(function(){FLUSH_TIMER=0;try{if(typeof clean.flushSave==='function')Promise.resolve(clean.flushSave(reason||'Sendungshistorie aktualisiert',{force:true,userInitiated:true})).catch(function(){})}catch(_){}},700)
}
function append(sh,input,opt){
 if(!sh)return null;opt=opt||{};var e=normalizeEvent(input),list=mergedHistory(sh);if(duplicate(list,e))return null;
 list.push(e);list.sort(function(a,b){return Date.parse(a.at||0)-Date.parse(b.at||0)});setHistory(sh,list);
 if(opt.persist!==false)schedulePersist('History: '+e.label);
 render();
 return e
}
function actionOnce(key,ms){var t=Date.now(),last=Number(LAST_ACTIONS[key]||0);if(t-last<(ms||1500))return false;LAST_ACTIONS[key]=t;return true}
function statusOf(sh){return q(sh&&(sh.status||sh.processStatus||sh.shipmentStatus||sh.pickupStatus))}
function countFiles(sh,key){return arr(sh&&sh[key]).length}
function fileName(file,index){return q(file&&(file.name||file.fileName||file.originalName||file.id||file.url||file.blobName))||('Datei '+String((index||0)+1))}
function fileSnapshot(sh,keys){var out=[];arr(keys).forEach(function(key){arr(sh&&sh[key]).forEach(function(file,index){out.push(fileName(file,index))})});return out}
function snapshot(sh){return{status:statusOf(sh),abdFiles:fileSnapshot(sh,['abdFiles']),podFiles:fileSnapshot(sh,['podFiles']),deliveryFiles:fileSnapshot(sh,['deliveryFiles','deliveryNotesFiles']),avis:!!(sh&&(sh.customerAvisEnabled||sh.avisEnabled)),pickupDate:q(sh&&(sh.pickupDate||sh.plannedPickupDate||sh.collectionDate)),pickupTime:q(sh&&(sh.pickupTime||sh.timeFrom||sh.pickupTimeFrom||sh.collectionTime)),picked:q(sh&&(sh.pickedUpAt||sh.pickupConfirmedAt||sh.actualPickupAt||sh.collectedAt||''))}}
function statusLabel(status){var l=low(status);if(/storn|cancel/.test(l))return'Sendung storniert';if(/nachbearbeit|rework/.test(l))return'Sendung in Nachbearbeitung';if(/abgeschlossen|completed|complete/.test(l))return'Sendung abgeschlossen';if(/archiv|archive/.test(l))return'Sendung archiviert';return'Status geändert: '+q(status)}
function fileDiff(sh,prev,next,type,base){
 prev=arr(prev);next=arr(next);var removed=prev.filter(function(x){return !next.includes(x)}),added=next.filter(function(x){return !prev.includes(x)}),actor=actorFrom(currentUser());
 if(prev.length===next.length&&removed.length===1&&added.length===1){append(sh,{type:type,label:base+' ersetzt',actor:actor,details:{oldFile:removed[0],newFile:added[0],reference:ref(sh)}});return}
 removed.forEach(function(name){append(sh,{type:type,label:base+' entfernt',actor:actor,details:{document:name,reference:ref(sh)}})});
 added.forEach(function(name){append(sh,{type:type,label:base+' hinzugefügt',actor:actor,details:{document:name,reference:ref(sh)}})})
}
function latestPickupActor(sh){
 var candidates=[];
 arr(sh&&sh.pickupHistory).forEach(function(x){candidates.push(x)});
 arr(sh&&sh.subShipments).forEach(function(sub){arr(sub&&sub.pickupHistory).forEach(function(x){candidates.push(x)})});
 candidates.sort(function(a,b){return Date.parse(a&&a.confirmedAt||0)-Date.parse(b&&b.confirmedAt||0)});
 var x=candidates[candidates.length-1]||{};return actorFrom({name:q(x.loaderName)||q(x.driverName)||'QR-Abholung',id:q(x.loaderId),role:q(x.loaderName)?'Verladung':'Fahrer'})
}
function monitor(){
 var sh=currentShipment();if(!sh)return;var key=identity(sh);if(!key)return;
 var next=snapshot(sh),prev=SNAPSHOTS[key];SNAPSHOTS[key]=next;if(!prev)return;
 if(prev.status!==next.status&&next.status)append(sh,{type:'status',label:statusLabel(next.status),actor:actorFrom(currentUser()),details:{from:prev.status,to:next.status}});
 fileDiff(sh,prev.abdFiles,next.abdFiles,'abd','ABD-Dokument');
 fileDiff(sh,prev.podFiles,next.podFiles,'pod','POD');
 fileDiff(sh,prev.deliveryFiles,next.deliveryFiles,'document','Versanddokument');
 if(!prev.avis&&next.avis)append(sh,{type:'avis',label:'Lieferavis aktiviert',actor:actorFrom(currentUser())});
 if(prev.avis&&!next.avis)append(sh,{type:'avis',label:'Lieferavis deaktiviert',actor:actorFrom(currentUser())});
 if((prev.pickupDate!==next.pickupDate||prev.pickupTime!==next.pickupTime)&&next.pickupDate)append(sh,{type:'pickup-plan',label:'Abholung geplant/gebucht',actor:actorFrom(currentUser()),details:{date:next.pickupDate,time:next.pickupTime}});
 if(!prev.picked&&next.picked)append(sh,{type:'pickup',label:'Abholung bestätigt',at:next.picked,actor:latestPickupActor(sh),details:{status:next.status}});
}
function existingSaved(sh){var key=identity(sh);if(!key)return false;return collections().some(function(list){return list.some(function(x){return x&&identity(x)===key})})}
function hookPersist(){
 var core=w.ExportHUBRC565;if(!core||typeof core.persistShipment!=='function'||core.persistShipment.__rc1071)return false;
 var original=core.persistShipment;
 var wrapped=async function(){
   var sh=currentShipment(),isNew=sh&&!existingSaved(sh)&&!mergedHistory(sh).some(function(e){return e.type==='created'});
   if(isNew){
     var a=actorFrom(currentUser()),stamp=q(sh.createdAt)||now();if(!sh.createdAt)sh.createdAt=stamp;if(!q(sh.createdBy))sh.createdBy=a.name;
     append(sh,{type:'created',label:'Sendung erstellt',at:stamp,actor:a,details:{reference:ref(sh)}},{persist:false})
   }
   return await original.apply(this,arguments)
 };
 wrapped.__rc1071=true;wrapped.__original=original;core.persistShipment=wrapped;return true
}
function mailSentLabel(mailKind){mailKind=q(mailKind)||'E-Mail';if(mailKind==='ABD-Anfrage')return'ABD-E-Mail-Versand bestätigt';if(mailKind==='Versandanmeldung')return'Versandanmeldung versendet';if(mailKind==='Lieferavis')return'Lieferavis versendet';return'E-Mail-Versand bestätigt'}
function derived(sh){
 var out=[],push=function(e){if(e&&e.at)out.push(normalizeEvent(Object.assign({source:'derived'},e)))};
 var created=q(sh&&(sh.createdAt||sh.created||sh.savedAt));if(created)push({id:'D-CREATED-'+identity(sh),at:created,type:'created',label:'Sendung erfasst',actor:actorFrom({name:q(sh.createdBy||sh.creator||sh.owner)||'Historischer Bestand'})});
 var avis=q(sh&&(sh.customerAvisEnabledAt||sh.avisEnabledAt));if(avis)push({id:'D-AVIS-'+identity(sh),at:avis,type:'avis',label:'Lieferavis erstellt/aktiviert',actor:actorFrom({name:q(sh.customerAvisEnabledBy||sh.avisEnabledBy)||'ExportHUB'})});
 arr(sh&&sh.mailHistory).forEach(function(m,i){var at=q(m&&m.at||m&&m.sentAt||m&&m.createdAt);if(!at)return;var sent=/sent|versendet|confirmed|bestätigt/i.test(q(m.status||m.action)),mailKind=mailTypeFrom(q(m.mailType||m.type)+' '+q(m.subject));push({id:q(m.id)||('D-MAIL-'+i+'-'+identity(sh)),at:at,type:sent?'mail-sent':'mail',label:sent?mailSentLabel(mailKind):'E-Mail protokolliert',actor:actorFrom({name:q(m.actor||m.user||m.createdBy)||'ExportHUB'}),details:{to:q(m.to||m.recipient),subject:q(m.subject),mailType:mailKind}})});
 function pickupRows(rows,prefix){arr(rows).forEach(function(p,i){var at=q(p&&p.confirmedAt||p&&p.signatureStoredAt);if(!at)return;push({id:q(p.id)||('D-PICK-'+prefix+'-'+i+'-'+identity(sh)),at:at,type:'pickup',label:p.complete===false?'Teilabholung bestätigt':'Abholung bestätigt',actor:actorFrom({name:q(p.loaderName)||q(p.driverName)||'QR-Abholung',id:q(p.loaderId),role:q(p.loaderName)?'Verladung':'Fahrer'}),details:{driver:q(p.driverName),licensePlate:q(p.licensePlate),colli:p.colliCount,remaining:p.remainingAfter}})})}
 pickupRows(sh&&sh.pickupHistory,'MAIN');arr(sh&&sh.subShipments).forEach(function(sub,i){pickupRows(sub&&sub.pickupHistory,'SUB'+i)});
 var podAt=q(sh&&(sh.podUploadedAt||sh.podServerVerifiedAt));if(podAt)push({id:'D-POD-'+identity(sh),at:podAt,type:'pod',label:'POD vorhanden',actor:latestPickupActor(sh),details:{documents:countFiles(sh,'podFiles')}});
 var done=q(sh&&(sh.completedAt||sh.archivedAt));if(done)push({id:'D-DONE-'+identity(sh),at:done,type:'status',label:sh.archivedAt?'Sendung archiviert':'Sendung abgeschlossen',actor:actorFrom({name:q(sh.completedBy||sh.archivedBy)||'ExportHUB'})});
 return out
}
function allEvents(sh){
 var map=new Map(),add=function(e){var key=q(e&&e.id)||[q(e&&e.at),q(e&&e.type),q(e&&e.label),q(e&&e.actor&&e.actor.name)].join('|');if(!map.has(key))map.set(key,e)};
 mergedHistory(sh).forEach(add);copiesOf(sh).forEach(function(copy){derived(copy).forEach(add)});
 return Array.from(map.values()).sort(function(a,b){return Date.parse(b.at||0)-Date.parse(a.at||0)})
}
function formatDate(v){var d=new Date(v);if(!Number.isFinite(d.getTime()))return q(v)||'—';return new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'medium'}).format(d)}
function icon(type){return({created:'＋',saved:'✓',status:'↔',mail:'✉','mail-sent':'✓',print:'⎙',avis:'A',abd:'D',pickup:'⇢',pod:'P',document:'D',registration:'R','work-start':'▶'})[type]||'•'}
function detailsText(e){var d=e.details||{},parts=[];if(d.document)parts.push('Dokument: '+d.document);if(d.oldFile||d.newFile)parts.push('Datei: '+q(d.oldFile||'—')+' → '+q(d.newFile||'—'));if(d.files)parts.push('Dateien: '+d.files);if(d.mailType)parts.push('Mail: '+d.mailType);if(d.to)parts.push('An: '+d.to);if(d.from&&d.to)parts.push(d.from+' → '+d.to);if(d.driver)parts.push('Fahrer: '+d.driver);if(d.licensePlate)parts.push('Kennzeichen: '+d.licensePlate);if(Number.isFinite(Number(d.colli)))parts.push('Colli: '+d.colli);return parts.join(' · ')}
function viewName(){var s=state();return low(s.view||s.currentView||s.activeView||'')}
function shipmentView(){var v=viewName();if(v)return v==='shipment'||v==='sendung'||/shipment|sendung/.test(v);try{return !!(document.querySelector('#rc380StowPlan,#rc543MailArea'))}catch(_){return false}}
function creatorMetaText(value){return String(value==null?'':value).replace(/([^\s·])Erstellt von:/g,'$1 · Erstellt von:')}
function repairCreatorMetaSpacing(){
 if(!w.document||!shipmentView()||!document.body||typeof document.querySelectorAll!=='function')return 0;
 var changed=0,nodes=document.querySelectorAll('#content .muted,#content .meta,#content [class*="meta"],main .muted,main .meta,main [class*="meta"]');
 Array.prototype.forEach.call(nodes,function(el){
   if(!el||el.id==='rc1071ShipmentHistory'||(el.closest&&el.closest('#rc1071ShipmentHistory')))return;
   var text=String(el.textContent||'');if(!/Erstellt von:/.test(text)||text.length>240)return;var localChanged=false;
   if(el.childNodes&&el.childNodes.length){Array.prototype.forEach.call(el.childNodes,function(node){if(node&&node.nodeType===3){var next=creatorMetaText(node.nodeValue);if(next!==node.nodeValue){node.nodeValue=next;changed++;localChanged=true}}})}
   if(!localChanged&&el.childNodes&&el.childNodes.length>1&&el.style){el.style.display='flex';el.style.flexWrap='wrap';el.style.columnGap='10px';el.style.rowGap='4px'}
 });
 return changed
}
function render(){
 if(!w.document||!w.document.body)return false;var old=document.getElementById('rc1071ShipmentHistory'),sh=currentShipment();
 if(!sh||!shipmentView()){if(old)old.remove();return false}
 var host=document.getElementById('content')||document.querySelector('main')||document.body;if(!host)return false;
 if(!old){old=document.createElement('section');old.id='rc1071ShipmentHistory';old.className='card rc1071-history';host.appendChild(old)}
 var events=allEvents(sh),rows=events.length?events.map(function(e){var det=detailsText(e);return'<div class="rc1071-history-row"><div class="rc1071-history-icon">'+esc(icon(e.type))+'</div><div class="rc1071-history-main"><div class="rc1071-history-label">'+esc(e.label)+'</div><div class="rc1071-history-meta">'+esc(formatDate(e.at))+' · '+esc(e.actor&&e.actor.name||'Unbekannt')+(e.actor&&e.actor.role?' · '+esc(e.actor.role):'')+'</div>'+(det?'<div class="rc1071-history-details">'+esc(det)+'</div>':'')+'</div></div>'}).join(''):'<div class="muted">Noch keine History-Einträge vorhanden.</div>';
 old.innerHTML='<div class="rc1071-history-head"><div><span class="pill blue">HISTORIE</span><h3>Sendungshistorie</h3><div class="muted">Nachvollziehbarer Ablauf für '+esc(ref(sh)||identity(sh))+'</div></div><span class="pill gray">'+events.length+' Ereignisse</span></div><div class="rc1071-history-list">'+rows+'</div>';
 ensureStyle();return true
}
function ensureStyle(){if(document.getElementById('rc1071ShipmentHistoryStyle'))return;var s=document.createElement('style');s.id='rc1071ShipmentHistoryStyle';s.textContent='.rc1071-history{margin-top:16px}.rc1071-history-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.rc1071-history-head h3{margin:6px 0 2px}.rc1071-history-list{margin-top:12px;display:grid;gap:8px;max-height:520px;overflow:auto;padding-right:4px}.rc1071-history-row{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:10px;border:1px solid #dbe4ec;border-radius:10px;background:#fff}.rc1071-history-icon{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#eef6ff;font-weight:800}.rc1071-history-label{font-weight:750}.rc1071-history-meta,.rc1071-history-details{font-size:12px;color:#64748b;margin-top:2px}@media(max-width:720px){.rc1071-history-list{max-height:none}.rc1071-history-row{grid-template-columns:30px 1fr}}';(document.head||document.documentElement).appendChild(s)}
function documentLabel(text){text=low(text);if(/\babd\b|ausfuhrbegleit/.test(text))return'ABD';if(/cmr/.test(text))return'CMR';if(/lieferschein|liefer.?schein|delivery note/.test(text))return'Lieferschein';if(/deckblatt/.test(text))return'Deckblatt';if(/stauplan/.test(text))return'Stauplan';if(/ladeliste/.test(text))return'Ladeliste';if(/gesamt/.test(text)&&/druck|ausgabe|pdf/.test(text))return'Gesamtdruck';if(/l1/.test(text)&&/qr/.test(text))return'L1 QR';if(/\bl2\b/.test(text))return'L2';if(/pdf/.test(text))return'PDF';return'Dokument'}
function mailRecipient(href){try{return decodeURIComponent(String(href||'').replace(/^mailto:/i,'').split('?')[0])}catch(_){return q(href).replace(/^mailto:/i,'').split('?')[0]}}
function mailSubject(href){try{var raw=String(href||''),query=raw.indexOf('?')>=0?raw.slice(raw.indexOf('?')+1):'',parts=query.split('&');for(var i=0;i<parts.length;i++){var p=parts[i].split('='),k=decodeURIComponent(p.shift()||'').toLowerCase();if(k==='subject')return decodeURIComponent(p.join('=').replace(/\+/g,' '))}}catch(_){}return''}
function mailTypeFrom(text){var l=low(text);if(/\babd\b|ausfuhrbegleit/.test(l))return'ABD-Anfrage';if(/anmeld|registrier|versandbestät/.test(l))return'Versandanmeldung';if(/lieferavis|abholung|collection notice/.test(l))return'Lieferavis';return'E-Mail'}
function elementContext(el,text){var out=q(text);try{var box=el&&el.closest&&el.closest('[data-document],[data-doc-type],section,fieldset,.card,.panel,.field');if(box&&box!==el)out+=' '+q(box.getAttribute&&box.getAttribute('data-document'))+' '+q(box.getAttribute&&box.getAttribute('data-doc-type'))+' '+q(box.getAttribute&&box.getAttribute('aria-label'))+' '+q(box.textContent)}catch(_){}return out}
function recordMailSent(sh,contextText){var mailMeta=LAST_MAIL_META[identity(sh)]||{},mailKind=q(mailMeta.mailType)||mailTypeFrom(contextText)||'E-Mail',sentLabel=mailSentLabel(mailKind);return append(sh,{type:'mail-sent',label:sentLabel,actor:actorFrom(currentUser()),details:{reference:ref(sh),to:q(mailMeta.to),subject:q(mailMeta.subject),mailType:mailKind}})}
function click(ev){
 var el=ev.target&&ev.target.closest&&ev.target.closest('button,a,[role="button"]');if(!el)return;var sh=currentShipment();if(!sh)return;
 var text=q(el.textContent)+' '+q(el.getAttribute&&el.getAttribute('title'))+' '+q(el.getAttribute&&el.getAttribute('data-action')),contextText=elementContext(el,text),l=low(contextText);
 var href=q(el.getAttribute&&el.getAttribute('href'));
 if(/^mailto:/i.test(href)||/outlook|e-?mail.*öffnen|mail.*öffnen|anmeldung.*mail/.test(l)){
   var to=/^mailto:/i.test(href)?mailRecipient(href):'',subject=/^mailto:/i.test(href)?mailSubject(href):'',mailKind=mailTypeFrom(contextText+' '+subject);
   LAST_MAIL_META[identity(sh)]={to:to,subject:subject,mailType:mailKind,at:now()};
   if(mailKind==='ABD-Anfrage'&&actionOnce('abd-mail|'+identity(sh)+'|'+to,2500))append(sh,{type:'abd',label:'ABD-Anfrage per E-Mail gestartet',actor:actorFrom(currentUser()),details:{to:to,subject:subject,mailType:mailKind,reference:ref(sh)}});
   if(/anmeld|registrier|versandbestät/i.test(l)&&actionOnce('registration-mail|'+identity(sh)+'|'+to,2500))append(sh,{type:'registration',label:'Versandanmeldung per E-Mail gestartet',actor:actorFrom(currentUser()),details:{to:to,subject:subject,mailType:mailKind,reference:ref(sh)}});
   if(actionOnce('mail-sent-open|'+identity(sh)+'|'+mailKind+'|'+to,2500))recordMailSent(sh,contextText);return
 }
 if(/\babd\b/.test(l)&&/anfordern|anfrage|request/.test(l)){
   if(actionOnce('abd-request|'+identity(sh),2500))append(sh,{type:'abd',label:'ABD angefordert',actor:actorFrom(currentUser()),details:{reference:ref(sh)}});return
 }
 if(/anmeld|registrier|versandbestät/.test(l)&&!/login|anmeldung erforderlich/.test(l)){
   if(actionOnce('registration|'+identity(sh),2500))append(sh,{type:'registration',label:'Versandanmeldung gestartet',actor:actorFrom(currentUser()),details:{reference:ref(sh),action:q(el.textContent)}});return
 }
 if(/druck|print|cmr|ladeliste|stauplan|gesamtausgabe|pdf/.test(l)){
   var doc=documentLabel(text);if(doc==='Dokument'||doc==='PDF')doc=documentLabel(contextText);if(actionOnce('print|'+identity(sh)+'|'+doc,1800))append(sh,{type:'print',label:doc+' – Druck/PDF gestartet',actor:actorFrom(currentUser()),details:{document:doc,reference:ref(sh)}});return
 }
 if(/speichern/.test(l)&&!/einstellung|vorlage|stammdaten/.test(l)){
   if(actionOnce('save|'+identity(sh),2500))append(sh,{type:'saved',label:'Sendung manuell gespeichert',actor:actorFrom(currentUser()),details:{status:statusOf(sh)}});return
 }
}
function fileChange(ev){var input=ev.target;if(!input||String(input.type||'').toLowerCase()!=='file'||!input.files||!input.files.length)return;var sh=currentShipment();if(!sh)return;var ctx=low((input.id||'')+' '+(input.name||'')+' '+(input.closest&&input.closest('label,.field,.card')&&input.closest('label,.field,.card').textContent||'')),kind=/pod/.test(ctx)?'POD':/abd/.test(ctx)?'ABD':/liefer|delivery/.test(ctx)?'Lieferschein':'Dokument';append(sh,{type:kind==='POD'?'pod':kind==='ABD'?'abd':'document',label:kind+' zum Upload ausgewählt',actor:actorFrom(currentUser()),details:{files:Array.from(input.files).map(function(f){return q(f.name)}).join(', ')}})}
function avisUpdated(ev){var sh=currentShipment();if(!sh)return;var d=ev&&ev.detail||{},enabled=d.enabled!==false;append(sh,{type:'avis',label:enabled?'Lieferavis erstellt/aktiviert':'Lieferavis deaktiviert',actor:actorFrom(currentUser()),details:{reference:q(d.reference)||ref(sh)}})}
function markWorkStarted(){
 var sh=currentShipment();if(!sh||!shipmentView())return false;
 var actor=actorFrom(currentUser()),events=mergedHistory(sh),cutoff=Date.now()-4*60*60*1000;
 var recent=events.some(function(e){return e.type==='work-start'&&e.actor&&q(e.actor.id||e.actor.name)===q(actor.id||actor.name)&&(Date.parse(e.at||0)||0)>=cutoff});
 if(recent)return false;
 append(sh,{type:'work-start',label:'Arbeit an Sendung gestartet',actor:actor,details:{reference:ref(sh)}});
 return true
}
function schedule(){setTimeout(function(){try{hookPersist();monitor();markWorkStarted();repairCreatorMetaSpacing();render()}catch(e){try{console.warn('RC1071 History',e)}catch(_){}}},0)}
if(w.document){
 document.addEventListener('click',click,true);document.addEventListener('change',fileChange,true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 if(typeof MutationObserver!=='undefined'){var mo=new MutationObserver(function(){schedule()});try{mo.observe(document.documentElement,{childList:true,subtree:true})}catch(_){} }
}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
try{w.addEventListener('exporthub:customer-avis-updated',avisUpdated)}catch(_){}
setInterval(function(){try{hookPersist();monitor()}catch(_){}},2500);
w.ExportHUBShipmentHistory1071=Object.freeze({version:'RC1100',append:append,events:allEvents,render:render,currentShipment:currentShipment,actor:actorFrom,monitor:monitor,markWorkStarted:markWorkStarted,documentLabel:documentLabel,mailTypeFrom:mailTypeFrom,mailSentLabel:mailSentLabel,statusLabel:statusLabel,creatorMetaText:creatorMetaText,repairCreatorMetaSpacing:repairCreatorMetaSpacing});
})(window);
