import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function boot() {
  const listeners = new Map();
  const forwarded = [];
  const root = {console, Date, Intl, setTimeout, clearTimeout};
  root.globalThis = root;
  root.addEventListener = (name, fn) => listeners.set(name, fn);
  root.ExportHUBRC1014TaskRuntime = {
    emitWorkflowEvent: event => { forwarded.push(JSON.parse(JSON.stringify(event))); return {changed:false}; }
  };
  for (const file of ['assets/taskplanner-v2-core.js', 'assets/taskplanner-v2-workflow.js']) {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), root, {filename:file});
  }
  return {api:root.ExportHUBTaskWorkflowV2, listeners, forwarded};
}

const plain = value => JSON.parse(JSON.stringify(value));
const task = (date, other = {}) => ({
  id:'managed:spanien:'+date, managedBy:'RC1152', managedKey:'spanien',
  title:'Spanien anmelden', group:'Anmeldung', sourceType:'manual',
  status:'open', dueAt:date, occurrenceKey:date, ...other
});
const registered = (at='2026-10-19T10:00:00+02:00', customerName='Essentra Spanien') => ({
  eventId:'shipment.registered:SHIP1:HISTORY1', type:'shipment.registered',
  occurredAt:at, customerId:'ESS-SP', customerName,
  shipmentId:'SHIP1', shipmentRef:'ABC123',
  processId:'registration', taskType:'registration'
});
const history = (at='2026-10-19T10:00:00+02:00', extra={}) => ({
  id:'HISTORY1', at, type:'mail-sent', label:'Versandanmeldung versendet',
  details:{mailType:'registration'}, ...extra
});
const confirmedHistory = (at='2026-10-19T10:00:00+02:00', extra={}) => ({
  id:'HISTORY1',at,type:'registration-confirmed',label:'Versandanmeldung bestätigt',
  details:{emailHistoryId:'EMAIL-OPEN-1',reference:'ABC123'},...extra
});
const saved = (row=history(), extra={}) => ({
  detail:{azureSaved:true, updated:true, savedAt:'2026-10-19T10:00:20+02:00',
    shipment:{id:'SHIP1',ref:'ABC123',customerName:'Essentra Spanien',
      customerId:'ESS-SP',shipmentHistory:[row]},...extra}
});

test('RC1585: Essentra Spanien erledigt nur die aktuellste fällige Instanz, nicht die Serie', () => {
  const {api}=boot();
  const older=task('2026-10-15'),today=task('2026-10-19'),future=task('2026-10-22');
  const state={tasks:[older,today,future]};
  const result=api.apply(registered(),state,{now:'2026-10-19T11:00:00+02:00'});
  assert.equal(result.status,'completed');
  assert.deepEqual(plain(result.patches.map(p=>p.taskId)),[today.id]);
  assert.equal(result.state.tasks[0].status,'open');
  assert.equal(result.state.tasks[1].status,'done');
  assert.equal(result.state.tasks[2].status,'open');
  assert.equal(result.state.tasks[1].completionMode,'automatic');
  assert.equal(result.state.tasks[1].history.at(-1).eventId,registered().eventId);
});

test('RC1585: wenn heute keine Instanz fällig ist, darf die jüngste überfällige erledigt werden', () => {
  const {api}=boot(),result=api.apply(registered('2026-10-20T11:00:00+02:00'),
    {tasks:[task('2026-10-15'),task('2026-10-19'),task('2026-10-22')]},
    {now:'2026-10-20T11:00:00+02:00'});
  assert.deepEqual(plain(result.patches.map(p=>p.taskId)),['managed:spanien:2026-10-19']);
});

test('RC1585: zukünftige oder manuell in die Zukunft verschobene Aufgaben bleiben offen', () => {
  const {api}=boot();
  for(const t of [
    task('2026-10-22'),
    task('2026-10-19',{manualOverride:true,plannedAt:'2026-10-22T12:00:00+02:00'})
  ]) {
    const result=api.apply(registered(),{tasks:[t]}, {now:'2026-10-19T11:00:00+02:00'});
    assert.equal(result.changed,false);
    assert.equal(result.status,'unmatched');
  }
});

test('RC1585: keine automatische Erledigung für andere Kunden, bloße Titel oder fehlende Sendungsidentität', () => {
  const {api}=boot(),today=task('2026-10-19');
  for(const ev of [
    registered(undefined,'Essentra Polen'),
    registered(undefined,'Spanien'),
    {...registered(), shipmentId:'',shipmentRef:''}
  ]) {
    assert.equal(api.apply(ev,{tasks:[today]},{now:'2026-10-19T11:00:00+02:00'}).changed,false);
  }
  assert.equal(api.apply(registered(),{tasks:[{...today,managedKey:'polen'}]},
    {now:'2026-10-19T11:00:00+02:00'}).changed,false);
});

test('RC1585: gleiche Tageszuordnung mit zwei aktiven Instanzen bleibt mehrdeutig', () => {
  const {api}=boot();
  const result=api.apply(registered(),{tasks:[task('2026-10-19'),task('2026-10-19',{id:'duplicate'})]},
    {now:'2026-10-19T11:00:00+02:00'});
  assert.equal(result.status,'ambiguous');
  assert.equal(result.changed,false);
});

test('RC1585: doppelte bestätigte Anmeldung ist idempotent', () => {
  const {api}=boot(),state={tasks:[task('2026-10-19')]};
  const now='2026-10-19T11:00:00+02:00';
  const first=api.apply(registered(),state,{now});
  const second=api.apply(registered(),first.state,{now});
  assert.equal(first.status,'completed');
  assert.equal(second.status,'duplicate');
  assert.equal(second.changed,false);
});

test('RC1590: Mailentwurf öffnen allein erzeugt kein Workflow-Event', () => {
  const {api,listeners,forwarded}=boot();
  assert.equal(api.shipmentRegisteredFromSave(saved()),null);
  listeners.get('exporthub:shipment-saved')(saved());
  assert.equal(forwarded.length,0);
});

test('RC1590: erst eindeutig bestätigte und gespeicherte Anmeldung erzeugt Workflow-Event', () => {
  const {api,listeners,forwarded}=boot();
  const ev=api.shipmentRegisteredFromSave(saved(confirmedHistory()));
  assert.equal(ev.type,'shipment.registered');
  assert.equal(ev.eventId,'shipment.registered:SHIP1:HISTORY1');
  assert.equal(ev.customerName,'Essentra Spanien');
  listeners.get('exporthub:shipment-saved')(saved(confirmedHistory()));
  assert.equal(forwarded.length,1);
  assert.equal(forwarded[0].type,'shipment.registered');
});

test('RC1585: angefangene, alte, unbestätigte oder unvollständige Anmeldung löst keine Erledigung aus', () => {
  const {api}=boot();
  for(const candidate of [
    saved(history(undefined,{type:'registration',label:'Versandanmeldung per E-Mail gestartet'})),
    saved(confirmedHistory(undefined,{details:{emailHistoryId:''}})),
    saved(confirmedHistory(undefined,{id:''})),
    saved(confirmedHistory('2026-10-18T10:00:00+02:00')),
    saved(confirmedHistory(),{azureSaved:false}),

    saved(history(undefined,{details:{mailType:'avis'}})),
    saved(history('2026-10-18T10:00:00+02:00')),
    saved(history(undefined,{id:''})),
    saved(history(),{azureSaved:false}),
    saved(history(),{shipment:{id:'SHIP1',ref:'ABC123',customerName:'Essentra Spanien',shipmentHistory:[]}})
  ]) assert.equal(api.shipmentRegisteredFromSave(candidate),null);
});
