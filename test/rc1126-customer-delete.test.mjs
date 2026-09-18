import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const merge=require('../api/shared/merge.js');
const runtime=fs.readFileSync('assets/rc1126-customer-delete.js','utf8');
const audit=fs.readFileSync('assets/rc1081-audit-history.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1126: Kundenlöschung ist nur für Kunden-Admins sichtbar und zweistufig bestätigt',()=>{
  assert.match(runtime,/function canDelete\(\)/);
  assert.match(runtime,/rights\.customers\|\|\{\}/);
  assert.match(runtime,/rights\.customerfolder\|\|\{\}/);
  assert.match(runtime,/functionAdmin/);
  assert.match(runtime,/Kunde löschen/);
  assert.match(runtime,/Endgültig löschen/);
  assert.match(runtime,/Nur für doppelt oder falsch angelegte Kunden/);
});

test('RC1126: Löschen setzt Kunden-Tombstone und protokolliert die Aktion',()=>{
  assert.match(runtime,/collection:'customers'/);
  assert.match(runtime,/explicitUserAction:true/);
  assert.match(runtime,/reason:'duplicate-or-invalid-customer'/);
  assert.match(runtime,/type:'CUSTOMER_DELETED'/);
  assert.match(audit,/CUSTOMER_DELETED:'Kunde gelöscht'/);
  assert.match(audit,/subtype==='CUSTOMER_DELETED'/);
});

test('RC1126: gelöschter Kunde kommt durch einen veralteten Browser nicht wieder',()=>{
  const server={
    customers:[{id:'DUP-1',account:'10001',name:'Doppelter Kunde',updatedAt:'2026-09-16T08:00:00.000Z'}],
    _teamSyncMeta:{fields:{},tombstones:[{collection:'customers',id:'DUP-1',deletedAt:'2026-09-16T09:00:00.000Z',explicitUserAction:true}]}
  };
  const stale={
    customers:[{id:'DUP-1',account:'10001',name:'Doppelter Kunde',updatedAt:'2026-09-16T08:30:00.000Z'}],
    _teamSyncMeta:{fields:{},tombstones:[]}
  };
  const out=merge.mergeState(server,stale);
  assert.deepEqual(out.customers,[]);
  assert.ok(out._teamSyncMeta.tombstones.some(t=>t.collection==='customers'&&t.id==='DUP-1'));
});

test('RC1126: finaler Build liefert Lösch-Runtime und neue Historie ohne Cache-Altstand aus',()=>{
  assert.match(build,/assets\/rc1126-customer-delete\.js\?v=1126/);
  assert.match(build,/assets\/rc1081-audit-history\.js\?v=1163/);
  assert.match(build,/'assets\/rc1126-customer-delete\.js'/);
});
