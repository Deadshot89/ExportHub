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
  function recurrence(){return root.ExportHUBTaskRecurrenceV2||null;}
  function calendarOf(ctx){const rec=recurrence();return ctx&&ctx.calendar||(rec&&typeof rec.calendar==='function'?rec.calendar({}):null);}
  function nonWorkOf(date,ctx){const rec=recurrence();try{return rec&&typeof rec.nonWorkReason==='function'?rec.nonWorkReason(date,calendarOf(ctx)):null;}catch(_){return null;}}
  function nonWorkLabel(reason){
    if(!reason||reason.type==='weekend')return'';
    if(reason.type==='nrw_holiday')return q(reason.label)||translated('taskV2.planner.holiday',null,'Public holiday');
    return q(reason.label)||translated('taskV2.planner.closure',null,'Company closure');
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
  function sorted(tasks,now){
    const list=arr(tasks);
    try{
      const rank=new Map(planner().orderTasks(list,now).map((t,i)=>[q(t&&t.id),i]));
      return list.slice().sort((a,b)=>(rank.get(q(a&&a.id))??Infinity)-(rank.get(q(b&&b.id))??Infinity));
    }catch(_){return list.slice();}
  }
  function interpolateFallback(template,vars){let text=String(template||'');for(const [name,value] of Object.entries(vars||{}))text=text.replaceAll('{'+name+'}',String(value));return text;}
  function translated(key,vars,fallback){const value=tr(key,vars,'');return value&&value!==key?value:interpolateFallback(fallback,vars);}

  function taskCardHtml(raw,ctx={}){
    const task=typeof base.detailModel==='function'?base.detailModel(raw,ctx):raw;
    const overdue=isOverdue(task,ctx.now),classes='tpv2-task-card'+(overdue?' is-overdue':'');
    let overdueDays=0;if(overdue){try{overdueDays=Number(core().derive(task,nowOf(ctx)).overdueDays)||0;}catch(_){}}
    const overdueText=overdueDays>0?translated('taskV2.overdueDays',{count:overdueDays},'{count} days overdue'):translated('taskV2.planner.overdue',null,'Overdue');
    return `<article class="${classes}" data-task-id="${esc(task.id)}" data-priority="${esc(task.priority)}" data-status="${esc(task.status)}" tabindex="0" role="button" aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight">
      <div class="tpv2-task-card-head"><span class="tpv2-priority">${esc(task.priority||'P2')}</span>${overdue?`<span class="tpv2-badge tpv2-overdue">${esc(overdueText)}</span>`:''}</div>
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
    const cards=sorted(tasks,ctx.now).map(t=>taskCardHtml(t,ctx)).join(''),label=nonWorkLabel(nonWorkOf(date,ctx));
    const cls='tpv2-day'+(label?' is-nonwork':'')+(date===dayKey(nowOf(ctx))?' is-today':'');
    return `<section class="${cls}" data-tpv2-drop-date="${esc(date)}" data-i218-drop-date="${esc(date)}" data-week-scope="${esc(scope)}"><header><strong>${esc(weekday)}</strong><span>${tasks.length}</span></header>${label?`<p class="tpv2-day-nonwork" data-tpv2-nonwork>${esc(label)}</p>`:''}<div class="tpv2-day-tasks">${cards}</div></section>`;
  }
  function weekSectionHtml(start,scope,ctx){
    const state=obj(ctx.state)?ctx.state:{tasks:[]},days=Array.from({length:5},(_,i)=>addDays(start,i));
    const label=scope==='next'?translated('taskV2.planner.nextWeek',null,'Next week'):translated('taskV2.planner.currentWeek',null,'Current week');
    const cls='tpv2-week'+(scope==='next'?' tpv2-week-next':'');
    const active=arr(state.tasks).filter(t=>activeTask(t)&&!isOverdue(t,ctx.now));
    return `<section class="${cls}" data-week-scope="${scope}"><header class="tpv2-week-head"><h2>${esc(label)}</h2><span>${esc(start)} – ${esc(addDays(start,4))}</span></header><div class="tpv2-week-grid">${days.map(date=>weekDayHtml(date,active.filter(t=>taskDay(t)===date),ctx,scope)).join('')}</div></section>`;
  }
  function unplannedHtml(ctx={}){
    const state=obj(ctx.state)?ctx.state:{tasks:[]},tasks=sorted(arr(state.tasks).filter(t=>activeTask(t)&&!taskDay(t)),ctx.now);
    if(!tasks.length)return'';
    return `<section class="tpv2-unplanned" data-tpv2-unplanned><header><h2>${esc(translated('taskV2.planner.unplanned',null,'Without date'))}</h2><span>${tasks.length}</span></header><p class="tpv2-empty">${esc(translated('taskV2.planner.unplannedHint',null,'Drag a task onto a day to plan it.'))}</p><div class="tpv2-unplanned-grid">${tasks.map(t=>taskCardHtml(t,ctx)).join('')}</div></section>`;
  }
  function navHtml(kind,label,canPrev){
    return `<div class="tpv2-nav" role="group" data-tpv2-nav-group="${kind}"><button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-nav="${kind}-prev" aria-label="${esc(translated('taskV2.planner.previous',null,'Previous'))}"${canPrev?'':' disabled'}>‹</button><button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-nav="${kind}-today">${esc(translated('taskV2.planner.today',null,'Today'))}</button><button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-nav="${kind}-next" aria-label="${esc(translated('taskV2.planner.next',null,'Next'))}">›</button><strong>${esc(label)}</strong></div>`;
  }
  function workweekHtml(ctx={}){
    const start=mondayOf(ctx.weekStart||nowOf(ctx)),draft=ctx.weekDraft||null;
    const overload=draft&&draft.overloaded===true?`<div class="tpv2-overload" data-tpv2-overload role="status">${esc(translated('taskV2.planner.overload',null,'This week is overloaded.'))}</div>`:'';
    const nav=ctx.navigation===true?navHtml('week',`${start} – ${addDays(start,11)}`,start>mondayOf(nowOf(ctx))):'';
    return `<div class="tpv2-workweeks" data-tpv2-workweek>${nav}${overload}${unplannedHtml(ctx)}${weekSectionHtml(start,'current',ctx)}${weekSectionHtml(addDays(start,7),'next',ctx)}</div>`;
  }
  function renderWorkweek(target,ctx={}){if(!target)throw new Error('Planner workweek target missing');target.innerHTML=workweekHtml(ctx);return target;}

  function monthOf(ctx){
    const today=dayKey(nowOf(ctx)),year=Number(ctx.year)||Number(today.slice(0,4)),month=Number(ctx.month)||Number(today.slice(5,7));
    return{year,month};
  }
  function shiftMonth(ym,delta){const d=new Date(Date.UTC(ym.year,ym.month-1+delta,1));return{year:d.getUTCFullYear(),month:d.getUTCMonth()+1};}
  function monthDayHtml(date,ctx){
    const state=obj(ctx.state)?ctx.state:{tasks:[]},tasks=sorted(arr(state.tasks).filter(t=>activeTask(t)&&taskDay(t)===date),ctx.now);
    const title=new Intl.DateTimeFormat(undefined,{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(date+'T12:00:00Z')),label=nonWorkLabel(nonWorkOf(date,ctx));
    return `<section class="tpv2-month-detail" data-tpv2-month-detail="${esc(date)}"><header><h3>${esc(title)}</h3>${label?`<span class="tpv2-day-nonwork">${esc(label)}</span>`:''}<button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-month-day-close>${esc(translated('taskV2.planner.close',null,'Close'))}</button></header>${tasks.length?`<div class="tpv2-month-detail-grid">${tasks.map(t=>taskCardHtml(t,ctx)).join('')}</div>`:`<p class="tpv2-empty">${esc(translated('taskV2.planner.noTasksDay',null,'No open tasks on this day'))}</p>`}</section>`;
  }
  function monthHtml(ctx={}){
    const now=nowOf(ctx),today=dayKey(now),{year,month}=monthOf(ctx);
    const projection=planner().monthProjection({tasks:arr(ctx.state&&ctx.state.tasks),year,month,now,calendar:calendarOf(ctx)});
    const byDate=new Map(arr(projection&&projection.days).map(row=>[q(row.date),row])),days=new Date(Date.UTC(year,month,0)).getUTCDate(),cells=[];
    const first=new Date(Date.UTC(year,month-1,1)).getUTCDay()||7,weekdayFmt=new Intl.DateTimeFormat(undefined,{weekday:'short'});
    const heads=Array.from({length:7},(_,i)=>`<span class="tpv2-month-weekday" aria-hidden="true">${esc(weekdayFmt.format(new Date(Date.UTC(2024,0,1+i,12))))}</span>`).join('');
    for(let i=1;i<first;i++)cells.push('<span class="tpv2-month-pad" aria-hidden="true"></span>');
    for(let day=1;day<=days;day++){
      const key=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,row=byDate.get(key)||{taskCount:0,overdueCount:0,criticalCount:0,doneCount:0};
      const reason=row.nonWorkReason||null,label=nonWorkLabel(reason),cls='tpv2-month-day'+(key===today?' is-today':'')+(reason?(reason.type==='weekend'?' is-weekend':' is-nonwork'):'')+(key===q(ctx.monthDay)?' is-selected':'');
      const status=(row.criticalCount?`<i class="tpv2-dot is-critical" title="P0">${row.criticalCount}</i>`:'')+(row.doneCount?`<i class="tpv2-dot is-done">${row.doneCount}</i>`:'');
      cells.push(`<button type="button" class="${cls}" data-day-summary="${key}" aria-label="${esc(key+(label?' · '+label:''))}" aria-pressed="${key===q(ctx.monthDay)}"><strong>${day}</strong><span>${row.taskCount}</span>${label?`<small>${esc(label)}</small>`:''}${status?`<b class="tpv2-month-status">${status}</b>`:''}${row.overdueCount?`<em>${row.overdueCount}</em>`:''}</button>`);
    }
    const label=`${String(month).padStart(2,'0')}/${year}`,nav=ctx.navigation===true?navHtml('month',label,true):`<span>${label}</span>`;
    const detail=q(ctx.monthDay)&&q(ctx.monthDay).startsWith(`${year}-${String(month).padStart(2,'0')}-`)?monthDayHtml(q(ctx.monthDay),ctx):'';
    return `<section class="tpv2-month" data-tpv2-month><header class="tpv2-month-head"><h2>${esc(translated('taskV2.planner.month',null,'Month'))}</h2>${nav}</header><div class="tpv2-month-grid">${heads}${cells.join('')}</div>${detail}</section>`;
  }
  function renderMonth(target,ctx={}){if(!target)throw new Error('Planner month target missing');target.innerHTML=monthHtml(ctx);return target;}

  const WEEK_PLAN_CONFLICTS=Object.freeze({
    holiday:['taskV2.planner.conflictHoliday','Holiday or company closure'],
    dependency_cycle:['taskV2.planner.conflictCycle','Circular dependency'],
    missing_dependency:['taskV2.planner.conflictMissing','Dependency missing'],
    manual_dependency:['taskV2.planner.conflictManualDependency','Manually planned before its dependency'],
    deadline_dependency:['taskV2.planner.conflictDeadlineDependency','Dependency finishes after the deadline'],
    deadline_outside_week:['taskV2.planner.conflictDeadline','Deadline cannot be met this week']
  });
  function weekPlanDraft(ctx,mode){
    const state=obj(ctx&&ctx.state)?ctx.state:{tasks:[]};
    return planner().buildWeekDraft({tasks:arr(state.tasks),weekStart:mondayOf(ctx.weekStart||nowOf(ctx)),now:nowOf(ctx),calendar:ctx.calendar,recalculate:mode==='recalculate'||mode==='override',allowManualOverride:mode==='override'});
  }
  function weekPlanSummary(draft){
    const items=arr(draft&&draft.items),base=planner().weekSummary(draft),start=q(draft&&draft.weekStart),end=q(draft&&draft.weekEnd);
    const planned=items.filter(x=>{const d=q(x&&x.plannedDate);return d&&d>=start&&d<=end;}).length;
    const changes=items.filter(x=>q(x&&x.plannedDate)&&q(x.plannedDate)!==q(x.originalPlannedDate)&&x.manualProtected!==true).length;
    const blocking=base.holidayConflicts>0||arr(draft&&draft.conflicts).some(c=>c&&c.type==='dependency_cycle');
    const manualKept=items.filter(x=>x&&x.manualProtected===true).length;
    return{...base,planned,changes,manualKept,blocking};
  }
  function weekPlanHtml(draft,mode,ctx){
    const summary=weekPlanSummary(draft),state=obj(ctx.state)?ctx.state:{tasks:[]};
    const titleOf=id=>{const t=arr(state.tasks).find(x=>q(x&&x.id)===q(id));return q(t&&t.title)||q(id);};
    const stats=[
      [summary.planned,'taskV2.planner.planPlanned','Planned this week'],
      [summary.changes,'taskV2.planner.planChanges','Dates that will change'],
      [summary.autoMoved,'taskV2.planner.planAutoMoved','Moved automatically'],
      [summary.holidayConflicts,'taskV2.planner.planHolidayConflicts','Holiday conflicts'],
      [summary.dependencyConflicts,'taskV2.planner.planOpenDependencies','Open dependencies'],
      mode==='override'?[summary.manualChanges,'taskV2.planner.planManualChanged','Manual plans overwritten']:[summary.manualKept,'taskV2.planner.planManualKept','Manually planned, kept']
    ].map(([n,key,fallback])=>`<li><strong>${esc(n)}</strong><span>${esc(translated(key,null,fallback))}</span></li>`).join('');
    const conflicts=arr(draft.conflicts).map(c=>{
      const [key,fallback]=WEEK_PLAN_CONFLICTS[q(c&&c.type)]||['taskV2.planner.conflict','Conflict'];
      return `<li data-conflict-type="${esc(c&&c.type)}"><strong>${esc(titleOf(c&&c.taskId))}</strong><span>${esc(translated(key,null,fallback))}</span></li>`;
    }).join('');
    const title=mode==='override'?translated('taskV2.planner.overrideTitle',null,'Recalculated incl. manual plans'):mode==='recalculate'?translated('taskV2.planner.recalculateTitle',null,'Recalculated week plan'):translated('taskV2.planner.planTitle',null,'Week plan draft');
    const note=summary.blocking?`<p class="tpv2-weekplan-note" role="alert">${esc(translated('taskV2.planner.planBlocked',null,'Resolve holiday and dependency conflicts before applying the plan.'))}</p>`
      :mode==='override'&&summary.manualChanges?`<p class="tpv2-weekplan-note" role="alert">${esc(translated('taskV2.planner.overrideWarning',{count:summary.manualChanges},'{count} manually planned tasks will be moved. Apply only if that is intended.'))}</p>`
      :!summary.changes?`<p class="tpv2-weekplan-note">${esc(translated('taskV2.planner.planNoChanges',null,'The plan does not change any dates.'))}</p>`:'';
    return `<section class="tpv2-weekplan" data-tpv2-weekplan-summary data-mode="${esc(mode)}"><header><h2>${esc(title)}</h2><span>${esc(draft.weekStart)} – ${esc(draft.weekEnd)}</span></header>
      <ul class="tpv2-weekplan-stats">${stats}</ul>${conflicts?`<ul class="tpv2-weekplan-conflicts">${conflicts}</ul>`:''}${note}
      <div class="tpv2-weekplan-actions"><button type="button" class="tpv2-button tpv2-button-primary" data-tpv2-weekplan="apply"${summary.blocking||!summary.changes?' disabled':''}>${esc(translated('taskV2.planner.planApply',null,'Apply week plan'))}</button>${mode==='recalculate'&&summary.manualKept?`<button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-weekplan="override">${esc(translated('taskV2.planner.overrideManual',null,'Also recalculate manual plans'))}</button>`:''}<button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-weekplan="discard">${esc(translated('taskV2.planner.planDiscard',null,'Discard'))}</button></div></section>`;
  }
  function weekPlanToolbarHtml(){
    return `<div class="tpv2-weekplan-toolbar" role="group"><button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-weekplan="plan">${esc(translated('taskV2.planner.planWeek',null,'Plan week'))}</button><button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-weekplan="recalculate">${esc(translated('taskV2.planner.recalculate',null,'Recalculate'))}</button></div>`;
  }

  function runtimeOf(ctx){return ctx&&ctx.runtime||root.ExportHUBRC1014TaskRuntime||null;}
  function userIdOf(ctx){const u=ctx&&ctx.user;return q(u&&(u.id||u.userId||u.username)||ctx&&ctx.userId);}
  function actionContext(ctx={}){
    const next={...(ctx||{})};
    if(!obj(next.state))next.state={tasks:[]};
    if(!Array.isArray(next.state.tasks))next.state.tasks=[];
    if(!obj(next.user)){try{const u=typeof root.__EXPORTHUB_GET_CURRENT_USER__==='function'?root.__EXPORTHUB_GET_CURRENT_USER__():null;if(obj(u))next.user=u;}catch(_){}}
    if(!obj(next.user)&&obj(next.state.currentUser))next.user=next.state.currentUser;
    if(typeof next.persist!=='function'){
      next.persist=value=>{
        if(Array.isArray(value)&&value!==next.state.taskTemplates)next.state.tasks=value;
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
    let activeId='',activeCard=null,startX=0,startY=0,dragging=false,hoverDay=null;
    const taskFrom=node=>node&&typeof node.closest==='function'?node.closest('[data-task-id]'):null;
    const readId=node=>q(node&&typeof node.getAttribute==='function'&&node.getAttribute('data-task-id'));
    const dayFrom=node=>node&&typeof node.closest==='function'?node.closest('[data-tpv2-drop-date], [data-i218-drop-date]'):null;
    const dateOf=day=>q(day&&day.getAttribute&&day.getAttribute('data-tpv2-drop-date'))||q(day&&day.getAttribute&&day.getAttribute('data-i218-drop-date'));
    const toggle=(node,cls,on)=>{try{if(node&&node.classList)node.classList.toggle(cls,on);}catch(_){}};
    const hit=e=>{const doc=target.ownerDocument||root.document;return doc&&typeof doc.elementFromPoint==='function'?doc.elementFromPoint(Number(e&&e.clientX)||0,Number(e&&e.clientY)||0):null;};
    const reset=()=>{toggle(activeCard,'is-dragging',false);toggle(hoverDay,'is-drop-target',false);activeId='';activeCard=null;dragging=false;hoverDay=null;};
    function moveTo(taskId,date){
      const state=obj(ctx.state)?ctx.state:{tasks:[]},task=arr(state.tasks).find(t=>q(t&&t.id)===taskId);if(!task||!date||taskDay(task)===date)return false;
      const runtime=runtimeOf(ctx),move=runtime&&(typeof runtime.moveTaskOccurrence==='function'?runtime.moveTaskOccurrence:(runtime.plannerV2&&runtime.plannerV2.moveTaskOccurrence));if(typeof move!=='function')return false;
      move(taskId,plannedAtForDate(task,date),{...ctx,state});return true;
    }
    const down=e=>{const card=taskFrom(e&&e.target);activeCard=card||null;activeId=readId(card)||activeId;startX=Number(e&&e.clientX)||0;startY=Number(e&&e.clientY)||0;dragging=false;};
    const moveHandler=e=>{
      if(!activeId)return;
      if(!dragging&&Math.hypot((Number(e&&e.clientX)||0)-startX,(Number(e&&e.clientY)||0)-startY)<6)return;
      if(!dragging){dragging=true;toggle(activeCard,'is-dragging',true);}
      const day=dayFrom(hit(e));if(day!==hoverDay){toggle(hoverDay,'is-drop-target',false);hoverDay=day;toggle(hoverDay,'is-drop-target',true);}
    };
    const up=e=>{
      const card=taskFrom(e&&e.target),taskId=readId(card)||activeId;reset();if(!taskId)return;
      const date=dateOf(dayFrom(hit(e)));if(!date)return;
      moveTo(taskId,date);
    };
    const key=e=>{
      if(!e||!e.altKey||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;
      const card=taskFrom(e.target),taskId=readId(card);if(!taskId||typeof target.querySelectorAll!=='function')return;
      const dates=[];for(const node of Array.from(target.querySelectorAll('[data-tpv2-drop-date]')))if(!dates.includes(dateOf(node)))dates.push(dateOf(node));
      const state=obj(ctx.state)?ctx.state:{tasks:[]},task=arr(state.tasks).find(t=>q(t&&t.id)===taskId),current=dates.indexOf(taskDay(task));
      const next=current<0?(e.key==='ArrowRight'?0:-1):current+(e.key==='ArrowRight'?1:-1);
      if(next<0||next>=dates.length)return;
      if(typeof e.preventDefault==='function')e.preventDefault();
      moveTo(taskId,dates[next]);
    };
    target.addEventListener('pointerdown',down);target.addEventListener('pointermove',moveHandler);target.addEventListener('pointerup',up);target.addEventListener('pointercancel',reset);target.addEventListener('keydown',key);
    return()=>{if(typeof target.removeEventListener==='function'){target.removeEventListener('pointerdown',down);target.removeEventListener('pointermove',moveHandler);target.removeEventListener('pointerup',up);target.removeEventListener('pointercancel',reset);target.removeEventListener('keydown',key);}};
  }

  function openDetail(target,detailHost,taskId,ctx,card){
    base.renderDetail(detailHost,taskId,ctx);target.__tpv2DetailCard=card||null;
    const panel=typeof detailHost.querySelector==='function'?detailHost.querySelector('[data-taskplanner-v2-detail]'):null;
    if(panel&&typeof panel.setAttribute==='function'){panel.setAttribute('tabindex','-1');panel.setAttribute('role','dialog');}
    try{if(panel&&typeof panel.focus==='function')panel.focus({preventScroll:true});}catch(_){}
  }
  function closeDetail(target,detailHost){
    if(detailHost)detailHost.innerHTML='';
    const card=target.__tpv2DetailCard;target.__tpv2DetailCard=null;
    try{if(card&&typeof card.focus==='function')card.focus();}catch(_){}
  }
  function plannerPageHtml(ctx,view){
    const current=view==='month'?'month':'workweek',mode=current==='workweek'?q(ctx.weekPlanMode):'';
    let draft=null,weekPlan='';
    if(mode){
      try{draft=weekPlanDraft(ctx,mode);weekPlan=weekPlanHtml(draft,mode,ctx);}
      catch(error){weekPlan=`<p class="tpv2-weekplan-note" role="alert">${esc(error&&error.message||error)}</p>`;}
    }
    const viewCtx=draft?{...ctx,weekDraft:draft}:ctx;
    const density=q(ctx.density)==='compact'?'compact':'detailed';
    return `<section class="tpv2-planner" data-taskplanner-v2-planner data-view="${current}" data-density="${density}">
      <header class="tpv2-planner-head"><div><span class="tpv2-eyebrow">TaskPlanner V2</span><h1>${esc(translated('taskV2.planner.title',null,'Task planner'))}</h1></div><div class="tpv2-view-toggle" role="group" data-tpv2-density-toggle><button type="button" data-tpv2-density="compact" aria-pressed="${density==='compact'}">${esc(translated('taskV2.view.compact',null,'Compact'))}</button><button type="button" data-tpv2-density="detailed" aria-pressed="${density==='detailed'}">${esc(translated('taskV2.view.detailed',null,'Detailed'))}</button></div><div class="tpv2-view-toggle" role="group"><button type="button" data-tpv2-view="workweek" aria-pressed="${current==='workweek'}">${esc(translated('taskV2.planner.workweek',null,'Workweek'))}</button><button type="button" data-tpv2-view="month" aria-pressed="${current==='month'}">${esc(translated('taskV2.planner.month',null,'Month'))}</button></div></header>
      ${dailySummaryHtml(ctx)}${current==='workweek'?weekPlanToolbarHtml()+weekPlan:''}${overdueHtml(ctx)}<div class="tpv2-planner-view" data-tpv2-planner-view>${current==='month'?monthHtml(ctx):workweekHtml(viewCtx)}</div>
      <div class="tpv2-planner-detail-host" data-tpv2-detail-host></div>
    </section>`;
  }
  function renderPlannerPage(target,ctx={}){
    if(!target)throw new Error('Planner target missing');
    const view=q(ctx.view||target.__tpv2View)==='month'?'month':'workweek';target.__tpv2View=view;target.__tpv2Ctx=ctx;
    const mode=ctx.weekPlanMode!==undefined?q(ctx.weekPlanMode):q(target.__tpv2WeekPlanMode);target.__tpv2WeekPlanMode=mode;
    const ym=ctx.year&&ctx.month?{year:Number(ctx.year),month:Number(ctx.month)}:target.__tpv2Month||monthOf(ctx);target.__tpv2Month=ym;
    const monthDay=ctx.monthDay!==undefined?q(ctx.monthDay):q(target.__tpv2MonthDay);target.__tpv2MonthDay=monthDay;
    const weekStart=q(target.__tpv2WeekStart)||ctx.weekStart;
    let density=q(target.__tpv2Density);
    if(!density){try{density=typeof base.viewPreference==='function'&&userIdOf(actionContext(ctx))?base.viewPreference(actionContext(ctx)):'';}catch(_){density='';}}
    target.innerHTML=plannerPageHtml({...ctx,weekStart,weekPlanMode:mode,navigation:true,year:ym.year,month:ym.month,monthDay,density},view);
    if(target.__tpv2DndCleanup){try{target.__tpv2DndCleanup();}catch(_){}}
    target.__tpv2DndCleanup=view==='workweek'?bindPlannerDnD(target,{...ctx,weekStart,state:ctx.state||{},runtime:runtimeOf(ctx)}):null;
    if(typeof target.addEventListener==='function'&&!target.__tpv2ViewBound){
      target.__tpv2ViewBound=true;
      target.addEventListener('keydown',event=>{
        if(!event||event.key!=='Escape'||typeof target.querySelector!=='function')return;
        const detailHost=target.querySelector('[data-tpv2-detail-host]');
        if(detailHost&&q(detailHost.innerHTML)){if(typeof event.preventDefault==='function')event.preventDefault();closeDetail(target,detailHost);}
      });
      target.addEventListener('click',async event=>{
        const eventTarget=event&&event.target,closest=selector=>eventTarget&&typeof eventTarget.closest==='function'?eventTarget.closest(selector):null;
        const viewButton=closest('[data-tpv2-view]');
        if(viewButton){const next=q(viewButton.getAttribute('data-tpv2-view'));if(['workweek','month'].includes(next)){target.__tpv2View=next;renderPlannerPage(target,{...(target.__tpv2Ctx||ctx),view:next});}return;}
        const detailHost=typeof target.querySelector==='function'?target.querySelector('[data-tpv2-detail-host]'):null,currentCtx=target.__tpv2Ctx||ctx;
        const densityButton=closest('[data-tpv2-density]');
        if(densityButton){
          const next=q(densityButton.getAttribute('data-tpv2-density'))==='compact'?'compact':'detailed',resolved=actionContext(currentCtx);
          target.__tpv2Density=next;
          if(userIdOf(resolved)&&typeof base.setViewPreference==='function'){try{base.setViewPreference(next,resolved);}catch(_){}}
          renderPlannerPage(target,{...currentCtx,view:target.__tpv2View});return;
        }
        const navButton=closest('[data-tpv2-nav]');
        if(navButton){
          const action=q(navButton.getAttribute('data-tpv2-nav')),now=nowOf(currentCtx);
          if(action.startsWith('week-')){
            const current=mondayOf(q(target.__tpv2WeekStart)||currentCtx.weekStart||now),floor=mondayOf(now);
            let next=action==='week-today'?floor:addDays(current,action==='week-next'?7:-7);if(next<floor)next=floor;
            const legacy=root.ExportHUBIndex218;
            if(legacy&&typeof legacy.setWeek==='function'&&!target.__tpv2WeekStart){legacy.setWeek(next);return;}
            target.__tpv2WeekStart=next;renderPlannerPage(target,{...currentCtx,view:'workweek'});return;
          }
          const ym=action==='month-today'?monthOf({now}):shiftMonth(target.__tpv2Month||monthOf(currentCtx),action==='month-next'?1:-1);
          target.__tpv2Month=ym;target.__tpv2MonthDay='';
          renderPlannerPage(target,{...currentCtx,view:'month',year:ym.year,month:ym.month,monthDay:''});return;
        }
        const monthDayButton=closest('[data-day-summary]');
        if(monthDayButton){
          const date=q(monthDayButton.getAttribute('data-day-summary')),selected=date===q(target.__tpv2MonthDay)?'':date;
          renderPlannerPage(target,{...currentCtx,view:'month',monthDay:selected});return;
        }
        if(closest('[data-tpv2-month-day-close]')){renderPlannerPage(target,{...currentCtx,view:'month',monthDay:''});return;}
        const weekPlanButton=closest('[data-tpv2-weekplan]');
        if(weekPlanButton){
          const action=q(weekPlanButton.getAttribute('data-tpv2-weekplan')),rerender=mode=>renderPlannerPage(target,{...currentCtx,view:'workweek',weekPlanMode:mode});
          if(action==='plan'||action==='recalculate'||action==='override'){rerender(action);return;}
          if(action==='discard'){rerender('');return;}
          if(action==='apply'){
            const mode=q(target.__tpv2WeekPlanMode)||'plan',runtime=runtimeOf(currentCtx),apply=runtime&&typeof runtime.applyWeekPlan==='function'?runtime.applyWeekPlan:null;
            if(!apply)return;
            const resolved=actionContext({...currentCtx,weekStart:q(target.__tpv2WeekStart)||currentCtx.weekStart,allowManualOverride:mode==='override'}),draft=weekPlanDraft(resolved,mode);
            if(weekPlanSummary(draft).blocking){rerender(mode);return;}
            apply(draft,resolved);rerender('');return;
          }
          return;
        }
        const actionButton=closest('[data-action]');
        if(actionButton){
          const action=q(actionButton.getAttribute&&actionButton.getAttribute('data-action')),owner=closest('[data-task-id]'),taskId=q(owner&&owner.getAttribute&&owner.getAttribute('data-task-id'));
          if(action==='close'){closeDetail(target,detailHost);return;}
          if(action==='public-link-create'||action==='public-link-revoke'){
            const result=await handlePublicLinkAction(action,taskId,currentCtx);if(result&&result.changed&&detailHost)base.renderDetail(detailHost,taskId,currentCtx);return;
          }
          const panel=closest('[data-taskplanner-v2-detail]'),field=name=>panel&&typeof panel.querySelector==='function'?panel.querySelector(`[${name}]`):null,reopen=note=>{if(detailHost)openDetail(target,detailHost,taskId,{...currentCtx,detailNote:note||''},target.__tpv2DetailCard);};
          if(action==='checklist-toggle'&&taskId&&typeof base.toggleChecklistItem==='function'){const result=base.toggleChecklistItem(taskId,actionButton.getAttribute('data-index'),actionContext(currentCtx));if(result&&result.changed)reopen();return;}
          if((action==='reminder-toggle'||action==='reminder-email')&&taskId&&typeof base.toggleTaskReminder==='function'){const result=base.toggleTaskReminder(taskId,actionButton.getAttribute('data-time'),action==='reminder-email'?'email':'enabled',actionContext(currentCtx));if(result&&result.changed)reopen();return;}
          if(action==='comment-add'&&taskId&&typeof base.addComment==='function'){const input=field('data-tpv2-comment-input'),result=base.addComment(taskId,input&&input.value,actionContext(currentCtx));if(result&&result.changed)reopen();return;}
          if(action==='save-template'&&taskId&&typeof base.saveTaskAsTemplate==='function'){const result=base.saveTaskAsTemplate(taskId,actionContext(currentCtx));if(result&&result.changed)reopen(translated('taskV2.templateSaved',null,'Template saved'));return;}
          if(action==='complete'&&taskId&&typeof base.completeTask==='function'){const input=field('data-tpv2-complete-comment'),result=base.completeTask(taskId,{comment:q(input&&input.value)},actionContext(currentCtx));if(result&&result.changed)renderPlannerPage(target,{...currentCtx,view:target.__tpv2View});return;}
          if(action==='cancel'&&taskId&&typeof base.cancelTask==='function'){const result=base.cancelTask(taskId,actionContext(currentCtx));if(result&&result.changed)renderPlannerPage(target,{...currentCtx,view:target.__tpv2View});return;}
        }
        const card=closest('.tpv2-task-card[data-task-id]');
        if(card&&detailHost&&typeof base.renderDetail==='function'){const taskId=q(card.getAttribute&&card.getAttribute('data-task-id'));if(taskId)openDetail(target,detailHost,taskId,currentCtx,card);}
      });
    }
    return target;
  }

  // Reminder runner (spec §15): per-task slots, website channel in the browser, delivery ledger in
  // state.taskSettings so the same reminder is not shown again on another tab or device
  const reminderRunner={timer:0,started:false,lastPrune:''};
  function reminderEnvironment(){return /-testservice\./i.test(q(root.location&&root.location.hostname))?'testservice':'production';}
  function reminderUser(){try{const u=typeof root.__EXPORTHUB_GET_CURRENT_USER__==='function'?root.__EXPORTHUB_GET_CURRENT_USER__():null;return obj(u)?u:{};}catch(_){return{};}}
  function reminderState(){try{const s=typeof root.__EXPORTHUB_GET_STATE__==='function'?root.__EXPORTHUB_GET_STATE__():null;return obj(s)?s:null;}catch(_){return null;}}
  function claimReminder(key){
    try{const store=root.localStorage;if(!store)return true;const k='exporthub.tpv2.reminder:'+key;if(store.getItem(k))return false;store.setItem(k,String(Date.now()));return true;}catch(_){return true;}
  }
  function reminderToastHtml(rows){
    const shown=rows.slice(0,3),more=rows.length-shown.length;
    return `<section class="tpv2-reminder-toast" role="status" aria-live="polite" data-tpv2-reminder-toast>
      <header><strong>${esc(translated('taskV2.reminderTitle',null,'Task reminder'))}</strong><button type="button" class="tpv2-icon-button" data-tpv2-reminder-close aria-label="${esc(translated('taskV2.close',null,'Close'))}">×</button></header>
      <ul>${shown.map(r=>`<li data-task-id="${esc(r.taskId)}"><div><b>${esc(r.title)}</b><span>${esc([r.customerName,r.priority,r.slot].filter(Boolean).join(' · '))}</span></div><div class="tpv2-reminder-actions"><button type="button" class="tpv2-button tpv2-button-secondary" data-tpv2-reminder-open="${esc(r.taskId)}">${esc(translated('taskV2.open',null,'Open'))}</button><button type="button" class="tpv2-button tpv2-button-primary" data-tpv2-reminder-done="${esc(r.taskId)}">${esc(translated('taskV2.complete',null,'Complete'))}</button></div></li>`).join('')}</ul>
      ${more>0?`<p>${esc(translated('taskV2.reminderMore',{count:more},'+{count} more'))}</p>`:''}
    </section>`;
  }
  function closeReminderToast(){const doc=root.document,node=doc&&doc.getElementById&&doc.getElementById('tpv2ReminderToast');if(node)node.remove();}
  function showReminderToast(rows){
    const doc=root.document;if(!doc||!doc.body||typeof doc.createElement!=='function')return false;
    closeReminderToast();const host=doc.createElement('div');host.id='tpv2ReminderToast';host.className='tpv2-reminder-host';host.innerHTML=reminderToastHtml(rows);
    host.addEventListener('click',event=>{
      const el=event&&event.target&&typeof event.target.closest==='function'?event.target:null;if(!el)return;
      if(el.closest('[data-tpv2-reminder-close]')){closeReminderToast();return;}
      const open=el.closest('[data-tpv2-reminder-open]'),done=el.closest('[data-tpv2-reminder-done]'),state=reminderState();
      if(open&&state){const id=q(open.getAttribute('data-tpv2-reminder-open')),task=arr(state.tasks).find(t=>q(t&&t.id)===id),rt=runtimeOf({});closeReminderToast();try{if(task&&rt&&typeof rt.openTask==='function')rt.openTask(task,{state});}catch(_){}return;}
      if(done&&state){const id=q(done.getAttribute('data-tpv2-reminder-done'));try{base.completeTask(id,{},actionContext({state,user:reminderUser()}));}catch(_){}const item=done.closest('li');if(item)item.remove();if(!host.querySelector('li'))closeReminderToast();}
    });
    host.addEventListener('keydown',event=>{if(event&&event.key==='Escape')closeReminderToast();});
    doc.body.appendChild(host);return true;
  }
  function nativeReminder(rows){
    const N=root.Notification;if(typeof N!=='function'||N.permission!=='granted'||!rows.length)return false;
    try{
      const one=rows.length===1?rows[0]:null,title=one?translated('taskV2.reminderTitle',null,'Task reminder')+' · '+one.title:translated('taskV2.reminderTitle',null,'Task reminder');
      const body=rows.slice(0,3).map(r=>r.title).join('\n')+(rows.length>3?'\n'+translated('taskV2.reminderMore',{count:rows.length-3},'+{count} more'):'');
      const n=new N(title,{body,tag:'exporthub-tpv2-'+rows.map(r=>r.key).join(',').slice(0,120),silent:true});
      n.onclick=()=>{try{root.focus();}catch(_){}try{n.close();}catch(_){}};return true;
    }catch(_){return false;}
  }
  function localNowIso(date){
    const d=date||new Date(),z=n=>String(Math.abs(n)).padStart(2,'0'),off=-d.getTimezoneOffset();
    return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}${off>=0?'+':'-'}${z(Math.trunc(off/60))}:${z(off%60)}`;
  }
  function checkReminders(now){
    const state=reminderState(),user=reminderUser(),id=q(user.id||user.userId||user.username);
    if(!state||!id||typeof base.reminderCandidates!=='function')return[];
    const at=q(now)||localNowIso(),ctx=actionContext({state,user,now:at});
    const today=at.slice(0,10);
    if(reminderRunner.lastPrune!==today&&typeof base.pruneReminderLedger==='function'){reminderRunner.lastPrune=today;try{base.pruneReminderLedger(ctx);}catch(_){}}
    const rows=base.reminderCandidates(at,state,{id,environment:reminderEnvironment()},{catchUp:true}).filter(r=>r.channels&&r.channels.website===true);
    const delivered=[];
    for(const row of rows){if(!claimReminder(row.key))continue;const res=base.markReminderDelivered(row,ctx);if(res&&res.changed)delivered.push(row);}
    if(delivered.length){showReminderToast(delivered);nativeReminder(delivered);}
    return delivered;
  }
  function startReminders(){
    if(reminderRunner.started||typeof root.setInterval!=='function')return false;reminderRunner.started=true;
    const tick=()=>{try{checkReminders();}catch(error){try{console.warn('TaskPlanner V2 Erinnerungen',error);}catch(_){}}};
    reminderRunner.timer=root.setInterval(tick,30000);
    for(const name of ['exporthub:ready','exporthub:state-loaded','exporthub:sync'])try{root.addEventListener(name,tick);}catch(_){}
    try{if(root.document)root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden)tick();});}catch(_){}
    if(typeof root.setTimeout==='function')root.setTimeout(tick,5000);
    return true;
  }
  root.ExportHUBTaskRemindersV2=Object.freeze({check:checkReminders,start:startReminders,active:()=>reminderRunner.started,toastHtml:reminderToastHtml});
  if(root.document&&!root.__EXPORTHUB_PICKUP_MODE__&&!root.__EXPORTHUB_TPV2_REMINDERS_OFF__)startReminders();

  root.ExportHUBTaskUIV2=Object.freeze({...base,renderDailySummary,renderOverdue,renderWorkweek,renderMonth,bindPlannerDnD,handlePublicLinkAction,renderPlannerPage});
})(globalThis);