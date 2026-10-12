(function(root){
  'use strict';

  const base=root.ExportHUBTaskUIV2;
  if(!base)throw new Error('TaskPlanner V2 UI fehlt');
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const esc=value=>q(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const DEFAULT_PUBLIC_FIELDS=Object.freeze(['description','status','plannedAt','dueAt','latestCompletionAt','checklist','customerName']);

  function core(){
    const api=root.ExportHUBTaskCoreV2;
    if(!api||typeof api.derive!=='function')throw new Error('TaskPlanner V2 Core fehlt');
    return api;
  }
  function planner(){
    const api=root.ExportHUBTaskPlannerV2;
    if(!api||typeof api.monthProjection!=='function')throw new Error('TaskPlanner V2 Planner fehlt');
    return api;
  }
  function tr(key,vars,fallback){
    try{if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function'){const value=root.ExportHUBI18n.t(key,vars);if(value&&value!==key)return value;}}catch(_){}
    return fallback||key;
  }
  function nowOf(ctx){return q(ctx&&ctx.now)||new Date().toISOString();}
  function dayKey(value){return core().dayKey(value);}
  function addDays(date,days){const d=new Date(q(date)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10);}
  function mondayOf(value){
    const key=dayKey(value)||dayKey(new Date()),d=new Date(key+'T12:00:00Z'),day=d.getUTCDay()||7;
    d.setUTCDate(d.getUTCDate()-(day-1));return d.toISOString().slice(0,10);
  }
  function activeTask(task){const status=q(task&&task.status).toLowerCase();return !['done','cancelled'].includes(status)&&!q(task&&task.archivedAt);}
  function taskDay(task){return dayKey(task&&((task.plannedAt||task.dueAt||task.date||task.day)));}
  function isOverdue(task,now){try{return activeTask(task)&&core().derive(task,now).overdue===true;}catch(_){return false;}}
  function sorted(tasks,now){try{return planner().sortTasks(arr(tasks),now);}catch(_){return arr(tasks).slice();}}
  function interpolateFallback(template,vars){let text=String(template||'');for(const [name,value] of Object.entries(vars||{}))text=text.replaceAll('{'+name+'}',String(value));return text;}
  function translated(key,vars,fallback){const value=tr(key,vars,'');return value&&value!==key?value:interpolateFallback(fallback,vars);}

  function taskCardHtml(raw,ctx={}){
    const task=typeof base.detailModel==='function'?base.detailModel(raw,ctx):raw;
    const overdue=isOverdue(task,ctx.now),classes='tpv2-task-card'+(overdue?' is-overdue':'');
    return `<article class="${classes}" data-task-id="${esc(task.id)}" data-priority="${esc(task.priority)}" data-status="${esc(task.status)}" tabindex="0" role="button">
      <div class="tpv2-task-card-head"><span class="tpv2-priority">${esc(task.priority||'P2')}</span>${overdue?`<span class="tpv2-badge tpv2-overdue">${esc(translated('taskV2.planner.overdue',null,'Overdue'))}</span>`:''}</div>
      <h3>${esc(task.title||translated('taskV2.task',null,'Task'))}</h3>
      <p class="tpv2-task-customer">${esc(task.customerName||'')}</p>
      <div class="tpv2-task-meta"><span>${esc(task.status||'open')}</span><span>${esc(q(task.dueAt).slice(0,16).replace('T',' · '))}</span></div>
    </article>`;
  }

  function dailySummaryHtml(ctx={}){
    const state=obj(ctx.state)?ctx.state:{tasks:[]},now=nowOf(ctx),today=dayKey(now);
    const todayTasks=arr(state.tasks).filter(t=>activeTask(t)&&taskDay(t)===today);
    const count=todayTasks.length,critical=todayTasks.filter(t=>q(t&&t.priority)==='P0').length,overdue=todayTasks.filter(t=>isOverdue(t,now)).length;
    const text=translated('taskV2.planner.todaySummary',{count,critical,overdue},'Today: {count} tasks · {critical} critical · {overdue} overdue');
    return `<section class="tpv2-daily-summary" data-tpv2-daily-summary><strong>${esc(text)}</strong></section>`;
  }
  function renderDailySummary(target,ctx={}){if(!target)throw new Error('Planner summary target missing');target.innerHTML=dailySummaryHtml(ctx);return target;}

  function overdueHtml(ctx={}){
    const state=obj(ctx.state)?ctx.state:{tasks:[]},now=nowOf(ctx),tasks=sorted(arr(state.tasks).filter(t=>isOverdue(t,now)),now);
    return `<section class="tpv2-overdue-section" data-tpv2-overdue><header><h2>${esc(translated('taskV2.planner.overdue',null,'Overdue'))}</h2><span>${tasks.length}</span></header>${tasks.length?`<div class="tpv2-overdue-grid">${tasks.map(t=>taskCardHtml(t,ctx)).join('')}</div>`:`<p class="tpv2-empty">${esc(translated('taskV2.planner.noOverdue',null,'No overdue tasks'))}</p>`}</section>`;
  }
  function renderOverdue(target,ctx={}){if(!target)throw new Error('Planner overdue target missing');target.innerHTML=overdueHtml(ctx);return target;}

  function weekDayHtml(date,tasks,ctx,scope){
    const weekday=new Intl.DateTimeFormat(undefined,{weekday:'short',day:'2-digit',month:'2-digit'}).format(new Date(date+'T12:00:00Z'));
    const cards=sorted(tasks,ctx.now).map(t=>taskCardHtml(t,ctx)).join('');
    return `<section class="tpv2-day" data-tpv2-drop-date="${esc(date)}" data-i218-drop-date="${esc(date)}" data-week-scope="${esc(scope)}"><header><strong>${esc(weekday)}</strong><span>${tasks.length}</span></header><div class="tpv2-day-tasks">${cards}</div></section>`;
  }
  function weekSectionHtml(start,scope,ctx){
    const state=obj(ctx.state)?ctx.state:{tasks:[]},days=Array.from({length:5},(_,i)=>addDays(start,i));
    const label=scope==='next'?translated('taskV2.planner.nextWeek',null,'Next week'):translated('taskV2.planner.currentWeek',null,'Current week');
    const cls='tpv2-week'+(scope==='next'?' tpv2-week-next':'');
    const active=arr(state.tasks).filter(t=>activeTask(t)&&!isOverdue(t,ctx.now));
    return `<section class="${cls}" data-week-scope="${scope}"><header class="tpv2-week-head"><h2>${esc(label)}</h2><span>${esc(start)} – ${esc(addDays(start,4))}</span></header><div class="tpv2-week-grid">${days.map(date=>weekDayHtml(date,active.filter(t=>taskDay(t)===date),ctx,scope)).join('')}</div></section>`;
  }
  function workweekHtml(ctx={}){
    const start=mondayOf(ctx.weekStart||nowOf(ctx)),draft=ctx.weekDraft||null;
    const overload=draft&&draft.overloaded===true?`<div class="tpv2-overload" data-tpv2-overload role="status">${esc(translated('taskV2.planner.overload',null,'This week is overloaded.'))}</div>`:'';
    return `<div class="tpv2-workweeks" data-tpv2-workweek>${overload}${weekSectionHtml(start,'current',ctx)}${weekSectionHtml(addDays(start,7),'next',ctx)}</div>`;
  }
  function renderWorkweek(target,ctx={}){if(!target)throw new Error('Planner workweek target missing');target.innerHTML=workweekHtml(ctx);return target;}

  function monthHtml(ctx={}){
    const now=nowOf(ctx),today=dayKey(now),date=new Date((ctx.year||Number(today.slice(0,4)))+'-'+String(ctx.month||Number(today.slice(5,7))).padStart(2,'0')+'-01T12:00:00Z');
    const year=Number(ctx.year||date.getUTCFullYear()),month=Number(ctx.month||date.getUTCMonth()+1),projection=planner().monthProjection({tasks:arr(ctx.state&&ctx.state.tasks),year,month,now,calendar:ctx.calendar});
    const byDate=new Map(arr(projection&&projection.days).map(row=>[q(row.date),row])),days=new Date(Date.UTC(year,month,0)).getUTCDate(),cells=[];
    for(let day=1;day<=days;day++){
      const key=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,row=byDate.get(key)||{taskCount:0,overdueCount:0,criticalCount:0,doneCount:0};
      cells.push(`<button type="button" class="tpv2-month-day${key===today?' is-today':''}" data-day-summary="${key}" aria-label="${key}"><strong>${day}</strong><span>${row.taskCount}</span>${row.overdueCount?`<em>${row.overdueCount}</em>`:''}</button>`);
    }
    return `<section class="tpv2-month" data-tpv2-month><header class="tpv2-month-head"><h2>${esc(translated('taskV2.planner.month',null,'Month'))}</h2><span>${String(month).padStart(2,'0')}/${year}</span></header><div class="tpv2-month-grid">${cells.join('')}</div></section>`;
  }
  function renderMonth(target,ctx={}){if(!target)throw new Error('Planner month target missing');target.innerHTML=monthHtml(ctx);return target;}

  function runtimeOf(ctx){return ctx&&ctx.runtime||root.ExportHUBRC1014TaskRuntime||null;}
  function actionContext(ctx={}){
    const next={...(ctx||{})};
    if(!obj(next.state))next.state={tasks:[]};
    if(!Array.isArray(next.state.tasks))next.state.tasks=[];
    if(typeof next.persist!=='function'){
      next.persist=tasks=>{
        next.state.tasks=tasks;
        try{if(root.ExportHUBClean&&typeof root.ExportHUBClean.queueSave==='function')return root.ExportHUBClean.queueSave('TaskPlanner V2 task update');}catch(_){}
        return false;
      };
    }
    return next;
  }
  async function copyPublicUrl(url){
    if(!q(url))return false;
    try{if(root.navigator&&root.navigator.clipboard&&typeof root.navigator.clipboard.writeText==='function'){await root.navigator.clipboard.writeText(url);return true;}}catch(_){}
    return false;
  }
  async function handlePublicLinkAction(action,taskId,ctx={}){
    const type=q(action),id=q(taskId);if(!id)return{changed:false,task:null};
    const resolved=actionContext(ctx);
    if(type==='public-link-create'){
      const fields=arr(ctx.publicLinkFields).length?arr(ctx.publicLinkFields):DEFAULT_PUBLIC_FIELDS;
      const result=await base.createPublicLink(id,fields,resolved);
      if(result&&result.changed){await copyPublicUrl(result.url);if(typeof ctx.onPublicLinkCreated==='function')ctx.onPublicLinkCreated(result);}
      return result;
    }
    if(type==='public-link-revoke'){
      const result=base.revokePublicLink(id,resolved);
      if(result&&result.changed&&typeof ctx.onPublicLinkRevoked==='function')ctx.onPublicLinkRevoked(result);
      return result;
    }
    return{changed:false,task:null};
  }
  function plannedAtForDate(task,date){
    const source=q(task&&task.plannedAt)||q(task&&task.dueAt),time=(source.match(/T(\d{2}:\d{2})(?::\d{2})?/)||[])[1]||'09:00',offset=(source.match(/(Z|[+-]\d{2}:\d{2})$/)||[])[1]||'';
    return `${date}T${time}:00${offset}`;
  }
  function bindPlannerDnD(target,ctx={}){
    if(!target||typeof target.addEventListener!=='function')return()=>{};
    let activeId='';
    const taskFrom=node=>node&&typeof node.closest==='function'?node.closest('[data-task-id]'):null;
    const readId=node=>q(node&&typeof node.getAttribute==='function'&&node.getAttribute('data-task-id'));
    const down=e=>{const card=taskFrom(e&&e.target);activeId=readId(card)||activeId;};
    const up=e=>{
      const card=taskFrom(e&&e.target),taskId=readId(card)||activeId;activeId='';if(!taskId)return;
      const doc=target.ownerDocument||root.document,hit=doc&&typeof doc.elementFromPoint==='function'?doc.elementFromPoint(Number(e&&e.clientX)||0,Number(e&&e.clientY)||0):null;
      const day=hit&&typeof hit.closest==='function'?hit.closest('[data-tpv2-drop-date], [data-i218-drop-date]'):null;if(!day)return;
      const date=q(day.getAttribute&&day.getAttribute('data-tpv2-drop-date'))||q(day.getAttribute&&day.getAttribute('data-i218-drop-date'));if(!date)return;
      const state=obj(ctx.state)?ctx.state:{tasks:[]},task=arr(state.tasks).find(t=>q(t&&t.id)===taskId);if(!task)return;
      const runtime=runtimeOf(ctx),move=runtime&&runtime.plannerV2&&runtime.plannerV2.moveTaskOccurrence;if(typeof move!=='function')return;
      move(taskId,plannedAtForDate(task,date),{...ctx,state});
    };
    target.addEventListener('pointerdown',down);target.addEventListener('pointerup',up);
    return()=>{if(typeof target.removeEventListener==='function'){target.removeEventListener('pointerdown',down);target.removeEventListener('pointerup',up);}};
  }

  function plannerPageHtml(ctx,view){
    const current=view==='month'?'month':'workweek';
    return `<section class="tpv2-planner" data-taskplanner-v2-planner data-view="${current}">
      <header class="tpv2-planner-head"><div><span class="tpv2-eyebrow">TaskPlanner V2</span><h1>${esc(translated('taskV2.planner.title',null,'Task planner'))}</h1></div><div class="tpv2-view-toggle" role="group"><button type="button" data-tpv2-view="workweek" aria-pressed="${current==='workweek'}">${esc(translated('taskV2.planner.workweek',null,'Workweek'))}</button><button type="button" data-tpv2-view="month" aria-pressed="${current==='month'}">${esc(translated('taskV2.planner.month',null,'Month'))}</button></div></header>
      ${dailySummaryHtml(ctx)}${overdueHtml(ctx)}<div class="tpv2-planner-view" data-tpv2-planner-view>${current==='month'?monthHtml(ctx):workweekHtml(ctx)}</div>
      <div class="tpv2-planner-detail-host" data-tpv2-detail-host></div>
    </section>`;
  }
  function renderPlannerPage(target,ctx={}){
    if(!target)throw new Error('Planner target missing');
    const view=q(ctx.view||target.__tpv2View)==='month'?'month':'workweek';target.__tpv2View=view;target.__tpv2Ctx=ctx;target.innerHTML=plannerPageHtml(ctx,view);
    if(target.__tpv2DndCleanup){try{target.__tpv2DndCleanup();}catch(_){}}
    target.__tpv2DndCleanup=view==='workweek'?bindPlannerDnD(target,{...ctx,state:ctx.state||{},runtime:runtimeOf(ctx)}):null;
    if(typeof target.addEventListener==='function'&&!target.__tpv2ViewBound){
      target.__tpv2ViewBound=true;
      target.addEventListener('click',async event=>{
        const eventTarget=event&&event.target,closest=selector=>eventTarget&&typeof eventTarget.closest==='function'?eventTarget.closest(selector):null;
        const viewButton=closest('[data-tpv2-view]');
        if(viewButton){const next=q(viewButton.getAttribute('data-tpv2-view'));if(['workweek','month'].includes(next)){target.__tpv2View=next;renderPlannerPage(target,{...(target.__tpv2Ctx||ctx),view:next});}return;}
        const detailHost=typeof target.querySelector==='function'?target.querySelector('[data-tpv2-detail-host]'):null,currentCtx=target.__tpv2Ctx||ctx;
        const actionButton=closest('[data-action]');
        if(actionButton){
          const action=q(actionButton.getAttribute&&actionButton.getAttribute('data-action')),owner=closest('[data-task-id]'),taskId=q(owner&&owner.getAttribute&&owner.getAttribute('data-task-id'));
          if(action==='close'){if(detailHost)detailHost.innerHTML='';return;}
          if(action==='public-link-create'||action==='public-link-revoke'){
            const result=await handlePublicLinkAction(action,taskId,currentCtx);if(result&&result.changed&&detailHost)base.renderDetail(detailHost,taskId,currentCtx);return;
          }
          if(action==='complete'&&taskId&&typeof base.completeTask==='function'){const result=base.completeTask(taskId,{},actionContext(currentCtx));if(result&&result.changed)renderPlannerPage(target,{...currentCtx,view:target.__tpv2View});return;}
          if(action==='cancel'&&taskId&&typeof base.cancelTask==='function'){const result=base.cancelTask(taskId,actionContext(currentCtx));if(result&&result.changed)renderPlannerPage(target,{...currentCtx,view:target.__tpv2View});return;}
        }
        const card=closest('.tpv2-task-card[data-task-id]');
        if(card&&detailHost&&typeof base.renderDetail==='function'){const taskId=q(card.getAttribute&&card.getAttribute('data-task-id'));if(taskId)base.renderDetail(detailHost,taskId,currentCtx);}
      });
    }
    return target;
  }

  root.ExportHUBTaskUIV2=Object.freeze({...base,renderDailySummary,renderOverdue,renderWorkweek,renderMonth,bindPlannerDnD,handlePublicLinkAction,renderPlannerPage});
})(globalThis);