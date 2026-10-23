(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const indexCache=new WeakMap();
  const dashboardCache=new WeakMap();

  function core(){
    const api=root.ExportHUBTaskCoreV2;
    if(!api||typeof api.normalizeTask!=='function'||typeof api.derive!=='function')throw new Error('TaskPlanner V2 Core missing');
    return api;
  }

  function nowOf(ctx){return q(ctx&&ctx.now)||new Date().toISOString();}
  function dayKey(value){return core().dayKey(value);}
  function taskDay(task){return dayKey(task&&((task.plannedAt||task.dueAt||task.date||task.day)));}
  function isTerminal(task){const status=q(task&&task.status).toLowerCase();return status==='done'||status==='cancelled';}
  function mondayOf(value){
    const key=dayKey(value)||dayKey(new Date()),d=new Date(key+'T12:00:00Z'),weekday=d.getUTCDay()||7;
    d.setUTCDate(d.getUTCDate()-(weekday-1));return d.toISOString().slice(0,10);
  }
  function addDays(date,days){const d=new Date(q(date)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+Number(days||0));return d.toISOString().slice(0,10);}
  function betweenDay(day,start,end){return !!day&&day>=start&&day<=end;}
  function revisionOf(state){return q(state&&((state.taskRevision||state.tasksRevision||state.taskUpdatedAt||state.updatedAt)));}
  function cacheKey(state,ctx,extra=''){return [dayKey(nowOf(ctx)),revisionOf(state),arr(state&&state.tasks).length,q(extra)].join('|');}

  function buildIndex(state,ctx={}){
    state=obj(state)?state:{};const tasks=arr(state.tasks),key=cacheKey(state,ctx);
    let cache=indexCache.get(tasks);if(cache&&cache.key===key)return cache;
    const now=nowOf(ctx),records=[],byDay=Object.create(null),byCustomer=Object.create(null),byProcess=Object.create(null);
    for(const raw of tasks){
      const task=core().normalizeTask(raw,{now}),derived=core().derive(task,now),day=taskDay(task),status=q(task.status),terminal=isTerminal(task);
      const record={task,derived,day,status,terminal};records.push(record);
      if(day){
        const row=byDay[day]||(byDay[day]={count:0,active:0,done:0,critical:0,overdue:0,waiting:0});
        row.count++;if(!terminal)row.active++;if(status==='done')row.done++;if(task.priority==='P0'&&!terminal)row.critical++;if(derived.overdue)row.overdue++;if((status==='waiting'||status==='waiting_feedback')&&!terminal)row.waiting++;
      }
      if(q(task.customerId)){const id=q(task.customerId);byCustomer[id]=(byCustomer[id]||0)+1;}
      if(q(task.processId)){const id=q(task.processId);byProcess[id]=(byProcess[id]||0)+1;}
    }
    const signature=`tpv2:${key}:${records.length}`;
    const publicIndex=Object.freeze({signature,activeCount:records.filter(r=>!r.terminal).length,totalCount:records.length,byDay,byCustomer,byProcess});
    cache={key,signature,records,publicIndex};indexCache.set(tasks,cache);return cache;
  }

  function index(state,ctx={}){return buildIndex(state,ctx).publicIndex;}

  function today(state,ctx={}){
    const idx=buildIndex(state,ctx),date=dayKey(nowOf(ctx)),items=idx.records.filter(r=>!r.terminal&&r.day===date).map(r=>r.task);
    return {signature:`${idx.signature}:today:${date}`,date,count:items.length,items};
  }

  function week(state,ctx={}){
    const idx=buildIndex(state,ctx),start=mondayOf(ctx.weekStart||nowOf(ctx)),end=addDays(start,4),active=[],done=[];
    for(const row of idx.records){
      if(!betweenDay(row.day,start,end))continue;
      if(row.status==='cancelled')continue;
      if(row.status==='done')done.push(row.task);else active.push(row.task);
    }
    const total=active.length+done.length,percent=total?Math.round(done.length*100/total):0;
    return {signature:`${idx.signature}:week:${start}`,start,end,items:active,done,total,percent};
  }

  function dashboard(state,ctx={}){
    state=obj(state)?state:{};const tasks=arr(state.tasks),overloaded=!!(ctx&&ctx.weekDraft&&ctx.weekDraft.overloaded),key=cacheKey(state,ctx,`dashboard:${overloaded?'1':'0'}:${mondayOf(ctx.weekStart||nowOf(ctx))}`);
    let map=dashboardCache.get(tasks);if(!map){map=new Map();dashboardCache.set(tasks,map);}if(map.has(key))return map.get(key);
    const idx=buildIndex(state,ctx),date=dayKey(nowOf(ctx)),weekStart=mondayOf(ctx.weekStart||nowOf(ctx)),weekEnd=addDays(weekStart,4);
    let todayCount=0,weekCount=0,overdue=0,critical=0,waiting=0,done=0,weeklyTotal=0;
    for(const row of idx.records){
      const task=row.task,status=row.status,inWeek=betweenDay(row.day,weekStart,weekEnd);
      if(status==='cancelled')continue;
      if(status==='done'){
        const completedDay=dayKey(task.completedAt||task.dueAt);if(betweenDay(completedDay,weekStart,weekEnd))done++;
        if(inWeek)weeklyTotal++;
        continue;
      }
      if(row.day===date)todayCount++;
      if(inWeek){weekCount++;weeklyTotal++;}
      if(row.derived.overdue)overdue++;
      if(task.priority==='P0')critical++;
      if(status==='waiting'||status==='waiting_feedback')waiting++;
    }
    const weekly={done,total:weeklyTotal,percent:weeklyTotal?Math.round(done*100/weeklyTotal):0};
    const out=Object.freeze({signature:`${idx.signature}:dashboard:${weekStart}:${overloaded?'1':'0'}`,counts:{today:todayCount,week:weekCount,overdue,critical,done,waiting},weekly,overloaded});
    map.set(key,out);if(map.size>12)map.delete(map.keys().next().value);return out;
  }

  function pageRows(rows,page,pageSize){
    const size=Math.max(1,Math.min(200,Number(pageSize)||25)),current=Math.max(1,Number(page)||1),total=rows.length,pages=Math.max(1,Math.ceil(total/size)),safePage=Math.min(current,pages),start=(safePage-1)*size;
    return {items:rows.slice(start,start+size),page:safePage,pageSize:size,total,pages};
  }
  function historySort(a,b){return Date.parse(q(b.completedAt||b.archivedAt||b.dueAt)) - Date.parse(q(a.completedAt||a.archivedAt||a.dueAt));}

  function customer(customerId,state,ctx={}){
    const id=q(customerId);state=obj(state)?state:{};if(!id)return{customerId:'',active:[],upcoming:[],history:pageRows([],ctx.page,ctx.pageSize)};
    const now=nowOf(ctx),todayKey=dayKey(now),active=[],upcoming=[],history=[];
    for(const raw of arr(state.tasks)){
      const task=core().normalizeTask(raw,{now});if(q(task.customerId)!==id)continue;
      if(isTerminal(task)){history.push(task);continue;}
      const day=taskDay(task);if(day&&day>todayKey)upcoming.push(task);else active.push(task);
    }
    for(const raw of arr(state.taskArchive))if(q(raw&&raw.customerId)===id)history.push(raw);
    history.sort(historySort);active.sort((a,b)=>Date.parse(q(a.dueAt||a.plannedAt))-Date.parse(q(b.dueAt||b.plannedAt)));upcoming.sort((a,b)=>Date.parse(q(a.plannedAt||a.dueAt))-Date.parse(q(b.plannedAt||b.dueAt)));
    return {customerId:id,active,upcoming,history:pageRows(history,ctx.page,ctx.pageSize)};
  }

  function matchesQuery(task,query={}){
    for(const key of ['customerId','processId','seriesId','completionMode']){const expected=q(query[key]);if(expected&&q(task&&task[key])!==expected)return false;}
    return true;
  }
  function archive(query,state,ctx={}){
    query=obj(query)?query:{};state=obj(state)?state:{};const rows=[];
    for(const raw of arr(state.taskArchive))if(matchesQuery(raw,query))rows.push(raw);
    rows.sort(historySort);return pageRows(rows,query.page||ctx.page,query.pageSize||ctx.pageSize);
  }

  function increment(bucket,key){const id=q(key)||'unknown';bucket[id]=(bucket[id]||0)+1;}
  function stats(query,state,ctx={}){
    query=obj(query)?query:{};state=obj(state)?state:{};const now=nowOf(ctx),active=[],completed=[];
    for(const raw of arr(state.tasks)){
      const task=core().normalizeTask(raw,{now});if(!matchesQuery(task,query))continue;
      if(task.status==='done')completed.push(task);else if(task.status!=='cancelled')active.push(task);
    }
    for(const raw of arr(state.taskArchive))if(matchesQuery(raw,query))completed.push(raw);
    let overdue=0,onTime=0,late=0,durationTotal=0,durationCount=0,recurring=0;
    const completionMode={automatic:0,manual:0,other:0},byCustomer={},byProcess={};
    for(const task of active){if(core().derive(task,now).overdue)overdue++;if(q(task.seriesId))recurring++;increment(byCustomer,task.customerId);increment(byProcess,task.processId);}
    for(const task of completed){
      const completedMs=Date.parse(q(task.completedAt)),dueMs=Date.parse(q(task.dueAt));
      if(Number.isFinite(completedMs)&&Number.isFinite(dueMs)){if(completedMs<=dueMs)onTime++;else late++;}
      const createdMs=Date.parse(q(task.createdAt));if(Number.isFinite(completedMs)&&Number.isFinite(createdMs)&&completedMs>=createdMs){durationTotal+=(completedMs-createdMs)/60000;durationCount++;}
      const mode=q(task.completionMode);if(mode==='automatic')completionMode.automatic++;else if(mode==='manual')completionMode.manual++;else completionMode.other++;
      if(q(task.seriesId))recurring++;increment(byCustomer,task.customerId);increment(byProcess,task.processId);
    }
    return {open:active.length,overdue,completed:completed.length,onTime,late,averageDurationMinutes:durationCount?Math.round(durationTotal/durationCount):0,completionMode,byCustomer,byProcess,recurring};
  }

  root.ExportHUBTaskProjectionsV2=Object.freeze({version:'2.0',index,today,week,dashboard,customer,archive,stats});
})(globalThis);
