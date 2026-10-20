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

  function translated(key){
    try{
      const i18n=root.ExportHUBI18n;
      if(i18n&&typeof i18n.t==='function'){
        const value=q(i18n.t(key));
        if(value&&value!==key)return value;
      }
    }catch(_){}
    return key;
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

  // RC1585: Managed customer registrations are matched by their stable roster key
  // and an explicit customer alias, never by a translated or user-edited task title.
  // Additional customers need a verified exact alias before they can be enabled.
  const MANAGED_REGISTRATION_CUSTOMERS=Object.freeze({
    spanien:Object.freeze(['essentra spanien','essentra spain'])
  });

  function customerAlias(value){
    return q(value).normalize('NFKC').toLocaleLowerCase('de-DE')
      .replace(/\s+/g,' ');
  }

  function berlinDay(value){
    const at=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(at.getTime()))return '';
    const parts=new Intl.DateTimeFormat('en-GB',{
      timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(at);
    const get=type=>q((parts.find(part=>part.type===type)||{}).value);
    return get('year')+'-'+get('month')+'-'+get('day');
  }

  function plannedDay(task){
    const candidate=q(task&&task.manualOverride&&task.plannedAt||
      task&&(task.dueAt||task.dueDate||task.occurrenceKey||task.plannedAt));
    return (candidate.match(/^(\d{4}-\d{2}-\d{2})/)||[])[1]||'';
  }

  function managedRegistrationMatch(event,task,ctx={}){
    if(event.type!=='shipment.registered'||!active(task))return false;
    if(q(task&&task.managedBy)!=='RC1152')return false;
    const aliases=MANAGED_REGISTRATION_CUSTOMERS[q(task.managedKey)];
    if(!aliases||!aliases.includes(customerAlias(event.customerName)))return false;
    if(!event.shipmentId&&!event.shipmentRef)return false;
    const effectiveDay=plannedDay(task);
    const eventDay=berlinDay(event.occurredAt);
    const today=berlinDay(ctx.now||new Date());
    // Both the occurrence and its effective planned date must be today or earlier.
    // A later registration must never clear a future task.
    return !!(effectiveDay&&eventDay&&today&&eventDay<=today&&
      effectiveDay<=eventDay&&effectiveDay<=today);
  }

  function match(input,tasks,ctx={}){
    const event=normalizeEvent(input);
    return arr(tasks).filter(task=>structuredMatch(event,task)||
      managedRegistrationMatch(event,task,ctx));
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
    const matched=match(event,tasks,ctx);
    // A customer may have an overdue Thursday task and a new Monday task.
    // Complete only the newest eligible occurrence, not the whole recurring series.
    const managed=matched.filter(task=>managedRegistrationMatch(event,task,ctx));
    const mostRecent=managed.length?managed.map(plannedDay).sort().at(-1):'';
    const candidates=managed.length===matched.length&&managed.length
      ?managed.filter(task=>plannedDay(task)===mostRecent):matched;
    if(candidates.length===0)return unchanged(source,'unmatched',{event});
    if(candidates.length>1){
      return unchanged(source,'ambiguous',{
        event,messageKey:'taskV2.workflow.reviewMapping',message:translated('taskV2.workflow.reviewMapping'),ambiguousTaskIds:candidates.map(task=>q(task&&task.id)).filter(Boolean)
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

  function shipmentCreatedFromSave(domEvent){
    const detail=obj(domEvent&&domEvent.detail)?domEvent.detail:{};
    if(detail.azureSaved!==true||detail.updated!==false)return null;
    const shipment=obj(detail.shipment)?detail.shipment:{};
    const shipmentId=q(shipment.id||shipment.shipmentId||detail.id),shipmentRef=q(shipment.ref||shipment.reference||shipment.shipmentRef||detail.reference);
    if(!shipmentId&&!shipmentRef)return null;
    const stableId=shipmentId||shipmentRef;
    return {
      eventId:`shipment.created:${stableId}`,
      type:'shipment.created',
      occurredAt:q(shipment.updatedAt||shipment.createdAt||detail.savedAt),
      customerId:q(shipment.customerId||shipment.customerNumber||shipment.customerAccount||shipment.account),
      customerName:q(shipment.customerName||shipment.deliveryName||shipment.customer),
      shipmentId,shipmentRef,
      orderId:q(shipment.orderId||shipment.salesOrder||shipment.order),
      processId:q(shipment.processId),workflowId:q(shipment.workflowId),taskType:'shipment'
    };
  }

  function shipmentRegisteredFromSave(domEvent,now){
    const detail=obj(domEvent&&domEvent.detail)?domEvent.detail:{};
    if(detail.azureSaved!==true)return null;
    const shipment=obj(detail.shipment)?detail.shipment:{};
    const shipmentId=q(shipment.id||shipment.shipmentId||detail.id);
    const shipmentRef=q(shipment.ref||shipment.reference||shipment.shipmentRef||detail.reference);
    if(!shipmentId&&!shipmentRef)return null;
    const confirmedAt=Date.parse(q(detail.savedAt||now)||new Date().toISOString());
    if(!Number.isFinite(confirmedAt))return null;
    const confirmations=arr(shipment.shipmentHistory).filter(row=>{
      if(!obj(row)||q(row.type).toLowerCase()!=='mail-sent')return false;
      if(q(row.label).toLocaleLowerCase('de-DE')!=='versandanmeldung versendet')return false;
      if(!['registration','versandanmeldung'].includes(q(row.details&&row.details.mailType).toLowerCase()))return false;
      const eventTime=Date.parse(q(row.at));
      // An old history entry is not proof that the current save sent another mail.
      return !!(q(row.id)&&Number.isFinite(eventTime)&&
        confirmedAt>=eventTime&&confirmedAt-eventTime<=15*60*1000);
    }).sort((a,b)=>Date.parse(q(b.at))-Date.parse(q(a.at)));
    if(!confirmations.length)return null;
    const row=confirmations[0];
    const customerId=q(shipment.customerId||shipment.customerNumber||shipment.customerAccount||shipment.account);
    const customerName=q(shipment.customerName||shipment.deliveryName||shipment.customer);
    if(!customerName)return null;
    return {
      eventId:'shipment.registered:'+(shipmentId||shipmentRef)+':'+q(row.id),
      type:'shipment.registered',occurredAt:q(row.at),
      customerId,customerName,shipmentId,shipmentRef,
      processId:'registration',taskType:'registration'
    };
  }

  function forwardConfirmedShipmentSave(domEvent){
    const created=shipmentCreatedFromSave(domEvent);
    const registered=shipmentRegisteredFromSave(domEvent);
    if(!created&&!registered)return null;
    const runtime=root.ExportHUBRC1014TaskRuntime;
    if(!runtime||typeof runtime.emitWorkflowEvent!=='function')return null;
    let result=null;
    for(const event of [created,registered].filter(Boolean)){
      try{result=runtime.emitWorkflowEvent(event)}catch(_){}
    }
    return result;
  }

  function installConfirmedBindings(){
    if(typeof root.addEventListener!=='function'||root.__EXPORTHUB_TASK_WORKFLOW_BINDINGS__)return false;
    root.__EXPORTHUB_TASK_WORKFLOW_BINDINGS__=true;
    root.addEventListener('exporthub:shipment-saved',forwardConfirmedShipmentSave);
    return true;
  }

  root.ExportHUBTaskWorkflowV2=Object.freeze({
    version:'2.0',types:TYPES,normalizeEvent,match,apply,emit,processedKey,shipmentCreatedFromSave,shipmentRegisteredFromSave,installConfirmedBindings
  });
  installConfirmedBindings();
})(globalThis);
