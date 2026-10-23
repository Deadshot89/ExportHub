import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const source = fs.readFileSync('assets/rc1650-shipment-task-link.js','utf8');
const build = fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function load(state){
  const window = {__EXPORTHUB_GET_STATE__:()=>state};
  vm.runInNewContext(source,{window,setTimeout(){return 0},console,CustomEvent:class{}});
  const api = window.ExportHUBShipmentTaskLink1650, plain = v => JSON.parse(JSON.stringify(v));
  return {...api,customerNumbers:(...a)=>plain(api.customerNumbers(...a)),shipmentCustomerNumbers:(...a)=>plain(api.shipmentCustomerNumbers(...a)),reconcile:(...a)=>plain(api.reconcile(...a))};
}
const NOW = new Date('2026-10-21T15:00:00'); // Mittwoch, KW 43

test('RC1650: Kundennummern werden ohne Leerzeichen, Groß/klein und führende Nullen verglichen, mehrere per Komma',()=>{
  const api = load({});
  assert.deepEqual(api.customerNumbers('00123, K 77 ;abc'),['123','k77','abc']);
  assert.deepEqual(api.shipmentCustomerNumbers({customerId:'C-1'},[{id:'C-1',customerNumber:'4711'}]),['c-1','4711']);
});

test('RC1650: neue Sendung erledigt die Wochenaufgabe gleicher Kundennummer am selben Tag',()=>{
  const state = {
    tasks:[
      {id:'M848:mo-p-uk:2026-W43',title:'UK',day:'Montag',weekKey:'2026-W43',customerNumber:'4711',status:'offen'},
      {id:'M848:mi-p-uk:2026-W43',title:'UK',day:'Mittwoch',weekKey:'2026-W43',customerNumber:'4711',status:'offen'},
      {id:'other',title:'Barcelona',day:'Mittwoch',weekKey:'2026-W43',customerNumber:'999',status:'offen'}
    ],
    shipments:[{id:'S1',ref:'ABC123',customerAccount:'04711',createdAt:'2026-10-21T09:12:00.000Z',status:'Entwurf'}]
  };
  const res = load(state).reconcile(state,{now:NOW,actor:'Tobias'});
  assert.deepEqual(res.completed,[{taskId:'M848:mi-p-uk:2026-W43',shipmentRef:'ABC123'}]);
  const done = state.tasks[1];
  assert.equal(done.status,'done');
  assert.equal(done.done,true);
  assert.equal(done.doneByShipmentRef,'ABC123');
  assert.equal(state.tasks[0].done,undefined,'Montag bleibt offen, eine Sendung erledigt genau eine Aufgabe');
  assert.equal(state.tasks[2].done,undefined);
});

test('RC1650: ohne Aufgabe am selben Tag wird die überfällige Aufgabe der Woche erledigt, nie eine aus einer anderen Woche',()=>{
  const state = {
    tasks:[
      {id:'last-week',title:'UK',day:'Montag',weekKey:'2026-W42',customerNumber:'4711'},
      {id:'mon',title:'UK',day:'Montag',weekKey:'2026-W43',customerNumber:'4711'}
    ],
    shipments:[{id:'S1',ref:'ABC123',customerNumber:'4711',createdAt:'2026-10-21T09:00:00.000Z'}]
  };
  const res = load(state).reconcile(state,{now:NOW});
  assert.deepEqual(res.completed.map(x=>x.taskId),['mon']);
  assert.equal(state.tasks[0].done,undefined);
});

test('RC1650: abgeschaltete, erledigte und wieder geöffnete Aufgaben werden nicht (erneut) erledigt; stornierte Sendungen zählen nicht',()=>{
  const state = {
    tasks:[
      {id:'off',title:'A',dueDate:'2026-10-21',customerNumber:'1',autoDoneOnShipment:false},
      {id:'reopened',title:'B',dueDate:'2026-10-21',customerNumber:'2',status:'open',doneByShipments:['s2']},
      {id:'cancel',title:'C',dueDate:'2026-10-21',customerNumber:'3'}
    ],
    shipments:[
      {id:'S1',customerNumber:'1',createdAt:'2026-10-21T08:00:00.000Z'},
      {id:'S2',customerNumber:'2',createdAt:'2026-10-21T08:00:00.000Z'},
      {id:'S3',customerNumber:'3',createdAt:'2026-10-21T08:00:00.000Z',status:'Storniert'}
    ]
  };
  const res = load(state).reconcile(state,{now:NOW});
  assert.deepEqual(res.completed,[]);
});

test('RC1650: Wochenaufgaben übernehmen die zuletzt gesetzte Kundennummer ihrer Serie',()=>{
  const state = {
    tasks:[
      {id:'w42',title:'UK',seriesId:'MASTER:mo-p-uk',weekKey:'2026-W42',day:'Montag',customerNumber:'4711',customerNumberSetAt:'2026-10-14T10:00:00.000Z',done:true},
      {id:'w43',title:'UK',seriesId:'MASTER:mo-p-uk',weekKey:'2026-W43',day:'Montag'},
      {id:'w44',title:'UK',seriesId:'MASTER:mo-p-uk',weekKey:'2026-W44',day:'Montag',customerNumber:'',customerNumberSetAt:'2026-10-20T10:00:00.000Z'}
    ],
    shipments:[]
  };
  const res = load(state).reconcile(state,{now:NOW});
  // the newest edit (w44 cleared the number) wins for the whole series
  assert.deepEqual(res.inherited,['w43']);
  assert.equal(state.tasks[1].customerNumber,'');
  state.tasks[2].customerNumber='4711';state.tasks[2].customerNumberSetAt='2026-10-21T10:00:00.000Z';
  load(state).reconcile(state,{now:NOW});
  assert.equal(state.tasks[1].customerNumber,'4711');
  assert.equal(state.tasks[0].customerNumber,'4711','erledigte Aufgaben bleiben unverändert');
});

test('RC1650: Modul wird im Build geladen',()=>{
  assert.match(build,/rc1650-shipment-task-link\.js\?v=1650/);
  assert.match(build,/'assets\/rc1650-shipment-task-link\.js'/);
});

const calendarDe=JSON.parse(fs.readFileSync('assets/i18n/de.json','utf8'));
globalThis.ExportHUBI18n={
  language(){return 'de'},
  t(key,vars){let value=calendarDe[key]||key;if(vars)for(const [name,v] of Object.entries(vars))value=value.replaceAll('{{'+name+'}}',String(v));return value},
  formatDate(value,options){return new Intl.DateTimeFormat('de-DE',options||{}).format(value)},
  localized(record,key){return record&&record[key]!=null?record[key]:''}
};
await import('../assets/abholkalender.js');
const calendar = globalThis.ExportHubPickupCalendar;

test('RC1650 Kalender: abgeholte Sendung bleibt grün sichtbar, FIX mit gleicher Kundennummer ist erledigt',()=>{
  const fixedPickups=[{id:'F-UK',siteLabel:'UK',weekday:3,active:true,customerNumber:'4711'},{id:'F-IT',siteLabel:'Italien',weekday:3,active:true,customerNumber:'555'},{id:'F-FR',siteLabel:'Frankreich',weekday:3,active:true}];
  const shipments=[
    {id:'S1',reference:'UK1',customerAccount:'4711',plannedPickupDate:'2026-10-21',pickedUpAt:'2026-10-21T10:00:00.000Z',status:'Abgeholt'},
    {id:'S2',reference:'IT1',customerNumber:'555',plannedPickupDate:'2026-10-21',status:'Angemeldet'},
    {id:'S3',reference:'X',customerNumber:'9',plannedPickupDate:'2026-10-21',status:'Storniert'}
  ];
  const model=calendar.buildCalendarModel({today:NOW,fixedPickups,shipments});
  const wed=model.days.find(d=>d.dateKey==='2026-10-21');
  assert.deepEqual(wed.shipments.map(s=>s.id),['S2']);
  assert.deepEqual(wed.doneShipments.map(s=>s.id),['S1'],'stornierte Sendung erscheint nicht als abgeholt');
  assert.equal(wed.fixedStatus['F-UK'].state,'done');
  assert.equal(wed.fixedStatus['F-IT'].state,'planned');
  assert.equal(wed.fixedStatus['F-FR'].state,'');
  const state=calendar.createViewState();state.fixedPickups=fixedPickups;state.shipments=shipments;
  const root={innerHTML:''};calendar.render(root,state,NOW);
  assert.match(root.innerHTML,/pickup-item-fix is-done/);
  assert.match(root.innerHTML,/data-pickup-fix-state="done">✓ Abgeholt · UK1/);
  assert.match(root.innerHTML,/pickup-item-shipment is-done/);
});

test('RC1650 Kalender: Teilabholung macht FIX gelb, nicht grün',()=>{
  const status=calendar.fixedPickupStatus({customerNumber:'1'},[{customerNumber:'1',expectedColliCount:4,collectedPickupCollis:1,remainingPickupCollis:3}],[]);
  assert.equal(status.state,'partial');
});

test('RC1650 FIX-Speicher übernimmt die Kundennummer',()=>{
  const store=require('../api/shared/fixed-pickup-store.js');
  assert.equal(store.validateInput({siteLabel:'UK',weekday:1,customerNumber:' 4711, 0815 '}).customerNumber,'4711, 0815');
  assert.deepEqual(Object.keys(store.validateInput({customerNumber:'1'},{partial:true})),['customerNumber']);
  assert.equal(store.publicItem({id:'F',siteLabel:'UK',weekday:1,customerNumber:'4711'}).customerNumber,'4711');
});
