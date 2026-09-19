(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const CARD_SELECTOR='.rc229-task-card.rc628-unified-task, .task-card';
  let lastTasks=[];
  let lastContext={};
  let enhanceTimer=0;
  let lazyCardObserver=null;
  let taskResetTimer=0;
  let taskResetInFlight=false;
  let lastOpenTaskId='';

  const MANAGED_TASKS=Object.freeze([
    {key:'spanien',title:'Spanien anmelden',group:'Anmeldung',weekdays:[1],priority:'P3',description:'Spanien montags anmelden.'},
    {key:'wuerth-industrie',title:'Würth Industrie anmelden',group:'Anmeldung',weekdays:[2,4],priority:'P3',description:'Würth Industrie dienstags und donnerstags anmelden.'},
    {key:'bmp',title:'BMP anmelden',group:'Anmeldung',weekdays:[2],priority:'P3',description:'BMP dienstags anmelden.'},
    {key:'ohare',title:'O’Hare anmelden',group:'Anmeldung',weekdays:[3],dueTime:'12:00',priority:'P2',description:'O’Hare mittwochs bis 12:00 Uhr anmelden.'},
    {key:'essentra-schweden',title:'Essentra Schweden anmelden',group:'Anmeldung',weekdays:[3],priority:'P3',description:'Essentra Schweden mittwochs anmelden.'},
    {key:'contitech-abd',title:'Contitech – ABD erstellen',group:'Export / ABD',weekdays:[3],priority:'P2',description:'Für Contitech mittwochs das erforderliche ABD erstellen.'},
    {key:'swiss-area',title:'Schweizer Kunden prüfen',group:'Schweizer Kunden prüfen',referenceArea:true,priority:'P3',description:'Prüfen, ob für die Schweizer Sendungen ein ABD erstellt werden muss.',checklist:['Omni Ray','Bossard','Heizmann']}
  ]);
  const SYSTEM_GROUPS=new Set(['Offene Sendungen','Fehlende POD','Kunde angemeldet','Picks','Offene ABDs']);

  function api(){
    const value=root.ExportHUBRC1014Tasks;
    if(!value||typeof value.normalizeTask!=='function')throw new Error('RC1014 Aufgaben-Lifecycle ist nicht geladen.');
    return value;
  }

  function currentUserId(ctx){
    const u=(ctx&&ctx.currentUser)||{};
    return q((ctx&&ctx.currentUserId)||u.id||u.userId||u.username||u.login||u.name);
  }

  function taskContext(ctx={}){
    return {companyId:q(ctx.companyId),environment:q(ctx.environment),currentUserId:currentUserId(ctx),now:ctx.now,absences:arr(ctx.absences||(ctx.state&&ctx.state.absences))};
  }

  function localDay(value){
    const d=value instanceof Date?value:new Date(value||Date.now());
    if(Number.isNaN(d.getTime()))return null;
    return {date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,weekday:d.getDay()};
  }

  function managedTaskForSpec(spec,date,ctx={}){
    const user=currentUserId(ctx);
    const dueAt=spec.referenceArea?'':(date+(spec.dueTime?`T${spec.dueTime}:00`:''));
    return {
      id:spec.referenceArea?`managed:${spec.key}`:`managed:${spec.key}:${date}`,
      managedBy:'RC1152',
      managedKey:spec.key,
      managedKind:spec.referenceArea?'reference-area':'recurring',
      title:spec.title,
      group:spec.group,
      area:spec.group,
      sourceType:'manual',
      sourceId:`managed:${spec.key}`,
      sourceRef:'',
      manual:true,
      priority:spec.priority||'P3',
      dueAt,
      dueDate:dueAt,
      occurrenceKey:spec.referenceArea?'reference':date,
      status:'open',
      assignedTo:user,
      owner:user,
      originalAssignee:user,
      effectiveAssignee:user,
      companyId:q(ctx.companyId),
      environment:q(ctx.environment),
      description:spec.description||'',
      checklist:arr(spec.checklist),
      recurrenceLabel:spec.referenceArea?'Bereich':weekdayLabel(spec.weekdays,spec.dueTime),
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
  }

  function weekdayLabel(days,time){
    const names={1:'Montag',2:'Dienstag',3:'Mittwoch',4:'Donnerstag',5:'Freitag'};
    const label=arr(days).map(d=>names[d]||'').filter(Boolean).join(' + ');
    return label+(time?` · bis ${time} Uhr`:'');
  }

  function hasShipmentLink(task){
    if(!task)return false;
    const ref=q(task.linkedShipmentRef||task.shipmentRef||task.reference||task.ref||task.sourceRef);
    const id=q(task.linkedShipmentId||task.shipmentId);
    if(id||/^[A-Z0-9]{6}$/.test(ref.toUpperCase()))return true;
    const type=q(task.sourceType).toLowerCase();
    return SYSTEM_GROUPS.has(q(task.group))&&type!=='manual';
  }

  function sourceRefs(task){
    return [q(task&&task.linkedShipmentId),q(task&&task.shipmentId),q(task&&task.sourceId),q(task&&task.linkedShipmentRef),q(task&&task.shipmentRef),q(task&&task.sourceRef),q(task&&task.reference),q(task&&task.ref)].filter(Boolean);
  }

  function sourceMatches(item,refs){
    if(!item||!refs.length)return false;
    const values=[q(item.id),q(item.shipmentId),q(item.pickId),q(item.sourceId),q(item.ref),q(item.reference),q(item.shipmentRef),q(item.sourceRef)].filter(Boolean);
    return values.some(value=>refs.includes(value));
  }

  function systemTaskIsCurrent(task,state={}){
    const group=q(task&&task.group),type=q(task&&task.sourceType).toLowerCase();
    if(!SYSTEM_GROUPS.has(group)||type==='manual')return true;
    const refs=sourceRefs(task);
    if(!refs.length)return false;
    if(group==='Picks'){
      const picks=arr(state.picks).concat(arr(state.openPicks),arr(state.pickTasks));
      return picks.some(item=>sourceMatches(item,refs));
    }
    const shipments=arr(state.shipments).concat(arr(state.savedShipments));
    return shipments.some(item=>sourceMatches(item,refs));
  }

  function addTaskTombstones(state,removed){
    if(!state||!removed.length)return;
    if(!state._teamSyncMeta||typeof state._teamSyncMeta!=='object'||Array.isArray(state._teamSyncMeta))state._teamSyncMeta={fields:{},tombstones:[]};
    if(!Array.isArray(state._teamSyncMeta.tombstones))state._teamSyncMeta.tombstones=[];
    const existing=new Set(state._teamSyncMeta.tombstones.map(t=>`${q(t&&t.collection).toLowerCase()}:${q(t&&t.id).toLowerCase()}`));
    const at=new Date().toISOString();
    removed.forEach((task,index)=>{
      const id=q(task&&task.id);
      if(!id)return;
      const key=`tasks:${id.toLowerCase()}`;
      if(existing.has(key))return;
      state._teamSyncMeta.tombstones.push({collection:'tasks',id,deletedAt:at,deletedBy:'system:RC1152',explicitUserAction:true});
      existing.add(key);
    });
  }

  function prepareManagedRoster(raw,ctx={}){
    const state=ctx.state||{};
    let tasks=arr(raw).slice(),changed=false;
    const kept=[],removed=[];
    const initialCleanup=!state.rc1152TaskRosterAt;
    const activeManagedKeys=new Set(MANAGED_TASKS.map(spec=>q(spec&&spec.key)).filter(Boolean));
    const tombstoned=new Set(arr(state._teamSyncMeta&&state._teamSyncMeta.tombstones)
      .filter(item=>q(item&&item.collection).toLowerCase()==='tasks')
      .map(item=>q(item&&item.id).toLowerCase())
      .filter(Boolean));
    tasks.forEach(task=>{
      const managed=q(task&&task.managedBy)==='RC1152';
      const managedCurrent=managed&&activeManagedKeys.has(q(task&&task.managedKey));
      const type=q(task&&task.sourceType).toLowerCase();
      const isSystem=SYSTEM_GROUPS.has(q(task&&task.group))&&type!=='manual';
      const currentSystem=isSystem&&systemTaskIsCurrent(task,state);
      const wasRemoved=tombstoned.has(q(task&&task.id).toLowerCase());
      if(managedCurrent||currentSystem||(!managed&&!isSystem&&!initialCleanup&&!wasRemoved))kept.push(task);
      else removed.push(task);
    });
    if(removed.length){
      tasks=kept;
      changed=true;
      addTaskTombstones(state,removed);
      state.rc1152TaskRosterAt=new Date().toISOString();
    }else if(initialCleanup){
      state.rc1152TaskRosterAt=new Date().toISOString();
      changed=true;
    }
    const day=localDay(ctx.now||new Date());
    if(day){
      const specs=MANAGED_TASKS.filter(spec=>spec.referenceArea||arr(spec.weekdays).includes(day.weekday));
      specs.forEach(spec=>{
        const candidate=managedTaskForSpec(spec,day.date,ctx);
        if(tasks.some(t=>q(t&&t.id)===candidate.id))return;
        tasks.push(candidate);changed=true;
      });
    }
    return {tasks,changed};
  }

  function currentTasks(raw,ctx={}){
    const lifecycle=api();
    const normalizedContext=taskContext(ctx);
    const normalized=arr(raw).map(task=>lifecycle.normalizeTask(task,normalizedContext));
    return lifecycle.reconcile(normalized,ctx.state||{},normalizedContext).tasks;
  }

  function prepareTasks(raw,ctx={}){
    const lifecycle=api();
    const normalizedContext=taskContext(ctx);
    const roster=prepareManagedRoster(raw,{...ctx,...normalizedContext});
    const normalized=arr(roster.tasks).map(task=>lifecycle.normalizeTask(task,normalizedContext));
    const result=lifecycle.reconcile(normalized,ctx.state||{},normalizedContext);
    if((roster.changed||result.changed)&&typeof ctx.persist==='function')ctx.persist(result.tasks);
    lastTasks=result.tasks;
    lastContext={...normalizedContext,state:ctx.state||{},persist:ctx.persist};
    scheduleEnhance();
    syncAndroidSnapshot(result.tasks,lastContext);
    return result.tasks;
  }

  function sameScope(task,ctx={}){
    const t=api().normalizeTask(task||{},ctx);
    const company=q(ctx.companyId),environment=q(ctx.environment);
    if(company&&t.companyId&&t.companyId!==company)return false;
    if(environment&&t.environment&&t.environment!==environment)return false;
    return true;
  }

  function reportOpenBlocked(task){
    try{if(root.ExportHUBClean&&typeof root.ExportHUBClean.operationStatus==='function')root.ExportHUBClean.operationStatus('Aufgabe kann in diesem Firmen- oder Umgebungskontext nicht geöffnet werden.','bad');}catch(_){ }
    try{if(root.console&&typeof root.console.warn==='function')root.console.warn('RC1014 Aufgabenöffnung blockiert',task&&task.id);}catch(_){ }
  }

  function esc(value){return q(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function linkedShipmentTarget(task,ctx={}){
    const state=ctx.state||sharedState()||{};
    const refs=[q(task&&task.linkedShipmentId),q(task&&task.sourceId),q(task&&task.linkedShipmentRef),q(task&&task.sourceRef)].filter(Boolean);
    const hit=arr(state.shipments).concat(arr(state.savedShipments)).find(sh=>refs.includes(q(sh&&sh.id))||refs.includes(q(sh&&sh.shipmentId))||refs.includes(q(sh&&sh.ref))||refs.includes(q(sh&&sh.reference)));
    return hit?q(hit.ref||hit.reference||hit.id||hit.shipmentId):'';
  }

  function detailSpec(task){
    const key=q(task&&task.managedKey);
    return MANAGED_TASKS.find(spec=>spec.key===key)||null;
  }

  function detailDue(task){
    const raw=q(task&&task.dueAt);
    if(!raw)return 'Keine feste Frist';
    const d=new Date(raw);
    if(Number.isNaN(d.getTime()))return raw;
    try{return new Intl.DateTimeFormat('de-DE',{dateStyle:'full',timeStyle:raw.includes('T')?'short':undefined}).format(d);}catch(_){return raw;}
  }

  function taskStatusLabel(task,isReference){
    if(isReference)return 'Bereich';
    const status=q(task&&task.status).toLowerCase();
    if(status==='done')return 'Erledigt';
    if(status==='in_progress')return 'In Bearbeitung';
    if(status==='cancelled')return 'Storniert';
    return 'Offen';
  }

  function storedTaskId(){
    if(lastOpenTaskId)return lastOpenTaskId;
    try{lastOpenTaskId=q(root.history&&root.history.state&&root.history.state.exporthubTaskId);}catch(_){}
    return lastOpenTaskId;
  }

  function rememberTaskDetail(task){
    lastOpenTaskId=q(task&&task.id);
    try{
      if(root.history&&typeof root.history.replaceState==='function'&&lastOpenTaskId){
        const current=root.history.state&&typeof root.history.state==='object'?root.history.state:{};
        root.history.replaceState({...current,exporthubTaskDetail:true,exporthubTaskId:lastOpenTaskId},'',root.location&&root.location.href?root.location.href:undefined);
      }
    }catch(_){}
    return lastOpenTaskId;
  }

  function rememberedTask(ctx={}){
    const id=storedTaskId();
    if(!id)return null;
    const state=ctx.state||sharedState()||{};
    return arr(lastTasks).concat(arr(state.tasks)).find(item=>q(item&&item.id)===id)||null;
  }

  function closeTaskDetail(fromPopState){
    const doc=root.document,view=doc&&doc.getElementById&&doc.getElementById('rc1152TaskDetail');
    if(view&&view.parentNode)view.parentNode.removeChild(view);
    try{if(doc&&doc.body)doc.body.removeAttribute('data-exporthub-task-detail');}catch(_){}
    if(!fromPopState&&typeof root.setView==='function')root.setView('tasks');
    return true;
  }

  async function setTaskStatus(task,status,ctx={}){
    const state=ctx.state||sharedState();
    if(!state)return false;
    const id=q(task&&task.id),items=arr(state.tasks);
    const target=items.find(item=>q(item&&item.id)===id);
    if(!target)return false;
    const next=q(status).toLowerCase(),now=new Date().toISOString(),user=currentUserId(ctx)||'Benutzer';
    if(next==='done'){
      target.status='done';target.done=true;target.completedAt=now;target.doneAt=now;target.completedBy=user;target.doneBy=user;
    }else if(next==='in_progress'){
      target.status='in_progress';target.done=false;target.startedAt=q(target.startedAt)||now;target.startedBy=q(target.startedBy)||user;
      target.completedAt='';target.doneAt='';target.completedBy='';target.doneBy='';
    }else{
      target.status='open';target.done=false;target.startedAt='';target.startedBy='';
      target.completedAt='';target.doneAt='';target.completedBy='';target.doneBy='';
    }
    target.updatedAt=now;
    if(typeof ctx.persist==='function')ctx.persist(items);
    else{
      const clean=root.ExportHUBClean;
      if(clean&&typeof clean.queueSave==='function'){
        await Promise.resolve(clean.queueSave('RC1153 Aufgabenstatus geändert'));
        if(typeof clean.flushSave==='function')await Promise.resolve(clean.flushSave('RC1153 Aufgabenstatus geändert'));
      }
    }
    try{if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('exporthub:tasks-updated',{detail:{reason:'RC1153 status',taskId:id,status:target.status}}));}catch(_){}
    closeTaskDetail(false);
    return true;
  }

  async function completeTask(task,ctx={}){
    return setTaskStatus(task,'done',ctx);
  }

  function openLinkedShipment(task,ctx={}){
    const target=linkedShipmentTarget(task,ctx);
    if(!target)return false;
    if(root.ExportHUBShipmentView&&typeof root.ExportHUBShipmentView.open==='function'){root.ExportHUBShipmentView.open(target,'tasks');return true;}
    if(typeof root.openShipment==='function'){root.openShipment(target);return true;}
    if(typeof root.__EXPORTHUB_OPEN_SHIPMENT__==='function'){root.__EXPORTHUB_OPEN_SHIPMENT__(target);return true;}
    return false;
  }

  function taskDetailHtml(task,ctx={}){
    const t=api().normalizeTask(task||{},ctx),spec=detailSpec(t)||detailSpec(task);
    const shipmentTarget=linkedShipmentTarget({...task,...t},ctx);
    const checklist=arr((task&&task.checklist)||(spec&&spec.checklist));
    const description=q((task&&task.description)||(spec&&spec.description))||'Für diese Aufgabe ist keine zusätzliche Beschreibung hinterlegt.';
    const recurrence=q((task&&task.recurrenceLabel)||(spec&&weekdayLabel(spec.weekdays,spec.dueTime)))||'Einmalig / ohne festen Rhythmus';
    const isReference=!!((task&&task.managedKind==='reference-area')||(spec&&spec.referenceArea));
    return `<div class="rc1152-task-shell" data-rc1179-task-tab="1">
      <header class="rc1152-task-header">
        <button type="button" class="btn rc1152-task-back" data-task-action="back">← Zurück zu Aufgaben</button>
        <div><span class="rc1152-task-eyebrow">${esc(t.group||'Aufgabe')}</span><h1>${esc(t.title||'Aufgabe')}</h1></div>
        <span class="rc1152-task-status" data-status="${esc(isReference?'reference':t.status||'open')}">${esc(taskStatusLabel(t,isReference))}</span>
      </header>
      <div class="rc1152-task-grid">
        <article class="rc1152-task-card"><h2>Aufgabe</h2><p>${esc(description)}</p></article>
        <article class="rc1152-task-card"><h2>Fälligkeit</h2><strong>${esc(detailDue(t))}</strong><p>${esc(recurrence)}</p></article>
        <article class="rc1152-task-card"><h2>Verantwortlich</h2><strong>${esc(t.effectiveAssignee||t.originalAssignee||'Nicht zugewiesen')}</strong><p>Priorität ${esc(t.priority||'P4')}</p></article>
        ${checklist.length?`<article class="rc1152-task-card rc1152-task-checklist"><h2>Kunden / Prüfpunkte</h2><ul>${checklist.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></article>`:''}
        ${shipmentTarget?`<article class="rc1152-task-card"><h2>Zugehörige Sendung</h2><strong>${esc(shipmentTarget)}</strong><button type="button" class="btn primary" data-task-action="shipment">Sendung öffnen</button></article>`:''}
      </div>
      <footer class="rc1152-task-actions">
        <button type="button" class="btn" data-task-action="back">Zurück</button>
        ${!isReference?`<button type="button" class="btn" data-task-action="open" ${t.status==='open'?'disabled':''}>Offen</button>
        <button type="button" class="btn" data-task-action="in_progress" ${t.status==='in_progress'?'disabled':''}>In Bearbeitung</button>
        <button type="button" class="btn primary" data-task-action="done" aria-label="Als erledigt markieren" ${t.status==='done'?'disabled':''}>Erledigt</button>`:''}
      </footer>
    </div>`;
  }

  function renderTaskDetailView(task,ctx={}){
    const doc=root.document;
    if(!doc||typeof doc.createElement!=='function')return false;
    const mergedCtx={...lastContext,...ctx,state:(ctx&&ctx.state)||lastContext.state||sharedState()||{}};
    const raw=task||rememberedTask(mergedCtx);
    const host=doc.getElementById&&doc.getElementById('content');
    if(!host)return false;
    host.innerHTML='';
    const panel=doc.createElement('section');
    panel.id='rc1152TaskDetail';panel.className='rc1152-task-detail';panel.setAttribute('data-rc1179-task-view','1');
    if(!raw){
      panel.innerHTML='<div class="rc1152-task-shell"><header class="rc1152-task-header"><div><span class="rc1152-task-eyebrow">Aufgaben</span><h1>Aufgabenansicht</h1></div></header><article class="rc1152-task-card"><h2>Keine Aufgabe geöffnet</h2><p>Öffne zuerst im Reiter „Aufgaben“ eine Aufgabe. Sie wird anschließend hier angezeigt.</p><button type="button" class="btn primary" data-task-action="back">Zu den Aufgaben</button></article></div>';
      panel.addEventListener('click',event=>{const btn=event.target&&event.target.closest&&event.target.closest('[data-task-action="back"]');if(btn)closeTaskDetail(false);});
      host.appendChild(panel);return true;
    }
    const t=api().normalizeTask(raw||{},mergedCtx);
    if(!sameScope(t,mergedCtx)){reportOpenBlocked(t);return false;}
    rememberTaskDetail(t);
    panel.innerHTML=taskDetailHtml({...raw,...t},mergedCtx);
    panel.addEventListener('click',event=>{
      const btn=event.target&&event.target.closest&&event.target.closest('[data-task-action]');
      if(!btn)return;
      const action=btn.getAttribute('data-task-action');
      if(action==='back')closeTaskDetail(false);
      else if(action==='shipment')openLinkedShipment({...raw,...t},mergedCtx);
      else if(action==='open'||action==='in_progress'||action==='done')setTaskStatus({...raw,...t},action,mergedCtx).catch(()=>{});
    });
    host.appendChild(panel);
    try{if(doc.body)doc.body.setAttribute('data-exporthub-task-detail','open');}catch(_){}
    const first=panel.querySelector&&panel.querySelector('[data-task-action="back"]');if(first&&typeof first.focus==='function')first.focus();
    return true;
  }

  function openTaskDetail(task,ctx={}){
    const t=api().normalizeTask(task||{},ctx);
    if(!sameScope(t,ctx)){reportOpenBlocked(t);return false;}
    rememberTaskDetail(t);
    lastContext={...lastContext,...ctx,state:ctx.state||lastContext.state||sharedState()||{}};
    if(typeof root.setView==='function'){root.setView('taskdetail');return true;}
    return renderTaskDetailView({...task,...t},ctx);
  }

  function openTask(task,ctx={}){
    const t=api().normalizeTask(task||{},ctx);
    if(!sameScope(t,ctx)){reportOpenBlocked(t);return false;}
    return openTaskDetail({...task,...t},ctx);
  }

  function dueLabel(bucket,dueAt){
    if(bucket==='overdue')return 'Überfällig';
    if(bucket==='today')return 'Heute';
    if(bucket==='future')return q(dueAt)||'Zukünftig';
    return 'Ohne Termin';
  }

  function taskCardMeta(task,ctx={}){
    const lifecycle=api();
    const t=lifecycle.normalizeTask(task||{},ctx);
    const bucket=lifecycle.dueBucket(t,ctx.now);
    return {priority:t.priority,dueBucket:bucket,dueAt:t.dueAt,dueLabel:dueLabel(bucket,t.dueAt),assignee:t.effectiveAssignee||t.originalAssignee||'Nicht zugewiesen',sourceRef:t.sourceRef,group:t.group};
  }

  function cardTask(card,tasks){
    if(!card)return null;
    const dataset=card.dataset||{};
    const ids=[dataset.taskId,dataset.id,dataset.task,dataset.sourceId].map(q).filter(Boolean);
    let hit=arr(tasks).find(t=>ids.includes(q(t.id))||ids.includes(q(t.sourceId)));
    if(hit)return hit;
    const text=q(card.textContent);
    hit=arr(tasks).find(t=>q(t.sourceRef)&&text.includes(q(t.sourceRef)));
    if(hit)return hit;
    return arr(tasks).find(t=>q(t.title)&&text.includes(q(t.title)))||null;
  }

  function createSpan(doc,className,attribute,value,text){
    const el=doc.createElement('span');el.className=className;el.setAttribute(attribute,value);el.textContent=text;return el;
  }

  function enhanceTaskCards(tasks=lastTasks,ctx=lastContext){
    const doc=root.document;
    if(!doc||typeof doc.querySelectorAll!=='function')return 0;
    const cards=Array.from(doc.querySelectorAll(CARD_SELECTOR));
    let enhanced=0;
    cards.forEach(card=>{
      const task=cardTask(card,tasks);
      if(!task||!sameScope(task,ctx))return;
      const meta=taskCardMeta(task,ctx);
      let row=card.querySelector&&card.querySelector('.rc1014-task-meta');
      if(!row){row=doc.createElement('div');row.className='rc1014-task-meta';if(typeof card.appendChild==='function')card.appendChild(row);}
      row.textContent='';
      row.appendChild(createSpan(doc,'rc1014-priority','data-rc1014-priority',meta.priority,`Priorität ${meta.priority}`));
      row.appendChild(createSpan(doc,'rc1014-due','data-rc1014-due',meta.dueBucket,`Fällig: ${meta.dueLabel}`));
      row.appendChild(createSpan(doc,'rc1014-assignee','data-rc1014-assignee',meta.assignee,`Verantwortlich: ${meta.assignee}`));
      let button=card.querySelector&&card.querySelector('[data-rc1014-open-task]');
      if(!button){
        button=doc.createElement('button');button.type='button';button.className='btn primary rc1014-open-task';button.setAttribute('data-rc1014-open-task','1');button.textContent='Aufgabe öffnen';
        button.addEventListener('click',event=>{if(event&&typeof event.preventDefault==='function')event.preventDefault();if(event&&typeof event.stopPropagation==='function')event.stopPropagation();openTask(task,ctx);});
        if(typeof card.appendChild==='function')card.appendChild(button);
      }
      const data=card.dataset||null;
      if(data&&!data.rc1152TaskOpen){
        data.rc1152TaskOpen='1';card.setAttribute&&card.setAttribute('tabindex','0');card.setAttribute&&card.setAttribute('role','button');
        card.addEventListener('click',event=>{if(event&&event.target&&event.target.closest&&event.target.closest('button,a,input,select,textarea,label'))return;openTask(task,ctx);});
        card.addEventListener('keydown',event=>{if(!event||!(event.key==='Enter'||event.key===' '))return;if(event.target&&event.target.closest&&event.target.closest('button,a,input,select,textarea'))return;event.preventDefault();openTask(task,ctx);});
      }
      card.setAttribute&&card.setAttribute('data-rc1014-enhanced','1');
      enhanced++;
    });
    return enhanced;
  }

  function scheduleEnhance(){
    if(!root.document)return;
    if(enhanceTimer&&typeof root.clearTimeout==='function')root.clearTimeout(enhanceTimer);
    const schedule=typeof root.setTimeout==='function'?root.setTimeout:(fn=>fn());
    enhanceTimer=schedule(()=>{enhanceTimer=0;enhanceTaskCards();},0);
  }

  function containsTaskCard(node){
    if(!node||node.nodeType!==1)return false;
    if(typeof node.matches==='function'&&node.matches(CARD_SELECTOR))return true;
    return typeof node.querySelector==='function'&&!!node.querySelector(CARD_SELECTOR);
  }

  function installLazyCardObserver(){
    const doc=root.document;
    if(!doc||lazyCardObserver||typeof root.MutationObserver!=='function')return false;
    const target=doc.body||doc.documentElement;
    if(!target)return false;
    lazyCardObserver=new root.MutationObserver(mutations=>{
      if(mutations.some(mutation=>Array.from(mutation.addedNodes||[]).some(containsTaskCard)))scheduleEnhance();
    });
    lazyCardObserver.observe(target,{childList:true,subtree:true});
    doc.addEventListener('toggle',event=>{const target=event&&event.target;if(target&&target.matches&&target.matches('details.task-area-details'))scheduleEnhance();},true);
    return true;
  }

  function syncAndroidSnapshot(tasks,ctx={}){
    const bridge=root.ExportHUBAndroid;
    if(!bridge||typeof bridge.notify!=='function')return false;
    const lifecycle=api();
    const userId=q(ctx.currentUserId||currentUserId(ctx));
    const environment=q(ctx.environment);
    if(!userId||!environment)return false;
    const candidates=lifecycle.reminderCandidates(tasks,{...ctx,currentUserId:userId,environment});
    const safeTasks=candidates.map(task=>{
      const t=lifecycle.normalizeTask(task,ctx);const bucket=lifecycle.dueBucket(t,ctx.now);
      return {id:q(t.id),title:q(t.title),sourceRef:q(t.sourceRef),priority:q(t.priority),dueAt:q(t.dueAt),dueBucket:bucket,group:q(t.group),effectiveAssignee:q(t.effectiveAssignee),environment:q(t.environment||environment),route:'tasks'};
    });
    const payload=JSON.stringify({schema:'rc1014-task-snapshot-v1',environment,userId,generatedAt:new Date().toISOString(),tasks:safeTasks});
    bridge.notify('task_snapshot',`task_snapshot:${environment}:${userId}`,'RC1014 Aufgaben-Snapshot',payload,'tasks');
    return true;
  }

  function environmentName(){
    const forced=q(root.__EXPORTHUB_FORCED_ENVIRONMENT__).toLowerCase();
    if(forced==='production'||forced==='testservice'||forced==='demo')return forced;
    const location=root.location||{},host=q(location.hostname).toLowerCase(),path=q(location.pathname).toLowerCase();
    if(path.includes('demo.html'))return 'demo';
    return /-testservice\./.test(host)?'testservice':'production';
  }

  function sharedState(){
    try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||null;}catch(_){ }
    return root.ExportHUBClean&&root.ExportHUBClean.state||root.appState||null;
  }

  function cloneJson(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}

  async function resetProductionTasksOnce(){
    if(environmentName()!=='production'||taskResetInFlight)return false;
    const state=sharedState(),clean=root.ExportHUBClean;
    if(!state||state.rc1107TaskResetAt)return false;
    if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')return false;
    taskResetInFlight=true;
    const previous={tasks:cloneJson(state.tasks),taskStatusLedger:cloneJson(state.taskStatusLedger),marker:state.rc1107TaskResetAt,tombstones:cloneJson(state._teamSyncMeta&&state._teamSyncMeta.tombstones)};
    const at=new Date().toISOString(),tasks=arr(state.tasks);
    try{
      if(!state._teamSyncMeta||typeof state._teamSyncMeta!=='object'||Array.isArray(state._teamSyncMeta))state._teamSyncMeta={fields:{},tombstones:[]};
      if(!Array.isArray(state._teamSyncMeta.tombstones))state._teamSyncMeta.tombstones=[];
      const existing=new Set(state._teamSyncMeta.tombstones.map(t=>`${q(t&&t.collection).toLowerCase()}:${q(t&&t.id).toLowerCase()}`));
      tasks.forEach((task,index)=>{
        const id=q(task&&task.id)||`index:${index}`;
        const key=`tasks:${id.toLowerCase()}`;
        if(existing.has(key))return;
        state._teamSyncMeta.tombstones.push({collection:'tasks',id,deletedAt:at,deletedBy:'system:RC1107',explicitUserAction:true});
        existing.add(key);
      });
      state.tasks=[];
      state.taskStatusLedger={};
      state.rc1107TaskResetAt=at;
      await Promise.resolve(clean.queueSave('RC1107 Aufgabenbestand zurückgesetzt'));
      const ok=await Promise.resolve(clean.flushSave('RC1107 Aufgabenbestand zurückgesetzt'));
      if(ok===false)throw new Error('Azure hat den Aufgaben-Reset nicht bestätigt.');
      lastTasks=[];
      try{if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('exporthub:tasks-updated',{detail:{reason:'RC1107 reset'}}));}catch(_){ }
      return true;
    }catch(error){
      state.tasks=previous.tasks;
      state.taskStatusLedger=previous.taskStatusLedger;
      if(previous.marker===undefined)delete state.rc1107TaskResetAt;else state.rc1107TaskResetAt=previous.marker;
      if(!state._teamSyncMeta||typeof state._teamSyncMeta!=='object')state._teamSyncMeta={fields:{},tombstones:[]};
      state._teamSyncMeta.tombstones=previous.tombstones||[];
      throw error;
    }finally{taskResetInFlight=false;}
  }

  function scheduleProductionTaskReset(){
    if(environmentName()!=='production')return false;
    if(taskResetTimer&&typeof root.clearTimeout==='function')root.clearTimeout(taskResetTimer);
    const schedule=typeof root.setTimeout==='function'?root.setTimeout:(fn=>fn());
    taskResetTimer=schedule(async()=>{
      taskResetTimer=0;
      try{
        const done=await resetProductionTasksOnce();
        const state=sharedState();
        if(!done&&state&&!state.rc1107TaskResetAt)scheduleProductionTaskReset();
      }catch(error){
        try{if(root.console&&typeof root.console.error==='function')root.console.error('RC1107 Aufgabenreset fehlgeschlagen',error);}catch(_){ }
        // RC1152: kein pauschaler Produktions-Reset mehr; Altaufgaben werden gezielt im Roster bereinigt.
      }
    },1000);
    return true;
  }

  if(root.addEventListener){
    ['exporthub:rendered','exporthub:viewchange','exporthub:tasks-updated'].forEach(name=>root.addEventListener(name,scheduleEnhance));
    root.addEventListener('DOMContentLoaded',installLazyCardObserver,{once:true});
  }
  installLazyCardObserver();
  // RC1152: Der frühere pauschale Produktions-Reset wird nicht mehr automatisch gestartet.
  // Altaufgaben werden ausschließlich gezielt in prepareManagedRoster() bereinigt.

  if(root.addEventListener)root.addEventListener('popstate',()=>{const doc=root.document;if(doc&&doc.getElementById&&doc.getElementById('rc1152TaskDetail'))closeTaskDetail(true);});

  root.ExportHUBRC1014TaskRuntime=Object.freeze({currentTasks,prepareTasks,openTask,openTaskDetail,renderTaskDetailView,rememberTaskDetail,rememberedTask,closeTaskDetail,setTaskStatus,completeTask,prepareManagedRoster,systemTaskIsCurrent,taskCardMeta,enhanceTaskCards,syncAndroidSnapshot,resetProductionTasksOnce,MANAGED_TASKS});
})(globalThis);
