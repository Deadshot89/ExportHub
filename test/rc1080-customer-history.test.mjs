import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');
const runtime=fs.readFileSync('assets/rc1080-customer-history.js','utf8');
const build=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

test('RC1080: Kundenhistorie protokolliert Anlage und Änderung mit Benutzer',()=>{
  assert.match(runtime,/type:'customer-created'/);
  assert.match(runtime,/label:'Kunde angelegt'/);
  assert.match(runtime,/type:'customer-updated'/);
  assert.match(runtime,/label:'Kunde geändert'/);
  assert.match(runtime,/actor:a/);
  assert.match(runtime,/fields:fields\.join/);
});

test('RC1080: Kundenhistorie wird vor dem Speichern ergänzt und nicht bei bloßer Ansicht erfunden',()=>{
  assert.match(runtime,/var wrapped=async function\(reason,opt\)\{try\{prepare\(reason,opt\)/);
  assert.match(runtime,/if\(!shouldAudit\(reason,opt\)\)return 0/);
  assert.match(runtime,/customerView\(\)/);
  assert.match(runtime,/BASELINES/);
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
