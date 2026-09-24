(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1071_SHIPMENT_HISTORY__)return;
w.__EXPORTHUB_RC1071_SHIPMENT_HISTORY__=true;

var MAX_EVENTS=1000,FLUSH_TIMER=0,LAST_ACTIONS=Object.create(null),SNAPSHOTS=Object.create(null),LAST_MAIL_META=Object.create(null);

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function tr(key,vars,language){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars,language)}catch(_){}return key}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function')return w.ExportHUBI18n.language()}catch(_){}return'de'}
function locale(){return({de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'})[lang()]||'de-DE'}
function de(key,vars){return tr(key,vars,'de')}
function escRe(v){return q(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function arr(v){return Array.isArray(v)?v:[]}')}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function now(){return new Date().toISOString()}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function currentUser(){var s=state();try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}return s.currentUser||s.activeUser||w.currentUser||{}}
function actorFrom(user){user=user||{};return{name:q(user.name||user.displayName||user.fullName||user.user||user.username||user.login)||de('shipmentHistory.actor.unknown'),id:q(user.id||user.userId||user.user||user.username||user.login),role:q(user.role||user.rolle)}}
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
function normalizeEvent(e){e=obj(e)?e:{};var at=q(e.at||e.createdAt||e.timestamp)||now(),actor=obj(e.actor)?e.actor:actorFrom({name:e.actorName||e.user||e.by});return{id:q(e.id)||eventId(e.type,at,actor.name,e.label),at:at,type:q(e.type)||'event',label:q(e.label||e.action)||de('shipmentHistory.action.event'),actor:{name:q(actor.name)||de('shipmentHistory.actor.unknown'),id:q(actor.id),role:q(actor.role)},source:q(e.source)||'exporthub',details:safeDetails(e.details),version:'RC1151'}}
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
function fileName(file,index){return q(file&&(file.name||file.fileName||file.originalName||file.id||file.url||file.blobName))||de('shipmentHistory.file.default',{index:String((index||0)+1)})}
function fileSnapshot(sh,keys){var out=[];arr(keys).forEach(function(key){arr(sh&&sh[key]).forEach(function(file,index){out.push(fileName(file,index))})});return out}
function snapshot(sh){return{status:statusOf(sh),abdFiles:fileSnapshot(sh,['abdFiles']),podFiles:fileSnapshot(sh,['podFiles']),deliveryFiles:fileSnapshot(sh,['deliveryFiles','deliveryNotesFiles']),avis:!!(sh&&(sh.customerAvisEnabled||sh.avisEnabled)),pickupDate:q(sh&&(sh.pickupDate||sh.plannedPickupDate||sh.collectionDate)),pickupTime:q(sh&&(sh.pickupTime||sh.timeFrom||sh.pickupTimeFrom||sh.collectionTime)),picked:q(sh&&(sh.pickedUpAt||sh.pickupConfirmedAt||sh.actualPickupAt||sh.collectedAt||''))}}
function statusLabel(status){var l=low(status);if(/storn|cancel/.test(l))return de('shipmentHistory.action.statusCancelled');if(/nachbearbeit|rework/.test(l))return de('shipmentHistory.action.statusRework');if(/abgeschlossen|completed|complete/.test(l))return de('shipmentHistory.action.statusCompleted');if(/archiv|archive/.test(l))return de('shipmentHistory.action.statusArchived');return de('shipmentHistory.action.statusChanged',{status:q(status)})}
function fileDiff(sh,prev,next,type,base){
 prev=arr(prev);next=arr(next);var removed=prev.filter(function(x){return !next.includes(x)}),added=next.filter(function(x){return !prev.includes(x)}),actor=actorFrom(currentUser());
 if(prev.length===next.length&&removed.length===1&&added.length===1){append(sh,{type:type,label:de('shipmentHistory.action.documentReplaced',{document:base}),actor:actor,details:{oldFile:removed[0],newFile:added[0],documentType:base,change:'replaced',reference:ref(sh)}});return}
 removed.forEach(function(name){append(sh,{type:type,label:de('shipmentHistory.action.documentRemoved',{document:base}),actor:actor,details:{document:name,documentType:base,change:'removed',reference:ref(sh)}})});
 added.forEach(function(name){append(sh,{type:type,label:de('shipmentHistory.action.documentAdded',{document:base}),actor:actor,details:{document:name,documentType:base,change:'added',reference:ref(sh)}})})
}
function latestPickupActor(sh){
 var candidates=[];
 arr(sh&&sh.pickupHistory).forEach(function(x){candidates.push(x)});
 arr(sh&&sh.subShipments).forEach(function(sub){arr(sub&&sub.pickupHistory).forEach(function(x){candidates.push(x)})});
 candidates.sort(function(a,b){return Date.parse(a&&a.confirmedAt||0)-Date.parse(b&&b.confirmedAt||0)});
 var x=candidates[candidates.length-1]||{};return actorFrom({name:q(x.loaderName)||q(x.driverName)||de('shipmentHistory.actor.qrPickup'),id:q(x.loaderId),role:q(x.loaderName)?de('shipmentHistory.role.loading'):de('shipmentHistory.role.driver')})
}
function monitor(){
 var sh=currentShipment();if(!sh)return;var key=identity(sh);if(!key)return;
 var next=snapshot(sh),prev=SNAPSHOTS[key];SNAPSHOTS[key]=next;if(!prev)return;
 if(prev.status!==next.status&&next.status)append(sh,{type:'status',label:statusLabel(next.status),actor:actorFrom(currentUser()),details:{from:prev.status,to:next.status}});
 fileDiff(sh,prev.abdFiles,next.abdFiles,'abd','ABD-Dokument');
 fileDiff(sh,prev.podFiles,next.podFiles,'pod','POD');
 fileDiff(sh,prev.deliveryFiles,next.deliveryFiles,'document','Versanddokument');
 if(!prev.avis&&next.avis)append(sh,{type:'avis',label:de('shipmentHistory.action.avisEnabled'),actor:actorFrom(currentUser())});
 if(prev.avis&&!next.avis)append(sh,{type:'avis',label:de('shipmentHistory.action.avisDisabled'),actor:actorFrom(currentUser())});
 if((prev.pickupDate!==next.pickupDate||prev.pickupTime!==next.pickupTime)&&next.pickupDate)append(sh,{type:'pickup-plan',label:de('shipmentHistory.action.pickupPlanned'),actor:actorFrom(currentUser()),details:{date:next.pickupDate,time:next.pickupTime}});
 if(!prev.picked&&next.picked)append(sh,{type:'pickup',label:de('shipmentHistory.action.pickupConfirmed'),at:next.picked,actor:latestPickupActor(sh),details:{status:next.status}});
}
function existingSaved(sh){var key=identity(sh);if(!key)return false;return collections().some(function(list){return list.some(function(x){return x&&identity(x)===key})})}
function hookPersist(){
 var core=w.ExportHUBRC565;if(!core||typeof core.persistShipment!=='function'||core.persistShipment.__rc1071)return false;
 var original=core.persistShipment;
 var wrapped=async function(){
   var sh=currentShipment(),isNew=sh&&!existingSaved(sh)&&!mergedHistory(sh).some(function(e){return e.type==='created'});
   if(isNew){
     var a=actorFrom(currentUser()),stamp=q(sh.createdAt)||now();if(!sh.createdAt)sh.createdAt=stamp;if(!q(sh.createdBy))sh.createdBy=a.name;
     append(sh,{type:'created',label:de('shipmentHistory.action.shipmentCreated'),at:stamp,actor:a,details:{reference:ref(sh)}},{persist:false})
   }
   return await original.apply(this,arguments)
 };
 wrapped.__rc1071=true;wrapped.__original=original;core.persistShipment=wrapped;return true
}
function mailSentLabel(mailKind){mailKind=q(mailKind)||de('shipmentHistory.mail.email');if(mailKind===de('shipmentHistory.mail.abdRequest'))return de('shipmentHistory.action.abdMailSent');if(mailKind===de('shipmentHistory.mail.registration'))return de('shipmentHistory.action.registrationSent');if(mailKind===de('shipmentHistory.mail.avis'))return de('shipmentHistory.action.avisSent');return de('shipmentHistory.action.emailSent')}
function derived(sh){
 var out=[],push=function(e){if(e&&e.at)out.push(normalizeEvent(Object.assign({source:'derived'},e)))};
 var created=q(sh&&(sh.createdAt||sh.created||sh.savedAt));if(created)push({id:'D-CREATED-'+identity(sh),at:created,type:'created',label:de('shipmentHistory.action.shipmentCaptured'),actor:actorFrom({name:q(sh.createdBy||sh.creator||sh.owner)||de('shipmentHistory.actor.historical')})});
 var avis=q(sh&&(sh.customerAvisEnabledAt||sh.avisEnabledAt));if(avis)push({id:'D-AVIS-'+identity(sh),at:avis,type:'avis',label:de('shipmentHistory.action.avisCreated'),actor:actorFrom({name:q(sh.customerAvisEnabledBy||sh.avisEnabledBy)||'ExportHUB'})});
 arr(sh&&sh.mailHistory).forEach(function(m,i){var at=q(m&&m.at||m&&m.sentAt||m&&m.createdAt);if(!at)return;var sent=/sent|versendet|confirmed|bestätigt/i.test(q(m.status||m.action)),mailKind=mailTypeFrom(q(m.mailType||m.type)+' '+q(m.subject));push({id:q(m.id)||('D-MAIL-'+i+'-'+identity(sh)),at:at,type:sent?'mail-sent':'mail',label:sent?mailSentLabel(mailKind):de('shipmentHistory.action.emailLogged'),actor:actorFrom({name:q(m.actor||m.user||m.createdBy)||'ExportHUB'}),details:{to:q(m.to||m.recipient),subject:q(m.subject),mailType:mailKind}})});
 function pickupRows(rows,prefix){arr(rows).forEach(function(p,i){var at=q(p&&p.confirmedAt||p&&p.signatureStoredAt);if(!at)return;push({id:q(p.id)||('D-PICK-'+prefix+'-'+i+'-'+identity(sh)),at:at,type:'pickup',label:p.complete===false?de('shipmentHistory.action.partialPickupConfirmed'):de('shipmentHistory.action.pickupConfirmed'),actor:actorFrom({name:q(p.loaderName)||q(p.driverName)||de('shipmentHistory.actor.qrPickup'),id:q(p.loaderId),role:q(p.loaderName)?de('shipmentHistory.role.loading'):de('shipmentHistory.role.driver')}),details:{driver:q(p.driverName),licensePlate:q(p.licensePlate),colli:p.colliCount,remaining:p.remainingAfter}})})}
 pickupRows(sh&&sh.pickupHistory,'MAIN');arr(sh&&sh.subShipments).forEach(function(sub,i){pickupRows(sub&&sub.pickupHistory,'SUB'+i)});
 var podAt=q(sh&&(sh.podUploadedAt||sh.podServerVerifiedAt));if(podAt)push({id:'D-POD-'+identity(sh),at:podAt,type:'pod',label:de('shipmentHistory.action.podAvailable'),actor:latestPickupActor(sh),details:{documents:countFiles(sh,'podFiles')}});
 var done=q(sh&&(sh.completedAt||sh.archivedAt));if(done)push({id:'D-DONE-'+identity(sh),at:done,type:'status',label:sh.archivedAt?de('shipmentHistory.action.statusArchived'):de('shipmentHistory.action.statusCompleted'),actor:actorFrom({name:q(sh.completedBy||sh.archivedBy)||'ExportHUB'})});
 return out
}
function allEvents(sh){
 var map=new Map(),add=function(e){var key=q(e&&e.id)||[q(e&&e.at),q(e&&e.type),q(e&&e.label),q(e&&e.actor&&e.actor.name)].join('|');if(!map.has(key))map.set(key,e)};
 mergedHistory(sh).forEach(add);copiesOf(sh).forEach(function(copy){derived(copy).forEach(add)});
 return Array.from(map.values()).sort(function(a,b){return Date.parse(b.at||0)-Date.parse(a.at||0)})
}
function formatDate(v){var d=new Date(v);if(!Number.isFinite(d.getTime()))return q(v)||'—';try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.formatDate==='function')return w.ExportHUBI18n.formatDate(d,{dateStyle:'short',timeStyle:'medium'})}catch(_){}return new Intl.DateTimeFormat(locale(),{dateStyle:'short',timeStyle:'medium'}).format(d)}
function icon(type){return({created:'＋',saved:'✓',status:'↔',mail:'✉','mail-sent':'✓',print:'⎙','document-open':'↗','document-download':'↓',avis:'A',abd:'D',pickup:'⇢',pod:'P',document:'D',registration:'R','work-start':'▶'})[type]||'•'}
function detailField(key,value){return tr('shipmentHistory.detail.'+key)+': '+value}
function documentDisplay(doc){var raw=q(doc),map={};map[de('shipmentHistory.document.invoice')]='shipmentHistory.document.invoice';map[de('shipmentHistory.document.deliveryNote')]='shipmentHistory.document.deliveryNote';map[de('shipmentHistory.document.coverSheet')]='shipmentHistory.document.coverSheet';map[de('shipmentHistory.document.stowagePlan')]='shipmentHistory.document.stowagePlan';map[de('shipmentHistory.document.loadingList')]='shipmentHistory.document.loadingList';map[de('shipmentHistory.document.totalPrint')]='shipmentHistory.document.totalPrint';map[de('shipmentHistory.document.generic')]='shipmentHistory.document.generic';map[de('shipmentHistory.document.abdDocument')]='shipmentHistory.document.abdDocument';map[de('shipmentHistory.document.shippingDocument')]='shipmentHistory.document.shippingDocument';map['POD']='shipmentHistory.document.pod';return map[raw]?tr(map[raw]):raw||tr('shipmentHistory.document.generic')}
function mailTypeDisplay(kind){var raw=q(kind),map={};map[de('shipmentHistory.mail.abdRequest')]='shipmentHistory.mail.abdRequest';map[de('shipmentHistory.mail.registration')]='shipmentHistory.mail.registration';map[de('shipmentHistory.mail.avis')]='shipmentHistory.mail.avis';map[de('shipmentHistory.mail.email')]='shipmentHistory.mail.email';return map[raw]?tr(map[raw]):raw}
function actorDisplay(actor){var raw=q(actor&&actor.name),keys=['shipmentHistory.actor.unknown','shipmentHistory.actor.qrPickup','shipmentHistory.actor.historical'];for(var i=0;i<keys.length;i++){if(raw===keys[i]||raw===de(keys[i]))return tr(keys[i])}return raw||tr('shipmentHistory.actor.unknown')}
function roleDisplay(role){var raw=q(role),keys=['shipmentHistory.role.loading','shipmentHistory.role.driver'];for(var i=0;i<keys.length;i++){if(raw===keys[i]||raw===de(keys[i]))return tr(keys[i])}return raw}
function detailsText(e){var d=e.details||{},parts=[];if(d.document)parts.push(detailField('document',d.documentType?documentDisplay(d.documentType):q(d.document)));if(d.fileName)parts.push(detailField('file',q(d.fileName)));if(d.oldFile||d.newFile)parts.push(detailField('file',q(d.oldFile||'—')+' → '+q(d.newFile||'—')));if(d.files)parts.push(detailField('files',q(d.files)));if(d.mailType)parts.push(detailField('mail',mailTypeDisplay(d.mailType)));if(d.to)parts.push(detailField('recipient',q(d.to)));if(d.from&&d.to)parts.push(q(d.from)+' → '+q(d.to));if(d.driver)parts.push(detailField('driver',q(d.driver)));if(d.licensePlate)parts.push(detailField('licensePlate',q(d.licensePlate)));if(Number.isFinite(Number(d.colli)))parts.push(detailField('colli',d.colli));return parts.join(' · ')}
function viewName(){var s=state();return low(s.view||s.currentView||s.activeView||'')}
function shipmentView(){var v=viewName();if(v)return v==='shipment'||v==='sendung'||/shipment|sendung/.test(v);try{return !!(document.querySelector('#rc380StowPlan,#rc543MailArea'))}catch(_){return false}}
function actionKeyMatch(label,key){var legacy=de(key);return label===key||(legacy!==key&&label===legacy)}
function displayAction(e){
 var label=q(e&&e.label),l=low(label),d=e&&e.details||{},type=q(e&&e.type),doc=documentDisplay(d.documentType||d.document);
 if(type==='document-open')return tr('shipmentHistory.action.documentOpened',{document:doc});
 if(type==='document-download')return tr('shipmentHistory.action.documentDownloaded',{document:doc});
 if(type==='print')return tr('shipmentHistory.action.documentPrinted',{document:doc});
 if(d.change==='replaced')return tr('shipmentHistory.action.documentReplaced',{document:documentDisplay(d.documentType)});
 if(d.change==='removed')return tr('shipmentHistory.action.documentRemoved',{document:documentDisplay(d.documentType)});
 if(d.change==='added')return tr('shipmentHistory.action.documentAdded',{document:documentDisplay(d.documentType)});
 if(/abd.*druck.*pdf.*gestartet/.test(l)||actionKeyMatch(label,'shipmentHistory.legacy.abdRequested'))return tr('shipmentHistory.action.abdRequestCreated');
 if(actionKeyMatch(label,'shipmentHistory.action.abdEmailOpened'))return tr('shipmentHistory.action.abdEmailOpened');
 if(actionKeyMatch(label,'shipmentHistory.legacy.abdDocumentAdded'))return tr('shipmentHistory.action.abdUploaded');
 var keys=['shipmentHistory.action.statusCancelled','shipmentHistory.action.statusRework','shipmentHistory.action.statusCompleted','shipmentHistory.action.statusArchived','shipmentHistory.action.pickupPlanned','shipmentHistory.action.pickupConfirmed','shipmentHistory.action.partialPickupConfirmed','shipmentHistory.action.shipmentCreated','shipmentHistory.action.shipmentCaptured','shipmentHistory.action.avisCreated','shipmentHistory.action.avisEnabled','shipmentHistory.action.avisDisabled','shipmentHistory.action.emailLogged','shipmentHistory.action.abdMailSent','shipmentHistory.action.registrationSent','shipmentHistory.action.avisSent','shipmentHistory.action.emailSent','shipmentHistory.action.podAvailable','shipmentHistory.action.abdRequestCreated','shipmentHistory.action.abdUploaded','shipmentHistory.action.registrationEmailStarted','shipmentHistory.action.registrationStarted','shipmentHistory.action.shipmentSavedManually','shipmentHistory.action.workStarted'];
 for(var i=0;i<keys.length;i++){if(actionKeyMatch(label,keys[i]))return tr(keys[i])}
 var added=de('shipmentHistory.change.added'),removed=de('shipmentHistory.change.removed'),replaced=de('shipmentHistory.change.replaced');
 if(added!== 'shipmentHistory.change.added'&&label.endsWith(' '+added))return tr('shipmentHistory.action.documentAdded',{document:documentDisplay(label.slice(0,-added.length).trim())});
 if(removed!== 'shipmentHistory.change.removed'&&label.endsWith(' '+removed))return tr('shipmentHistory.action.documentRemoved',{document:documentDisplay(label.slice(0,-removed.length).trim())});
 if(replaced!== 'shipmentHistory.change.replaced'&&label.endsWith(' '+replaced))return tr('shipmentHistory.action.documentReplaced',{document:documentDisplay(label.slice(0,-replaced.length).trim())});
 if(/^shipmentHistory\./.test(label))return tr(label);
 return label||tr('shipmentHistory.action.event')
}
function creatorMetaText(value){var text=String(value==null?'':value),labels=[de('shipmentHistory.meta.createdBy'),tr('shipmentHistory.meta.createdBy')];labels.forEach(function(label){if(!label||/^shipmentHistory\./.test(label))return;text=text.replace(new RegExp('([^\\s·])'+escRe(label),'g'),'$1 · '+label)});return text}
function repairCreatorMetaSpacing(){
 if(!w.document||!shipmentView()||!document.body||typeof document.querySelectorAll!=='function')return 0;
 var changed=0,nodes=document.querySelectorAll('#content .muted,#content .meta,#content [class*="meta"],main .muted,main .meta,main [class*="meta"]'),labels=[de('shipmentHistory.meta.createdBy'),tr('shipmentHistory.meta.createdBy')].filter(function(x){return x&&!/^shipmentHistory\./.test(x)});
 Array.prototype.forEach.call(nodes,function(el){
   if(!el||el.id==='rc1071ShipmentHistory'||(el.closest&&el.closest('#rc1071ShipmentHistory')))return;
   var text=String(el.textContent||'');if(!labels.some(function(label){return text.indexOf(label)>=0})||text.length>240)return;var localChanged=false;
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
 var events=allEvents(sh),actionHead=tr('shipmentHistory.column.action'),userHead=tr('shipmentHistory.column.user'),timeHead=tr('shipmentHistory.column.time');
 var rows=events.length?events.map(function(e){return'<tr class="rc1071-history-row"><td data-label="'+esc(actionHead)+'" class="rc1071-history-action">'+esc(displayAction(e))+'</td><td data-label="'+esc(userHead)+'" class="rc1071-history-user">'+esc(actorDisplay(e.actor))+(e.actor&&e.actor.role?'<small>'+esc(roleDisplay(e.actor.role))+'</small>':'')+'</td><td data-label="'+esc(timeHead)+'" class="rc1071-history-time">'+esc(formatDate(e.at))+'</td></tr>'}).join(''):'<tr><td colspan="3" class="rc1071-history-empty">'+esc(tr('shipmentHistory.empty'))+'</td></tr>';
 old.innerHTML='<div class="rc1071-history-head"><div><span class="pill blue">'+esc(tr('shipmentHistory.badge'))+'</span><h3>'+esc(tr('shipmentHistory.title'))+'</h3><div class="muted">'+esc(tr('shipmentHistory.subtitle',{reference:ref(sh)||identity(sh)}))+'</div></div><span class="pill gray">'+esc(tr('shipmentHistory.eventCount',{count:events.length}))+'</span></div><div class="rc1071-history-list"><table class="rc1071-history-table"><thead><tr><th>'+esc(actionHead)+'</th><th>'+esc(userHead)+'</th><th>'+esc(timeHead)+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 ensureStyle();return true
}
function ensureStyle(){if(document.getElementById('rc1071ShipmentHistoryStyle'))return;var s=document.createElement('style');s.id='rc1071ShipmentHistoryStyle';s.textContent='.rc1071-history{margin-top:16px}.rc1071-history-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}.rc1071-history-head h3{margin:6px 0 2px}.rc1071-history-list{margin-top:12px;max-height:520px;overflow:auto;border:1px solid #dbe4ec;border-radius:12px;background:#fff}.rc1071-history-table{width:100%;border-collapse:collapse;min-width:680px}.rc1071-history-table th{padding:10px 12px;text-align:left;background:#f1f5f9;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid #dbe4ec}.rc1071-history-table td{padding:11px 12px;border-bottom:1px solid #e7edf3;vertical-align:top;font-size:12px}.rc1071-history-table tbody tr:last-child td{border-bottom:0}.rc1071-history-action{font-weight:800;color:#0f172a}.rc1071-history-user{font-weight:700}.rc1071-history-user small{display:block;margin-top:2px;color:#64748b;font-weight:500}.rc1071-history-time{white-space:nowrap;color:#475569}.rc1071-history-empty{text-align:center;color:#64748b;padding:20px!important}@media(max-width:720px){.rc1071-history-list{max-height:none}.rc1071-history-table{min-width:0}.rc1071-history-table thead{display:none}.rc1071-history-table,.rc1071-history-table tbody,.rc1071-history-table tr,.rc1071-history-table td{display:block;width:100%}.rc1071-history-table tr{padding:8px 10px;border-bottom:1px solid #dbe4ec}.rc1071-history-table td{display:grid;grid-template-columns:120px 1fr;gap:8px;padding:5px 0;border:0}.rc1071-history-table td:before{content:attr(data-label);font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b}}';(document.head||document.documentElement).appendChild(s)}
function documentLabel(text){text=low(text);if(/\babd\b|ausfuhrbegleit/.test(text))return'ABD';if(/\bpod\b|proof of delivery|abliefer/.test(text))return'POD';if(/cmr/.test(text))return'CMR';if(/rechnung|invoice/.test(text))return'Rechnung';if(/lieferschein|liefer.?schein|delivery note/.test(text))return'Lieferschein';if(/deckblatt/.test(text))return'Deckblatt';if(/stauplan/.test(text))return'Stauplan';if(/ladeliste/.test(text))return'Ladeliste';if(/gesamt/.test(text)&&/druck|ausgabe|pdf/.test(text))return'Gesamtdruck';if(/l1/.test(text)&&/qr/.test(text))return'L1 QR';if(/\bl2\b/.test(text))return'L2';if(/pdf/.test(text))return'PDF';return'Dokument'}
function cleanDocumentFileName(value){
 value=q(value);if(!value||/^data:/i.test(value))return'';
 try{value=decodeURIComponent(value)}catch(_){}
 value=value.split('#')[0].split('?')[0];
 var pdf=value.match(/([^\\/:<>"|?*]+\.pdf)\b/i);if(pdf)return q(pdf[1]);
 var parts=value.split('/'),last=q(parts[parts.length-1]);return /\.pdf$/i.test(last)?last:''
}
function documentFilesFor(sh,doc){
 var keys=doc==='ABD'?['abdFiles']:doc==='POD'?['podFiles']:doc==='Rechnung'?['invoiceFiles']:doc==='Lieferschein'?['deliveryFiles','deliveryNotesFiles','lieferscheine']:[];
 var out=[];keys.forEach(function(key){arr(sh&&sh[key]).forEach(function(file,index){var name=fileName(file,index);if(name)out.push(name)})});return out
}
function documentActionFileName(el,contextText,doc){
 var vals=[],sh=currentShipment(),add=function(v){v=q(v);if(v&&v.length<=500&&!/^data:/i.test(v))vals.push(v)};
 try{['data-file-name','data-filename','data-document-name','download','title','aria-label'].forEach(function(name){add(el&&el.getAttribute&&el.getAttribute(name))});add(el&&el.getAttribute&&el.getAttribute('href'))}catch(_){}
 try{var box=el&&el.closest&&el.closest('[data-file-name],[data-filename],[data-document-name],[data-document],[data-doc-type],.document,.file,.attachment,.card,.panel,.field');if(box){['data-file-name','data-filename','data-document-name','data-document','title','aria-label'].forEach(function(name){add(box.getAttribute&&box.getAttribute(name))});add(box.textContent)}}catch(_){}
 add(contextText);
 for(var i=0;i<vals.length;i++){var exact=cleanDocumentFileName(vals[i]);if(exact)return exact}
 var stored=documentFilesFor(sh,doc);if(stored.length===1)return stored[0];
 var reference=ref(sh);if(doc&&doc!=='Dokument'&&doc!=='PDF')return doc.replace(/\s+/g,'_')+(reference?'_'+reference:'')+'.pdf';
 return''
}
function recordDocumentAction(sh,action,doc,file){
 var details={document:doc,fileName:file,reference:ref(sh)};
 if(action==='open')return append(sh,{type:'document-open',label:de('shipmentHistory.action.documentOpened',{document:doc}),actor:actorFrom(currentUser()),details:details});
 if(action==='download')return append(sh,{type:'document-download',label:de('shipmentHistory.action.documentDownloaded',{document:doc}),actor:actorFrom(currentUser()),details:details});
 return append(sh,{type:'print',label:de('shipmentHistory.action.documentPrinted',{document:doc}),actor:actorFrom(currentUser()),details:details})
}
function mailRecipient(href){try{return decodeURIComponent(String(href||'').replace(/^mailto:/i,'').split('?')[0])}catch(_){return q(href).replace(/^mailto:/i,'').split('?')[0]}}
function mailSubject(href){try{var raw=String(href||''),query=raw.indexOf('?')>=0?raw.slice(raw.indexOf('?')+1):'',parts=query.split('&');for(var i=0;i<parts.length;i++){var p=parts[i].split('='),k=decodeURIComponent(p.shift()||'').toLowerCase();if(k==='subject')return decodeURIComponent(p.join('=').replace(/\+/g,' '))}}catch(_){}return''}
function mailTypeFrom(text){var l=low(text);if(/\babd\b|ausfuhrbegleit/.test(l))return'ABD-Anfrage';if(/anmeld|registrier|versandbestät/.test(l))return'Versandanmeldung';if(/lieferavis|abholung|collection notice/.test(l))return'Lieferavis';return'E-Mail'}
function elementContext(el,text){var out=q(text);try{var box=el&&el.closest&&el.closest('[data-document],[data-doc-type],section,fieldset,.card,.panel,.field');if(box&&box!==el)out+=' '+q(box.getAttribute&&box.getAttribute('data-document'))+' '+q(box.getAttribute&&box.getAttribute('data-doc-type'))+' '+q(box.getAttribute&&box.getAttribute('aria-label'))+' '+q(box.textContent)}catch(_){}return out}
function recordMailSent(sh,contextText){var mailMeta=LAST_MAIL_META[identity(sh)]||{},mailKind=q(mailMeta.mailType)||mailTypeFrom(contextText)||'E-Mail',sentLabel=mailSentLabel(mailKind);return append(sh,{type:'mail-sent',label:sentLabel,actor:actorFrom(currentUser()),details:{reference:ref(sh),to:q(mailMeta.to),subject:q(mailMeta.subject),mailType:mailKind}})}
function printFromElement(el){
 var sh=currentShipment();if(!el||!sh)return false;
 var text=q(el.textContent)+' '+q(el.getAttribute&&el.getAttribute('title'))+' '+q(el.getAttribute&&el.getAttribute('data-action')),actionText=low(text),contextText=elementContext(el,text);
 var doc=documentLabel(contextText),knownDoc=doc!=='Dokument',file=documentActionFileName(el,contextText,doc);
 if(!knownDoc||!/druck|print|gesamtausgabe/.test(actionText))return false;
 var key='print|'+identity(sh)+'|'+doc+'|'+file;
 if(!actionOnce(key,1800))return true;
 recordDocumentAction(sh,'print',doc,file);return true
}
function printBubble(ev){
 var el=ev&&ev.target&&ev.target.closest&&ev.target.closest('button,a,[role="button"]');
 return printFromElement(el)
}
function click(ev){
 var el=ev.target&&ev.target.closest&&ev.target.closest('button,a,[role="button"]');if(!el)return;var sh=currentShipment();if(!sh)return;
 var text=q(el.textContent)+' '+q(el.getAttribute&&el.getAttribute('title'))+' '+q(el.getAttribute&&el.getAttribute('data-action')),actionText=low(text),contextText=elementContext(el,text),l=low(contextText);
 var href=q(el.getAttribute&&el.getAttribute('href'));
 if(/^mailto:/i.test(href)||/outlook|e-?mail.*öffnen|mail.*öffnen|anmeldung.*mail/.test(l)){
   var to=/^mailto:/i.test(href)?mailRecipient(href):'',subject=/^mailto:/i.test(href)?mailSubject(href):'',mailKind=mailTypeFrom(contextText+' '+subject);
   LAST_MAIL_META[identity(sh)]={to:to,subject:subject,mailType:mailKind,at:now()};
   if(mailKind==='ABD-Anfrage'){if(actionOnce('abd-mail|'+identity(sh)+'|'+to,2500))append(sh,{type:'abd',label:de('shipmentHistory.action.abdEmailOpened'),actor:actorFrom(currentUser()),details:{to:to,subject:subject,mailType:mailKind,reference:ref(sh)}});return}
   if(/anmeld|registrier|versandbestät/i.test(l)&&actionOnce('registration-mail|'+identity(sh)+'|'+to,2500))append(sh,{type:'registration',label:de('shipmentHistory.action.registrationEmailStarted'),actor:actorFrom(currentUser()),details:{to:to,subject:subject,mailType:mailKind,reference:ref(sh)}});
   if(actionOnce('mail-sent-open|'+identity(sh)+'|'+mailKind+'|'+to,2500))recordMailSent(sh,contextText);return
 }
 if(/\babd\b/.test(l)&&/anfordern|anfrage|request/.test(actionText)){
   if(actionOnce('abd-request|'+identity(sh),2500))append(sh,{type:'abd',label:de('shipmentHistory.action.abdRequestCreated'),actor:actorFrom(currentUser()),details:{reference:ref(sh)}});return
 }
 if(/anmeld|registrier|versandbestät/.test(l)&&!/login|anmeldung erforderlich/.test(l)){
   if(actionOnce('registration|'+identity(sh),2500))append(sh,{type:'registration',label:de('shipmentHistory.action.registrationStarted'),actor:actorFrom(currentUser()),details:{reference:ref(sh),action:q(el.textContent)}});return
 }
 var doc=documentLabel(contextText),knownDoc=doc!=='Dokument',file=documentActionFileName(el,contextText,doc);
 if(knownDoc&&/druck|print|gesamtausgabe/.test(actionText)){
   printFromElement(el);return
 }
 if(knownDoc&&/download|herunterladen/.test(actionText)){
   if(actionOnce('document-download|'+identity(sh)+'|'+doc+'|'+file,1800))recordDocumentAction(sh,'download',doc,file);return
 }
 if(knownDoc&&(/öffnen|open|anzeigen|view|pdf/.test(actionText)||(/\.pdf(?:[?#]|$)/i.test(href)))){
   if(actionOnce('document-open|'+identity(sh)+'|'+doc+'|'+file,1800))recordDocumentAction(sh,'open',doc,file);return
 }
 if(knownDoc&&/cmr|ladeliste|stauplan|deckblatt|lieferschein|\babd\b|\bpod\b|l1|\bl2\b/.test(l)){
   if(actionOnce('document-open|'+identity(sh)+'|'+doc+'|'+file,1800))recordDocumentAction(sh,'open',doc,file);return
 }
 if(/speichern/.test(l)&&!/einstellung|vorlage|stammdaten/.test(l)){
   if(actionOnce('save|'+identity(sh),2500))append(sh,{type:'saved',label:de('shipmentHistory.action.shipmentSavedManually'),actor:actorFrom(currentUser()),details:{status:statusOf(sh)}});return
 }
}
function fileChange(ev){var input=ev.target;if(!input||String(input.type||'').toLowerCase()!=='file'||!input.files||!input.files.length)return;var sh=currentShipment();if(!sh)return;var ctx=low((input.id||'')+' '+(input.name||'')+' '+(input.closest&&input.closest('label,.field,.card')&&input.closest('label,.field,.card').textContent||'')),kind=/pod/.test(ctx)?'POD':/abd/.test(ctx)?'ABD':/liefer|delivery/.test(ctx)?'Lieferschein':'Dokument';append(sh,{type:kind==='POD'?'pod':kind==='ABD'?'abd':'document',label:de('shipmentHistory.action.uploadSelected',{document:kind}),actor:actorFrom(currentUser()),details:{files:Array.from(input.files).map(function(f){return q(f.name)}).join(', '),documentType:kind}})}
function avisUpdated(ev){var sh=currentShipment();if(!sh)return;var d=ev&&ev.detail||{},enabled=d.enabled!==false;append(sh,{type:'avis',label:enabled?de('shipmentHistory.action.avisCreated'):de('shipmentHistory.action.avisDisabled'),actor:actorFrom(currentUser()),details:{reference:q(d.reference)||ref(sh)}})}
function documentActionEvent(ev){var sh=currentShipment();if(!sh)return;var d=ev&&ev.detail||{},action=q(d.action),doc=q(d.document)||'Dokument',file=q(d.fileName);if(action!=='open'&&action!=='download'&&action!=='print')return;var key=(action==='print'?'print':'document-event|'+action)+'|'+identity(sh)+'|'+doc+'|'+file;if(actionOnce(key,action==='print'?1800:1200))recordDocumentAction(sh,action,doc,file)}
function markWorkStarted(){
 var sh=currentShipment();if(!sh||!shipmentView())return false;
 var actor=actorFrom(currentUser()),events=mergedHistory(sh),cutoff=Date.now()-4*60*60*1000;
 var recent=events.some(function(e){return e.type==='work-start'&&e.actor&&q(e.actor.id||e.actor.name)===q(actor.id||actor.name)&&(Date.parse(e.at||0)||0)>=cutoff});
 if(recent)return false;
 append(sh,{type:'work-start',label:de('shipmentHistory.action.workStarted'),actor:actor,details:{reference:ref(sh)}});
 return true
}
function schedule(){setTimeout(function(){try{hookPersist();monitor();markWorkStarted();repairCreatorMetaSpacing();render()}catch(e){try{console.warn('RC1071 History',e)}catch(_){}}},0)}
if(w.document){
 document.addEventListener('click',click,true);document.addEventListener('change',fileChange,true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 if(typeof MutationObserver!=='undefined'){var mo=new MutationObserver(function(){schedule()});try{mo.observe(document.documentElement,{childList:true,subtree:true})}catch(_){} }
}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:language-changed'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
try{w.addEventListener('click',printBubble,false)}catch(_){}
try{w.addEventListener('exporthub:customer-avis-updated',avisUpdated)}catch(_){}
try{w.addEventListener('exporthub:document-action',documentActionEvent)}catch(_){}
setInterval(function(){try{hookPersist();monitor()}catch(_){}},2500);
w.ExportHUBShipmentHistory1071=Object.freeze({version:'RC1178',append:append,events:allEvents,render:render,currentShipment:currentShipment,actor:actorFrom,monitor:monitor,markWorkStarted:markWorkStarted,documentLabel:documentLabel,documentActionFileName:documentActionFileName,recordDocumentAction:recordDocumentAction,printFromElement:printFromElement,printBubble:printBubble,mailTypeFrom:mailTypeFrom,mailSentLabel:mailSentLabel,statusLabel:statusLabel,displayAction:displayAction,creatorMetaText:creatorMetaText,repairCreatorMetaSpacing:repairCreatorMetaSpacing});
})(window);
