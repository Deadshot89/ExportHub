import test from 'node:test';
import assert from 'node:assert/strict';

await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
const model=globalThis.ExportHubIsoSopModel;

test('normalizeDocument liefert eine erweiterte Clone-Ansicht und bewahrt Historie byte-äquivalent',()=>{
  const source={
    number:'SOP-EH-900',title:'Legacy',version:'1.1',currentVersion:'1.1',status:'Freigegeben',
    sections:{steps:[{id:'legacy-1',text:'Alt-Schritt'}]},
    versions:[{version:'1.0',status:'Archiviert',content:{steps:[{id:'old',text:'Alt'}]}},{version:'1.1',status:'Freigegeben',content:{steps:[{id:'legacy-1',text:'Alt-Schritt'}]}}],
    auditTrail:[{action:'Erstellt',version:'1.0',actor:'A',at:'2026-01-01T00:00:00Z',reason:'Start'}]
  };
  const versionsBefore=JSON.stringify(source.versions);
  const auditBefore=JSON.stringify(source.auditTrail);
  const normalized=model.normalizeDocument(source);
  assert.notEqual(normalized,source);
  assert.equal(JSON.stringify(source.versions),versionsBefore);
  assert.equal(JSON.stringify(source.auditTrail),auditBefore);
  assert.equal(JSON.stringify(normalized.versions),versionsBefore);
  assert.equal(JSON.stringify(normalized.auditTrail),auditBefore);
  assert.equal(normalized.type,'process');
  assert.deepEqual(normalized.overlays,[]);
  assert.deepEqual(normalized.tourConfig,{enabled:false});
  assert.deepEqual(normalized.trainingConfig,{enabled:false});
  assert.deepEqual(normalized.examConfig,{enabled:false});
  assert.equal(normalized.steps[0].instruction,'Alt-Schritt');
});

test('validateRelease lehnt doppelte Step-IDs ab',()=>{
  const result=model.validateRelease({
    number:'SOP-EH-900',title:'Duplikat',version:'1.0',approvedBy:'Admin',
    steps:[{id:'dup',text:'A'},{id:'dup',text:'B'}]
  });
  assert.equal(result.ok,false);
  assert.ok(result.errors.some(error=>/Step-ID doppelt/i.test(error)));
});

test('approveVersion blockiert doppelte Step-IDs aus dem freizugebenden Versionsinhalt',()=>{
  const doc={
    number:'SOP-EH-901',title:'Duplikat',version:'1.0',currentVersion:'1.0',status:'In Prüfung',
    versions:[{version:'1.0',status:'In Prüfung',title:'Duplikat',content:{steps:[{id:'dup',text:'A'},{id:'dup',text:'B'}]},visuals:[]}],auditTrail:[]
  };
  assert.throws(()=>model.approveVersion(doc,{version:'1.0',actor:'Admin'}),/Step-ID doppelt/);
});

test('normalizeDocument respektiert eine explizit leere aktuelle Step-Liste statt auf alte Root-Schritte zurückzufallen',()=>{
  const source={
    number:'SOP-EH-902',title:'Leerer Entwurf',version:'2.0',currentVersion:'2.0',status:'Entwurf',
    sections:{steps:[{id:'legacy-root',text:'Veralteter Root-Schritt'}]},
    versions:[{version:'2.0',status:'Entwurf',title:'Leerer Entwurf',content:{steps:[]},visuals:[]}],auditTrail:[]
  };
  const normalized=model.normalizeDocument(source);
  assert.deepEqual(normalized.steps,[]);
});
