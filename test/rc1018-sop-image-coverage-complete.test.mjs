import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

await import('../assets/sop/rc1500-sop-step-contract.js');
await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1010-sop-release.js');
await import('../assets/sop/rc1016-sop-consolidation.js');
await import('../assets/sop/rc1018-sop-system-images.js');
await import('../assets/sop/rc1502-sop-visuals.js');

const catalog=globalThis.ExportHubIsoSopCatalog;
const model=globalThis.ExportHubIsoSopModel;
const visuals=globalThis.ExportHubSopVisuals;
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}

test('RC1018: alle 24 konsolidierten SOPs besitzen ein eigenes echtes Systembild',()=>{
  assert.equal(catalog.documents.length,24,'erwartet werden 24 konsolidierte SOPs');
  const missing=[];
  const sources=[];
  const hashes=[];
  for(const doc of catalog.documents){
    const image=(doc.visuals||[]).find(v=>v&&v.type==='screenshot'&&/^\/assets\/sop\/screenshots\/.+\.png$/i.test(String(v.src||'')));
    if(!image){missing.push(doc.number);continue;}
    const src=String(image.src);
    const file=src.replace(/^\//,'');
    sources.push(src);
    if(!fs.existsSync(file)){missing.push(`${doc.number} (${src})`);continue;}
    hashes.push(sha256(file));
  }
  assert.deepEqual(missing,[],`SOPs ohne echtes Systembild: ${missing.join(', ')}`);
  assert.equal(new Set(sources).size,24,'jede konsolidierte SOP benötigt einen eigenen Systemausschnitt');
  assert.equal(new Set(hashes).size,24,'jede konsolidierte SOP benötigt auch einen eigenständigen Bildinhalt');
});

test('SOPMaster-Normalisierung erhält sämtliche RC1018-Screenshot-Zuordnungen exakt',()=>{
  for(const doc of catalog.documents){
    const before=(doc.visuals||[]).filter(v=>v&&v.type==='screenshot').map(v=>`${v.stepId||''}|${v.src||''}|${v.caption||''}`);
    const view=model.normalizeDocument(doc);
    const after=(view.visuals||[]).filter(v=>v&&v.type==='screenshot').map(v=>`${v.stepId||''}|${v.src||''}|${v.caption||''}`);
    assert.deepEqual(after,before,`${doc.number}: Screenshot-Mapping verändert`);
  }
});

test('RC1502 Visual-Editor akzeptiert alle 24 RC1018 Bilder mit identischen Quellen stepIds und Binärhashes',()=>{
  assert.ok(visuals,'RC1502 Visual-Vertrag fehlt');
  for(const doc of catalog.documents){
    const images=(doc.visuals||[]).filter(v=>v&&v.type==='screenshot');
    assert.ok(images.length>0,`${doc.number}: Screenshot fehlt`);
    for(const image of images){
      const file=String(image.src||'').replace(/^\//,'');
      assert.ok(fs.existsSync(file),`${doc.number}: ${file} fehlt`);
      const hashBefore=sha256(file);
      const normalized=visuals.normalize(image);
      assert.equal(normalized.src,image.src,`${doc.number}: Bildquelle verändert`);
      assert.equal(normalized.stepId,image.stepId,`${doc.number}: stepId verändert`);
      assert.equal(sha256(file),hashBefore,`${doc.number}: Bildhash verändert`);
    }
  }
});
