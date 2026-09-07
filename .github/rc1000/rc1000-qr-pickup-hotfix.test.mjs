import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const testversion = fs.readFileSync('TESTVERSION.html', 'utf8');
const pickup = fs.readFileSync('pickup.html', 'utf8');

for (const [name, html] of [['index.html', index], ['TESTVERSION.html', testversion]]) {
  test(`${name}: Druck wartet auf serverseitige Pickup-Registrierung`, () => {
    assert.match(html, /pickupReady=await timed\(Promise\.resolve\(qr\.register\(sh,false\)\),28000/);
    assert.match(html, /pickupReady!==true\|\|sh\.pickupQrRegistered!==true\|\|!\/\^\[a-f0-9\]\{48\}\$\/i\.test\(pickupToken\)/);
    assert.doesNotMatch(html, /sh\.pickupQrRegistered!==true&&typeof qr\.register==='function'\)Promise\.resolve\(qr\.register\(sh,false\)\)\.catch/);
  });
}

test('pickup.html: nur sichere 48-stellige Pickup-Tokens werden akzeptiert', () => {
  assert.match(pickup, /\[a-f0-9\]\{48\}/i);
  assert.doesNotMatch(pickup, /\[A-Za-z0-9_-\]\{6,128\}/);
  assert.doesNotMatch(pickup, /legacy&&u\.searchParams\.get\('ref'\)/);
});

test('Backend-Vertrag: Pickup-Init liefert serverseitig erzeugten 48-Hex-Token', () => {
  const init = fs.readFileSync('api/pickup-init/index.js', 'utf8');
  const access = fs.readFileSync('api/shared/public-access-store.js', 'utf8');
  assert.match(init, /access\.issue\(req,'pickup'/);
  assert.match(init, /token:issued\.token/);
  assert.match(access, /randomBytes\(24\)\.toString\('hex'\)/);
});
