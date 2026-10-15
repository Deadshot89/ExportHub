import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('e2e/helpers/exporthub-browser.mjs','utf8');

function waitReadyBlock(){
  const start=helper.indexOf('export async function waitReady(page)');
  const end=helper.indexOf('function responsiveViewport',start);
  assert.ok(start>=0&&end>start,'waitReady-Block fehlt');
  return helper.slice(start,end);
}

test('RC1540: Live-waitReady wartet bis der bekannte Startup-Ladezustand beendet ist',()=>{
  const block=waitReadyBlock();
  assert.match(block,/process\.env\.EXPORTHUB_E2E_LIVE==='1'/);
  assert.match(block,/ExportHUBRC1067StartupRecovery/,'kanonische Startup-Ladeerkennung wird nicht verwendet');
  assert.match(block,/\.loading\(\)/,'Startup-Ladezustand wird nicht abgefragt');
  assert.match(block,/ExportHUB\\s\+wird\\s\+geladen|Teamdaten\\s\+werden\\s\+wiederhergestellt|Gespeicherte\\s\+Sitzung\\s\+und\\s\+Teamdaten/,'Fallback erkennt den sichtbaren Ladezustand nicht');
});

test('RC1541: Live-waitReady akzeptiert Ready-Marker erst mit benutzbarer App-Shell',()=>{
  const block=waitReadyBlock();
  const liveStart=block.indexOf("if(process.env.EXPORTHUB_E2E_LIVE==='1')");
  assert.ok(liveStart>=0,'Live-Readiness-Block fehlt');
  const live=block.slice(liveStart);
  assert.match(live,/const body=document\.body,content=document\.getElementById\('content'\)/,'Live-Gate prüft die App-Shell nach dem Ready-Marker nicht erneut');
  assert.match(live,/const view=String\(body&&body\.getAttribute&&body\.getAttribute\('data-exporthub-view'\)/,'Live-Gate prüft keine aktive fachliche View');
  assert.match(live,/const interactive=typeof window\.setView==='function'\|\|!!document\.querySelector\('\[data-view\],\[data-target\],\[data-nav\]'\)/,'Live-Gate prüft keine echte Navigation');
  assert.match(live,/return !!content&&text\.length>10&&!!view&&interactive&&!startupLoading/,'Ready-Marker kann weiterhin einen leeren bzw. nicht benutzbaren Inhaltsbereich freigeben');
});
