import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const API=fs.readFileSync('api/customer-avis/index.js','utf8');
const DIAG=fs.readFileSync('assets/rc1037-lieferavis-timing-diagnostics.js','utf8');
const BUILD=fs.readFileSync('.github/rc1018/fix-mail-wording.mjs','utf8');

test('RC1038: Lieferavis-Timing deckt Authentifizierung und Team-Speicher-Vorbereitung ab',()=>{
  for(const key of ['authMs','teamBlobMs']){
    assert.match(API,new RegExp(key),`API-Timing muss ${key} erfassen.`);
    assert.match(DIAG,new RegExp(key),`Diagnose muss ${key} übernehmen.`);
  }
  assert.match(API,/auth;dur=/,'Server-Timing muss die Authentifizierung ausweisen.');
  assert.match(API,/team-blob;dur=/,'Server-Timing muss die Team-Speicher-Vorbereitung ausweisen.');
  assert.match(DIAG,/Authentifizierung/,'Diagnose muss die Authentifizierung verständlich beschriften.');
  assert.match(DIAG,/Team-Speicher vorbereiten/,'Diagnose muss die Speicher-Vorbereitung verständlich beschriften.');
});

test('RC1038: geändertes Timing-Asset wird mit frischem Cache-Key in alle Umgebungen geladen',()=>{
  assert.match(BUILD,/rc1037-lieferavis-timing-diagnostics\.js\?v=1038/);
  assert.match(BUILD,/\['index\.html','TESTVERSION\.html','demo\.html'\]/);
});
