(function(root){
  'use strict';

  const DEFAULT_REMINDER_SLOTS=Object.freeze(['09:00','13:00','15:30']);
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const has=(value,key)=>Object.prototype.hasOwnProperty.call(value||{},key);

  function core(){
    const api=root.ExportHUBTaskCoreV2;
    if(!api||typeof api.normalizeTask!=='function')throw new Error('TaskPlanner V2 Core fehlt');
    return api;
  }
  function recurrence(){return root.ExportHUBTaskRecurrenceV2||null;}
  function tr(key,vars,fallback){
    try{if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function'){const value=root.ExportHUBI18n.t(key,vars);if(value&&value!==key)return value;}}catch(_){}
    return fallback||key;
  }
  function statusLabel(status){
    const key={planned:'taskV2.status.planned',open:'taskV2.status.open',in_progress:'taskV2.status.inProgress',waiting:'taskV2.status.waiting',waiting_feedback:'taskV2.status.waitingFeedback',blocked:'taskV2.status.blocked',done:'taskV2.status.done',cancelled:'taskV2.status.cancelled'}[q(status)];
    return key?tr(key,null,q(status)):q(status);
  }
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
    const t=detailModel(task,ctx),derived=core().derive(t,ctx.now),overdue=derived.overdue?`<span class="tpv2-badge tpv2-overdue">${escapeHtml(tr('taskV2.overdueDays',{count:derived.overdueDays},`${derived.overdueDays} days overdue`))}</span>`:'';
    return `<article class="tpv2-task-card" data-task-id="${escapeHtml(t.id)}" data-priority="${escapeHtml(t.priority)}" data-status="${escapeHtml(t.status)}">
      <div class="tpv2-task-card-head"><span class="tpv2-priority">${escapeHtml(t.priority)}</span>${overdue}</div>
      <h3>${escapeHtml(t.title||tr('taskV2.task',null,'Task'))}</h3>
      <p class="tpv2-task-customer">${escapeHtml(t.customerName||'')}</p>
      <div class="tpv2-task-meta"><span>${escapeHtml(statusLabel(t.status))}</span><span>${escapeHtml(tr('taskV2.due',null,'Due'))} ${escapeHtml(formatDateTime(t.dueAt))}</span></div>
      <button type="button" class="tpv2-button tpv2-button-secondary" data-action="open" data-task-id="${escapeHtml(t.id)}">${escapeHtml(tr('taskV2.detail',null,'Task details'))}</button>
    </article>`;
  }

  function renderTasks(target,ctx={}){
    if(!target)throw new Error('Task-Ziel fehlt');const tasks=arr(ctx.state&&ctx.state.tasks).filter(t=>!['cancelled'].includes(q(t&&t.status).toLowerCase()));
    const mode=viewPreference(ctx);target.innerHTML=`<section class="tpv2-task-list" data-taskplanner-v2-list data-view="${escapeHtml(mode)}">${tasks.map(t=>taskCardHtml(t,ctx)).join('')}</section>`;return target;
  }

  function itemText(item){return typeof item==='string'?q(item):q(item&&(item.text||item.label||item.title));}
  function dependencyId(dep){return typeof dep==='string'?q(dep):q(dep&&(dep.taskId||dep.id||dep.ref));}
  function seriesDateOf(task){const raw=q(task.originalDate||task.seriesDate||task.originalPlannedAt);if(raw)return raw;const m=q(task.occurrenceKey).match(/(\d{4}-\d{2}-\d{2})/);return m?m[1]:'';}
  function dependencyRows(t,ctx){
    const tasks=arr(ctx.state&&ctx.state.tasks),archive=arr(ctx.state&&ctx.state.taskArchive);
    return t.dependencies.map(dep=>{
      const id=dependencyId(dep),other=tasks.concat(archive).find(x=>q(x&&x.id)===id),status=q(other&&other.status).toLowerCase(),done=status==='done'||status==='cancelled'||!!q(other&&other.archivedAt);
      const label=q(other&&other.title)||itemText(typeof dep==='string'?'':dep)||id;
      return `<li data-dependency-id="${escapeHtml(id)}" data-open="${done?'0':'1'}"><span>${escapeHtml(label)}</span><span class="tpv2-badge${done?'':' tpv2-dependency-open'}">${escapeHtml(done?tr('taskV2.dependencyDone',null,'Done'):tr('taskV2.dependencyOpen',null,'Open'))}</span></li>`;
    }).join('');
  }
  function renderDetail(target,taskId,ctx={}){
    if(!target)throw new Error('Task-Detailziel fehlt');const task=arr(ctx.state&&ctx.state.tasks).find(t=>q(t&&t.id)===q(taskId));
    if(!task){target.innerHTML=`<aside class="tpv2-detail" data-taskplanner-v2-detail><p>${escapeHtml(tr('taskV2.notFound',null,'Task not found.'))}</p></aside>`;return target;}
    const t=detailModel(task,ctx),terminal=['done','cancelled'].includes(t.status),doneCount=t.checklist.filter(item=>item&&item.done===true).length;
    const checklist=t.checklist.map((item,index)=>`<li data-done="${item&&item.done===true?'1':'0'}"><label><input type="checkbox" data-action="checklist-toggle" data-index="${index}"${item&&item.done===true?' checked':''}${terminal?' disabled':''}> <span>${escapeHtml(itemText(item))}</span></label></li>`).join('');
    const progress=t.checklist.length?`<p class="tpv2-checklist-progress">${escapeHtml(tr('taskV2.checklistProgress',{done:doneCount,total:t.checklist.length},`${doneCount} of ${t.checklist.length} done`))}</p>`:'';
    const history=t.history.slice().reverse().map(h=>`<li><strong>${escapeHtml(h&&h.action)}</strong><span>${escapeHtml(formatDateTime(h&&h.at))}</span>${h&&h.comment?`<em>${escapeHtml(h.comment)}</em>`:''}</li>`).join('');
    const comments=t.comments.map(c=>`<li><p>${escapeHtml(itemText(c))}</p><span>${escapeHtml([q(c&&(c.authorName||c.author)),formatDateTime(c&&c.at)].filter(x=>x&&x!=='—').join(' · '))}</span></li>`).join('');
    const dependencies=dependencyRows(t,ctx),upcoming=t.upcomingOccurrences.map(o=>`<li>${escapeHtml(formatDateTime(o&&o.date))}</li>`).join(''),seriesDate=seriesDateOf(t);
    const publicLink=obj(t.publicLink)?t.publicLink:null,publicActive=!!(publicLink&&q(publicLink.tokenHash)&&!q(publicLink.revokedAt));
    const publicLinkAction=publicActive
      ?`<button type="button" class="tpv2-button tpv2-button-secondary" data-action="public-link-revoke">${escapeHtml(tr('taskV2.publicLink.revoke',null,'Revoke public link'))}</button>`
      :`<button type="button" class="tpv2-button tpv2-button-secondary" data-action="public-link-create">${escapeHtml(tr('taskV2.publicLink.create',null,'Create public link'))}</button>`;
    const reminders=taskReminderSettings(t).map(r=>`<li data-reminder-time="${escapeHtml(r.time)}"><label><input type="checkbox" data-action="reminder-toggle" data-time="${escapeHtml(r.time)}"${r.enabled?' checked':''}${terminal?' disabled':''}> <span>${escapeHtml(tr('taskV2.reminderAt',{time:r.time},r.time))}</span></label><label class="tpv2-reminder-email"><input type="checkbox" data-action="reminder-email" data-time="${escapeHtml(r.time)}"${r.email?' checked':''}${terminal||!r.enabled?' disabled':''}> <span>${escapeHtml(tr('taskV2.reminder.email',null,'Email reminder'))}</span></label></li>`).join('');
    const note=q(ctx.detailNote)?`<p class="tpv2-detail-note" role="status" data-tpv2-detail-note>${escapeHtml(ctx.detailNote)}</p>`:'';
    const actions=terminal
      ?`<button type="button" class="tpv2-button tpv2-button-secondary" data-action="save-template">${escapeHtml(tr('taskV2.saveTemplate',null,'Save as template'))}</button>`
      :`<label class="tpv2-complete-comment"><span>${escapeHtml(tr('taskV2.completeComment',null,'Completion comment (optional)'))}</span><textarea rows="2" data-tpv2-complete-comment></textarea></label>
        <div class="tpv2-detail-buttons"><button type="button" class="tpv2-button tpv2-button-secondary" data-action="save-template">${escapeHtml(tr('taskV2.saveTemplate',null,'Save as template'))}</button><button type="button" class="tpv2-button tpv2-button-secondary" data-action="cancel">${escapeHtml(tr('taskV2.cancel',null,'Cancel task'))}</button><button type="button" class="tpv2-button tpv2-button-primary" data-action="complete">${escapeHtml(tr('taskV2.complete',null,'Complete'))}</button></div>`;
    target.innerHTML=`<aside class="tpv2-detail" data-taskplanner-v2-detail data-task-id="${escapeHtml(t.id)}" aria-label="${escapeHtml(tr('taskV2.detail',null,'Task details'))}">
      <header class="tpv2-detail-head"><div><span class="tpv2-eyebrow">${escapeHtml(tr('taskV2.task',null,'Task'))}</span><h2>${escapeHtml(t.title)}</h2><p>${escapeHtml(t.customerName)}</p></div><button type="button" class="tpv2-icon-button" data-action="close" aria-label="${escapeHtml(tr('taskV2.close',null,'Close'))}">×</button></header>
      ${note}
      <div class="tpv2-detail-grid">
        <section><h3>${escapeHtml(tr('taskV2.statusPriority',null,'Status & priority'))}</h3><p>${escapeHtml(statusLabel(t.status))} · ${escapeHtml(t.priority)}</p></section>
        <section><h3>${escapeHtml(tr('taskV2.planning',null,'Planning'))}</h3><p>${escapeHtml(tr('taskV2.start',null,'Start'))} ${escapeHtml(formatDateTime(t.startAt))}<br>${escapeHtml(tr('taskV2.planned',null,'Planned'))} ${escapeHtml(formatDateTime(t.plannedAt))}<br>${escapeHtml(tr('taskV2.due',null,'Due'))} ${escapeHtml(formatDateTime(t.dueAt))}<br>${escapeHtml(tr('taskV2.latestCompletion',null,'Complete no later than'))} ${escapeHtml(formatDateTime(t.latestCompletionAt))}${seriesDate?`<br>${escapeHtml(tr('taskV2.seriesDate',null,'Original series date'))} ${escapeHtml(formatDateTime(seriesDate))}`:''}</p></section>
        <section><h3>${escapeHtml(tr('taskV2.process',null,'Process'))}</h3><p>${escapeHtml(t.area)} · ${escapeHtml(t.processId)}</p></section>
        <section data-section="recurrence"><h3>${escapeHtml(tr('taskV2.recurrence',null,'Recurrence'))}</h3><p>${escapeHtml(t.seriesId||tr('taskV2.noSeries',null,'None'))} · ${escapeHtml(t.holidayPolicy)}</p>${t.nextOccurrence?`<p data-next-occurrence>${escapeHtml(tr('taskV2.nextOccurrence',null,'Next occurrence'))}: ${escapeHtml(formatDateTime(t.nextOccurrence.date))}</p>`:''}</section>
        <section class="tpv2-detail-wide"><h3>${escapeHtml(tr('taskV2.description',null,'Description'))}</h3><p>${escapeHtml(t.description)}</p></section>
        <section class="tpv2-detail-wide" data-section="checklist"><h3>${escapeHtml(tr('taskV2.checklist',null,'Checklist'))}</h3>${progress}<ul class="tpv2-checklist">${checklist||`<li>${escapeHtml(tr('taskV2.noneChecklist',null,'No checklist items'))}</li>`}</ul></section>
        <section class="tpv2-detail-wide"><h3>${escapeHtml(tr('taskV2.contact',null,'Contact'))}</h3><p>${escapeHtml(t.contact||'—')}</p></section>
        <section class="tpv2-detail-wide" data-section="dependencies"><h3>${escapeHtml(tr('taskV2.dependencies',null,'Dependencies'))}</h3><ul class="tpv2-dependencies">${dependencies||`<li>${escapeHtml(tr('taskV2.noneDependencies',null,'No dependencies'))}</li>`}</ul></section>
        ${upcoming?`<section class="tpv2-detail-wide" data-section="upcoming"><h3>${escapeHtml(tr('taskV2.upcomingOccurrences',null,'Upcoming occurrences'))}</h3><ul class="tpv2-upcoming">${upcoming}</ul></section>`:''}
        <section class="tpv2-detail-wide" data-section="comments"><h3>${escapeHtml(tr('taskV2.comments',null,'Comments'))}</h3><ul class="tpv2-comments">${comments||`<li>${escapeHtml(tr('taskV2.noneComments',null,'No comments yet'))}</li>`}</ul><div class="tpv2-comment-form"><textarea rows="2" data-tpv2-comment-input aria-label="${escapeHtml(tr('taskV2.addComment',null,'Add comment'))}"></textarea><button type="button" class="tpv2-button tpv2-button-secondary" data-action="comment-add">${escapeHtml(tr('taskV2.addComment',null,'Add comment'))}</button></div></section>
        <section class="tpv2-detail-wide" data-section="reminders"><h3>${escapeHtml(tr('taskV2.reminders',null,'Reminders'))}</h3><ul class="tpv2-reminders">${reminders}</ul></section>
        <section class="tpv2-detail-wide" data-section="public-link"><h3>${escapeHtml(tr('taskV2.publicLink.title',null,'Public read-only link'))}</h3><p>${escapeHtml(publicActive?tr('taskV2.publicLink.active',null,'Active'):tr('taskV2.publicLink.inactive',null,'Not active'))}</p>${publicLinkAction}</section>
        <section class="tpv2-detail-wide" data-section="history"><h3>${escapeHtml(tr('taskV2.history',null,'History'))}</h3><ul class="tpv2-history">${history||`<li>${escapeHtml(tr('taskV2.noneHistory',null,'No history yet'))}</li>`}</ul></section>
      </div>
      <footer class="tpv2-detail-actions">${actions}</footer>
    </aside>`;return target;
  }

  function saveTask(form,ctx={}){
    const state=stateOf(ctx),data=obj(form)?clone(form):{},id=q(data.id),index=id?state.tasks.findIndex(t=>q(t&&t.id)===id):-1,base=index>=0?clone(state.tasks[index]):{},merged={...base,...data};
    if(has(data,'dueDate')&&!has(data,'dueAt'))merged.dueAt=data.dueDate;
    const task=core().normalizeTask(merged,{now:nowOf(ctx)});
    if(index>=0){state.tasks=state.tasks.slice();state.tasks[index]=task;}else state.tasks=state.tasks.concat(task);
    persist(ctx,state.tasks);emit(index>=0?'task_updated':'task_created',[task.id],ctx);return{changed:true,task,index:index>=0?index:state.tasks.length-1};
  }

  function completeTask(taskId,options={},ctx={}){
    const state=stateOf(ctx),index=state.tasks.findIndex(t=>q(t&&t.id)===q(taskId));if(index<0)return{changed:false,task:null};
    const at=nowOf(ctx),comment=q(options.comment);let done=core().completeTask(state.tasks[index],{at,mode:q(options.mode)||'manual',comment});
    if(comment&&q(state.tasks[index]&&state.tasks[index].status).toLowerCase()!=='done'&&done.status==='done')done={...done,comments:arr(done.comments).concat(commentEntry(comment,'completion',ctx))};
    state.tasks=state.tasks.slice();state.tasks[index]=done;persist(ctx,state.tasks);emit('task_completed',[done.id],ctx);return{changed:true,task:done};
  }
  function cancelTask(taskId,ctx={}){
    const state=stateOf(ctx),index=state.tasks.findIndex(t=>q(t&&t.id)===q(taskId));if(index<0)return{changed:false,task:null};
    const cancelled=core().cancelTask(state.tasks[index],{at:nowOf(ctx),source:'manual'});state.tasks=state.tasks.slice();state.tasks[index]=cancelled;persist(ctx,state.tasks);emit('task_cancelled',[cancelled.id],ctx);return{changed:true,task:cancelled};
  }

  function userName(ctx){return q(ctx&&ctx.user&&(ctx.user.name||ctx.user.displayName||ctx.user.username))||userId(ctx);}
  function commentEntry(text,kind,ctx){const at=nowOf(ctx);return{id:`comment:${Date.parse(at)||Date.now()}:${Math.random().toString(36).slice(2,8)}`,text:q(text),at,author:userId(ctx),authorName:userName(ctx),...(kind?{kind}:{})};}
  function updateTask(taskId,ctx,mutate,reason){
    const state=stateOf(ctx),index=state.tasks.findIndex(t=>q(t&&t.id)===q(taskId));if(index<0)return{changed:false,task:null};
    const before=state.tasks[index],next=mutate(clone(before));if(!next)return{changed:false,task:before};
    next.updatedAt=nowOf(ctx);state.tasks=state.tasks.slice();state.tasks[index]=next;persist(ctx,state.tasks);emit(reason,[next.id],ctx);return{changed:true,task:next};
  }
  function toggleChecklistItem(taskId,itemIndex,ctx={}){
    const i=Number(itemIndex);
    return updateTask(taskId,ctx,task=>{
      const list=arr(task.checklist);if(!Number.isInteger(i)||i<0||i>=list.length)return null;
      const raw=list[i],item=typeof raw==='string'?{text:raw}:{...raw},done=item.done!==true,at=nowOf(ctx);
      list[i]={...item,done,completedAt:done?at:'',completedBy:done?userId(ctx):''};task.checklist=list;
      task.history=arr(task.history).concat(core().historyEntry(done?'checklist_checked':'checklist_unchecked',{at,source:'manual',after:{index:i,text:itemText(item)}}));
      return task;
    },'checklist_updated');
  }
  function addComment(taskId,text,ctx={}){
    const value=q(text);if(!value)return{changed:false,task:null};
    return updateTask(taskId,ctx,task=>{const entry=commentEntry(value,'',ctx);task.comments=arr(task.comments).concat(entry);task.history=arr(task.history).concat(core().historyEntry('commented',{at:entry.at,source:'manual',comment:value}));return task;},'comment_added');
  }
  function saveTaskAsTemplate(taskId,ctx={}){
    const state=stateOf(ctx),task=state.tasks.find(t=>q(t&&t.id)===q(taskId));if(!task)return{changed:false,template:null};
    return saveTemplate({...templateFromTask(task),sourceTaskId:q(task.id)},ctx);
  }

  function environmentOf(ctx={}){
    const explicit=q(ctx.environment).toLowerCase();if(explicit==='testservice'||explicit==='production')return explicit;
    const origin=q(root.location&&root.location.origin).toLowerCase();return /-testservice\./.test(origin)?'testservice':'production';
  }
  function randomPublicToken(){
    const cryptoApi=root.crypto;if(!cryptoApi||typeof cryptoApi.getRandomValues!=='function')throw new Error('Sichere Zufallsquelle fehlt');
    const bytes=new Uint8Array(32);cryptoApi.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function hashPublicToken(token){
    const cryptoApi=root.crypto;if(!cryptoApi||!cryptoApi.subtle||typeof cryptoApi.subtle.digest!=='function')throw new Error('Sichere Hashfunktion fehlt');
    const Encoder=root.TextEncoder||TextEncoder,data=new Encoder().encode(q(token)),digest=await cryptoApi.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function createPublicLink(taskId,fields=[],ctx={}){
    const state=stateOf(ctx),index=state.tasks.findIndex(t=>q(t&&t.id)===q(taskId));if(index<0)return{changed:false,task:null,token:''};
    const token=randomPublicToken(),tokenHash=await hashPublicToken(token),at=nowOf(ctx),allowed=core().sanitizePublicFields(fields),before=state.tasks[index],history=arr(before.history).map(clone);
    history.push(core().historyEntry('public_link_created',{at,source:'manual',after:{fields:allowed,environment:environmentOf(ctx)}}));
    const next={...clone(before),publicLink:{schemaVersion:1,tokenHash,fields:allowed,environment:environmentOf(ctx),createdAt:at,revokedAt:''},history,updatedAt:at};
    state.tasks=state.tasks.slice();state.tasks[index]=next;persist(ctx,state.tasks);emit('public_link_created',[next.id],ctx);
    const origin=q(root.location&&root.location.origin).replace(/\/$/,'');
    return{changed:true,task:next,token,url:(origin||'')+'/task?token='+encodeURIComponent(token)};
  }
  function revokePublicLink(taskId,ctx={}){
    const state=stateOf(ctx),index=state.tasks.findIndex(t=>q(t&&t.id)===q(taskId));if(index<0)return{changed:false,task:null};
    const before=state.tasks[index],link=obj(before.publicLink)?clone(before.publicLink):null;if(!link||!q(link.tokenHash)||q(link.revokedAt))return{changed:false,task:before};
    const at=nowOf(ctx),history=arr(before.history).map(clone);link.revokedAt=at;history.push(core().historyEntry('public_link_revoked',{at,source:'manual'}));
    const next={...clone(before),publicLink:link,history,updatedAt:at};state.tasks=state.tasks.slice();state.tasks[index]=next;persist(ctx,state.tasks);emit('public_link_revoked',[next.id],ctx);return{changed:true,task:next};
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
  // options.catchUp: also deliver a slot that passed earlier today (tab was closed or asleep at that minute);
  // per task only the latest passed slot counts, so a late start produces one reminder, not three
  function reminderDue(task,date){
    const day=core().dayKey(task.plannedAt||task.dueAt);if(!day||day>date)return false;
    const start=core().dayKey(task.startAt),snooze=core().dayKey(task.snoozeUntil);
    return !(start&&start>date)&&!(snooze&&snooze>date);
  }
  function reminderWorkday(date,state){
    const api=recurrence();if(!api||typeof api.isWorkday!=='function')return true;
    try{return api.isWorkday(date,typeof api.calendar==='function'?api.calendar(state.taskCalendar||{}):undefined)!==false;}catch(_){return true;}
  }
  function reminderCandidates(now,state,user={},options={}){
    state=obj(state)?state:{},user=obj(user)?user:{id:q(user)},options=obj(options)?options:{},now=q(now)||new Date().toISOString();const date=core().dayKey(now),slot=clock(now),uid=q(user.id||user.userId||user.username),environment=q(user.environment)||'production',settings=obj(state.taskSettings)?state.taskSettings:{},userCfg=obj(settings.users&&settings.users[uid])?settings.users[uid]:{},channelDefaults=obj(userCfg.reminderChannels)?userCfg.reminderChannels:{website:true,email:false},ledger=obj(settings.reminderLedger)?settings.reminderLedger:{};
    if(!date||!slot||!uid)return[];
    if(options.catchUp&&!reminderWorkday(date,state))return[];
    const out=[];
    for(const raw of arr(state.tasks)){
      const task=core().normalizeTask(raw,{now});if(['done','cancelled'].includes(task.status)||q(task.archivedAt))continue;
      const owner=q(task.ownerId||task.owner);if(owner&&owner!==uid)continue;
      if(options.catchUp&&!reminderDue(task,date))continue;
      const rows=taskReminderRows(task,channelDefaults),reminder=options.catchUp?rows.filter(r=>/^\d{2}:\d{2}$/.test(r.time)&&r.time<=slot).sort((a,b)=>a.time.localeCompare(b.time)).pop():rows.find(r=>r.time===slot);if(!reminder)continue;
      const key=reminderKey(task,date,reminder.time,uid,environment);if(ledger[key])continue;
      if(reminder.channels.website!==true&&reminder.channels.email!==true)continue;
      out.push({key,taskId:task.id,occurrenceKey:q(task.occurrenceKey),date,slot:reminder.time,userId:uid,environment,channels:reminder.channels,title:task.title,dueAt:task.dueAt,priority:task.priority,customerName:task.customerName});
    }
    return out;
  }
  function pruneReminderLedger(ctx={},keepDays=14){
    const state=stateOf(ctx),settings=ensureSettings(state),limit=new Date(Date.parse(nowOf(ctx))-keepDays*86400000).toISOString().slice(0,10);let removed=0;
    for(const [key,record] of Object.entries(settings.reminderLedger)){const day=q(record&&record.deliveredAt).slice(0,10)||(q(key).match(/\|(\d{4}-\d{2}-\d{2})\|/)||[])[1]||'';if(day&&day<limit){delete settings.reminderLedger[key];removed++;}}
    if(removed)persist(ctx,state.taskSettings);return removed;
  }
  function taskReminderSettings(task){
    const t=core().normalizeTask(task||{}),explicit=arr(t.reminders);
    return DEFAULT_REMINDER_SLOTS.map(time=>{const row=explicit.find(r=>q(r&&(r.time||r.slot))===time);return{time,enabled:explicit.length?!!(row&&row.enabled!==false):true,email:!!(row&&row.channels&&row.channels.email===true)};});
  }
  function toggleTaskReminder(taskId,time,field,ctx={}){
    const state=stateOf(ctx),task=state.tasks.find(t=>q(t&&t.id)===q(taskId));if(!task||!DEFAULT_REMINDER_SLOTS.includes(q(time)))return{changed:false,task:task||null};
    const rows=taskReminderSettings(task).map(r=>r.time!==q(time)?r:field==='email'?{...r,email:!r.email}:{...r,enabled:!r.enabled,email:r.enabled?false:r.email});
    return setTaskReminders(taskId,rows,ctx);
  }
  function setTaskReminders(taskId,rows,ctx={}){
    const list=DEFAULT_REMINDER_SLOTS.map(time=>{const row=arr(rows).find(r=>q(r&&r.time)===time)||{};return{time,enabled:row.enabled===true,channels:{website:true,email:row.email===true}};});
    return updateTask(taskId,ctx,task=>{const before=taskReminderSettings(task);task.reminders=list;task.history=arr(task.history).concat(core().historyEntry('reminders_changed',{at:nowOf(ctx),source:'manual',before,after:list.map(r=>({time:r.time,enabled:r.enabled,email:r.channels.email}))}));return task;},'reminders_updated');
  }
  function markReminderDelivered(row,ctx={}){
    const state=stateOf(ctx),settings=ensureSettings(state),key=q(row&&row.key);if(!key)throw new Error('Reminder-Key fehlt');if(settings.reminderLedger[key])return{changed:false,record:settings.reminderLedger[key]};
    const record={deliveredAt:nowOf(ctx),taskId:q(row&&row.taskId),slot:q(row&&row.slot),userId:q(row&&row.userId),environment:q(row&&row.environment)};settings.reminderLedger[key]=record;persist(ctx,state.taskSettings);return{changed:true,record};
  }

  root.ExportHUBTaskUIV2=Object.freeze({
    version:'2.0',DEFAULT_REMINDER_SLOTS,detailModel,renderTasks,renderDetail,saveTask,completeTask,cancelTask,createPublicLink,revokePublicLink,
    templateFromTask,saveTemplate,saveTaskAsTemplate,toggleChecklistItem,addComment,viewPreference,setViewPreference,reminderKey,reminderCandidates,markReminderDelivered,pruneReminderLedger,taskReminderSettings,setTaskReminders,toggleTaskReminder
  });
})(globalThis);