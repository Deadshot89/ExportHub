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
 return{id:crypto.randomUUID(),orderNumber:orderNumber(p.orderNumber),delivery,priority,orderType,directOutbound,
  email:email(p.email),language:language(p.language),
  createdBy:{id:ownerId,name:text(actor.name,150)},createdAt:now,updatedAt:now,
  items:validateItems(p.items,now,orderType),history:[{at:now,actorId:ownerId,event:'created'}]};
}
function canManage(user){if(user&&user.globalAdmin===true)return true;const r=user&&user.rights||{};return ['shipmentoverview'].some(k=>{const x=r[k]||{};return x.edit===true||x.admin===true||x.functionAdmin===true||['edit','admin'].includes(String(x.level||x.access||'').toLowerCase());});}
function canRead(order,user){return canManage(user)||text(order&&order.createdBy&&order.createdBy.id)===text(user&&user.id);}
function setItemStatus(order,itemId,status,user,now=new Date().toISOString(),note=''){
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
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId:text(user.id),event:'status',itemId,previous,status,...(problemNote?{problemNote}:{})});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return true;
}
function isClosed(order){return !!(order&&Array.isArray(order.items)&&order.items.length&&order.items.every(x=>CLOSED_STATUSES.includes(x.status)));}
function summaryStatus(order){const unique=[...new Set((order.items||[]).map(x=>x.status))];return unique.length===1?unique[0]:'Mixed';}
function draftMail(order,kind,lang,note){
 const l=language(lang||order.language),issue=kind==='problem';
 if(!issue&&kind!=='shipping')throw problem('URGENT_MAIL_KIND_INVALID','Unbekannter E-Mail-Typ.');
 if(!issue&&(order.items||[]).some(x=>!['Shipped','Invoiced'].includes(x.status)))throw problem('URGENT_NOT_SHIPPED','Versandbestätigung erst nach Status Shipped für alle Positionen möglich.',409);
 const t=key=>apiI18n.tLang(l,'api.urgent.'+key);
 const message=text(note,2000);
 if(issue&&message.length<8)throw problem('URGENT_MAIL_NOTE_REQUIRED',t('issueDescriptionRequired'));
 const crossDock=order.orderType==='DIRECT_OUTBOUND'&&order.directOutbound||null;
 const inboundMode=crossDock?({'TRUCK':t('truck'),'PARCEL':t('parcel'),'COURIER':t('courier'),'OTHER':t('otherTransport')}[crossDock.arrivalMode]||crossDock.arrivalMode):'';
 const directDetails=crossDock?[
  t('arrivalAt')+' '+crossDock.arrivalAt.replace('T',' ')+' (Europe/Berlin)',
  t('arrivalMode')+' '+inboundMode,
  t('arrivalCarrier')+' '+crossDock.arrivalProvider,
  t('outboundMethod')+' '+t(crossDock.dispatchMethod==='EXPRESS'?'express':'specialTransport'),
  ...(crossDock.plannedDispatchAt?[t('requestedDispatch')+' '+crossDock.plannedDispatchAt.replace('T',' ')+' (Europe/Berlin)']:[])
 ]:[];
 const itemLines=(order.items||[]).map(x=>[
  x.line?t('lineLabel')+' '+x.line:'',
  x.article?t('itemLabel')+' '+x.article:'',
  t('qtyLabel')+' '+x.quantity,
  t('statusLabel')+' '+x.status
 ].filter(Boolean).join(' · ')).join('\n');
 return{
  to:order.email,
  language:l,
  subject:t(issue?'subjectIssue':'subjectShipping')+order.orderNumber,
  body:[
   t(issue?'introIssue':'introShipping'),'',
   t('orderLabel')+' '+order.orderNumber,
   t('deliveryLabel')+' '+(order.delivery==='DIRECT'?t('directDelivery'):'DRP'),
   t('priorityLabel')+' '+order.priority,
   ...(directDetails.length?['',...directDetails]:[]),
   '',itemLines,
   ...(issue?['',t('issueLabel'),message]:[]),
   '',t('signoff')
  ].join('\n')
 };
}
// The browser cannot observe Outlook's Send action. Preserve the exact editor
// content before opening the mail program; confirmation is explicitly manual.
function recordMailHandoff(order,raw,actor,now=new Date().toISOString()){
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
 order.updatedAt=now;
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId,event:'mail_open_requested',mailId:mail.id,kind});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return mail;
}
// Direct Microsoft 365 sending is separate from opening Outlook with mailto:.
// Reserve the exact message before calling Graph and block accidental duplicate sends.
function requestGraphMail(order,raw,actor,now=new Date().toISOString()){
 const p=raw&&typeof raw==='object'?raw:{};
 const requestId=text(p.requestId,60);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))
  throw problem('URGENT_MAIL_REQUEST_ID_INVALID','Ungültige E-Mail-Versandkennung.');
 const existing=(order.mailHistory||[]).find(m=>m.requestId===requestId);
 if(existing){
  if(existing.source!=='microsoft_graph'||existing.to!==email(p.to)||existing.subject!==String(p.subject||'')||existing.body!==String(p.body||'')||existing.kind!==text(p.kind,30))
   throw problem('URGENT_MAIL_REQUEST_CONFLICT','Die Versandkennung gehört zu einer anderen E-Mail.',409);
  return{mail:existing,existing:true};
 }
 const subject=String(p.subject==null?'':p.subject),body=String(p.body==null?'':p.body);
 if(subject.length>200||body.length>12000)
  throw problem('URGENT_GRAPH_MAIL_TOO_LONG','Für direkten Microsoft-365-Versand sind höchstens 200 Zeichen im Betreff und 12.000 im Text erlaubt.');
 const duplicate=(order.mailHistory||[]).some(m=>m.source==='microsoft_graph'&&m.to===email(p.to)&&m.kind===text(p.kind,30)&&m.subject===subject&&m.body===body&&
  ['sending','send_unverified','sent_confirmed'].includes(m.status)&&
  Number.isFinite(Date.parse(m.createdAt))&&Math.abs(Date.parse(now)-Date.parse(m.createdAt))<5*60*1000);
 if(duplicate)throw problem('URGENT_MAIL_DUPLICATE','Diese E-Mail wurde vor kurzem bereits zum Versand eingereicht. Bitte die Historie prüfen.',409);
 const mail=recordMailHandoff(order,p,actor,now);
 mail.status='sending';mail.source='microsoft_graph';mail.requestId=requestId;
 const last=order.history&&order.history.at(-1);
 if(last&&last.mailId===mail.id)last.event='mail_send_requested';
 return{mail,existing:false};
}
function confirmGraphMailAccepted(order,mailId,sender,now=new Date().toISOString()){
 const mail=(order.mailHistory||[]).find(m=>m.id===mailId);
 if(!mail||mail.source!=='microsoft_graph')throw problem('URGENT_GRAPH_MAIL_NOT_FOUND','Automatischer E-Mail-Versand nicht gefunden.',404);
 if(mail.status==='sent_confirmed')return mail;
 if(mail.status!=='sending')throw problem('URGENT_GRAPH_MAIL_STATUS_INVALID','Der Versandstatus kann nicht automatisch bestätigt werden.',409);
 mail.status='sent_confirmed';mail.sentAt=now;
 mail.sentConfirmedBy={id:'microsoft_graph',name:'Microsoft 365'};
 mail.confirmationSource='graph_accepted';mail.sender=email(sender);
 order.updatedAt=now;order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId:'microsoft_graph',event:'mail_graph_accepted',mailId:mail.id,kind:mail.kind});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return mail;
}
function markGraphMailUnverified(order,mailId,now=new Date().toISOString()){
 const mail=(order.mailHistory||[]).find(m=>m.id===mailId);
 if(!mail||mail.source!=='microsoft_graph'||mail.status!=='sending')return mail||null;
 mail.status='send_unverified';order.updatedAt=now;
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId:'microsoft_graph',event:'mail_graph_unverified',mailId:mail.id,kind:mail.kind});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return mail;
}
function confirmMailSent(order,mailId,actor,now=new Date().toISOString()){
 if(!canManage(actor))throw problem('URGENT_FORBIDDEN','Nur die Logistik darf Versandbestätigungen erfassen.',403);
 const mail=(order.mailHistory||[]).find(m=>m.id===mailId);
 if(!mail)throw problem('URGENT_MAIL_NOT_FOUND','Gespeicherter E-Mail-Entwurf nicht gefunden.',404);
 if(mail.status==='sent_confirmed')return mail;
 if(mail.status!=='open_requested')throw problem('URGENT_MAIL_STATUS_INVALID','Der Mailstatus kann nicht bestätigt werden.',409);
 const actorId=text(actor&&actor.id,150);
 if(!actorId)throw problem('URGENT_ACTOR_REQUIRED','Angemeldeter Mitarbeiter erforderlich.',401);
 mail.status='sent_confirmed';mail.sentAt=now;
 mail.sentConfirmedBy={id:actorId,name:text(actor.name||actor.user||actor.login||actorId,150)};
 order.updatedAt=now;
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId,event:'mail_sent_manually_confirmed',mailId:mail.id,kind:mail.kind});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return mail;
}

module.exports={PRIORITIES,STATUSES,DELIVERY,LANGUAGES,ORDER_TYPES,ARRIVAL_MODES,DISPATCH_METHODS,CLOSED_STATUSES,text,problem,email,language,orderNumber,localDateTime,validateDirectOutbound,createOrder,canManage,canRead,setItemStatus,isClosed,summaryStatus,draftMail,recordMailHandoff,confirmMailSent,requestGraphMail,confirmGraphMailAccepted,markGraphMailUnverified};