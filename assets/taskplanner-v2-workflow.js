(function(root){
  'use strict';

  const TYPES=Object.freeze([
    'shipment.created','shipment.picked','shipment.registered','shipment.dispatched',
    'document.created','document.approved','customer.process.completed'
  ]);
  const TYPE_SET=new Set(TYPES);
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const MAX_PROCESSED_EVENTS=40;

  function core(){
    const api=root.ExportHUBTaskCoreV2;
    if(!api||typeof api.completeTask!=='function')throw new Error('TaskPlanner V2 Core fehlt');
    return api;
  }

  function normalizeEvent(input){
    const source=obj(input)?input:{};
    const eventId=q(source.eventId||source.id);
    const type=q(source.type||source.eventType);
    if(!eventId)throw new Error('eventId fehlt');
    if(!TYPE_SET.has(type))throw new Error('Ereignistyp / event type ist nicht freigegeben');
    return {
      ...clone(source),
      eventId,type,
      occurredAt:q(source.occurredAt||source.at||source.timestamp),
      customerId:q(source.customerId||source.customerAccount||source.account),
      customerName:q(source.customerName||source.customer),
      shipmentId:q(source.shipmentId||source.linkedShipmentId),
      shipmentRef:q(source.shipmentRef||source.reference||source.ref),
      orderId:q(source.orderId||source.salesOrder||source.order),
      documentId:q(source.documentId||source.fileId),
      processId:q(source.processId||source.process),
      workflowId:q(source.workflowId||source.workflow),
      taskType:q(source.taskType||source.taskKind)
    };
  }

  function processedKey(input){
    const event=normalizeEvent(input);
    return `${event.type}:${event.eventId}`;
  }

  function taskEvents(task){
    const values=arr(task&&task.workflowEvents).concat(arr(task&&task.autoCompleteEvents));
    const single=q(task&&task.workflowEvent||task&&task.autoCompleteEvent);
    if(single)values.push(single);
    return new Set(values.map(q).filter(Boolean));
  }

  function active(task){
    const status=q(task&&task.status).toLowerCase();
    return status!=='done'&&status!=='cancelled'&&status!=='canceled'&&status!=='erledigt'&&status!=='storniert';
  }

  function configuredFields(task){
    return [
      ['customerId',q(task&&task.customerId||task&&task.customerAccount||task&&task.linkedCustomerId)],
      ['shipmentId',q(task&&task.shipmentId||task&&task.linkedShipmentId)],
      ['shipmentRef',q(task&&task.shipmentRef||task&&task.linkedShipmentRef||task&&task.reference||task&&task.ref)],
      ['orderId',q(task&&task.orderId||task&&task.salesOrder||task&&task.order)],
      ['documentId',q(task&&task.documentId||task&&task.fileId)],
      ['processId',q(task&&task.processId)],
      ['workflowId',q(task&&task.workflowId)],
      ['taskType',q(task&&task.taskType||task&&task.sourceType)]
    ].filter(([,value])=>value);
  }

  function structuredMatch(event,task){
    if(!active(task))return false;
    if(!taskEvents(task).has(event.type))return false;
    const fields=configuredFields(task);
    if(!fields.length)return false;
    let nonCustomerBinding=false;
    for(const [name,value] of fields){
      if(name!=='customerId')nonCustomerBinding=true;
      if(q(event[name])!==value)return false;
    }
    return nonCustomerBinding;
  }

  function match(input,tasks){
    const event=normalizeEvent(input);
    return arr(tasks).filter(task=>structuredMatch(event,task));
  }

  function duplicateProcessed(tasks,key){
    return arr(tasks).some(task=>arr(task&&task.workflowProcessedEvents).some(row=>q(row&&row.key)===key));
  }

  function ledgerWith(task,event,key,at){
    const current=arr(task&&task.workflowProcessedEvents).map(clone);
    current.push({key,eventId:event.eventId,type:event.type,at});
    return current.slice(-MAX_PROCESSED_EVENTS);
  }

  function unchanged(state,status,extra={}){
    return {state:clone(obj(state)?state:{}),changed:false,status,patches:[],...extra};
  }

  function apply(input,state,ctx={}){
    const event=normalizeEvent(input),source=obj(state)?state:{},tasks=arr(source.tasks),key=processedKey(event);
    if(duplicateProcessed(tasks,key))return unchanged(source,'duplicate',{event});
    const candidates=match(event,tasks);
    if(candidates.length===0)return unchanged(source,'unmatched',{event});
    if(candidates.length>1){
      return unchanged(source,'ambiguous',{
        event,message:'Zuordnung prüfen',ambiguousTaskIds:candidates.map(task=>q(task&&task.id)).filter(Boolean)
      });
    }

    const targetId=q(candidates[0]&&candidates[0].id),at=q(event.occurredAt||ctx.now)||new Date().toISOString();
    const nextState=clone(source),patches=[];
    nextState.tasks=arr(source.tasks).map(original=>{
      if(q(original&&original.id)!==targetId)return clone(original);
      const completed=core().completeTask(original,{at,mode:'automatic',source:'workflow',eventId:event.eventId});
      const next={...completed,workflowProcessedEvents:ledgerWith(completed,event,key,at)};
      patches.push({taskId:targetId,status:'done',eventId:event.eventId,type:event.type});
      return next;
    });
    return {state:nextState,changed:true,status:'completed',patches,event,ambiguousTaskIds:[]};
  }

  function dispatchChanged(result){
    if(!result||!result.changed)return;
    const detail={
      type:'workflow_auto_complete',
      eventId:q(result.event&&result.event.eventId),
      workflowEventType:q(result.event&&result.event.type),
      taskIds:arr(result.patches).map(p=>q(p&&p.taskId)).filter(Boolean)
    };
    try{
      if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function'){
        root.dispatchEvent(new root.CustomEvent('exporthub:tasks-updated',{detail}));
      }
    }catch(_){}
  }

  function emit(input,ctx={}){
    const holder=obj(ctx)?ctx:{};
    const state=obj(holder.state)?holder.state:{tasks:[]};
    const result=apply(input,state,holder);
    if(!result.changed)return result;
    state.tasks=result.state.tasks;
    for(const key of Object.keys(result.state))if(key!=='tasks')state[key]=result.state[key];
    if(typeof holder.persist==='function')holder.persist(state.tasks,result);
    dispatchChanged(result);
    return result;
  }

  root.ExportHUBTaskWorkflowV2=Object.freeze({
    version:'2.0',types:TYPES,normalizeEvent,match,apply,emit,processedKey
  });
})(globalThis);
