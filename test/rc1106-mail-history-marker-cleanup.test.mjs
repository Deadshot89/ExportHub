import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const history=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');
const deploy=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

test('RC1106: alter manueller Mail-Bestätigungsmarker ist vollständig entfernt',()=>{
  assert.doesNotMatch(history,/Mail als versendet bestätigen/);
  assert.doesNotMatch(history,/RC1071_LEGACY_RELEASE_MARKER/);
});

test('RC1106: Live-Deploy prüft die automatische Mail-Historie statt des alten Markers',()=>{
  assert.match(deploy,/mail-sent-open\|/);
  assert.match(deploy,/recordMailSent/);
  assert.doesNotMatch(deploy,/grep -q 'Mail als versendet bestätigen'/);
});
