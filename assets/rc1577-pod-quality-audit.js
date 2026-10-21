/* ExportHUB360 RC1577 – admin POD audit.
   Step 1 (read-only): /api/pod-quality-audit reports every shipment with a POD as ok, regenerate, review, manual or flagged.
   Step 2 (only after the admin confirms): regenerate PODs in this browser with the current loading-list layout
   (ExportHUBPODCloudBackup.backup), re-check them on the server, and put every POD that could not be repaired on
   "Abgeholt" with podReviewRequired so the admin can check it. The flag keeps the canonical status on "Abgeholt"
   until the admin releases it here. Texts live in assets/i18n/rc1577-pod-quality-audit.js. */
(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBPodQualityAudit)return;
var VERSION='RC1577',ENDPOINT='/api/pod-quality-audit',MODAL_ID='rc1577PodAuditModal',BUTTON_ID='rc1577PodAuditOpen',PICKED_UP='Abgeholt';
var rows=[],busy=false,stopRequested=false;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function packs(){var p=w.ExportHUBPodAudit1577I18n;return p&&p.packs||{de:{}}}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(packs()[l])return l}}catch(_){}return'de'}
function t(key,vars){var all=packs(),pack=all[lang()]||all.de||{},text=pack[key]||(all.de||{})[key]||key;if(vars)Object.keys(vars).forEach(function(k){text=text.split('{'+k+'}').join(String(vars[k]))});return text}
function ref(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id)).toUpperCase()}

function states(){var out=[];function add(x){if(x&&typeof x==='object'&&out.indexOf(x)<0)out.push(x)}try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')add(w.__EXPORTHUB_GET_STATE__())}catch(_){}try{add(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state)}catch(_){}return out}
function copies(reference){var out=[];states().forEach(function(st){arr(st.shipments).concat(arr(st.savedShipments),st.shipment&&typeof st.shipment==='object'?[st.shipment]:[],st.currentShipment&&typeof st.currentShipment==='object'?[st.currentShipment]:[]).forEach(function(x){if(x&&ref(x)===reference&&out.indexOf(x)<0)out.push(x)})});return out}
function currentUser(){try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}var s=states()[0]||{};return s.currentUser||s.activeUser||s.user||null}
function isAdmin(u){u=u||currentUser();if(!u)return false;var name=low(u.user||u.username||u.login||u.displayName||u.name);return u.globalAdmin===true||u.isAdmin===true||u.admin===true||name==='tobias'||name==='t.limberg'||name==='tobias limberg'||/admin|vollzugriff/i.test(q(u.role||u.rolle))||arr(u.permissions).indexOf('*')>=0}
function userName(){var u=currentUser()||{};return q(u.displayName||u.name||u.user||u.username)||'Admin'}
function save(reason){try{if(w.ExportHUBClean&&typeof w.ExportHUBClean.queueSave==='function')return w.ExportHUBClean.queueSave(reason);if(typeof w.save==='function')return w.save()}catch(e){console.error('RC1577 POD-Prüfung speichern',e)}return false}
function recalc(sh){try{var api=w.ExportHUBMailStatus373;if(api&&typeof api.recalculate==='function')api.recalculate(sh)}catch(_){}try{w.dispatchEvent(new CustomEvent('exporthub:status-updated',{detail:{shipmentId:q(sh&&sh.id),status:q(sh&&sh.status)}}))}catch(_){}}

function sessionToken(){
 try{var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime||{},direct=q(rt.authToken||rt.token||rt.sessionToken);if(direct)return direct}catch(_){}
 try{var raw=w.sessionStorage&&w.sessionStorage.getItem('exporthub_rc301_tab_session');if(raw){var x=JSON.parse(raw),token=q(x&&x.token);if(token)return token}}catch(_){}
 return''
}
async function call(payload){
 var token=sessionToken(),headers={'Content-Type':'application/json',Accept:'application/json'};
 if(token){headers['X-ExportHUB-Token']=token;headers.Authorization='Bearer '+token}
 var response=await w.fetch(ENDPOINT,{method:'POST',credentials:'same-origin',cache:'no-store',headers:headers,body:JSON.stringify(Object.assign({action:'report'},payload||{}))});
 var text=await response.text(),data={};try{data=text?JSON.parse(text):{}}catch(_){data={message:text}}
 if(!response.ok||data.ok===false){var e=new Error(q(data.message)||('HTTP '+response.status));e.code=q(data.code);throw e}
 return data
}

// --- state changes, only reached after the admin confirmed the report ---
function flagForReview(reference,reason){
 var list=copies(reference),at=new Date().toISOString(),by=userName();if(!list.length)return false;
 list.forEach(function(x){
  var before=q(x.status);
  x.podReviewRequired=true;x.podReviewReason=q(reason);x.podReviewAt=at;x.podReviewBy=by;
  x.status=PICKED_UP;x.processStatus=PICKED_UP;x.updatedAt=at;x._syncUpdatedAt=at;
  x.statusHistory=arr(x.statusHistory);x.statusHistory.push({at:at,from:before,to:PICKED_UP,source:VERSION+' POD-Prüfung',by:by,reason:q(reason)});
 });
 recalc(list[0]);return true
}
function release(reference){
 var list=copies(reference),at=new Date().toISOString(),by=userName();if(!list.length)return false;
 list.forEach(function(x){
  x.podReviewRequired=false;x.podReviewReleasedAt=at;x.podReviewReleasedBy=by;x.updatedAt=at;x._syncUpdatedAt=at;
  x.statusHistory=arr(x.statusHistory);x.statusHistory.push({at:at,from:q(x.status),to:q(x.status),source:VERSION+' POD-Prüfung freigegeben',by:by});
 });
 recalc(list[0]);save(VERSION+' POD-Prüfung: '+reference+' freigegeben');return true
}
async function regenerate(reference){
 var sh=copies(reference)[0],api=w.ExportHUBPODCloudBackup;
 if(!sh||!api||typeof api.backup!=='function')return false;
 try{if(await api.backup(sh,true)!==true)return false}catch(e){console.warn('RC1577 POD neu erzeugen',reference,e);return false}
 try{var check=await call({references:[reference]}),row=arr(check.rows)[0];return !!row&&row.verdict==='ok'}catch(e){console.warn('RC1577 POD Nachprüfung',reference,e);return false}
}

// --- UI ---
function style(){
 if(d.getElementById('rc1577PodAuditStyle'))return;
 var st=d.createElement('style');st.id='rc1577PodAuditStyle';st.textContent=
 '#'+MODAL_ID+'{position:fixed;inset:0;z-index:2147483601;background:rgba(15,23,42,.45);display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}'+
 '#'+MODAL_ID+' .rc1577-card{background:#fff;color:#0f172a;border-radius:14px;max-width:980px;width:100%;padding:18px 20px;box-shadow:0 20px 50px rgba(15,23,42,.3)}'+
 '#'+MODAL_ID+' .rc1577-head{display:flex;justify-content:space-between;align-items:center;gap:12px}'+
 '#'+MODAL_ID+' h2{margin:0;font-size:18px}'+
 '#'+MODAL_ID+' .rc1577-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}'+
 '#'+MODAL_ID+' .rc1577-status{min-height:20px;font-weight:600;margin:6px 0}'+
 '#'+MODAL_ID+' .rc1577-group{margin-top:14px}'+
 '#'+MODAL_ID+' .rc1577-group h3{font-size:14px;margin:0 0 6px}'+
 '#'+MODAL_ID+' table{width:100%;border-collapse:collapse;font-size:12px}'+
 '#'+MODAL_ID+' th,#'+MODAL_ID+' td{border-bottom:1px solid #e2e8f0;padding:5px 6px;text-align:left;vertical-align:top}'+
 '#'+MODAL_ID+' [data-verdict="regenerate"] h3{color:#1d4ed8}#'+MODAL_ID+' [data-verdict="review"] h3,#'+MODAL_ID+' [data-verdict="flagged"] h3{color:#b45309}#'+MODAL_ID+' [data-verdict="manual"] h3{color:#7c3aed}';
 d.head.appendChild(st)
}
function setStatus(message){var node=d.querySelector('#'+MODAL_ID+' .rc1577-status');if(node)node.textContent=message||''}
function byVerdict(verdict){return rows.filter(function(r){return r.verdict===verdict})}
function reasonText(row){var text=t('r_'+row.reason);if(row.missing)text+=' · '+t('m_'+row.missing);return text}
function pickupDate(row){var v=q(row.confirmedAt);if(!v)return'';var dt=new Date(v);return isNaN(dt.getTime())?v:dt.toLocaleDateString()}
function table(list,withRelease){
 return '<table><thead><tr><th>'+esc(t('colRef'))+'</th><th>'+esc(t('colCustomer'))+'</th><th>'+esc(t('colPickup'))+'</th><th>'+esc(t('colReason'))+'</th>'+(withRelease?'<th></th>':'')+'</tr></thead><tbody>'+
 list.map(function(r){return '<tr data-reference="'+esc(r.reference)+'"><td>'+esc(r.reference)+'</td><td>'+esc(r.customer)+'</td><td>'+esc(pickupDate(r))+'</td><td>'+esc(reasonText(r))+'</td>'+(withRelease?'<td><button type="button" class="ghost" data-rc1577-release="'+esc(r.reference)+'">'+esc(t('release'))+'</button></td>':'')+'</tr>'}).join('')+'</tbody></table>'
}
function render(){
 var box=d.querySelector('#'+MODAL_ID+' .rc1577-result');if(!box)return;
 if(!rows.length){box.innerHTML='';return}
 var html='',ok=byVerdict('ok').length,todoRegenerate=byVerdict('regenerate').length,todoReview=byVerdict('review').length;
 html+='<p data-rc1577-ok-count="'+ok+'">'+esc(t('okCount',{count:ok}))+'</p>';
 ['regenerate','review','manual','flagged'].forEach(function(verdict){var list=byVerdict(verdict);if(!list.length)return;html+='<div class="rc1577-group" data-verdict="'+verdict+'"><h3>'+esc(t('v_'+verdict))+' ('+list.length+')</h3>'+table(list,verdict==='flagged')+'</div>'});
 if(rows.length===1&&rows[0].verdict==='ok'&&rows[0].reason==='CURRENT_LAYOUT')html+='<div class="rc1577-actions"><button type="button" class="ghost" id="rc1577PodAuditForce">'+esc(t('forceRegenerate'))+'</button></div>';
 if(todoRegenerate||todoReview)html+='<div class="rc1577-actions"><button type="button" class="primary" id="rc1577PodAuditApply">'+esc(t('apply',{regenerate:todoRegenerate,review:todoReview}))+'</button></div>';
 else if(!byVerdict('manual').length&&!byVerdict('flagged').length)html+='<p>'+esc(t('nothing'))+'</p>';
 box.innerHTML=html
}
async function scan(){
 if(busy)return;busy=true;stopRequested=false;rows=[];render();
 var cursor=0,guard=0;
 try{
  do{var data=await call({cursor:cursor,limit:25});rows=rows.concat(arr(data.rows));setStatus(t('scanning',{count:rows.length}));cursor=data.nextCursor;guard++}while(cursor!=null&&!stopRequested&&guard<400);
  setStatus(stopRequested?t('stopped'):'');
 }catch(e){setStatus(t('error',{message:q(e&&e.message)}))}
 finally{busy=false;render()}
}
async function scanReference(){
 if(busy)return;
 var input=d.getElementById('rc1577PodAuditReference'),reference=q(input&&input.value).toUpperCase();
 if(!/^[A-Z0-9]{6}$/.test(reference)){setStatus(t('invalidReference'));return;}
 busy=true;stopRequested=false;rows=[];render();
 try{var data=await call({references:[reference]});rows=arr(data.rows);setStatus(rows.length?'':t('notFound'))}
 catch(e){setStatus(t('error',{message:q(e&&e.message)}))}
 finally{busy=false;render()}
}
function forceRegenerate(){
 // Merely queue a re-render in the report; no POD file is overwritten without apply()'s confirmation.
 if(busy||rows.length!==1||rows[0].verdict!=='ok'||rows[0].reason!=='CURRENT_LAYOUT')return;
 rows[0].verdict='regenerate';rows[0].reason='FORCE_REGENERATE';
 setStatus(t('forceQueued'));render();
}
async function apply(){
 if(busy)return;
 var toRegenerate=byVerdict('regenerate'),toReview=byVerdict('review');
 if(!toRegenerate.length&&!toReview.length)return;
 if(!w.confirm(t('confirm',{regenerate:toRegenerate.length,review:toReview.length})))return;
 busy=true;stopRequested=false;var regenerated=0,flagged=0;
 try{
  for(var i=0;i<toRegenerate.length&&!stopRequested;i++){
   var row=toRegenerate[i];setStatus(t('running',{index:i+1,total:toRegenerate.length,reference:row.reference}));
   if(await regenerate(row.reference)){regenerated++;row.verdict='ok';row.reason='CURRENT_LAYOUT'}
   else{row.verdict='review';row.reason='REGENERATE_FAILED';toReview.push(row)}
  }
  toReview.forEach(function(row){if(stopRequested)return;if(flagForReview(row.reference,row.reason)){flagged++;row.verdict='flagged';row.reason='REVIEW_FLAGGED';row.missing=''}else{row.verdict='manual';row.missing='';row.reason=row.reason||'NO_POD_FILE'}});
  if(flagged)save(VERSION+' POD-Prüfung: Status für '+flagged+' Sendungen zurückgesetzt');
  setStatus(stopRequested?t('stopped'):t('done',{regenerated:regenerated,flagged:flagged}));
 }finally{busy=false;render()}
}
function close(){var m=d.getElementById(MODAL_ID);if(m)m.remove();stopRequested=true}
function open(){
 if(!isAdmin())return false;
 style();close();stopRequested=false;
 var m=d.createElement('div');m.id=MODAL_ID;m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');
 m.innerHTML='<div class="rc1577-card"><div class="rc1577-head"><h2>'+esc(t('title'))+'</h2><button type="button" class="ghost" data-rc1577-close="1">'+esc(t('close'))+'</button></div>'+
  '<p>'+esc(t('intro'))+'</p><div class="rc1577-actions"><input id="rc1577PodAuditReference" type="text" inputmode="text" maxlength="6" autocomplete="off" aria-label="'+esc(t('referenceInput'))+'" placeholder="'+esc(t('referenceInput'))+'"/><button type="button" class="ghost" id="rc1577PodAuditScanRef">'+esc(t('scanReference'))+'</button></div><div class="rc1577-actions"><button type="button" class="primary" id="rc1577PodAuditStart">'+esc(rows.length?t('rescan'):t('start'))+'</button><button type="button" class="ghost" id="rc1577PodAuditStop">'+esc(t('stop'))+'</button></div>'+
  '<div class="rc1577-status" aria-live="polite"></div><div class="rc1577-result"></div></div>';
 d.body.appendChild(m);render();return true
}
function injectButton(){
 var modal=d.getElementById('rc422PodBackupModal');if(!modal||d.getElementById(BUTTON_ID)||!isAdmin())return;
 var anchor=modal.querySelector('#rc422PodDownload');
 var b=d.createElement('button');b.type='button';b.className='ghost';b.id=BUTTON_ID;b.textContent=t('button');
 if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(b,anchor.nextSibling);else(modal.querySelector('.modal-card,.card,div')||modal).appendChild(b)
}
d.addEventListener('click',function(e){
 var target=e.target;if(!target||!target.closest)return;
 if(target.closest('#'+BUTTON_ID)){e.preventDefault();var backup=d.getElementById('rc422PodBackupModal');if(backup){backup.hidden=true;d.body.style.removeProperty('overflow')}open();return}
 if(!target.closest('#'+MODAL_ID))return;
 if(target.closest('[data-rc1577-close]')){close();return}
 if(target.closest('#rc1577PodAuditStart')){scan();return}
 if(target.closest('#rc1577PodAuditScanRef')){scanReference();return}
 if(target.closest('#rc1577PodAuditForce')){forceRegenerate();return}
 if(target.closest('#rc1577PodAuditStop')){stopRequested=true;return}
 if(target.closest('#rc1577PodAuditApply')){apply();return}
 var rel=target.closest('[data-rc1577-release]');
 if(rel){var reference=q(rel.getAttribute('data-rc1577-release'));if(release(reference)){rows=rows.filter(function(r){return r.reference!==reference});render();setStatus(t('released',{reference:reference}))}else setStatus(t('notFound'))}
},true);
try{new MutationObserver(injectButton).observe(d.documentElement,{childList:true,subtree:true})}catch(_){}
w.ExportHUBPodQualityAudit=Object.freeze({version:VERSION,open:open,scan:scan,scanReference:scanReference,forceRegenerate:forceRegenerate,apply:apply,release:release,flagForReview:flagForReview,rows:function(){return rows.slice()}});
})(typeof window!=='undefined'?window:null,typeof document!=='undefined'?document:null);
