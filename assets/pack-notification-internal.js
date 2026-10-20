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
      customer:q(n.customer),customerId:q(n.customerId),customerAccount:q(n.customerAccount),stationName:q(n.packStationName||n.packStationId),createdAt:q(n.createdAt),
      packageType:q(n.packageType),packageCount:Number(n.packageCount)||0,totalWeight:Number(n.totalWeight)||0,
      packages:arr(n.packages).map(x=>({...x})),documents:arr(n.documents).map(x=>({...x})),note:q(n.note),
      status:q(n.status||task&&task.status||'new'),shipmentId:q(n.shipmentId),
      deliveryNoteReference:q(n.deliveryNoteReference),cancelledAt:q(n.cancelledAt),editedAt:q(n.editedAt)
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
      const clean=root.ExportHUBClean,text=reason||'Packmeldung geändert';
      if(clean&&typeof clean.queueSave==='function'){
        const queued=await Promise.resolve(clean.queueSave(text));
        if(queued===false)return false;
      }
      const runtime=clean&&clean.runtime||null,target=runtime?Number(runtime.changeGeneration||0):0;
      if(runtime&&target>0&&Number(runtime.lastSavedGeneration||0)>=target)return true;
      if(clean&&typeof clean.flushSave==='function'){
        let flushed=await Promise.resolve(clean.flushSave(text));
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
  function isLocked(notification){return q(notification&&notification.status).toLowerCase()==='cancelled'||Boolean(q(notification&&notification.shipmentId));}
  function positiveNumber(value){const n=Number(String(value==null?'':value).replace(',','.'));return Number.isFinite(n)&&n>0?n:0;}
  function snapshot(items){return items.filter(Boolean).map(item=>({item,copy:JSON.parse(JSON.stringify(item))}));}
  function restore(saved){for(const {item,copy} of saved){for(const key of Object.keys(item))if(!(key in copy))delete item[key];Object.assign(item,copy);}}
  function sourceTasks(state,notificationId){return arr(state&&state.tasks).filter(task=>isPackTask(task)&&q(task.sourceId)===q(notificationId));}
  function applyEdit(state,notificationId,patch,at){
    const n=notificationById(state,notificationId);if(!n)return{ok:false,code:'notFound'};
    if(isLocked(n))return{ok:false,code:'locked'};
    const p=patch||{},count=Math.floor(Number(p.packageCount)),weight=positiveNumber(p.totalWeight);
    if(!(count>=1&&count<=999))return{ok:false,code:'packageCount'};
    if(!weight)return{ok:false,code:'totalWeight'};
    const incoming=arr(p.packages),existing=arr(n.packages),packages=[];
    for(let i=0;i<count;i+=1){
      const source=incoming[i]||{},base=existing[i]||existing[existing.length-1]||{unit:'cm'};
      const length=positiveNumber(source.length),width=positiveNumber(source.width),height=positiveNumber(source.height);
      if(!length||!width||!height)return{ok:false,code:'dimensions',packageNo:i+1};
      packages.push(Object.assign({},base,{packageNo:i+1,length,width,height,unit:q(base.unit)||'cm'}));
    }
    const when=q(at)||new Date().toISOString();
    n.deliveryNoteReference=q(p.deliveryNoteReference).slice(0,120);
    n.packageCount=count;n.totalWeight=weight;n.packages=packages;n.note=q(p.note).slice(0,2000);
    n.editedAt=when;n.updatedAt=when;
    return{ok:true,notification:n};
  }
  function cancelNotification(state,notificationId,at){
    const n=notificationById(state,notificationId);if(!n)return{ok:false,code:'notFound'};
    if(isLocked(n))return{ok:false,code:'locked'};
    const when=q(at)||new Date().toISOString();
    n.status='cancelled';n.cancelledAt=when;n.updatedAt=when;
    for(const task of sourceTasks(state,n.id)){task.status='cancelled';task.unread=false;if(!q(task.readAt))task.readAt=when;task.updatedAt=when;}
    return{ok:true,notification:n};
  }
  async function markNotificationOpened(notification){
    const state=sharedState(),now=new Date().toISOString(),id=q(notification&&notification.id);
    const live=notificationById(state,id),liveBefore=live?{status:live.status,updatedAt:live.updatedAt}:null,taskBefore=[];
    if(live&&q(live.status).toLowerCase()==='new'){live.status='in_review';live.updatedAt=now;}
    for(const task of packTasks(state)){
      if(q(task.sourceId)!==id)continue;
      taskBefore.push({task,unread:task.unread,readAt:task.readAt,updatedAt:task.updatedAt});
      markRead(state,q(task.id),now);
    }
    const saved=await persist('Packmeldung geöffnet');
    if(!saved){
      if(live&&liveBefore){live.status=liveBefore.status;if(liveBefore.updatedAt===undefined)delete live.updatedAt;else live.updatedAt=liveBefore.updatedAt;}
      for(const before of taskBefore){before.task.unread=before.unread;if(before.readAt===undefined)delete before.task.readAt;else before.task.readAt=before.readAt;if(before.updatedAt===undefined)delete before.task.updatedAt;else before.task.updatedAt=before.updatedAt;}
    }
    renderNavBadge();
    return saved;
  }
  async function markTaskOpened(task){const notification=findNotification(sharedState(),task);if(notification)await markNotificationOpened(notification);}
  const ICONS={
    box:'<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    weight:'<path d="M6 7h12l3 13H3L6 7Z"/><circle cx="12" cy="5" r="2"/>',
    station:'<path d="M3 10h18M5 10v10M19 10v10M8 6h8v4H8z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    file:'<path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>'
  };
  function icon(name){return `<svg class="pack-internal-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||''}</svg>`;}
  function packageHtml(item,index,model){
    const type=q(item&&(item.packagingType||item.packageType))||q(model&&model.packageType);
    return `<div class="pack-internal-package"><span class="pack-internal-package-no">${index+1}</span><span class="pack-internal-package-main"><strong>${esc(tr('pack.packageNumber',{number:Number(item&&item.packageNo)||index+1}))}</strong>${type?`<small>${esc(type)}</small>`:''}</span><span class="pack-internal-package-dims">${esc(item&&item.length)} × ${esc(item&&item.width)} × ${esc(item&&item.height)} ${esc(item&&item.unit||'cm')}</span></div>`;
  }
  function documentsHtml(model){
    if(!model.documents.length)return`<p class="pack-internal-empty">${esc(tr('pack.internal.noDeliveryNotes'))}</p>`;
    return model.documents.map((doc,index)=>{
      const url=documentUrl(doc),name=q(doc.name||doc.fileName||tr('pack.internal.deliveryNoteNumber',{number:index+1}));
      return `<div class="pack-internal-document"><span class="pack-internal-document-icon">${icon('file')}</span><div><strong>${esc(name)}</strong><small>${esc(formatBytes(doc.size))}</small></div><div class="pack-internal-document-actions">${url?`<button type="button" class="btn pack-internal-secondary" data-pack-doc-open="${index}">${esc(tr('pack.internal.open'))}</button><button type="button" class="btn pack-internal-secondary" data-pack-doc-download="${index}">${esc(tr('pack.internal.download'))}</button>`:`<span>${esc(tr('pack.internal.fileUnavailable'))}</span>`}</div></div>`;
    }).join('');
  }
  function customerIdentityHtml(model){
    const number=q(model.customerAccount||model.customerId);
    return `<div><dt>${esc(tr('shipment.customer'))}</dt><dd>${esc(model.customer||'–')}</dd></div>${number?`<div><dt>${esc(tr('shipment.customerNumber'))}</dt><dd>${esc(number)}</dd></div>`:''}`;
  }
  function factHtml(name,label,value){return `<div class="pack-internal-fact"><span class="pack-internal-fact-icon">${icon(name)}</span><span><small>${esc(label)}</small><strong>${esc(value)}</strong></span></div>`;}
  function detailHtml(model){
    const packages=`${model.packageCount}${model.packageType?` · ${model.packageType}`:''}`;
    return `<div class="pack-internal-shell">
      <header class="pack-internal-detail-head"><button type="button" class="btn pack-internal-ghost" data-pack-action="back">${esc(tr('pack.internal.backToInbox'))}</button><div><span class="pack-internal-eyebrow">${esc(tr('pack.internal.eyebrow',{reference:model.reference}))}</span><h1>${esc(model.customer||tr('pack.title'))}</h1></div><span class="pack-internal-status" data-status="${esc(model.status)}">${esc(statusLabel(model.status))}</span></header>
      <div class="pack-internal-facts">${factHtml('box',tr('pack.internal.packages'),packages)}${factHtml('weight',tr('pack.internal.totalWeight'),`${model.totalWeight} kg`)}${factHtml('station',tr('pack.internal.station'),model.stationName||'–')}${factHtml('clock',tr('pack.internal.reported'),formatDate(model.createdAt))}</div>
      <div class="pack-internal-detail-grid">
        <article class="pack-internal-panel pack-internal-summary"><h2>${esc(tr('pack.internal.summary'))}</h2><dl>${customerIdentityHtml(model)}<div><dt>${esc(tr('pack.internal.deliveryNoteReference'))}</dt><dd>${esc(model.deliveryNoteReference||'–')}</dd></div></dl></article>
        <article class="pack-internal-panel"><h2>${esc(tr('pack.dimensions'))}</h2><div class="pack-internal-packages">${model.packages.map((p,i)=>packageHtml(p,i,model)).join('')||`<p class="pack-internal-empty">${esc(tr('pack.internal.noDimensions'))}</p>`}</div></article>
        <article class="pack-internal-panel pack-internal-documents"><h2>${esc(tr('pack.deliveryNotes'))}</h2>${documentsHtml(model)}</article>
        <article class="pack-internal-panel pack-internal-note${model.note?' has-note':''}"><h2>${esc(tr('pack.note'))}</h2><p>${esc(model.note||tr('pack.internal.noNote'))}</p></article>
      </div>
      <footer class="pack-internal-detail-actions">${detailActionsHtml(model)}</footer>
    </div>`;
  }
  function detailActionsHtml(model){
    const cancelled=q(model.status).toLowerCase()==='cancelled',editable=!cancelled&&!model.shipmentId;
    const back=`<button type="button" class="btn pack-internal-ghost" data-pack-action="back">${esc(tr('pack.internal.back'))}</button>`;
    if(cancelled)return`${back}<span class="pack-internal-locked-hint">${esc(tr('pack.internal.cancelledHint'))}</span>`;
    const edit=editable?`<button type="button" class="btn pack-internal-danger" data-pack-action="cancel">${esc(tr('pack.internal.cancel'))}</button><button type="button" class="btn pack-internal-secondary" data-pack-action="edit">${esc(tr('pack.internal.edit'))}</button>`:'';
    return`${back}<span class="pack-internal-actions-spacer"></span>${edit}<button type="button" class="btn primary pack-internal-primary" data-pack-action="shipment">${esc(model.shipmentId?tr('pack.internal.openShipment'):tr('pack.internal.createShipment'))}</button>`;
  }
  function editRowsHtml(packages,count){
    const rows=[];
    for(let i=0;i<count;i+=1){
      const p=packages[i]||packages[packages.length-1]||{};
      const field=(dim,label)=>`<label><span>${esc(tr(label))}</span><input type="number" inputmode="decimal" min="0" step="0.1" data-pack-edit-dim="${dim}" value="${esc(p[dim])}"></label>`;
      rows.push(`<div class="pack-internal-edit-package" data-pack-edit-package="${i}"><strong>${esc(tr('pack.packageNumber',{number:i+1}))}</strong>${field('length','pack.lengthRequired')}${field('width','pack.widthRequired')}${field('height','pack.heightRequired')}</div>`);
    }
    return rows.join('');
  }
  function editHtml(model,draft,errorText){
    const d=draft||model,count=Math.max(1,Math.floor(Number(d.packageCount))||1);
    return `<div class="pack-internal-shell">
      <header class="pack-internal-detail-head"><button type="button" class="btn pack-internal-ghost" data-pack-action="edit-cancel">${esc(tr('pack.internal.backToDetail'))}</button><div><span class="pack-internal-eyebrow">${esc(tr('pack.internal.eyebrow',{reference:model.reference}))}</span><h1>${esc(tr('pack.internal.editTitle'))}</h1></div><span class="pack-internal-status" data-status="${esc(model.status)}">${esc(statusLabel(model.status))}</span></header>
      <form class="pack-internal-edit" data-pack-edit-form novalidate>
        ${errorText?`<p class="pack-internal-edit-error" role="alert">${esc(errorText)}</p>`:''}
        <article class="pack-internal-panel"><h2>${esc(tr('pack.internal.summary'))}</h2>
          <p class="pack-internal-edit-customer">${esc(tr('shipment.customer'))}: <strong>${esc(model.customer||'–')}</strong></p>
          <label><span>${esc(tr('pack.internal.deliveryNoteReference'))}</span><input type="text" maxlength="120" name="deliveryNoteReference" value="${esc(d.deliveryNoteReference)}"></label>
          <label><span>${esc(tr('pack.packageCountRequired'))}</span><input type="number" inputmode="numeric" min="1" max="999" step="1" name="packageCount" value="${esc(count)}"></label>
          <label><span>${esc(tr('pack.totalWeightRequired'))}</span><input type="number" inputmode="decimal" min="0" step="0.1" name="totalWeight" value="${esc(d.totalWeight)}"></label>
        </article>
        <article class="pack-internal-panel"><h2>${esc(tr('pack.dimensions'))}</h2><div class="pack-internal-edit-packages">${editRowsHtml(arr(d.packages),count)}</div></article>
        <article class="pack-internal-panel"><h2>${esc(tr('pack.note'))}</h2><label><textarea aria-label="${esc(tr('pack.note'))}" name="note" maxlength="2000" rows="4">${esc(d.note)}</textarea></label></article>
      </form>
      <footer class="pack-internal-detail-actions"><span class="pack-internal-actions-spacer"></span><button type="button" class="btn pack-internal-secondary" data-pack-action="edit-cancel">${esc(tr('pack.internal.discard'))}</button><button type="button" class="btn primary pack-internal-primary" data-pack-action="edit-save">${esc(tr('pack.internal.save'))}</button></footer>
    </div>`;
  }
  function collectEditForm(section){
    const form=section&&section.querySelector&&section.querySelector('[data-pack-edit-form]');if(!form)return null;
    const value=name=>{const el=form.querySelector(`[name="${name}"]`);return el?el.value:'';};
    const packages=Array.from(form.querySelectorAll('[data-pack-edit-package]')).map(row=>{const dim=name=>{const el=row.querySelector(`[data-pack-edit-dim="${name}"]`);return el?el.value:'';};return{length:dim('length'),width:dim('width'),height:dim('height')};});
    return{deliveryNoteReference:value('deliveryNoteReference'),packageCount:value('packageCount'),totalWeight:value('totalWeight'),note:value('note'),packages};
  }
  function editErrorText(result){
    const code=result&&result.code;
    if(code==='dimensions')return tr('pack.internal.editError.dimensions',{number:result.packageNo});
    if(code==='packageCount'||code==='totalWeight'||code==='locked'||code==='notFound')return tr(`pack.internal.editError.${code}`);
    return tr('pack.internal.saveFailed');
  }
  async function saveEdit(notificationId,patch){
    const state=sharedState(),live=notificationById(state,notificationId);if(!live)return{ok:false,code:'notFound'};
    const saved=snapshot([live]),result=applyEdit(state,notificationId,patch,new Date().toISOString());
    if(!result.ok)return result;
    if(!await persist('Packmeldung bearbeitet')){restore(saved);return{ok:false,code:'persist'};}
    return result;
  }
  async function cancelAndPersist(notificationId){
    const state=sharedState(),live=notificationById(state,notificationId);if(!live)return{ok:false,code:'notFound'};
    const saved=snapshot([live,...sourceTasks(state,notificationId)]),result=cancelNotification(state,notificationId,new Date().toISOString());
    if(!result.ok)return result;
    if(!await persist('Packmeldung storniert')){restore(saved);return{ok:false,code:'persist'};}
    renderNavBadge();return result;
  }
  function inboxCardHtml(model){
    return `<button type="button" class="pack-internal-task${model.unread?' is-unread':''}" data-pack-notification-id="${esc(model.notificationId)}" data-status="${esc(model.status)}"><span class="pack-internal-task-main"><strong>${esc(model.customer||tr('pack.title'))}</strong><small>${esc(model.reference)} · ${esc(model.stationName||tr('pack.internal.station'))} · ${esc(formatDate(model.createdAt))}</small></span><span class="pack-internal-task-metrics"><b>${icon('box')}${esc(tr('pack.internal.metricPackages',{count:model.packageCount}))}</b><b>${icon('weight')}${esc(model.totalWeight)} kg</b></span><span class="pack-internal-status" data-status="${esc(model.status)}">${esc(statusLabel(model.status))}</span><span class="pack-internal-task-chevron" aria-hidden="true">›</span></button>`;
  }
  function inboxOverviewHtml(items){
    const counts=new Map();for(const item of items){const key=q(item.status).toLowerCase()||'new';counts.set(key,(counts.get(key)||0)+1);}
    return `<div class="pack-internal-overview">${Array.from(counts).map(([status,count])=>`<span class="pack-internal-status" data-status="${esc(status)}">${esc(statusLabel(status))}<b>${count}</b></span>`).join('')}</div>`;
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
    section.innerHTML=`<div class="pack-internal-shell"><header class="pack-internal-inbox-head"><div><span class="pack-internal-eyebrow">${esc(tr('pack.internal.inboxEyebrow'))}</span><h1>${esc(tr('pack.internal.inboxTitle'))}</h1><p>${esc(tr(summaryKey,{count:items.length}))}</p></div>${items.length?inboxOverviewHtml(items):''}</header>${items.length?`<div class="pack-internal-task-list">${items.map(inboxCardHtml).join('')}</div>`:`<div class="pack-internal-empty-state"><strong>${esc(tr('pack.internal.emptyTitle'))}</strong><span>${esc(tr('pack.internal.emptyText'))}</span></div>`}</div>`;
    section.addEventListener('click',event=>{const card=event.target&&event.target.closest&&event.target.closest('[data-pack-notification-id]');if(card){const notification=notificationById(sharedState(),card.getAttribute('data-pack-notification-id'));if(notification)openNotificationDetail(notification);}});
    host.appendChild(section);try{doc.body.setAttribute('data-exporthub-view','packnotifications');}catch(_){}renderNavBadge();return true;
  }
  function openNotificationDetail(notification){
    const doc=root.document;if(!doc||!notification)return false;const model=detailFromNotification(notification,null);if(!model.notificationId)return false;
    markNotificationOpened(notification).catch(()=>{});
    const host=doc.getElementById('content')||doc.querySelector('main');if(!host)return false;
    host.innerHTML='';const section=doc.createElement('section');section.id='packNotificationDetail';section.className='pack-internal-detail';section.innerHTML=detailHtml(model);
    let busy=false;
    const showEdit=(draft,errorText)=>{section.innerHTML=editHtml(model,draft,errorText);};
    const reopen=()=>{const fresh=notificationById(sharedState(),model.notificationId);if(fresh)openNotificationDetail(fresh);};
    section.addEventListener('change',event=>{const target=event.target;if(!target||target.getAttribute('name')!=='packageCount')return;const draft=collectEditForm(section);if(draft)showEdit(draft,'');});
    section.addEventListener('click',async event=>{
      const target=event.target&&event.target.closest&&event.target.closest('[data-pack-action],[data-pack-doc-open],[data-pack-doc-download]');if(!target)return;
      if(target.hasAttribute('data-pack-doc-open')){openDocument(model,target.getAttribute('data-pack-doc-open'),false);return;}
      if(target.hasAttribute('data-pack-doc-download')){openDocument(model,target.getAttribute('data-pack-doc-download'),true);return;}
      const action=target.getAttribute('data-pack-action');
      if(action==='back')renderPackInbox();
      else if(action==='shipment')dispatchShipment(model);
      else if(action==='edit')showEdit(null,'');
      else if(action==='edit-cancel')reopen();
      else if(action==='edit-save'){if(busy)return;busy=true;const draft=collectEditForm(section);const result=await saveEdit(model.notificationId,draft);busy=false;if(result.ok)reopen();else showEdit(draft,editErrorText(result));}
      else if(action==='cancel'){if(busy)return;if(typeof root.confirm==='function'&&!root.confirm(tr('pack.internal.cancelConfirm',{reference:model.reference})))return;busy=true;const result=await cancelAndPersist(model.notificationId);busy=false;if(result.ok)reopen();else if(typeof root.alert==='function')root.alert(editErrorText(result));}
    });
    host.appendChild(section);try{doc.body.setAttribute('data-exporthub-view','packnotification');}catch(_){}return true;
  }
  function openTaskDetail(task){const notification=findNotification(sharedState(),task);if(!notification)return false;return openNotificationDetail(notification);}
  function currentView(){try{return q(root.document&&root.document.body&&root.document.body.getAttribute('data-exporthub-view')).toLowerCase()||q(sharedState().view).toLowerCase();}catch(_){return'';}}
  function renderNavBadge(){
    const doc=root.document;if(!doc||!doc.querySelector)return 0;const node=doc.querySelector('[data-pack-notifications-nav]');if(!node)return 0;const count=inboxUnreadCount(sharedState());let badge=node.querySelector&&node.querySelector('.pack-internal-nav-badge');if(!count){if(badge)badge.remove();return 0;}if(!badge){badge=doc.createElement('span');badge.className='pack-internal-nav-badge';node.appendChild(badge);}badge.textContent=String(count);badge.setAttribute('aria-label',tr('pack.internal.newMessagesAria',{count}));return 1;
  }
  function findTaskFromNode(node){
    const state=sharedState(),direct=q(node&&node.getAttribute&&node.getAttribute('data-pack-task-id'));if(direct)return taskById(state,direct);
    const textContent=q(node&&node.textContent);return packTasks(state).find(task=>(q(task.sourceRef)&&textContent.includes(q(task.sourceRef)))||(q(task.title)&&textContent.includes(q(task.title))))||null;
  }
  function onClickCapture(event){
    const notificationNode=event.target&&event.target.closest&&event.target.closest('[data-pack-notification-id]');if(notificationNode){const notification=notificationById(sharedState(),notificationNode.getAttribute('data-pack-notification-id'));if(notification){event.preventDefault();event.stopPropagation();openNotificationDetail(notification);}return;}
    const target=event.target&&event.target.closest&&event.target.closest('[data-pack-task-id],.rc229-task-card.rc628-unified-task,.task-card,.index236-item');if(!target)return;
    const task=findTaskFromNode(target);if(!task)return;
    event.preventDefault();event.stopPropagation();if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();openTaskDetail(task);
  }
  function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(renderNavBadge,40);}
  function refresh(){if(currentView()==='packnotifications')renderPackInbox();else scheduleRender();}
  function install(){
    const doc=root.document;if(!doc||doc.__packNotificationsInstalled)return false;doc.__packNotificationsInstalled=true;
    doc.addEventListener('click',onClickCapture,true);
    if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(scheduleRender);observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});}
    if(typeof root.addEventListener==='function'){['exporthub:tasks-updated','exporthub:state-updated','exporthub:view-changed','exporthub:pack-language-changed'].forEach(name=>root.addEventListener(name,refresh));}
    scheduleRender();return true;
  }

  root.ExportHUBPackNotifications=Object.freeze({isPackTask,packTasks,packNotifications,findNotification,unreadCount,markRead,detailModel,isLocked,applyEdit,cancelNotification,detailHtml,editHtml,inboxItems,inboxUnreadCount,documentUrl,renderPackInbox,renderNavBadge,openNotificationDetail,openTaskDetail,install});
  install();
})(typeof window!=='undefined'?window:globalThis);