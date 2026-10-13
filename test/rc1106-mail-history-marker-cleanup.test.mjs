import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readLiveContract} from './helpers/rc1505-release-contract.mjs';

const history=fs.readFileSync('assets/rc1071-shipment-history.js','utf8');

test('RC1106: alter manueller Mail-Bestätigungsmarker ist vollständig entfernt',()=>{
  assert.doesNotMatch(history,/Mail als versendet bestätigen/);
  assert.doesNotMatch(history,/RC1071_LEGACY_RELEASE_MARKER/);
});

test('RC1106: Production-Liveprüfung prüft die automatische Mail-Historie statt des alten Markers',()=>{
  const live=readLiveContract();
  assert.match(live,/mail-sent-open\|/);
  assert.match(live,/recordMailSent/);
  assert.doesNotMatch(live,/Mail als versendet bestätigen/);
});
