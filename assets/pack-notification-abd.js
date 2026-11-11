(function(root){
  'use strict';
  if(!root||root.ExportHUBPackAbd)return;
  const q=value=>String(value==null?'':value).trim();
  const arr=value=>Array.isArray(value)?value:[];
  const tr=key=>{try{const api=root.ExportHUBPackI18n;return api&&typeof api.t==='function'?api.t(key):key;}catch(_){return key;}};
  const number=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0;};
  let activeId='';
  let saveBusy=false,lastSave=null;

  function state(){
    try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{};}catch(_){}
    return root.__EXPORTHUB_STATE__||root.state||{};
  }
  function notification(id){
    return arr(state().packNotifications).find(n=>q(n&&n.id)===q(id))||null;
  }
  function owned(request,n){
    return !!(request&&n&&q(request.packNotificationId)===q(n.id)&&q(request.packNotificationRef)===q(n.reference));
  }
  function resolve(n){
    const s=state(),rows=arr(s.abdRequests),storedId=q(n.abdRequestId),storedRef=q(n.abdRequestRef);
    const linked=rows.filter(r=>owned(r,n));
    if(linked.length>1)throw new Error('Mehrere ABD-Anfragen für diese Packmeldung gefunden. Bitte Zuordnung prüfen.');
    if(storedId||storedRef){
      const matching=rows.find(r=>q(r.id)===storedId&&q(r.ref||r.reference)===storedRef);
      if(!matching||!owned(matching,n))throw new Error('Die gespeicherte ABD-Verknüpfung ist derzeit nicht eindeutig verfügbar.');
      if(linked.length&&q(linked[0].id)!==storedId)throw new Error('Widersprüchliche ABD-Verknüpfung.');
      return matching;
    }
    return linked[0]||null;
  }
  function rowsFromPack(n){
    const packages=arr(n&&n.packages),groups=[];
    for(const part of packages){
      const type=q(part&&(part.packagingType||part.packageType||part.packaging));
      const count=Number(part&&part.count),qty=Number.isInteger(count)&&count>0&&count<=999?count:1;
      // A declared package/line weight is evidence. Never divide an unknown
      // shipment-level total across mixed package types as a guessed weight.
      const weight=number(part&&(part.totalWeight||part.weight));
      const known=weight>0;
      const last=groups[groups.length-1];
      if(last&&last.type===type){
        last.count+=qty;last.weight+=weight;last.known=last.known&&known;
      }else groups.push({type,count:qty,weight,known});
    }
    if(!groups.length)groups.push({
      type:q(n&&(n.packageType||n.packagingType)),
      count:Math.max(1,Math.trunc(number(n&&n.packageCount)||1)),
      weight:0,known:false
    });
    const total=number(n&&n.totalWeight),knownSum=groups.reduce((sum,g)=>sum+(g.known?g.weight:0),0);
    const contradictory=!!total&&knownSum>total+0.11;
    return groups.map((g,i)=>({
      id:'PACK-COLLI-'+(i+1),
      type:g.type,
      count:String(g.count),
      weight:contradictory?'':groups.length===1&&total?String(total):g.known?String(Math.round(g.weight*10)/10):''
    }));
  }

  function canSave(d){
    const n=notification(d&&d.packNotificationId);
    return !saveBusy&&!!n&&owned(d,n)&&q(n.status).toLowerCase()!=='cancelled';
  }
  function saveStatusText(){
    if(!lastSave)return '';
    return lastSave.status==='saving'?tr('pack.internal.abdSaving')
      :lastSave.status==='saved'?tr('pack.internal.abdSaved')
      :tr('pack.internal.abdSaveUnconfirmed');
  }
  function updateSaveStatus(){
    const d=root.document,el=d&&d.querySelector&&d.querySelector('[data-pack-abd-save-status]');
    const draft=state().abdDraft;
    if(!el)return false;
    const visible=lastSave&&q(lastSave.id)===q(draft&&draft.id);
    const message=visible?saveStatusText():'';
    if(el.textContent!==message)el.textContent=message;
    if(el.hidden===visible)el.hidden=!visible;
    const nextStatus=visible?lastSave.status:'';
    if(el.getAttribute('data-status')!==nextStatus)el.setAttribute('data-status',nextStatus);
    return true;
  }
  async function confirmSave(item,options){
    if(saveBusy)return false;
    saveBusy=true;lastSave={id:q(item&&item.id),status:'saving'};
    const opts=options||{};
    const reason='Packmeldung ABD-Anfrage speichern';
    try{
      const clean=root.ExportHUBClean;
      if(!item||!q(item.id)||!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')
        throw new Error('ABD_SAVE_ACK_UNAVAILABLE');
      const queued=await Promise.resolve(clean.queueSave(reason));
      if(queued===false)throw new Error('ABD_SAVE_QUEUE_REJECTED');
      const runtime=clean.runtime||null,target=Number(runtime&&runtime.changeGeneration)||0;
      const flushed=await Promise.resolve(clean.flushSave(reason));
      // RC2004 P0: a locally advanced lastSavedGeneration is not evidence of
      // Azure persistence. When the runtime exposes the authoritative server
      // acknowledgement, it must cover the exact queued generation even if
      // flushSave returned true. Never send a mail on a stale acknowledgement.
      const hasServerAck=!!runtime&&target>0&&typeof runtime.lastServerSaveAckGeneration==='number'&&
        Number.isFinite(runtime.lastServerSaveAckGeneration);
      const acknowledged=hasServerAck
        ? runtime.lastServerSaveAckGeneration>=target
        : flushed===true;
      if(!acknowledged)throw new Error('ABD_SAVE_UNCONFIRMED');
      const n=notification(item.packNotificationId);
      const matches=arr(state().abdRequests).filter(r=>owned(r,n));
      const current=matches.length===1?matches[0]:null;
      if(!n||!current||q(current.id)!==q(item.id)||q(current.ref||current.reference)!==q(item.ref))
        throw new Error('ABD_SAVE_LINK_MISMATCH');
      lastSave={id:q(item.id),status:'saved'};
      if(opts.showAlert&&typeof root.alert==='function')root.alert(tr('pack.internal.abdSaved'));
      if(opts.openMail&&!root.__EXPORTHUB_TEST_NO_MAILTO__&&root.location){
        try{
          root.location.href='mailto:'+encodeURIComponent(q(item.mailTo))+
            '?subject='+encodeURIComponent(q(item.mailSubject))+
            '&body='+encodeURIComponent(q(item.mailBody));
        }catch(_){report(new Error(tr('pack.internal.abdMailUnavailable')));}
      }
      return true;
    }catch(_){
      // A timeout can mean the server accepted the write but the response was
      // lost. Keep the same ID/ownership in the current state for a safe retry.
      // Never claim success or open Outlook without a verified acknowledgement.
      lastSave={id:q(item&&item.id),status:'unconfirmed'};
      report(new Error(tr('pack.internal.abdSaveUnconfirmed')));
      return false;
    }finally{
      saveBusy=false;
      decorate();
      updateSaveStatus();
    }
  }

  function report(error){
    const message=q(error&&error.message)||tr('pack.internal.abdOpenError');
    try{if(typeof root.alert==='function')root.alert(message);}catch(_){}
    return false;
  }
  function route(){
    if(typeof root.setView==='function'){root.setView('abd');return q(state().view).toLowerCase()==='abd';}
    if(root.ExportHUBRC325&&typeof root.ExportHUBRC325.route==='function'){
      root.ExportHUBRC325.route('abd','pack-abd');return q(state().view).toLowerCase()==='abd';
    }
    return false;
  }
  function showManual(){
    const tabs=root.ExportHUBRC1294ABDAnalysis;
    if(tabs&&typeof tabs.setMode==='function')tabs.setMode('manual',true);
  }
  function begin(notificationId){
    try{
      const n=notification(notificationId);
      if(!n||!q(n.reference))throw new Error('Packmeldung wurde nicht gefunden.');
      const existing=resolve(n);
      if(q(n.status).toLowerCase()==='cancelled'&&!existing)throw new Error('Stornierte Packmeldungen dürfen keine neue ABD-Anfrage erzeugen.');
      const current=state().abdDraft;
      if(!existing&&current&&q(current.packNotificationId)&&q(current.packNotificationId)!==q(n.id)&&
        !arr(state().abdRequests).some(r=>q(r.id)===q(current.id)&&q(r.packNotificationId)===q(current.packNotificationId))){
        throw new Error('Eine andere Pack-ABD ist noch als Entwurf geöffnet. Bitte zuerst speichern oder abschließen.');
      }
      if(!route())throw new Error('Der ABD-Arbeitsbereich ist nicht erreichbar.');
      const legacy=root.ExportHUBRC626;
      if(!legacy||typeof legacy.renderAbd!=='function'||typeof legacy.newAbd!=='function'||typeof legacy.editAbd!=='function')
        throw new Error('Der ABD-Editor ist aktuell nicht verfügbar.');
      if(activeId!==q(n.id))lastSave=null;
      activeId=q(n.id);
      if(existing){
        legacy.editAbd(existing.id);
      }else if(current&&owned(current,n)&&q(current.ref)){
        state().abdDraft=current;
        legacy.renderAbd();
      }else{
        legacy.newAbd();
        const draft=state().abdDraft;
        if(!draft||!q(draft.ref))throw new Error('ABD-Entwurf konnte nicht angelegt werden.');
        draft.source='manual';
        draft.packNotificationId=q(n.id);
        draft.packNotificationRef=q(n.reference);
        draft.linkedShipmentId='';
        draft.customerId=q(n.customerId||n.customerAccount);
        draft.customerNumber=q(n.customerAccount||n.customerId);
        draft.customerName=q(n.customer);
        draft.customerSearch=q(draft.customerNumber&&draft.customerName?draft.customerNumber+' · '+draft.customerName:draft.customerName);
        draft.deliveryNotes=q(n.deliveryNoteReference);
        draft.rows=rowsFromPack(n);
        draft.invoiceFiles=[];
        draft.abdFiles=[];
        legacy.renderAbd();
        try{
          const clean=root.ExportHUBClean;
          if(clean&&typeof clean.queueSave==='function')Promise.resolve(clean.queueSave('Packmeldung ABD-Entwurf vorbereiten')).catch(()=>{});
        }catch(_){}
      }
      showManual();
      decorate();
      return true;
    }catch(error){return report(error);}
  }
  function decorate(){
    const d=root.document,host=d&&d.getElementById&&d.getElementById('rc626Abd');
    const draft=state().abdDraft;
    if(!host||!draft||!q(draft.packNotificationId)||!q(draft.packNotificationRef))return false;
    const n=notification(draft.packNotificationId);
    if(!n||q(n.reference)!==q(draft.packNotificationRef))return false;
    if(host.querySelector('[data-pack-abd-source]')){updateSaveStatus();return true;}
    activeId=q(n.id);
    const panel=d.createElement('section');
    panel.setAttribute('data-pack-abd-source','');
    panel.className='card';
    panel.style.cssText='margin:10px 0 16px;padding:12px 16px;border-left:4px solid #2563eb';
    const title=d.createElement('strong');
    title.textContent=tr('pack.internal.abdSourceLabel')+' '+q(n.reference);
    panel.appendChild(title);
    const help=d.createElement('p');
    help.className='muted';
    help.textContent=tr('pack.internal.abdHelp');
    panel.appendChild(help);
    const status=d.createElement('p');
    status.setAttribute('data-pack-abd-save-status','');
    status.setAttribute('role','status');
    status.setAttribute('aria-live','polite');
    status.className='muted';
    status.hidden=true;
    panel.appendChild(status);
    const tools=d.createElement('div');
    tools.className='toolbar';
    const back=d.createElement('button');
    back.type='button';back.className='ghost';back.setAttribute('data-pack-abd-back','');
    back.textContent=tr('pack.internal.abdBack');tools.appendChild(back);
    const viewer=root.ExportHUBDocumentBlob1059,packUI=root.ExportHUBPackNotifications;
    arr(n.documents).forEach((file,i)=>{
      const verified=packUI&&typeof packUI.documentForViewer==='function'&&packUI.documentForViewer(file);
      if(!verified||!viewer||typeof viewer.open!=='function')return;
      const b=d.createElement('button');
      b.type='button';b.className='ghost';b.setAttribute('data-pack-abd-document',String(i));
      b.textContent=tr('pack.internal.abdDeliveryNote')+' '+q(file.name||file.fileName||('Dokument '+(i+1)));
      tools.appendChild(b);
    });
    panel.appendChild(tools);
    const head=host.querySelector('.rc626-head');
    if(head&&head.parentNode)head.parentNode.insertBefore(panel,head.nextSibling);
    else host.insertBefore(panel,host.firstChild);
    updateSaveStatus();
    return true;
  }
  function onClick(event){
    const target=event.target&&event.target.closest&&event.target.closest('[data-pack-abd-back],[data-pack-abd-document]');
    if(!target)return;
    const draft=state().abdDraft,n=notification(draft&&draft.packNotificationId);
    if(!n||!owned(draft,n))return;
    event.preventDefault();
    if(target.hasAttribute('data-pack-abd-back')){
      const ui=root.ExportHUBPackNotifications;
      if(typeof root.setView==='function')root.setView('packnotifications');
      if(ui&&typeof ui.openNotificationDetail==='function')ui.openNotificationDetail(n);
      return;
    }
    const i=Number(target.getAttribute('data-pack-abd-document'));
    const file=arr(n.documents)[i],ui=root.ExportHUBPackNotifications,viewer=root.ExportHUBDocumentBlob1059;
    const secured=ui&&typeof ui.documentForViewer==='function'&&ui.documentForViewer(file);
    if(!secured||!viewer||typeof viewer.open!=='function')return report(new Error('Dokument ist nicht verfügbar.'));
    Promise.resolve().then(()=>viewer.open(secured,{name:q(file.name||file.fileName)||'Lieferschein',download:false})).catch(report);
  }
  function install(){
    if(!root.addEventListener||!root.document)return false;
    root.addEventListener('exporthub:pack-create-abd',e=>begin(e&&e.detail&&e.detail.notificationId));
    for(const name of ['exporthub:rendered','exporthub:viewchange','exporthub:state-updated'])
      root.addEventListener(name,decorate);
    root.document.addEventListener('click',onClick);
    if(typeof root.MutationObserver==='function'){
      const observer=new root.MutationObserver(()=>decorate());
      const start=()=>{
        const host=root.document.getElementById('content')||root.document.querySelector('main');
        if(host)observer.observe(host,{childList:true,subtree:true});
      };
      if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});
      else start();
    }
    return true;
  }
  root.ExportHUBPackAbd=Object.freeze({begin,resolve,owned,rowsFromPack,decorate,canSave,confirmSave,saveStatusText,install});
  install();
})(typeof window!=='undefined'?window:globalThis);
