(function(root){
  'use strict';
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const tr=(key,vars)=>{const i18n=root.ExportHUBPackI18n;return i18n&&typeof i18n.t==='function'?i18n.t(key,vars):key;};
  let timer=0,observer=null;

  function sharedState(){try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{};}catch(_){}return root.__EXPORTHUB_STATE__||root.state||{};}
  function activeShipment(state){
    const s=state||{},candidate=s.shipment||s.currentShipment||s.selectedShipment;if(candidate&&candidate.packNotificationId)return candidate;
    const id=q(s.activeShipmentId||s.currentShipmentId||s.selectedShipmentId||s.editingShipmentId),ref=q(candidate&&(candidate.ref||candidate.reference));
    return arr(s.shipments).concat(arr(s.savedShipments)).find(sh=>q(sh&&sh.packNotificationId)&&(id&&[q(sh.id),q(sh.shipmentId),q(sh.ref),q(sh.reference)].includes(id)||ref&&[q(sh.ref),q(sh.reference)].includes(ref)))||candidate||null;
  }
  function packDocuments(shipment){return arr(shipment&&shipment.deliveryFiles).filter(doc=>q(doc&&doc.source)==='pack_notification'||q(doc&&doc.packNotificationId));}
  function documentKey(doc){return q(doc&&(doc.id||doc.fileId||doc.blobName||doc.name));}
  function setVisibility(shipment,key,visible,at){
    const wanted=q(key),doc=packDocuments(shipment).find(item=>documentKey(item)===wanted);if(!doc)return false;
    doc.customerAvisVisible=visible===true;doc.customerVisible=visible===true;doc.customerAvisVisibilityUpdatedAt=q(at)||new Date().toISOString();return true;
  }
  function publicPackDocuments(shipment){return packDocuments(shipment).filter(doc=>doc.customerAvisVisible===true);}
  async function persist(){try{const clean=root.ExportHUBClean;if(clean&&typeof clean.queueSave==='function')await Promise.resolve(clean.queueSave('Pack-Lieferschein AVIS-Freigabe'));if(clean&&typeof clean.flushSave==='function')await Promise.resolve(clean.flushSave('Pack-Lieferschein AVIS-Freigabe'));return true;}catch(_){return false;}}
  function esc(value){return q(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function renderPanel(){
    const doc=root.document;if(!doc||!doc.getElementById)return false;const state=sharedState(),shipment=activeShipment(state),existing=doc.getElementById('packAvisDocumentPanel');
    if(!shipment||!q(shipment.packNotificationId)){if(existing)existing.remove();return false;}
    const docs=packDocuments(shipment),host=doc.getElementById('rc363BlockDocuments')||doc.getElementById('rc363FixedShipmentLayout')||doc.getElementById('content');if(!host)return false;
    let panel=existing;if(!panel){panel=doc.createElement('section');panel.id='packAvisDocumentPanel';panel.className='pack-avis-panel';host.appendChild(panel);}
    panel.innerHTML=`<div class="pack-avis-head"><div><span>${esc(tr('pack.title'))}</span><h3>${esc(tr('pack.avis.title'))}</h3><p>${esc(tr('pack.avis.help'))}</p></div><strong>${publicPackDocuments(shipment).length}/${docs.length}</strong></div><div class="pack-avis-list">${docs.length?docs.map(doc=>{const key=documentKey(doc),visible=doc.customerAvisVisible===true;return`<label class="pack-avis-row"><span><b>${esc(doc.name||doc.fileName||tr('pack.avis.deliveryNote'))}</b><small>${esc(visible?tr('pack.avis.visible'):tr('pack.avis.internalOnly'))}</small></span><input type="checkbox" data-pack-avis-doc="${esc(key)}" ${visible?'checked':''}><em>${esc(visible?tr('pack.avis.visible'):tr('pack.avis.release'))}</em></label>`;}).join(''):`<p>${esc(tr('pack.avis.empty'))}</p>`}</div>`;
    return true;
  }
  async function onChange(event){const input=event.target&&event.target.closest&&event.target.closest('[data-pack-avis-doc]');if(!input)return;const shipment=activeShipment(sharedState());if(!shipment)return;if(setVisibility(shipment,input.getAttribute('data-pack-avis-doc'),input.checked,new Date().toISOString())){await persist();renderPanel();}}
  function schedule(){clearTimeout(timer);timer=setTimeout(renderPanel,80);}
  function install(){const doc=root.document;if(!doc||doc.__packAvisInstalled)return false;doc.__packAvisInstalled=true;doc.addEventListener('change',onChange,true);if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(schedule);observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});}if(typeof root.addEventListener==='function'){['exporthub:shipment-saved','exporthub:state-updated','exporthub:view-changed','exporthub:pack-language-changed'].forEach(name=>root.addEventListener(name,schedule));}schedule();return true;}

  root.ExportHUBPackAvis=Object.freeze({packDocuments,setVisibility,publicPackDocuments,renderPanel,install});
  install();
})(typeof window!=='undefined'?window:globalThis);
