import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../assets/sop/rc1007-sop-model.js');
await import('../assets/sop/rc1007-sop-catalog.js');
await import('../assets/sop/rc1010-sop-release.js');
await import('../assets/sop/rc1016-sop-consolidation.js');

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

test('RC1018: SOP-Systembilder werden aus der echten Demo-Oberfläche erzeugt und nicht künstlich gebaut',()=>{
  assert.ok(fs.existsSync('browser/rc1018-sop-screenshots.mjs'),'Browser-Screenshotlauf fehlt');
  const source=fs.readFileSync('browser/rc1018-sop-screenshots.mjs','utf8');
  assert.match(source,/playwright|chromium/i);
  assert.match(source,/demo\.html/);
  for(const file of Object.values(expected))assert.match(source,new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(source,/data:image\/svg\+xml/i);
});
