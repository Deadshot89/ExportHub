import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1112: autoritativer Produktionsmarker zeigt den aktuellen Release',()=>{
  const marker=read('production-version.js');
  assert.match(marker,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1112'/);
  assert.doesNotMatch(marker,/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1048'/);
});

test('RC1112: Paketversion bleibt mit der sichtbaren Release-Version synchron',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'1.0.0-rc1112');
});
