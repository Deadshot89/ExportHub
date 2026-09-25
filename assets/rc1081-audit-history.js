// ExportHUB RC1087 – zentrale Historie inklusive sicherheitsrelevanter Admin-Aktionen.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1081_AUDIT_HISTORY__)return;
w.__EXPORTHUB_RC1081_AUDIT_HISTORY__=true;
w.__EXPORTHUB_RC1084_HISTORY_DE__=true;
w.__EXPORTHUB_RC1086_HISTORY_COMPLETE__=true;
w.__EXPORTHUB_RC1087_ADMIN_AUDIT__=true;
w.__EXPORTHUB_RC1087_RELEASE__=true;

var FILTER={query:'',type:'all',subtype:'all',actor:'all',entity:'all',days:0,from:'',to:''};

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function view(){var s=state();return low(s.view||s.currentView||s.activeView||s.page||'')}
function historyView(){var v=view();return v==='history'||v==='historie'}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function tr(key,vars){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars)}catch(_){}return key}
function th(key,vars){return esc(tr(key,vars))}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function')return w.ExportHUBI18n.language()}catch(_){}return'de'}
function locale(){return({de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'})[lang()]||'de-DE'}
function fmt(v){var raw=q(v),x;if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){var p=raw.split('-').map(Number);x=new Date(p[0],p[1]-1,p[2]);try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.formatDate==='function')return w.ExportHUBI18n.formatDate(x,{dateStyle:'short'})}catch(_){}return new Intl.DateTimeFormat(locale(),{dateStyle:'short'}).format(x)}x=new Date(v);if(!Number.isFinite(x.getTime()))return raw||'—';try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.formatDate==='function')return w.ExportHUBI18n.formatDate(x,{dateStyle:'short',timeStyle:'medium'})}catch(_){}return new Intl.DateTimeFormat(locale(),{dateStyle:'short',timeStyle:'medium'}).format(x)}
function identity(sh){return q(sh&&(sh.id||sh.shipmentId||sh.reference||sh.ref||sh.shipmentRef||sh.referenceNumber)).toUpperCase()}
function shipmentRef(sh){return q(sh&&(sh.reference||sh.ref||sh.shipmentRef||sh.referenceNumber||sh.id))}
function customerName(c){return q(c&&(c.name||c.customerName||c.companyName||c.account||c.customerNumber))||tr('history.entity.customer')}
function actorName(e){return q(e&&e.actor&&e.actor.name||e&&e.actor||e&&e.by||e&&e.user)||'System'}
function eventKey(e){return q(e&&e.id)||[q(e&&e.at),q(e&&e.type),q(e&&e.subtype),q(e&&e.label),actorName(e),q(e&&e.entityId)].join('|').toLowerCase()}
function pushUnique(map,e){if(!e||!q(e.at))return;var k=eventKey(e);if(k&&!map.has(k))map.set(k,e)}

var AUDIT_LABELS={
 LOGIN_SUCCESS:'history.audit.LOGIN_SUCCESS',
 LOGIN_FAILED:'history.audit.LOGIN_FAILED',
 LOGOUT:'history.audit.LOGOUT',
 PROFILE_DISPLAY_NAME_UPDATED:'history.audit.PROFILE_DISPLAY_NAME_UPDATED',
 USER_DISPLAY_NAME_UPDATED_BY_ADMIN:'history.audit.USER_DISPLAY_NAME_UPDATED_BY_ADMIN',
 USER_CREATED:'history.audit.USER_CREATED',
 USER_RIGHTS_UPDATED:'history.audit.USER_RIGHTS_UPDATED',
 USER_ACTIVATED:'history.audit.USER_ACTIVATED',
 USER_DEACTIVATED:'history.audit.USER_DEACTIVATED',
 PASSWORD_RESET:'history.audit.PASSWORD_RESET',
 PASSWORD_CHANGED:'history.audit.PASSWORD_CHANGED',
 ACCOUNT_UNLOCKED:'history.audit.ACCOUNT_UNLOCKED',
 SESSIONS_TERMINATED:'history.audit.SESSIONS_TERMINATED',
 INITIAL_ADMIN_BOOTSTRAPPED:'history.audit.INITIAL_ADMIN_BOOTSTRAPPED',
 INITIAL_ADMIN_RECOVERED:'history.audit.INITIAL_ADMIN_RECOVERED',
 ADMIN_ACCOUNT_UNLOCKED_WITH_PERSONAL_PASSWORD:'history.audit.ADMIN_ACCOUNT_UNLOCKED_WITH_PERSONAL_PASSWORD',
 DIAGNOSTIC_AUTOFIX_REQUESTED:'history.audit.DIAGNOSTIC_AUTOFIX_REQUESTED',
 DIAGNOSTIC_AUTOFIX_FIXED:'history.audit.DIAGNOSTIC_AUTOFIX_FIXED',
 DIAGNOSTIC_AUTOFIX_FAILED:'history.audit.DIAGNOSTIC_AUTOFIX_FAILED',
 LOADER_PIN_CREATED:'history.audit.LOADER_PIN_CREATED',
 LOADER_PIN_UPDATED:'history.audit.LOADER_PIN_UPDATED',
 LOADER_PIN_STATUS_CHANGED:'history.audit.LOADER_PIN_STATUS_CHANGED',
 LOADER_PIN_DELETED:'history.audit.LOADER_PIN_DELETED',
 CUSTOMER_DELETED:'history.audit.CUSTOMER_DELETED',
 CUSTOMER_PORTAL_CREATED:'history.audit.CUSTOMER_PORTAL_CREATED',
 CUSTOMER_PORTAL_UPDATED:'history.audit.CUSTOMER_PORTAL_UPDATED',
 CUSTOMER_PORTAL_DELETED:'history.audit.CUSTOMER_PORTAL_DELETED',
 CUSTOMER_PORTAL_REVEALED:'history.audit.CUSTOMER_PORTAL_REVEALED',
 CUSTOMER_PORTAL_REVEAL_DENIED:'history.audit.CUSTOMER_PORTAL_REVEAL_DENIED'
};
var SHIPMENT_LABELS={
 created:'history.shipment.created',saved:'history.shipment.saved',status:'history.shipment.status',mail:'history.shipment.mail','mail-sent':'history.shipment.mail-sent',print:'history.shipment.print','document-open':'history.shipment.document-open','document-download':'history.shipment.document-download',avis:'history.shipment.avis',abd:'history.shipment.abd',pickup:'history.shipment.pickup','pickup-plan':'history.shipment.pickup-plan',pod:'history.shipment.pod',document:'history.shipment.document',registration:'history.shipment.registration','work-start':'history.shipment.work-start',event:'history.shipment.event'
};
var CUSTOMER_LABELS={'customer-created':'history.customer.customer-created','customer-updated':'history.customer.customer-updated'};
var TASK_LABELS={'task-created':'history.task.task-created','task-completed':'history.task.task-completed','task-cancelled':'history.task.task-cancelled'};
var PALLET_LABELS={'pallet-in':'history.pallet.pallet-in','pallet-out':'history.pallet.pallet-out','pallet-exchange':'history.pallet.pallet-exchange','pallet-correction':'history.pallet.pallet-correction','pallet-booking':'history.pallet.pallet-booking'};

function typeLabel(type){var key=({shipment:'history.type.shipment',customer:'history.type.customer',task:'history.type.task',pallet:'history.type.pallet',audit:'history.type.audit'})[type]||'history.type.other';return tr(key)}
function entityDisplay(value){var raw=q(value),key=({'System':'history.entity.system','Verlader-PIN':'history.entity.loaderPin','Kunde':'history.entity.customer','Kundenportal':'history.entity.customerPortal','Benutzer':'history.entity.user','Sendung':'history.entity.shipment','Aufgabe':'history.entity.task','Palettenkonto':'history.entity.pallet'})[raw];return key?tr(key):raw}
function actionLabel(e){
 var subtype=q(e&&e.subtype),key='';
 if(e&&e.type==='audit')key=AUDIT_LABELS[subtype]||'history.generic.system';
 else if(e&&e.type==='customer')key=CUSTOMER_LABELS[subtype]||'history.generic.customer';
 else if(e&&e.type==='task')key=TASK_LABELS[subtype]||'history.generic.task';
 else if(e&&e.type==='pallet')key=PALLET_LABELS[subtype]||'history.generic.pallet';
 else if(e&&e.type==='shipment')key=SHIPMENT_LABELS[subtype]||'history.generic.shipment';
 else key='history.generic.action';
 return tr(key)
}
function shipmentLegacyCode(raw){
 var value=q(raw),k=low(value);
 if(/abd.*druck.*pdf.*gestartet/.test(k)||value==='ABD angefordert')return'abdRequestCreated';
 if(value==='ABD-Anfrage per E-Mail gestartet')return'abdEmailOpened';
 if(value==='ABD-Dokument hinzugefügt')return'abdUploaded';
 if(/^sendung\s+(?:erfasst|angelegt|erstellt)$/i.test(value))return'shipmentCreated';
 if(/^lieferavis\s+(?:aktiviert|erstellt|erstellt\s*\/\s*aktiviert)$/i.test(value))return'avisCreated';
 return''
}
function shipmentActionTitle(raw,subtype){
 var code=shipmentLegacyCode(raw);
 if(code)return tr('history.special.'+code);
 var key=SHIPMENT_LABELS[q(subtype)];
 if(key)return tr(key);
 return q(raw)||tr('history.generic.shipment')
}
function actionTitle(e){
 var raw=q(e&&e.label),mapped=actionLabel(e);
 if(e&&e.type==='audit')return mapped;
 if(e&&e.type==='shipment')return shipmentActionTitle(raw,e&&e.subtype);
 if(e&&(e.type==='customer'||e.type==='task'||e.type==='pallet'))return mapped;
 if(raw&&raw!==subtypeTechnical(e))return raw;
 return mapped
}
function subtypeTechnical(e){return q(e&&e.subtype).replace(/[-_]+/g,' ')}
function actionKey(e){var raw=q(e&&e.label),special=e&&e.type==='shipment'?shipmentLegacyCode(raw):'',canonical=special||low(raw||subtypeTechnical(e));return q(e&&e.type)+'|'+q(e&&e.subtype)+'|'+canonical}
function duplicateKey(e){var special=e&&e.type==='shipment'?shipmentLegacyCode(e.label):'';return special?q(e&&e.type)+'|'+special:actionKey(e)}
function duplicateWindowMs(e){
 if(!e||e.type!=='shipment')return 0;
 var code=shipmentLegacyCode(e.label);
 if(code==='shipmentCreated'||code==='avisCreated')return 8000;
 return 0
}
function actorQuality(e){
 var name=low(actorName(e));if(!name)return 0;
 if(/^history\.actor\./.test(name))return 0;
 return /^(?:system|exporthub|nicht protokolliert)(?:\b|\s|·)/.test(name)?0:20
}
function eventQuality(e){
 var score=actorQuality(e),details=e&&e.details||{},raw=q(e&&e.label);
 if(e&&e.actor&&q(e.actor.role))score+=2;
 if(q(details.reference))score+=4;
 if(q(details.action))score+=2;
 if(q(details.to)||q(details.subject))score+=1;
 if(raw)score+=3;
 if(e&&e.subtype==='created')score+=3;
 return score
}
function consolidateEvents(events){
 var out=[];
 arr(events).forEach(function(e){
  var win=duplicateWindowMs(e);
  if(!win){out.push(e);return}
  var ts=Date.parse(e.at||0)||0,title=actionTitle(e),entity=q(e.entityId);
  var idx=-1;
  for(var i=0;i<out.length;i++){
   var x=out[i],xt=Date.parse(x.at||0)||0;
   if(x.type===e.type&&q(x.entityId)===entity&&duplicateKey(x)===duplicateKey(e)&&Math.abs(xt-ts)<=win){idx=i;break}
  }
  if(idx<0){out.push(e);return}
  if(eventQuality(e)>eventQuality(out[idx]))out[idx]=e
 });
 return out.sort(function(a,b){return Date.parse(b.at||0)-Date.parse(a.at||0)})
}

function auditEvent(e){
 var details=e&&e.details||{},subtype=q(e&&e.type),entity='System',entityId=q(details.userId||details.username);
 if(/^LOADER_PIN_/.test(subtype)){entity='Verlader-PIN';entityId=q(details.loaderName||details.loaderId)||tr('history.entity.pinAdmin')}
 else if(subtype==='CUSTOMER_DELETED'){entity='Kunde';entityId=q(details.account||details.customerId||details.customer)||tr('history.entity.customer')}
 else if(/^CUSTOMER_PORTAL_/.test(subtype)){entity='Kundenportal';entityId=q(details.portalName||details.portalId||details.customerId)||tr('history.entity.customerPortal')}
 else if(entityId)entity='Benutzer';
 return{id:q(e&&e.id),at:q(e&&e.at),type:'audit',subtype:subtype,label:tr(AUDIT_LABELS[subtype]||'history.generic.system'),actor:{name:actorName(e)},entity:entity,entityId:entityId,details:details,source:'audit'}
}
function shipmentEvent(sh,e){
 var ref=shipmentRef(sh)||identity(sh)||tr('history.entity.shipment');
 return{id:q(e&&e.id),at:q(e&&e.at),type:'shipment',subtype:q(e&&e.type)||'event',label:q(e&&e.label),actor:e&&e.actor||{name:actorName(e)},entity:'Sendung',entityId:ref,details:e&&e.details||{},source:q(e&&e.source)||'shipment'}
}
function customerEvent(c,e){
 return{id:q(e&&e.id),at:q(e&&e.at),type:'customer',subtype:q(e&&e.type),label:q(e&&e.label),actor:e&&e.actor||{name:actorName(e)},entity:'Kunde',entityId:q(c&&c.account||c&&c.customerNumber||c&&c.kundennummer)||customerName(c),details:e&&e.details||{},source:'customer'}
}

function systemActor(v){
 var raw=q(v),k=low(raw);
 if(!raw)return'history.actor.notLogged';
 if(k==='system:pod')return'history.actor.systemPod';
 if(k==='system:abd')return'history.actor.systemAbd';
 if(k==='system:pick')return'history.actor.systemPick';
 if(k==='system:pickup')return'history.actor.systemPickup';
 if(k==='system:shipment')return'history.actor.systemShipment';
 if(k==='system:cancel')return'history.actor.systemCancel';
 return raw
}
function actorDisplay(v){
 var raw=typeof v==='object'?actorName(v):q(v);
 if(raw==='System')return tr('history.entity.system');
 return /^history\.actor\./.test(raw)?tr(raw):raw
}
function taskEntityId(t){return q(t&&(t.sourceRef||t.linkedShipmentRef||t.shipmentRef||t.reference||t.ref||t.id))||tr('history.entity.task')}
function taskEvents(t){
 var out=[],id=q(t&&t.id)||taskEntityId(t),title=q(t&&t.title)||q(t&&t.group)||tr('history.entity.task'),
     ref=q(t&&(t.sourceRef||t.linkedShipmentRef||t.shipmentRef||t.reference||t.ref)),
     group=q(t&&t.group),assignee=q(t&&(t.effectiveAssignee||t.originalAssignee||t.assignee||t.owner)),
     due=q(t&&(t.dueAt||t.dueDate||t.date)),created=q(t&&(t.createdAt||t.created||t.createdOn)),
     completed=q(t&&(t.completedAt||t.doneAt||t.closedAt)),status=low(t&&t.status),
     createdBy=q(t&&(t.createdBy||t.creator||t.createdUser||t.createdUserName)),
     completedBy=q(t&&(t.completedBy||t.doneBy||t.closedBy));
 function add(suffix,at,subtype,actor){if(!at)return;out.push({id:'D-TASK-'+suffix+'-'+id,at:at,type:'task',subtype:subtype,label:tr(TASK_LABELS[subtype]||'history.generic.task'),actor:{name:systemActor(actor)},entity:'Aufgabe',entityId:title,details:{taskId:id,reference:ref,group:group,assignee:assignee,dueAt:due,status:q(t&&t.status)},source:'task-derived'})}
 add('CREATED',created,'task-created',createdBy);
 if(completed)add('COMPLETED',completed,/cancel|storn/.test(status)?'task-cancelled':'task-completed',completedBy);
 return out
}
function palletDirection(p){
 var raw=low(p&&(p.direction||p.dir||p.movement||p.bookingType||p.transactionType||p.transaction||p.action));
 if(/eingang|input|inbound|receipt|return|rück|rueck/.test(raw))return'pallet-in';
 if(/ausgang|output|outbound|issue|dispatch/.test(raw))return'pallet-out';
 if(/tausch|exchange|swap/.test(raw))return'pallet-exchange';
 if(/korrekt|adjust|ausgleich/.test(raw))return'pallet-correction';
 return'pallet-booking'
}
function palletEvents(p,index){
 var at=q(p&&(p.at||p.createdAt||p.bookedAt||p.bookingAt||p.timestamp||p.date));
 if(!at)return[];
 var subtype=palletDirection(p),actor=q(p&&(p.createdBy||p.bookedBy||p.userName||p.username||p.user||p.by)),
     ref=q(p&&(p.shipmentRef||p.reference||p.ref)),count=Number(p&&(p.count!=null?p.count:(p.quantity!=null?p.quantity:p.amount))),
     palletType=q(p&&(p.palletType||p.typeName||p.packaging||p.pallet)),customer=q(p&&(p.customerName||p.customer||p.customerAccount)),
     id=q(p&&(p.id||p._syncId))||String(index||0);
 return[{id:'D-PALLET-'+id,at:at,type:'pallet',subtype:subtype,label:tr(PALLET_LABELS[subtype]||'history.generic.pallet'),actor:{name:systemActor(actor)},entity:'Palettenkonto',entityId:ref||customer||id,details:{reference:ref,count:Number.isFinite(count)?count:undefined,palletType:palletType,customer:customer,direction:q(p&&(p.direction||p.dir||p.movement||p.bookingType||p.transactionType))},source:'pallet-derived'}]
}
function allShipments(){
 var s=state(),list=[];
 ['shipments','savedShipments','shipmentArchive','archivedShipments','salesSharedShipments','sharedShipments'].forEach(function(k){arr(s[k]).forEach(function(sh){if(sh&&typeof sh==='object')list.push(sh)})});
 return list
}
function shipmentEvents(sh){
 var api=w.ExportHUBShipmentHistory1071;
 if(api&&typeof api.events==='function'){try{return arr(api.events(sh))}catch(_){}}
 return arr(sh&&sh.shipmentHistory)
}
function allEvents(){
 var s=state(),map=new Map();
 arr(s.auditLog).forEach(function(e){pushUnique(map,auditEvent(e))});
 allShipments().forEach(function(sh){shipmentEvents(sh).forEach(function(e){pushUnique(map,shipmentEvent(sh,e))})});
 arr(s.customers).forEach(function(c){arr(c&&c.customerHistory).forEach(function(e){pushUnique(map,customerEvent(c,e))})});
 arr(s.tasks).forEach(function(t){taskEvents(t).forEach(function(e){pushUnique(map,e)})});
 arr(s.palletAccount).forEach(function(p,i){palletEvents(p,i).forEach(function(e){pushUnique(map,e)})});
 return consolidateEvents(Array.from(map.values()).sort(function(a,b){return Date.parse(b.at||0)-Date.parse(a.at||0)}))
}
function field(key,value){return tr('history.field.'+key)+': '+value}
function detailText(e){
 var x=e&&e.details||{},parts=[];
 if(x.username)parts.push(field('user',q(x.username)));
 if(x.loaderName)parts.push(field('loader',q(x.loaderName)));
 if(x.loaderId)parts.push(field('loaderId',q(x.loaderId)));
 if(x.previousName||x.displayName)parts.push(field('name',(x.previousName?q(x.previousName)+' → ':'')+q(x.displayName)));
 if(x.customer)parts.push(field('customer',q(x.customer)));
 if(x.account)parts.push(field('customerNumber',q(x.account)));
 if(x.taskId)parts.push(field('task',q(x.taskId)));
 if(x.group)parts.push(field('group',q(x.group)));
 if(x.assignee)parts.push(field('owner',q(x.assignee)));
 if(x.dueAt)parts.push(field('due',q(x.dueAt)));
 if(x.palletType)parts.push(field('palletType',q(x.palletType)));
 if(x.direction)parts.push(field('direction',q(x.direction)));
 if(Number.isFinite(Number(x.count)))parts.push(field('count',Number(x.count)));
 if(x.document)parts.push(field('document',q(x.document)));
 if(x.files)parts.push(field('files',q(x.files)));
 if(x.mailType)parts.push(field('mail',q(x.mailType)));
 if(x.subject)parts.push(field('subject',q(x.subject)));
 if(x.from&&x.to)parts.push(field('change',q(x.from)+' → '+q(x.to)));
 else if(x.to)parts.push(field('recipient',q(x.to)));
 if(x.fields)parts.push(field('changed',q(x.fields)));
 if(x.status)parts.push(field('status',q(x.status)));
 if(x.reference)parts.push(field('reference',q(x.reference)));
 if(x.date)parts.push(field('date',q(x.date)+(x.time?' · '+q(x.time):'')));
 if(x.oldDate||x.newDate){var oldTime=[q(x.oldTimeFrom),q(x.oldTimeTo)].filter(Boolean).join('–'),newTime=[q(x.newTimeFrom),q(x.newTimeTo)].filter(Boolean).join('–');parts.push(field('pickupAppointment',(q(x.oldDate)||'—')+(oldTime?' '+oldTime:'')+' → '+(q(x.newDate)||'—')+(newTime?' '+newTime:'')))}
 if(x.oldPlate||x.newPlate)parts.push(field('licensePlate',(q(x.oldPlate)||'—')+' → '+(q(x.newPlate)||'—')));
 if(x.driver)parts.push(field('driver',q(x.driver)));
 if(x.licensePlate)parts.push(field('licensePlate',q(x.licensePlate)));
 if(Number.isFinite(Number(x.colli)))parts.push(field('colli',Number(x.colli)));
 if(Number.isFinite(Number(x.documents)))parts.push(field('documents',Number(x.documents)));
 if(Number.isFinite(Number(x.remaining)))parts.push(field('remaining',Number(x.remaining)));
 if(x.action)parts.push(field('trigger',q(x.action)));
 if(x.environment)parts.push(field('environment',q(x.environment)));
 if(x.diagnosticId)parts.push(field('errorId',q(x.diagnosticId)));
 if(Number.isFinite(Number(x.failedAttempts)))parts.push(field('failedAttempts',Number(x.failedAttempts)));
 if(typeof x.globalAdmin==='boolean')parts.push(field('globalAdmin',tr(x.globalAdmin?'common.yes':'common.no')));
 if(typeof x.active==='boolean')parts.push(field('active',tr(x.active?'common.yes':'common.no')));
 if(Number.isFinite(Number(x.terminated))&&Number(x.terminated)>0)parts.push(field('endedSessions',Number(x.terminated)));
 return Array.from(new Set(parts.filter(Boolean))).join(' · ')
}
function actorList(events){return Array.from(new Set(events.map(function(e){return actorName(e)}).filter(Boolean))).sort(function(a,b){return actorDisplay(a).localeCompare(actorDisplay(b),locale())})}
function actionList(events){
 var map=new Map();
 events.forEach(function(e){var k=actionKey(e);if(!map.has(k))map.set(k,{key:k,label:actionTitle(e),area:typeLabel(e.type)})});
 return Array.from(map.values()).sort(function(a,b){var x=a.label.localeCompare(b.label,locale());return x||a.area.localeCompare(b.area,locale())})
}
function filterEvents(events){
 var days=Number(FILTER.days||0),cutoff=days>0?Date.now()-days*86400000:0,needle=low(FILTER.query),
     from=FILTER.from?Date.parse(FILTER.from+'T00:00:00'):0,to=FILTER.to?Date.parse(FILTER.to+'T23:59:59.999'):0;
 return events.filter(function(e){
  var ts=Date.parse(e.at||'');
  if(cutoff&&Number.isFinite(ts)&&ts<cutoff)return false;
  if(from&&Number.isFinite(ts)&&ts<from)return false;
  if(to&&Number.isFinite(ts)&&ts>to)return false;
  if(FILTER.type!=='all'&&e.type!==FILTER.type)return false;
  if(FILTER.subtype!=='all'&&actionKey(e)!==FILTER.subtype)return false;
  if(FILTER.actor!=='all'&&actorName(e)!==FILTER.actor)return false;
  if(FILTER.entity!=='all'&&q(e.entity)!==FILTER.entity)return false;
  if(!needle)return true;
  var raw='';try{raw=JSON.stringify(e.details||{})}catch(_){}
  return low([actionTitle(e),actionLabel(e),e.entity,e.entityId,actorDisplay(e),e.actor&&e.actor.role,typeLabel(e.type),detailText(e),raw,fmt(e.at)].join(' ')).indexOf(needle)>=0
 })
}
function countType(events,type){return events.filter(function(e){return e.type===type}).length}
function ensureStyle(){
 if(d.getElementById('rc1081AuditHistoryStyle'))return;
 var s=d.createElement('style');s.id='rc1081AuditHistoryStyle';
 s.textContent='.rc1084-history{margin-top:12px}.rc1084-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap}.rc1084-head h3{margin:5px 0 3px;font-size:22px}.rc1084-summary{display:grid;grid-template-columns:repeat(6,minmax(110px,1fr));gap:8px;margin:14px 0}.rc1084-summary-card{padding:10px 12px;border:1px solid #dbe4ec;border-radius:12px;background:var(--surface,#fff)}.rc1084-summary-card b{display:block;font-size:20px}.rc1084-summary-card span{font-size:11px;color:#64748b}.rc1084-filters{display:grid;grid-template-columns:minmax(250px,1.5fr) repeat(4,minmax(145px,.7fr)) minmax(135px,.6fr) minmax(140px,.55fr) minmax(140px,.55fr);gap:8px;margin:12px 0 14px}.rc1084-filters label{display:grid;gap:4px;font-size:11px;font-weight:700;color:#475569}.rc1084-filters input,.rc1084-filters select{min-height:40px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:9px;background:var(--surface,#fff);color:inherit}.rc1084-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center}.rc1084-table-wrap{width:100%;overflow-x:auto;border:1px solid #dbe4ec;border-radius:12px;background:var(--surface,#fff)}.rc1084-table{width:100%;border-collapse:collapse;min-width:980px}.rc1084-table th{padding:9px 10px;background:#f1f5f9;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.03em;text-align:left;border-bottom:1px solid #dbe4ec}.rc1084-table td{padding:10px;border-bottom:1px solid #e7edf3;vertical-align:top;font-size:12px}.rc1084-table tr:last-child td{border-bottom:0}.rc1084-table tbody tr:hover{background:#f8fafc}.rc1084-time{white-space:nowrap;color:#475569}.rc1084-area{display:inline-flex;padding:4px 7px;border-radius:999px;background:#eef6ff;color:#1d4ed8;font-weight:750;white-space:nowrap}.rc1084-action-title{font-weight:800;color:#0f172a}.rc1084-user{font-weight:700}.rc1084-object{font-weight:700;color:#334155}.rc1084-detail{color:#64748b;line-height:1.35}.rc1084-empty{padding:24px;text-align:center;color:#64748b}.rc1084-count{font-size:12px;color:#64748b;margin-top:5px}@media(max-width:1180px){.rc1084-filters{grid-template-columns:repeat(3,1fr)}}@media(max-width:760px){.rc1084-summary{grid-template-columns:1fr 1fr}.rc1084-filters{grid-template-columns:1fr 1fr}.rc1084-table{min-width:0}.rc1084-table thead{display:none}.rc1084-table,.rc1084-table tbody,.rc1084-table tr,.rc1084-table td{display:block;width:100%}.rc1084-table tr{padding:8px 10px;border-bottom:1px solid #dbe4ec}.rc1084-table td{display:grid;grid-template-columns:105px 1fr;gap:8px;padding:5px 0;border:0}.rc1084-table td:before{content:attr(data-label);font-size:10px;font-weight:800;text-transform:uppercase;color:#64748b}.rc1084-table tbody tr:last-child{border-bottom:0}}@media(max-width:520px){.rc1084-summary,.rc1084-filters{grid-template-columns:1fr}}';
 (d.head||d.documentElement).appendChild(s)
}
function csvCell(v){var x=String(v==null?'':v);return '"'+x.replace(/"/g,'""')+'"'}
function currentFiltered(){return filterEvents(allEvents())}
function exportCsv(){
 var rows=[[tr('history.time'),tr('history.area'),tr('history.action'),tr('history.user'),tr('history.object'),tr('history.field.reference'),tr('history.details')]];
 currentFiltered().forEach(function(e){rows.push([fmt(e.at),typeLabel(e.type),actionTitle(e),actorDisplay(e),entityDisplay(e.entity),e.entityId||'',detailText(e)])});
 var csv='\ufeff'+rows.map(function(r){return r.map(csvCell).join(';')}).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=d.createElement('a');
 a.href=url;a.download='ExportHUB_History_'+new Date().toISOString().slice(0,10)+'.csv';d.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000)
}
function printHistory(){
 var rows=currentFiltered(),body=rows.map(function(e){return'<tr><td>'+esc(fmt(e.at))+'</td><td>'+esc(typeLabel(e.type))+'</td><td><b>'+esc(actionTitle(e))+'</b>'+(detailText(e)?'<br><small>'+esc(detailText(e))+'</small>':'')+'</td><td>'+esc(actorDisplay(e))+'</td><td>'+esc(entityDisplay(e.entity))+(e.entityId?' · '+esc(e.entityId):'')+'</td></tr>'}).join('');
 var html='<!doctype html><html lang="'+esc(lang())+'"><head><meta charset="utf-8"><title>ExportHUB · '+th('history.title')+'</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Segoe UI,Arial,sans-serif;color:#0f172a}h1{margin:0 0 4px}.meta{margin:0 0 12px;color:#475569}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top;font-size:10px}th{background:#e2e8f0}small{color:#475569}</style></head><body><h1>ExportHUB · '+th('history.title')+'</h1><p class="meta">'+th('history.entriesCreated',{count:rows.length,date:fmt(new Date().toISOString())})+'</p><table><thead><tr><th>'+th('history.time')+'</th><th>'+th('history.area')+'</th><th>'+th('history.action')+'</th><th>'+th('history.user')+'</th><th>'+th('history.object')+'</th></tr></thead><tbody>'+body+'</tbody></table></body></html>',pw=w.open('about:blank','_blank','width=1200,height=820');
 if(!pw)return false;pw.opener=null;pw.document.open();pw.document.write(html);pw.document.close();var run=function(){try{pw.focus();pw.print()}catch(_){}};if(pw.document.readyState==='complete')setTimeout(run,200);else pw.addEventListener('load',function(){setTimeout(run,150)},{once:true});return true
}
function render(){
 var old=d.getElementById('rc1081AuditHistory');
 if(!historyView()){if(old)old.remove();return false}
 var host=d.getElementById('content')||d.querySelector('main')||d.body;if(!host)return false;
 if(!old){host.innerHTML='';host.classList.add('rc1082-history-view');host.setAttribute('data-exporthub-rendered-view','history');old=d.createElement('section');old.id='rc1081AuditHistory';old.className='card rc1084-history';host.appendChild(old)}
 var events=allEvents(),actors=actorList(events),actions=actionList(events),filtered=filterEvents(events),
     entities=Array.from(new Set(events.map(function(e){return q(e.entity)}).filter(Boolean))).sort(function(a,b){return entityDisplay(a).localeCompare(entityDisplay(b),locale())});
 var types=['shipment','customer','task','pallet','audit'];
 var typeOptions='<option value="all"'+(FILTER.type==='all'?' selected':'')+'>'+th('history.allAreas')+'</option>'+types.map(function(value){return'<option value="'+value+'"'+(FILTER.type===value?' selected':'')+'>'+esc(typeLabel(value))+'</option>'}).join('');
 var actionOptions='<option value="all">'+th('history.allActions')+'</option>'+actions.map(function(a){return'<option value="'+esc(a.key)+'"'+(FILTER.subtype===a.key?' selected':'')+'>'+esc(a.label)+' · '+esc(a.area)+'</option>'}).join('');
 var actorOptions='<option value="all">'+th('history.allUsers')+'</option>'+actors.map(function(a){return'<option value="'+esc(a)+'"'+(FILTER.actor===a?' selected':'')+'>'+esc(actorDisplay(a))+'</option>'}).join('');
 var entityOptions='<option value="all">'+th('history.allObjects')+'</option>'+entities.map(function(a){return'<option value="'+esc(a)+'"'+(FILTER.entity===a?' selected':'')+'>'+esc(entityDisplay(a))+'</option>'}).join('');
 var rows=filtered.length?filtered.map(function(e){var det=detailText(e);return'<tr><td class="rc1084-time" data-label="'+th('history.time')+'">'+esc(fmt(e.at))+'</td><td data-label="'+th('history.area')+'"><span class="rc1084-area">'+esc(typeLabel(e.type))+'</span></td><td data-label="'+th('history.action')+'"><div class="rc1084-action-title">'+esc(actionTitle(e))+'</div></td><td data-label="'+th('history.user')+'"><div class="rc1084-user">'+esc(actorDisplay(e))+'</div>'+(e.actor&&e.actor.role?'<div class="rc1084-detail">'+esc(e.actor.role)+'</div>':'')+'</td><td data-label="'+th('history.object')+'"><div class="rc1084-object">'+esc(entityDisplay(e.entity))+'</div>'+(e.entityId?'<div class="rc1084-detail">'+esc(e.entityId)+'</div>':'')+'</td><td data-label="'+th('history.details')+'"><div class="rc1084-detail">'+esc(det||'—')+'</div></td></tr>'}).join(''):'<tr><td colspan="6" class="rc1084-empty">'+th('history.noEntries')+'</td></tr>';
 old.innerHTML='<div class="rc1084-head"><div><span class="pill blue">'+th('history.badge')+'</span><h3>'+th('history.title')+'</h3><div class="muted">'+th('history.subtitle')+'</div><div class="rc1084-count">'+th('history.count',{total:events.length,shown:filtered.length})+'</div></div><div class="rc1084-actions"><button type="button" class="btn ghost" data-rc1081-reset>'+th('history.filterReset')+'</button><button type="button" class="btn ghost" data-rc1081-csv>'+th('history.csvExport')+'</button><button type="button" class="btn" data-rc1081-print>'+th('common.print')+'</button></div></div><div class="rc1084-summary"><div class="rc1084-summary-card"><b>'+events.length+'</b><span>'+th('history.allActions')+'</span></div><div class="rc1084-summary-card"><b>'+countType(events,'shipment')+'</b><span>'+esc(typeLabel('shipment'))+'</span></div><div class="rc1084-summary-card"><b>'+countType(events,'customer')+'</b><span>'+esc(typeLabel('customer'))+'</span></div><div class="rc1084-summary-card"><b>'+countType(events,'task')+'</b><span>'+esc(typeLabel('task'))+'</span></div><div class="rc1084-summary-card"><b>'+countType(events,'pallet')+'</b><span>'+esc(typeLabel('pallet'))+'</span></div><div class="rc1084-summary-card"><b>'+countType(events,'audit')+'</b><span>'+esc(typeLabel('audit'))+'</span></div></div><div class="rc1084-filters"><label>'+th('history.search')+'<input data-rc1081-q placeholder="'+th('history.searchPlaceholder')+'" value="'+esc(FILTER.query)+'"></label><label>'+th('history.area')+'<select data-rc1081-type>'+typeOptions+'</select></label><label>'+th('history.action')+'<select data-rc1081-subtype>'+actionOptions+'</select></label><label>'+th('history.user')+'<select data-rc1081-actor>'+actorOptions+'</select></label><label>'+th('history.object')+'<select data-rc1081-entity>'+entityOptions+'</select></label><label>'+th('history.period')+'<select data-rc1081-days><option value="0"'+(FILTER.days===0?' selected':'')+'>'+th('history.allData')+'</option><option value="7"'+(FILTER.days===7?' selected':'')+'>'+th('history.days',{count:7})+'</option><option value="30"'+(FILTER.days===30?' selected':'')+'>'+th('history.days',{count:30})+'</option><option value="90"'+(FILTER.days===90?' selected':'')+'>'+th('history.days',{count:90})+'</option><option value="180"'+(FILTER.days===180?' selected':'')+'>'+th('history.days',{count:180})+'</option><option value="365"'+(FILTER.days===365?' selected':'')+'>'+th('history.months12')+'</option></select></label><label>'+th('history.from')+'<input type="date" data-rc1081-from value="'+esc(FILTER.from)+'"></label><label>'+th('history.to')+'<input type="date" data-rc1081-to value="'+esc(FILTER.to)+'"></label></div><div class="rc1084-table-wrap"><table class="rc1084-table" data-rc1084-history-table><thead><tr><th>'+th('history.time')+'</th><th>'+th('history.area')+'</th><th>'+th('history.action')+'</th><th>'+th('history.user')+'</th><th>'+th('history.object')+'</th><th>'+th('history.details')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 ensureStyle();
 var qf=old.querySelector('[data-rc1081-q]'),tf=old.querySelector('[data-rc1081-type]'),sf=old.querySelector('[data-rc1081-subtype]'),af=old.querySelector('[data-rc1081-actor]'),ef=old.querySelector('[data-rc1081-entity]'),df=old.querySelector('[data-rc1081-days]'),ff=old.querySelector('[data-rc1081-from]'),tof=old.querySelector('[data-rc1081-to]');
 if(qf)qf.addEventListener('input',function(){FILTER.query=this.value;render()});
 if(tf)tf.addEventListener('change',function(){FILTER.type=this.value;render()});
 if(sf)sf.addEventListener('change',function(){FILTER.subtype=this.value;render()});
 if(af)af.addEventListener('change',function(){FILTER.actor=this.value;render()});
 if(ef)ef.addEventListener('change',function(){FILTER.entity=this.value;render()});
 if(df)df.addEventListener('change',function(){FILTER.days=Number(this.value)||0;render()});
 if(ff)ff.addEventListener('change',function(){FILTER.from=this.value;render()});
 if(tof)tof.addEventListener('change',function(){FILTER.to=this.value;render()});
 var reset=old.querySelector('[data-rc1081-reset]'),csv=old.querySelector('[data-rc1081-csv]'),pr=old.querySelector('[data-rc1081-print]');
 if(reset)reset.addEventListener('click',function(){FILTER={query:'',type:'all',subtype:'all',actor:'all',entity:'all',days:0,from:'',to:''};render()});
 if(csv)csv.addEventListener('click',exportCsv);
 if(pr)pr.addEventListener('click',printHistory);
 return true
}
function schedule(){w.setTimeout(function(){try{render()}catch(e){try{console.warn('RC1087 Historie',e)}catch(_){}}},0)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:user-profile-updated','exporthub:language-changed'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
w.ExportHUBRC1081AuditHistory=Object.freeze({version:'RC1177',events:allEvents,render:render,filter:filterEvents,exportCsv:exportCsv,print:printHistory,historyView:historyView,actionLabel:actionLabel,actionTitle:actionTitle,consolidateEvents:consolidateEvents});
})(window,document);