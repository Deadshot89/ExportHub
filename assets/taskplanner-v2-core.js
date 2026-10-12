(function(root){
  'use strict';

  const TZ='Europe/Berlin';
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

  const STATUS_MAP=Object.freeze({
    'geplant':'planned','planned':'planned',
    'offen':'open','open':'open',
    'in bearbeitung':'in_progress','bearbeitung':'in_progress','in progress':'in_progress','in_progress':'in_progress',
    'wartet':'waiting','waiting':'waiting',
    'wartet auf rückmeldung':'waiting_feedback','wartet auf rueckmeldung':'waiting_feedback','waiting feedback':'waiting_feedback','waiting_feedback':'waiting_feedback',
    'blockiert':'blocked','blocked':'blocked',
    'erledigt':'done','done':'done','completed':'done','complete':'done',
    'storniert':'cancelled','cancelled':'cancelled','canceled':'cancelled'
  });

  function dayKey(value){
    const s=q(value);if(!s)return'';
    const m=s.match(/^(\d{4}-\d{2}-\d{2})/);if(m)return m[1];
    const d=new Date(s);if(Number.isNaN(d.getTime()))return'';
    return d.toISOString().slice(0,10);
  }

  function berlinOffset(date){
    const probe=new Date(date+'T12:00:00Z');
    try{
      const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TZ,timeZoneName:'longOffset',hour:'2-digit'}).formatToParts(probe);
      const zone=(parts.find(p=>p.type==='timeZoneName')||{}).value||'GMT+00:00';
      const m=zone.match(/GMT([+-])(\d{2}):?(\d{2})?/i);
      if(m)return (m[1]==='-'?'-':'+')+m[2]+':'+(m[3]||'00');
    }catch(_){}
    const month=Number(date.slice(5,7));
    return month>=4&&month<=9?'+02:00':'+01:00';
  }

  function localDateTime(value,defaultTime){
    const s=q(value);if(!s)return'';
    if(/T\d{2}:\d{2}/.test(s))return s;
    const date=dayKey(s);if(!date)return s;
    const time=defaultTime||'00:00';
    return `${date}T${time}:00${berlinOffset(date)}`;
  }

  function canonicalStatus(value,startAt,now){
    const mapped=STATUS_MAP[q(value).toLowerCase()];
    if(mapped)return mapped;
    if(startAt&&Date.parse(startAt)>Date.parse(q(now)||new Date().toISOString()))return'planned';
    return'open';
  }

  function canonicalPriority(value){
    const raw=q(value).toUpperCase();
    if(/^P[0-3]$/.test(raw))return raw;
    if(raw==='P4')return'P3';
    if(raw==='CRITICAL'||raw==='KRITISCH')return'P0';
    if(raw==='HIGH'||raw==='HOCH')return'P1';
    if(raw==='LOW'||raw==='NIEDRIG')return'P3';
    return'P2';
  }

  function seriesIdOf(t){return q(t.seriesId||t.recurringSeriesId||t.weeklySeriesId||t.recurrenceSeriesId||t.seriesKey);}
  function shipmentIdOf(t){return q(t.shipmentId||t.linkedShipmentId||t.sourceId);}
  function shipmentRefOf(t){return q(t.shipmentRef||t.linkedShipmentRef||t.reference||t.ref||t.sourceRef);}
  function customerIdOf(t){return q(t.customerId||t.linkedCustomerId||t.customerAccount||t.linkedAccount);}

  function normalizeTask(input,ctx={}){
    const src=obj(input)?input:{};
    const t={...src};
    const startSource=q(src.startAt||src.startDate);
    const plannedSource=q(src.plannedAt||src.plannedDate||src.date||src.day);
    const dueSource=q(src.dueAt||src.dueDate||src.date||src.day||src.targetDate);
    const latestSource=q(src.latestCompletionAt||src.targetDate);
    const startAt=localDateTime(startSource,'00:00');
    const plannedAt=localDateTime(plannedSource,'00:00');
    const dueAt=localDateTime(dueSource,'16:15');
    const latestCompletionAt=localDateTime(latestSource,'16:15');
    const rawPriority=q(src.priority).toUpperCase();
    const priority=canonicalPriority(rawPriority);
    const seriesId=seriesIdOf(src);
    const id=q(src.id||src.taskId||src.uuid)||`task:${[customerIdOf(src),shipmentIdOf(src)||shipmentRefOf(src),seriesId,q(src.occurrenceKey||src.seriesOccurrence),q(src.title||src.name)].join('|')}`;
    const history=arr(src.history).map(clone);
    const checklist=arr(src.checklist).map(clone);
    const normalized={
      ...t,
      id,
      schemaVersion:2,
      title:q(src.title||src.name||src.subject||src.taskTitle||src.taskName),
      description:q(src.description||src.note||src.notes),
      customerId:customerIdOf(src),
      customerName:q(src.customerName||src.linkedCustomer||src.customer),
      area:q(src.area||src.group||src.department),
      processId:q(src.processId),
      workflowId:q(src.workflowId),
      shipmentId:shipmentIdOf(src),
      shipmentRef:shipmentRefOf(src),
      orderId:q(src.orderId||src.salesOrder||src.order),
      taskType:q(src.taskType||src.sourceType),
      ownerId:q(src.ownerId||src.assignedTo||src.effectiveAssignee||src.owner),
      owner:q(src.owner||src.assignedTo||src.effectiveAssignee),
      priority,
      status:canonicalStatus(src.status,startAt,ctx.now),
      startAt,
      plannedAt,
      dueAt,
      latestCompletionAt,
      snoozeUntil:localDateTime(src.snoozeUntil||src.followUpDate,'00:00'),
      estimatedMinutes:Number(src.estimatedMinutes||src.durationMinutes||0)||0,
      holidayPolicy:q(src.holidayPolicy||src.holidayRule||'manual_decision')||'manual_decision',
      manualOverride:src.manualOverride===true||src.manualPlanned===true,
      seriesId,
      occurrenceKey:q(src.occurrenceKey||src.seriesOccurrence||src.weekKey),
      templateId:q(src.templateId),
      dependencies:arr(src.dependencies).map(clone),
      checklist,
      comments:arr(src.comments).map(clone),
      reminders:arr(src.reminders).map(clone),
      history,
      createdAt:q(src.createdAt),
      completedAt:q(src.completedAt),
      completionMode:q(src.completionMode),
      archivedAt:q(src.archivedAt)
    };
    if(rawPriority==='P4')normalized.legacyPriority='P4';
    return normalized;
  }

  function derive(task,now){
    const t=normalizeTask(task,{now});
    const nowMs=Date.parse(q(now)||new Date().toISOString());
    const dueMs=Date.parse(t.dueAt);
    const terminal=t.status==='done'||t.status==='cancelled';
    const overdue=!terminal&&Number.isFinite(dueMs)&&dueMs<nowMs;
    let overdueDays=0;
    if(overdue){
      const dueDay=dayKey(t.dueAt),nowDay=dayKey(now||new Date());
      overdueDays=Math.max(1,Math.floor((Date.parse(nowDay+'T00:00:00Z')-Date.parse(dueDay+'T00:00:00Z'))/86400000));
    }
    return {...t,overdue,overdueDays,isToday:dayKey(t.dueAt)===dayKey(now||new Date()),effectivePriority:overdue?'OVERDUE':t.priority};
  }

  function historyEntry(action,options={}){
    return {
      action:q(action),
      at:q(options.at)||new Date().toISOString(),
      source:q(options.source||options.mode)||'manual',
      ...(options.comment?{comment:q(options.comment)}:{}),
      ...(options.eventId?{eventId:q(options.eventId)}:{}),
      ...(options.before!==undefined?{before:clone(options.before)}:{}),
      ...(options.after!==undefined?{after:clone(options.after)}:{})
    };
  }

  function completeTask(task,options={}){
    const t=normalizeTask(task,{now:options.at});
    const at=q(options.at)||new Date().toISOString();
    if(t.status==='done')return t;
    return {...t,status:'done',completedAt:at,completionMode:q(options.mode)||'manual',history:[...arr(t.history),historyEntry('completed',{...options,at})]};
  }

  function reopenTask(task,options={}){
    const t=normalizeTask(task,{now:options.at});
    const at=q(options.at)||new Date().toISOString();
    return {...t,status:'open',completedAt:'',completionMode:'',archivedAt:'',history:[...arr(t.history),historyEntry('reopened',{...options,at})]};
  }

  function cancelTask(task,options={}){
    const t=normalizeTask(task,{now:options.at});
    const at=q(options.at)||new Date().toISOString();
    return {...t,status:'cancelled',history:[...arr(t.history),historyEntry('cancelled',{...options,at})]};
  }

  function collisionKey(t){
    return [q(t.id),customerIdOf(t),shipmentIdOf(t)||shipmentRefOf(t),seriesIdOf(t),q(t.occurrenceKey||t.seriesOccurrence)].join('|');
  }

  function migrateState(input,ctx={}){
    const state=clone(obj(input)?input:{});
    const originalTasks=arr(state.tasks);
    const collisions=[];
    const ids=new Map();
    originalTasks.forEach((task,index)=>{
      const id=q(task&&task.id||task&&task.taskId||task&&task.uuid);
      if(!id)return;
      const key=collisionKey(task);
      if(ids.has(id)&&ids.get(id)!==key)collisions.push({id,firstKey:ids.get(id),secondKey:key,index});
      else ids.set(id,key);
    });

    let createdSeriesLinks=0;
    const tasks=originalTasks.map(task=>{
      const beforeSeries=q(task&&task.seriesId);
      const normalized=normalizeTask(task,ctx);
      if(normalized.seriesId&&!beforeSeries)createdSeriesLinks++;
      return normalized;
    });
    const existingSeries=arr(state.taskSeries).map(clone);
    const known=new Set(existingSeries.map(s=>q(s&&s.id)).filter(Boolean));
    for(const task of tasks){
      if(!task.seriesId||known.has(task.seriesId))continue;
      existingSeries.push({id:task.seriesId,schemaVersion:2,migratedFromLegacy:true,createdAt:q(ctx.now)||new Date().toISOString()});
      known.add(task.seriesId);
    }
    state.tasks=tasks;
    state.taskSeries=existingSeries;
    state.taskTemplates=arr(state.taskTemplates).map(clone);
    state.taskCalendar=obj(state.taskCalendar)?clone(state.taskCalendar):{closures:[]};
    state.taskSettings=obj(state.taskSettings)?clone(state.taskSettings):{};
    state.taskArchive=arr(state.taskArchive).map(clone);
    const unresolvedRelationships=[];
    const report={
      before:{tasks:originalTasks.length,series:arr(input&&input.taskSeries).length},
      after:{tasks:tasks.length,series:existingSeries.length},
      collisions,
      createdSeriesLinks,
      unresolvedRelationships,
      safe:collisions.length===0
    };
    return {state,report};
  }

  function normalizeState(input,ctx={}){return migrateState(input,ctx).state;}

  function archiveCompleted(input,now){
    const state=clone(obj(input)?input:{}),cutoff=Date.parse(q(now)||new Date().toISOString())-7*86400000;
    const active=[],archive=arr(state.taskArchive).map(clone);
    for(const task of arr(state.tasks)){
      const t=normalizeTask(task,{now});
      const completed=Date.parse(t.completedAt);
      if(t.status==='done'&&Number.isFinite(completed)&&completed<=cutoff){
        const archivedAt=q(now)||new Date().toISOString();
        archive.push({...t,archivedAt,history:[...arr(t.history),historyEntry('archived',{at:archivedAt,source:'archive'})]});
      }else active.push(t);
    }
    state.tasks=active;state.taskArchive=archive;return state;
  }

  root.ExportHUBTaskCoreV2=Object.freeze({
    version:'2.0',timeZone:TZ,normalizeTask,normalizeState,migrateState,derive,
    completeTask,reopenTask,cancelTask,archiveCompleted,historyEntry,dayKey,localDateTime
  });
})(globalThis);
