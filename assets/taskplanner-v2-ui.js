(function(root){
  'use strict';

  const DEFAULT_REMINDER_SLOTS=Object.freeze(['09:00','13:00','15:30']);
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  function core(){
    const api=root.ExportHUBTaskCoreV2;
    if(!api||typeof api.normalizeTask!=='function')throw new Error('TaskPlanner V2 Core fehlt');
    return api;
  }
  function recurrence(){return root.ExportHUBTaskRecurrenceV2||null;}
  function nowOf(ctx){return q(ctx&&ctx.now)||new Date().toISOString();}
  function stateOf(ctx){
    if(!ctx||!obj(ctx.state))throw new Error('TaskPlanner V2 UI benötigt ctx.state');
    if(!Array.isArray(ctx.state.tasks))ctx.state.tasks=[];
    return ctx.state;
  }
  function persist(ctx,value){if(ctx&&typeof ctx.persist==='function')ctx.persist(value);}
  function escapeHtml(value){return q(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function formatDateTime(value){
    const s=q(value);if(!s)return'—';const m=s.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/);return m?`${m[1]}${m[2]?' · '+m[2]:''}`:s;
  }
  function emit(reason,taskIds,ctx){
    try{
      if(typeof root.dispatchEvent!=='function')return;
      const detail={reason,taskIds:arr(taskIds).filter(Boolean),at:nowOf(ctx)};
      if(typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('exporthub:tasks-updated',{detail}));
      else root.dispatchEvent({type:'exporthub:tasks-updated',detail});
    }catch(_){}
  }

  function recurrencePreview(task,ctx={}){
    const api=recurrence(),seriesList=arr(ctx.series||ctx.state&&ctx.state.taskSeries),series=seriesList.find(s=>q(s&&s.id)===q(task.seriesId));
    if(!api||!series||typeof api.occurrences!=='function')return[];
    const base=core().dayKey(task.plannedAt||task.dueAt||ctx.now||new Date()),start=base||core().dayKey(new Date());
    if(!start)return[];
    const endDate=new Date(start+'T00:00:00Z');endDate.setUTCDate(endDate.getUTCDate()+93);const end=endDate.toISOString().slice(0,10);
    try{return arr(api.occurrences(series,{start,end},api.calendar(ctx.state&&ctx.state.taskCalendar||{}))).filter(x=>q(x&&x.date)>start).slice(0,5).map(clone);}catch(_){return[];}
  }

  function detailModel(input,ctx={}){
    const task=core().normalizeTask(input||{},{now:ctx.now}),upcomingOccurrences=recurrencePreview(task,ctx);
    return {
      ...task,
      contact:q(task.contact||task.contactPerson||task.contactName),
      checklist:arr(task.checklist).map(clone),comments:arr(task.comments).map(clone),dependencies:arr(task.dependencies).map(clone),history:arr(task.history).map(clone),
      nextOccurrence:upcomingOccurrences[0]||null,upcomingOccurrences
    };
  }

  function taskCardHtml(task,ctx={}){
    const t=detailModel(task,ctx),derived=core().derive(t,ctx.now),overdue=derived.overdue?`<span class="tpv2-badge tpv2-overdue">${derived.overdueDays} Tage überfällig</span>`:'';
    return `<article class="tpv2-task-card" data-task-id="${escapeHtml(t.id)}" data-priority="${escapeHtml(t.priority)}" data-status="${escapeHtml(t.status)}">
      <div class="tpv2-task-card-head"><span class="tpv2-priority">${escapeHtml(t.priority)}</span>${overdue}</div>
      <h3>${escapeHtml(t.title||'Aufgabe')}</h3>
      <p class="tpv2-task-customer">${escapeHtml(t.customerName||'')}</p>
      <div class="tpv2-task-meta"><span>${escapeHtml(t.status)}</span><span>Fällig ${escapeHtml(formatDateTime(t.dueAt))}</span></div>
      <button type="button" class="tpv2-button tpv2-button-secondary" data-action="open" data-task-id="${escapeHtml(t.id)}">Details</button>
    </article>`;
  }

  function renderTasks(target,ctx={}){
    if(!target)throw new Error('Task-Ziel fehlt');const tasks=arr(ctx.state&&ctx.state.tasks).filter(t=>!['cancelled'].includes(q(t&&t.status).toLowerCase()));
    const mode=viewPreference(ctx);target.innerHTML=`<section class="tpv2-task-list" data-taskplanner-v2-list data-view="${escapeHtml(mode)}">${tasks.map(t=>taskCardHtml(t,ctx)).join('')}</section>`;return target;
  }

  function renderDetail(target,taskId,ctx={}){
    if(!target)throw new Error('Task-Detailziel fehlt');const task=arr(ctx.state&&ctx.state.tasks).find(t=>q(t&&t.id)===q(taskId));
    if(!task){target.innerHTML='<aside class="tpv2-detail" data-taskplanner-v2-detail><p>Aufgabe nicht gefunden.</p></aside>';return target;}
    const t=detailModel(task,ctx),checklist=t.checklist.map(item=>`<li data-done="${item&&item.done===true?'1':'0'}">${escapeHtml(item&&item.text||item&&item.label||'')}</li>`).join(''),history=t.history.slice().reverse().map(h=>`<li><strong>${escapeHtml(h&&h.action)}</strong><span>${escapeHtml(formatDateTime(h&&h.at))}</span></li>`).join('');
    target.innerHTML=`<aside class="tpv2-detail" data-taskplanner-v2-detail data-task-id="${escapeHtml(t.id)}" aria-label="Aufgabendetails">
      <header class="tpv2-detail-head"><div><span class="tpv2-eyebrow">Aufgabe</span><h2>${escapeHtml(t.title)}</h2><p>${escapeHtml(t.customerName)}</p></div><button type="button" class="tpv2-icon-button" data-action="close" aria-label="Schließen">×</button></header>
      <div class="tpv2-detail-grid">
        <section><h3>Status & Priorität</h3><p>${escapeHtml(t.status)} · ${escapeHtml(t.priority)}</p></section>
        <section><h3>Planung</h3><p>Start ${escapeHtml(formatDateTime(t.startAt))}<br>Geplant ${escapeHtml(formatDateTime(t.plannedAt))}<br>Fällig ${escapeHtml(formatDateTime(t.dueAt))}<br>Spätestens ${escapeHtml(formatDateTime(t.latestCompletionAt))}</p></section>
        <section><h3>Prozess</h3><p>${escapeHtml(t.area)} · ${escapeHtml(t.processId)}</p></section>
        <section><h3>Wiederholung</h3><p>${escapeHtml(t.seriesId||'Keine')} · ${escapeHtml(t.holidayPolicy)}</p></section>
        <section class="tpv2-detail-wide"><h3>Beschreibung</h3><p>${escapeHtml(t.description)}</p></section>
        <section class="tpv2-detail-wide" data-section="checklist"><h3>Checkliste</h3><ul class="tpv2-checklist">${checklist||'<li>Keine Punkte</li>'}</ul></section>
        <section class="tpv2-detail-wide"><h3>Ansprechpartner</h3><p>${escapeHtml(t.contact||'—')}</p></section>
        <section class="tpv2-detail-wide" data-section="history"><h3>Historie</h3><ul class="tpv2-history">${history||'<li>Noch keine Historie</li>'}</ul></section>
      </div>
      <footer class="tpv2-detail-actions"><button type="button" class="tpv2-button tpv2-button-secondary" data-action="cancel">Stornieren</button><button type="button" class="tpv2-button tpv2-button-primary" data-action="complete">Erledigt</button></footer>
    </aside>`;return target;
  }

  function saveTask(form,ctx={}){
    const state=stateOf(ctx),data=obj(form)?clone(form):{},id=q(data.id),index=id?state.tasks.findIndex(t=>q(t&&t.id)===id):-1,base=index>=0?clone(state.tasks[index]):{};
    const task=core().normalizeTask({...base,...data},{now:nowOf(ctx)});
    if(index>=0){state.tasks=state.tasks.slice();state.tasks[index]=task;}else state.tasks=state.tasks.concat(task);
    persist(ctx,state.tasks);emit(index>=0?'task_updated':'task_created',[task.id],ctx);return{changed:true,task,index:index>=0?index:state.tasks.length-1};
  }

  function completeTask(taskId,options={},ctx={}){
    const state=stateOf(ctx),index=state.tasks.findIndex(t=>q(t&&t.id)===q(taskId));if(index<0)return{changed:false,task:null};
    const done=core().completeTask(state.tasks[index],{at:nowOf(ctx),mode:q(options.mode)||'manual',comment:q(options.comment)});state.tasks=state.tasks.slice();state.tasks[index]=done;persist(ctx,state.tasks);emit('task_completed',[done.id],ctx);return{changed:true,task:done};
  }
  function cancelTask(taskId,ctx={}){
    const state=stateOf(ctx),index=state.tasks.findIndex(t=>q(t&&t.id)===q(taskId));if(index<0)return{changed:false,task:null};
    const cancelled=core().cancelTask(state.tasks[index],{at:nowOf(ctx),source:'manual'});state.tasks=state.tasks.slice();state.tasks[index]=cancelled;persist(ctx,state.tasks);emit('task_cancelled',[cancelled.id],ctx);return{changed:true,task:cancelled};
  }

  function templateFromTask(input){
    const task=core().normalizeTask(input||{}),template=clone(task);
    for(const key of ['id','taskId','status','completedAt','completionMode','archivedAt','occurrenceKey','history','createdAt','updatedAt','manualOverride','plannedAt','plannedDate','date','day'])delete template[key];
    template.schemaVersion=2;template.checklist=arr(template.checklist).map(item=>({...clone(item),done:false,completedAt:'',completedBy:''}));template.comments=[];
    return template;
  }
  function saveTemplate(input,ctx={}){
    const state=stateOf(ctx);if(!Array.isArray(state.taskTemplates))state.taskTemplates=[];
    const at=nowOf(ctx),source=clone(input||{}),id=q(source.id)||`template:${Date.parse(at)||Date.now()}:${Math.random().toString(36).slice(2,8)}`,template={...source,id,schemaVersion:2,createdAt:q(source.createdAt)||at,updatedAt:at};
    const index=state.taskTemplates.findIndex(x=>q(x&&x.id)===id);if(index>=0){state.taskTemplates=state.taskTemplates.slice();state.taskTemplates[index]=template;}else state.taskTemplates=state.taskTemplates.concat(template);
    persist(ctx,state.taskTemplates);emit('template_saved',[],ctx);return{changed:true,template};
  }

  function userId(ctx){return q(ctx&&ctx.user&&(ctx.user.id||ctx.user.userId||ctx.user.username)||ctx&&ctx.userId);}
  function ensureSettings(state){if(!obj(state.taskSettings))state.taskSettings={};if(!obj(state.taskSettings.users))state.taskSettings.users={};if(!obj(state.taskSettings.reminderLedger))state.taskSettings.reminderLedger={};return state.taskSettings;}
  function viewPreference(ctx={}){const state=ctx.state||{},id=userId(ctx),settings=obj(state.taskSettings)?state.taskSettings:{},mode=q(settings.users&&settings.users[id]&&settings.users[id].viewMode);return mode==='compact'?'compact':'detailed';}
  function setViewPreference(mode,ctx={}){
    if(mode!=='compact'&&mode!=='detailed')throw new Error('Ungültige Aufgabenansicht');const state=stateOf(ctx),settings=ensureSettings(state),id=userId(ctx);if(!id)throw new Error('Benutzer fehlt');settings.users[id]={...(settings.users[id]||{}),viewMode:mode};persist(ctx,state.taskSettings);emit('view_preference',[],ctx);return mode;
  }

  function reminderKey(task,date,slot,user,environment){return[q(task&&task.id),q(task&&task.occurrenceKey)||q(date),q(date),q(slot),q(user),q(environment)].join('|');}
  function clock(value){const m=q(value).match(/T(\d{2}:\d{2})/);return m?m[1]:'';}
  function taskReminderRows(task,userSettings){
    const explicit=arr(task&&task.reminders);
    if(explicit.length)return explicit.filter(r=>r&&r.enabled!==false).map(r=>({time:q(r.time||r.slot),channels:{website:r.channels&&r.channels.website!==undefined?r.channels.website!==false:userSettings.website!==false,email:r.channels&&r.channels.email!==undefined?r.channels.email===true:userSettings.email===true}}));
    return DEFAULT_REMINDER_SLOTS.map(time=>({time,channels:{website:userSettings.website!==false,email:userSettings.email===true}}));
  }
  function reminderCandidates(now,state,user={}){
    state=obj(state)?state:{},user=obj(user)?user:{id:q(user)},now=q(now)||new Date().toISOString();const date=core().dayKey(now),slot=clock(now),uid=q(user.id||user.userId||user.username),environment=q(user.environment)||'production',settings=obj(state.taskSettings)?state.taskSettings:{},userCfg=obj(settings.users&&settings.users[uid])?settings.users[uid]:{},channelDefaults=obj(userCfg.reminderChannels)?userCfg.reminderChannels:{website:true,email:false},ledger=obj(settings.reminderLedger)?settings.reminderLedger:{};
    if(!date||!slot||!uid)return[];
    const out=[];
    for(const raw of arr(state.tasks)){
      const task=core().normalizeTask(raw,{now});if(['done','cancelled'].includes(task.status))continue;
      const owner=q(task.ownerId||task.owner);if(owner&&owner!==uid)continue;
      const reminder=taskReminderRows(task,channelDefaults).find(r=>r.time===slot);if(!reminder)continue;
      const key=reminderKey(task,date,slot,uid,environment);if(ledger[key])continue;
      if(reminder.channels.website!==true&&reminder.channels.email!==true)continue;
      out.push({key,taskId:task.id,occurrenceKey:q(task.occurrenceKey),date,slot,userId:uid,environment,channels:reminder.channels,title:task.title,dueAt:task.dueAt});
    }
    return out;
  }
  function markReminderDelivered(row,ctx={}){
    const state=stateOf(ctx),settings=ensureSettings(state),key=q(row&&row.key);if(!key)throw new Error('Reminder-Key fehlt');if(settings.reminderLedger[key])return{changed:false,record:settings.reminderLedger[key]};
    const record={deliveredAt:nowOf(ctx),taskId:q(row&&row.taskId),slot:q(row&&row.slot),userId:q(row&&row.userId),environment:q(row&&row.environment)};settings.reminderLedger[key]=record;persist(ctx,state.taskSettings);return{changed:true,record};
  }

  root.ExportHUBTaskUIV2=Object.freeze({
    version:'2.0',DEFAULT_REMINDER_SLOTS,detailModel,renderTasks,renderDetail,saveTask,completeTask,cancelTask,
    templateFromTask,saveTemplate,viewPreference,setViewPreference,reminderKey,reminderCandidates,markReminderDelivered
  });
})(globalThis);
