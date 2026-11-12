'use strict';
// Order-level milestone confirmations are independent of D365 item statuses and shipments.
// Never infer ABD, POD, collection or goods receipt from another status.
const STEPS=Object.freeze(['created','received','abd','ready','collected','pod','completed']);
const NORMAL=Object.freeze(STEPS.filter(x=>x!=='received'));
const LABELS=Object.freeze({
 created:'Erstellt',received:'Wareneingang eingebucht',abd:'ABD',
 ready:'Bereit',collected:'Abgeholt',pod:'POD',completed:'Abgeschlossen'
});
function problem(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e;}
function text(v,max=200){return String(v==null?'':v).trim().slice(0,max);}
function stages(order){return order&&order.orderType==='DIRECT_OUTBOUND'?STEPS:NORMAL;}
function entries(order){const p=order&&order.progress;return p&&p.steps&&typeof p.steps==='object'&&!Array.isArray(p.steps)?p.steps:{};}
function state(order,key){if(key==='created')return'done';const entry=entries(order)[key];return entry&&['done','skipped'].includes(entry.state)?entry.state:'pending';}
function view(order,publicView=false){
 const keys=stages(order),list=keys.map(key=>{
  const stored=entries(order)[key]||{};
  const result={key,label:LABELS[key],state:state(order,key),at:key==='created'?order.createdAt||null:stored.at||null};
  if(!publicView&&stored.actorName)result.actorName=text(stored.actorName,150);
  if(!publicView&&stored.reason&&result.state==='skipped')result.reason=text(stored.reason,500);
  return result;
 });
 const processed=list.filter(s=>s.state!=='pending').length;
 return {steps:list,processed,total:list.length,percent:Math.round(100*processed/list.length),completed:state(order,'completed')==='done'};
}
function pendingBefore(order,key){const keys=stages(order),i=keys.indexOf(key);return i<0?[]:keys.slice(1,i).filter(s=>state(order,s)==='pending');}
function confirm(order,key,actor,now=new Date().toISOString(),options={}){
 if(!order||order.deletedAt)throw problem('URGENT_NOT_FOUND','Anfrage nicht gefunden.',404);
 if(order.deletion&&order.deletion.state==='pending')throw problem('URGENT_DELETE_PENDING','Bitte zuerst die Löschanfrage klären.',409);
 if(!stages(order).includes(key)||key==='created')throw problem('URGENT_PROGRESS_STEP_INVALID','Dieser Fortschrittsschritt ist für die Anfrage nicht vorgesehen.');
 const actorId=text(actor&&actor.id,150),actorName=text(actor&&actor.name,150);
 if(!actorId)throw problem('URGENT_ACTOR_REQUIRED','Eine bestätigte Identität ist erforderlich.',401);
 const manager=options.canManage===true;
 if(!manager&&!(key==='received'&&options.canConfirmReceipt===true))
  throw problem('URGENT_PROGRESS_FORBIDDEN','Nur die Logistik darf diesen Schritt bestätigen.',403);
 if(state(order,key)!=='pending')throw problem('URGENT_PROGRESS_ALREADY_CONFIRMED','Dieser Schritt wurde bereits bestätigt oder übersprungen.',409);
 const skipped=pendingBefore(order,key);
 const proposed=Array.isArray(options.skippedSteps)?options.skippedSteps:[];
 if(skipped.length){
  if(!manager)throw problem('URGENT_PROGRESS_FORBIDDEN','Nur die Logistik darf Schritte überspringen.',403);
  if(options.confirmSkipped!==true||proposed.length!==skipped.length||
    skipped.some((s,i)=>s!==proposed[i])||new Set(proposed).size!==proposed.length)
    throw problem('URGENT_PROGRESS_SKIP_CONFIRM_REQUIRED','Jeder übersprungene Schritt muss ausdrücklich bestätigt werden.',409);
  if(text(options.skipReason,500).length<8)throw problem('URGENT_PROGRESS_SKIP_REASON_REQUIRED','Bitte den Grund für das Überspringen angeben (mindestens 8 Zeichen).');
 }else if(proposed.length)throw problem('URGENT_PROGRESS_SKIP_INVALID','Es gibt keine übersprungenen Schritte zu bestätigen.');
 if(!order.progress||typeof order.progress!=='object')order.progress={steps:{}};
 if(!order.progress.steps||typeof order.progress.steps!=='object'||Array.isArray(order.progress.steps))order.progress.steps={};
 const reason=text(options.skipReason,500);
 for(const s of skipped)order.progress.steps[s]={state:'skipped',at:now,actorId,actorName,reason};
 order.progress.steps[key]={state:'done',at:now,actorId,actorName};
 order.updatedAt=now;
 order.history=Array.isArray(order.history)?order.history:[];
 for(const s of skipped)order.history.push({at:now,actorId,event:'progress_skipped',step:s,reason});
 order.history.push({at:now,actorId,event:'progress_confirmed',step:key});
 if(order.history.length>200)order.history=order.history.slice(-200);
 if(key==='received'){
  order.progress.receiptNotice={id:now+'|'+actorId,at:now,actorId,readBy:[]};
 }
 return view(order);
}
function unreadReceipt(order,viewerId){
 const n=order&&order.progress&&order.progress.receiptNotice;
 return !!(n&&n.at&&text(viewerId,150)&&!(Array.isArray(n.readBy)&&n.readBy.includes(text(viewerId,150))));
}
function acknowledgeReceipt(order,actor,now=new Date().toISOString()){
 const actorId=text(actor&&actor.id,150),n=order&&order.progress&&order.progress.receiptNotice;
 if(!actorId||!n||!n.at)throw problem('URGENT_RECEIPT_NOTICE_MISSING','Keine Wareneingangsbenachrichtigung vorhanden.',404);
 if(!Array.isArray(n.readBy))n.readBy=[];
 if(n.readBy.includes(actorId))return false;
 if(n.readBy.length>=200)throw problem('URGENT_RECEIPT_NOTICE_CAPACITY','Benachrichtigung kann nicht weiter quittiert werden.',409);
 n.readBy.push(actorId);order.updatedAt=now;
 return true;
}
module.exports={STEPS,NORMAL,LABELS,stages,view,state,pendingBefore,confirm,unreadReceipt,acknowledgeReceipt};
