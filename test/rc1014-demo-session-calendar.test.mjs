import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap=fs.readFileSync('assets/exporthub-demo-bootstrap.js','utf8');
const bridge=fs.readFileSync('assets/rc1014-demo-bridge.js','utf8');
const build=fs.readFileSync('.github/rc1014/build-three-env.mjs','utf8');
const browser=fs.readFileSync('browser/rc1014-visual-functional.mjs','utf8');

test('Demo legt über die frühe RC1014-Brücke die echte ExportHUB-Tab-Session an',()=>{
  assert.match(bridge,/exporthub_rc301_tab_session/);
  assert.match(bridge,/sessionStorage\.setItem\(TAB_SESSION_KEY/);
  assert.match(bridge,/demo-session-token/);
  assert.match(bridge,/Demo Administrator/);
  assert.match(build,/exporthub-rc1013-demo-bootstrap/);
  assert.match(build,/exporthub-rc1014-demo-bridge/);
  assert.ok(build.indexOf('exporthub-rc1013-demo-bootstrap')<build.indexOf('exporthub-rc1014-demo-bridge'));
});

test('Demo beantwortet fixed-pickups lokal und lässt echten Pickup-Außenwirkungsblock unangetastet',()=>{
  assert.match(bridge,/\/api\/fixed-pickups/);
  assert.match(bridge,/Fake Fix/);
  assert.match(bridge,/weekday\s*:\s*[1-5]/);
  assert.match(bridge,/items,canEdit:true,environment:'demo'/);
  assert.match(bootstrap,/pickup\|customer-avis\|pod-backup\|mail\|email\|outlook\|send/);
});

test('Chromium-Vertrag verlangt sichtbare FIX-Einträge im Abholkalender',()=>{
  assert.match(browser,/pickup-item-fix/);
  assert.match(browser,/Fake Fix/);
});
