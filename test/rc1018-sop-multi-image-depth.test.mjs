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
const model=globalThis.ExportHubIsoSopModel;
const targets=['SOP-EH-020','SOP-EH-040','SOP-EH-080','SOP-EH-100','SOP-EH-105','SOP-EH-114'];

function fileOf(src){return String(src||'').replace(/^\//,'');}
function hashOf(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function pngImages(visuals){return (visuals||[]).filter(v=>v&&v.type==='screenshot'&&/^\/assets\/sop\/screenshots\/.+\.png$/i.test(String(v.src||'')));}

test('RC1018: freigegebene Versionsfassung trägt dieselben PNG-Systembilder wie das aktive Dokument',()=>{
  for(const doc of catalog.documents){
    const current=model.currentVersionRecord(doc);
    assert.ok(current,`${doc.number}: aktuelle Versionsfassung fehlt`);
    const documentSources=pngImages(doc.visuals).map(v=>String(v.src));
    const versionSources=new Set(pngImages(current.visuals).map(v=>String(v.src)));
    for(const src of documentSources)assert.ok(versionSources.has(src),`${doc.number}: freigegebene Version enthält das aktive Systembild nicht: ${src}`);
  }
});

test('RC1018: komplexe SOPs besitzen mindestens drei unterschiedliche echte PNG-Systembilder',()=>{
  for(const number of targets){
    const doc=catalog.get(number);
    assert.ok(doc,`${number}: SOP fehlt`);
    const images=pngImages(doc.visuals);
    assert.ok(images.length>=3,`${number}: mindestens drei echte PNG-Systembilder erforderlich, gefunden ${images.length}`);
    const sources=images.map(v=>String(v.src));
    assert.equal(new Set(sources).size,sources.length,`${number}: Bildquellen müssen eindeutig sein`);
    const files=sources.map(fileOf);
    for(const file of files)assert.ok(fs.existsSync(file),`${number}: Bilddatei fehlt: ${file}`);
    const hashes=files.map(hashOf);
    assert.equal(new Set(hashes).size,hashes.length,`${number}: Bildinhalte müssen innerhalb der SOP eigenständig sein`);
    const steps=new Set((doc.sections?.steps||[]).map(step=>String(step?.id||'')));
    for(const visual of images){
      assert.ok(String(visual.stepId||'').trim(),`${number}: stepId fehlt`);
      assert.ok(steps.has(String(visual.stepId)),`${number}: Bild ist keinem echten Arbeitsschritt zugeordnet: ${visual.stepId}`);
      assert.ok(String(visual.caption||'').trim(),`${number}: Bildbeschriftung fehlt`);
    }
  }
});
