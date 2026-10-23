(function(g){
'use strict';

function state(){const api=g.ExportHubTrainingState;if(!api||typeof api.mutate!=='function')throw new Error('TRAINING_STATE_MISSING');return api;}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function upsert(list,payload){
  const next=Array.isArray(list)?list.slice():[];
  const item=clone(payload&&typeof payload==='object'?payload:{});
  const id=item&&item.id!=null?String(item.id):'';
  const index=id?next.findIndex(entry=>entry&&String(entry.id)===id):-1;
  if(index>=0)next[index]=Object.assign({},next[index],item);else next.push(item);
  return next;
}
function execute(operation,payload){
  const op=String(operation||'');
  const data=clone(payload);
  const snapshot=state().mutate((draft)=>{
    draft.__trainingActions=Array.isArray(draft.__trainingActions)?draft.__trainingActions:[];
    draft.__trainingActions.push({operation:op,payload:clone(data)});
    switch(op){
      case 'shipment.save': draft.shipment=Object.assign({},draft.shipment||{},data||{}); break;
      case 'document.add': draft.documents=upsert(draft.documents,data); break;
      case 'abd.save': draft.abdRequests=upsert(draft.abdRequests,data); break;
      case 'customer.select': draft.customer=Object.assign({},draft.customer||{},data||{}); break;
      case 'location.select': draft.location=Object.assign({},draft.location||{},data||{}); break;
      case 'shipment.details': draft.shipment=Object.assign({},draft.shipment||{},data||{}); break;
      case 'colli.update': draft.colli=Array.isArray(data)?clone(data):upsert(draft.colli,data); break;
      case 'weight.update': draft.weight=clone(data); break;
      case 'document.review': draft.documentReview=clone(data); break;
      case 'shipment.review': draft.shipmentReview=clone(data); break;
      case 'abd.decision': draft.abdDecision=clone(data); break;
      case 'customs.review': draft.customsReview=clone(data); break;
      case 'shipment.complete': draft.completion=clone(data); break;
      default: draft.lastAction={operation:op,payload:clone(data)};
    }
    return draft;
  });
  return {operation:op,payload:data,state:snapshot,persisted:false};
}

g.ExportHubTrainingDemoAdapter=Object.freeze({execute});
})(globalThis);
