import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1007-sop-model.js');
const model=globalThis.ExportHubIsoSopModel;

test('freigegebene Version wird beim Bearbeiten nicht überschrieben',()=>{
  const source={id:'SOP-LOG-011',number:'SOP-LOG-011',currentVersion:'1.0',versions:[{version:'1.0',status:'Freigegeben',title:'QR-Abholung',content:{steps:['Alt']}}]};
  const next=model.createDraftVersion(source,{version:'1.1',actor:'Admin',reason:'Ablauf geändert'});
  assert.equal(source.versions[0].content.steps[0],'Alt');
  assert.equal(next.versions.length,2);
  assert.equal(next.versions[0].status,'Freigegeben');
  assert.equal(next.versions[1].status,'Entwurf');
  assert.equal(next.versions[1].content.steps[0],'Alt');
});

test('Freigabe scheitert bei fehlender Pflichtangabe',()=>{
  const result=model.validateRelease({number:'',title:'Test',version:'1.0',approvedBy:'Admin'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('SOP-Nummer fehlt'));
});

test('direkter Übergang vom Entwurf zur Freigabe ist gesperrt',()=>{
  const source={number:'SOP-QM-001',title:'Dokumentenlenkung',currentVersion:'1.0',versions:[{version:'1.0',status:'Entwurf',title:'Dokumentenlenkung'}]};
  assert.throws(()=>model.approveVersion(source,{version:'1.0',actor:'Admin'}),/Nur geprüfte Fassungen/);
});

test('Prüfung und Freigabe archivieren die vorherige gültige Version',()=>{
  const source={number:'SOP-QM-001',title:'Dokumentenlenkung',currentVersion:'1.0',versions:[
    {version:'1.0',status:'Freigegeben',title:'Dokumentenlenkung',approvedBy:'Admin'},
    {version:'1.1',status:'Entwurf',title:'Dokumentenlenkung'}
  ],draftVersion:'1.1'};
  const review=model.submitForReview(source,{version:'1.1',actor:'Prüfer'});
  const approved=model.approveVersion(review,{version:'1.1',actor:'Freigeber',reviewedBy:'Prüfer',validFrom:'2026-09-08'});
  assert.equal(approved.currentVersion,'1.1');
  assert.equal(approved.versions[0].status,'Archiviert');
  assert.equal(approved.versions[1].status,'Freigegeben');
  assert.equal(approved.versions[1].validFrom,'2026-09-08');
});

test('Seed legt ISO-SOPs getrennt an und erhält bestehende Fassungen',()=>{
  const existing={isoSops:[{id:'SOP-QM-001',number:'SOP-QM-001',title:'Bestand'}],customSops:[{id:'ALT-1',name:'Alt'}]};
  const next=model.seedState(existing,[{id:'SOP-QM-001',number:'SOP-QM-001',title:'Seed'},{id:'SOP-QM-002',number:'SOP-QM-002',title:'Neu',version:'1.0',status:'Entwurf'}]);
  assert.equal(next.isoSops.length,2);
  assert.equal(next.isoSops[0].title,'Bestand');
  assert.equal(next.customSops.length,1);
});

test('Filter sucht Nummer Titel Stichwort Bereich und Status',()=>{
  const docs=[
    {number:'SOP-LOG-011',title:'QR-Abholung',area:'Versand und Export',keywords:['PIN'],status:'Entwurf'},
    {number:'SOP-QM-001',title:'Dokumentenlenkung',area:'Qualitätsmanagement',keywords:['Version'],status:'Freigegeben'}
  ];
  assert.equal(model.filterDocuments(docs,{query:'pin'}).length,1);
  assert.equal(model.filterDocuments(docs,{area:'Qualitätsmanagement'}).length,1);
  assert.equal(model.filterDocuments(docs,{status:'Freigegeben'}).length,1);
});
