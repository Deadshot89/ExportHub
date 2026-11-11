'use strict';
// Urgent Order domain model. No D365 access and no implicit claims of stock availability.
const crypto = require('node:crypto');
const apiI18n = require('./i18n');
const PRIORITIES = Object.freeze(['P1','P2','P3','P4']);
const STATUSES = Object.freeze(['Open','Waved','In Progress','Problem','Loaded','Shipped','Invoiced']);
const LANGUAGES = Object.freeze(['de','en']);
const DELIVERY = Object.freeze(['DRP','DIRECT']);
const ORDER_TYPES=Object.freeze(['STANDARD','DIRECT_OUTBOUND']);
const ARRIVAL_MODES=Object.freeze(['TRUCK','PARCEL','COURIER','OTHER']);
const DISPATCH_METHODS=Object.freeze(['SPECIAL_TRANSPORT','EXPRESS']);
const CLOSED_STATUSES=Object.freeze(['Invoiced']);
function text(v,max=200){return String(v==null?'':v).trim().slice(0,max);}
function problem(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e;}
function email(v){const value=text(v,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||/[\r\n]/.test(value))throw problem('URGENT_EMAIL_INVALID','Bitte eine gültige CS-E-Mail-Adresse angeben.');return value;}
function language(v){const raw=text(v,10).toLowerCase();return LANGUAGES.includes(raw)?raw:'de';}
function orderNumber(v){const raw=text(v,40).toUpperCase();if(!/^SO[A-Z0-9-]{2,38}$/.test(raw))throw problem('URGENT_SO_INVALID','Die Auftragsnummer muss mit SO beginnen.');return raw;}
function positiveInt(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>10000000)throw problem('URGENT_QUANTITY_INVALID','Jede Position braucht eine gültige Menge größer als 0.');return n;}
function explicitCheck(v,key){if(typeof v!=='boolean')throw problem('URGENT_CHECK_MISSING','Die CS-Prüfung "'+key+'" muss mit Ja oder Nein beantwortet werden.');return v;}

function localDateTime(value){
 const v=text(value,16);
 const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
 if(!m)throw problem('URGENT_ARRIVAL_TIME_INVALID','Arrival date and time are required.');
 const y=+m[1],month=+m[2],day=+m[3],hh=+m[4],mm=+m[5];
 const d=new Date(Date.UTC(y,month-1,day));
 if(y<2020||y>2100||d.getUTCFullYear()!==y||d.getUTCMonth()!==month-1||d.getUTCDate()!==day||hh>23||mm>59)throw problem('URGENT_ARRIVAL_TIME_INVALID','Invalid arrival date and time.');
 return v;
}
function validateDirectOutbound(raw){
 const p=raw&&typeof raw==='object'?raw:{};
 const arrivalMode=text(p.arrivalMode,20).toUpperCase(),dispatchMethod=text(p.dispatchMethod,30).toUpperCase();
 if(!ARRIVAL_MODES.includes(arrivalMode))throw problem('URGENT_ARRIVAL_MODE_REQUIRED','Please select the inbound transport type.');
 if(!DISPATCH_METHODS.includes(dispatchMethod))throw problem('URGENT_DISPATCH_REQUIRED','Please choose special transport or express.');
 const arrivalProvider=text(p.arrivalProvider,120);
 if(!arrivalProvider)throw problem('URGENT_ARRIVAL_PROVIDER_REQUIRED','Please enter the carrier or inbound provider.');
 const arrivalAt=localDateTime(p.arrivalAt),plannedDispatchAt=p.plannedDispatchAt?localDateTime(p.plannedDispatchAt):null;
 if(plannedDispatchAt&&plannedDispatchAt<arrivalAt)throw problem('URGENT_DISPATCH_BEFORE_ARRIVAL','Planned dispatch cannot be before arrival.');
 const docs=explicitCheck(p.deliveryNotePresent,'delivery note available');
 const asn=explicitCheck(p.asnWorking,'ASN functional');
 const holds=explicitCheck(p.holdsClear,"Don't Process / Credit Hold");
 const failed=(!docs||!asn||!holds),exceptionReason=text(p.exceptionReason,1000);
 if(failed&&exceptionReason.length<8)throw problem('URGENT_EXCEPTION_REASON_REQUIRED','Explain any failed inbound checks (at least 8 characters).');
 return{arrivalAt,arrivalTimeZone:'Europe/Berlin',arrivalMode,arrivalProvider,
  arrivalReference:text(p.arrivalReference,120),dispatchMethod,
  plannedDispatchAt,
  checks:{deliveryNotePresent:docs,asnWorking:asn,holdsClear:holds},
  checkResult:failed?'exception':'passed',exceptionReason:failed?exceptionReason:''};
}

// Same-day Urgent Orders are accepted after the deadline but clearly flagged.
// The deadline follows the German local clock (including daylight saving time).
function dispatchCutoff(requestedDate,now){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const today=parts.year+'-'+parts.month+'-'+parts.day;
 const date=requestedDate==null||requestedDate===''?today:text(requestedDate,20);
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
 if(!match)throw problem('URGENT_DISPATCH_DATE_INVALID','Bitte einen gültigen gewünschten Versandtag angeben.');
 const day=new Date(Date.UTC(+match[1],+match[2]-1,+match[3]));
 if(day.getUTCFullYear()!==+match[1]||day.getUTCMonth()!==+match[2]-1||day.getUTCDate()!==+match[3])
  throw problem('URGENT_DISPATCH_DATE_INVALID','Bitte einen gültigen gewünschten Versandtag angeben.');
 if(date<today)throw problem('URGENT_DISPATCH_DATE_PAST','Der gewünschte Versandtag darf nicht in der Vergangenheit liegen.');
 const lateSameDay=date===today&&(+parts.hour*60 + +parts.minute)>15*60+15;
 const next=new Date(Date.UTC(+parts.year,+parts.month-1,+parts.day+1)).toISOString().slice(0,10);
 return{requestedDispatchDate:date,cutoff:{lateSameDay,cutoffLocalTime:'15:15',timeZone:'Europe/Berlin',
  nextProcessingDate:lateSameDay?next:null,checkedAt:now}};
}
function validateItems(raw,now,orderType='STANDARD'){
 if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw problem('URGENT_LINES_REQUIRED','Bitte 1 bis 100 Artikel/Lines erfassen.');
 const seen=new Set();
 return raw.map((r,i)=>{
  const line=text(r&&r.line,70),article=text(r&&r.article,120);
  if(!line&&!article)throw problem('URGENT_LINE_INVALID','Bei jeder Position muss Line oder Artikelnummer eingetragen sein.');
  const key=(line||'#')+'|'+(article||'#');if(seen.has(key))throw problem('URGENT_DUPLICATE_LINE','Eine Position wurde mehrfach eingetragen.');seen.add(key);
  const isMinibag=r&&r.minibag===true,newArticle=r&&r.newArticle===true;
  if(newArticle&&!article)throw problem('URGENT_NEW_ITEM_ARTICLE_REQUIRED','Bei neuen Artikeln muss die Artikelnummer eingetragen werden.');
  const pickableStock=orderType==='DIRECT_OUTBOUND'?null:explicitCheck(r&&r.pickableStock,'pickable stock');
  const holdsClear=explicitCheck(r&&r.holdsClear,"Don't Process / Credit Hold");
  const checks={
   pickableStock,holdsClear,
   minibagLeadtime:isMinibag?explicitCheck(r&&r.minibagLeadtime,'ten-day minibag leadtime'):null,
   articleDataCorrect:newArticle?explicitCheck(r&&r.articleDataCorrect,'new article master data'):null,
   processCompliant:newArticle?explicitCheck(r&&r.processCompliant,'new article process'):null
  };
  const failed=(pickableStock===false)||!holdsClear||(isMinibag&&!checks.minibagLeadtime)||(newArticle&&(!checks.articleDataCorrect||!checks.processCompliant));
  const exceptionReason=text(r&&r.exceptionReason,1000);
  if(failed&&exceptionReason.length<8)throw problem('URGENT_EXCEPTION_REASON_REQUIRED','Bei nicht bestandenen Artikelprüfungen ist eine Begründung (mindestens 8 Zeichen) erforderlich.');
  return{id:crypto.randomUUID(),line,article,quantity:positiveInt(r&&r.quantity),minibag:isMinibag,newArticle,checks,exceptionReason:failed?exceptionReason:'',checkResult:failed?'exception':'passed',status:'Open',checkedAt:now};
 });
}
// Whole-order checks are explicit order-level statements, never evidence that
// individual lines, quantities or locations were verified.
function validateWholeOrderChecks(raw,now,orderType){
 const input=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const check=(value,label)=>{
  if(value===undefined||value===null)return null;
  if(typeof value!=='boolean')throw problem('URGENT_ORDER_CHECK_INVALID','Invalid whole-order check: '+label);
  return value;
 };
 const pickableStock=orderType==='DIRECT_OUTBOUND'?null:check(input.pickableStock,'stock');
 const holdsClear=check(input.holdsClear,'holds');
 const failed=pickableStock===false||holdsClear===false;
 const reason=text(input.exceptionReason,1000);
 if(failed&&reason.length<8)throw problem('URGENT_EXCEPTION_REASON_REQUIRED','For a failed whole-order check, provide a reason of at least 8 characters.');
 const complete=holdsClear===true&&(orderType==='DIRECT_OUTBOUND'||pickableStock===true);
 const checked=pickableStock!==null||holdsClear!==null;
 return {pickableStock,holdsClear,exceptionReason:failed?reason:'',checkResult:failed?'exception':complete?'passed':'not_checked',checkedAt:checked?now:null};
}
function createOrder(raw,actor,now=new Date().toISOString()){
 const p=raw&&typeof raw==='object'?raw:{};
 const delivery=text(p.delivery,10).toUpperCase();
 const priority=text(p.priority,2).toUpperCase();
 const orderType=text(p.orderType||'STANDARD',30).toUpperCase();
 if(!DELIVERY.includes(delivery))throw problem('URGENT_DELIVERY_INVALID','Bitte DRP oder Direktlieferung auswählen.');
 if(!PRIORITIES.includes(priority))throw problem('URGENT_PRIORITY_INVALID','Bitte eine Priorität P1 bis P4 wählen.');
 if(!ORDER_TYPES.includes(orderType))throw problem('URGENT_ORDER_TYPE_INVALID','Choose a valid urgent order type.');
 const ownerId=text(actor&&actor.id,150);
 if(!ownerId)throw problem('URGENT_ACTOR_REQUIRED','A validated user or reporter session is required.',401);
 const directOutbound=orderType==='DIRECT_OUTBOUND'?validateDirectOutbound(p.directOutbound):null;
 const dispatch=dispatchCutoff(p.requestedDispatchDate,now);
 // P1 confirmation records the creator's assertion of existing transport-cost approval.
 if(priority==='P1'&&p.transportCostsApproved!==true)throw problem('URGENT_P1_APPROVAL_REQUIRED','Bitte die Genehmigung der Transportkostenübernahme bestätigen.');
 const allLines=p.allLines===true;
 // Entire order is a distinct scope: never invent an article, line number or stock checks.
 if(allLines&&Array.isArray(p.items)&&p.items.length)throw problem('URGENT_SCOPE_CONFLICT','Bei komplettem Auftrag keine einzelnen Artikel übermitteln.');
 const items=allLines?[{id:crypto.randomUUID(),scope:'ALL_LINES',line:'',article:'',quantity:null,minibag:false,newArticle:false,checks:null,exceptionReason:'',checkResult:'not_checked',status:'Open',checkedAt:null}]:validateItems(p.items,now,orderType);
 const orderChecks=allLines?validateWholeOrderChecks(p.orderChecks,now,orderType):null;
 return{id:crypto.randomUUID(),orderNumber:orderNumber(p.orderNumber),delivery,priority,orderType,directOutbound,
  email:email(p.email),language:language(p.language),...dispatch,
  allLines,orderChecks,transportCostsApproval:priority==='P1'?{confirmedBy:{id:ownerId,name:text(actor.name,150)},confirmedAt:now}:null,
  createdBy:{id:ownerId,name:text(actor.name,150)},createdAt:now,updatedAt:now,
  items,history:[{at:now,actorId:ownerId,event:'created'}]};
}
function canManage(user){if(user&&user.globalAdmin===true)return true;const r=user&&user.rights||{};return ['shipmentoverview'].some(k=>{const x=r[k]||{};return x.edit===true||x.admin===true||x.functionAdmin===true||['edit','admin'].includes(String(x.level||x.access||'').toLowerCase());});}
function canRead(order,user){return canManage(user)||text(order&&order.createdBy&&order.createdBy.id)===text(user&&user.id);}
function setItemStatus(order,itemId,status,user,now=new Date().toISOString(),note=''){
 if(order&&order.deletion&&order.deletion.state==='pending')throw problem('URGENT_DELETE_PENDING','Bitte zuerst die offene Löschanfrage entscheiden.',409);
 if(!canManage(user))throw problem('URGENT_FORBIDDEN','Nur die Logistik darf Positionen aktualisieren.',403);
 if(!STATUSES.includes(status))throw problem('URGENT_STATUS_INVALID','Ungültiger Status.');
 const item=(order.items||[]).find(x=>x.id===itemId);
 if(!item)throw problem('URGENT_ITEM_NOT_FOUND','Position nicht gefunden.',404);
 if(item.status===status)return false;
 const previous=item.status;
 const problemNote=status==='Problem'?text(note,1000):'';
 if(status==='Problem'&&problemNote.length<8)throw problem('URGENT_PROBLEM_NOTE_REQUIRED','Bei Status Problem ist eine Beschreibung mit mindestens 8 Zeichen erforderlich.');
 if(status==='Problem')item.problemNote=problemNote;
 item.status=status;item.updatedAt=now;order.updatedAt=now;
 if(!processingOwner(order))order.processingBy={id:text(user.id,150),name:text(user.name||user.user||user.login||user.id,150)};
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId:text(user.id),event:'status',itemId,previous,status,...(problemNote?{problemNote}:{})});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return true;
}
// Deleting an Urgent Order is a reversible administrative hiding of the request,
// NEVER deletion of a shipment, POD, D365 document or external shipping record.
// Decisions are protected by the same ETag-conditional write as status changes.
function activeOrder(order){return !!(order&&!order.deletedAt);}
function actorRecord(actor){
 const id=text(actor&&actor.id,150);
 if(!id)throw problem('URGENT_ACTOR_REQUIRED','Angemeldeter Mitarbeiter erforderlich.',401);
 return {id,name:text(actor.name||actor.user||actor.login||id,150)};
}
function processingOwner(order){
 if(order&&order.processingBy&&text(order.processingBy.id))return actorRecord(order.processingBy);
 const history=Array.isArray(order&&order.history)?order.history:[];
 const entry=history.slice().reverse().find(e=>
   e&&['status','mail_open_requested','mail_sent_manually_confirmed','processing_claimed'].includes(e.event)&&text(e.actorId));
 return entry?{id:text(entry.actorId,150),name:text(entry.actorName||entry.actorId,150)}:null;
}
function workStarted(order){
 if(!order)return false;
 if(processingOwner(order))return true;
 if(Array.isArray(order.mailHistory)&&order.mailHistory.length>0)return true;
 return (order.items||[]).some(item=>item.status!=='Open')||
   (Array.isArray(order.history)&&order.history.some(e=>e&&
   ['status','mail_open_requested','mail_sent_manually_confirmed'].includes(e.event)));
}
function isDispatched(order){
 return (order.items||[]).some(x=>['Shipped','Invoiced'].includes(x.status))||isClosed(order);
}
function appendHistory(order,event,actor,now,extra={}){
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId:actor.id,event,...extra});
 if(order.history.length>200)order.history=order.history.slice(-200);
 order.updatedAt=now;
}
function deleteView(order){
 const request=order&&order.deletion;
 return {state:order.deletedAt?'deleted':request&&request.state==='pending'?'pending':
  request&&request.state==='rejected'?'rejected':'none',
  started:workStarted(order),handler:processingOwner(order),
  requestedAt:request&&request.requestedAt||null};
}
function requestDeletion(order,actor,now=new Date().toISOString()){
 if(!activeOrder(order))throw problem('URGENT_ALREADY_DELETED','Die Anfrage wurde bereits gelöscht.',409);
 const who=actorRecord(actor);
 if(!canManage(actor)&&text(order.createdBy&&order.createdBy.id)!==who.id)
  throw problem('URGENT_FORBIDDEN','Nur der Melder oder die Logistik darf die Löschung anfragen.',403);
 if(isDispatched(order))throw problem('URGENT_DELETE_DISPATCHED','Versendete oder fakturierte Anfragen können nicht gelöscht werden.',409);
 if(order.deletion&&order.deletion.state==='pending')return deleteView(order);
 if(!workStarted(order)){
  order.deletedAt=now;order.deletedBy=who;
  order.deletion={state:'approved',requestedAt:now,requestedBy:who,resolvedAt:now,resolvedBy:who,reason:'unworked'};
  appendHistory(order,'deletion_immediate',who,now);
  return deleteView(order);
 }
 order.deletion={state:'pending',requestedAt:now,requestedBy:who,resolvedAt:null,resolvedBy:null};
 appendHistory(order,'deletion_requested',who,now);
 return deleteView(order);
}
function startProcessing(order,actor,now=new Date().toISOString()){
 if(!canManage(actor))throw problem('URGENT_FORBIDDEN','Nur die Logistik darf eine Bearbeitung übernehmen.',403);
 if(!activeOrder(order))throw problem('URGENT_ALREADY_DELETED','Die Anfrage wurde bereits gelöscht.',409);
 if(order.deletion&&order.deletion.state==='pending')
  throw problem('URGENT_DELETE_PENDING','Offene Löschanfrage bitte zuerst entscheiden.',409);
 const who=actorRecord(actor),owner=processingOwner(order);
 if(owner&&owner.id!==who.id)
  throw problem('URGENT_PROCESSING_OWNER_EXISTS','Diese Anfrage wird bereits von einem anderen Mitarbeiter bearbeitet.',409);
 if(owner)return {handler:owner,started:true};
 order.processingBy=who;
 appendHistory(order,'processing_claimed',who,now);
 return {handler:who,started:true};
}
function claimDeletionHandler(order,actor,now=new Date().toISOString()){
 if(!canManage(actor))throw problem('URGENT_FORBIDDEN','Nur die Logistik darf eine Bearbeitung übernehmen.',403);
 if(!activeOrder(order)||!order.deletion||order.deletion.state!=='pending')
  throw problem('URGENT_DELETE_NOT_PENDING','Keine offene Löschanfrage vorhanden.',409);
 if(!workStarted(order))throw problem('URGENT_DELETE_NOT_STARTED','Keine Bearbeitung dokumentiert.',409);
 if(processingOwner(order))throw problem('URGENT_DELETE_HANDLER_EXISTS','Bereits ein Bearbeiter zugeordnet.',409);
 const who=actorRecord(actor);
 order.processingBy=who;
 appendHistory(order,'processing_claimed',who,now);
 return deleteView(order);
}
function resolveDeletion(order,actor,approve,now=new Date().toISOString()){
 if(!canManage(actor))throw problem('URGENT_FORBIDDEN','Nur der zuständige Bearbeiter darf entscheiden.',403);
 if(!activeOrder(order)||!order.deletion||order.deletion.state!=='pending')
  throw problem('URGENT_DELETE_NOT_PENDING','Keine offene Löschanfrage vorhanden.',409);
 const owner=processingOwner(order),who=actorRecord(actor);
 if(!owner)throw problem('URGENT_DELETE_HANDLER_UNASSIGNED','Bitte zuerst einen Bearbeiter zuordnen.',409);
 if(owner.id!==who.id)throw problem('URGENT_DELETE_NOT_HANDLER','Nur der zuständige Bearbeiter darf die Löschung bestätigen oder ablehnen.',403);
 if(approve!==true&&approve!==false)throw problem('URGENT_DELETE_DECISION_INVALID','Ungültige Entscheidung.',400);
 if(approve&&isDispatched(order))throw problem('URGENT_DELETE_DISPATCHED','Bereits versendete Anfragen dürfen nicht gelöscht werden.',409);
 order.deletion.state=approve?'approved':'rejected';
 order.deletion.resolvedAt=now;order.deletion.resolvedBy=who;
 if(approve){order.deletedAt=now;order.deletedBy=who;}
 appendHistory(order,approve?'deletion_approved':'deletion_rejected',who,now);
 return deleteView(order);
}
function isClosed(order){return !!(order&&Array.isArray(order.items)&&order.items.length&&order.items.every(x=>CLOSED_STATUSES.includes(x.status)));}
function summaryStatus(order){const unique=[...new Set((order.items||[]).map(x=>x.status))];return unique.length===1?unique[0]:'Mixed';}
function draftMail(order,kind,lang,note,actor){
 const l=language(lang||order.language),issue=kind==='problem';
 if(!issue&&kind!=='shipping')throw problem('URGENT_MAIL_KIND_INVALID','Unbekannter E-Mail-Typ.');
 if(!issue&&(order.items||[]).some(x=>!['Shipped','Invoiced'].includes(x.status)))throw problem('URGENT_NOT_SHIPPED','Versandbestätigung erst nach Status Shipped für alle Positionen möglich.',409);
 const t=key=>apiI18n.tLang(l,'api.urgent.'+key);
 // A manual problem description is supplied by the editor. Preserve its meaning;
 // no untranslated process statuses, transport details or HTML in the email.
 const message=text(note,2000).replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
 if(issue&&message.length<8)throw problem('URGENT_MAIL_NOTE_REQUIRED',t('issueDescriptionRequired'));
 // Use the employee preparing this email, never the account that created the order.
 // The actor comes exclusively from the authenticated server session.
 const sender=text(actor&&(actor.user||actor.login||actor.username||actor.name||actor.id),150).replace(/\s+/g,' ')||t('teamFallback');
 const itemNames=order.allLines===true?[(l==='en'?'Entire order (all lines)':'Kompletter Auftrag (alle Positionen)')]:[...new Set((order.items||[]).map(x=>text(x.article,120)||(x.line?t('lineLabel')+' '+text(x.line,70):'')).filter(Boolean))];
 return{
  to:order.email,
  language:l,
  subject:t(issue?'subjectIssue':'subjectShipping')+order.orderNumber,
  body:[
   t('hello'),'',
   issue?t('issueLabel')+' '+message:t('introShipping'),
   '',
   t('orderLabel')+' '+order.orderNumber,
   t('itemLabel')+': '+itemNames.join(', '),
   '',t('signoff'),sender
  ].join('\n')
 };
}
// The browser cannot observe Outlook's Send action. Preserve the exact editor
// content before opening the mail program; confirmation is explicitly manual.
function recordMailHandoff(order,raw,actor,now=new Date().toISOString()){
 if(order&&order.deletion&&order.deletion.state==='pending')throw problem('URGENT_DELETE_PENDING','Bitte zuerst die offene Löschanfrage entscheiden.',409);
 if(!canManage(actor))throw problem('URGENT_FORBIDDEN','Nur die Logistik darf E-Mails dokumentieren.',403);
 const p=raw&&typeof raw==='object'?raw:{};
 const kind=text(p.kind,30);
 if(!['problem','shipping'].includes(kind))throw problem('URGENT_MAIL_KIND_INVALID','Unbekannter E-Mail-Typ.');
 if(kind==='shipping'&&(order.items||[]).some(x=>!['Shipped','Invoiced'].includes(x.status)))throw problem('URGENT_NOT_SHIPPED','Versandbestätigung erst nach Status Shipped für alle Positionen möglich.',409);
 const to=email(p.to);
 if(to!==order.email)throw problem('URGENT_MAIL_RECIPIENT_MISMATCH','Empfänger entspricht nicht der CS-E-Mail des Auftrags.',409);
 const subject=String(p.subject==null?'':p.subject);
 const body=String(p.body==null?'':p.body);
 if(!subject.trim()||subject.length>250||/[\r\n\x00]/.test(subject))throw problem('URGENT_MAIL_SUBJECT_INVALID','Bitte einen gültigen Betreff eingeben (maximal 250 Zeichen).');
 if(!body.trim()||body.length>20000||body.includes('\x00'))throw problem('URGENT_MAIL_BODY_INVALID','Bitte einen gültigen E-Mail-Text eingeben (maximal 20.000 Zeichen).');
 const actorId=text(actor&&actor.id,150);
 if(!actorId)throw problem('URGENT_ACTOR_REQUIRED','Angemeldeter Mitarbeiter erforderlich.',401);
 const mail={
  id:crypto.randomUUID(),kind,to,subject,body,language:language(p.language||order.language),
  createdAt:now,createdBy:{id:actorId,name:text(actor.name||actor.user||actor.login||actorId,150)},
  status:'open_requested',sentAt:null,sentConfirmedBy:null
 };
 order.mailHistory=Array.isArray(order.mailHistory)?order.mailHistory:[];
 order.mailHistory.push(mail);
 if(!processingOwner(order))order.processingBy={id:actorId,name:text(actor.name||actor.user||actor.login||actorId,150)};
 order.updatedAt=now;
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId,event:'mail_open_requested',mailId:mail.id,kind});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return mail;
}
function confirmMailSent(order,mailId,actor,now=new Date().toISOString()){
 if(order&&order.deletion&&order.deletion.state==='pending')throw problem('URGENT_DELETE_PENDING','Bitte zuerst die offene Löschanfrage entscheiden.',409);
 if(!canManage(actor))throw problem('URGENT_FORBIDDEN','Nur die Logistik darf Versandbestätigungen erfassen.',403);
 const mail=(order.mailHistory||[]).find(m=>m.id===mailId);
 if(!mail)throw problem('URGENT_MAIL_NOT_FOUND','Gespeicherter E-Mail-Entwurf nicht gefunden.',404);
 if(mail.status==='sent_confirmed')return mail;
 if(mail.status!=='open_requested')throw problem('URGENT_MAIL_STATUS_INVALID','Der Mailstatus kann nicht bestätigt werden.',409);
 const actorId=text(actor&&actor.id,150);
 if(!actorId)throw problem('URGENT_ACTOR_REQUIRED','Angemeldeter Mitarbeiter erforderlich.',401);
 mail.status='sent_confirmed';mail.sentAt=now;
 if(!processingOwner(order))order.processingBy={id:actorId,name:text(actor.name||actor.user||actor.login||actorId,150)};
 mail.sentConfirmedBy={id:actorId,name:text(actor.name||actor.user||actor.login||actorId,150)};
 order.updatedAt=now;
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId,event:'mail_sent_manually_confirmed',mailId:mail.id,kind:mail.kind});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return mail;
}

module.exports={PRIORITIES,STATUSES,DELIVERY,LANGUAGES,ORDER_TYPES,ARRIVAL_MODES,DISPATCH_METHODS,CLOSED_STATUSES,text,problem,email,language,orderNumber,localDateTime,validateDirectOutbound,dispatchCutoff,createOrder,canManage,canRead,setItemStatus,isClosed,summaryStatus,draftMail,recordMailHandoff,confirmMailSent,activeOrder,workStarted,processingOwner,deleteView,requestDeletion,startProcessing,claimDeletionHandler,resolveDeletion};