import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('scripts/rc1903-testservice-guest-live.mjs','utf8');

test('RC1903 TESTSERVICE: verify canonical guest page, not login home',()=>{
  assert.match(source,/new URL\('\/sendungsdokumentation',BASE\)/);
  assert.match(source,/assert\.match\(publicHtml,\/\\\/assets\\\/shipment-evidence-guest/);
  assert.doesNotMatch(source,/assert\.match\(html,\/\\\/assets\\\/shipment-evidence-guest/);
  assert.doesNotMatch(source,/Updated guest runtime missing from verified TESTSERVICE HTML/);
});

test('RC1903 TESTSERVICE: never write without exact verified deployment SHA',()=>{
  const verified=source.indexOf('assert.equal(healthData?.deployment?.buildId,sha');
  const customer=source.indexOf("request('POST','public-create'");
  assert.ok(verified>0&&customer>verified);
  assert.match(source,/assert\.equal\(healthData\?\.deployment\?\.environment,'testservice'/);
  assert.match(source,/assert\.deepEqual\(read\.data,bytes/);
  assert.match(source,/assert\.equal\(noLogin\.status,401/);
});
