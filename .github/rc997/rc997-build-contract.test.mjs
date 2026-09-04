import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=(p)=>fs.readFileSync(p,'utf8');
const exists=(p)=>fs.existsSync(p);
const BUILD='.github/rc997/build-three-env.mjs';

test('RC997 Build: eigener reproduzierbarer Drei-Umgebungen-Build existiert',()=>{
  assert.equal(exists(BUILD),true,`${BUILD} fehlt`);
  const src=read(BUILD);
  assert.match(src,/const VERSION='RC997'/);
  assert.match(src,/const CACHE='997'/);
  assert.match(src,/dist-rc997/);
  assert.match(src,/exporthub-rc997-three-env-v1/);
  assert.match(src,/exporthub-rc997-env-config/);
  assert.match(src,/exporthub-rc997-demo-bootstrap/);
});

test('RC997 Build: Produktion bleibt ein separater Release-Center-Schritt',()=>{
  const marker=read('production-version.js');
  const m=marker.match(/PRODUCTION_VERSION_PROBE__\s*=\s*['"]RC(\d+)['"]/);
  assert.ok(m,'Produktionsmarker fehlt');
  const version=Number(m[1]);
  assert.ok(version===990||version===997,`Für RC997 ist nur RC990 vor oder RC997 nach Release-Center-Freigabe zulässig, gefunden RC${version}`);
  const workflow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(workflow,/production-version\.js/);
  assert.match(workflow,/Build RC997 Release-Center production package/);
});

test('RC997 Build: erzeugte TESTSERVICE- und Demo-Seiten tragen eindeutige RC997-Marker',()=>{
  assert.equal(exists(BUILD),true,`${BUILD} fehlt`);
  const run=spawnSync(process.execPath,[BUILD],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.stdout);
  const testHtml=read('dist-rc997/TESTVERSION.html');
  const demoHtml=read('dist-rc997/demo.html');
  const prodHtml=read('dist-rc997/index.html');
  assert.match(testHtml,/ExportHUB RC997 environment=testservice/);
  assert.match(demoHtml,/ExportHUB RC997 environment=demo/);
  assert.match(prodHtml,/ExportHUB RC997 environment=production-candidate/);
  assert.match(testHtml,/version:'RC997',cache:'997'/);
  assert.match(demoHtml,/exporthub-rc997-demo-bootstrap/);
  assert.match(testHtml,/exporthub-rc997-env-hub/);
});
