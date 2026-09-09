import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1010-sop-release.js');
await import('../assets/sop/rc1016-sop-consolidation.js');
await import('../assets/sop/rc1018-sop-system-images.js');

const catalog=globalThis.ExportHubIsoSopCatalog;
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
  for(const file of Object.values(expected)){
    const data=fs.readFileSync(`assets/sop/screenshots/${file}`);
    hashes.push(crypto.createHash('sha256').update(data).digest('hex'));
  }
  assert.equal(new Set(hashes).size,hashes.length,'mindestens zwei SOP-Bilder sind identisch und zeigen keinen eigenständigen Bereich');
});

test('RC1018: SOP-Systembilder werden aus der echten Demo-Oberfläche erzeugt und nicht künstlich gebaut',()=>{
  assert.ok(fs.existsSync('browser/rc1018-sop-screenshots.mjs'),'Browser-Screenshotlauf fehlt');
  const source=fs.readFileSync('browser/rc1018-sop-screenshots.mjs','utf8');
  assert.match(source,/playwright|chromium/i);
  assert.match(source,/demo\.html/);
  for(const file of Object.values(expected))assert.match(source,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(source,/data:image\/svg\+xml/i);
});

test('RC1018: SOP-Bildlayer wird im gemeinsamen Drei-Umgebungen-Build geladen',()=>{
  const build=fs.readFileSync('.github/rc1018/build-three-env.mjs','utf8');
  assert.match(build,/rc1018-sop-system-images\.js/);
  assert.match(build,/exporthub-rc1018-sop-system-images/);
  assert.match(build,/assets\/sop\/rc1018-sop-system-images\.js/);
});

test('RC1018: alle neun SOP-Systembilder werden real in Produktion TESTSERVICE und Demo ausgeliefert',()=>{
  execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{cwd:process.cwd(),stdio:'pipe'});
  const out=path.join(process.cwd(),'dist-rc1018');
  for(const htmlFile of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(path.join(out,htmlFile),'utf8');
    assert.match(html,/id=["']exporthub-rc1018-sop-system-images["']/i,`${htmlFile}: SOP-Bildlayer fehlt`);
  }
  for(const file of Object.values(expected))assert.ok(fs.existsSync(path.join(out,'assets/sop/screenshots',file)),`dist-rc1018: ${file} fehlt`);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'rc1018-manifest.json'),'utf8'));
  assert.equal(manifest.sop?.systemImages,'assets/sop/rc1018-sop-system-images.js');
});
