(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];

  function api(){
    const value=root.ExportHUBRC1014Tasks;
    if(!value||typeof value.normalizeTask!=='function')throw new Error('RC1014 Aufgaben-Lifecycle ist nicht geladen.');
    return value;
  }

  function currentUserId(ctx){
    const u=(ctx&&ctx.currentUser)||{};
    return q((ctx&&ctx.currentUserId)||u.id||u.userId||u.username||u.login||u.name);
  }

  function prepareTasks(raw,ctx={}){
    const lifecycle=api();
    const normalizedContext={
      companyId:q(ctx.companyId),
      environment:q(ctx.environment),
      currentUserId:currentUserId(ctx),
      now:ctx.now,
      absences:arr(ctx.absences||(ctx.state&&ctx.state.absences))
    };
    const normalized=arr(raw).map(task=>lifecycle.normalizeTask(task,normalizedContext));
    const result=lifecycle.reconcile(normalized,ctx.state||{},normalizedContext);
    if(result.changed&&typeof ctx.persist==='function')ctx.persist(result.tasks);
    return result.tasks;
  }

  function openTask(task){
    const t=api().normalizeTask(task||{});
    const target=q(t.sourceId||t.sourceRef);
    if(!target)return false;
    if(typeof root.openShipment==='function'){
      root.openShipment(target);
      return true;
    }
    return false;
  }

  function taskCardMeta(task,ctx={}){
    const lifecycle=api();
    const t=lifecycle.normalizeTask(task||{},ctx);
    return {
      priority:t.priority,
      dueBucket:lifecycle.dueBucket(t,ctx.now),
      dueAt:t.dueAt,
      assignee:t.effectiveAssignee||t.originalAssignee,
      sourceRef:t.sourceRef,
      group:t.group
    };
  }

  function syncAndroidSnapshot(tasks,ctx={}){
    const bridge=root.ExportHUBAndroid;
    if(!bridge||typeof bridge.syncTaskSnapshot!=='function')return false;
    return false;
  }

  root.ExportHUBRC1014TaskRuntime=Object.freeze({
    prepareTasks,
    openTask,
    taskCardMeta,
    syncAndroidSnapshot
  });
})(globalThis);
