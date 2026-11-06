(function(root){
  'use strict';
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const tr=(key,vars)=>{const i18n=root.ExportHUBPackI18n;return i18n&&typeof i18n.t==='function'?i18n.t(key,vars):key;};
  let timer=0,observer=null;

  function sharedState(){try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{};}catch(_){}return root.__EXPORTHUB_STATE__||root.state||{};}
  function shipmentRef(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef)).toUpperCase();}
  function packDocuments(shipment){
    const owner=q(shipment&&shipment.packNotificationId);
    return arr(shipment&&shipment.deliveryFiles).filter(doc=>
      doc&&(q(doc.source)==='pack_notification'||q(doc.packNotificationId))&&
      (!q(doc.packNotificationId)||q(doc.packNotificationId)===owner));
  }
  function activeShipment(state){
    const s=state||{},viewId=q(s.shipmentViewId||s.selectedShipmentId||s.activeShipmentId||s.currentShipmentId||s.editingShipmentId).toUpperCase();
    const stored=arr(s.shipments).concat(arr(s.savedShipments),arr(s.sharedShipments));
    const matchesId=sh=>[q(sh&&sh.id),q(sh&&sh.shipmentId),shipmentRef(sh)].some(id=>id.toUpperCase()===viewId);
    const bodyView=q(root.document&&root.document.body&&root.document.body.getAttribute&&root.document.body.getAttribute('data-exporthub-view')).toLowerCase();
    // The detail page has a canonical shipment ID. Never use a stale editor
    // draft (or the first Pack record from a different shipment) in its place.
    if(bodyView==='shipmentview'&&viewId){
      const found=stored.filter(sh=>viewId&&matchesId(sh)&&q(sh.packNotificationId));
      if(!found.length)return null;
      return found.reduce((best,sh)=>packDocuments(sh).length>packDocuments(best).length?sh:best);
    }
    const candidate=s.shipment||s.currentShipment||s.selectedShipment;
    if(candidate&&q(candidate.packNotificationId)){
      // A live form draft can contain only the first imported PDF while the
      // saved shipment already has all of them. Reuse only the *same REF and
      // same Pack owner*; recycled editor IDs must never cross shipment REFs.
      const ref=shipmentRef(candidate),owner=q(candidate.packNotificationId),ownerRef=q(candidate.packNotificationRef);
      const siblings=ref?stored.filter(sh=>shipmentRef(sh)===ref&&q(sh.packNotificationId)===owner&&
        (!ownerRef||!q(sh.packNotificationRef)||q(sh.packNotificationRef)===ownerRef)):[];
      return [candidate,...siblings].reduce((best,sh)=>{
        const score=row=>packDocuments(row).length*2+(q(row.packNotificationLinkedAt)?1:0);
        return score(sh)>score(best)?sh:best;
      },candidate);
    }
    if(!viewId)return null;
    const matches=stored.filter(sh=>q(sh&&sh.packNotificationId)&&matchesId(sh));
    return matches.reduce((best,sh)=>!best||packDocuments(sh).length>packDocuments(best).length?sh:best,null);
  }
  function documentKey(doc){return q(doc&&(doc.id||doc.fileId||doc.blobName||doc.name));}
  function setVisibility(shipment,key,visible,at){
    const wanted=q(key),doc=packDocuments(shipment).find(item=>documentKey(item)===wanted);if(!doc)return false;
    doc.customerAvisVisible=visible===true;doc.customerVisible=visible===true;doc.customerAvisVisibilityUpdatedAt=q(at)||new Date().toISOString();return true;
  }
  function publicPackDocuments(shipment){return packDocuments(shipment).filter(doc=>doc.customerAvisVisible===true);}
  async function persist(){try{const clean=root.ExportHUBClean;if(clean&&typeof clean.queueSave==='function')await Promise.resolve(clean.queueSave('Pack-Lieferschein AVIS-Freigabe'));if(clean&&typeof clean.flushSave==='function')await Promise.resolve(clean.flushSave('Pack-Lieferschein AVIS-Freigabe'));return true;}catch(_){return false;}}
  function esc(value){return q(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function renderPanel(){
    const doc=root.document;if(!doc||!doc.getElementById)return false;
    const state=sharedState(),existing=doc.getElementById('packAvisDocumentPanel');
    const view=q(doc.body&&doc.body.getAttribute&&doc.body.getAttribute('data-exporthub-view')||state.view||state.currentView).toLowerCase();
    // The Pack inbox/detail reuses #content, and the previous editor shipment
    // remains in shared state. Do not leak that shipment's AVIS controls into
    // a different Pack notification (or any other application page).
    if(view!=='shipment'&&view!=='shipmentview'){if(existing)existing.remove();return false;}
    const shipment=activeShipment(state);
    if(!shipment||!q(shipment.packNotificationId)){if(existing)existing.remove();return false;}
    const docs=packDocuments(shipment),host=doc.getElementById('rc363BlockDocuments')||doc.getElementById('rc363FixedShipmentLayout')||(view==='shipmentview'?doc.getElementById('content'):null);
    if(!host){if(existing)existing.remove();return false;}
    let panel=existing;if(!panel){panel=doc.createElement('section');panel.id='packAvisDocumentPanel';panel.className='pack-avis-panel';host.appendChild(panel);}
    const markup=`<div class="pack-avis-head"><div><span>${esc(tr('pack.title'))}</span><h3>${esc(tr('pack.avis.title'))}</h3><p>${esc(tr('pack.avis.help'))}</p></div><strong>${publicPackDocuments(shipment).length}/${docs.length}</strong></div><div class="pack-avis-list">${docs.length?docs.map(doc=>{const key=documentKey(doc),visible=doc.customerAvisVisible===true;return`<label class="pack-avis-row"><span><b>${esc(doc.name||doc.fileName||tr('pack.avis.deliveryNote'))}</b><small>${esc(visible?tr('pack.avis.visible'):tr('pack.avis.internalOnly'))}</small></span><input type="checkbox" data-pack-avis-doc="${esc(key)}" ${visible?'checked':''}><em>${esc(visible?tr('pack.avis.visible'):tr('pack.avis.release'))}</em></label>`;}).join(''):`<p>${esc(tr('pack.avis.empty'))}</p>`}</div>`;
    // MutationObserver watches the whole app. Reassigning identical innerHTML
    // used to trigger another observer callback every 80 ms indefinitely.
    if(panel.__packAvisRenderKey!==markup){panel.innerHTML=markup;panel.__packAvisRenderKey=markup;}
    return true;
  }
  async function onChange(event){const input=event.target&&event.target.closest&&event.target.closest('[data-pack-avis-doc]');if(!input)return;const shipment=activeShipment(sharedState());if(!shipment)return;if(setVisibility(shipment,input.getAttribute('data-pack-avis-doc'),input.checked,new Date().toISOString())){await persist();renderPanel();}}
  function schedule(){clearTimeout(timer);timer=setTimeout(renderPanel,80);}
  function install(){const doc=root.document;if(!doc||doc.__packAvisInstalled)return false;doc.__packAvisInstalled=true;doc.addEventListener('change',onChange,true);if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(schedule);observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});}if(typeof root.addEventListener==='function'){['exporthub:shipment-saved','exporthub:state-updated','exporthub:view-changed','exporthub:pack-language-changed'].forEach(name=>root.addEventListener(name,schedule));}schedule();return true;}

  root.ExportHUBPackAvis=Object.freeze({packDocuments,setVisibility,publicPackDocuments,renderPanel,install});
  install();
})(typeof window!=='undefined'?window:globalThis);
