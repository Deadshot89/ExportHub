import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1007-sop-ui.js');
const model=globalThis.ExportHubIsoSopModel;
const catalog=globalThis.ExportHubIsoSopCatalog;
const ui=globalThis.ExportHubIsoSopUi;

function seeded(number='SOP-QM-001'){
  const doc=catalog.documents.find(item=>item.number===number);
  return model.seedState({},[doc]).isoSops[0];
}

test('jede Workflow-Aktion erzeugt einen nachvollziehbaren Audit-Eintrag',()=>{
  let doc=seeded();
  assert.ok(Array.isArray(doc.auditTrail));
  assert.equal(doc.auditTrail[0].action,'Erstellt');
  doc=model.submitForReview(doc,{version:'1.0',actor:'Prüfer'});
  assert.equal(doc.auditTrail.at(-1).action,'Zur Prüfung eingereicht');
  doc=model.approveVersion(doc,{version:'1.0',actor:'Freigeber',reviewedBy:'Prüfer',validFrom:'2026-09-08'});
  assert.equal(doc.auditTrail.at(-1).action,'Freigegeben');
  assert.equal(doc.auditTrail.at(-1).actor,'Freigeber');
});

test('Änderung einer freigegebenen SOP erzeugt neue Entwurfsfassung und erhält Historie',()=>{
  let doc=seeded();
  doc=model.submitForReview(doc,{version:'1.0',actor:'Prüfer'});
  doc=model.approveVersion(doc,{version:'1.0',actor:'Freigeber',reviewedBy:'Prüfer'});
  doc=model.createDraftVersion(doc,{version:'1.1',actor:'Bearbeiter',reason:'Prozess angepasst'});
  assert.equal(doc.versions.length,2);
  assert.equal(doc.versions[0].status,'Freigegeben');
  assert.equal(doc.versions[1].status,'Entwurf');
  assert.equal(doc.auditTrail.at(-1).action,'Neue Fassung erstellt');
  assert.equal(doc.auditTrail.at(-1).version,'1.1');
});

test('offene Pflicht-Bildplatzhalter werden als unvollständig markiert',()=>{
  const doc=seeded('SOP-LOG-011');
  const release=model.validateRelease({number:doc.number,title:doc.title,version:'1.0',approvedBy:'Freigeber',visuals:doc.versions[0].visuals});
  assert.equal(release.ok,true);
  assert.ok(release.warnings.includes('Pflicht-Bildplatzhalter offen'));
  assert.equal(model.completeness(doc).complete,false);
});

test('UI kann Workflow-Aktionen über das Modell ausführen',()=>{
  let doc=seeded();
  doc=ui.applyWorkflowAction(doc,'review',{version:'1.0',actor:'Prüfer'});
  assert.equal(doc.versions[0].status,'In Prüfung');
  doc=ui.applyWorkflowAction(doc,'approve',{version:'1.0',actor:'Freigeber',reviewedBy:'Prüfer'});
  assert.equal(doc.versions[0].status,'Freigegeben');
});
