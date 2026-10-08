import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {injectPackRuntime,copyPackFiles,PACK_ASSETS} from '../.github/packmeldungen/build-three-env.mjs';

test('runtime injection is idempotent and ordered after existing document head',()=>{
  const base='<!doctype html><html><head><title>ExportHUB360</title></head><body><main id="content"></main></body></html>';
  const once=injectPackRuntime(base,'index.html');
  const twice=injectPackRuntime(once,'index.html');
  assert.equal(once,twice);
  assert.match(once,/pack-notification-internal\.css\?v=1/);
  assert.match(once,/pack-notification-avis\.css\?v=1/);
  const a=once.indexOf('pack-notification-internal.js?v=1');
  const b=once.indexOf('pack-notification-shipment.js?v=1');
  const c=once.indexOf('pack-notification-avis.js?v=1');
  assert.ok(a>0&&b>a&&c>b);
});

test('pack build contract includes the shared packaging catalog used by pack.html',()=>{
  assert.ok(PACK_ASSETS.includes('packaging-catalog.js'));
});

test('copyPackFiles carries public qr page and every runtime asset into build output',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pack-build-src-'));
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'pack-build-out-'));
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'pack.html'),'pack');
  for(const asset of PACK_ASSETS)fs.writeFileSync(path.join(root,'assets',asset),asset);
  copyPackFiles(root,out);
  assert.equal(fs.readFileSync(path.join(out,'pack.html'),'utf8'),'pack');
  for(const asset of PACK_ASSETS)assert.equal(fs.readFileSync(path.join(out,'assets',asset),'utf8'),asset);
});

test('both static web app configs expose anonymous /pack route',()=>{
  for(const file of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const config=JSON.parse(fs.readFileSync(file,'utf8'));
    const route=config.routes.find(row=>row.route==='/pack/*');
    assert.ok(route,`${file}: /pack/* route missing`);
    assert.equal(route.rewrite,'/pack.html');
    assert.ok(route.allowedRoles.includes('anonymous'));
    assert.ok(config.navigationFallback.exclude.includes('/pack/*'));
  }
});
