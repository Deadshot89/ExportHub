import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

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
const expected={
  'SOP-EH-031':'rc1018-shipment-create.png',
  'SOP-EH-034':'rc1018-stowplan.png',
  'SOP-EH-052':'rc1018-documents-cmr.png',
  'SOP-EH-060':'rc1018-abd.png',
  'SOP-EH-070':'rc1018-qr-pickup.png',
  'SOP-EH-076':'rc1018-lieferavis.png',
  'SOP-EH-080':'rc1018-pallet-account.png',
  'SOP-EH-112':'rc1018-diagnostics.png',
  'SOP-EH-114':'rc1018-release-center.png'
};
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}

test('RC1018: neun zusätzliche Kern-SOPs besitzen echte Demo-Systembilder',()=>{
  assert.equal(catalog.sopImageRelease,'RC1018');
  for(const [number,file] of Object.entries(expected)){
    const doc=catalog.get(number);
    assert.ok(doc,`${number} fehlt`);
    const image=(doc.visuals||[]).find(v=>v&&v.type==='screenshot'&&String(v.src||'').endsWith('/'+file));
    assert.ok(image,`${number}: Systembild ${file} fehlt`);
    assert.match(String(image.src),/^\/assets\/sop\/screenshots\/rc1018-[a-z0-9-]+\.png$/);
    assert.doesNotMatch(String(image.src),/^data:/i);
    assert.ok(fs.existsSync(`assets/sop/screenshots/${file}`),`${file}: PNG fehlt im Repository`);
  }
});

test('RC1018: jede der neun SOP-Aufnahmen zeigt einen eigenständigen Systemausschnitt',()=>{
  const hashes=[];
  for(const file of Object.values(expected))hashes.push(sha256(`assets/sop/screenshots/${file}`));
  assert.equal(new Set(hashes).size,hashes.length,'mindestens zwei SOP-Bilder sind identisch und zeigen keinen eigenständigen Bereich');
});

test('RC1502 akzeptiert alle bestehenden RC1018 Kernbilder unverändert als gültige Visual-Eingaben',()=>{
  assert.ok(visuals,'RC1502 Visual-Vertrag fehlt');
  for(const [number,file] of Object.entries(expected)){
    const doc=catalog.get(number);
    const before=(doc.visuals||[]).find(v=>v&&v.type==='screenshot'&&String(v.src||'').endsWith('/'+file));
    assert.ok(before,`${number}: RC1018 Mapping fehlt`);
    const filePath=`assets/sop/screenshots/${file}`;
    const hashBefore=sha256(filePath);
    const view=model.normalizeDocument(doc);
    const after=(view.visuals||[]).find(v=>v&&v.type==='screenshot'&&String(v.src||'').endsWith('/'+file));
    assert.deepEqual(after,before,`${number}: RC1018 Mapping wurde durch SOPMaster-Normalisierung verändert`);
    const normalized=visuals.normalize(before);
    assert.equal(normalized.src,before.src,`${number}: RC1502 hat die Bildquelle umgeschrieben`);
    assert.equal(normalized.stepId,before.stepId,`${number}: RC1502 hat die stepId umgeschrieben`);
    assert.equal(sha256(filePath),hashBefore,`${number}: RC1018 Bildhash wurde verändert`);
  }
});

test('RC1018: SOP-Systembilder werden aus der echten Demo-Oberfläche erzeugt und nicht künstlich gebaut',()=>{
  assert.ok(fs.existsSync('browser/rc1018-sop-screenshots.mjs'),'Browser-Screenshotlauf fehlt');
  const source=fs.readFileSync('browser/rc1018-sop-screenshots.mjs','utf8');
  assert.match(source,/playwright|chromium/i);
  assert.match(source,/demo\.html/);
  for(const file of Object.values(expected))assert.match(source,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(source,/data:image\/svg\+xml/i);
});

test('RC1018: historischer SOP-Bildlayer bleibt als Herkunftsnachweis definiert',()=>{
  const build=fs.readFileSync('.github/rc1018/build-three-env.mjs','utf8');
  assert.match(build,/rc1018-sop-system-images\.js/);
  assert.match(build,/exporthub-rc1018-sop-system-images/);
  assert.match(build,/assets\/sop\/rc1018-sop-system-images\.js/);
});

test('RC1018: alle neun historischen Systembilder werden im aktuellen RC1502 Build in Produktion TESTSERVICE und Demo ausgeliefert',()=>{
  execFileSync(process.execPath,['.github/rc1502/build-three-env.mjs'],{cwd:process.cwd(),stdio:'pipe'});
  const out=path.join(process.cwd(),'dist-rc1112');
  for(const htmlFile of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(path.join(out,htmlFile),'utf8');
    assert.match(html,/id=["']exporthub-rc1018-sop-system-images["']/i,`${htmlFile}: historischer RC1018 SOP-Bildlayer fehlt im aktuellen Build`);
    assert.match(html,/id=["']exporthub-rc1502-sop-visuals["']/i,`${htmlFile}: RC1502 Visual-Layer fehlt im aktuellen Build`);
  }
  for(const file of Object.values(expected))assert.ok(fs.existsSync(path.join(out,'assets/sop/screenshots',file)),`aktueller RC1502 Build: ${file} fehlt`);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'rc1502-sop-editor-manifest.json'),'utf8'));
  assert.equal(manifest.version,'RC1502');
});
