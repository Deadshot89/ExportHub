// ExportHUB RC1126 – Kundenstammsatz sicher löschen, ohne Sendungs-/Historiedaten anzutasten.
(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1126_CUSTOMER_DELETE__)return;
w.__EXPORTHUB_RC1126_CUSTOMER_DELETE__=true;

var timer=0,working=false;
function q(v){return String(v==null?'':v).trim()}
function tr(key,vars,language){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.t==='function')return w.ExportHUBI18n.t(key,vars,language)}catch(_){}return key}
function low(v){return q(v).toLocaleLowerCase('de-DE')}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
function clone(v){try{return JSON.parse(JSON.stringify(v))}catch(_){return v}}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state||w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||w.state||{}}
function view(){var s=state();return low(s.view||s.currentView||s.activeView||s.page||'')}
function customerView(){var v=view();return v==='customerfolder'||v==='customers'||v==='customer'||v==='kundenordner'||v==='kunden'}
function customerKey(c){return q(c&&(c.id||c.account||c.customerNumber||c.name))}
function customerLabel(c){return q(c&&(c.name||c.customerName))||tr('customerDelete.unnamed')}
function customerAccount(c){return q(c&&(c.account||c.customerNumber||c.kundennummer))}
function currentCustomer(){
 var s=state(),direct=s.currentCustomer||s.selectedCustomer||null,key=q(s.currentCustomerId||s.selectedCustomerId||s.customerFolderId||s.customerFolderOpenId||(direct&&customerKey(direct)));
 if(!key)return direct&&obj(direct)?direct:null;
 var lk=low(key);
 return arr(s.customers).find(function(c){return c&&(low(customerKey(c))===lk||low(c.id||c.customerId)===lk||low(c.account||c.customerNumber||c.kundennummer)===lk)})||(direct&&obj(direct)?direct:null)
}
function currentUser(){
 try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}
 var s=state();return w.currentUser||s.currentUser||s.activeUser||null
}
function canDelete(){
 var u=currentUser()||{},role=low(u.role||u.rolle),rights=u.rights||{},a=rights.customers||{},b=rights.customerfolder||{},la=low(a.level||a.access),lb=low(b.level||b.access);
 if(u.globalAdmin===true||u.isGlobalAdmin===true||arr(u.permissions).indexOf('*')>=0||/^(global admin|global administrator|globaler administrator|globaler admin|administrator|admin|vollzugriff)$/.test(role))return true;
 return a.admin===true||a.functionAdmin===true||la==='admin'||b.admin===true||b.functionAdmin===true||lb==='admin'
}
function shipmentCustomerMatches(sh,c){
 if(!sh||!c)return false;
 var ids=[c.id,c.customerId,c.account,c.customerNumber,c.kundennummer].map(low).filter(Boolean);
 var names=[c.name,c.customerName].map(low).filter(Boolean);
 var shIds=[sh.customerId,sh.linkedCustomerId,sh.customerAccount,sh.customerNumber,sh.kundennummer].map(low).filter(Boolean);
 var shNames=[sh.customer,sh.customerName,sh.client,sh.consigneeName].map(low).filter(Boolean);
 return ids.some(function(x){return shIds.indexOf(x)>=0})||names.some(function(x){return shNames.indexOf(x)>=0})
}
function linkedShipmentCount(c){
 var s=state(),seen={},count=0;
 ['shipments','savedShipments','shipmentArchive','archivedShipments','archive'].forEach(function(k){
  arr(s[k]).forEach(function(sh,i){
   if(!shipmentCustomerMatches(sh,c))return;
   var id=q(sh&&(sh.ref||sh.reference||sh.id||sh.shipmentId))||k+':'+i;
   if(seen[id])return;seen[id]=1;count++
  })
 });
 return count
}
async function persist(reason){
 var clean=w.ExportHUBClean;
 if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')throw new Error(tr('customerDelete.storageUnavailable'));
 await Promise.resolve(clean.queueSave(reason));
 var ok=await Promise.resolve(clean.flushSave(reason,{force:true,userInitiated:true}));
 if(ok!==true)throw new Error(tr('customerDelete.storageUnconfirmed'));
 return true
}
function selectionSnapshot(s){
 var keys=['currentCustomer','selectedCustomer','currentCustomerId','selectedCustomerId','customerFolderId','customerFolderOpenId'],out={};
 keys.forEach(function(k){out[k]=s[k]});return out
}
function restoreSelection(s,snap){Object.keys(snap).forEach(function(k){s[k]=snap[k]})}
function clearSelection(s,c){
 var id=low(customerKey(c)),account=low(customerAccount(c)),name=low(customerLabel(c));
 ['currentCustomer','selectedCustomer'].forEach(function(k){var x=s[k];if(x&&(x===c||low(customerKey(x))===id))s[k]=null});
 ['currentCustomerId','selectedCustomerId','customerFolderId','customerFolderOpenId'].forEach(function(k){var v=low(s[k]);if(v&&(v===id||v===account||v===name))s[k]=''})
}
async function deleteCustomer(c){
 if(working)throw new Error(tr('customerDelete.inProgress'));
 if(!canDelete())throw new Error(tr('customerDelete.forbidden'));
 var s=state(),list=arr(s.customers),key=customerKey(c);
 if(!key)throw new Error(tr('customerDelete.noKey'));
 var idx=list.findIndex(function(x){return x===c||low(customerKey(x))===low(key)});
 if(idx<0)throw new Error(tr('customerDelete.notFound'));
 var removed=list[idx],beforeCustomers=list.slice(),beforeMeta=clone(s._teamSyncMeta),beforeAudit=clone(arr(s.auditLog)),beforeSelection=selectionSnapshot(s),now=new Date().toISOString(),actor=currentUser()||{},actorName=q(actor.name||actor.user||actor.username)||'Unbekannt';
 working=true;
 try{
  s.customers=list.filter(function(_x,i){return i!==idx});
  s._teamSyncMeta=obj(s._teamSyncMeta)?s._teamSyncMeta:{};
  s._teamSyncMeta.fields=obj(s._teamSyncMeta.fields)?s._teamSyncMeta.fields:{};
  s._teamSyncMeta.tombstones=arr(s._teamSyncMeta.tombstones).filter(function(t){return !(low(t&&t.collection)==='customers'&&low(t&&t.id)===low(key))});
  s._teamSyncMeta.tombstones.push({collection:'customers',id:key,deletedAt:now,deletedBy:actorName,explicitUserAction:true,reason:'duplicate-or-invalid-customer'});
  s.auditLog=arr(s.auditLog).slice(-4999);
  s.auditLog.push({id:'AUD-CUSTOMER-DELETE-'+Date.now().toString(36)+'-'+low(key).replace(/[^a-z0-9]+/g,'-').slice(0,40),type:'CUSTOMER_DELETED',actor:actorName,at:now,details:{customer:customerLabel(removed),account:customerAccount(removed),customerId:q(removed.id||removed.customerId),reason:tr('customerDelete.auditReason',null,'de'),linkedShipments:linkedShipmentCount(removed)}});
  clearSelection(s,removed);
  await persist(tr('customerDelete.persistReason',{customer:customerLabel(removed)+(customerAccount(removed)?' · '+customerAccount(removed):'')},'de'));
  try{w.dispatchEvent(new CustomEvent('exporthub:customer-deleted',{detail:{id:key,name:customerLabel(removed),account:customerAccount(removed),deletedAt:now}}))}catch(_){}
  try{if(typeof w.setView==='function')w.setView('customerfolder')}catch(_){}
  try{w.dispatchEvent(new CustomEvent('exporthub:rendered'))}catch(_){}
  return true
 }catch(e){
  s.customers=beforeCustomers;
  s.auditLog=beforeAudit;
  if(beforeMeta===undefined)delete s._teamSyncMeta;else s._teamSyncMeta=beforeMeta;
  restoreSelection(s,beforeSelection);
  throw e
 }finally{working=false}
}
function ensureStyle(){
 if(d.getElementById('rc1126CustomerDeleteStyle'))return;
 var s=d.createElement('style');s.id='rc1126CustomerDeleteStyle';
 s.textContent='.rc1126-customer-delete{margin-top:16px;border:1px solid #fecaca;border-radius:14px;padding:14px;background:#fff7f7}.rc1126-customer-delete h4{margin:0 0 5px}.rc1126-customer-delete p{margin:4px 0;color:#64748b;font-size:12px;line-height:1.45}.rc1126-danger{background:#b91c1c!important;border-color:#b91c1c!important;color:#fff!important}.rc1126-confirm{margin-top:12px;padding:12px;border:1px solid #fca5a5;border-radius:12px;background:#fff}.rc1126-confirm strong{display:block;margin-bottom:4px}.rc1126-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.rc1126-status{min-height:18px;margin-top:8px;font-size:12px}.rc1126-status[data-kind="error"]{color:#b91c1c}.rc1126-status[data-kind="ok"]{color:#166534}@media(max-width:760px){.rc1126-actions button{width:100%}}';
 (d.head||d.documentElement).appendChild(s)
}
function render(){
 var old=d.getElementById('rc1126CustomerDelete'),c=currentCustomer();
 if(!customerView()||!c||!canDelete()){if(old)old.remove();return false}
 ensureStyle();
 var host=d.getElementById('content')||d.querySelector('main')||d.body;if(!host)return false;
 var key=customerKey(c);
 if(old&&old.getAttribute('data-customer-key')===key)return true;
 if(old)old.remove();
 var box=d.createElement('section');box.id='rc1126CustomerDelete';box.className='rc1126-customer-delete';box.setAttribute('data-customer-key',key);
 var count=linkedShipmentCount(c),account=customerAccount(c),linked=count?(count===1?tr('customerDelete.linkedOne'):tr('customerDelete.linkedMany',{count:count})):'';
 box.innerHTML='<h4>'+esc(tr('customerDelete.title'))+'</h4><p>'+esc(tr('customerDelete.help'))+'</p><div><b>'+esc(customerLabel(c))+'</b>'+(account?' · '+esc(account):'')+'</div>'+(linked?'<p>'+esc(linked)+'</p>':'')+'<div class="rc1126-actions"><button type="button" class="btn rc1126-danger" data-rc1126-open>'+esc(tr('customerDelete.title'))+'</button></div><div class="rc1126-status" data-rc1126-status></div>';
 box.addEventListener('click',function(ev){
  var open=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1126-open]');
  if(open){ev.preventDefault();var existing=box.querySelector('.rc1126-confirm');if(existing){existing.remove();return}
   var panel=d.createElement('div');panel.className='rc1126-confirm';panel.innerHTML='<strong>'+esc(tr('customerDelete.confirmTitle'))+'</strong><div>'+esc(customerLabel(c))+(account?' · '+esc(account):'')+'</div><p>'+esc(tr('customerDelete.confirmText'))+'</p><div class="rc1126-actions"><button type="button" class="ghost" data-rc1126-cancel>'+esc(tr('customerDelete.cancel'))+'</button><button type="button" class="btn rc1126-danger" data-rc1126-confirm>'+esc(tr('customerDelete.finalDelete'))+'</button></div>';box.appendChild(panel);return}
  var cancel=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1126-cancel]');if(cancel){ev.preventDefault();var p=box.querySelector('.rc1126-confirm');if(p)p.remove();return}
  var confirmBtn=ev.target&&ev.target.closest&&ev.target.closest('[data-rc1126-confirm]');if(confirmBtn){ev.preventDefault();confirmBtn.disabled=true;var st=box.querySelector('[data-rc1126-status]');if(st){st.textContent=tr('customerDelete.deleting');st.setAttribute('data-kind','info')}deleteCustomer(c).then(function(){if(st){st.textContent=tr('customerDelete.deleted');st.setAttribute('data-kind','ok')}}).catch(function(e){if(st){st.textContent=tr('customerDelete.failed',{error:q(e&&e.message||e)});st.setAttribute('data-kind','error')}confirmBtn.disabled=false})}
 });
 host.appendChild(box);return true
}

function schedule(){if(timer)return;timer=w.setTimeout(function(){timer=0;try{render()}catch(e){try{console.warn('RC1126 Kunden löschen',e)}catch(_){}}},20)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',function(){schedule();w.setTimeout(schedule,250);w.setTimeout(schedule,800)},{once:true});else{schedule();w.setTimeout(schedule,250);w.setTimeout(schedule,800)}
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:sync','exporthub:customer-updated','exporthub:language-changed'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
if(w.MutationObserver){try{var mo=new MutationObserver(function(){if(customerView())schedule();else{var x=d.getElementById('rc1126CustomerDelete');if(x)x.remove()}});mo.observe(d.documentElement,{childList:true,subtree:true})}catch(_){}}

w.ExportHUBRC1126CustomerDelete=Object.freeze({version:'RC1126',customerKey:customerKey,currentCustomer:currentCustomer,canDelete:canDelete,linkedShipmentCount:linkedShipmentCount,deleteCustomer:deleteCustomer,render:render});
})(window,document);
