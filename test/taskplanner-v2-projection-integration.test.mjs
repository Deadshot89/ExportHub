import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=rel=>fs.readFileSync(rel,'utf8');

function loadUi(extra={}){
  const context={console,Date,Intl,setTimeout,clearTimeout,crypto:globalThis.crypto,TextEncoder,...extra};
  context.globalThis=context;
  context.ExportHUBI18n={t:key=>key};
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-projections.js','assets/taskplanner-v2-ui.js','assets/taskplanner-v2-projection-ui.js'])vm.runInNewContext(read(file),context,{filename:file});
  return context.ExportHUBTaskUIV2;
}

function loadRuntime(){
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-projections.js','assets/rc1014-task-lifecycle.js','assets/rc1014-task-runtime.js','assets/taskplanner-v2-runtime-bridge.js'])vm.runInNewContext(read(file),context,{filename:file});
  return {runtime:context.ExportHUBRC1014TaskRuntime,context};
}

const task=(id,extra={})=>({id,schemaVersion:2,title:`Task ${id}`,customerId:'C1',customerName:'Customer',status:'open',priority:'P2',plannedAt:'2026-10-13T09:00:00+02:00',dueAt:'2026-10-13T16:15:00+02:00',...extra});

function fakeDocument(){
  const nodes=new Map(),content={id:'content',innerHTML:'<div id="legacy-content">Legacy</div>',children:[],appendChild(node){this.children.push(node);nodes.set(node.id,node);node.parentNode=this;return node;},removeChild(node){this.children=this.children.filter(x=>x!==node);nodes.delete(node.id);}};
  nodes.set('content',content);
  const document={
    readyState:'complete',
    getElementById:id=>nodes.get(id)||null,
    querySelector:selector=>selector==='main'?null:null,
    createElement:tag=>({tagName:String(tag).toUpperCase(),id:'',className:'',innerHTML:'',parentNode:null,remove(){if(this.parentNode)this.parentNode.removeChild(this);}}),
    body:content,
    addEventListener(){}
  };
  return{document,content,nodes};
}

test('UI rendert Dashboard, Kundenaufgaben, Archiv und Statistik ausschließlich über Shared Projections',()=>{
  const ui=loadUi(),state={tasks:[task('a'),task('done',{status:'done',completedAt:'2026-10-13T10:00:00+02:00'})],taskArchive:[]};
  const dashboard={innerHTML:''},customer={innerHTML:''},archive={innerHTML:''},stats={innerHTML:''};
  ui.renderTaskDashboard(dashboard,{state,now:'2026-10-13T12:00:00+02:00'});
  ui.renderCustomerTasks(customer,'C1',{state,now:'2026-10-13T12:00:00+02:00'});
  ui.renderTaskArchive(archive,{customerId:'C1'},{state,now:'2026-10-13T12:00:00+02:00'});
  ui.renderTaskStats(stats,{customerId:'C1'},{state,now:'2026-10-13T12:00:00+02:00'});
  assert.match(dashboard.innerHTML,/data-taskplanner-v2-dashboard/);
  assert.match(dashboard.innerHTML,/data-metric="today"/);
  assert.match(customer.innerHTML,/data-taskplanner-v2-customer/);
  assert.match(customer.innerHTML,/data-customer-id="C1"/);
  assert.match(archive.innerHTML,/data-taskplanner-v2-archive/);
  assert.match(stats.innerHTML,/data-taskplanner-v2-stats/);
});

test('Dashboard-Mount ergänzt bestehendes Dashboard ohne Legacy-Inhalt zu ersetzen',()=>{
  const {document,content,nodes}=fakeDocument(),ui=loadUi({document});
  const state={view:'dashboard',tasks:[task('a')],taskArchive:[]};
  const result=ui.mountCurrentView({state,document,now:'2026-10-13T12:00:00+02:00'});
  assert.equal(result.mounted,'dashboard');
  assert.equal(content.innerHTML,'<div id="legacy-content">Legacy</div>','bestehendes Dashboard-Markup darf nicht ersetzt werden');
  const host=nodes.get('taskplannerV2DashboardProjection');
  assert.ok(host,'Dashboard-Projektionshost fehlt');
  assert.match(host.innerHTML,/data-taskplanner-v2-dashboard/);
});

test('Kundenordner-Mount verwendet ausschließlich stabile customerId und ergänzt den Kundeninhalt',()=>{
  const {document,content,nodes}=fakeDocument(),ui=loadUi({document});
  const state={view:'customers',currentCustomerId:'C1',tasks:[task('a'),task('other',{customerId:'C2',customerName:'Customer'})],taskArchive:[]};
  const result=ui.mountCurrentView({state,document,now:'2026-10-13T12:00:00+02:00'});
  assert.equal(result.mounted,'customer');
  assert.equal(result.customerId,'C1');
  assert.equal(content.innerHTML,'<div id="legacy-content">Legacy</div>');
  const host=nodes.get('taskplannerV2CustomerProjection');
  assert.ok(host,'Kunden-Projektionshost fehlt');
  assert.match(host.innerHTML,/data-customer-id="C1"/);
  assert.doesNotMatch(host.innerHTML,/Task other/,'gleichnamiger anderer Kunde darf nicht erscheinen');
});

test('fremde Ansichten entfernen nur TaskPlanner-Projektionshosts und lassen übrigen Inhalt stehen',()=>{
  const {document,content,nodes}=fakeDocument(),ui=loadUi({document});
  const state={view:'dashboard',tasks:[task('a')],taskArchive:[]};
  ui.mountCurrentView({state,document,now:'2026-10-13T12:00:00+02:00'});
  state.view='shipmentview';
  const result=ui.mountCurrentView({state,document,now:'2026-10-13T12:00:00+02:00'});
  assert.equal(result.mounted,'');
  assert.equal(nodes.has('taskplannerV2DashboardProjection'),false);
  assert.equal(content.innerHTML,'<div id="legacy-content">Legacy</div>');
});

test('RC1014 Runtime stellt dieselben Shared Projections bereit',()=>{
  const {runtime}=loadRuntime(),state={tasks:[task('a')],taskArchive:[]},ctx={state,now:'2026-10-13T12:00:00+02:00'};
  assert.equal(runtime.taskDashboardProjection(ctx).counts.today,1);
  assert.equal(runtime.taskCustomerProjection('C1',ctx).active.length,1);
  assert.equal(runtime.taskArchiveProjection({customerId:'C1'},ctx).total,0);
  assert.equal(runtime.taskStatsProjection({customerId:'C1'},ctx).open,1);
});

test('prepareTasks rollt erledigte V2-Aufgaben nach sieben Tagen einmalig in taskArchive und persistiert nur einmal',()=>{
  const {runtime}=loadRuntime(),state={rc1152TaskRosterAt:'2026-10-01T00:00:00Z',tasks:[],taskArchive:[]},writes=[];
  const old=task('old',{status:'done',completedAt:'2026-10-01T10:00:00+02:00',createdAt:'2026-09-30T10:00:00+02:00'});
  const current=task('current');
  const result=runtime.prepareTasks([old,current],{state,now:'2026-10-13T12:00:00+02:00',persist:tasks=>writes.push(tasks)});
  assert.deepEqual(Array.from(result,x=>x.id),['current']);
  assert.equal(state.taskArchive.length,1);
  assert.equal(state.taskArchive[0].id,'old');
  assert.equal(writes.length,1);
  const secondWrites=[];
  const again=runtime.prepareTasks(result,{state,now:'2026-10-13T12:00:00+02:00',persist:tasks=>secondWrites.push(tasks)});
  assert.equal(again.length,1);
  assert.equal(state.taskArchive.length,1);
  assert.equal(secondWrites.length,0,'stabiler Archiv-Rollover darf keinen Save-Loop erzeugen');
});
