import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap=fs.readFileSync('assets/exporthub-demo-bootstrap.js','utf8');
const browser=fs.readFileSync('browser/rc1014-visual-functional.mjs','utf8');

test('Demo legt die echte ExportHUB-Tab-Session vor dem App-Start an',()=>{
  assert.match(bootstrap,/exporthub_rc301_tab_session/);
  assert.match(bootstrap,/sessionStorage\.setItem\([^\n]*exporthub_rc301_tab_session|sessionStorage\.setItem\(TAB_SESSION_KEY/);
  assert.match(bootstrap,/demo-session-token/);
  assert.match(bootstrap,/Demo Administrator/);
});

test('Demo beantwortet fixed-pickups lokal vor dem Außenwirkungs-Block',()=>{
  const handler=bootstrap.indexOf("/api/fixed-pickups");
  const blocker=bootstrap.search(/pickup\|customer-avis\|pod-backup\|mail\|email\|outlook\|send/);
  assert.ok(handler>=0,'Demo-FIX-Handler fehlt');
  assert.ok(blocker>=0,'Demo-Außenwirkungsblock fehlt');
  assert.ok(handler<blocker,'Demo-FIX-Handler muss vor dem allgemeinen Pickup-Block liegen');
  assert.match(bootstrap,/Fake Fix/);
  assert.match(bootstrap,/weekday\s*:\s*[1-5]/);
});

test('Chromium-Vertrag verlangt sichtbare FIX-Einträge im Abholkalender',()=>{
  assert.match(browser,/pickup-item-fix/);
  assert.match(browser,/FIX/);
});
