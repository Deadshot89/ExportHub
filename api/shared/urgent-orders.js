'use strict';
// Urgent Order domain model. No D365 access and no implicit claims of stock availability.
const crypto = require('node:crypto');
const PRIORITIES = Object.freeze(['P1','P2','P3','P4']);
const STATUSES = Object.freeze(['Open','Waved','In Progress','Loaded','Shipped','Invoiced']);
const LANGUAGES = Object.freeze(['de','en']);
const DELIVERY = Object.freeze(['DRP','DIRECT']);
function text(v,max=200){return String(v==null?'':v).trim().slice(0,max);}
function problem(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e;}
function email(v){const value=text(v,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)||/[\r\n]/.test(value))throw problem('URGENT_EMAIL_INVALID','Bitte eine gültige CS-E-Mail-Adresse angeben.');return value;}
function language(v){const raw=text(v,10).toLowerCase();return LANGUAGES.includes(raw)?raw:'de';}
function orderNumber(v){const raw=text(v,40).toUpperCase();if(!/^SO[A-Z0-9-]{2,38}$/.test(raw))throw problem('URGENT_SO_INVALID','Die Auftragsnummer muss mit SO beginnen.');return raw;}
function positiveInt(v){const n=Number(v);if(!Number.isSafeInteger(n)||n<1||n>10000000)throw problem('URGENT_QUANTITY_INVALID','Jede Position braucht eine gültige Menge größer als 0.');return n;}
function explicitCheck(v,key){if(typeof v!=='boolean')throw problem('URGENT_CHECK_MISSING','Die CS-Prüfung "'+key+'" muss mit Ja oder Nein beantwortet werden.');return v;}
function validateItems(raw,now){
 if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw problem('URGENT_LINES_REQUIRED','Bitte 1 bis 100 Artikel/Lines erfassen.');
 const seen=new Set();
 return raw.map((r,i)=>{
  const line=text(r&&r.line,70),article=text(r&&r.article,120);
  if(!line&&!article)throw problem('URGENT_LINE_INVALID','Bei jeder Position muss Line oder Artikelnummer eingetragen sein.');
  const key=(line||'#')+'|'+(article||'#');if(seen.has(key))throw problem('URGENT_DUPLICATE_LINE','Eine Position wurde mehrfach eingetragen.');seen.add(key);
  const isMinibag=r&&r.minibag===true;
  const checks={pickableStock:explicitCheck(r&&r.pickableStock,'pickbarer Bestand'),holdsClear:explicitCheck(r&&r.holdsClear,"Don't Process / Credit Hold"),minibagLeadtime:isMinibag?explicitCheck(r&&r.minibagLeadtime,'10 Tage Minibag-Leadtime'):null};
  const failed=!checks.pickableStock||!checks.holdsClear||(isMinibag&&!checks.minibagLeadtime);
  const exceptionReason=text(r&&r.exceptionReason,1000);
  if(failed&&exceptionReason.length<8)throw problem('URGENT_EXCEPTION_REASON_REQUIRED','Bei nicht bestandenen Prüfungen ist eine Begründung mit mindestens 8 Zeichen erforderlich.');
  return {id:crypto.randomUUID(),line,article,quantity:positiveInt(r&&r.quantity),minibag:isMinibag,checks,exceptionReason:failed?exceptionReason:'',checkResult:failed?'exception':'passed',status:'Open',checkedAt:now};
 });
}
function createOrder(raw,actor,now=new Date().toISOString()){
 const p=raw&&typeof raw==='object'?raw:{};
 const delivery=text(p.delivery,10).toUpperCase();
 const priority=text(p.priority,2).toUpperCase();
 if(!DELIVERY.includes(delivery))throw problem('URGENT_DELIVERY_INVALID','Bitte DRP oder Direktlieferung auswählen.');
 if(!PRIORITIES.includes(priority))throw problem('URGENT_PRIORITY_INVALID','Bitte eine Priorität P1 bis P4 wählen.');
 const ownerId=text(actor&&actor.id,150);
 if(!ownerId)throw problem('URGENT_ACTOR_REQUIRED','Ein angemeldeter Benutzer ist erforderlich.',401);
 return{id:crypto.randomUUID(),orderNumber:orderNumber(p.orderNumber),delivery,priority,email:email(p.email),language:language(p.language),createdBy:{id:ownerId,name:text(actor.name,150)},createdAt:now,updatedAt:now,items:validateItems(p.items,now),history:[{at:now,actorId:ownerId,event:'created'}]};
}
function canManage(user){if(user&&user.globalAdmin===true)return true;const r=user&&user.rights||{};return ['shipmentoverview','tasks'].some(k=>{const x=r[k]||{};return x.edit===true||x.admin===true||x.functionAdmin===true||['edit','admin'].includes(String(x.level||x.access||'').toLowerCase());});}
function canRead(order,user){return canManage(user)||text(order&&order.createdBy&&order.createdBy.id)===text(user&&user.id);}
function setItemStatus(order,itemId,status,user,now=new Date().toISOString()){
 if(!canManage(user))throw problem('URGENT_FORBIDDEN','Nur die Logistik darf Positionen aktualisieren.',403);
 if(!STATUSES.includes(status))throw problem('URGENT_STATUS_INVALID','Ungültiger Status.');
 const item=(order.items||[]).find(x=>x.id===itemId);
 if(!item)throw problem('URGENT_ITEM_NOT_FOUND','Position nicht gefunden.',404);
 if(item.status===status)return false;
 const previous=item.status;
 item.status=status;item.updatedAt=now;order.updatedAt=now;
 order.history=Array.isArray(order.history)?order.history:[];
 order.history.push({at:now,actorId:text(user.id),event:'status',itemId,previous,status});
 if(order.history.length>200)order.history=order.history.slice(-200);
 return true;
}
function summaryStatus(order){const unique=[...new Set((order.items||[]).map(x=>x.status))];return unique.length===1?unique[0]:'Mixed';}
function draftMail(order,kind,lang,note){
 const l=language(lang||order.language),issue=kind==='problem';
 if(!issue&&kind!=='shipping')throw problem('URGENT_MAIL_KIND_INVALID','Unbekannter E-Mail-Typ.');
 if(!issue&&(order.items||[]).some(x=>!['Shipped','Invoiced'].includes(x.status)))throw problem('URGENT_NOT_SHIPPED','Versandbestätigung erst nach Status Shipped für alle Positionen möglich.',409);
 const message=text(note,2000);
 if(issue&&message.length<8)throw problem('URGENT_MAIL_NOTE_REQUIRED','Bitte das Problem beschreiben (mindestens 8 Zeichen).');
 const itemLines=(order.items||[]).map(x=>[(x.line?'Line '+x.line:'') ,(x.article?'Item '+x.article:''),'Qty '+x.quantity,'Status '+x.status].filter(Boolean).join(' · ')).join('\n');
 if(l==='en')return{to:order.email,language:l,subject:(issue?'Urgent Order – Issue / ':'Urgent Order – Shipping confirmation / ')+order.orderNumber,body:(issue?'We would like to inform you about an issue with your urgent order.':'We confirm that the following urgent order positions have been shipped.')+'\n\nSales order: '+order.orderNumber+'\nDelivery: '+(order.delivery==='DIRECT'?'Direct delivery':'DRP')+'\nPriority: '+order.priority+'\n\n'+itemLines+(issue?'\n\nIssue:\n'+message:'')+'\n\nBest regards,\nLogistics Team'};
 return{to:order.email,language:l,subject:(issue?'Urgent Order – Problem / ':'Urgent Order – Versandbestätigung / ')+order.orderNumber,body:(issue?'Wir möchten Sie über ein Problem mit Ihrem dringenden Auftrag informieren.':'Wir bestätigen den Versand der folgenden Positionen Ihres dringenden Auftrags.')+'\n\nAuftrag: '+order.orderNumber+'\nLieferart: '+(order.delivery==='DIRECT'?'Direktlieferung':'DRP')+'\nPriorität: '+order.priority+'\n\n'+itemLines+(issue?'\n\nProblem:\n'+message:'')+'\n\nMit freundlichen Grüßen\nLogistik'};
}
module.exports={PRIORITIES,STATUSES,DELIVERY,LANGUAGES,text,problem,email,language,orderNumber,createOrder,canManage,canRead,setItemStatus,summaryStatus,draftMail};