(function(root){
  'use strict';
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  let pending=null;

  function sharedState(){
    try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{};}catch(_){}
    return root.__EXPORTHUB_STATE__||root.state||{};
  }
  function shipmentId(sh){return q(sh&&(sh.id||sh.shipmentId||sh.ref||sh.reference));}
  function notificationById(state,id){return arr(state&&state.packNotifications).find(n=>q(n&&n.id)===q(id))||null;}
  function shipmentPrefill(notification){
    const n=notification||{},count=Math.max(1,Number(n.packageCount)||arr(n.packages).length||1),weight=Number(n.totalWeight)||0,perWeight=count?weight/count:weight;
    return{
      packNotificationId:q(n.id),packNotificationRef:q(n.reference),customerName:q(n.customer),deliveryNoteReference:q(n.deliveryNoteReference),packageType:q(n.packageType),packageCount:count,totalWeight:weight,note:q(n.note),
      rows:arr(n.packages).map((p,index)=>({count:1,packaging:q(n.packageType),l:Number(p&&p.length)||0,w:Number(p&&p.width)||0,h:Number(p&&p.height)||0,weight:perWeight,packageNo:Number(p&&p.packageNo)||index+1})),
      deliveryFiles:arr(n.documents).map(doc=>Object.assign({},doc,{customerVisible:false,source:'pack_notification',packNotificationId:q(n.id),packNotificationRef:q(n.reference)}))
    };
  }
  function findShipmentForNotification(state,notification){
    const n=notification||{},wanted=q(n.shipmentId),nid=q(n.id),nref=q(n.reference);
    const list=[...arr(state&&state.shipments),...arr(state&&state.savedShipments),state&&state.shipment,state&&state.currentShipment,state&&state.selectedShipment].filter(Boolean);
    return list.find(sh=>(wanted&&shipmentId(sh)===wanted)||(nid&&q(sh.packNotificationId)===nid)||(nref&&q(sh.packNotificationRef)===nref))||null;
  }
  function mergeDocuments(existing,incoming){
    const out=arr(existing).slice(),seen=new Set(out.map(d=>q(d&& (d.blobName||d.id||d.name))));
    for(const doc of arr(incoming)){const key=q(doc&& (doc.blobName||doc.id||doc.name));if(!key||seen.has(key))continue;seen.add(key);out.push(Object.assign({},doc));}
    return out;
  }
  function linkShipment(state,notification,shipment,at){
    if(!notification||!shipment)return false;const when=q(at)||new Date().toISOString(),prefill=shipmentPrefill(notification),sid=shipmentId(shipment);
    shipment.packNotificationId=q(notification.id);shipment.packNotificationRef=q(notification.reference);shipment.packNotificationLinkedAt=when;
    shipment.deliveryFiles=mergeDocuments(shipment.deliveryFiles,prefill.deliveryFiles);
    notification.shipmentId=sid;notification.shipmentRef=q(shipment.ref||shipment.reference);notification.status='shipment_created';notification.updatedAt=when;
    const task=arr(state&&state.tasks).find(t=>q(t&&t.sourceType)==='pack_notification'&&q(t&&t.sourceId)===q(notification.id));if(task){task.status='in_progress';task.updatedAt=when;}
    return true;
  }
  async function persist(reason){try{const clean=root.ExportHUBClean;if(clean&&typeof clean.queueSave==='function')await Promise.resolve(clean.queueSave(reason));if(clean&&typeof clean.flushSave==='function')await Promise.resolve(clean.flushSave(reason));return true;}catch(_){return false;}}
  function openShipment(sh){
    const target=q(sh&&(sh.ref||sh.reference||sh.id||sh.shipmentId));if(!target)return false;
    try{if(root.ExportHUBShipmentView&&typeof root.ExportHUBShipmentView.open==='function'){root.ExportHUBShipmentView.open(target,'tasks');return true;}}catch(_){}
    try{if(typeof root.openShipment==='function'){root.openShipment(target);return true;}}catch(_){}
    try{if(typeof root.__EXPORTHUB_OPEN_SHIPMENT__==='function'){root.__EXPORTHUB_OPEN_SHIPMENT__(target);return true;}}catch(_){}
    return false;
  }
  function nativeSet(input,value){
    if(!input)return;const descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value');if(descriptor&&descriptor.set)descriptor.set.call(input,String(value));else input.value=String(value);
    ['input','change'].forEach(type=>input.dispatchEvent(new Event(type,{bubbles:true})));
  }
  function applyPrefillToMountedForm(prefill){
    const doc=root.document;if(!doc)return false;
    const customer=doc.getElementById('shipmentCustomerSearch');if(customer&&prefill.customerName){nativeSet(customer,prefill.customerName);try{customer.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));}catch(_){}}
    const rows=Array.from(doc.querySelectorAll('#rc573ColliCard .rc363-owned-row'));
    const first=rows[0];if(first){
      const set=(field,value)=>nativeSet(first.querySelector(`[data-rc363-field="${field}"] input`),value);
      set('count',prefill.packageCount);const p=prefill.rows[0]||{};set('l',p.l||'');set('w',p.w||'');set('h',p.h||'');set('weight',prefill.totalWeight||'');
    }
    const state=sharedState(),draft=state.shipment||state.currentShipment||state.selectedShipment;if(draft&&typeof draft==='object'){
      draft.packNotificationId=prefill.packNotificationId;draft.packNotificationRef=prefill.packNotificationRef;draft.packNotificationPrefill={deliveryNoteReference:prefill.deliveryNoteReference,packageType:prefill.packageType,packageCount:prefill.packageCount,totalWeight:prefill.totalWeight,rows:prefill.rows,note:prefill.note};
      draft.deliveryFiles=mergeDocuments(draft.deliveryFiles,prefill.deliveryFiles);
    }
    return true;
  }
  function waitForShipmentForm(prefill,attempt=0){
    const doc=root.document;if(!doc||attempt>100)return;
    const form=doc.getElementById('rc363BlockCustomer');
    if(form){applyPrefillToMountedForm(prefill);return;}
    const button=doc.getElementById('rc380NewShipment');if(button&&!button.__packClicked){button.__packClicked=true;button.click();}
    setTimeout(()=>waitForShipmentForm(prefill,attempt+1),80);
  }
  function startNew(notification){
    const prefill=shipmentPrefill(notification);pending={notificationId:q(notification.id),prefill};root.__EXPORTHUB_PACK_SHIPMENT_PREFILL__=prefill;
    try{if(typeof root.setView==='function')root.setView('shipment');}catch(_){}
    setTimeout(()=>waitForShipmentForm(prefill),20);return true;
  }
  function begin(notificationId){
    const state=sharedState(),notification=notificationById(state,notificationId);if(!notification)return false;
    const existing=findShipmentForNotification(state,notification);if(existing)return openShipment(existing);
    return startNew(notification);
  }
  async function onShipmentSaved(event){
    if(!pending)return;const state=sharedState(),notification=notificationById(state,pending.notificationId);if(!notification){pending=null;return;}
    const detail=event&&event.detail||{},saved=detail.shipment||findShipmentForNotification(state,notification)||(state.shipment||state.currentShipment||state.selectedShipment);
    if(!saved||!shipmentId(saved))return;
    linkShipment(state,notification,saved,new Date().toISOString());pending=null;root.__EXPORTHUB_PACK_SHIPMENT_PREFILL__=null;await persist('Packmeldung mit Sendung verknüpft');
  }
  function install(){
    if(typeof root.addEventListener!=='function'||root.__packShipmentBridgeInstalled)return false;root.__packShipmentBridgeInstalled=true;
    root.addEventListener('exporthub:pack-create-shipment',event=>begin(event&&event.detail&&event.detail.notificationId));
    root.addEventListener('exporthub:shipment-saved',onShipmentSaved);return true;
  }

  root.ExportHUBPackShipment=Object.freeze({shipmentPrefill,findShipmentForNotification,linkShipment,begin,applyPrefillToMountedForm,install});
  install();
})(typeof window!=='undefined'?window:globalThis);
