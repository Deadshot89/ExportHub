import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const secureMerge=require('../api/shared/secure-merge.js');
const writeContext=require('../api/shared/state-write-context.js');

function right(level){
  return {
    level,
    visible:level!=='none',
    read:level!=='none',
    edit:level==='edit'||level==='admin',
    admin:level==='admin',
    functionAdmin:level==='admin'
  };
}

function userWithRights(rights={}){
  return {
    id:'U1',
    user:'restricted-user',
    name:'Restricted User',
    role:'Benutzer',
    active:true,
    authVersion:0,
    permissions:[],
    rights:Object.assign({
      tasks:right('none'),
      customers:right('none'),
      customerfolder:right('none'),
      shipment:right('none'),
      archive:right('none'),
      documents:right('none'),
      abd:right('none'),
      pallet:right('none'),
      vacation:right('none'),
      ideas:right('none'),
      sop:right('none'),
      settings:right('none'),
      history:right('none')
    },rights)
  };
}

function baseState(){
  return {
    tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
    customers:[{id:'C1',name:'Original',updatedAt:'2026-10-11T10:00:00.000Z'}],
    shipments:[{id:'S1',ref:'ABC123',status:'Erstellt',deliveryFiles:[{id:'D1',name:'alt.pdf'}],updatedAt:'2026-10-11T10:00:00.000Z'}],
    abdRequests:[{id:'A1',ref:'ABC123',status:'offen',abdFiles:[],updatedAt:'2026-10-11T10:00:00.000Z'}],
    palletAccount:[{id:'P1',count:1,updatedAt:'2026-10-11T10:00:00.000Z'}],
    vacations:[{id:'V1',status:'offen',updatedAt:'2026-10-11T10:00:00.000Z'}],
    ideas:[{id:'I1',title:'Idee',updatedAt:'2026-10-11T10:00:00.000Z'}],
    customSops:[{id:'SOP1',name:'SOP',updatedAt:'2026-10-11T10:00:00.000Z'}],
    settings:{theme:'classic'},
    auditLog:[],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
}

function runAs(user,fn){
  return writeContext.run(()=>{
    writeContext.captureUser(user);
    return fn();
  });
}

function expectForbidden(user,server,incoming){
  assert.throws(
    ()=>runAs(user,()=>secureMerge.mergeState(server,incoming)),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'&&error.status===403
  );
}

test('RC1490: Aufgaben-Editrecht darf Kundenänderung im globalen State-Save nicht schreiben',()=>{
  const server=baseState();
  const incoming=structuredClone(server);
  incoming.tasks[0]={...incoming.tasks[0],title:'Erlaubte Aufgabe',updatedAt:'2026-10-11T13:00:00.000Z'};
  incoming.customers[0]={...incoming.customers[0],name:'Manipuliert',updatedAt:'2026-10-11T13:00:00.000Z'};
  expectForbidden(userWithRights({tasks:right('edit'),customers:right('view')}),server,incoming);
});

test('RC1490: Aufgaben-Editrecht darf reine Aufgabenänderung weiterhin mergen',()=>{
  const server=baseState();
  const incoming=structuredClone(server);
  incoming.tasks[0]={...incoming.tasks[0],title:'Erlaubte Aufgabe',updatedAt:'2026-10-11T13:00:00.000Z'};
  const merged=runAs(userWithRights({tasks:right('edit')}),()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.tasks[0].title,'Erlaubte Aufgabe');
  assert.equal(merged.customers[0].name,'Original');
});

test('RC1490: Global-Admin darf modulübergreifende Änderungen weiterhin mergen',()=>{
  const server=baseState();
  const incoming=structuredClone(server);
  incoming.tasks[0]={...incoming.tasks[0],title:'Admin Aufgabe',updatedAt:'2026-10-11T13:00:00.000Z'};
  incoming.customers[0]={...incoming.customers[0],name:'Admin Kunde',updatedAt:'2026-10-11T13:00:00.000Z'};
  const admin={...userWithRights(),role:'Admin',globalAdmin:true,permissions:['*']};
  const merged=runAs(admin,()=>secureMerge.mergeState(server,incoming));
  assert.equal(merged.tasks[0].title,'Admin Aufgabe');
  assert.equal(merged.customers[0].name,'Admin Kunde');
});

test('RC1490: kritische fachliche State-Bereiche verlangen ihr eigenes Modulrecht',()=>{
  const cases=[
    ['customers','customers',(state)=>{state.customers[0]={...state.customers[0],name:'Neu',updatedAt:'2026-10-11T13:00:00.000Z'}}],
    ['shipment','shipments',(state)=>{state.shipments[0]={...state.shipments[0],status:'Bereit zur Abholung',updatedAt:'2026-10-11T13:00:00.000Z'}}],
    ['abd','abdRequests',(state)=>{state.abdRequests[0]={...state.abdRequests[0],status:'erstellt',updatedAt:'2026-10-11T13:00:00.000Z'}}],
    ['pallet','palletAccount',(state)=>{state.palletAccount[0]={...state.palletAccount[0],count:9,updatedAt:'2026-10-11T13:00:00.000Z'}}],
    ['vacation','vacations',(state)=>{state.vacations[0]={...state.vacations[0],status:'genehmigt',updatedAt:'2026-10-11T13:00:00.000Z'}}],
    ['ideas','ideas',(state)=>{state.ideas[0]={...state.ideas[0],title:'Manipuliert',updatedAt:'2026-10-11T13:00:00.000Z'}}],
    ['sop','customSops',(state)=>{state.customSops[0]={...state.customSops[0],name:'Manipuliert',updatedAt:'2026-10-11T13:00:00.000Z'}}],
    ['settings','settings',(state)=>{state.settings={theme:'manipuliert'}}]
  ];
  for(const [moduleId,key,mutate] of cases){
    const server=baseState();
    const incoming=structuredClone(server);
    mutate(incoming);
    const attacker=userWithRights({tasks:right('edit'),[moduleId]:right('view')});
    assert.throws(
      ()=>runAs(attacker,()=>secureMerge.mergeState(server,incoming)),
      error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN',
      `${key} muss gegen fremdes Editrecht geschützt sein`
    );
  }
});

test('RC1490: Dokumentrecht darf reine Dokumentänderung in Sendung zulassen, aber keine Statusänderung',()=>{
  const server=baseState();
  const documentsOnly=structuredClone(server);
  documentsOnly.shipments[0].deliveryFiles=[{id:'D2',name:'neu.pdf'}];
  const user=userWithRights({documents:right('edit'),shipment:right('view')});
  const merged=runAs(user,()=>secureMerge.mergeState(server,documentsOnly));
  assert.equal(merged.shipments[0].deliveryFiles[0].name,'neu.pdf');
  assert.equal(merged.shipments[0].status,'Erstellt');

  const forbidden=structuredClone(server);
  forbidden.shipments[0]={...forbidden.shipments[0],status:'Abgeholt',updatedAt:'2026-10-11T13:00:00.000Z'};
  expectForbidden(user,server,forbidden);
});

test('RC1490: fremde TeamSync-Metadaten und Tombstones dürfen Rechte nicht umgehen',()=>{
  const user=userWithRights({tasks:right('edit'),customers:right('view')});

  const serverFields=baseState();
  const incomingFields=structuredClone(serverFields);
  incomingFields._teamSyncMeta.fields.customers='2099-01-01T00:00:00.000Z';
  expectForbidden(user,serverFields,incomingFields);

  const serverTombstone=baseState();
  const incomingTombstone=structuredClone(serverTombstone);
  incomingTombstone._teamSyncMeta.tombstones.push({collection:'customers',id:'C1',deletedAt:'2099-01-01T00:00:00.000Z'});
  expectForbidden(user,serverTombstone,incomingTombstone);
});

test('RC1490: State-Runtime lädt sicheren Merge im isolierten Request-Kontext',()=>{
  const runtime=fs.readFileSync(new URL('../api/exporthub-state/runtime.js',import.meta.url),'utf8');
  const functionJson=JSON.parse(fs.readFileSync(new URL('../api/exporthub-state/function.json',import.meta.url),'utf8'));
  assert.equal(functionJson.scriptFile,'runtime.js');
  assert.match(runtime,/state-write-context/);
  assert.match(runtime,/secure-merge/);
  assert.match(runtime,/captureUser\(user\)/);
  assert.match(runtime,/writeContext\.run\(/);
  assert.match(runtime,/mergeModule\.exports\s*=\s*secureMerge/);
});
