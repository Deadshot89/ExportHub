import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function read(p){return fs.readFileSync(p,'utf8')}
const state=read('api/exporthub-state/index.js');
const asset=read('assets/rc1115-iso-audit.js');
const build=read('.github/rc1112/build-three-env.mjs');

test('RC1115: ISO-Audit ist admin-geschützt und enthält Backup-/Restore-Status',()=>{
  assert.match(state,/mode==='iso-audit'/);
  assert.match(state,/mode==='iso-backup-restore-test'/);
  assert.match(state,/ISO-\/Audit-Übersicht ist nur für globale Administratoren/);
  assert.match(state,/Backup-\/Restore-Selbsttest ist nur für globale Administratoren/);
  assert.match(state,/async function isoAuditStatus\(/);
  assert.match(state,/async function backupRestoreSelfTest\(/);
  assert.match(state,/sourceHash===restoredHash/);
  assert.match(state,/productionStateChanged:false/);
});

test('RC1115: Audit-Oberfläche zeigt die zentralen Kontrollbereiche',()=>{
  for(const marker of [
    'Technischer Kontrollstatus',
    'Benutzer & Sitzungen',
    'Backup & Restore',
    'Fehler & Audit',
    'POD & Release',
    'Backup/Restore testen',
    'iso-audit',
    'iso-backup-restore-test'
  ])assert.ok(asset.includes(marker),marker+' fehlt');
});

test('RC1115: ISO-Audit-Runtime wird in alle drei Web-Umgebungen gebaut',()=>{
  assert.match(build,/assets\/rc1115-iso-audit\.js\?v=1115/);
  assert.match(build,/fs\.copyFileSync\(rc1115IsoSrc,rc1115IsoOut\)/);
  assert.match(build,/isoSecurityP0:'RC1115 session policy \+ API contract \+ backup restore evidence \+ audit view'/);
});

test('RC1115: Browser-Sicherheitsheader gelten für Produktion und Testservice',()=>{
  for(const file of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
    const cfg=JSON.parse(read(file)),h=cfg.globalHeaders||{};
    assert.equal(h['X-Frame-Options'],'DENY');
    assert.equal(h['X-Content-Type-Options'],'nosniff');
    assert.match(h['Content-Security-Policy']||'',/frame-ancestors 'none'/);
    assert.match(h['Content-Security-Policy']||'',/object-src 'none'/);
  }
});
