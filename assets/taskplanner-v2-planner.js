(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const PRIORITY=Object.freeze({P0:0,P1:1,P2:2,P3:3});

  function core(){
    const api=root.ExportHUBTaskCoreV2;
    if(!api||typeof api.normalizeTask!=='function')throw new Error('TaskPlanner V2 Core fehlt');
    return api;
  }
  function recurrence(){
    const api=root.ExportHUBTaskRecurrenceV2;
    if(!api||typeof api.isWorkday!=='function')throw new Error('TaskPlanner V2 Recurrence fehlt');
    return api;
  }
  function dayKey(value){return core().dayKey(value);}
  function addDays(value,amount){
    const d=dayKey(value);if(!d)return'';
    const [y,m,day]=d.split('-').map(Number),date=new Date(Date.UTC(y,m-1,day));
    date.setUTCDate(date.getUTCDate()+Number(amount||0));return date.toISOString().slice(0,10);
  }
  function isoWeekday(value){const d=dayKey(value);if(!d)return 0;const [y,m,day]=d.split('-').map(Number);return new Date(Date.UTC(y,m-1,day)).getUTCDay()||7;}
  function monday(value){const d=dayKey(value);return d?addDays(d,1-isoWeekday(d)):'';}
  function terminal(task){const s=q(task&&task.status).toLowerCase();return s==='done'||s==='cancelled';}
  function dependencyIds(task){
    const out=[];for(const raw of arr(task&&task.dependencies)){
      const id=typeof raw==='string'?q(raw):q(raw&&(raw.taskId||raw.id||raw.dependsOn));
      if(id&&!out.includes(id))out.push(id);
    }
    return out;
  }
  function deadlineDay(task){return dayKey(task&&task.latestCompletionAt)||dayKey(task&&task.dueAt)||dayKey(task&&task.dueDate);}
  function priorityRank(value){return PRIORITY[q(value).toUpperCase()]??99;}

  function orderTasks(tasks,now){
    const api=core();
    return arr(tasks).map(task=>api.normalizeTask(task,{now})).sort((a,b)=>{
      const ad=api.derive(a,now),bd=api.derive(b,now);
      if(ad.overdue!==bd.overdue)return ad.overdue?-1:1;
      const p=priorityRank(a.priority)-priorityRank(b.priority);if(p)return p;
      const aa=deadlineDay(a)||'9999-12-31',bb=deadlineDay(b)||'9999-12-31';if(aa!==bb)return aa.localeCompare(bb);
      return q(a.id).localeCompare(q(b.id),'de');
    });
  }

  function validateDependencies(tasks){
    const list=arr(tasks),byId=new Map(list.map(t=>[q(t&&t.id),t]).filter(([id])=>id)),missing=[];
    for(const task of list)for(const dep of dependencyIds(task))if(!byId.has(dep))missing.push({taskId:q(task.id),dependencyId:dep});
    const visiting=new Set(),visited=new Set(),cycleIds=new Set();
    function visit(id,stack=[]){
      if(visiting.has(id)){
        const at=stack.indexOf(id),cycle=at>=0?stack.slice(at):[id];cycle.forEach(x=>cycleIds.add(x));cycleIds.add(id);return;
      }
      if(visited.has(id)||!byId.has(id))return;
      visiting.add(id);const nextStack=stack.concat(id);
      for(const dep of dependencyIds(byId.get(id)))visit(dep,nextStack);
      visiting.delete(id);visited.add(id);
    }
    for(const id of byId.keys())visit(id,[]);
    return{valid:missing.length===0&&cycleIds.size===0,missing,cycles:Array.from(cycleIds).sort()};
  }

  function workdays(weekStart,cal){
    const api=recurrence(),start=monday(weekStart)||dayKey(weekStart),days=[];
    for(let i=0;i<5;i++){const d=addDays(start,i);if(api.isWorkday(d,cal))days.push(d);}
    return days;
  }
  function firstAtOrAfter(date,days){for(const d of days)if(d>=date)return d;return days.at(-1)||date;}
  function lastAtOrBefore(date,days){let hit='';for(const d of days){if(d>date)break;hit=d;}return hit||days[0]||date;}
  function inRange(date,start,end){return !!date&&date>=start&&date<=end;}
  function todayInWeek(now,start,end){const today=dayKey(now);return inRange(today,start,end)?today:start;}
  function nextWorkdayAfter(date,cal){
    let d=dayKey(date);for(let i=0;i<370;i++){d=addDays(d,1);if(recurrence().isWorkday(d,cal))return d;}return addDays(date,1);
  }
  function plannerTime(task){const m=q(task&&task.plannedAt).match(/T(\d{2}:\d{2})/);return m?m[1]:'00:00';}
  function plannedAtFor(task,date){return core().localDateTime(date,plannerTime(task));}

  function buildWeekDraft(input={}){
    const api=core(),rec=recurrence(),cal=input.calendar||rec.calendar({}),now=q(input.now)||new Date().toISOString();
    const start=monday(input.weekStart||now),end=addDays(start,4),validDays=workdays(start,cal);
    const active=orderTasks(arr(input.tasks).filter(t=>!terminal(api.normalizeTask(t,{now}))),now),dependencyValidation=validateDependencies(active);
    const byId=new Map(active.map(t=>[q(t.id),t])),plannedById=new Map(),items=[],conflicts=[];
    let overloaded=!dependencyValidation.valid;
    for(const miss of dependencyValidation.missing)conflicts.push({type:'missing_dependency',...miss});
    for(const id of dependencyValidation.cycles)conflicts.push({type:'dependency_cycle',taskId:id});

    for(const task of active){
      const derived=api.derive(task,now),originalPlanned=dayKey(task.plannedAt),manualProtected=task.manualOverride===true&&!!originalPlanned&&input.allowManualOverride!==true;
      let proposed='';
      if(manualProtected)proposed=originalPlanned;
      else if(derived.overdue)proposed=firstAtOrAfter(todayInWeek(now,start,end),validDays);
      else if(originalPlanned&&input.recalculate!==true)proposed=originalPlanned;
      else{
        const deadline=deadlineDay(task);
        if(deadline&&deadline<start)proposed=validDays[0]||start;
        else if(deadline&&deadline>end)proposed=validDays.at(-1)||end;
        else if(deadline)proposed=lastAtOrBefore(deadline,validDays);
        else proposed=validDays[0]||start;
      }

      let holidayConflict=false,autoMoved=false,holidayReason=null;
      if(proposed&&!rec.isWorkday(proposed,cal)){
        if(manualProtected){holidayConflict=true;holidayReason=rec.nonWorkReason(proposed,cal);}
        else{
          const resolved=rec.resolveHoliday(proposed,task.holidayPolicy||'manual_decision',cal);
          holidayReason=resolved.reason||null;
          if(resolved.conflict||!resolved.date)holidayConflict=true;
          else{autoMoved=resolved.date!==proposed;proposed=resolved.date;}
        }
      }
      if(holidayConflict){conflicts.push({type:'holiday',taskId:task.id,date:proposed,reason:holidayReason});overloaded=true;}

      const deps=dependencyIds(task),openDeps=deps.filter(id=>{
        const dep=byId.get(id);return dep&&!terminal(dep);
      });
      let dependencyBlocked=openDeps.length>0;
      for(const depId of openDeps){
        const depPlanned=plannedById.get(depId)||dayKey(byId.get(depId)&&byId.get(depId).plannedAt);
        if(!depPlanned)continue;
        const required=nextWorkdayAfter(depPlanned,cal);
        if(manualProtected){
          if(proposed&&proposed<required){conflicts.push({type:'manual_dependency',taskId:task.id,dependencyId:depId,requiredDate:required,plannedDate:proposed});overloaded=true;}
        }else if(!proposed||proposed<required)proposed=required;
        const deadline=deadlineDay(task);
        if(deadline&&required>deadline){conflicts.push({type:'deadline_dependency',taskId:task.id,dependencyId:depId,requiredDate:required,deadline});overloaded=true;}
      }
      if(proposed&&!inRange(proposed,start,end)){
        const deadline=deadlineDay(task);
        if(deadline&&proposed>deadline){conflicts.push({type:'deadline_outside_week',taskId:task.id,plannedDate:proposed,deadline});overloaded=true;}
      }
      plannedById.set(task.id,proposed);
      const manualChanged=task.manualOverride===true&&input.allowManualOverride===true&&!!originalPlanned&&proposed!==originalPlanned;
      items.push({
        taskId:task.id,plannedDate:proposed,originalPlannedDate:originalPlanned,manualProtected,manualChanged,
        autoMoved,holidayConflict,holidayReason,dependencyBlocked,dependencyIds:deps,
        priority:task.priority,overdue:derived.overdue===true,dueDate:dayKey(task.dueAt),latestCompletionDate:dayKey(task.latestCompletionAt)
      });
    }
    return{version:'2.0',weekStart:start,weekEnd:end,items,conflicts,overloaded,dependencyValidation,calendar:cal,generatedAt:now};
  }

  function weekSummary(draft={}){
    const items=arr(draft.items);return{
      planned:items.filter(x=>q(x&&x.plannedDate)).length,
      autoMoved:items.filter(x=>x&&x.autoMoved===true).length,
      holidayConflicts:items.filter(x=>x&&x.holidayConflict===true).length,
      dependencyConflicts:items.filter(x=>x&&x.dependencyBlocked===true).length,
      manualChanges:items.filter(x=>x&&x.manualChanged===true).length
    };
  }

  function applyWeekDraft(state,draft,options={}){
    const source=obj(state)?state:{},items=arr(draft&&draft.items);
    if(items.some(item=>item&&item.holidayConflict===true))throw new Error('Feiertagskonflikt muss vor der Wochenplan-Übernahme gelöst werden.');
    if(arr(draft&&draft.conflicts).some(c=>c&&c.type==='dependency_cycle'))throw new Error('Abhängigkeitskonflikt muss vor der Wochenplan-Übernahme gelöst werden.');
    const next=clone(source),byId=new Map(items.map(item=>[q(item&&item.taskId),item]).filter(([id])=>id)),patches=[];
    next.tasks=arr(source.tasks).map(raw=>{
      const item=byId.get(q(raw&&raw.id));if(!item||!q(item.plannedDate))return clone(raw);
      if(item.manualProtected&&options.allowManualOverride!==true)return clone(raw);
      const old=dayKey(raw&&raw.plannedAt),date=q(item.plannedDate);if(old===date)return clone(raw);
      const changed={...clone(raw),plannedAt:plannedAtFor(raw,date),plannedDate:date};
      const at=q(options.at||draft&&draft.generatedAt)||new Date().toISOString();
      const history=arr(changed.history).map(clone);history.push(core().historyEntry('week_plan_applied',{at,source:'planner',before:{plannedAt:q(raw&&raw.plannedAt)},after:{plannedAt:changed.plannedAt}}));changed.history=history;
      patches.push({taskId:changed.id,plannedAt:changed.plannedAt,plannedDate:date});return changed;
    });
    return{state:next,patches,changed:patches.length>0,summary:weekSummary(draft)};
  }

  function recalculateWeek(input={}){return buildWeekDraft({...input,recalculate:true});}

  function monthProjection(input={}){
    const year=Number(input.year),month=Number(input.month),cal=input.calendar||recurrence().calendar({}),now=q(input.now)||new Date().toISOString();
    if(!Number.isInteger(year)||year<1900||!Number.isInteger(month)||month<1||month>12)throw new Error('Ungültiger Monat');
    const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate(),normalized=arr(input.tasks).map(t=>core().normalizeTask(t,{now})),days=[];
    for(let day=1;day<=daysInMonth;day++){
      const date=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const rows=normalized.filter(t=>dayKey(t.plannedAt||t.dueAt)===date),reason=recurrence().nonWorkReason(date,cal);
      days.push({
        date,workday:!reason,nonWorkReason:reason,
        taskCount:rows.length,doneCount:rows.filter(t=>t.status==='done').length,
        criticalCount:rows.filter(t=>t.priority==='P0'&&t.status!=='done'&&t.status!=='cancelled').length,
        overdueCount:rows.filter(t=>core().derive(t,now).overdue).length
      });
    }
    return{year,month,days};
  }


  // RC1771: Task and pickup-calendar coordination. Pure inspection first:
  // no pickup date, customs document or task is changed by this projection.
  function operationalKind(task){
    const text=[task&&task.area,task&&task.group,task&&task.taskType,task&&task.title]
      .map(x=>q(x).toLowerCase()).join(' ');
    if(/(?:\babd\b|ausfuhrbegleitdokument|customs declaration)/i.test(text))return'abd';
    if(/(?:\bpicken\b|\bpicking\b|\bpicks\b|\bpick\b)/i.test(text))return'pick';
    if(/(?:anmeld|registration|avisier)/i.test(text))return'registration';
    return'';
  }
  function operationalLink(task){
    const candidates=[
      task&&task.planningGroupId,task&&task.linkedShipmentId,
      task&&task.shipmentId,task&&task.linkedShipmentRef,
      task&&task.shipmentRef,task&&task.sourceRef,
      task&&q(task.sourceId)!==q(task.id)?task.sourceId:'',
      task&&task.reference
    ];
    for(const value of candidates){
      const key=q(value).toUpperCase();
      if(key&&key!=='UNDEFINED'&&!/^MANAGED:|^MASTER:|^M848:/.test(key))return key;
    }
    return'';
  }
  function shipmentIdentity(shipment){
    for(const key of ['id','shipmentId','reference','ref','shipmentRef','referenceNumber','referenceNo']){
      const value=q(shipment&&shipment[key]).toUpperCase();
      if(value)return value;
    }
    return'';
  }
  function shipmentPickupDay(shipment){
    for(const key of ['plannedPickupDate','pickupDate','pickdate']){
      const day=dayKey(shipment&&shipment[key]);if(day)return day;
    }
    return'';
  }
  function shipmentCustomerNumber(shipment){
    const customer=shipment&&shipment.customer||{};
    return q(shipment&&(shipment.customerNumber||shipment.customerAccount||shipment.customerNo||shipment.kundennummer)
      ||customer.customerNumber||customer.account).replace(/\s+/g,'').replace(/^0+(?=\d)/,'').toUpperCase();
  }
  function operationalTaskDate(task){
    return dayKey(task&&(task.plannedAt||task.plannedDate||task.dueAt||task.dueDate||task.date));
  }
  function operationalSignature(group,pick,abd){
    return [group,q(pick&&pick.id),operationalTaskDate(pick),q(abd&&abd.id),operationalTaskDate(abd)].join('|');
  }
  function inspectOperationalPlan(input={}){
    const tasks=arr(input.tasks),shipments=arr(input.shipments),fixedPickups=arr(input.fixedPickups);
    const warnings=[],byTaskId={},groups=new Map(),cal=input.calendar||recurrence().calendar({});
    for(const task of tasks){
      if(!task||terminal(task)||task.done===true||task.completed===true)continue;
      const kind=operationalKind(task),link=operationalLink(task);
      if(!kind||!link||!operationalTaskDate(task))continue;
      if(!groups.has(link))groups.set(link,{key:link,pick:[],abd:[],registration:[]});
      groups.get(link)[kind].push(task);
    }
    const lookupShipment=key=>shipments.find(sh=>shipmentIdentity(sh)===key
      ||[sh&&sh.id,sh&&sh.reference,sh&&sh.ref,sh&&sh.shipmentRef].some(v=>q(v).toUpperCase()===key));
    for(const group of groups.values()){
      // A shipment can have several individual operations. Do not silently
      // select one if multiple candidates make the dependency ambiguous.
      const pick=group.pick.length===1?group.pick[0]:null;
      const abd=group.abd.length===1?group.abd[0]:null;
      const registration=group.registration.length===1?group.registration[0]:null;
      const shipment=lookupShipment(group.key),pickDay=operationalTaskDate(pick),abdDay=operationalTaskDate(abd),registrationDay=operationalTaskDate(registration);
      const related=[...group.pick,...group.abd,...group.registration];
      if(group.pick.length>1||group.abd.length>1||group.registration.length>1){
        warnings.push({type:'ambiguous_link',groupId:group.key,taskIds:related.map(t=>q(t.id)),message:'Mehrere Vorgänge zur selben Sendung: Zuordnung prüfen.'});
        continue;
      }
      if(pick&&shipment&&!abd&&[
        shipment.requiresAbd,shipment.abdRequired,shipment.customsRequired,
        shipment.customsDeclarationRequired
      ].some(value=>value===true)){
        const warning={type:'abd_missing',groupId:group.key,taskId:q(pick.id),
          message:'Für diese Sendung ist ein ABD erforderlich, aber kein ABD-Termin verknüpft.'};
        warnings.push(warning);byTaskId[q(pick.id)]=warning;
      }
      if(pick&&abd){
        const signature=operationalSignature(group.key,pick,abd);
        const acknowledgment=abd.planningSameDayAbdApproval;
        const confirmed=acknowledgment&&acknowledgment.signature===signature&&q(acknowledgment.by)&&q(acknowledgment.at);
        if(pickDay===abdDay&&!confirmed){
          const warning={type:'abd_same_day',groupId:group.key,taskId:q(abd.id),pickId:q(pick.id),
            date:abdDay,signature,message:'ABD am selben Tag wie Picken – ausdrückliche Bestätigung erforderlich.'};
          warnings.push(warning);byTaskId[q(abd.id)]=warning;
        }else if(abdDay<pickDay){
          const warning={type:'abd_before_pick',groupId:group.key,taskId:q(abd.id),pickId:q(pick.id),
            date:abdDay,message:'ABD liegt vor dem Picken: Terminfolge prüfen.'};
          warnings.push(warning);byTaskId[q(abd.id)]=warning;
        }
      }
      if(registration){
        const prerequisite=abdDay||pickDay;
        if(prerequisite&&registrationDay<prerequisite){
          const warning={type:'registration_before_ready',groupId:group.key,taskId:q(registration.id),
            date:registrationDay,message:'Anmeldung liegt vor dem notwendigen Picken/ABD.'};
          warnings.push(warning);byTaskId[q(registration.id)]=warning;
        }
      }
      if(shipment){
        const booked=shipmentPickupDay(shipment);
        const lastMilestone=[pickDay,abdDay,registrationDay].filter(Boolean).sort().at(-1)||'';
        if(booked&&lastMilestone){
          const earliest=nextWorkdayAfter(lastMilestone,cal);
          if(booked<earliest){
            const warning={type:'pickup_notification',groupId:group.key,shipmentRef:group.key,
              bookedDate:booked,earliestDate:earliest,taskIds:related.map(t=>q(t.id)),
              message:'Gebuchter Abholtermin gefährdet. Spedition informieren und Abholung neu bestätigen.'};
            warnings.push(warning);
            for(const task of related)if(!byTaskId[q(task.id)])byTaskId[q(task.id)]=warning;
          }
        }
        const customer=shipmentCustomerNumber(shipment);
        if(customer){
          const fixed=fixedPickups.filter(f=>f&&f.active!==false
            &&q(f.customerNumber).replace(/\s+/g,'').replace(/^0+(?=\d)/,'').toUpperCase()===customer);
          const last=[pickDay,abdDay,registrationDay].filter(Boolean).sort().at(-1)||'';
          if(last&&fixed.length&&!booked){
            const earliest=[pickDay,abdDay,registrationDay].filter(Boolean).sort()[0];
            const earliestWeekday=(new Date(earliest+'T12:00:00Z').getUTCDay()||7);
            for(const item of fixed){
              const fixedWeekday=Number(item.weekday);
              if(!Number.isInteger(fixedWeekday)||fixedWeekday<1||fixedWeekday>5)continue;
              const daysTo=(fixedWeekday-earliestWeekday+7)%7;
              const fixedDate=addDays(earliest,daysTo);
              if(last>=fixedDate){
                warnings.push({type:'fixed_pickup_conflict',groupId:group.key,shipmentRef:group.key,bookedDate:fixedDate,
                  message:'Fester Abholtag kann nach dieser Planung nicht eingehalten werden. Spedition informieren.'});
              }
            }
          }
          if(last&&fixed.length&&booked){
            const bookedWeekday=(new Date(booked+'T12:00:00Z').getUTCDay()||7);
            if(fixed.some(f=>Number(f.weekday)===bookedWeekday)&&last>=booked){
              warnings.push({type:'fixed_pickup_conflict',groupId:group.key,shipmentRef:group.key,bookedDate:booked,
                message:'Fester Abholtag ist nach der Umplanung gefährdet – Spedition informieren.'});
            }
          }
        }
      }
    }
    return{warnings,byTaskId,groupsInspected:groups.size,hasPickupData:shipments.length>0,
      hasFixedPickupData:input.fixedPickupDataLoaded===true};
  }
  function approveSameDayAbd(tasks,request={}){
    const taskId=q(request.taskId),actorId=q(request.actorId),at=q(request.at)||new Date().toISOString();
    if(!taskId||!actorId)return{changed:false,reason:'Benutzer oder Aufgabe fehlt.'};
    const inspection=inspectOperationalPlan({tasks,shipments:arr(request.shipments),calendar:request.calendar});
    const warning=inspection.byTaskId[taskId];
    if(!warning||warning.type!=='abd_same_day')return{changed:false,reason:'Keine offene ABD-Ausnahme für dieses Vorkommen.'};
    const updated=arr(tasks).map(task=>{
      if(q(task&&task.id)!==taskId)return task;
      const confirmation={signature:warning.signature,by:actorId,at};
      const history=arr(task.history).concat([{action:'same_day_abd_confirmed',at,source:'manual',
        by:actorId,after:{signature:warning.signature,plannedDate:warning.date}}]);
      return{...task,planningSameDayAbdApproval:confirmation,history,updatedAt:at};
    });
    return{changed:true,tasks:updated,approval:{taskId,at,by:actorId,signature:warning.signature}};
  }

  root.ExportHUBTaskPlannerV2=Object.freeze({
    version:'2.0',inspectOperationalPlan,approveSameDayAbd,operationalKind,operationalLink,validateDependencies,orderTasks,buildWeekDraft,applyWeekDraft,recalculateWeek,weekSummary,monthProjection
  });
})(globalThis);
