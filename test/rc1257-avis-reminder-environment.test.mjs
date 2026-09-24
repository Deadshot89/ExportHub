import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const api=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');

test('RC1257: sendungsgebundener Avis-Link wird vor dem Helper-Fallback geprüft',()=>{
  const start=runtime.indexOf('function avisLink(sh)');
  const end=runtime.indexOf('function localizedLink',start);
  assert.ok(start>=0&&end>start);
  const fn=runtime.slice(start,end);
  const direct=fn.indexOf('sh.customerAvisUrl||sh.avisUrl');
  const helper=fn.indexOf('w.ExportHUBCustomerAvis706||w.ExportHUBCustomerAvis705');
  assert.ok(direct>=0);
  assert.ok(helper>=0);
  assert.ok(direct<helper);
});

test('RC1257: serverseitige Host-Prüfung bleibt aktiv',()=>{
  assert.match(api,/u\.hostname/);
  assert.match(api,/ExportHUB-Umgebung/);
});
