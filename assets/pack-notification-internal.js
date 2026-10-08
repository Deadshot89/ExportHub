(function(root){
  'use strict';
  const q=value=>String(value==null?'':value).trim();
  const arr=value=>Array.isArray(value)?value:[];
  const esc=value=>q(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let renderTimer=0;
  let observer=null;

  function sharedState(){
    try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{};}catch(_){}
    try{if(root.ExportHUBState&&typeof root.ExportHUBState.get==='function')return root.ExportHUBState.get()||{};}catch(_){}
    return root.__EXPORTHUB_STATE__||root.state||{};
  }
  function isPackTask(task){return q(task&&task.sourceType).toLowerCase()==='pack_notification';}
  function packTasks(state){
    const seen=new Set(),out=[];
    for(const task of arr(state&&state.tasks)){
      if(!isPackTask(task))continue;
      const key=q(task.id||task.sourceId||task.sourceRef);
      if(!key||seen.has(key))continue;
      seen.add(key);out.push(task);
    }
    return out;
  }
  function findNotification(state,task){
    const sourceId=q(task&&task.sourceId),sourceRef=q(task&&task.sourceRef);
    return arr(state&&state.packNotifications).find(item=>
      (sourceId&&q(item&&item.id)===sourceId)||(sourceRef&&q(item&&item.reference)===sourceRef)
    )||null;
  }
  function unreadCount(state){
    const seen=new Set();let count=0;
    for(const task of packTasks(state)){
      const key=q(task.id||task.sourceId||task.sourceRef);
      if(seen.has(key))continue;seen.add(key);
      if(task.unread!==false&&!q(task.readAt)&&!['done','cancelled'].includes(q(task.status).toLowerCase()))count++;
    }
    return count;
  }
  function markRead(state,taskId,at){
    const when=q(at)||new Date().toISOString(),id=q(taskId);
    for(const task of arr(state&&state.tasks)){
      if(q(task&&task.id)!==id)continue;
      task.unread=false;task.readAt=when;task.updatedAt=when;
    }
    return state;
  }
  function detailModel(state,task){
    const notification=findNotification(state,task)||{};
    return{
      taskId:q(task&&task.id),notificationId:q(notification.id),reference:q(notification.reference||task&&task.sourceRef),
      customer:q(notification.customer),stationName:q(notification.packStationName||notification.packStationId),createdAt:q(notification.createdAt),
      deliveryNoteReference:q(notification.deliveryNoteReference),packageType:q(notification.packageType),packageCount:Number(notification.packageCount)||0,
      totalWeight:Number(notification.totalWeight)||0,packages:arr(notification.packages).map(x=>({...x})),documents:arr(notification.documents).map(x=>({...x})),
      note:q(notification.note),status:q(notification.status||task&&task.status||'new'),shipmentId:q(notification.shipmentId)
    };
  }
  async function persist(reason){
    try{
      const clean=root.ExportHUBClean;
      if(clean&&typeof clean.queueSave==='function')await Promise.resolve(clean.queueSave(reason||'Packmeldung geändert'));
      if(clean&&typeof clean.flushSave==='function')await Promise.resolve(clean.flushSave(reason||'Packmeldung geändert'));
      return true;
    }catch(_){return false;}
  }
  function environment(){
    const state=sharedState();
    return q(state.environment||root.__EXPORTHUB_FORCED_ENVIRONMENT__).toLowerCase()==='testservice'?'testservice':'production';
  }
  function documentUrl(doc){
    const blob=q(doc&&doc.blobName);if(!blob)return'';
    return `/api/exporthub-document?blob=${encodeURIComponent(blob)}&environment=${encodeURIComponent(environment())}`;
  }
  function formatDate(value){
    const d=new Date(value);if(Number.isNaN(d.getTime()))return q(value)||'–';
    try{return new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(d);}catch(_){return d.toLocaleString();}
  }
  function formatBytes(value){const n=Number(value)||0;if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`;}
  function statusLabel(value){const v=q(value).toLowerCase();return({new:'Neu',in_review:'In Prüfung',shipment_created:'Sendung erstellt',registration_in_progress:'Anmeldung läuft',registered:'Angemeldet',ready_for_dispatch:'Versandbereit',completed:'Abgeschlossen',cancelled:'Storniert'})[v]||q(value)||'Neu';}

  function taskById(state,id){return packTasks(state).find(task=>q(task.id)===q(id))||null;}
  async function markTaskOpened(task){
    const state=sharedState(),now=new Date().toISOString();
    markRead(state,q(task&&task.id),now);
    const notification=findNotification(state,task);
    if(notification&&q(notification.status).toLowerCase()==='new'){notification.status='in_review';notification.updatedAt=now;}
    await persist('Packmeldung geöffnet');
    renderNavBadge();
  }
  function packageHtml(item,index){return `<div class="pack-internal-package"><strong>Packstück ${Number(item&&item.packageNo)||index+1}</strong><span>${esc(item&&item.length)} × ${esc(item&&item.width)} × ${esc(item&&item.height)} ${esc(item&&item.unit||'cm')}</span></div>`;}
  function documentsHtml(model){
    if(!model.documents.length)return'<p class="pack-internal-empty">Keine Lieferscheine vorhanden.</p>';
    return model.documents.map((doc,index)=>{
      const url=documentUrl(doc),name=q(doc.name||doc.fileName||`Lieferschein ${index+1}`);
      return `<div class="pack-internal-document"><div><strong>${esc(name)}</strong><small>${esc(formatBytes(doc.size))}</small></div><div class="pack-internal-document-actions">${url?`<button type="button" class="btn" data-pack-doc-open="${index}">Öffnen</button><button type="button" class="btn" data-pack-doc-download="${index}">Download</button>`:'<span>Datei nicht verfügbar</span>'}</div></div>`;
    }).join('');
  }
  function detailHtml(model){
    return `<div class="pack-internal-shell">
      <header class="pack-internal-detail-head"><button type="button" class="btn" data-pack-action="back">← Aufgaben</button><div><span class="pack-internal-eyebrow">Packmeldung · ${esc(model.reference)}</span><h1>${esc(model.customer||'Packmeldung')}</h1></div><span class="pack-internal-status" data-status="${esc(model.status)}">${esc(statusLabel(model.status))}</span></header>
      <div class="pack-internal-detail-grid">
        <article class="pack-internal-panel pack-internal-summary"><h2>Versanddaten</h2><dl><div><dt>Lieferschein / Referenz</dt><dd>${esc(model.deliveryNoteReference||'–')}</dd></div><div><dt>Packstücke</dt><dd>${esc(model.packageCount)} · ${esc(model.packageType)}</dd></div><div><dt>Gesamtgewicht</dt><dd>${esc(model.totalWeight)} kg</dd></div><div><dt>Packtisch</dt><dd>${esc(model.stationName||'–')}</dd></div><div><dt>Gemeldet</dt><dd>${esc(formatDate(model.createdAt))}</dd></div></dl></article>
        <article class="pack-internal-panel"><h2>Maße</h2><div class="pack-internal-packages">${model.packages.map(packageHtml).join('')||'<p class="pack-internal-empty">Keine Maße vorhanden.</p>'}</div></article>
        <article class="pack-internal-panel pack-internal-documents"><h2>Lieferscheine</h2>${documentsHtml(model)}</article>
        <article class="pack-internal-panel"><h2>Bemerkung</h2><p>${esc(model.note||'Keine Bemerkung.')}</p></article>
      </div>
      <footer class="pack-internal-detail-actions"><button type="button" class="btn" data-pack-action="back">Zurück</button><button type="button" class="btn primary" data-pack-action="shipment">${model.shipmentId?'Sendung öffnen':'Sendung erstellen'}</button></footer>
    </div>`;
  }
  function openDocument(model,index,download){
    const doc=model.documents[Number(index)],url=documentUrl(doc);if(!url)return false;
    if(download&&root.document){const a=root.document.createElement('a');a.href=url;a.download=q(doc.name||doc.fileName||'Lieferschein');a.rel='noopener';root.document.body.appendChild(a);a.click();a.remove();return true;}
    if(typeof root.open==='function'){root.open(url,'_blank','noopener');return true;}return false;
  }
  function backToTasks(){try{if(typeof root.setView==='function'){root.setView('tasks');scheduleRender();return true;}}catch(_){}return false;}
  function dispatchShipment(model){
    try{if(typeof root.CustomEvent==='function'&&typeof root.dispatchEvent==='function'){root.dispatchEvent(new root.CustomEvent('exporthub:pack-create-shipment',{detail:{notificationId:model.notificationId,reference:model.reference,shipmentId:model.shipmentId}}));return true;}}catch(_){}
    return false;
  }
  function openTaskDetail(task){
    const doc=root.document,state=sharedState();if(!doc||!isPackTask(task))return false;
    const model=detailModel(state,task);if(!model.notificationId)return false;
    markTaskOpened(task).catch(()=>{});
    const host=doc.getElementById('content')||doc.querySelector('main');if(!host)return false;
    host.innerHTML='';const section=doc.createElement('section');section.id='packNotificationDetail';section.className='pack-internal-detail';section.innerHTML=detailHtml(model);
    section.addEventListener('click',event=>{const target=event.target&&event.target.closest&&event.target.closest('[data-pack-action],[data-pack-doc-open],[data-pack-doc-download]');if(!target)return;if(target.hasAttribute('data-pack-doc-open'))openDocument(model,target.getAttribute('data-pack-doc-open'),false);else if(target.hasAttribute('data-pack-doc-download'))openDocument(model,target.getAttribute('data-pack-doc-download'),true);else{const action=target.getAttribute('data-pack-action');if(action==='back')backToTasks();else if(action==='shipment')dispatchShipment(model);}});
    host.appendChild(section);try{doc.body.setAttribute('data-exporthub-view','packnotification');}catch(_){}return true;
  }
  function cardHtml(task,state){
    const m=detailModel(state,task),unread=task.unread!==false&&!q(task.readAt);
    return `<button type="button" class="pack-internal-task${unread?' is-unread':''}" data-pack-task-id="${esc(task.id)}"><span class="pack-internal-task-main"><strong>${esc(task.title||`Neue Packmeldung · ${m.customer}`)}</strong><small>${esc(m.reference)} · ${esc(m.stationName||'Packtisch')} · ${esc(formatDate(m.createdAt))}</small></span><span class="pack-internal-task-metrics"><b>${esc(m.packageCount)} Packstücke</b><b>${esc(m.totalWeight)} kg</b>${unread?'<em>Neu</em>':''}</span></button>`;
  }
  function currentView(){try{return q(root.document&&root.document.body&&root.document.body.getAttribute('data-exporthub-view')).toLowerCase()||q(sharedState().view).toLowerCase();}catch(_){return'';}}
  function renderTaskSection(){
    const doc=root.document;if(!doc||!doc.getElementById)return false;const existing=doc.getElementById('packNotificationTaskSection');
    if(currentView()!=='tasks'){if(existing&&existing.parentNode)existing.remove();return false;}
    const state=sharedState(),tasks=packTasks(state).filter(t=>!['done','cancelled'].includes(q(t.status).toLowerCase()));
    const host=doc.getElementById('content');if(!host)return false;
    if(!tasks.length){if(existing)existing.remove();renderNavBadge();return false;}
    let section=existing;if(!section){section=doc.createElement('section');section.id='packNotificationTaskSection';section.className='pack-internal-task-section';host.prepend(section);}
    const unread=unreadCount(state);section.innerHTML=`<div class="pack-internal-section-head"><div><span>Packtisch Eingang</span><h2>Packmeldungen</h2></div><strong id="packNotificationBadge">${unread||tasks.length}</strong></div><div class="pack-internal-task-list">${tasks.map(task=>cardHtml(task,state)).join('')}</div>`;
    renderNavBadge();return true;
  }
  function renderNavBadge(){
    const doc=root.document;if(!doc||!doc.querySelectorAll)return 0;const count=unreadCount(sharedState());let changed=0;
    const candidates=doc.querySelectorAll('[data-view="tasks"],[data-page="tasks"],[data-nav="tasks"]');
    candidates.forEach(node=>{let badge=node.querySelector&&node.querySelector('.pack-internal-nav-badge');if(!count){if(badge)badge.remove();return;}if(!badge){badge=doc.createElement('span');badge.className='pack-internal-nav-badge';node.appendChild(badge);}badge.textContent=String(count);badge.setAttribute('aria-label',`${count} neue Packmeldungen`);changed++;});return changed;
  }
  function findTaskFromNode(node){
    const state=sharedState(),direct=q(node&&node.getAttribute&&node.getAttribute('data-pack-task-id'));if(direct)return taskById(state,direct);
    const textContent=q(node&&node.textContent);return packTasks(state).find(task=>q(task.sourceRef)&&textContent.includes(q(task.sourceRef))||q(task.title)&&textContent.includes(q(task.title)))||null;
  }
  function onClickCapture(event){
    const target=event.target&&event.target.closest&&event.target.closest('[data-pack-task-id],.rc229-task-card.rc628-unified-task,.task-card,.index236-item');if(!target)return;
    const task=findTaskFromNode(target);if(!task)return;
    event.preventDefault();event.stopPropagation();if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();openTaskDetail(task);
  }
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{renderTaskSection();renderNavBadge();},40);}
  function install(){
    const doc=root.document;if(!doc||doc.__packNotificationsInstalled)return false;doc.__packNotificationsInstalled=true;
    doc.addEventListener('click',onClickCapture,true);
    if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(scheduleRender);observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});}
    if(typeof root.addEventListener==='function'){['exporthub:tasks-updated','exporthub:state-updated','exporthub:view-changed'].forEach(name=>root.addEventListener(name,scheduleRender));}
    scheduleRender();return true;
  }

  root.ExportHUBPackNotifications=Object.freeze({isPackTask,packTasks,findNotification,unreadCount,markRead,detailModel,documentUrl,renderTaskSection,renderNavBadge,openTaskDetail,install});
  install();
})(typeof window!=='undefined'?window:globalThis);
