import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(){
  const context={console,Date,Intl,setTimeout,clearTimeout};
  context.globalThis=context;
  context.ExportHUBI18n={t(key){return key==='taskV2.workflow.reviewMapping'?'Zuordnung prüfen':key;}};
  context.__events=[];
  context.dispatchEvent=event=>{context.__events.push(event);return true;};
  context.CustomEvent=class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}};
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-workflow.js']){
    vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  return context;
}

const plain=value=>JSON.parse(JSON.stringify(value));
const TYPES=['shipment.created','shipment.picked','shipment.registered','shipment.dispatched','document.created','document.approved','customer.process.completed'];

function task(id,extra={}){
  return {
    id,title:`Task ${id}`,status:'open',priority:'P2',customerId:'C1',customerName:'Kunde Eins',
    plannedAt:'2026-10-12T09:00:00+02:00',dueAt:'2026-10-12T16:15:00+02:00',
    workflowEvents:['shipment.picked'],shipmentId:'S1',shipmentRef:'REF001',processId:'pick',workflowId:'shipping',taskType:'pick',
    history:[],...extra
  };
}

function event(extra={}){
  return {
    eventId:'EVT-1',type:'shipment.picked',occurredAt:'2026-10-12T10:00:00+02:00',customerId:'C1',
    shipmentId:'S1',shipmentRef:'REF001',processId:'pick',workflowId:'shipping',taskType:'pick',...extra
  };
}

test('normalizeEvent akzeptiert genau die freigegebenen Workflow-Ereignistypen und verlangt eventId',()=>{
  const api=load().ExportHUBTaskWorkflowV2;
  for(const type of TYPES){
    const normalized=plain(api.normalizeEvent(event({eventId:'EVT-'+type,type})));
    assert.equal(normalized.type,type);
    assert.equal(normalized.eventId,'EVT-'+type);
  }
  assert.throws(()=>api.normalizeEvent(event({type:'shipment.unknown'})),/Ereignistyp|event type/i);
  assert.throws(()=>api.normalizeEvent(event({eventId:''})),/eventId/i);
});

test('strukturierte Zuordnung unterstützt alle sieben Ereignistypen ohne Titel- oder Textmatching',()=>{
  const api=load().ExportHUBTaskWorkflowV2;
  for(const type of TYPES){
    const isDocument=type.startsWith('document.'),isCustomer=type==='customer.process.completed';
    const bound=task(type,{
      workflowEvents:[type],shipmentId:isCustomer?'':'S-'+type,shipmentRef:'',
      documentId:isDocument?'DOC-'+type:'',processId:isDocument?'documents':(isCustomer?'registration':'shipping'),
      workflowId:'wf-'+type,taskType:isDocument?'invoice':(isCustomer?'registration':'shipment')
    });
    const ev=event({eventId:'E-'+type,type,shipmentId:isCustomer?'':'S-'+type,shipmentRef:'',documentId:isDocument?'DOC-'+type:'',processId:bound.processId,workflowId:bound.workflowId,taskType:bound.taskType});
    assert.deepEqual(plain(api.match(ev,[bound])).map(t=>t.id),[type],type);
  }
});

test('Kundenname allein qualifiziert niemals und customerId allein ist ebenfalls zu schwach',()=>{
  const api=load().ExportHUBTaskWorkflowV2;
  const nameOnly=task('name-only',{customerId:'',customerName:'Kunde Eins',shipmentId:'',shipmentRef:'',processId:'',workflowId:'',taskType:'',workflowEvents:['shipment.picked']});
  assert.equal(api.match(event({customerId:'',customerName:'Kunde Eins',shipmentId:'',shipmentRef:'',processId:'',workflowId:'',taskType:''}),[nameOnly]).length,0);
  const customerOnly=task('customer-only',{shipmentId:'',shipmentRef:'',processId:'',workflowId:'',taskType:'',workflowEvents:['shipment.picked']});
  assert.equal(api.match(event({shipmentId:'',shipmentRef:'',processId:'',workflowId:'',taskType:''}),[customerOnly]).length,0);
});

test('alle konfigurierten strukturierten Bindungen müssen übereinstimmen',()=>{
  const api=load().ExportHUBTaskWorkflowV2,bound=task('strict');
  assert.equal(api.match(event({shipmentId:'S2'}),[bound]).length,0);
  assert.equal(api.match(event({customerId:'C2'}),[bound]).length,0);
  assert.equal(api.match(event({processId:'registration'}),[bound]).length,0);
  assert.equal(api.match(event({workflowId:'other'}),[bound]).length,0);
  assert.equal(api.match(event({taskType:'other'}),[bound]).length,0);
  assert.equal(api.match(event(),[bound]).length,1);
});

test('genau ein Kandidat wird automatisch erledigt, Historie erhält eventId und fremde Tasks bleiben bytegleich',()=>{
  const api=load().ExportHUBTaskWorkflowV2,target=task('target'),other=task('other',{customerId:'C2',shipmentId:'S2',shipmentRef:'REF002'});
  const beforeOther=JSON.stringify(other),state={tasks:[target,other]};
  const result=api.apply(event(),state,{now:'2026-10-12T10:00:00+02:00'});
  assert.equal(result.changed,true);
  assert.equal(result.status,'completed');
  assert.deepEqual(plain(result.patches.map(p=>p.taskId)),['target']);
  const done=result.state.tasks.find(t=>t.id==='target');
  assert.equal(done.status,'done');
  assert.equal(done.completionMode,'automatic');
  assert.equal(done.history.at(-1).eventId,'EVT-1');
  assert.equal(done.history.at(-1).source,'workflow');
  assert.ok(done.workflowProcessedEvents.some(row=>row.key===api.processedKey(event())));
  assert.equal(JSON.stringify(result.state.tasks.find(t=>t.id==='other')),beforeOther);
  assert.equal(state.tasks[0].status,'open','apply muss Eingangs-State nicht mutieren');
});

test('null Kandidaten ändern nichts',()=>{
  const api=load().ExportHUBTaskWorkflowV2,state={tasks:[task('a',{shipmentId:'OTHER'})]},before=JSON.stringify(state);
  const result=api.apply(event(),state,{});
  assert.equal(result.changed,false);
  assert.equal(result.status,'unmatched');
  assert.equal(JSON.stringify(result.state),before);
});

test('mehrdeutige Zuordnung erledigt nichts und fordert Zuordnung prüfen',()=>{
  const api=load().ExportHUBTaskWorkflowV2,state={tasks:[task('a'),task('b')]};
  const result=api.apply(event(),state,{});
  assert.equal(result.changed,false);
  assert.equal(result.status,'ambiguous');
  assert.equal(result.message,'Zuordnung prüfen');
  assert.deepEqual(plain(result.ambiguousTaskIds).sort(),['a','b']);
  assert.equal(result.state.tasks.every(t=>t.status==='open'),true);
});

test('gleiches eventId ist idempotent und erzeugt weder zweite Historie noch zweiten Save',()=>{
  const ctx=load(),api=ctx.ExportHUBTaskWorkflowV2,state={tasks:[task('a')]};let saves=0;
  const runtime={state,persist(tasks){saves++;state.tasks=tasks;}};
  const first=api.emit(event(),runtime);
  assert.equal(first.changed,true);
  const historyCount=state.tasks[0].history.length;
  const second=api.emit(event(),runtime);
  assert.equal(second.changed,false);
  assert.equal(second.status,'duplicate');
  assert.equal(state.tasks[0].history.length,historyCount);
  assert.equal(saves,1);
});

test('bereits erledigte oder stornierte Tasks werden nicht destruktiv überschrieben',()=>{
  const api=load().ExportHUBTaskWorkflowV2;
  for(const status of ['done','cancelled']){
    const existing=task(status,{status,completedAt:'2026-10-11T12:00:00+02:00',completionMode:'manual',history:[{action:'completed',at:'2026-10-11T12:00:00+02:00'}]});
    const before=JSON.stringify(existing),result=api.apply(event(),{tasks:[existing]},{});
    assert.equal(result.changed,false,status);
    assert.equal(JSON.stringify(result.state.tasks[0]),before,status);
  }
});

test('emit persistiert einmal und sendet genau ein kanonisches tasks-updated Ereignis mit geänderter Task-ID',()=>{
  const ctx=load(),api=ctx.ExportHUBTaskWorkflowV2,state={tasks:[task('a')]};let saves=0;
  const result=api.emit(event(),{state,persist(){saves++;},now:'2026-10-12T10:00:00+02:00'});
  assert.equal(result.changed,true);
  assert.equal(saves,1);
  assert.equal(ctx.__events.length,1);
  assert.equal(ctx.__events[0].type,'exporthub:tasks-updated');
  assert.deepEqual(plain(ctx.__events[0].detail.taskIds),['a']);
  assert.equal(ctx.__events[0].detail.type,'workflow_auto_complete');
  assert.equal(ctx.__events[0].detail.eventId,'EVT-1');
});

test('processed ledger ist pro Task begrenzt',()=>{
  const api=load().ExportHUBTaskWorkflowV2;
  const previous=Array.from({length:80},(_,i)=>({key:'old-'+i,eventId:'old-'+i,type:'shipment.picked',at:'2026-10-01T00:00:00+02:00'}));
  const result=api.apply(event(),{tasks:[task('a',{workflowProcessedEvents:previous})]},{});
  assert.equal(result.changed,true);
  assert.ok(result.state.tasks[0].workflowProcessedEvents.length<=40);
  assert.equal(result.state.tasks[0].workflowProcessedEvents.at(-1).eventId,'EVT-1');
});
