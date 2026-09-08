import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function build(){
  execFileSync(process.execPath,['.github/rc1011/build-three-env.mjs'],{stdio:'pipe'});
}

function read(path){ return fs.readFileSync(path,'utf8'); }

test('RC1011: Drei-Umgebungen-Build bindet Kalender-JS CSS und Runtime wirklich ein', () => {
  build();
  for (const file of ['dist-rc1011/index.html','dist-rc1011/TESTVERSION.html','dist-rc1011/demo.html']) {
    const html = read(file);
    assert.match(html,/assets\/abholkalender\.css\?v=1011/,`${file}: Kalender-CSS fehlt`);
    assert.match(html,/assets\/abholkalender\.js\?v=1011/,`${file}: Kalender-JS fehlt`);
    assert.match(html,/assets\/rc1011-abholkalender-runtime\.js\?v=1011/,`${file}: Runtime-Bridge fehlt`);
  }
  assert.equal(fs.existsSync('dist-rc1011/assets/rc1011-abholkalender-runtime.js'),true);
});

test('RC1011: Abholkalender ist ein normaler kanonischer Menüpunkt mit bestehendem Recht', () => {
  build();
  for (const file of ['dist-rc1011/index.html','dist-rc1011/TESTVERSION.html','dist-rc1011/demo.html']) {
    const html = read(file);
    assert.match(html,/view:'pickupcalendar',label:'Abholkalender',right:'pickupcalendar'/,`${file}: kanonischer Menüpunkt fehlt`);
  }
});

test('RC1011: Runtime liest den bestehenden ExportHUB-State und mountet ohne Parallel-Router', () => {
  const runtime = read('assets/rc1011-abholkalender-runtime.js');
  assert.match(runtime,/__EXPORTHUB_GET_STATE__/);
  assert.match(runtime,/state\.shipments/);
  assert.match(runtime,/ExportHubPickupCalendar\.mount/);
  assert.match(runtime,/window\.pickupcalendar\s*=/);
  assert.match(runtime,/canRead\(['"]pickupcalendar['"]\)/);
  assert.doesNotMatch(runtime,/MutationObserver|history\.pushState|location\.href\s*=/);
});
