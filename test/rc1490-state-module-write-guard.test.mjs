import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

function loadStateInternals(){
  const file=path.resolve(__dirname,'../api/exporthub-state/index.js');
  const source=fs.readFileSync(file,'utf8')+'\nmodule.exports.__rc1490Test={saveMerged};\n';
  const mod=new Module(file);
  mod.filename=file;
  mod.paths=Module._nodeModulePaths(path.dirname(file));
  mod._compile(source,file);
  return mod.exports.__rc1490Test;
}

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

function userWithRights(rights){
  return {
    id:'U1',
    user:'taskeditor',
    name:'Task Editor',
    role:'Benutzer',
    active:true,
    authVersion:0,
    permissions:[],
    rights:Object.assign({
      tasks:right('none'),
      customers:right('none'),
      shipment:right('none'),
      abd:right('none'),
      pallet:right('none'),
      settings:right('none')
    },rights)
  };
}

function teamFor(user){
  return {
    schemaVersion:3,
    revision:7,
    updatedAt:'2026-10-11T12:00:00.000Z',
    state:{
      tasks:[{id:'T1',title:'Alt',updatedAt:'2026-10-11T10:00:00.000Z'}],
      customers:[{id:'C1',name:'Original',updatedAt:'2026-10-11T10:00:00.000Z'}]
    },
    users:[user]
  };
}

function incoming(state){
  return {
    clientVersion:'RC1490-test',
    baseRevision:7,
    deviceId:'test-device',
    operationId:'rc1490-op-'+Math.random().toString(36).slice(2),
    reason:'test',
    state
  };
}

function fakeBlob(){
  const writes=[];
  return {
    name:'team-state.json',
    writes,
    async upload(raw){
      writes.push(JSON.parse(raw));
      return {etag:'etag-next'};
    }
  };
}

test('RC1490: Aufgaben-Editrecht darf Kundenänderung im globalen State-Save nicht schreiben',async()=>{
  const {saveMerged}=loadStateInternals();
  const user=userWithRights({tasks:right('edit'),customers:right('view')});
  const team=teamFor(user);
  const blob=fakeBlob();

  await assert.rejects(
    ()=>saveMerged(blob,incoming({
      tasks:[{id:'T1',title:'Erlaubte Aufgabe',updatedAt:'2026-10-11T13:00:00.000Z'}],
      customers:[{id:'C1',name:'Manipuliert',updatedAt:'2026-10-11T13:00:00.000Z'}]
    }),user,team,'etag-7',{authVersion:0}),
    error=>error&&error.code==='STATE_MODULE_WRITE_FORBIDDEN'
  );
  assert.equal(blob.writes.length,0,'Bei modulübergreifender Manipulation darf kein Blob-Write stattfinden.');
});

test('RC1490: Aufgaben-Editrecht darf eine reine Aufgabenänderung weiterhin speichern',async()=>{
  const {saveMerged}=loadStateInternals();
  const user=userWithRights({tasks:right('edit'),customers:right('view')});
  const team=teamFor(user);
  const blob=fakeBlob();

  const saved=await saveMerged(blob,incoming({
    tasks:[{id:'T1',title:'Erlaubte Aufgabe',updatedAt:'2026-10-11T13:00:00.000Z'}],
    customers:[{id:'C1',name:'Original',updatedAt:'2026-10-11T10:00:00.000Z'}]
  }),user,team,'etag-7',{authVersion:0});

  assert.equal(saved.state.tasks[0].title,'Erlaubte Aufgabe');
  assert.equal(saved.state.customers[0].name,'Original');
  assert.equal(blob.writes.length,1);
});

test('RC1490: Global-Admin darf modulübergreifende State-Änderungen weiterhin speichern',async()=>{
  const {saveMerged}=loadStateInternals();
  const user={...userWithRights({}),role:'Admin',globalAdmin:true,permissions:['*']};
  const team=teamFor(user);
  const blob=fakeBlob();

  const saved=await saveMerged(blob,incoming({
    tasks:[{id:'T1',title:'Admin Aufgabe',updatedAt:'2026-10-11T13:00:00.000Z'}],
    customers:[{id:'C1',name:'Admin Kunde',updatedAt:'2026-10-11T13:00:00.000Z'}]
  }),user,team,'etag-7',{authVersion:0});

  assert.equal(saved.state.tasks[0].title,'Admin Aufgabe');
  assert.equal(saved.state.customers[0].name,'Admin Kunde');
  assert.equal(blob.writes.length,1);
});
