(function(g){
'use strict';

const selectors=Object.freeze({
  'shipment.new':'#rc380NewShipment',
  'shipment.customer-search':'#shipmentCustomerSearch',
  'shipment.location':'#index289LocationSelect',
  'shipment.customer-block':'#rc363BlockCustomer',
  'shipment.colli':'#rc573ColliCard',
  'shipment.weight':'#rc363WeightModal',
  'shipment.documents':'#rc363BlockDocuments',
  'shipment.abd-decision':'#rc363BlockAbdDecision',
  'shipment.save':'#rc363SaveShipment',
  'shipment.reference':'[data-training-target="shipment.reference"], input[readonly][aria-readonly="true"]',
  'shipment.details':'[data-training-target="shipment.details"], #rc363BlockCustomer',
  'shipment.delivery-notes':'[data-training-target="shipment.delivery-notes"], #rc363BlockDocuments',
  'shipment.review':'[data-training-target="shipment.review"], #rc363SaveShipment',
  'shipment.customs':'[data-training-target="shipment.customs"], #rc363BlockAbdDecision',
  'shipment.status':'[data-training-target="shipment.status"]',
  'shipment.pickup-qr':'[data-training-target="shipment.pickup-qr"]',
  'shipment.completion':'[data-training-target="shipment.completion"]'
});

function register(registry){
  if(!registry||typeof registry.register!=='function')throw new Error('TRAINING_TARGET_REGISTRY_REQUIRED');
  for(const [key,selector] of Object.entries(selectors))registry.register(key,(root)=>root&&typeof root.querySelectorAll==='function'?root.querySelectorAll(selector):[]);
  return registry;
}
function annotate(root){
  if(!root||typeof root.querySelectorAll!=='function')return [];
  const annotated=[];
  for(const [key,selector] of Object.entries(selectors)){
    const matches=Array.from(root.querySelectorAll(selector)||[]).filter(Boolean);
    if(matches.length!==1)continue;
    const target=matches[0];
    if(target&&typeof target.setAttribute==='function')target.setAttribute('data-training-target',key);
    annotated.push(target);
  }
  return annotated;
}
function sourceContract(){return JSON.stringify({selectors});}

g.ExportHubShipmentTrainingTargets=Object.freeze({selectors,register,annotate,sourceContract});
})(globalThis);
