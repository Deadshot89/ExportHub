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

  function currentTasks(raw,ctx={}){
    const lifecycle=api();
    const normalizedContext=taskContext(ctx);
    const normalized=arr(raw).map(task=>lifecycle.normalizeTask(task,normalizedContext));
    return lifecycle.reconcile(normalized,ctx.state||{},normalizedContext).tasks;
  }

  function prepareTasks(raw,ctx={}){
    const lifecycle=api();
    const normalizedContext=taskContext(ctx);
    const normalized=arr(raw).map(task=>lifecycle.normalizeTask(task,normalizedContext));
    const result=lifecycle.reconcile(normalized,ctx.state||{},normalizedContext);
    if(result.changed&&typeof ctx.persist==='function')ctx.persist(result.tasks);
    lastTasks=result.tasks;
    lastContext={...normalizedContext,state:ctx.state||{}};
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

  function openTask(task,ctx={}){
    const t=api().normalizeTask(task||{},ctx);
    if(!sameScope(t,ctx)){reportOpenBlocked(t);return false;}
    const type=q(t.sourceType).toLowerCase();
    const target=type==='shipment'?q(t.sourceId||t.sourceRef):q(t.sourceRef||t.sourceId);
    if(!target)return false;
    if(typeof root.openShipment==='function'){root.openShipment(target);return true;}
    return false;
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
        button=doc.createElement('button');button.type='button';button.className='btn primary rc1014-open-task';button.setAttribute('data-rc1014-open-task','1');button.textContent='Öffnen';
        button.addEventListener('click',event=>{if(event&&typeof event.preventDefault==='function')event.preventDefault();openTask(task,ctx);});
        if(typeof card.appendChild==='function')card.appendChild(button);
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
        scheduleProductionTaskReset();
      }
    },1000);
    return true;
  }

  if(root.addEventListener){
    ['exporthub:rendered','exporthub:viewchange','exporthub:tasks-updated'].forEach(name=>root.addEventListener(name,scheduleEnhance));
    root.addEventListener('DOMContentLoaded',installLazyCardObserver,{once:true});
  }
  installLazyCardObserver();
  scheduleProductionTaskReset();

  root.ExportHUBRC1014TaskRuntime=Object.freeze({currentTasks,prepareTasks,openTask,taskCardMeta,enhanceTaskCards,syncAndroidSnapshot,resetProductionTasksOnce});
})(globalThis);
