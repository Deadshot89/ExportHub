(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const CARD_SELECTOR='.rc229-task-card.rc628-unified-task, .task-card';
  let lastTasks=[];
  let lastContext={};
  let enhanceTimer=0;
  let lazyCardObserver=null;

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

  if(root.addEventListener){
    ['exporthub:rendered','exporthub:viewchange','exporthub:tasks-updated'].forEach(name=>root.addEventListener(name,scheduleEnhance));
    root.addEventListener('DOMContentLoaded',installLazyCardObserver,{once:true});
  }
  installLazyCardObserver();

  root.ExportHUBRC1014TaskRuntime=Object.freeze({currentTasks,prepareTasks,openTask,taskCardMeta,enhanceTaskCards,syncAndroidSnapshot});
})(globalThis);
