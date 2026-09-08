import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1010-sop-release.js');
await import('../assets/sop/rc1007-sop-ui.js');

const model=globalThis.ExportHubIsoSopModel;
const catalog=globalThis.ExportHubIsoSopCatalog;
const ui=globalThis.ExportHubIsoSopUi;

function legacySystemDraft(doc){
  return {
    ...doc,
    status:'Entwurf',
    validFrom:'',
    reviewedBy:'',
    approvedBy:'',
    nextReview:'',
    currentVersion:'1.0',
    draftVersion:'1.0',
    createdBy:'ExportHUB – RC1008 SOP-Ersterstellung',
    changeReason:'RC1008 – Umstellung auf reine ExportHUB-Systemprozesse',
    versions:[{
      version:'1.0',
      status:'Entwurf',
      title:doc.title,
      content:doc.sections,
      visuals:doc.visuals,
      createdBy:'ExportHUB – RC1008 SOP-Ersterstellung',
      createdAt:'2026-09-08T12:00:00.000Z',
      changeReason:'Ersterstellung'
    }],
    auditTrail:[{action:'Erstellt',version:'1.0',actor:'ExportHUB – RC1008 SOP-Ersterstellung',at:'2026-09-08T12:00:00.000Z',reason:'Ersterstellung'}]
  };
}

test('RC1010 liefert alle 75 System-SOPs als freigegebene gelenkte Arbeitsanweisungen aus',()=>{
  assert.equal(catalog.version,'RC1010');
  assert.equal(catalog.documents.length,75);
  for(const doc of catalog.documents){
    assert.equal(doc.status,'Freigegeben',`${doc.number}: nicht freigegeben`);
    assert.equal(doc.version,'1.0',`${doc.number}: falsche Basisversion`);
    assert.match(String(doc.validFrom||''),/^\d{4}-\d{2}-\d{2}$/,`${doc.number}: Gültig-ab fehlt`);
    assert.ok(String(doc.reviewedBy||'').trim(),`${doc.number}: Prüfer fehlt`);
    assert.ok(String(doc.approvedBy||'').trim(),`${doc.number}: Freigeber fehlt`);
    assert.match(String(doc.nextReview||''),/^\d{4}-\d{2}-\d{2}$/,`${doc.number}: nächste Prüfung fehlt`);
    assert.equal(model.currentVersionRecord(doc).status,'Freigegeben',`${doc.number}: aktuelle Fassung nicht freigegeben`);
  }
});

test('normaler Lesebenutzer kann den vollständigen freigegebenen 75er-Katalog auswählen',()=>{
  const html=ui.renderOverview({documents:catalog.documents,rights:{read:true}});
  const buttons=[...html.matchAll(/data-sop-open="(SOP-EH-\d{3})"/g)].map(m=>m[1]);
  assert.equal(buttons.length,75);
  assert.equal(new Set(buttons).size,75);
});

test('RC1008-Systementwürfe werden auf die freigegebene RC1010-Basis migriert',()=>{
  const canonical=catalog.documents[0];
  const stored=[legacySystemDraft(canonical)];
  const migrated=model.reconcileCatalog(stored,[canonical])[0];
  const current=model.currentVersionRecord(migrated);
  assert.equal(migrated.status,'Freigegeben');
  assert.equal(migrated.currentVersion,'1.0');
  assert.equal(migrated.draftVersion,'');
  assert.equal(current.status,'Freigegeben');
  assert.ok(String(current.approvedBy||'').trim());
  assert.equal(stored[0].status,'Freigegeben');
});

test('echte spätere Benutzerfassungen bleiben bei der Katalogmigration erhalten',()=>{
  const canonical=catalog.documents[0];
  const existing={
    ...legacySystemDraft(canonical),
    status:'Freigegeben',
    currentVersion:'1.0',
    draftVersion:'1.1',
    versions:[
      {version:'1.0',status:'Freigegeben',title:canonical.title,content:canonical.sections,visuals:canonical.visuals,approvedBy:'Qualitätsverantwortlicher'},
      {version:'1.1',status:'Entwurf',title:canonical.title,content:{...canonical.sections,purpose:'Manuell geänderter Zweck'},visuals:canonical.visuals,createdBy:'Firmen-Admin',changeReason:'Fachliche Änderung'}
    ],
    auditTrail:[
      {action:'Freigegeben',version:'1.0',actor:'Qualitätsverantwortlicher',at:'2026-09-08T14:00:00.000Z'},
      {action:'Neue Fassung erstellt',version:'1.1',actor:'Firmen-Admin',at:'2026-09-08T15:00:00.000Z'}
    ]
  };
  const migrated=model.reconcileCatalog([existing],[canonical])[0];
  assert.equal(migrated.versions.length,2);
  assert.equal(migrated.draftVersion,'1.1');
  assert.equal(migrated.versions[1].content.purpose,'Manuell geänderter Zweck');
});
