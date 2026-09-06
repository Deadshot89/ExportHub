import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function count(rx){return (html.match(rx)||[]).length;}

test('RC997 Website-Abschluss: provisorische TESTSERVICE-Logintexte sind entfernt',()=>{
  assert.doesNotMatch(html,/TESTSERVICE\s*·\s*Auth-Backend bereit\s*·\s*Nur Globaler Admin\.?/i);
  assert.doesNotMatch(html,/TESTSERVICE\s*·\s*Nur Globaler Admin\s*·\s*Zugangsdaten eingeben\.?/i);
  assert.match(html,/TESTSERVICE\s*·\s*Zugangsdaten eingeben\./i);
});

test('RC997 Website-Abschluss: finaler UI-Polish ist genau einmal vorhanden',()=>{
  assert.equal(count(/id=["']rc997-final-website-polish["']/g),1,'Finaler Website-Polish fehlt oder ist doppelt');
  assert.match(html,/data-rc997-final=["']website["']/i);
});

test('RC997 Website-Abschluss: Fehlerdiagnose bleibt Global-Admin-geschützt',()=>{
  assert.match(html,/if\(!isGlobal\(\)\)\{root\.innerHTML='<div class="badbox">Die Fehlerdiagnose ist nur für globale Administratoren freigegeben\.<\/div>';return false\}/);
  assert.match(html,/GLOBAL ADMIN\s*·\s*['"]?\+?\(isTestservice\(\)\?/);
});

test('RC997 Website-Abschluss: Warncenter und persönliche Benachrichtigungen bleiben getrennt',()=>{
  assert.match(html,/id=["']rc885WarningDrawer["']/);
  assert.match(html,/id=["']index236NotificationCenter["']/);
  assert.match(html,/Operative Probleme an Sendungen werden getrennt im Warncenter angezeigt\./);
});

test('RC997 Website-Abschluss: Smartphone-Abschlussregeln sind vorhanden',()=>{
  assert.match(html,/@media\(max-width:720px\)[\s\S]*?data-rc997-final/);
  assert.match(html,/\.rc871-diag-actions\s*\{[\s\S]*?width:100%/);
});

test('RC997 Main-Bereinigung: veraltete Professional-0.2-Schattenstruktur ist entfernt',()=>{
  const obsolete=[
    'api/health/index.js','api/health/function.json',
    'assets/css/app.css','assets/js/app.js',
    'shared/migration-core.js','tools/migration-checker.html','schema/postgres.sql',
    'migration/analyze-exporthub-backup.mjs','migration/verify-migration-package.mjs',
    'test/migration.test.mjs'
  ];
  const existing=obsolete.filter(file=>fs.existsSync(file));
  assert.deepEqual(existing,[],`Veraltete Dateien noch vorhanden: ${existing.join(', ')}`);
});
