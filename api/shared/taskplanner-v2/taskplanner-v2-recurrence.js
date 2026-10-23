(function(root){
  'use strict';

  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const DAY_MS=86400000;
  const MAX_RANGE_DAYS=3660;
  const HOLIDAY_CACHE=new Map();

  function core(){return root.ExportHUBTaskCoreV2&&typeof root.ExportHUBTaskCoreV2.normalizeTask==='function'?root.ExportHUBTaskCoreV2:null;}
  function dayKey(value){const c=core();if(c&&typeof c.dayKey==='function')return c.dayKey(value);const s=q(value),m=s.match(/^(\d{4}-\d{2}-\d{2})/);return m?m[1]:'';}
  function parts(date){const s=dayKey(date);if(!s)return null;const [year,month,day]=s.split('-').map(Number);return{year,month,day};}
  function fromParts(year,month,day){return `${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;}
  function utcDate(date){const p=parts(date);return p?new Date(Date.UTC(p.year,p.month-1,p.day)):null;}
  function addDays(date,amount){const d=utcDate(date);if(!d)return'';d.setUTCDate(d.getUTCDate()+Number(amount||0));return d.toISOString().slice(0,10);}
  function diffDays(a,b){const aa=utcDate(a),bb=utcDate(b);if(!aa||!bb)return NaN;return Math.round((aa-bb)/DAY_MS);}
  function isoWeekday(date){const d=utcDate(date);if(!d)return 0;return d.getUTCDay()||7;}
  function monthLastDay(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate();}
  function firstOfMonth(date){const p=parts(date);return p?fromParts(p.year,p.month,1):'';}
  function lastOfMonth(date){const p=parts(date);return p?fromParts(p.year,p.month,monthLastDay(p.year,p.month)):'';}
  function addMonths(date,amount){const p=parts(date);if(!p)return'';const d=new Date(Date.UTC(p.year,p.month-1+Number(amount||0),1));return fromParts(d.getUTCFullYear(),d.getUTCMonth()+1,1);}
  function monday(date){const wd=isoWeekday(date);return wd?addDays(date,1-wd):'';}

  function easterSunday(year){
    const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
    return fromParts(year,month,day);
  }

  function nrwHolidays(year){
    year=Number(year);if(!Number.isInteger(year)||year<1900||year>9999)return[];
    if(HOLIDAY_CACHE.has(year))return HOLIDAY_CACHE.get(year).map(clone);
    const easter=easterSunday(year);
    const rows=[
      {date:`${year}-01-01`,name:'Neujahr'},
      {date:addDays(easter,-2),name:'Karfreitag'},
      {date:addDays(easter,1),name:'Ostermontag'},
      {date:`${year}-05-01`,name:'Tag der Arbeit'},
      {date:addDays(easter,39),name:'Christi Himmelfahrt'},
      {date:addDays(easter,50),name:'Pfingstmontag'},
      {date:addDays(easter,60),name:'Fronleichnam'},
      {date:`${year}-10-03`,name:'Tag der Deutschen Einheit'},
      {date:`${year}-11-01`,name:'Allerheiligen'},
      {date:`${year}-12-25`,name:'1. Weihnachtstag'},
      {date:`${year}-12-26`,name:'2. Weihnachtstag'}
    ].sort((a,b)=>a.date.localeCompare(b.date));
    HOLIDAY_CACHE.set(year,rows.map(clone));
    return rows;
  }

  function normalizeClosure(raw,type){
    if(!raw)return null;
    if(typeof raw==='string'){const d=dayKey(raw);return d?{startDate:d,endDate:d,type,label:''}:null;}
    const start=dayKey(raw.startDate||raw.start||raw.date||raw.from),end=dayKey(raw.endDate||raw.end||raw.date||raw.to||start);
    if(!start||!end)return null;
    return{startDate:start,endDate:end<start?start:end,type:q(raw.type||type),label:q(raw.label||raw.name||raw.title)};
  }

  function calendar(stateCalendar={}){
    const src=obj(stateCalendar)?stateCalendar:{};
    const closures=[];
    [['closures','closure'],['companyHolidays','company_holiday'],['holidays','company_holiday'],['shutdowns','shutdown'],['companyShutdowns','shutdown'],['specialClosures','special_closure']].forEach(([key,type])=>arr(src[key]).forEach(item=>{const c=normalizeClosure(item,type);if(c)closures.push(c);}));
    return{closures,source:src};
  }

  function closureFor(date,cal){const d=dayKey(date);return arr(cal&&cal.closures).find(c=>d>=c.startDate&&d<=c.endDate)||null;}
  function publicHolidayFor(date){const p=parts(date);if(!p)return null;return nrwHolidays(p.year).find(h=>h.date===dayKey(date))||null;}
  function nonWorkReason(date,cal){
    const d=dayKey(date);if(!d)return{type:'invalid',date:d};
    const wd=isoWeekday(d);if(wd===6||wd===7)return{type:'weekend',date:d};
    const holiday=publicHolidayFor(d);if(holiday)return{type:'nrw_holiday',date:d,label:holiday.name};
    const closure=closureFor(d,cal);if(closure)return{type:closure.type||'closure',date:d,label:closure.label||''};
    return null;
  }
  function isWorkday(date,cal){return !nonWorkReason(date,cal);}

  function moveWorkdays(date,offset,cal){
    let current=dayKey(date);if(!current)throw new Error('Ungültiges Datum');
    const target=Math.trunc(Number(offset||0));
    if(target===0){if(isWorkday(current,cal))return current;for(let guard=0;guard<370;guard++){current=addDays(current,1);if(isWorkday(current,cal))return current;}throw new Error('Kein Arbeitstag gefunden');}
    const direction=target>0?1:-1;let remaining=Math.abs(target);
    for(let guard=0;guard<5000&&remaining>0;guard++){
      current=addDays(current,direction);
      if(isWorkday(current,cal))remaining--;
    }
    if(remaining>0)throw new Error('Arbeitstagsverschiebung überschreitet Sicherheitsgrenze');
    return current;
  }

  function nearestWorkday(date,direction,cal){let d=dayKey(date);for(let guard=0;guard<370;guard++){d=addDays(d,direction);if(isWorkday(d,cal))return d;}throw new Error('Kein gültiger Arbeitstag gefunden');}
  function resolveHoliday(date,policy,cal){
    const originalDate=dayKey(date),reason=nonWorkReason(originalDate,cal),p=q(policy||'manual_decision').toLowerCase();
    if(!reason)return{date:originalDate,originalDate,moved:false,conflict:false,policy:p,reason:null};
    if(p==='previous_workday')return{date:nearestWorkday(originalDate,-1,cal),originalDate,moved:true,conflict:false,policy:p,reason};
    if(p==='next_workday')return{date:nearestWorkday(originalDate,1,cal),originalDate,moved:true,conflict:false,policy:p,reason};
    if(p==='process_rule')return{date:null,originalDate,moved:false,conflict:true,requiresProcessRule:true,policy:p,reason};
    return{date:null,originalDate,moved:false,conflict:true,requiresDecision:true,policy:'manual_decision',reason};
  }

  function validateRule(rule){
    const r=obj(rule)?rule:{},type=q(r.type).toLowerCase(),errors=[];
    const allowed=new Set(['daily','weekly','monthly','yearly','nth_weekday','first_workday','last_workday','workdays_before_month_end','workdays_after_month_start']);
    if(!allowed.has(type))errors.push('type');
    if(type==='weekly'){
      const days=arr(r.weekdays).map(Number);if(!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>7))errors.push('weekdays');
      const interval=Number(r.intervalWeeks||1);if(!Number.isInteger(interval)||interval<1)errors.push('intervalWeeks');
    }
    if(type==='monthly'){const day=Number(r.day);if(!Number.isInteger(day)||day<1||day>31)errors.push('day');}
    if(type==='yearly'){const month=Number(r.month),day=Number(r.day);if(!Number.isInteger(month)||month<1||month>12)errors.push('month');if(!Number.isInteger(day)||day<1||day>31)errors.push('day');}
    if(type==='nth_weekday'){const nth=Number(r.nth),weekday=Number(r.weekday);if(!Number.isInteger(nth)||nth<1||nth>5)errors.push('nth');if(!Number.isInteger(weekday)||weekday<1||weekday>7)errors.push('weekday');}
    if(type==='workdays_before_month_end'||type==='workdays_after_month_start'){const offset=Number(r.offset);if(!Number.isInteger(offset)||offset<0||offset>31)errors.push('offset');}
    return{valid:errors.length===0,errors,type};
  }

  function boundedRange(range,now){
    let start=dayKey(range&&range.start),end=dayKey(range&&range.end);
    if(!start||!end){const today=dayKey(now||new Date()),weekStart=monday(today);start=weekStart;end=addDays(weekStart,11);}
    if(end<start)[start,end]=[end,start];
    const span=diffDays(end,start);if(!Number.isFinite(span)||span>MAX_RANGE_DAYS)throw new Error('Wiederholungszeitraum ist zu groß');
    return{start,end};
  }
  function monthsInRange(start,end){const out=[];let cursor=firstOfMonth(start),guard=0;while(cursor&&cursor<=end&&guard++<240){out.push(cursor);cursor=addMonths(cursor,1);}return out;}
  function policyDate(original,series,cal){
    if(isWorkday(original,cal))return{date:original,originalDate:original,moved:false,conflict:false};
    return resolveHoliday(original,series.holidayPolicy||'manual_decision',cal);
  }
  function pushOccurrence(out,series,original,cal){
    const resolved=policyDate(original,series,cal),key=`${q(series.id)}|${original}`;
    out.push({date:resolved.date||original,originalDate:original,resolvedDate:resolved.date,occurrenceKey:key,moved:resolved.moved===true,conflict:resolved.conflict===true,requiresDecision:resolved.requiresDecision===true,requiresProcessRule:resolved.requiresProcessRule===true,reason:resolved.reason||null});
  }

  function occurrences(series,range,cal){
    const s=obj(series)?series:{},rule=obj(s.rule)?s.rule:{},valid=validateRule(rule);if(!valid.valid)throw new Error('Unvollständige Wiederholungsregel: '+valid.errors.join(','));
    const r=boundedRange(range),out=[],type=valid.type,startDate=dayKey(s.startDate||s.startAt||r.start),endDate=dayKey(s.endDate||s.endAt||r.end)||r.end;
    const lowStart=startDate&&startDate>r.start?startDate:r.start,highEnd=endDate&&endDate<r.end?endDate:r.end;if(highEnd<lowStart)return[];

    if(type==='daily'){
      for(let d=lowStart,guard=0;d<=highEnd&&guard++<=MAX_RANGE_DAYS;d=addDays(d,1))if(isWorkday(d,cal))pushOccurrence(out,s,d,cal);
    }else if(type==='weekly'){
      const interval=Math.max(1,Number(rule.intervalWeeks||1)),weekdays=new Set(arr(rule.weekdays).map(Number)),anchor=monday(startDate||lowStart);
      for(let d=lowStart,guard=0;d<=highEnd&&guard++<=MAX_RANGE_DAYS;d=addDays(d,1)){
        if(!weekdays.has(isoWeekday(d)))continue;const weeks=Math.floor(diffDays(monday(d),anchor)/7);if(weeks<0||weeks%interval!==0)continue;pushOccurrence(out,s,d,cal);
      }
    }else{
      for(const monthStart of monthsInRange(lowStart,highEnd)){
        const p=parts(monthStart);let original='';
        if(type==='monthly')original=fromParts(p.year,p.month,Math.min(Number(rule.day),monthLastDay(p.year,p.month)));
        else if(type==='yearly'){
          if(p.month!==Number(rule.month))continue;original=fromParts(p.year,p.month,Math.min(Number(rule.day),monthLastDay(p.year,p.month)));
        }else if(type==='nth_weekday'){
          const firstWd=isoWeekday(monthStart),delta=(Number(rule.weekday)-firstWd+7)%7,day=1+delta+(Number(rule.nth)-1)*7;if(day>monthLastDay(p.year,p.month))continue;original=fromParts(p.year,p.month,day);
        }else if(type==='first_workday'){
          let d=monthStart;while(!isWorkday(d,cal))d=addDays(d,1);original=d;
        }else if(type==='last_workday'){
          let d=lastOfMonth(monthStart);while(!isWorkday(d,cal))d=addDays(d,-1);original=d;
        }else if(type==='workdays_before_month_end'){
          let d=lastOfMonth(monthStart);while(!isWorkday(d,cal))d=addDays(d,-1);original=moveWorkdays(d,-Number(rule.offset||0),cal);
        }else if(type==='workdays_after_month_start')original=moveWorkdays(monthStart,Number(rule.offset||0),cal);
        if(!original||original<lowStart||original>highEnd)continue;
        if(['first_workday','last_workday','workdays_before_month_end','workdays_after_month_start'].includes(type))out.push({date:original,originalDate:original,resolvedDate:original,occurrenceKey:`${q(s.id)}|${original}`,moved:false,conflict:false});
        else pushOccurrence(out,s,original,cal);
      }
    }
    const seen=new Set();return out.sort((a,b)=>a.originalDate.localeCompare(b.originalDate)).filter(row=>{if(seen.has(row.occurrenceKey))return false;seen.add(row.occurrenceKey);return true;});
  }

  function seriesFields(series,row){
    const base=obj(series.task)?clone(series.task):{};
    const allowed=['title','description','customerId','customerName','area','processId','workflowId','shipmentId','shipmentRef','orderId','taskType','ownerId','owner','priority','holidayPolicy','estimatedMinutes','templateId','dependencies','checklist','comments','reminders'];
    for(const key of allowed)if(series[key]!==undefined)base[key]=clone(series[key]);
    base.seriesId=q(series.id);base.occurrenceKey=row.occurrenceKey;base.originalOccurrenceDate=row.originalDate;base.holidayConflict=row.conflict===true;base.holidayConflictReason=row.reason||null;
    const time=q(series.dueTime||base.dueTime||'16:15');
    base.dueDate=row.date;base.dueAt=`${row.date}T${/^\d{2}:\d{2}$/.test(time)?time:'16:15'}:00`;
    if(!base.startAt)base.startAt=`${row.date}T00:00:00`;
    if(!base.plannedAt&&!row.conflict)base.plannedAt=`${row.date}T00:00:00`;
    return base;
  }

  function terminal(task){const s=q(task&&task.status).toLowerCase();return s==='done'||s==='cancelled'||s==='erledigt'||s==='storniert';}
  function taskDay(task){return dayKey(task&&task.dueAt||task&&task.dueDate||task&&task.date);}
  function materialize(input={}){
    const c=core();if(!c)throw new Error('TaskPlanner V2 Core fehlt');
    const now=q(input.now)||new Date().toISOString(),today=dayKey(now),r=boundedRange(input.range,now),cal=input.calendar||calendar({}),seriesList=arr(input.series),tasks=arr(input.tasks).map(clone),byKey=new Map();
    tasks.forEach((task,index)=>{const key=q(task&&task.occurrenceKey);if(key&&!byKey.has(key))byKey.set(key,index);});
    let created=0,updated=0;
    for(const series of seriesList){
      if(!q(series&&series.id)||!obj(series&&series.rule)||!validateRule(series.rule).valid)continue;
      for(const row of occurrences(series,r,cal)){
        const pos=byKey.get(row.occurrenceKey),fields=seriesFields(series,row);
        if(pos===undefined){
          const normalized=c.normalizeTask({...fields,id:`task-series:${q(series.id)}:${row.originalDate}`},{now});
          if(row.conflict)normalized.status='planned';
          tasks.push(normalized);byKey.set(row.occurrenceKey,tasks.length-1);created++;continue;
        }
        const existing=tasks[pos];if(terminal(existing)||row.originalDate<today)continue;
        const preserved={id:existing.id,status:existing.status,history:clone(existing.history),completedAt:existing.completedAt,completionMode:existing.completionMode,archivedAt:existing.archivedAt};
        if(existing.manualOverride===true){preserved.plannedAt=existing.plannedAt;preserved.manualOverride=true;}
        const next=c.normalizeTask({...existing,...fields,...preserved},{now});
        if(JSON.stringify(next)!==JSON.stringify(existing)){tasks[pos]=next;updated++;}
      }
    }
    return{tasks,created,updated,changed:created>0||updated>0,range:r};
  }

  function legacyRule(task){const text=q(task&&task.recurrence).toLowerCase();if(/week|wöch|woech/.test(text))return{type:'weekly',intervalWeeks:1,weekdays:[isoWeekday(dayKey(task.dueAt)||dayKey(new Date()))]};if(/day|daily|täglich|taeglich/.test(text))return{type:'daily'};return null;}
  function nextOccurrence(task,now){
    const c=core(),current=c?c.normalizeTask(task,{now}):clone(task),rule=legacyRule(current),base=dayKey(current.dueAt)||dayKey(now||new Date());
    let nextDate=addDays(base,1);
    if(rule&&rule.type==='weekly')nextDate=addDays(base,7);else if(rule&&rule.type==='daily'){const cal=calendar({});while(!isWorkday(nextDate,cal))nextDate=addDays(nextDate,1);}
    const nextKey=rule&&rule.type==='weekly'?`${new Date(nextDate+'T00:00:00Z').getUTCFullYear()}-W${String((()=>{const d=new Date(nextDate+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const ys=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-ys)/DAY_MS)+1)/7);})()).padStart(2,'0')}`:nextDate;
    return{...current,id:`${q(current.id)}:next:${nextKey}`,occurrenceKey:nextKey,dueAt:current.dueAt?nextDate:current.dueAt,status:'open',completedAt:'',completedBy:'',completionMode:'',createdAt:q(now),updatedAt:q(now)};
  }
  function materializeLegacy(tasks,now,seriesList){
    const canonicalSeriesIds=new Set(arr(seriesList).filter(series=>q(series&&series.id)&&obj(series&&series.rule)&&validateRule(series.rule).valid).map(series=>q(series.id)));
    const out=arr(tasks).map(clone),keys=new Set(out.map(t=>[q(t.companyId),q(t.environment),q(t.group),q(t.sourceType),q(t.sourceId),q(t.occurrenceKey)].join('|'))),generated=[];
    for(const task of out){
      if(q(task.status).toLowerCase()!=='done'||!q(task.recurrence))continue;
      if(q(task.seriesId)&&canonicalSeriesIds.has(q(task.seriesId)))continue;
      const next=nextOccurrence(task,now),key=[q(next.companyId),q(next.environment),q(next.group),q(next.sourceType),q(next.sourceId),q(next.occurrenceKey)].join('|');
      if(keys.has(key))continue;keys.add(key);generated.push(next);
    }
    return{tasks:out.concat(generated),generated,changed:generated.length>0};
  }

  root.ExportHUBTaskRecurrenceV2=Object.freeze({
    version:'2.0',validateRule,nrwHolidays,calendar,isWorkday,moveWorkdays,resolveHoliday,occurrences,materialize,nextOccurrence,materializeLegacy,nonWorkReason
  });
})(globalThis);
