import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1010-sop-release.js');
await import('../assets/sop/rc1016-sop-consolidation.js');

const catalog=globalThis.ExportHubIsoSopCatalog;
const model=globalThis.ExportHubIsoSopModel;

test('RC1016 zeigt 24 vollständige Arbeitsabläufe und bewahrt 75 historische SOPs',()=>{
  assert.equal(catalog.version,'RC1016');
  assert.equal(catalog.documents.length,24);
  assert.equal(catalog.legacyDocuments.length,75);
  const covered=catalog.documents.flatMap(doc=>doc.combinedFrom||[]);
  assert.equal(covered.length,75);
  assert.equal(new Set(covered).size,75,'jede historische SOP darf nur in einem Arbeitsablauf aufgehen');
  assert.deepEqual(new Set(covered),new Set(catalog.legacyDocuments.map(doc=>doc.number)));
});

test('jede aktive RC1016-SOP ist gelenkte Version 2.0 mit vollständiger Pflichtstruktur',()=>{
  const required=['purpose','scope','definitions','responsibilities','prerequisites','resources','steps','checks','deviations','records','metrics','relatedDocuments','references','changeHistory'];
  for(const doc of catalog.documents){
    assert.equal(doc.version,'2.0',doc.number);
    assert.equal(doc.currentVersion,'2.0',doc.number);
    assert.equal(doc.status,'Freigegeben',doc.number);
    assert.ok(Array.isArray(doc.combinedFrom)&&doc.combinedFrom.length>=1,`${doc.number}: combinedFrom fehlt`);
    for(const key of required)assert.ok(Object.hasOwn(doc.sections,key),`${doc.number}: Pflichtabschnitt ${key} fehlt`);
    assert.ok(Array.isArray(doc.sections.steps)&&doc.sections.steps.length>=1,`${doc.number}: keine Arbeitsschritte`);
    assert.ok(Array.isArray(doc.processFlow)&&doc.processFlow.length>=1,`${doc.number}: Prozessübersicht fehlt`);
  }
});

test('aktive SOPs verwenden keine künstlichen Data-URI-Screenshots mehr',()=>{
  const screenshots=catalog.documents.flatMap(doc=>(doc.visuals||[]).filter(v=>v&&v.type==='screenshot'));
  assert.ok(screenshots.length>=3,'mindestens Aufgaben, Sendungsübersicht und Abholkalender brauchen echte Systembilder');
  for(const image of screenshots){
    assert.doesNotMatch(String(image.src||''),/^data:image\/svg\+xml/i);
    assert.match(String(image.src||''),/^\/assets\/sop\/screenshots\/rc1016-.*\.png$/);
  }
  const task=catalog.get('SOP-EH-090');
  const calendar=catalog.get('SOP-EH-095');
  assert.ok(task.visuals.some(v=>v.type==='screenshot'&&/tasks\.png$/.test(v.src)),'Aufgaben-Screenshot fehlt');
  assert.ok(calendar.visuals.some(v=>v.type==='screenshot'&&/pickupcalendar\.png$/.test(v.src)),'Kalender-Screenshot fehlt');
});

test('Reconcile erhält historische Versionen und setzt die kanonische 2.0-Fassung als aktuell',()=>{
  const canonical=catalog.get('SOP-EH-090');
  const stored={...canonical,version:'1.1',currentVersion:'1.1',status:'Entwurf',versions:[
    {version:'1.0',status:'Freigegeben',title:'Alt',content:{steps:[{id:'old-1',text:'Alt'}]},visuals:[]},
    {version:'1.1',status:'Entwurf',title:'Zwischenfassung',content:{steps:[{id:'old-2',text:'Zwischenfassung'}]},visuals:[]}
  ],auditTrail:[{action:'Erstellt',version:'1.1',actor:'Admin',at:'2026-09-09T00:00:00Z',reason:'Test'}]};
  const [next]=model.reconcileCatalog([stored],[canonical]);
  assert.ok(next.versions.some(v=>v.version==='1.0'));
  assert.ok(next.versions.some(v=>v.version==='1.1'));
  assert.ok(next.versions.some(v=>v.version==='2.0'));
  assert.equal(next.currentVersion,'2.0');
  assert.equal(next.status,'Freigegeben');
});

test('geplante echte Screenshot-Dateien sind als reale PNG-Dateien versioniert',()=>{
  for(const file of [
    'assets/sop/screenshots/rc1016-tasks.png',
    'assets/sop/screenshots/rc1016-shipmentoverview.png',
    'assets/sop/screenshots/rc1016-pickupcalendar.png'
  ])assert.ok(fs.existsSync(file),`${file} fehlt`);
});
