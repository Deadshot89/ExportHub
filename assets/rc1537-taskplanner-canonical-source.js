(function(root){
  'use strict';

  const arr=value=>Array.isArray(value)?value:[];
  const obj=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const q=value=>String(value==null?'':value).trim();
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

  function dateKey(value){
    const raw=q(value);
    const direct=(raw.match(/^(\d{4}-\d{2}-\d{2})/)||[])[1];
    if(direct)return direct;
    const d=value instanceof Date?value:new Date(value||Date.now());
    if(Number.isNaN(d.getTime()))return'';
    return d.toISOString().slice(0,10);
  }

  function addDays(date,days){
    const d=new Date(date+'T12:00:00Z');
    d.setUTCDate(d.getUTCDate()+Number(days||0));
    return d.toISOString().slice(0,10);
  }

  function mondayOf(value){
    const key=dateKey(value)||dateKey(new Date());
    const d=new Date(key+'T12:00:00Z');
    const weekday=d.getUTCDay()||7;
    return addDays(key,1-weekday);
  }

  function twoWorkweeks(now){
    const monday=mondayOf(now);
    return [0,1,2,3,4,7,8,9,10,11].map(offset=>addDays(monday,offset));
  }

  function enrichedContext(ctx,state){
    const currentUser=(ctx&&ctx.currentUser)||(state&&state.currentUser)||{};
    return {
      ...(ctx||{}),
      state,
      currentUser,
      currentUserId:q((ctx&&ctx.currentUserId)||(state&&state.currentUserId)||(state&&state.userId)||currentUser.id||currentUser.userId||currentUser.user||currentUser.username||currentUser.login||currentUser.name),
      companyId:q((ctx&&ctx.companyId)||(state&&state.companyId)||(state&&state.currentCompanyId)||root.__EXPORTHUB_COMPANY_ID__),
      environment:q((ctx&&ctx.environment)||(state&&state.environment)||root.__EXPORTHUB_FORCED_ENVIRONMENT__)
    };
  }

  function detachedState(state,tasks){
    const source=obj(state)?state:{};
    return {
      ...source,
      tasks:arr(tasks).slice(),
      _teamSyncMeta:clone(source._teamSyncMeta||{fields:{},tombstones:[]})
    };
  }

  function patchRuntime(){
    const previous=root.ExportHUBRC1014TaskRuntime;
    if(!previous||typeof previous.prepareManagedRoster!=='function'||typeof previous.prepareTasks!=='function'||typeof previous.currentTasks!=='function')return;
    if(previous.__rc1537CanonicalSource===true)return;

    function expandManagedRoster(raw,ctx={},writeState){
      const liveState=obj(ctx.state)?ctx.state:{};
      const state=writeState?liveState:detachedState(liveState,raw);
      const baseCtx=enrichedContext(ctx,state);
      let tasks=arr(raw).slice(),changed=false;
      if(typeof previous.managedOwnerMatches==='function'&&!previous.managedOwnerMatches(baseCtx))return{tasks,changed:false,state};
      for(const date of twoWorkweeks(baseCtx.now||new Date())){
        const result=previous.prepareManagedRoster(tasks,{...baseCtx,state,now:date+'T12:00:00'});
        tasks=arr(result&&result.tasks);
        changed=changed||!!(result&&result.changed);
      }
      state.tasks=tasks;
      return{tasks,changed,state};
    }

    function currentTasks(raw,ctx={}){
      const expanded=expandManagedRoster(raw,ctx,false);
      return previous.currentTasks(expanded.tasks,{...ctx,state:expanded.state});
    }

    function prepareTasks(raw,ctx={}){
      const expanded=expandManagedRoster(raw,ctx,true);
      const originalPersist=typeof ctx.persist==='function'?ctx.persist:null;
      let persisted=false;
      const nextCtx={...ctx};
      if(originalPersist){
        nextCtx.persist=tasks=>{
          persisted=true;
          if(obj(ctx.state))ctx.state.tasks=arr(tasks);
          return originalPersist(tasks);
        };
      }
      const result=arr(previous.prepareTasks(expanded.tasks,nextCtx));
      if(obj(ctx.state))ctx.state.tasks=result;
      if(expanded.changed&&!persisted&&originalPersist)originalPersist(result);
      return result;
    }

    root.ExportHUBRC1014TaskRuntime=Object.freeze({
      ...previous,
      currentTasks,
      prepareTasks,
      __rc1537CanonicalSource:true,
      __rc1537TwoWorkweeks:twoWorkweeks
    });
  }

  function patchPlannerUi(){
    const previous=root.ExportHUBTaskUIV2;
    if(!previous||typeof previous.renderPlannerPage!=='function'||typeof previous.bindPlannerDnD!=='function')return;
    if(previous.__rc1537CanonicalSource===true)return;

    function runtimeOf(ctx){return (ctx&&ctx.runtime)||root.ExportHUBRC1014TaskRuntime||null;}

    function liveStateOf(ctx){
      const state=obj(ctx&&ctx.state)?ctx.state:{tasks:[]};
      if(!Array.isArray(state.tasks))state.tasks=[];
      return state;
    }

    function persistFor(ctx,liveState){
      const supplied=ctx&&typeof ctx.persist==='function'?ctx.persist:null;
      return tasks=>{
        liveState.tasks=arr(tasks);
        if(supplied)return supplied(liveState.tasks);
        try{
          if(root.ExportHUBClean&&typeof root.ExportHUBClean.queueSave==='function')return root.ExportHUBClean.queueSave('TaskPlanner V2 planner update');
        }catch(_){}
        return false;
      };
    }

    function canonicalContext(ctx={}){
      const liveState=liveStateOf(ctx),runtime=runtimeOf(ctx),persist=persistFor(ctx,liveState);
      let tasks=arr(liveState.tasks);
      if(runtime&&typeof runtime.prepareTasks==='function'){
        tasks=arr(runtime.prepareTasks(tasks,{...ctx,state:liveState,persist}));
      }else if(runtime&&typeof runtime.currentTasks==='function'){
        tasks=arr(runtime.currentTasks(tasks,{...ctx,state:liveState}));
      }
      liveState.tasks=tasks;
      return{
        liveState,
        runtime,
        viewState:{...liveState,tasks},
        persist
      };
    }

    function activeTask(task){
      const status=q(task&&task.status).toLowerCase();
      return !['done','cancelled'].includes(status)&&!q(task&&task.archivedAt);
    }

    function taskDay(task){
      return dateKey(task&&((task.plannedAt||task.dueAt||task.date||task.day)));
    }

    function overdue(task,now){
      try{
        const core=root.ExportHUBTaskCoreV2;
        if(core&&typeof core.derive==='function')return core.derive(task,now).overdue===true;
      }catch(_){}
      const due=q(task&&task.dueAt);
      const dueMs=Date.parse(due),nowMs=Date.parse(q(now));
      return Number.isFinite(dueMs)&&Number.isFinite(nowMs)&&dueMs<nowMs&&activeTask(task);
    }

    function repairSummary(target,tasks,ctx={}){
      if(!target||typeof target.innerHTML!=='string')return;
      const now=q(ctx.now)||new Date().toISOString(),today=dateKey(now);
      const todayTasks=arr(tasks).filter(task=>activeTask(task)&&taskDay(task)===today);
      const vars={
        count:todayTasks.length,
        critical:todayTasks.filter(task=>q(task&&task.priority)==='P0').length,
        overdue:todayTasks.filter(task=>overdue(task,now)).length
      };
      target.innerHTML=target.innerHTML
        .replaceAll('{count}',String(vars.count))
        .replaceAll('{critical}',String(vars.critical))
        .replaceAll('{overdue}',String(vars.overdue));
    }

    function renderPlannerPage(target,ctx={}){
      const resolved=canonicalContext(ctx);
      const result=previous.renderPlannerPage(target,{
        ...ctx,
        state:resolved.viewState,
        runtime:resolved.runtime,
        persist:resolved.persist
      });
      repairSummary(target,resolved.viewState.tasks,ctx);
      return result;
    }

    function renderDailySummary(target,ctx={}){
      const resolved=canonicalContext(ctx);
      const result=typeof previous.renderDailySummary==='function'
        ?previous.renderDailySummary(target,{...ctx,state:resolved.viewState,runtime:resolved.runtime,persist:resolved.persist})
        :target;
      repairSummary(target,resolved.viewState.tasks,ctx);
      return result;
    }

    function renderOverdue(target,ctx={}){
      const resolved=canonicalContext(ctx);
      return typeof previous.renderOverdue==='function'
        ?previous.renderOverdue(target,{...ctx,state:resolved.viewState,runtime:resolved.runtime,persist:resolved.persist})
        :target;
    }

    function renderWorkweek(target,ctx={}){
      const resolved=canonicalContext(ctx);
      return typeof previous.renderWorkweek==='function'
        ?previous.renderWorkweek(target,{...ctx,state:resolved.viewState,runtime:resolved.runtime,persist:resolved.persist})
        :target;
    }

    function renderMonth(target,ctx={}){
      const resolved=canonicalContext(ctx);
      return typeof previous.renderMonth==='function'
        ?previous.renderMonth(target,{...ctx,state:resolved.viewState,runtime:resolved.runtime,persist:resolved.persist})
        :target;
    }

    function bindPlannerDnD(target,ctx={}){
      const liveState=liveStateOf(ctx),runtime=runtimeOf(ctx);
      return previous.bindPlannerDnD(target,{
        ...ctx,
        state:liveState,
        runtime,
        persist:persistFor(ctx,liveState)
      });
    }

    root.ExportHUBTaskUIV2=Object.freeze({
      ...previous,
      renderPlannerPage,
      renderDailySummary,
      renderOverdue,
      renderWorkweek,
      renderMonth,
      bindPlannerDnD,
      __rc1537CanonicalSource:true
    });
  }

  patchRuntime();
  patchPlannerUi();

  root.ExportHUBRC1537TaskPlanner=Object.freeze({version:'RC1537',twoWorkweeks});
})(globalThis);
