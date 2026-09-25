import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');
const runtime=fs.readFileSync('assets/rc1080-customer-history.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');
const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');

test('RC1080: Kundenhistorie zeigt Anlage und Änderungen mit Benutzer an',()=>{
  assert.match(runtime,/customerHistory\.title/);
  assert.match(runtime,/e\.actor&&e\.actor\.name/);
  assert.match(runtime,/e\.actor&&e\.actor\.role/);
  assert.match(runtime,/customerHistory\.changed/);
  assert.match(stateApi,/customer-created','Kunde angelegt'/);
  assert.match(stateApi,/customer-updated','Kunde geändert'/);
});

test('RC1080: Client erzeugt keine Kundenhistorie selbst, sondern zeigt den serverseitig bestätigten Stand',()=>{
  assert.match(runtime,/var wrapped=async function\(\)\{return await original\.apply\(this,arguments\)\}/);
  assert.match(runtime,/customerHistory\.title/);
  assert.match(runtime,/customerHistory/);
});

test('RC1080: parallele Kundenänderungen behalten beide Historienereignisse',()=>{
  const server={id:'C1',name:'Kunde',updatedAt:'2026-09-13T09:00:00Z',customerHistory:[
    {id:'CH1',at:'2026-09-13T08:00:00Z',type:'customer-created',label:'Kunde angelegt',actor:{name:'Tobias'}}
  ]};
  const client={id:'C1',name:'Kunde Neu',updatedAt:'2026-09-13T09:01:00Z',customerHistory:[
    {id:'CH2',at:'2026-09-13T09:00:30Z',type:'customer-updated',label:'Kunde geändert',actor:{name:'Daniel'}}
  ]};
  const out=merge.mergeCustomerProtected(server,client);
  assert.deepEqual(out.customerHistory.map(x=>x.id),['CH1','CH2']);
});

test('RC1080: finaler Build lädt Kundenhistorie in allen Umgebungen',()=>{
  assert.match(build,/RC1080_CUSTOMER_HISTORY_TAG/);
  assert.match(build,/assets\/rc1080-customer-history\.js\?v=1080/);
  assert.match(build,/customerHistory:\{version:'RC1080'/);
});


test('RC1080: Kundenanlage und Kundenänderung werden serverseitig mit dem angemeldeten Benutzer protokolliert',()=>{
  assert.match(stateApi,/function rc1080AuditCustomerChanges\(/);
  assert.match(stateApi,/customer-created','Kunde angelegt'/);
  assert.match(stateApi,/customer-updated','Kunde geändert'/);
  assert.match(stateApi,/actor:\{name:who,id:whoId,role:/);
  assert.match(stateApi,/rc1080AuditCustomerChanges\(current\.state\|\|\{\},merged,writeUser,incoming\.state\|\|\{\}\)/);
});
