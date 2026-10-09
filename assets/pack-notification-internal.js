(function(root){
  'use strict';
  const q=value=>String(value==null?'':value).trim();
  const arr=value=>Array.isArray(value)?value:[];
  const esc=value=>q(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tr=(key,vars)=>{try{if(root.ExportHUBPackI18n&&typeof root.ExportHUBPackI18n.t==='function')return root.ExportHUBPackI18n.t(key,vars);}catch(_){}return key;};
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
  function packNotifications(state){return arr(state&&state.packNotifications).filter(item=>q(item&&item.id));}
  function findNotification(state,task){
    const sourceId=q(task&&task.sourceId),sourceRef=q(task&&task.sourceRef);
    return packNotifications(state).find(item=>(sourceId&&q(item.id)===sourceId)||(sourceRef&&q(item.reference)===sourceRef))||null;
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
  function detailFromNotification(notification,task){
    const n=notification||{};
    return{
      taskId:q(task&&task.id),notificationId:q(n.id),reference:q(n.reference||task&&task.sourceRef),
      customer:q(n.customer),stationName:q(n.packStationName||n.packStationId),createdAt:q(n.createdAt),
      packageType:q(n.packageType),packageCount:Number(n.packageCount)||0,totalWeight:Number(n.totalWeight)||0,
      packages:arr(n.packages).map(x=>({...x})),documents:arr(n.documents).map(x=>({...x})),note:q(n.note),
      status:q(n.status||task&&task.status||'new'),shipmentId:q(n.shipmentId)
    };
  }
  function detailModel(state,task){return detailFromNotification(findNotification(state,task)||{},task);}
  function inboxItems(state){
    return packNotifications(state).map(notification=>{
      const model=detailFromNotification(notification,null);
      return Object.assign({},model,{unread:q(notification.status).toLowerCase()==='new'});
    }).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function inboxUnreadCount(state){return inboxItems(state).filter(item=>item.unread).length;}
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
    try{const lang=root.ExportHUBPackI18n&&root.ExportHUBPackI18n.language?root.ExportHUBPackI18n.language():'de';const locale=({de:'de-DE',en:'en-GB',pl:'pl-PL',es:'es-ES',fr:'fr-FR',it:'it-IT'})[lang]||'de-DE';return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(d);}catch(_){return d.toLocaleString();}
  }
  function formatBytes(value){const n=Number(value)||0;if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`;}
  function statusLabel(value){
    const v=q(value).toLowerCase();
    const map={
      new:'pack.internal.status.new',
      in_review:'pack.internal.status.inReview',
      shipment_created:'pack.internal.status.shipmentCreated',
      registration_in_progress:'pack.internal.status.registrationInProgress',
      registered:'pack.internal.status.registered',
      ready_for_dispatch:'pack.internal.status.readyForDispatch',
      completed:'pack.internal.status.completed',
      cancelled:'pack.internal.status.cancelled'
    };
    return map[v]?tr(map[v]):q(value)||tr('pack.internal.status.new');
  }

  function taskById(state,id){return packTasks(state).find(task=>q(task.id)===q(id))||null;}
  function notificationById(state,id){return packNotifications(state).find(item=>q(item.id)===q(id))||null;}
  async function markNotificationOpened(notification){
    const state=sharedState(),now=new Date().toISOString(),id=q(notification&&notification.id);
    const live=notificationById(state,id);
    if(live&&q(live.status).toLowerCase()==='new'){live.status='in_review';live.updatedAt=now;}
    for(const task of packTasks(state)){if(q(task.sourceId)===id)markRead(state,q(task.id),now);}
    await persist('Packmeldung geöffnet');
    renderNavBadge();
  }
  async function markTaskOpened(task){const notification=findNotification(sharedState(),task);if(notification)await markNotificationOpened(notification);}
  function packageHtml(item,index){return `<div class="pack-internal-package"><strong>${esc(tr('pack.packageNumber',{number:Number(item&&item.packageNo)||index+1}))}</strong><span>${esc(item&&item.length)} × ${esc(item&&item.width)} × ${esc(item&&item.height)} ${esc(item&&item.unit||'cm')}</span></div>`;}
  function documentsHtml(model){
    if(!model.documents.length)return`<p class="pack-internal-empty">${esc(tr('pack.internal.noDeliveryNotes'))}</p>`;
    return model.documents.map((doc,index)=>{
      const url=documentUrl(doc),name=q(doc.name||doc.fileName||tr('pack.internal.deliveryNoteNumber',{number:index+1}));
      return `<div class="pack-internal-document"><div><strong>${esc(name)}</strong><small>${esc(formatBytes(doc.size))}</small></div><div class="pack-internal-document-actions">${url?`<button type="button" class="btn" data-pack-doc-open="${index}">${esc(tr('pack.internal.open'))}</button><button type="button" class="btn" data-pack-doc-download="${index}">${esc(tr('pack.internal.download'))}</button>`:`<span>${esc(tr('pack.internal.fileUnavailable'))}</span>`}</div></div>`;
    }).join('');
  }
  function detailHtml(model){
    return `<div class="pack-internal-shell">
      <header class="pack-internal-detail-head"><button type="button" class="btn" data-pack-action="back">${esc(tr('pack.internal.backToInbox'))}</button><div><span class="pack-internal-eyebrow">${esc(tr('pack.internal.eyebrow',{reference:model.reference}))}</span><h1>${esc(model.customer||tr('pack.title'))}</h1></div><span class="pack-internal-status" data-status="${esc(model.status)}">${esc(statusLabel(model.status))}</span></header>
      <div class="pack-internal-detail-grid">
        <article class="pack-internal-panel pack-internal-summary"><h2>${esc(tr('pack.internal.summary'))}</h2><dl><div><dt>${esc(tr('pack.internal.packages'))}</dt><dd>${esc(model.packageCount)} · ${esc(model.packageType)}</dd></div><div><dt>${esc(tr('pack.internal.totalWeight'))}</dt><dd>${esc(model.totalWeight)} kg</dd></div><div><dt>${esc(tr('pack.internal.station'))}</dt><dd>${esc(model.stationName||'–')}</dd></div><div><dt>${esc(tr('pack.internal.reported'))}</dt><dd>${esc(formatDate(model.createdAt))}</dd></div></dl></article>
        <article class="pack-internal-panel"><h2>${esc(tr('pack.dimensions'))}</h2><div class="pack-internal-packages">${model.packages.map(packageHtml).join('')||`<p class="pack-internal-empty">${esc(tr('pack.internal.noDimensions'))}</p>`}</div></article>
        <article class="pack-internal-panel pack-internal-documents"><h2>${esc(tr('pack.deliveryNotes'))}</h2>${documentsHtml(model)}</article>
        <article class="pack-internal-panel"><h2>${esc(tr('pack.note'))}</h2><p>${esc(model.note||tr('pack.internal.noNote'))}</p></article>
      </div>
      <footer class="pack-internal-detail-actions"><button type="button" class="btn" data-pack-action="back">${esc(tr('pack.internal.back'))}</button><button type="button" class="btn primary" data-pack-action="shipment">${esc(model.shipmentId?tr('pack.internal.openShipment'):tr('pack.internal.createShipment'))}</button></footer>
    </div>`;
  }
  function inboxCardHtml(model){
    return `<button type="button" class="pack-internal-task${model.unread?' is-unread':''}" data-pack-notification-id="${esc(model.notificationId)}"><span class="pack-internal-task-main"><strong>${esc(model.customer||tr('pack.title'))}</strong><small>${esc(model.reference)} · ${esc(model.stationName||tr('pack.internal.station'))} · ${esc(formatDate(model.createdAt))}</small></span><span class="pack-internal-task-metrics"><b>${esc(tr('pack.internal.metricPackages',{count:model.packageCount}))}</b><b>${esc(model.totalWeight)} kg</b><b>${esc(statusLabel(model.status))}</b>${model.unread?`<em>${esc(tr('pack.internal.status.new'))}</em>`:''}</span></button>`;
  }
  function openDocument(model,index,download){
    const doc=model.documents[Number(index)],url=documentUrl(doc);if(!url)return false;
    if(download&&root.document){const a=root.document.createElement('a');a.href=url;a.download=q(doc.name||doc.fileName||tr('pack.avis.deliveryNote'));a.rel='noopener';root.document.body.appendChild(a);a.click();a.remove();return true;}
    if(typeof root.open==='function'){root.open(url,'_blank','noopener');return true;}return false;
  }
  function dispatchShipment(model){
    try{if(typeof root.CustomEvent==='function'&&typeof root.dispatchEvent==='function'){root.dispatchEvent(new root.CustomEvent('exporthub:pack-create-shipment',{detail:{notificationId:model.notificationId,reference:model.reference,shipmentId:model.shipmentId}}));return true;}}catch(_){}
    return false;
  }
  function renderPackInbox(){
    const doc=root.document;if(!doc)return false;const host=doc.getElementById('content')||doc.querySelector('main');if(!host)return false;
    const items=inboxItems(sharedState());host.innerHTML='';
    const section=doc.createElement('section');section.id='packNotificationInbox';section.className='pack-internal-inbox';
    const summaryKey=items.length===1?'pack.internal.inboxSummaryOne':'pack.internal.inboxSummaryMany';
    section.innerHTML=`<div class="pack-internal-shell"><header class="pack-internal-inbox-head"><div><span class="pack-internal-eyebrow">${esc(tr('pack.internal.inboxEyebrow'))}</span><h1>${esc(tr('pack.internal.inboxTitle'))}</h1><p>${esc(tr(summaryKey,{count:items.length}))}</p></div><strong id="packNotificationBadge">${inboxUnreadCount(sharedState())}</strong></header>${items.length?`<div class="pack-internal-task-list">${items.map(inboxCardHtml).join('')}</div>`:`<div class="pack-internal-empty-state"><strong>${esc(tr('pack.internal.emptyTitle'))}</strong><span>${esc(tr('pack.internal.emptyText'))}</span></div>`}</div>`;
    section.addEventListener('click',event=>{const card=event.target&&event.target.closest&&event.target.closest('[data-pack-notification-id]');if(card){const notification=notificationById(sharedState(),card.getAttribute('data-pack-notification-id'));if(notification)openNotificationDetail(notification);}});
    host.appendChild(section);try{doc.body.setAttribute('data-exporthub-view','packnotifications');}catch(_){}renderNavBadge();return true;
  }
  function openNotificationDetail(notification){
    const doc=root.document;if(!doc||!notification)return false;const model=detailFromNotification(notification,null);if(!model.notificationId)return false;
    markNotificationOpened(notification).catch(()=>{});
    const host=doc.getElementById('content')||doc.querySelector('main');if(!host)return false;
    host.innerHTML='';const section=doc.createElement('section');section.id='packNotificationDetail';section.className='pack-internal-detail';section.innerHTML=detailHtml(model);
    section.addEventListener('click',event=>{const target=event.target&&event.target.closest&&event.target.closest('[data-pack-action],[data-pack-doc-open],[data-pack-doc-download]');if(!target)return;if(target.hasAttribute('data-pack-doc-open'))openDocument(model,target.getAttribute('data-pack-doc-open'),false);else if(target.hasAttribute('data-pack-doc-download'))openDocument(model,target.getAttribute('data-pack-doc-download'),true);else{const action=target.getAttribute('data-pack-action');if(action==='back')renderPackInbox();else if(action==='shipment')dispatchShipment(model);}});
    host.appendChild(section);try{doc.body.setAttribute('data-exporthub-view','packnotification');}catch(_){}return true;
  }
  function openTaskDetail(task){const notification=findNotification(sharedState(),task);if(!notification)return false;markTaskOpened(task).catch(()=>{});return openNotificationDetail(notification);}
  function currentView(){try{return q(root.document&&root.document.body&&root.document.body.getAttribute('data-exporthub-view')).toLowerCase()||q(sharedState().view).toLowerCase();}catch(_){return'';}}
  function ensurePackNav(){
    const doc=root.document;if(!doc||!doc.querySelector)return false;let node=doc.querySelector('[data-pack-notifications-nav]');if(node)return true;
    const anchor=doc.querySelector('[data-view="tasks"],[data-page="tasks"],[data-nav="tasks"]');if(!anchor||!anchor.parentNode)return false;
    node=anchor.cloneNode(false);node.removeAttribute('id');node.removeAttribute('data-view');node.removeAttribute('data-page');node.removeAttribute('data-nav');node.setAttribute('data-pack-notifications-nav','');node.setAttribute('aria-label',tr('pack.internal.inboxTitle'));
    if(node.tagName==='A')node.setAttribute('href','#packmeldungen');else if(node.tagName==='BUTTON')node.setAttribute('type','button');
    node.textContent=tr('pack.internal.inboxTitle');anchor.parentNode.insertBefore(node,anchor.nextSibling);return true;
  }
  function renderNavBadge(){
    const doc=root.document;if(!doc||!doc.querySelector)return 0;ensurePackNav();const node=doc.querySelector('[data-pack-notifications-nav]');if(!node)return 0;const count=inboxUnreadCount(sharedState());let badge=node.querySelector&&node.querySelector('.pack-internal-nav-badge');if(!count){if(badge)badge.remove();return 0;}if(!badge){badge=doc.createElement('span');badge.className='pack-internal-nav-badge';node.appendChild(badge);}badge.textContent=String(count);badge.setAttribute('aria-label',tr('pack.internal.newMessagesAria',{count}));return 1;
  }
  function findTaskFromNode(node){
    const state=sharedState(),direct=q(node&&node.getAttribute&&node.getAttribute('data-pack-task-id'));if(direct)return taskById(state,direct);
    const textContent=q(node&&node.textContent);return packTasks(state).find(task=>(q(task.sourceRef)&&textContent.includes(q(task.sourceRef)))||(q(task.title)&&textContent.includes(q(task.title))))||null;
  }
  function onClickCapture(event){
    const nav=event.target&&event.target.closest&&event.target.closest('[data-pack-notifications-nav]');if(nav){event.preventDefault();event.stopPropagation();if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();renderPackInbox();return;}
    const notificationNode=event.target&&event.target.closest&&event.target.closest('[data-pack-notification-id]');if(notificationNode){const notification=notificationById(sharedState(),notificationNode.getAttribute('data-pack-notification-id'));if(notification){event.preventDefault();event.stopPropagation();openNotificationDetail(notification);}return;}
    const target=event.target&&event.target.closest&&event.target.closest('[data-pack-task-id],.rc229-task-card.rc628-unified-task,.task-card,.index236-item');if(!target)return;
    const task=findTaskFromNode(target);if(!task)return;
    event.preventDefault();event.stopPropagation();if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();openTaskDetail(task);
  }
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{ensurePackNav();renderNavBadge();},40);}
  function refresh(){if(currentView()==='packnotifications')renderPackInbox();else scheduleRender();}
  function install(){
    const doc=root.document;if(!doc||doc.__packNotificationsInstalled)return false;doc.__packNotificationsInstalled=true;
    doc.addEventListener('click',onClickCapture,true);
    if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(scheduleRender);observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});}
    if(typeof root.addEventListener==='function'){['exporthub:tasks-updated','exporthub:state-updated','exporthub:view-changed','exporthub:pack-language-changed'].forEach(name=>root.addEventListener(name,refresh));}
    scheduleRender();return true;
  }

  root.ExportHUBPackNotifications=Object.freeze({isPackTask,packTasks,packNotifications,findNotification,unreadCount,markRead,detailModel,inboxItems,inboxUnreadCount,documentUrl,renderPackInbox,renderNavBadge,openNotificationDetail,openTaskDetail,ensurePackNav,install});
  install();
})(typeof window!=='undefined'?window:globalThis);
