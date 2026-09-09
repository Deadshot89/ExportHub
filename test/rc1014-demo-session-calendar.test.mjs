import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const bootstrap=fs.readFileSync('assets/exporthub-demo-bootstrap.js','utf8');
const bridge=fs.readFileSync('assets/rc1014-demo-bridge.js','utf8');
const calendar=fs.readFileSync('assets/abholkalender.js','utf8');
const browser=fs.readFileSync('browser/rc1016-visual-functional.mjs','utf8');

test('Demo legt über die frühe RC1016-Brücke die echte ExportHUB-Tab-Session an',()=>{
  assert.match(bridge,/exporthub_rc301_tab_session/);
  assert.match(bridge,/sessionStorage\.setItem\(TAB_SESSION_KEY/);
  assert.match(bridge,/demo-session-token/);
  assert.match(bridge,/Demo Administrator/);
  assert.match(bridge,/version:'RC1016'/);
  execFileSync(process.execPath,['.github/rc1016/build-three-env.mjs'],{stdio:'pipe'});
  const demoHtml=fs.readFileSync('dist-rc1016/demo.html','utf8');
  const bootstrapPos=demoHtml.indexOf('id="exporthub-rc1013-demo-bootstrap"');
  const bridgePos=demoHtml.indexOf('id="exporthub-rc1016-demo-bridge"');
  assert.ok(bootstrapPos>=0,'RC1013 Demo-Bootstrap fehlt im gebauten RC1016-Demo-HTML');
  assert.ok(bridgePos>bootstrapPos,'RC1016 Demo-Brücke muss direkt nach dem Demo-Bootstrap und vor dem App-Start geladen werden');
});

test('Demo beantwortet fixed-pickups lokal und der Kalender lädt diese Daten auch wirklich',()=>{
  assert.match(bridge,/\/api\/fixed-pickups/);
  assert.match(bridge,/Fake Fix Nord/);
  assert.match(bridge,/Fake Fix Export/);
  assert.match(bridge,/Fake Fix Benelux/);
  assert.match(bridge,/weekday\s*:\s*[1-5]/);
  assert.match(bridge,/items,canEdit:true,environment:'demo'/);
  assert.match(calendar,/fetch\('\/api\/fixed-pickups\?includeInactive=1'/);
  assert.doesNotMatch(calendar,/environmentOf\(mountedOptions\)\s*===\s*'demo'[\s\S]{0,220}fixedPickups\s*=\s*\[\]/,'Demo darf FIX-Daten nicht vor dem API-Aufruf leeren');
  assert.match(bootstrap,/pickup\|customer-avis\|pod-backup\|mail\|email\|outlook\|send/);
});

test('RC1016 Chromium-Vertrag verlangt sichtbare FIX-Einträge im Abholkalender',()=>{
  assert.match(browser,/pickup-item-fix/);
  assert.match(browser,/Fake Fix/);
  assert.match(browser,/\.rc229-task-card\.rc628-unified-task, \.task-card/);
});
