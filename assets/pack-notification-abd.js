(function(root){
  'use strict';
  if(!root||root.ExportHUBPackAbd)return;
  const q=value=>String(value==null?'':value).trim();
  const arr=value=>Array.isArray(value)?value:[];
  const tr=key=>{try{const api=root.ExportHUBPackI18n;return api&&typeof api.t==='function'?api.t(key):key;}catch(_){return key;}};
  const number=value=>{const n=Number(value);return Number.isFinite(n)&&n>0?n:0;};
  let activeId='';

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
    const packages=arr(n&&n.packages);
    const groups=[];
    for(const part of packages){
      const type=q(part&&(part.packagingType||part.packageType||part.packaging));
      const count=Number(part&&part.count);
      const qty=Number.isInteger(count)&&count>0&&count<=999?count:1;
      const last=groups[groups.length-1];
      if(last&&last.type===type)last.count+=qty;
      else groups.push({type,count:qty,weight:''});
    }
    if(!groups.length){
      groups.push({type:q(n&&(n.packageType||n.packagingType)),count:Math.max(1,Math.trunc(number(n&&n.packageCount)||1)),weight:''});
    }
    const total=number(n&&n.totalWeight),pieces=groups.reduce((sum,g)=>sum+g.count,0);
    if(total&&pieces){
      let allocated=0;
      for(let i=0;i<groups.length;i++){
        const value=i===groups.length-1?Math.round((total-allocated)*10)/10:Math.round(total*groups[i].count/pieces*10)/10;
        groups[i].weight=value>0?String(value):'';
        allocated+=value;
      }
    }
    return groups.map((g,i)=>({id:'PACK-COLLI-'+(i+1),type:g.type,count:String(g.count),weight:g.weight}));
  }
  function report(error){
    const message=q(error&&error.message)||tr('pack.internal.abdOpenError');
    try{if(typeof root.alert==='function')root.alert(message);}catch(_){}
    return false;
  }
  function route(){
    if(typeof root.setView==='function'){root.setView('abd');return true;}
    if(root.ExportHUBRC325&&typeof root.ExportHUBRC325.route==='function'){
      root.ExportHUBRC325.route('abd','pack-abd');return true;
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
    if(host.querySelector('[data-pack-abd-source]'))return true;
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
  root.ExportHUBPackAbd=Object.freeze({begin,resolve,owned,rowsFromPack,decorate,install});
  install();
})(typeof window!=='undefined'?window:globalThis);
