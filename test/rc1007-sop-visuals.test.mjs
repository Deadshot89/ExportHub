import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1007-sop-catalog.js');
const catalog=globalThis.ExportHubIsoSopCatalog;

const allowed=new Set(['process','screenshot']);

test('jede System-SOP besitzt Prozessgrafik und selbst erzeugtes ExportHUB-Systembild',()=>{
  for(const doc of catalog.documents){
    assert.ok(Array.isArray(doc.processFlow)&&doc.processFlow.length>=3,`${doc.number}: Prozessablauf fehlt`);
    assert.ok(Array.isArray(doc.visuals)&&doc.visuals.length>=2,`${doc.number}: Visuals unvollständig`);
    assert.ok(doc.visuals.some(v=>v.type==='process'),`${doc.number}: Prozessgrafik fehlt`);
    assert.ok(doc.visuals.some(v=>v.type==='screenshot'&&String(v.src||'').startsWith('data:image/svg+xml')),`${doc.number}: Systembild fehlt`);
    assert.equal(doc.visuals.some(v=>v.type==='placeholder'),false,`${doc.number}: Bildplatzhalter vorhanden`);
    for(const visual of doc.visuals){
      assert.ok(allowed.has(visual.type),`${doc.number}: unbekannter Visual-Typ ${visual.type}`);
      assert.ok(String(visual.stepId||'').trim(),`${doc.number}: stepId fehlt`);
      assert.ok(String(visual.caption||'').trim(),`${doc.number}: Bildbeschriftung fehlt`);
    }
  }
});

test('QR-Abholung ist als echter Systemablauf mit QR, PIN, Colli und Abschluss dokumentiert',()=>{
  const qr=[catalog.get('SOP-EH-070'),catalog.get('SOP-EH-071'),catalog.get('SOP-EH-072'),catalog.get('SOP-EH-073')];
  assert.ok(qr.every(Boolean));
  const text=JSON.stringify(qr);
  for(const term of ['QR','PIN','Colli','Abholung','Status']) assert.match(text,new RegExp(term,'i'));
});
