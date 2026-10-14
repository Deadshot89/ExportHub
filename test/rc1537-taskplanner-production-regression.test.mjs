import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadRuntime(){
  const window={
    ExportHUBI18n:{t(key){
      const de={
        'taskManaged.spanien.title':'Spanien anmelden',
        'taskManaged.gaggenau.title':'Gaggenau anmelden',
        'taskManaged.faurecia.title':'FAURECIA anmelden',
        'taskManaged.wuerth.title':'Würth Industrie anmelden',
        'taskManaged.bmp.title':'BMP anmelden',
        'taskManaged.italien.title':'Italien anmelden',
        'taskManaged.bsh.title':'BSH anmelden',
        'taskManaged.ohare.title':'O’Hare anmelden',
        'taskManaged.essentraSweden.title':'Essentra Schweden anmelden',
        'taskManaged.contitech.title':'Contitech – ABD erstellen',
        'taskManaged.polen.title':'Polen anmelden',
        'taskManaged.frankreich.title':'Frankreich anmelden',
        'taskManaged.neff.title':'Neff anmelden',
        'taskManaged.swiss.title':'Schweizer Kunden prüfen',
        'taskManaged.group.registration':'Anmeldungen',
        'taskManaged.group.exportAbd':'Export / ABD',
        'taskManaged.group.swiss':'Schweizer Kunden',
        'taskDetail.weekday.1':'Montag','taskDetail.weekday.2':'Dienstag','taskDetail.weekday.3':'Mittwoch','taskDetail.weekday.4':'Donnerstag','taskDetail.weekday.5':'Freitag'
      };
      return de[key]||key;
    }},
    addEventListener(){},dispatchEvent(){return true;},setTimeout(){return 1;},clearTimeout(){},
    document:null,location:{hostname:'www.exporthub360.de',pathname:'/',href:'https://www.exporthub360.de/'}
  };
  const sandbox={window,globalThis:window,console,Date,Intl,CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail;}};
  for(const file of [
    'assets/taskplanner-v2-core.js',
    'assets/taskplanner-v2-recurrence.js',
    'assets/rc1014-task-lifecycle.js',
    'assets/rc1014-task-runtime.js',
    'assets/taskplanner-v2-runtime-bridge.js',
    'assets/rc1537-taskplanner-canonical-source.js'
  ]) vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
  return window;
}

function loadPlanner(){
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  context.ExportHUBI18n={t(key){
    const de={
      'taskV2.planner.todaySummary':'Heute: {count} Aufgaben · {critical} kritisch · {overdue} überfällig',
      'taskV2.planner.overdue':'Überfällig','taskV2.planner.noOverdue':'Keine überfälligen Aufgaben',
      'taskV2.planner.currentWeek':'Aktuelle Woche','taskV2.planner.nextWeek':'Nächste Woche',
      'taskV2.planner.month':'Monat','taskV2.planner.workweek':'Arbeitswoche','taskV2.planner.title':'Aufgabenplaner'
    };
    return de[key]||key;
  }};
  for(const file of [
    'assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js',
    'assets/taskplanner-v2-ui.js','assets/taskplanner-v2-planner-ui.js','assets/rc1537-taskplanner-canonical-source.js'
  ]) vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  return context;
}

function plannerTask(id,date,title,extra={}){
  return {id,title,status:'open',priority:'P2',plannedAt:`${date}T09:00:00+02:00`,dueAt:`${date}T16:15:00+02:00`,...extra};
}

test('RC1537: persönlicher Wochenstamm materialisiert in Produktion aktuelle plus nächste Arbeitswoche',()=>{
  const window=loadRuntime();
  const api=window.ExportHUBRC1014TaskRuntime;
  const state={companyId:'essentra',environment:'production',currentUser:{id:'USER-Tobias',user:'Tobias'},tasks:[],taskSeries:[],taskCalendar:{},taskArchive:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  let writes=0;
  const out=api.prepareTasks(state.tasks,{companyId:'essentra',environment:'production',currentUserId:'USER-Tobias',currentUser:state.currentUser,now:'2026-10-14T10:00:00+02:00',state,persist(next){writes++;state.tasks=next;}});
  const ids=new Set(out.map(task=>task.id));
  assert.ok(ids.has('managed:frankreich:2026-10-16'),'Freitag der aktuellen Woche muss bereits vorhanden sein');
  assert.ok(ids.has('managed:gaggenau:2026-10-19'),'Montag der nächsten Woche muss bereits vorhanden sein');
  assert.ok(ids.has('managed:essentra-schweden:2026-10-21'),'Mittwoch der nächsten Woche muss bereits vorhanden sein');
  assert.ok(ids.has('managed:swiss-area'),'Schweizer Referenzbereich muss vorhanden bleiben');
  assert.ok(writes>=1,'Materialisierung muss über den bestehenden Persist-Pfad gespeichert werden');
});

test('RC1537: verschobene zukünftige Regelaufgabe bleibt materialisiert und wird nicht am alten Tag neu erzeugt',()=>{
  const window=loadRuntime(),api=window.ExportHUBRC1014TaskRuntime;
  const state={companyId:'essentra',environment:'production',currentUser:{id:'USER-Tobias',user:'Tobias'},tasks:[],taskSeries:[],taskCalendar:{},taskArchive:[],_teamSyncMeta:{fields:{},tombstones:[]}};
  const ctx={companyId:'essentra',environment:'production',currentUserId:'USER-Tobias',currentUser:state.currentUser,now:'2026-10-14T10:00:00+02:00',state,persist(next){state.tasks=next;}};
  state.tasks=api.prepareTasks(state.tasks,ctx);
  const id='managed:gaggenau:2026-10-19';
  assert.ok(state.tasks.some(task=>task.id===id),'zukünftiges Vorkommen muss vor dem Verschieben fest vorhanden sein');
  const moved=api.moveTaskOccurrence(id,'2026-10-20T09:00:00+02:00',ctx);
  assert.equal(moved.changed,true);
  state.tasks=api.prepareTasks(state.tasks,ctx);
  const matches=state.tasks.filter(task=>task.id===id);
  assert.equal(matches.length,1,'verschobenes Vorkommen darf nicht dupliziert werden');
  assert.match(matches[0].plannedAt,/^2026-10-20T/,'manuelle Verschiebung muss den neuen Tag behalten');
});

test('RC1537: V2-Planner bezieht seinen sichtbaren Bestand vom Runtime-Owner statt direkt aus rohem state.tasks',()=>{
  const context=loadPlanner(),ui=context.ExportHUBTaskUIV2;
  const state={tasks:[]};
  const canonical=plannerTask('canonical-next','2026-10-19','Kanonische Aufgabe nächste Woche');
  let calls=0;
  const runtime={
    currentTasks(){calls++;return[canonical];},
    prepareTasks(){calls++;return[canonical];}
  };
  const target={innerHTML:''};
  ui.renderPlannerPage(target,{state,runtime,weekStart:'2026-10-12',now:'2026-10-14T10:00:00+02:00'});
  assert.ok(calls>0,'Planner muss den Runtime-Owner nach dem kanonischen Aufgabenbestand fragen');
  assert.match(target.innerHTML,/Kanonische Aufgabe nächste Woche/);
});

test('RC1537: Planner-Tageszusammenfassung interpoliert Platzhalter auch bei roher i18n-Vorlage',()=>{
  const context=loadPlanner(),ui=context.ExportHUBTaskUIV2;
  const today=plannerTask('today','2026-10-14','Heute erledigen',{priority:'P0'});
  const state={tasks:[today]};
  const runtime={currentTasks(){return state.tasks;},prepareTasks(){return state.tasks;}};
  const target={innerHTML:''};
  ui.renderPlannerPage(target,{state,runtime,weekStart:'2026-10-12',now:'2026-10-14T10:00:00+02:00'});
  assert.doesNotMatch(target.innerHTML,/\{(?:count|critical|overdue)\}/,'sichtbare Platzhalter dürfen nicht stehen bleiben');
  assert.match(target.innerHTML,/Heute: 1 Aufgaben · 1 kritisch · 0 überfällig/);
});

test('RC1537: Planner-DnD besitzt einen Persist-Fallback und schreibt den Move in den echten State',()=>{
  const context=loadPlanner(),ui=context.ExportHUBTaskUIV2;
  let saves=0;
  context.ExportHUBClean={queueSave(){saves++;return true;}};
  const state={tasks:[plannerTask('move','2026-10-12','Verschieben')]};
  const handlers={};
  const day={closest:selector=>selector==='[data-tpv2-drop-date], [data-i218-drop-date]'?day:null,getAttribute:name=>name==='data-tpv2-drop-date'?'2026-10-15':null};
  const card={closest:selector=>selector==='[data-task-id]'?card:null,getAttribute:name=>name==='data-task-id'?'move':null};
  const target={
    ownerDocument:{elementFromPoint:()=>day},
    addEventListener(type,fn){handlers[type]=fn;},removeEventListener(){}
  };
  const runtime={plannerV2:{
    moveTaskOccurrence(id,plannedAt,ctx){
      assert.equal(typeof ctx.persist,'function','Planner muss dem Runtime-Move einen Persist-Callback geben');
      const next=ctx.state.tasks.map(task=>task.id===id?{...task,plannedAt}:task);
      ctx.state.tasks=next;
      ctx.persist(next);
      return{changed:true,task:next.find(task=>task.id===id)};
    }
  }};
  ui.bindPlannerDnD(target,{state,runtime,now:'2026-10-14T10:00:00+02:00'});
  assert.equal(typeof handlers.pointerup,'function');
  handlers.pointerup({clientX:10,clientY:10,target:card});
  assert.match(state.tasks[0].plannedAt,/^2026-10-15T/,'Move muss im echten State ankommen');
  assert.equal(saves,1,'Move muss genau einen Save auslösen');
});

test('RC1537: Release-Wiring liefert den Canonical-Source-Hotfix nach dem Planner UI aus',()=>{
  const source=fs.readFileSync('scripts/taskplanner-v2-pretest.mjs','utf8');
  assert.match(source,/rc1537-taskplanner-canonical-source\.js/,'RC1537 Asset muss vom Release-Builder kopiert werden');
  assert.match(source,/exporthub-taskplanner-rc1537-canonical-source/,'RC1537 Script-Tag muss im Release-Wiring vorhanden sein');
});
