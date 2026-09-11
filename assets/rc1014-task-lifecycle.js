(function(root){
  'use strict';

  const GROUPS=Object.freeze(['Offene Sendungen','Fehlende POD','Kunde angemeldet','Picks','Offene ABDs']);
  const PRIORITY_RANK=Object.freeze({P0:0,P1:1,P2:2,P3:3,P4:4});
  const DUE_RANK=Object.freeze({overdue:0,today:1,future:2,none:3});
  const q=v=>String(v==null?'':v).trim();
  const low=v=>q(v).toLowerCase();
  const arr=v=>Array.isArray(v)?v:[];

  function dayKey(value){
    const s=q(value);
    const m=s.match(/^(\d{4}-\d{2}-\d{2})/);
    if(m)return m[1];
    if(!s)return '';
    const d=new Date(s);
    if(Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function isoWeekKey(value){
    const s=dayKey(value);
    if(!s)return '';
    const [y,m,d]=s.split('-').map(Number);
    const date=new Date(Date.UTC(y,m-1,d));
    const weekday=date.getUTCDay()||7;
    date.setUTCDate(date.getUTCDate()+4-weekday);
    const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const week=Math.ceil((((date-yearStart)/86400000)+1)/7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
  }

  function addDays(value,days){
    const s=dayKey(value);
    if(!s)return '';
    const [y,m,d]=s.split('-').map(Number);
    const date=new Date(Date.UTC(y,m-1,d));
    date.setUTCDate(date.getUTCDate()+Number(days||0));
    return date.toISOString().slice(0,10);
  }

  function inferSourceType(t){
    const explicit=q(t&&t.sourceType);
    if(explicit)return explicit;
    const text=q((t&&t.group)||'')+' '+q((t&&t.title)||'');
    if(/pod/i.test(text))return 'pod';
    if(/abd/i.test(text))return 'abd';
    if(/pick/i.test(text))return 'pick';
    if(/abhol|pickup/i.test(text))return 'pickup';
    if(q(t&&t.manual)||/manuell/i.test(text))return 'manual';
    return 'shipment';
  }

  function canonicalTaskStatus(value){
    const raw=q(value);
    const status=low(raw);
    if(!status||status==='open'||status==='offen')return 'open';
    if(status==='done'||status==='erledigt')return 'done';
    if(status==='cancelled'||status==='canceled'||status==='storniert')return 'cancelled';
    return raw;
  }

  function normalizeTask(input,ctx={}){
    const t={...(input||{})};
    const sourceRef=q(t.sourceRef||t.linkedShipmentRef||t.shipmentRef||t.reference||t.ref);
    const sourceId=q(t.sourceId||t.linkedShipmentId||t.pickId||t.abdId||sourceRef||t.id);
    const group=GROUPS.includes(q(t.group))?q(t.group):(q(t.group)||'Offene Sendungen');
    const priority=/^P[0-4]$/.test(q(t.priority).toUpperCase())?q(t.priority).toUpperCase():'P4';
    const originalAssignee=q(t.originalAssignee||t.owner||t.assignee||t.userId);
    const effectiveAssignee=q(t.effectiveAssignee||originalAssignee);
    const occurrenceKey=q(t.occurrenceKey||t.weekKey||t.seriesOccurrence);
    const id=q(t.id)||`task:${[q(t.companyId||ctx.companyId),q(t.environment||ctx.environment),group,inferSourceType(t),sourceId,occurrenceKey].join('|')}`;
    return {
      ...t,
      id,
      sourceType:inferSourceType(t),
      sourceId,
      sourceRef,
      group,
      title:q(t.title),
      status:canonicalTaskStatus(t.status),
      dueAt:q(t.dueAt||t.dueDate||t.date),
      priority,
      originalAssignee,
      effectiveAssignee,
      substitutionReason:q(t.substitutionReason),
      recurrence:q(t.recurrence),
      occurrenceKey,
      completedAt:q(t.completedAt),
      completedBy:q(t.completedBy),
      companyId:q(t.companyId||ctx.companyId),
      environment:q(t.environment||ctx.environment),
      createdAt:q(t.createdAt),
      updatedAt:q(t.updatedAt)
    };
  }

  function identityKey(task){
    const t=normalizeTask(task);
    return [t.companyId,t.environment,t.group,t.sourceType,t.sourceId,t.occurrenceKey].join('|');
  }

  function dueBucket(task,now){
    const due=dayKey(task&&task.dueAt);
    if(!due)return 'none';
    const today=dayKey(now||new Date());
    if(!today)return 'none';
    if(due<today)return 'overdue';
    if(due===today)return 'today';
    return 'future';
  }

  function compareTasks(a,b,now){
    const aa=normalizeTask(a),bb=normalizeTask(b);
    const p=(PRIORITY_RANK[aa.priority]??99)-(PRIORITY_RANK[bb.priority]??99);
    if(p)return p;
    const d=(DUE_RANK[dueBucket(aa,now)]??99)-(DUE_RANK[dueBucket(bb,now)]??99);
    if(d)return d;
    const ad=dayKey(aa.dueAt),bd=dayKey(bb.dueAt);
    if(ad!==bd)return ad.localeCompare(bd);
    return (aa.sourceRef||aa.id).localeCompare(bb.sourceRef||bb.id,'de');
  }

  function absenceActive(absence,userId,ctx){
    if(q(absence&&absence.userId)!==q(userId))return false;
    const company=q(ctx&&ctx.companyId);
    if(q(absence&&absence.companyId)&&company&&q(absence.companyId)!==company)return false;
    const today=dayKey((ctx&&ctx.now)||new Date());
    const start=dayKey(absence&&absence.start),end=dayKey(absence&&absence.end);
    if(start&&today<start)return false;
    if(end&&today>end)return false;
    return true;
  }

  function resolveAssignee(task,ctx={}){
    const t=normalizeTask(task,ctx);
    const original=q(t.originalAssignee);
    const absence=arr(ctx.absences).find(a=>absenceActive(a,original,ctx)&&q(a.replacementUserId||a.replacement||a.substitute));
    if(!absence)return {...t,effectiveAssignee:q(t.effectiveAssignee||original)};
    return {
      ...t,
      originalAssignee:original,
      effectiveAssignee:q(absence.replacementUserId||absence.replacement||absence.substitute),
      substitutionReason:q(absence.reason||'Vertretung')
    };
  }

  function visibleTasks(tasks,ctx={}){
    const company=q(ctx.companyId),environment=q(ctx.environment),user=q(ctx.currentUserId);
    return arr(tasks)
      .map(t=>resolveAssignee(t,ctx))
      .filter(t=>(!company||t.companyId===company)&&(!environment||t.environment===environment)&&(!user||t.effectiveAssignee===user));
  }

  function nextOccurrence(task,now){
    const current=normalizeTask(task);
    const recurrence=q(current.recurrence).toLowerCase();
    const base=dayKey(current.dueAt)||dayKey(now||new Date());
    let nextDay=base;
    let nextKey='';
    if(/week/.test(recurrence)){
      nextDay=addDays(base,7);
      nextKey=isoWeekKey(nextDay);
    }else if(/day|daily|täglich|taeglich/.test(recurrence)){
      nextDay=addDays(base,1);
      nextKey=nextDay;
    }else{
      nextDay=addDays(base,1);
      nextKey=nextDay;
    }
    return {
      ...current,
      id:`${current.id}:next:${nextKey}`,
      occurrenceKey:nextKey,
      dueAt:current.dueAt?nextDay:current.dueAt,
      status:'open',
      completedAt:'',
      completedBy:'',
      createdAt:q(now),
      updatedAt:q(now)
    };
  }

  function reminderKey(task,date,slot,environment,userId){
    const t=normalizeTask(task);
    return [t.id,q(date),q(slot),q(environment),q(userId)].join('|');
  }

  function reminderCandidates(tasks,ctx={}){
    return visibleTasks(tasks,ctx)
      .filter(t=>t.status==='open')
      .sort((a,b)=>compareTasks(a,b,ctx.now));
  }

  function sameScope(task,ctx){
    const company=q(ctx&&ctx.companyId),environment=q(ctx&&ctx.environment);
    const taskCompany=q(task&&task.companyId),taskEnvironment=q(task&&task.environment);
    if(company&&taskCompany&&company!==taskCompany)return false;
    if(environment&&taskEnvironment&&environment!==taskEnvironment)return false;
    return true;
  }

  function idOf(item){return q(item&&(item.id||item.shipmentId||item.pickId||item.sourceId));}
  function refOf(item){return q(item&&(item.ref||item.reference||item.shipmentRef||item.sourceRef));}
  function findShipment(task,domain){
    const sourceId=q(task.sourceId),sourceRef=q(task.sourceRef);
    return arr(domain&&domain.shipments).find(s=>
      (sourceId&&(idOf(s)===sourceId||refOf(s)===sourceId))||
      (sourceRef&&(refOf(s)===sourceRef||idOf(s)===sourceRef))
    )||null;
  }
  function findPick(task,domain){
    const sourceId=q(task.sourceId);
    return arr(domain&&domain.picks).find(p=>sourceId&&(idOf(p)===sourceId||q(p&&p.reference)===sourceId))||null;
  }
  function statusText(item){return low(item&&(item.status||item.state||item.pickupStatus));}
  function fileCount(value){
    if(Array.isArray(value))return value.length;
    if(value&&typeof value==='object')return 1;
    return q(value)?1:0;
  }
  function hasPod(shipment){
    if(!shipment)return false;
    if(fileCount(shipment.podFiles)||fileCount(shipment.pods)||fileCount(shipment.pod)||fileCount(shipment.podFile)||q(shipment.podUrl))return true;
    return /pod vorhanden|pod received|pod complete/.test(statusText(shipment));
  }
  function hasAbd(shipment){
    if(!shipment)return false;
    return !!(fileCount(shipment.abdFiles)||fileCount(shipment.abds)||fileCount(shipment.abd)||fileCount(shipment.abdFile)||q(shipment.abdRef||shipment.abdReference));
  }
  function fullyCollected(shipment){
    if(!shipment)return false;
    const total=Number(shipment.totalColli??shipment.totalPackages??shipment.colliTotal??0);
    const collected=Number(shipment.collectedColli??shipment.pickedColli??shipment.collectedPackages??0);
    if(Number.isFinite(total)&&total>0&&Number.isFinite(collected))return collected>=total;
    const status=statusText(shipment);
    if(/teilweise|partial/.test(status))return false;
    return /abgeholt|picked up|collected|pod vorhanden|abgeschlossen|archiviert/.test(status);
  }
  function pickCompleted(pick){
    if(!pick)return false;
    if(pick.completed===true||pick.done===true||pick.picked===true)return true;
    return /done|complete|completed|picked|erledigt|abgeschlossen/.test(statusText(pick));
  }
  function shipmentCompleted(shipment){return /abgeschlossen|archiviert|completed|closed/.test(statusText(shipment));}
  function shipmentCancelled(shipment){return /storniert|cancelled|canceled/.test(statusText(shipment));}
  function markDone(task,by,ctx){
    if(task.status==='done')return task;
    return {...task,status:'done',completedAt:q(ctx&&ctx.now)||new Date().toISOString(),completedBy:by,updatedAt:q(ctx&&ctx.now)||task.updatedAt};
  }
  function markCancelled(task,ctx){
    if(task.status==='cancelled')return task;
    return {...task,status:'cancelled',completedAt:q(ctx&&ctx.now)||new Date().toISOString(),completedBy:'system:cancel',updatedAt:q(ctx&&ctx.now)||task.updatedAt};
  }
  function lifecycleFingerprint(task){
    const t=task||{};
    return [q(t.status),q(t.completedAt),q(t.completedBy),q(t.effectiveAssignee),q(t.substitutionReason),q(t.occurrenceKey),q(t.id)].join('|');
  }

  function reconcile(tasks,domain={},ctx={}){
    const input=arr(tasks);
    let changed=false;
    const out=input.map(original=>{
      if(!sameScope(original,ctx))return {...original};
      let task=normalizeTask(original,ctx);
      const before=lifecycleFingerprint(task);
      task=resolveAssignee(task,ctx);
      if(task.status==='open'){
        if(task.group==='Fehlende POD'){
          const shipment=findShipment(task,domain);
          if(shipment&&fullyCollected(shipment)&&hasPod(shipment))task=markDone(task,'system:pod',ctx);
        }else if(task.group==='Offene ABDs'){
          const shipment=findShipment(task,domain);
          if(shipment&&shipment.abdRequired===false)task=markCancelled(task,ctx);
          else if(shipment&&hasAbd(shipment))task=markDone(task,'system:abd',ctx);
        }else if(task.group==='Picks'){
          const pick=findPick(task,domain);
          if(pickCompleted(pick))task=markDone(task,'system:pick',ctx);
        }else if(task.group==='Offene Sendungen'){
          const shipment=findShipment(task,domain);
          if(shipmentCancelled(shipment))task=markCancelled(task,ctx);
          else if(shipmentCompleted(shipment))task=markDone(task,'system:shipment',ctx);
        }
      }
      if(lifecycleFingerprint(task)!==before)changed=true;
      return task;
    });

    const keys=new Set(out.map(identityKey));
    const generated=[];
    for(const task of out){
      if(task.status!=='done'||!q(task.recurrence))continue;
      const next=nextOccurrence(task,ctx.now);
      const key=identityKey(next);
      if(keys.has(key))continue;
      keys.add(key);
      generated.push(next);
    }
    if(generated.length){out.push(...generated);changed=true;}
    return {tasks:out,changed};
  }

  root.ExportHUBRC1014Tasks=Object.freeze({
    GROUPS,
    normalizeTask,
    identityKey,
    dueBucket,
    compareTasks,
    resolveAssignee,
    nextOccurrence,
    reconcile,
    visibleTasks,
    reminderKey,
    reminderCandidates
  });
})(globalThis);
