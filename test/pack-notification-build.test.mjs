import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {injectPackRuntime,copyPackFiles,PACK_ASSETS} from '../.github/packmeldungen/build-three-env.mjs';
import {readMainFlow,readProductionFlow} from './helpers/rc1505-release-contract.mjs';

test('runtime injection is idempotent and ordered after existing document head',()=>{
  const base='<!doctype html><html><head><title>ExportHUB360</title></head><body><main id="content"></main></body></html>';
  const once=injectPackRuntime(base,'index.html');
  const twice=injectPackRuntime(once,'index.html');
  assert.equal(once,twice);
  assert.match(once,/pack-notification-internal\.css\?v=1/);
  assert.match(once,/pack-notification-avis\.css\?v=1/);
  const i18n=once.indexOf('i18n/pack-notification.js?v=1');
  const a=once.indexOf('pack-notification-internal.js?v=1');
  const nav=once.indexOf('pack-notification-nav.js?v=1');
  const b=once.indexOf('pack-notification-shipment.js?v=1');
  const c=once.indexOf('pack-notification-avis.js?v=1');
  assert.ok(i18n>0&&a>i18n&&nav>a&&b>nav&&c>b);
});

test('pack build contract includes shared catalog, locale runtime, stable inbox navigation and station admin runtime',()=>{
  assert.ok(PACK_ASSETS.includes('i18n/pack-notification.js'));
  assert.ok(PACK_ASSETS.includes('packaging-catalog.js'));
  assert.ok(PACK_ASSETS.includes('pack-notification-nav.js'));
  assert.ok(PACK_ASSETS.includes('pack-station-admin.js'));
  const nav=fs.readFileSync('assets/pack-notification-nav.js','utf8');
  assert.match(nav,/renderPackInbox/);
  assert.match(nav,/data-pack-notifications-nav/);
  assert.doesNotMatch(nav,/MutationObserver/);
  assert.doesNotMatch(nav,/cloneNode\(true\)/);
  assert.doesNotMatch(nav,/location\.hash\s*=\s*['"]#packmeldungen/);
});

test('copyPackFiles carries public qr page and every runtime asset into build output',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pack-build-src-'));
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'pack-build-out-'));
  fs.mkdirSync(path.join(root,'assets'),{recursive:true});
  fs.writeFileSync(path.join(root,'pack.html'),'pack');
  for(const asset of PACK_ASSETS){
    const target=path.join(root,'assets',asset);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,asset);
  }
  copyPackFiles(root,out);
  assert.equal(fs.readFileSync(path.join(out,'pack.html'),'utf8'),'pack');
  for(const asset of PACK_ASSETS)assert.equal(fs.readFileSync(path.join(out,'assets',asset),'utf8'),asset);
});

test('both static web app configs expose anonymous /pack route through the shared deployable asset page',()=>{
  assert.ok(fs.existsSync('assets/pack.html'),'shared deployable pack page missing');
  for(const file of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const config=JSON.parse(fs.readFileSync(file,'utf8'));
    const route=config.routes.find(row=>row.route==='/pack/*');
    assert.ok(route,`${file}: /pack/* route missing`);
    assert.equal(route.rewrite,'/assets/pack.html');
    assert.ok(route.allowedRoles.includes('anonymous'));
    const direct=config.routes.find(row=>row.route==='/pack.html');
    assert.equal(direct&&direct.rewrite,'/assets/pack.html');
    assert.ok(config.navigationFallback.exclude.includes('/pack/*'));
  }
});

test('RC1500 split release packages carry the shared assets folder into TESTSERVICE and production apps',()=>{
  const main=readMainFlow(),production=readProductionFlow();
  const testStart=main.indexOf('- name: RC1112 TESTSERVICE-Paket vorbereiten');
  const testEnd=main.indexOf('- name: RC1124 Playwright installieren',testStart);
  assert.ok(testStart>=0&&testEnd>testStart,'RC1112 TESTSERVICE-Paket-Block fehlt');
  const testBlock=main.slice(testStart,testEnd);
  assert.match(testBlock,/cp -R assets \.rc1112_testservice_app\/assets/,'shared assets folder is not copied into TESTSERVICE package');
  assert.match(testBlock,/cp staticwebapp\.testservice\.config\.json \.rc1112_testservice_app\/staticwebapp\.config\.json/);

  const prodStart=production.indexOf('- name: RC1112 Production-Paket aus freigegebenem SHA vorbereiten');
  const prodEnd=production.indexOf('- name: RC1124 Playwright für Production-Smoke installieren',prodStart);
  assert.ok(prodStart>=0&&prodEnd>prodStart,'RC1112 Production-Paket-Block fehlt');
  const prodBlock=production.slice(prodStart,prodEnd);
  assert.match(prodBlock,/cp -R assets \.rc1112_production_app\/assets/,'shared assets folder is not copied into production package');
  assert.match(prodBlock,/cp staticwebapp\.config\.json \.rc1112_production_app\/staticwebapp\.config\.json/);
  assert.ok(fs.existsSync('assets/pack.html'),'pack page is not part of the shared assets deploy source');
});
