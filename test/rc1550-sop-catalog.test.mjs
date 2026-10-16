import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1550-sop-active-catalog.js');
const catalog=globalThis.ExportHubSopActiveCatalog;

test('RC1550: aktiver SOP-Katalog enthält ausschließlich die neue BSH-SOP',()=>{
  assert.ok(catalog,'ExportHubSopActiveCatalog fehlt');
  assert.deepEqual(catalog.documents.map(doc=>doc.number),['SOP-CUST-BSH-001']);
  assert.equal(catalog.documents.some(doc=>/^SOP-EH-/.test(doc.number)),false);
  assert.equal(catalog.documents.some(doc=>/^SOP-CUST-DHL/.test(doc.number)),false);
});

test('RC1550: Kategorien enthalten Kunden, Versanddienstleister und Prozess-SOPs mit BSH und leerem DHL-Verzeichnis',()=>{
  assert.deepEqual(catalog.categories.map(item=>item.id),['customer','carrier','process']);
  const customer=catalog.categories.find(item=>item.id==='customer');
  const carrier=catalog.categories.find(item=>item.id==='carrier');
  assert.equal(customer.label,'Kunden-SOPs');
  assert.equal(customer.groups[0].label,'BSH-Gruppe');
  assert.deepEqual(customer.groups[0].documents,['SOP-CUST-BSH-001']);
  assert.equal(carrier.label,'Versanddienstleister');
  assert.equal(carrier.groups[0].label,'DHL');
  assert.deepEqual(carrier.groups[0].documents,[]);
});

test('RC1550: BSH-Dokument bildet die freigegebene Arbeitsanweisung vollständig ab',()=>{
  const bsh=catalog.get('SOP-CUST-BSH-001');
  assert.ok(bsh);
  assert.equal(bsh.type,'customer');
  assert.equal(bsh.category,'customer');
  assert.equal(bsh.group,'BSH-Gruppe');
  assert.deepEqual(bsh.customerIds,['BSH','NEFF','GAGGENAU']);
  assert.equal(bsh.title,'Transportanmeldung BSH-Gruppe');
  assert.equal(bsh.status,'Freigegeben');
  assert.equal(bsh.version,'1.0');
  assert.equal(bsh.sections.steps.length,8);
  const content=JSON.stringify(bsh);
  for(const term of [
    'BSH ONE Communication Platform',
    'Transportanmeldungen und Lieferavise',
    'Werknummer merken',
    'Datum und Uhrzeit',
    'WPA bedeutet Einwegpalette',
    'immer als nicht stapelbar',
    'REF aus ExportHUB360',
    'Lieferavise anlegen',
    'Alle Lieferscheine',
    'Erstellen der Sendungsnummer',
    'Info der ExportHUB360-Sendung',
    'E-Mail an den Kunden',
    'Abschlusskontrolle'
  ])assert.match(content,new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),term+' fehlt');
  assert.equal(bsh.visuals.length,11);
});

test('RC1550: BSH-Suche findet Kundengruppe und Alias-Kunden; DHL liefert keine erfundene SOP',()=>{
  assert.deepEqual(catalog.search('Neff').map(doc=>doc.number),['SOP-CUST-BSH-001']);
  assert.deepEqual(catalog.search('Gaggenau').map(doc=>doc.number),['SOP-CUST-BSH-001']);
  assert.deepEqual(catalog.search('DHL'),[]);
});
