import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.ExportHUBI18n={t(key){return key;}};
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-ui.js');
await import('../assets/sop/rc1550-sop-active-catalog.js');
await import('../assets/sop/rc1550-sop-ui.js');

const ui=globalThis.ExportHubIsoSopUi;
const catalog=globalThis.ExportHubSopActiveCatalog;

test('RC1550: aktive SOP-Übersicht verwendet neue Informationsarchitektur ohne SOP-Handbuch',()=>{
  const html=ui.renderOverview({documents:catalog.documents,rights:{read:true,edit:true,admin:true}});
  for(const term of ['SOP / Arbeitsanweisungen','Kunden-SOPs','BSH-Gruppe','Transportanmeldung BSH-Gruppe','Versanddienstleister','DHL','Prozess-SOPs']) assert.match(html,new RegExp(term,'i'),term+' fehlt');
  assert.match(html,/data-sop-open="SOP-CUST-BSH-001"/);
  assert.match(html,/Noch keine SOP veröffentlicht/i);
  assert.doesNotMatch(html,/SOP-Handbuch/i);
  assert.doesNotMatch(html,/SOP-EH-\d{3}/i);
});

test('RC1550: Workspace wählt nur aktive SOPs und lässt alte Deep-Links nicht auf BSH umfallen',()=>{
  const legacy=ui.renderWorkspace({documents:catalog.documents,rights:{read:true,edit:true,admin:true},activeNumber:'SOP-EH-060'});
  assert.match(legacy,/SOP nicht verfügbar/i);
  assert.doesNotMatch(legacy,/data-sop-number="SOP-CUST-BSH-001"/);
  const active=ui.renderWorkspace({documents:catalog.documents,rights:{read:true,edit:true,admin:true},activeNumber:'SOP-CUST-BSH-001'});
  assert.match(active,/data-sop-number="SOP-CUST-BSH-001"/);
  assert.match(active,/BSH-Gruppe/i);
});

test('RC1550: Suche blendet leere Kategorien nicht weg, filtert aber SOP-Einträge',()=>{
  const html=ui.renderOverview({documents:catalog.documents,rights:{read:true,edit:true,admin:true},filters:{query:'Neff'}});
  assert.match(html,/SOP-CUST-BSH-001/);
  assert.match(html,/Versanddienstleister/i);
  assert.match(html,/DHL/i);
  assert.match(html,/Prozess-SOPs/i);
});
