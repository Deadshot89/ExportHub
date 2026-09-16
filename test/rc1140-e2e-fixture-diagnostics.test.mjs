import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WF='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

test('RC1140: TESTSERVICE Fixture-Fehler zeigen nur Status/Code/Message statt curl -f Blindflug',()=>{
  const source=fs.readFileSync(WF,'utf8');
  const gate=source.indexOf('- name: RC1124 TESTSERVICE Browser Gate');
  const prod=source.indexOf('- name: Deploy ExportHUB production');
  assert.ok(gate>=0&&prod>gate,'TESTSERVICE Gate fehlt');
  const block=source.slice(gate,prod);
  assert.match(block,/fixture_response/,'Fixture-Antwort wird nicht separat erfasst');
  assert.match(block,/fixture_status/,'HTTP-Status wird nicht erfasst');
  assert.match(block,/fixture_error/,'sichere Fehlerausgabe fehlt');
  assert.match(block,/JSON\.parse/,'Fehlercode/-message werden nicht strukturiert gelesen');
  assert.doesNotMatch(block,/curl\s+-fsSL[\s\S]{0,400}\/api\/e2e-test-fixture/,'Fixture darf Fehlerbody nicht mehr per -f verwerfen');
  assert.match(block,/::add-mask::\$oidc_token/,'OIDC-Token muss bereits vor Fixture-Aufruf maskiert werden');
  assert.match(block,/::add-mask::\$session_token/,'Sessiontoken muss maskiert bleiben');
});
