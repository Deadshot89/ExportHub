import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');

test('RC1221: der Live-Hauptnavigationstest erhält 240 Sekunden Zeitbudget',()=>{
  const start=source.indexOf("test('RC1124 P0: Hauptnavigation öffnet auf jedem Viewport die richtige Ansicht'");
  const end=source.indexOf("test('RC1124 P0: Sendung erstellen bleibt Erfassungsmaske",start);
  assert.ok(start>=0&&end>start,'Hauptnavigationstest fehlt');
  const block=source.slice(start,end);
  assert.match(block,/if\(process\.env\.EXPORTHUB_E2E_LIVE==='1'\)test\.setTimeout\(240_000\)/);
});

test('RC1161: fachlicher Navigationsumfang bleibt vollständig erhalten',()=>{
  for(const view of ['dashboard','tasks','notifications','pickupcalendar','shipment','shipmentoverview','customerfolder','pallet','shippingcosts','sop','academy']){
    assert.match(source,new RegExp("\\['"+view+"'"),view+' fehlt in coreViews');
  }
  for(const view of ['shipmentview','documents','warehouse','customs','exams']){
    assert.match(source,new RegExp("\\['"+view+"'"),view+' fehlt in wideViews');
  }
  assert.match(source,/await openExportHubView\(page,module,labels,required\)/);
  assert.match(source,/await assertView\(page\)/);
  assert.match(source,/await assertRuntimeClean\(runtime,testInfo\)/);
});
