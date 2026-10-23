(function(root){
  'use strict';

  const GROUPS=Object.freeze(['Offene Sendungen','Fehlende POD','Kunde angemeldet','Picks','Offene ABDs']);
  const PRIORITY_RANK=Object.freeze({P0:0,P1:1,P2:2,P3:3,P4:4});
  const DUE_RANK=Object.freeze({overdue:0,today:1,future:2,none:3});
  const q=v=>String(v==null?'':v).trim();
  const low=v=>q(v).toLowerCase();
  const arr=v=>Array.isArray(v)?v:[];

  function core(){return root.ExportHUBTaskCoreV2&&typeof root.ExportHUBTaskCoreV2.normalizeTask==='function'?root.ExportHUBTaskCoreV2:null;}
  function dayKey(value){
    const c=core();if(c&&typeof c.dayKey==='function')return c.dayKey(value);
    const s=q(value);const m=s.match(/^(\d{4}-\d{2}-\d{2})/);if(m)return m[1];if(!s)return'';
    const d=new Date(s);if(Number.isNaN(d.getTime()))return'';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function isoWeekKey(value){
    const s=dayKey(value);if(!s)return'';const [y,m,d]=s.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d));
    const weekday=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-weekday);const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const week=Math.ceil((((date-yearStart)/86400000)+1)/7);return `${date.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
  }
  function addDays(value,days){const s=dayKey(value);if(!s)return'';const [y,m,d]=s.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d));date.setUTCDate(date.getUTCDate()+Number(days||0));return date.toISOString().slice(0,10);}
  function inferSourceType(t){
    const explicit=q(t&&t.sourceType);if(explicit)return explicit;const text=q((t&&t.group)||'')+' '+q((planTask(t)&&t.area)||'')+' '+q((t&&t.title)||'');
    if(/pod/i.test(text))return'pod';if(/abd/i.test(text))return'abd';if(/pick/i.test(text))return'pick';if(/abhol|pickup/i.test(text))return'pickup';if(q(t&&t.manual)||/manuell/i.test(text))return'manual';return'shipment';
  }
  function planTask(t){
    if(!t)return false;
    if(t.masterTaskRC848||t.masterTaskRC846||q(t.masterSourceId)||q(t.recurringSeriesId)||q(t.weeklySeriesId)||q(t.seriesId))return true;
    return low(t.sourceType)==='manual'&&!!q(t.area||t.category)&&!q(t.managedBy);
  }
  function canonicalTaskStatus(value){
    const c=core();if(c){return c.normalizeTask({id:'status-probe',title:'status-probe',status:value}).status;}
    const raw=q(value),status=low(raw);if(!status||status==='open'||status==='offen')return'open';if(status==='done'||status==='erledigt')return'done';
    if(status==='in_progress'||status==='in progress'||status==='in bearbeitung'||status==='bearbeitung')return'in_progress';if(status==='cancelled'||status==='canceled'||status==='storniert')return'cancelled';return raw;
  }
  function normalizeTask(input,ctx={}){
    const t={...(input||{})};
    const sourceRef=q(t.sourceRef||t.linkedShipmentRef||t.shipmentRef||t.reference||t.ref);
    const sourceId=q(t.sourceId||t.linkedShipmentId||t.pickId||t.abdId||sourceRef||t.id);
    // weekly-plan and manual tasks are grouped by their area (Picken, ABD erstellen …), never as shipment tasks
    const planArea=planTask(t)?q(t.area||t.category):'';
    const group=planArea||(GROUPS.includes(q(t.group))?q(t.group):(q(t.group)||'Offene Sendungen'));
    const legacyPriority=/^P[0-4]$/.test(q(t.priority).toUpperCase())?q(t.priority).toUpperCase():'P4';
    const originalAssignee=q(t.originalAssignee||t.owner||t.assignee||t.userId);
    const effectiveAssignee=q(t.effectiveAssignee||originalAssignee);
    const occurrenceKey=q(t.occurrenceKey||t.weekKey||t.seriesOccurrence);
    const id=q(t.id)||`task:${[q(t.companyId||ctx.companyId),q(t.environment||ctx.environment),group,inferSourceType(t),sourceId,occurrenceKey].join('|')}`;
    const c=core(),v2=c?c.normalizeTask({...t,id},{...ctx}):{...t,id,status:canonicalTaskStatus(t.status),dueAt:q(t.dueAt||t.dueDate||t.date)};
    return {
      ...v2,
      id,
      sourceType:inferSourceType(t),sourceId,sourceRef,group,title:q(t.title||t.name||t.subject),
      status:v2.status||canonicalTaskStatus(t.status),
      priority:legacyPriority,
      v2Priority:q(v2.priority)||legacyPriority,
      originalAssignee,effectiveAssignee,substitutionReason:q(t.substitutionReason),recurrence:q(t.recurrence),occurrenceKey,
      completedAt:q(t.completedAt||v2.completedAt),completedBy:q(t.completedBy),companyId:q(t.companyId||ctx.companyId),environment:q(t.environment||ctx.environment),
      createdAt:q(t.createdAt),updatedAt:q(t.updatedAt)
    };
  }
  function identityKey(task){const t=normalizeTask(task);return [t.companyId,t.environment,t.group,t.sourceType,t.sourceId,t.occurrenceKey].join('|');}
  function dueBucket(task,now){const due=dayKey(task&&task.dueAt);if(!due)return'none';const today=dayKey(now||new Date());if(!today)return'none';if(due<today)return'overdue';if(due===today)return'today';return'future';}
  function taskTimeValue(task){const raw=q(task&&(task.createdAt||task.requestedAt||task.updatedAt));if(!raw)return 0;const t=Date.parse(raw);return Number.isFinite(t)?t:0;}
  function compareTasks(a,b,now){
    const aa=normalizeTask(a),bb=normalizeTask(b);if(aa.group==='Offene ABDs'&&bb.group==='Offene ABDs'){const at=taskTimeValue(aa),bt=taskTimeValue(bb);if(at!==bt)return bt-at;}
    const p=(PRIORITY_RANK[aa.priority]??99)-(PRIORITY_RANK[bb.priority]??99);if(p)return p;const d=(DUE_RANK[dueBucket(aa,now)]??99)-(DUE_RANK[dueBucket(bb,now)]??99);if(d)return d;
    const ad=dayKey(aa.dueAt),bd=dayKey(bb.dueAt);if(ad!==bd)return ad.localeCompare(bd);return(aa.sourceRef||aa.id).localeCompare(bb.sourceRef||bb.id,'de');
  }
  function absenceActive(absence,userId,ctx){if(q(absence&&absence.userId)!==q(userId))return false;const company=q(ctx&&ctx.companyId);if(q(absence&&absence.companyId)&&company&&q(absence.companyId)!==company)return false;const today=dayKey((ctx&&ctx.now)||new Date());const start=dayKey(absence&&absence.start),end=dayKey(absence&&absence.end);if(start&&today<start)return false;if(end&&today>end)return false;return true;}
  function resolveAssignee(task,ctx={}){const t=normalizeTask(task,ctx),original=q(t.originalAssignee);const absence=arr(ctx.absences).find(a=>absenceActive(a,original,ctx)&&q(a.replacementUserId||a.replacement||a.substitute));if(!absence)return{...t,effectiveAssignee:q(t.effectiveAssignee||original)};return{...t,originalAssignee:original,effectiveAssignee:q(absence.replacementUserId||absence.replacement||absence.substitute),substitutionReason:q(absence.reason||'Vertretung')};}
  function visibleTasks(tasks,ctx={}){const company=q(ctx.companyId),environment=q(ctx.environment),user=q(ctx.currentUserId);return arr(tasks).map(t=>resolveAssignee(t,ctx)).filter(t=>(!company||t.companyId===company)&&(!environment||t.environment===environment)&&(!user||t.effectiveAssignee===user));}
  function nextOccurrence(task,now){
    const recurrenceApi=root.ExportHUBTaskRecurrenceV2;if(recurrenceApi&&typeof recurrenceApi.nextOccurrence==='function')return recurrenceApi.nextOccurrence(task,now);
    const current=normalizeTask(task),recurrence=q(current.recurrence).toLowerCase(),base=dayKey(current.dueAt)||dayKey(now||new Date());let nextDay=base,nextKey='';
    if(/week/.test(recurrence)){nextDay=addDays(base,7);nextKey=isoWeekKey(nextDay);}else{nextDay=addDays(base,1);nextKey=nextDay;}
    return{...current,id:`${current.id}:next:${nextKey}`,occurrenceKey:nextKey,dueAt:current.dueAt?nextDay:current.dueAt,status:'open',completedAt:'',completedBy:'',createdAt:q(now),updatedAt:q(now)};
  }
  function reminderKey(task,date,slot,environment,userId){const t=normalizeTask(task);return[t.id,q(date),q(slot),q(environment),q(userId)].join('|');}
  function reminderCandidates(tasks,ctx={}){return visibleTasks(tasks,ctx).filter(t=>t.status==='open'||t.status==='in_progress').sort((a,b)=>compareTasks(a,b,ctx.now));}
  function sameScope(task,ctx){const company=q(ctx&&ctx.companyId),environment=q(ctx&&ctx.environment),taskCompany=q(task&&task.companyId),taskEnvironment=q(task&&task.environment);if(company&&taskCompany&&company!==taskCompany)return false;if(environment&&taskEnvironment&&environment!==taskEnvironment)return false;return true;}
  function idOf(item){return q(item&&(item.id||item.shipmentId||item.pickId||item.sourceId));}
  function refOf(item){return q(item&&(item.ref||item.reference||item.shipmentRef||item.sourceRef));}
  function findShipment(task,domain){const sourceId=q(task.sourceId),sourceRef=q(task.sourceRef);return arr(domain&&domain.shipments).find(s=>(sourceId&&(idOf(s)===sourceId||refOf(s)===sourceId))||(sourceRef&&(refOf(s)===sourceRef||idOf(s)===sourceRef)))||null;}
  function findPick(task,domain){const sourceId=q(task.sourceId);return arr(domain&&domain.picks).find(p=>sourceId&&(idOf(p)===sourceId||q(p&&p.reference)===sourceId))||null;}
  function statusText(item){return low(item&&(item.status||item.state||item.pickupStatus));}
  function fileCount(value){if(Array.isArray(value))return value.length;if(value&&typeof value==='object')return 1;return q(value)?1:0;}
  function hasPod(shipment){if(!shipment)return false;if(fileCount(shipment.podFiles)||fileCount(shipment.pods)||fileCount(shipment.pod)||fileCount(shipment.podFile)||q(shipment.podUrl))return true;return /pod vorhanden|pod received|pod complete/.test(statusText(shipment));}
  function hasAbd(shipment){if(!shipment)return false;return !!(fileCount(shipment.abdFiles)||fileCount(shipment.abds)||fileCount(shipment.abd)||fileCount(shipment.abdFile)||q(shipment.abdRef||shipment.abdReference));}
  function fullyCollected(shipment){if(!shipment)return false;const total=Number(shipment.totalColli??shipment.totalPackages??shipment.colliTotal??0),collected=Number(shipment.collectedColli??shipment.pickedColli??shipment.collectedPackages??0);if(Number.isFinite(total)&&total>0&&Number.isFinite(collected))return collected>=total;const status=statusText(shipment);if(/teilweise|partial/.test(status))return false;return /abgeholt|picked up|collected|pod vorhanden|abgeschlossen|archiviert/.test(status);}
  function pickCompleted(pick){if(!pick)return false;if(pick.completed===true||pick.done===true||pick.picked===true)return true;return /done|complete|completed|picked|erledigt|abgeschlossen/.test(statusText(pick));}
  function shipmentCompleted(shipment){return /abgeschlossen|archiviert|completed|closed/.test(statusText(shipment));}
  function shipmentCancelled(shipment){return /storniert|cancelled|canceled/.test(statusText(shipment));}
  function markDone(task,by,ctx){
    if(task.status==='done')return task;const at=q(ctx&&ctx.now)||new Date().toISOString(),c=core();
    if(c&&typeof c.completeTask==='function'){const done=c.completeTask(task,{at,mode:'automatic'});return{...done,priority:task.priority,v2Priority:done.priority,completedBy:by,updatedAt:at};}
    return{...task,status:'done',completedAt:at,completedBy:by,updatedAt:at};
  }
  function markCancelled(task,ctx){
    if(task.status==='cancelled')return task;const at=q(ctx&&ctx.now)||new Date().toISOString(),c=core();
    if(c&&typeof c.cancelTask==='function'){const cancelled=c.cancelTask(task,{at,source:'workflow'});return{...cancelled,priority:task.priority,v2Priority:cancelled.priority,completedAt:at,completedBy:'system:cancel',updatedAt:at};}
    return{...task,status:'cancelled',completedAt:at,completedBy:'system:cancel',updatedAt:at};
  }
  function workflowOwned(task){return arr(task&&task.workflowEvents).concat(arr(task&&task.autoCompleteEvents)).map(q).some(Boolean)||!!q(task&&task.workflowEvent||task&&task.autoCompleteEvent);}
  function lifecycleFingerprint(task){const t=task||{};return[q(t.status),q(t.completedAt),q(t.completedBy),q(t.effectiveAssignee),q(t.substitutionReason),q(t.occurrenceKey),q(t.id)].join('|');}
  function reconcile(tasks,domain={},ctx={}){
    const input=arr(tasks);let changed=false;let out=input.map(original=>{
      if(!sameScope(original,ctx))return{...original};let task=normalizeTask(original,ctx),before=lifecycleFingerprint(task);task=resolveAssignee(task,ctx);const workflowBound=workflowOwned(task);
      if(task.status==='open'||task.status==='in_progress'){
        if(task.group==='Fehlende POD'){const shipment=findShipment(task,domain);if(!workflowBound&&shipment&&fullyCollected(shipment)&&hasPod(shipment))task=markDone(task,'system:pod',ctx);}
        else if(task.group==='Offene ABDs'){const shipment=findShipment(task,domain);if(shipment&&shipment.abdRequired===false)task=markCancelled(task,ctx);else if(!workflowBound&&shipment&&hasAbd(shipment))task=markDone(task,'system:abd',ctx);}
        else if(task.group==='Picks'){const pick=findPick(task,domain);if(!workflowBound&&pickCompleted(pick))task=markDone(task,'system:pick',ctx);}
        else if(task.group==='Kunde angemeldet'){const shipment=findShipment(task,domain);if(shipmentCancelled(shipment))task=markCancelled(task,ctx);else if(!workflowBound&&shipment&&fullyCollected(shipment))task=markDone(task,'system:pickup',ctx);}
        else if(task.group==='Offene Sendungen'){const shipment=findShipment(task,domain);if(shipmentCancelled(shipment))task=markCancelled(task,ctx);else if(!workflowBound&&shipmentCompleted(shipment))task=markDone(task,'system:shipment',ctx);}
      }
      if(lifecycleFingerprint(task)!==before)changed=true;return task;
    });
    const recurrenceApi=root.ExportHUBTaskRecurrenceV2;
    if(recurrenceApi&&typeof recurrenceApi.materialize==='function'){
      const materialized=recurrenceApi.materialize({series:arr(domain&&domain.taskSeries),tasks:out,calendar:recurrenceApi.calendar(domain&&domain.taskCalendar||{}),now:ctx.now});
      out=materialized.tasks;if(materialized.changed)changed=true;
      if(typeof recurrenceApi.materializeLegacy==='function'){const legacy=recurrenceApi.materializeLegacy(out,ctx.now,arr(domain&&domain.taskSeries));out=legacy.tasks;if(legacy.changed)changed=true;}
    }else{
      const keys=new Set(out.map(identityKey)),generated=[];for(const task of out){if(task.status!=='done'||!q(task.recurrence))continue;const next=nextOccurrence(task,ctx.now),key=identityKey(next);if(keys.has(key))continue;keys.add(key);generated.push(next);}if(generated.length){out.push(...generated);changed=true;}
    }
    return{tasks:out,changed};
  }

  root.ExportHUBRC1014Tasks=Object.freeze({GROUPS,normalizeTask,identityKey,dueBucket,compareTasks,resolveAssignee,nextOccurrence,reconcile,visibleTasks,reminderKey,reminderCandidates});
})(globalThis);