'use strict';
/* Shared milestone UI for internal Urgent Order and reporter tracking. */
(function(root){
 const ALL=['created','received','abd','ready','collected','pod','completed'];
 const DE={created:'Erstellt',received:'Wareneingang eingebucht',abd:'ABD',ready:'Bereit',collected:'Abgeholt',pod:'POD',completed:'Abgeschlossen'};
 const EN={created:'Created',received:'Goods received / booked',abd:'Export declaration',ready:'Ready',collected:'Collected',pod:'POD',completed:'Completed'};
 function english(){try{return root.ExportHUBI18n&&root.ExportHUBI18n.language()==='en';}catch(_){return false}}
 function tr(key,de,en){
  const path='urgentProgress.'+key;
  try{
   const api=root.ExportHUBI18n;
   const value=api&&api.t(path,null,api.language());
   if(typeof value==='string'&&value&&value!==path)return value;
  }catch(_){}
  return english()?en:de;
 }
 function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
 function keys(order){return order&&order.orderType==='DIRECT_OUTBOUND'?ALL:ALL.filter(k=>k!=='received');}
 function stages(order){
  const raw=order&&order.progress&&order.progress.steps;
  return keys(order).map(key=>{
   const saved=Array.isArray(raw)?raw.find(s=>s&&s.key===key)||{}:raw&&raw[key]||{};
   const state=key==='created'?'done':['done','skipped'].includes(saved.state)?saved.state:'pending';
   return{key,state,at:key==='created'?order.createdAt||null:saved.at||null,reason:saved.reason||'',actorName:saved.actorName||''};
  });
 }
 function pendingBefore(order,key){const a=stages(order),i=a.findIndex(s=>s.key===key);return i<0?[]:a.slice(1,i).filter(s=>s.state==='pending').map(s=>s.key);}
 function unread(order,viewerId){
  const n=order&&order.progress&&order.progress.receiptNotice;
  return !!(n&&n.at&&viewerId&&!(Array.isArray(n.readBy)&&n.readBy.includes(viewerId)));
 }
 function label(key){return tr(key,DE[key]||key,EN[key]||key);}
 function markup(order,options){
  const opts=options||{},list=stages(order),done=list.filter(s=>s.state!=='pending').length,pct=Math.round(100*done/list.length);
  const next=list.find(s=>s.state==='pending');
  const notify=opts.canManage&&unread(order,opts.viewerId);
  const h=english(),stateLabel=(s)=>s.state==='done'?tr('confirmed','Bestätigt','Confirmed'):s.state==='skipped'?tr('skipped','Übersprungen · bestätigt','Skipped · confirmed'):tr('pending','Offen','Pending');
  const items=list.map((s,i)=>{
   const canClick=s.state==='pending'&&(opts.canManage===true||s.key==='received'&&opts.canConfirmReceipt===true);
   const info=s.state!=='pending'&&s.at?'<span class="up-time">'+esc(new Date(s.at).toLocaleString(h?'en-GB':'de-DE',{dateStyle:'short',timeStyle:'short'}))+'</span>':'';
   const action=canClick?'<button type="button" data-progress-step="'+esc(s.key)+'" class="up-confirm">'+esc(tr('confirm','Bestätigen','Confirm'))+'</button>':'';
   const reason=s.state==='skipped'&&s.reason?'<span class="up-time">'+esc(s.reason)+'</span>':'';
   return'<li class="up-step up-'+esc(s.state)+(next&&next.key===s.key?' up-current':'')+'"><span class="up-dot" aria-hidden="true">'+(s.state==='done'?'✓':s.state==='skipped'?'↷':String(i+1))+'</span><strong>'+esc(label(s.key))+'</strong><span class="up-status">'+esc(stateLabel(s))+'</span>'+info+reason+action+'</li>';
  }).join('');
  return'<section class="urgent-milestones" aria-label="'+esc(tr('title','Anfragefortschritt','Request progress'))+'"><div class="up-heading"><strong>'+esc(tr('heading','Auftragsfortschritt','Order progress'))+'</strong><span>'+done+' / '+list.length+'</span></div>'+
   '<div class="up-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="'+esc(tr('progressbar','Bestätigte oder ausdrücklich übersprungene Schritte','Confirmed or explicitly skipped steps'))+'"><span style="width:'+pct+'%"></span></div>'+
   '<ol class="up-steps">'+items+'</ol>'+
   (notify?'<div class="up-notification" role="status">🔔 '+esc(tr('notification','Neuer bestätigter Wareneingang für diesen Auftrag.','New goods receipt confirmation for this order.'))+' <button type="button" data-progress-ack>'+esc(tr('ack','Als gelesen markieren','Mark as read'))+'</button></div>':'')+
   '<p class="up-note">'+esc(tr('note','Diese Schritte sind manuelle Bestätigungen der Auftragsbearbeitung; sie buchen nichts in D365.','These milestones are manual order-processing confirmations; they do not book changes in D365.'))+'</p></section>';
 }
 root.UrgentProgressUI={markup,pendingBefore,unread,label,stages};
})(window);
