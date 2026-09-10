import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1010-sop-release.js');
await import('../assets/sop/rc1016-sop-consolidation.js');
await import('../assets/sop/rc1018-sop-system-images.js');

const catalog=globalThis.ExportHubIsoSopCatalog;

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
    hashes.push(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  }
  assert.deepEqual(missing,[],`SOPs ohne echtes Systembild: ${missing.join(', ')}`);
  assert.equal(new Set(sources).size,24,'jede konsolidierte SOP benötigt einen eigenen Systemausschnitt');
  assert.equal(new Set(hashes).size,24,'jede konsolidierte SOP benötigt auch einen eigenständigen Bildinhalt');
});
