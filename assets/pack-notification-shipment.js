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
      packNotificationId:q(n.id),packNotificationRef:q(n.reference),customerName:q(n.customer),customerId:q(n.customerId),customerAccount:q(n.customerAccount),customerSource:q(n.customerSource)||'manual',deliveryNoteReference:q(n.deliveryNoteReference),packageType:q(n.packageType),packageCount:count,totalWeight:weight,note:q(n.note),
      rows:arr(n.packages).map((p,index)=>({count:1,packaging:q(p&&p.packagingType)||q(n.packageType),l:Number(p&&p.length)||0,w:Number(p&&p.width)||0,h:Number(p&&p.height)||0,weight:perWeight,packageNo:Number(p&&p.packageNo)||index+1})),
      deliveryFiles:arr(n.documents).filter(hasDocumentContent).map(doc=>Object.assign({},doc,{customerVisible:false,customerAvisVisible:false,source:'pack_notification',packNotificationId:q(n.id),packNotificationRef:q(n.reference)}))
    };
  }
  function shipmentRows(prefill){
    const groups=[];
    for(const row of arr(prefill&&prefill.rows)){
      const last=groups[groups.length-1];
      if(last&&last.type===row.packaging&&last.l===row.l&&last.w===row.w&&last.h===row.h){last.count+=1;continue;}
      groups.push({type:q(row.packaging),count:1,l:row.l,w:row.w,h:row.h,weight:0});
    }
    const total=Number(prefill&&prefill.totalWeight)||0,pieces=groups.reduce((sum,g)=>sum+g.count,0);
    let assigned=0;
    groups.forEach((g,index)=>{
      if(index===groups.length-1){g.weight=Math.round((total-assigned)*10)/10;return;}
      g.weight=pieces?Math.round(total*g.count/pieces*10)/10:0;assigned+=g.weight;
    });
    return groups;
  }
  function findShipmentForNotification(state,notification){
    const n=notification||{},wanted=q(n.shipmentId),wantedRef=q(n.shipmentRef).toUpperCase(),nid=q(n.id),nref=q(n.reference);
    const list=[...arr(state&&state.shipments),...arr(state&&state.savedShipments),...arr(state&&state.sharedShipments),state&&state.shipment,state&&state.currentShipment,state&&state.selectedShipment].filter(Boolean);
    const rowRef=sh=>q(sh&&(sh.ref||sh.reference||sh.shipmentRef)).toUpperCase();
    const foreignOwner=sh=>
      (q(sh&&sh.packNotificationId)&&q(sh.packNotificationId)!==nid)||
      (q(sh&&sh.packNotificationRef)&&q(sh.packNotificationRef)!==nref);
    const linked=sh=>!foreignOwner(sh)&&((nid&&q(sh.packNotificationId)===nid)||(nref&&q(sh.packNotificationRef)===nref));
    // Technical editor IDs can be recycled across shipment REFs. The REF is
    // authoritative once saved; never open a different shipment by ID alone.
    if(wantedRef){
      const exact=list.filter(sh=>rowRef(sh)===wantedRef&&!foreignOwner(sh));
      return exact.find(linked)||exact.find(sh=>wanted&&shipmentId(sh)===wanted)||exact[0]||null;
    }
    const associated=list.filter(linked);
    if(associated.length){
      if(new Set(associated.map(rowRef).filter(Boolean)).size>1)return null;
      return associated[0];
    }
    if(!wanted)return null;
    // Check all ID collisions before filtering foreign pack owners. Otherwise
    // excluding a foreign REF can make a recycled ID appear falsely unique.
    const idMatches=list.filter(sh=>shipmentId(sh)===wanted);
    if(new Set(idMatches.map(rowRef).filter(Boolean)).size>1)return null;
    const byId=idMatches.filter(sh=>!foreignOwner(sh));
    return byId[0]||null;
  }
  // A shipment-saved event may contain a detached snapshot. Only a row that
  // actually belongs to the persisted state can carry the pack PDFs into its REF.
  function persistedShipments(state,detail,notification){
    const rows=[...arr(state&&state.shipments),...arr(state&&state.savedShipments),...arr(state&&state.sharedShipments)];
    const rowRef=row=>q(row&&(row.ref||row.reference||row.shipmentRef)).toUpperCase();
    let ref=q(detail&&(detail.ref||detail.reference||detail.shipmentRef)||notification&&notification.shipmentRef).toUpperCase();
    const id=shipmentId(detail),nid=q(notification&&notification.id),nref=q(notification&&notification.reference);
    const byPack=row=>(nid&&q(row.packNotificationId)===nid)||(nref&&q(row.packNotificationRef)===nref);
    // Resolve missing event REF by the pack link, then by an unambiguous ID.
    // An ID shared by multiple REFs must never attach documents to both.
    if(!ref){
      const associated=rows.filter(byPack);
      const refs=new Set(associated.map(rowRef).filter(Boolean));
      if(refs.size>1)return[];
      if(refs.size===1)ref=refs.values().next().value;
      else if(id){
        const idRefs=new Set(rows.filter(row=>shipmentId(row)===id).map(rowRef).filter(Boolean));
        if(idRefs.size>1)return[];
        if(idRefs.size===1)ref=idRefs.values().next().value;
      }
    }
    const seen=new Set(),found=[];
    for(const row of rows){
      if(!row||seen.has(row))continue;
      const currentRef=rowRef(row),associated=byPack(row);
      const byRef=!!ref&&currentRef===ref;
      const byId=!!id&&shipmentId(row)===id&&(!ref||currentRef===ref||(!currentRef&&associated));
      const byAssociation=!!associated&&(!ref||currentRef===ref);
      if(byRef||byId||byAssociation){seen.add(row);found.push(row);}
    }
    return found;
  }
  function hasDocumentContent(file){
    if(!file||typeof file!=='object')return false;
    if(q(file.blobName)&&/^rc1059\/(?:production|testservice)\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(q(file.blobName)))return true;
    return ['data','dataUrl','base64'].some(k=>typeof file[k]==='string'&&(/^data:[^;,]+;base64,[A-Za-z0-9+/=]+$/.test(file[k])||k==='base64'&&/^[A-Za-z0-9+/=]+$/.test(file[k])));
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
  const OPEN_AFTER_SHIPMENT=new Set(['shipment_created','registration_in_progress','registered','ready_for_dispatch']);
  function shipmentStatusText(sh){return q(sh&&(sh.status||sh.shipmentStatus||sh.processStatus||sh.pickupStatus)).toLocaleLowerCase('de-DE');}
  function shipmentCancelled(sh){return /^(?:storniert|cancelled|canceled)$/.test(shipmentStatusText(sh));}
  function shipmentCompleted(sh){
    try{const calendar=root.ExportHubPickupCalendar;if(calendar&&typeof calendar.shipmentIsCompleted==='function')return Boolean(calendar.shipmentIsCompleted(sh));}catch(_){}
    if(q(sh&&(sh.pickedUpAt||sh.pickupConfirmedAt||sh.pickupCompletedAt||sh.podServerVerifiedAt)))return true;
    return /^(?:abgeholt|pod vorhanden|abgeschlossen|archiviert|picked up|pod available|completed|archived)$/.test(shipmentStatusText(sh));
  }
  function statusFromShipment(sh){if(!sh)return'';if(shipmentCancelled(sh))return'cancelled';if(shipmentCompleted(sh))return'completed';return'';}
  function syncStatuses(state,at){
    const when=q(at)||new Date().toISOString(),changes=[];
    for(const notification of arr(state&&state.packNotifications)){
      if(!q(notification&&notification.shipmentId)||!OPEN_AFTER_SHIPMENT.has(q(notification.status).toLowerCase()))continue;
      const next=statusFromShipment(findShipmentForNotification(state,notification));if(!next)continue;
      const before={notification:{status:notification.status,updatedAt:notification.updatedAt,closedAt:notification.closedAt},tasks:[]};
      notification.status=next;notification.updatedAt=when;notification.closedAt=when;
      for(const task of arr(state&&state.tasks)){
        if(q(task&&task.sourceType)!=='pack_notification'||q(task&&task.sourceId)!==q(notification.id))continue;
        before.tasks.push({task,status:task.status,updatedAt:task.updatedAt,unread:task.unread});
        task.status=next==='completed'?'done':'cancelled';task.unread=false;task.updatedAt=when;
      }
      changes.push({notification,before});
    }
    return changes;
  }
  function revertSync(changes){
    for(const {notification,before} of changes){
      for(const [key,value] of Object.entries(before.notification)){if(value===undefined)delete notification[key];else notification[key]=value;}
      for(const t of before.tasks){for(const key of ['status','updatedAt','unread']){if(t[key]===undefined)delete t.task[key];else t.task[key]=t[key];}}
    }
  }
  let syncing=false,syncTimer=0;
  async function syncAndPersist(){
    if(syncing)return false;syncing=true;
    try{const changes=syncStatuses(sharedState(),new Date().toISOString());if(!changes.length)return false;if(!await persist('Packmeldung-Status aus Sendung übernommen')){revertSync(changes);return false;}return true;}
    finally{syncing=false;}
  }
  function scheduleSync(){if(typeof setTimeout!=='function')return;if(typeof clearTimeout==='function')clearTimeout(syncTimer);syncTimer=setTimeout(()=>{syncAndPersist().catch(()=>{});},150);}
  async function persist(reason){
    try{
      const clean=root.ExportHUBClean;
      if(clean&&typeof clean.queueSave==='function'){
        const queued=await Promise.resolve(clean.queueSave(reason));
        if(queued===false)return false;
      }
      const runtime=clean&&clean.runtime||null,target=runtime?Number(runtime.changeGeneration||0):0;
      if(runtime&&target>0&&Number(runtime.lastSavedGeneration||0)>=target)return true;
      if(clean&&typeof clean.flushSave==='function'){
        let flushed=await Promise.resolve(clean.flushSave(reason));
        if(flushed===false&&runtime&&target>0){
          const timer=clean.native&&typeof clean.native.setTimeout==='function'?clean.native.setTimeout.bind(clean.native):(root.setTimeout||setTimeout);
          for(let checks=0;checks<20&&Number(runtime.lastSavedGeneration||0)<target;checks+=1){
            if(!runtime.saving&&checks>=2)break;
            await new Promise(resolve=>timer(resolve,100));
          }
          flushed=Number(runtime.lastSavedGeneration||0)>=target;
        }
        if(flushed===false)return false;
      }
      return true;
    }catch(_){return false;}
  }
  function openShipment(sh){
    const target=q(sh&&(sh.ref||sh.reference||sh.id||sh.shipmentId));if(!target)return false;
    try{if(root.ExportHUBShipmentView&&typeof root.ExportHUBShipmentView.open==='function'){root.ExportHUBShipmentView.open(target,'tasks');return true;}}catch(_){}
    try{if(typeof root.openShipment==='function'){root.openShipment(target);return true;}}catch(_){}
    try{if(typeof root.__EXPORTHUB_OPEN_SHIPMENT__==='function'){root.__EXPORTHUB_OPEN_SHIPMENT__(target);return true;}}catch(_){}
    return false;
  }
  function nativeValue(input,value){
    if(!input)return;const descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input),'value');if(descriptor&&descriptor.set)descriptor.set.call(input,String(value));else input.value=String(value);
  }
  function nativeSet(input,value){
    if(!input)return;nativeValue(input,value);['input','change'].forEach(type=>input.dispatchEvent(new Event(type,{bubbles:true})));
  }
  function applyPrefillToMountedForm(prefill){
    const doc=root.document;if(!doc)return false;
    const manualWithoutIdentity=q(prefill.customerSource).toLowerCase()==='manual'&&!q(prefill.customerId)&&!q(prefill.customerAccount);
    const customer=doc.getElementById('shipmentCustomerSearch');if(customer&&prefill.customerName){
      if(manualWithoutIdentity)nativeValue(customer,prefill.customerName);
      else{nativeSet(customer,prefill.customerName);try{customer.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));}catch(_){}}
    }
    applyRowsToMountedForm(doc,shipmentRows(prefill));
    applyTextsToMountedForm(doc,prefill);
    // Only populate a new, unsaved draft or the already linked Pack draft.
    // A previous editor snapshot must never receive this Pack's PDFs.
    const state=sharedState(),candidates=[state.shipment,state.currentShipment,state.selectedShipment];
    const draft=ownedPendingDraft(state,prefill)||candidates.find(item=>item&&typeof item==='object'
      &&!q(item.packNotificationId)&&!q(item.packNotificationRef)
      &&!shipmentId(item)&&!q(item.shipmentRef));
    if(draft){
      if(manualWithoutIdentity&&prefill.customerName)draft.customerSearch=prefill.customerName;
      draft.packNotificationId=prefill.packNotificationId;draft.packNotificationRef=prefill.packNotificationRef;draft.packNotificationCustomer={id:prefill.customerId,account:prefill.customerAccount,name:prefill.customerName,source:prefill.customerSource};draft.packNotificationPrefill={deliveryNoteReference:prefill.deliveryNoteReference,packageType:prefill.packageType,packageCount:prefill.packageCount,totalWeight:prefill.totalWeight,rows:prefill.rows,note:prefill.note};
      draft.deliveryFiles=mergeDocuments(draft.deliveryFiles,prefill.deliveryFiles);
    }
    renderPendingLieferscheine(prefill);
    return true;
  }
  // Packtisch names ("Europalette") and shipment options ("Euro Palette") differ in spacing and case
  const packagingKey=value=>q(value).toLocaleLowerCase('de-DE').replace(/[^a-z0-9äöüß]/g,'');
  function matchPackaging(select,type){
    const wanted=packagingKey(type);if(!select||!wanted)return q(type);
    const option=Array.from(select.options||[]).find(o=>packagingKey(o.value)===wanted);
    return option?option.value:q(type);
  }
  function rowNodes(doc){return Array.from(doc.querySelectorAll('#rc573ColliCard .rc363-owned-row'));}
  function rowsMatch(doc,plan){
    const nodes=rowNodes(doc);
    // RC1678: a customer/location rerender may retain type and count but
    // clear the package dimensions or weight. A partial row is not valid.
    function metricOk(node,field,expected){
      if(!(Number(expected)>0))return true;
      const input=node.querySelector('[data-rc363-field="'+field+'"] input');
      const value=q(input&&input.value).replace(',','.');
      return !!value&&Number.isFinite(Number(value))&&Math.abs(Number(value)-Number(expected))<0.051;
    }
    return plan.every((row,index)=>{
      const node=nodes[index];if(!node)return false;
      const select=node.querySelector('[data-rc363-field="type"] select'),count=node.querySelector('[data-rc363-field="count"] input');
      return (!row.type||!select||packagingKey(select.value)===packagingKey(matchPackaging(select,row.type)))
        &&q(count&&count.value)===q(row.count)
        &&['l','w','h','weight'].every(field=>metricOk(node,field,row[field]));
    });
  }
  function applyTextsToMountedForm(doc,prefill){
    if(typeof doc.querySelector!=='function')return;
    const fill=(selector,value)=>{const field=doc.querySelector(selector);if(field&&q(value)&&!q(field.value))nativeSet(field,value);};
    fill('[id^="rc408Shipment_deliveryNotes"]',prefill.deliveryNoteReference);
    fill('[id^="rc408Shipment_comments"]',prefill.note);
  }
  function applyRowsToMountedForm(doc,plan){
    const api=root.ExportHUBShipment420,nodes=()=>rowNodes(doc);
    plan.forEach((row,index)=>{
      if(!nodes()[index]&&api&&typeof api.addRow==='function')api.addRow();
      let node=nodes()[index];if(!node)return;
      const select=node.querySelector('[data-rc363-field="type"] select'),type=matchPackaging(select,row.type);
      if(type&&api&&typeof api.updateRow==='function'&&q(select&&select.value)!==type){api.updateRow(index,'type',type,select||node);node=nodes()[index]||node;}
      const set=(field,value)=>nativeSet(node.querySelector(`[data-rc363-field="${field}"] input`),value);
      set('count',row.count);set('l',row.l||'');set('w',row.w||'');set('h',row.h||'');
      const weight=node.querySelector('[data-rc363-field="weight"] input');
      if(api&&typeof api.updateRow==='function'){api.updateRow(index,'weight',row.weight||'',weight||node);nativeValue(weight,row.weight||'');}
      else set('weight',row.weight||'');
    });
    return true;
  }
  function waitForShipmentForm(prefill,attempt=0,settleAttempt=0,lastCustomer=null){
    const doc=root.document;if(!doc||attempt>100)return;
    const form=doc.getElementById('rc363BlockCustomer');
    if(form){
      const customer=doc.getElementById('shipmentCustomerSearch');
      const manualWithoutIdentity=q(prefill.customerName)&&q(prefill.customerSource).toLowerCase()==='manual'&&!q(prefill.customerId)&&!q(prefill.customerAccount);
      const customerWasReplaced=Boolean(lastCustomer&&customer&&customer!==lastCustomer);
      const customerLostValue=Boolean(manualWithoutIdentity&&customer&&q(customer.value)!==q(prefill.customerName));
      if(settleAttempt===0||customerWasReplaced||customerLostValue)applyPrefillToMountedForm(prefill);
      if(manualWithoutIdentity&&settleAttempt<10)setTimeout(()=>waitForShipmentForm(prefill,attempt,settleAttempt+1,customer),80);
      if(settleAttempt===0)setTimeout(()=>keepRows(prefill,0),200);
      return;
    }
    const button=doc.getElementById('rc380NewShipment');if(button&&!button.__packClicked){button.__packClicked=true;button.click();}
    setTimeout(()=>waitForShipmentForm(prefill,attempt+1,0,null),80);
  }
  // A customer/location refresh can replace the shipment draft and silently
  // drop deliveryFiles while leaving the visible package inputs unchanged.
  // RC1679: restore only existing, verified Pack Blob references on the same
  // explicit Pack owner; never infer ownership from a reused shipment ID.
  function ownedPendingDraft(state,prefill){
    const nid=q(prefill&&prefill.packNotificationId),nref=q(prefill&&prefill.packNotificationRef);
    if(!nid||!nref)return null;
    // Never let a stale editor snapshot hide the actual active Pack draft.
    return [state&&state.shipment,state&&state.currentShipment,state&&state.selectedShipment]
      .find(draft=>draft&&q(draft.packNotificationId)===nid&&q(draft.packNotificationRef)===nref)||null;
  }
  function keepPendingDocuments(prefill){
    const state=sharedState(),draft=ownedPendingDraft(state,prefill);
    if(!draft)return false;
    const expected=arr(prefill.deliveryFiles).filter(hasDocumentContent);
    if(!expected.length)return false;
    const merged=mergeDocuments(draft.deliveryFiles,expected);
    if(merged.length===arr(draft.deliveryFiles).length)return false;
    draft.deliveryFiles=merged;
    return true;
  }
  // RC1680: Pack PDFs in deliveryFiles are not useful to the operator until
  // the shipment creation form exposes an actual authenticated open/download
  // action. Never render another Pack owner's private attachments.
  function renderPendingLieferscheine(prefill){
    const doc=root.document;
    if(!doc||typeof doc.getElementById!=='function'||typeof doc.createElement!=='function')return false;
    const section=doc.getElementById('rc363BlockDocuments');
    if(!section||typeof section.querySelector!=='function')return false;
    const previous=section.querySelector('#rc1680PackDeliveryFiles');
    const state=sharedState(),draft=ownedPendingDraft(state,prefill);
    const files=draft?arr(draft.deliveryFiles).filter(file=>file&&
      q(file.source)==='pack_notification'&&
      q(file.packNotificationId)===q(prefill.packNotificationId)&&
      q(file.packNotificationRef)===q(prefill.packNotificationRef)&&hasDocumentContent(file)):[];
    if(!files.length){if(previous&&typeof previous.remove==='function')previous.remove();return false;}
    const signature=files.map(file=>q(file.blobName||file.id)+'|'+q(file.name)).join('\\n');
    if(previous&&previous.__rc1680Signature===signature)return true;
    if(previous&&typeof previous.remove==='function')previous.remove();
    const t=(key,fallback)=>{
      try{const value=root.ExportHUBI18n&&root.ExportHUBI18n.t&&root.ExportHUBI18n.t(key);if(value&&value!==key)return value;}catch(_){}
      return fallback;
    };
    const panel=doc.createElement('div');panel.id='rc1680PackDeliveryFiles';
    panel.className='rc1680-pack-delivery-files';panel.__rc1680Signature=signature;
    panel.setAttribute('role','group');
    panel.setAttribute('aria-label',t('shipmentHistory.document.deliveryNote','Imported delivery notes'));
    panel.style.cssText='margin-top:12px;padding:12px;border:1px solid var(--eh-border,#d7dfe8);border-radius:10px';
    const title=doc.createElement('strong');title.textContent=t('shipmentHistory.document.deliveryNote','Delivery notes')+' · '+files.length;
    panel.appendChild(title);
    for(const file of files){
      const row=doc.createElement('div');row.className='rc1680-pack-file';
      row.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px';
      const label=doc.createElement('span');label.textContent=q(file.name||file.fileName)||'document.pdf';
      label.style.cssText='flex:1 1 180px;overflow-wrap:anywhere';row.appendChild(label);
      const feedback=doc.createElement('span');feedback.setAttribute('role','status');
      const openFile=async(download)=>{
        try{
          const currentState=sharedState(),current=ownedPendingDraft(currentState,prefill);
          if(!current)throw Error('Pack ownership changed');
          const chosen=arr(current.deliveryFiles).find(item=>item&&
            q(item.blobName||item.id)===q(file.blobName||file.id)&&
            q(item.packNotificationId)===q(prefill.packNotificationId)&&
            q(item.packNotificationRef)===q(prefill.packNotificationRef)&&
            q(item.source)==='pack_notification'&&hasDocumentContent(item));
          const reader=root.ExportHUBDocumentBlob1059;
          if(!chosen||!reader||typeof reader.open!=='function')throw Error('Original document is unavailable');
          feedback.textContent=t(download?'documentViewer.download':'documentViewer.open',download?'Download':'Open')+' …';
          const opened=await reader.open(chosen,{name:q(chosen.name),download});
          if(opened===false)throw Error('Original document download failed');
          feedback.textContent='';
        }catch(_){feedback.textContent=t('documentViewer.openFailed','The document could not be opened.');}
      };
      for(const [labelKey,fallback,download] of [
        ['documentViewer.open','Open',false],['documentViewer.download','Download',true]
      ]){
        const button=doc.createElement('button');button.type='button';button.className='ghost';
        button.textContent=t(labelKey,fallback);button.setAttribute('aria-label',button.textContent+' '+label.textContent);
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void openFile(download);});
        row.appendChild(button);
      }
      row.appendChild(feedback);panel.appendChild(row);
    }
    section.appendChild(panel);
    return true;
  }
  // the customer lookup and the fresh-shipment reset re-render the colli rows after the first fill and dropped packaging, count and weight
  function keepRows(prefill,check){
    const doc=root.document;if(!doc||check>15||!pending||pending.prefill!==prefill)return;
    keepPendingDocuments(prefill);
    renderPendingLieferscheine(prefill);
    const plan=shipmentRows(prefill);if(!rowsMatch(doc,plan)){applyRowsToMountedForm(doc,plan);applyTextsToMountedForm(doc,prefill);}
    setTimeout(()=>keepRows(prefill,check+1),200);
  }
  function startNew(notification){
    const prefill=shipmentPrefill(notification);pending={notificationId:q(notification.id),prefill};root.__EXPORTHUB_PACK_SHIPMENT_PREFILL__=prefill;
    let freshStarted=false;
    try{const shipmentApi=root.ExportHUBShipment420;if(shipmentApi&&typeof shipmentApi.startNewShipment==='function'){shipmentApi.startNewShipment();freshStarted=true;}}catch(_){}
    if(!freshStarted)try{if(typeof root.setView==='function')root.setView('shipment');}catch(_){}
    setTimeout(()=>waitForShipmentForm(prefill),20);return true;
  }
  function begin(notificationId){
    const state=sharedState(),notification=notificationById(state,notificationId);if(!notification)return false;
    const existing=findShipmentForNotification(state,notification);if(existing)return openShipment(existing);
    if(q(notification.status).toLowerCase()==='cancelled')return false;
    return startNew(notification);
  }
  async function onShipmentSaved(event){
    scheduleSync();
    if(!pending)return;const state=sharedState(),notification=notificationById(state,pending.notificationId);if(!notification){pending=null;return;}
    const detail=event&&event.detail||{},source=detail.shipment||findShipmentForNotification(state,notification);
    // Some save events provide the authoritative REF beside the shipment
    // snapshot. Do not discard it when the snapshot itself only has an ID.
    const snapshotRef=q(source&&(source.ref||source.reference||source.shipmentRef)).toUpperCase();
    const eventRef=q(detail.ref||detail.reference||detail.shipmentRef).toUpperCase();
    // Contradictory REFs must not trigger cross-shipment PDF handoff.
    if(snapshotRef&&eventRef&&snapshotRef!==eventRef)return false;
    const sourceRef=snapshotRef||eventRef;
    const savedRows=persistedShipments(state,Object.assign({},source||{},{ref:sourceRef}),notification);
    // Do not attach PDFs only to a detached event payload. The committed
    // shipment row (and any persisted aliases) must receive the real blob link.
    if(!savedRows.length||!shipmentId(savedRows[0]))return false;
    // An unrelated save event or previously linked REF must never take over
    // an in-flight pack notification, even if technical shipment IDs overlap.
    const belongsToAnotherPack=row=>
      (q(row&&row.packNotificationId)&&q(row.packNotificationId)!==q(notification.id))||
      (q(row&&row.packNotificationRef)&&q(row.packNotificationRef)!==q(notification.reference));
    if(belongsToAnotherPack(source)||savedRows.some(belongsToAnotherPack))return false;
    const prefill=shipmentPrefill(notification);
    if(arr(notification.documents).length!==prefill.deliveryFiles.length)return false;
    const task=arr(state&&state.tasks).find(t=>q(t&&t.sourceType)==='pack_notification'&&q(t&&t.sourceId)===q(notification.id));
    const notificationBefore={shipmentId:notification.shipmentId,shipmentRef:notification.shipmentRef,status:notification.status,updatedAt:notification.updatedAt};
    const snapshots=savedRows.map(saved=>({saved,before:{packNotificationId:saved.packNotificationId,packNotificationRef:saved.packNotificationRef,packNotificationLinkedAt:saved.packNotificationLinkedAt,deliveryFiles:saved.deliveryFiles}}));
    const taskBefore=task?{status:task.status,updatedAt:task.updatedAt}:null;
    const when=new Date().toISOString();
    for(const saved of savedRows)linkShipment(state,notification,saved,when);
    const persisted=await persist('Packmeldung mit Sendung verknüpft');
    if(!persisted){
      for(const [key,value] of Object.entries(notificationBefore)){if(value===undefined)delete notification[key];else notification[key]=value;}
      for(const {saved,before} of snapshots){for(const [key,value] of Object.entries(before)){if(value===undefined)delete saved[key];else saved[key]=value;}}
      if(task&&taskBefore){for(const [key,value] of Object.entries(taskBefore)){if(value===undefined)delete task[key];else task[key]=value;}}
      return false;
    }
    pending=null;root.__EXPORTHUB_PACK_SHIPMENT_PREFILL__=null;return true;
  }
  // A customer/location refresh can replace the current draft after the initial
  // three-second prefill window. Keep restoring only the matching Pack owner
  // for the entire pending handoff, including after a remote state refresh.
  function refreshPendingDocuments(){
    if(!pending||!pending.prefill)return false;
    keepPendingDocuments(pending.prefill);
    return renderPendingLieferscheine(pending.prefill);
  }
  function install(){
    if(typeof root.addEventListener!=='function'||root.__packShipmentBridgeInstalled)return false;root.__packShipmentBridgeInstalled=true;
    root.addEventListener('exporthub:pack-create-shipment',event=>begin(event&&event.detail&&event.detail.notificationId));
    root.addEventListener('exporthub:shipment-saved',onShipmentSaved);
    // Rehydrate real original PDFs before rendering the attachment controls;
    // do not stop after the short-lived row/dimension stabilization timer.
    root.addEventListener('exporthub:rendered',refreshPendingDocuments);
    ['exporthub:shipment-updated','exporthub:state-loaded','exporthub:sync'].forEach(name=>root.addEventListener(name,()=>{refreshPendingDocuments();scheduleSync();}));
    scheduleSync();return true;
  }

  root.ExportHUBPackShipment=Object.freeze({shipmentPrefill,shipmentRows,matchPackaging,findShipmentForNotification,linkShipment,statusFromShipment,syncStatuses,begin,applyPrefillToMountedForm,install});
  install();
})(typeof window!=='undefined'?window:globalThis);