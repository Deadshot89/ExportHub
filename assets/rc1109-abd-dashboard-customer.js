(function(root){
'use strict';
const q=v=>String(v==null?'':v).trim();
const arr=v=>Array.isArray(v)?v:[];
let saveBusy=false,saveTimer=0,renderTimer=0,observer=null;
function state(){try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||null}catch(_){ }return root.ExportHUBClean&&root.ExportHUBClean.state||root.appState||null}
function same(a,b){return q(a).toLowerCase()===q(b).toLowerCase()&&!!q(a)}
function refOf(v){return q(v&&(v.ref||v.reference||v.shipmentRef||v.linkedShipmentRef||v.sourceRef))}
function customerFromMaster(s,probe){return arr(s&&s.customers).find(c=>c&&(same(c.id,probe.customerId)||same(c.account||c.customerNumber,probe.customerNumber)||same(c.name||c.customerName,probe.customerName||probe.customer)))||null}
function shipmentFor(s,a){const id=q(a&&(a.linkedShipmentId||a.shipmentId||a.sourceId)),ref=refOf(a);return arr([...(arr(s&&s.shipments)),...(arr(s&&s.savedShipments)),...(arr(s&&s.archive))]).find(sh=>sh&&((id&&same(sh.id,id))||(ref&&same(refOf(sh),ref))))||null}
function resolveCustomer(s,a){
 const sh=shipmentFor(s,a)||{};
 const probe={customerId:q(a&&a.customerId||sh.customerId||sh.linkedCustomerId),customerNumber:q(a&&a.customerNumber||a&&a.customerAccount||sh.customerNumber||sh.customerAccount),customerName:q(a&&a.customerName||a&&a.customer||sh.customerName||sh.customer)};
 const c=customerFromMaster(s,probe)||{};
 return {customerId:probe.customerId||q(c.id),customerNumber:probe.customerNumber||q(c.account||c.customerNumber),customerName:probe.customerName||q(c.name||c.customerName)};
}
function enrichRequests(s=state()){
 if(!s)return {changed:false,requests:[]};let changed=false;
 const requests=arr(s.abdRequests);
 requests.forEach(a=>{if(!a||typeof a!=='object')return;const c=resolveCustomer(s,a);if(!q(a.customerName)&&c.customerName){a.customerName=c.customerName;changed=true}if(!q(a.customerNumber)&&c.customerNumber){a.customerNumber=c.customerNumber;changed=true}if(!q(a.customerId)&&c.customerId){a.customerId=c.customerId;changed=true}});
 return {changed,requests};
}
async function persistEnrichment(){
 const s=state(),result=enrichRequests(s),clean=root.ExportHUBClean;if(!result.changed||saveBusy||!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')return result.changed;
 saveBusy=true;try{await Promise.resolve(clean.queueSave('RC1109 ABD-Kundendaten ergänzt'));await Promise.resolve(clean.flushSave('RC1109 ABD-Kundendaten ergänzt'));return true}catch(e){try{root.console&&root.console.warn&&root.console.warn('RC1109 ABD-Kundendaten konnten noch nicht gespeichert werden',e)}catch(_){ }return false}finally{saveBusy=false}
}
function requestForCard(s,card){const text=q(card&&card.textContent),data=card&&card.dataset||{};const keys=[data.sourceRef,data.ref,data.reference,data.taskId,data.sourceId].map(q).filter(Boolean);return arr(s&&s.abdRequests).find(a=>{const ref=refOf(a),id=q(a&&a.id);return keys.some(k=>same(k,ref)||same(k,id))||(ref&&text.includes(ref))})||null}
function isAbdCard(card){const text=q(card&&card.textContent);return /\bABD\b/i.test(text)}
function enhanceDashboard(){
 const s=state(),doc=root.document;if(!s||!doc||typeof doc.querySelectorAll!=='function')return 0;enrichRequests(s);let count=0;
 const cards=Array.from(doc.querySelectorAll('.rc229-task-card.rc628-unified-task, .task-card, [data-task-id], [data-source-ref]'));
 cards.forEach(card=>{if(!isAbdCard(card))return;const a=requestForCard(s,card);if(!a)return;const c=resolveCustomer(s,a),name=q(c.customerName);if(!name)return;let el=card.querySelector&&card.querySelector('[data-rc1109-abd-customer]');if(!el){el=doc.createElement('div');el.setAttribute('data-rc1109-abd-customer','1');el.className='rc1109-abd-customer';if(typeof card.appendChild==='function')card.appendChild(el)}el.textContent='Kunde: '+name+(c.customerNumber?' · '+c.customerNumber:'');count++});
 return count;
}
function schedule(){if(renderTimer&&root.clearTimeout)root.clearTimeout(renderTimer);renderTimer=(root.setTimeout||((fn)=>fn()))(()=>{renderTimer=0;enhanceDashboard()},0);if(saveTimer&&root.clearTimeout)root.clearTimeout(saveTimer);saveTimer=(root.setTimeout||((fn)=>fn()))(()=>{saveTimer=0;persistEnrichment()},250)}
function install(){schedule();if(root.addEventListener){['exporthub:rendered','exporthub:viewchange','exporthub:tasks-updated'].forEach(n=>root.addEventListener(n,schedule))}const doc=root.document,target=doc&&(doc.body||doc.documentElement);if(target&&typeof root.MutationObserver==='function'&&!observer){observer=new root.MutationObserver(schedule);observer.observe(target,{childList:true,subtree:true})}}
if(root.document&&root.document.readyState==='loading'&&root.addEventListener)root.addEventListener('DOMContentLoaded',install,{once:true});else install();
root.ExportHUBRC1109AbdDashboardCustomer=Object.freeze({resolveCustomer,enrichRequests,enhanceDashboard,persistEnrichment});
})(globalThis);
