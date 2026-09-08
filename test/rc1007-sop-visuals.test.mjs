import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1007-sop-catalog.js');
const catalog=globalThis.ExportHubIsoSopCatalog;

const allowed=new Set(['process','screenshot','placeholder']);

test('jede SOP besitzt Prozessgrafik und mindestens eine schrittgebundene Bildstelle',()=>{
  for(const doc of catalog.documents){
    assert.ok(Array.isArray(doc.processFlow)&&doc.processFlow.length>=3,`${doc.number}: Prozessablauf fehlt`);
    assert.ok(Array.isArray(doc.visuals)&&doc.visuals.length>=2,`${doc.number}: Visuals unvollständig`);
    assert.ok(doc.visuals.some(v=>v.type==='process'),`${doc.number}: Prozessgrafik fehlt`);
    assert.ok(doc.visuals.some(v=>/step-\d+/.test(String(v.stepId||''))),`${doc.number}: schrittgebundenes Bild fehlt`);
    for(const visual of doc.visuals){
      assert.ok(allowed.has(visual.type),`${doc.number}: unbekannter Visual-Typ ${visual.type}`);
      assert.ok(String(visual.stepId||'').trim(),`${doc.number}: stepId fehlt`);
      assert.ok(String(visual.caption||'').trim(),`${doc.number}: Bildbeschriftung fehlt`);
    }
  }
});

test('fehlende Originalbilder sind ausdrücklich als offen gekennzeichnet',()=>{
  for(const doc of catalog.documents){
    for(const visual of doc.visuals.filter(v=>v.type==='placeholder')){
      assert.match(visual.caption,/Bild noch zu erstellen:/,`${doc.number}: Platzhalter nicht eindeutig`);
    }
  }
});

test('SOP-LOG-011 besitzt Bildstellen für QR, Abholseite, PIN, Colli und Abschluss',()=>{
  const doc=catalog.documents.find(item=>item.number==='SOP-LOG-011');
  assert.ok(doc,'SOP-LOG-011 fehlt');
  const captions=doc.visuals.map(v=>v.caption).join(' | ');
  for(const term of ['QR','Abholseite','PIN','Colli','Abschluss']) assert.match(captions,new RegExp(term,'i'),`SOP-LOG-011: ${term} fehlt`);
  const stepIds=new Set(doc.visuals.filter(v=>v.type!=='process').map(v=>v.stepId));
  assert.ok(stepIds.size>=5,'SOP-LOG-011: Bildstellen sind nicht auf mindestens fünf konkrete Schritte verteilt');
});
