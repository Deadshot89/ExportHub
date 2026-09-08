import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1007-sop-catalog.js');
const catalog=globalThis.ExportHubIsoSopCatalog;
const required=['purpose','scope','definitions','responsibilities','prerequisites','resources','steps','checks','deviations','records','metrics','relatedDocuments','references','changeHistory'];

test('SOP-Katalog enthält ausschließlich den aktuellen ExportHUB-Systembestand',()=>{
  assert.equal(catalog.systemOnly,true);
  assert.equal(catalog.documents.length,75);
  assert.equal(new Set(catalog.documents.map(doc=>doc.number)).size,75);
  for(const doc of catalog.documents) assert.match(doc.number,/^SOP-EH-\d{3}$/);
});

test('jede SOP besitzt die vollständige gelenkte Pflichtstruktur',()=>{
  for(const doc of catalog.documents){
    for(const field of ['id','number','title','area','keywords','processFlow','version','status','createdBy','reviewedBy','approvedBy','processOwner','affectedAreas','changeReason','sections','visuals','references','history']) assert.ok(Object.hasOwn(doc,field),`${doc.number}: Feld ${field} fehlt`);
    for(const key of required) assert.ok(Object.hasOwn(doc.sections,key),`${doc.number}: Abschnitt ${key} fehlt`);
    assert.equal(doc.version,'1.0');
    assert.equal(doc.status,'Entwurf');
    assert.ok(doc.sections.steps.length>=4,`${doc.number}: Ablauf zu kurz`);
  }
});

test('alte allgemeine SOP-Nummern sind aus dem aktiven Katalog entfernt',()=>{
  const text=JSON.stringify(catalog.documents);
  assert.doesNotMatch(text,/SOP-(QM|SYS|LOG|WH|ORG)-\d{3}/);
});

test('externe Tätigkeiten werden ausschließlich als SOP-EXT-Verweis geführt',()=>{
  assert.match(JSON.stringify(catalog.documents),/Weitere Durchführung siehe SOP-EXT-/);
  assert.equal(catalog.documents.some(doc=>doc.number.startsWith('SOP-EXT-')),false);
});
