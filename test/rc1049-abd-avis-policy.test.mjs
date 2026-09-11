import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(p,'utf8');

test('RC1049: State API nutzt AzureWebJobsStorage als sicheren Fallback',()=>{
  execFileSync(process.execPath,['.github/rc1018/fix-mail-wording.mjs'],{cwd:ROOT,stdio:'pipe'});
  const state=read('api/exporthub-state/index.js');
  assert.match(state,/process\.env\.AzureWebJobsStorage/);
  assert.match(state,/return 'AzureWebJobsStorage'/);
});

test('RC1049: ABD-Avis meldet fehlendes ABD und sperrt zu frühe Abholung serverseitig',()=>{
  execFileSync(process.execPath,['.github/rc1018/fix-mail-wording.mjs'],{cwd:ROOT,stdio:'pipe'});
  const api=read('api/customer-avis/index.js');
  assert.match(api,/function abdPolicy\(state,sh\)/);
  assert.match(api,/minutes<=810\?1:2/);
  assert.match(api,/Europe\/Berlin/);
  assert.match(api,/function nrwHolidays/);
  assert.match(api,/ABD_PICKUP_TOO_EARLY/);
  assert.match(api,/abd:abdPolicy\(state,sh\)/);
  assert.match(api,/publicShipment\(sh,session,state\)/);
});

test('RC1049: Mail und öffentliche Avis-Seite erhalten den ABD-Hinweis und Terminuntergrenze',()=>{
  execFileSync(process.execPath,['.github/rc1018/fix-mail-wording.mjs'],{cwd:ROOT,stdio:'pipe'});
  const asset=read('assets/rc1049-abd-avis-policy.js');
  const page=read('customer-avis.html');
  const main=read('index.html');
  assert.match(asset,/ABD NOCH NICHT VORHANDEN/);
  assert.match(asset,/expectedAvailableDate/);
  assert.match(asset,/minPickupTime:'10:00'/);
  assert.match(asset,/b\.shipmentSnapshot\.abdRequestedAt/);
  assert.match(page,/rc1049-abd-avis-policy\.js\?v=1049/);
  assert.match(main,/rc1049-abd-avis-policy\.js\?v=1049/);
});

test('RC1049: ABD-Avis-Runtime ist syntaktisch ausführbar',()=>{
  const asset='assets/rc1049-abd-avis-policy.js';
  assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',asset],{cwd:ROOT,stdio:'pipe'}));
});
