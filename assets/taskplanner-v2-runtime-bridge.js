(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function core(){
    const api=root.ExportHUBTaskCoreV2;
    if(!api||typeof api.historyEntry!=='function')throw new Error('TaskPlanner V2 Core fehlt');
    return api;
  }
  function planner(){
    const api=root.ExportHUBTaskPlannerV2;
    if(!api||typeof api.applyWeekDraft!=='function')throw new Error('TaskPlanner V2 Planner fehlt');
    return api;
  }
  function workflow(){
    const api=root.ExportHUBTaskWorkflowV2;
    if(!api||typeof api.emit!=='function')throw new Error('TaskPlanner V2 Workflow fehlt');
    return api;
  }
  function sharedState(){
    try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||null;}catch(_){}
    try{if(root.ExportHUBState&&typeof root.ExportHUBState.get==='function')return root.ExportHUBState.get()||null;}catch(_){}
    return root.ExportHUBClean&&root.ExportHUBClean.state||root.__EXPORTHUB_STATE__||root.appState||root.state||null;
  }
  function stateOf(ctx){
    if(!ctx||!ctx.state||typeof ctx.state!=='object')throw new Error('TaskPlanner V2 Runtime benötigt ctx.state');
    if(!Array.isArray(ctx.state.tasks))ctx.state.tasks=[];
    return ctx.state;
  }
  function workflowContext(ctx={}){
    const next={...(ctx||{})};
    if(!next.state)next.state=sharedState();
    stateOf(next);
    if(typeof next.persist!=='function'){
      next.persist=tasks=>{
        next.state.tasks=tasks;
        try{if(root.ExportHUBClean&&typeof root.ExportHUBClean.queueSave==='function')return root.ExportHUBClean.queueSave('TaskPlanner V2 workflow update');}catch(_){}
        return false;
      };
    }
    return next;
  }
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function persist(ctx,tasks){if(ctx&&typeof ctx.persist==='function')ctx.persist(tasks);}
  function emit(type,ids,ctx){
    try{
      if(typeof root.dispatchEvent!=='function')return;
      const detail={type,taskIds:arr(ids).filter(Boolean),at:q(ctx&&ctx.now)||new Date().toISOString()};
      if(typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('exporthub:tasks-updated',{detail}));
      else root.dispatchEvent({type:'exporthub:tasks-updated',detail});
    }catch(_){}
  }

  function applyTaskPatch(id,patch,ctx={}){
    id=q(id);if(!id)throw new Error('Task-ID fehlt');
    const state=stateOf(ctx),index=state.tasks.findIndex(t=>q(t&&t.id)===id);if(index<0)return{changed:false,task:null};
    const before=state.tasks[index],next={...clone(before),...clone(patch||{})};
    if(same(before,next))return{changed:false,task:before};
    state.tasks=state.tasks.slice();state.tasks[index]=next;persist(ctx,state.tasks);emit('patch',[id],ctx);
    return{changed:true,task:next};
  }

  function moveTaskOccurrence(id,plannedAt,ctx={}){
    const state=stateOf(ctx),task=state.tasks.find(t=>q(t&&t.id)===q(id));if(!task)return{changed:false,task:null};
    const date=core().dayKey(plannedAt);if(!date)throw new Error('Ungültiges Planungsdatum');
    const at=q(ctx.now)||new Date().toISOString(),before=q(task.plannedAt),timeMatch=before.match(/T(\d{2}:\d{2})/),time=timeMatch?timeMatch[1]:'00:00';
    const nextPlanned=core().localDateTime(date,time);
    if(core().dayKey(before)===date&&task.manualOverride===true)return{changed:false,task};
    const history=arr(task.history).map(clone);history.push(core().historyEntry('manual_move',{at,source:'manual',before:{plannedAt:before},after:{plannedAt:nextPlanned}}));
    return applyTaskPatch(id,{plannedAt:nextPlanned,plannedDate:date,manualOverride:true,history},ctx);
  }

  function applyWeekPlan(draft,ctx={}){
    const state=stateOf(ctx),result=planner().applyWeekDraft({tasks:state.tasks},draft,{at:q(ctx.now)||undefined,allowManualOverride:ctx.allowManualOverride===true});
    if(!result.changed)return{...result,state};
    state.tasks=result.state.tasks;persist(ctx,state.tasks);emit('week_plan_applied',result.patches.map(p=>p.taskId),ctx);
    return{...result,state};
  }

  function emitWorkflowEvent(event,ctx={}){
    const resolved=workflowContext(ctx);
    return workflow().emit(event,resolved);
  }

  const previous=root.ExportHUBRC1014TaskRuntime&&typeof root.ExportHUBRC1014TaskRuntime==='object'?root.ExportHUBRC1014TaskRuntime:{};
  root.ExportHUBRC1014TaskRuntime=Object.freeze({...previous,applyTaskPatch,applyWeekPlan,moveTaskOccurrence,emitWorkflowEvent});
})(globalThis);
