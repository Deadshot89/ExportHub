import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/rc1203-cover-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1203: Deckblatt und CMR haben getrennte Druckaktionen',()=>{
  assert.match(source,/Nur Deckblatt drucken/);
  assert.match(source,/Nur CMR drucken/);
  assert.match(source,/function documentsViewVisible/);
  assert.match(source,/view==='documents'/);
});

test('RC1203: tatsächlicher rc390-Deckblattpfad wird direkt farbig gestylt',()=>{
  for(const marker of ['.rc390-cover,.rc352-cover','#08245d','#1d4ed8','#2563eb','#60a5fa','#facc15','14mm solid #061a3a','24mm']){
    assert.ok(source.includes(marker),marker+' fehlt');
  }
  assert.match(source,/print-color-adjust/);
});

test('RC1203: Bemerkung wird aus Sendungsdaten auf das Deckblatt geschrieben',()=>{
  assert.match(source,/sh\.remark\|\|sh\.bemerkung\|\|sh\.remarks\|\|sh\.comments\|\|sh\.note\|\|sh\.notes/);
  assert.match(source,/textContent='Bemerkung'/);
  assert.match(source,/data-rc1203-cover-remark/);
  assert.match(source,/white-space','pre-wrap/);
});

test('RC1203: Empfängeradresse bleibt groß hervorgehoben',()=>{
  assert.match(source,/19pt/);
  assert.match(source,/22pt/);
  assert.match(source,/Empfänger/);
});

test('RC1203: Runtime wird in alle drei Umgebungen gebaut',()=>{
  assert.match(build,/assets\/rc1203-cover-print\.js\?v=1203/);
  assert.match(build,/'assets\/rc1203-cover-print\.js'/);
  assert.match(build,/coverPrint:'RC1203/);
});

test('RC1203: Runtime ist syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','assets/rc1203-cover-print.js'],{stdio:'pipe'});
});
