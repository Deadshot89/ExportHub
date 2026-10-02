import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');

test('RC1370: README documents the current main release state through RC1370',()=>{
  assert.match(readme,/Korrekturen auf `main` reichen aktuell bis \*\*RC1370\*\*/);
  for(const marker of ['RC1306','RC1308','RC1309','RC1310','RC1311','RC1312','RC1370']){
    assert.ok(readme.includes(marker),'README missing current release marker '+marker);
  }
});

test('RC1313: README records current design, viewport, task and monitoring contracts',()=>{
  assert.match(readme,/Classic.*Modern Business.*Glass.*Neon Night/s);
  for(const viewport of ['360×800','390×844','768×1024','1366×768','1920×1080']){
    assert.ok(readme.includes(viewport),'README missing viewport '+viewport);
  }
  assert.match(readme,/09:00.*12:00.*15:00/s);
  assert.match(readme,/stündlich/i);
  assert.match(readme,/www\.exporthub360\.de/);
  assert.match(readme,/Mail\.Send/);
  assert.match(readme,/Branch Protection/i);
});
