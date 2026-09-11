import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1046: Gate41 zeigt alle automatisch übernommenen Kerndaten im Ergebnis',()=>{
  execFileSync(process.execPath,['.github/rc1046/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1046/'+file);
    for(const id of [
      'rc1046GateResultCustomer','rc1046GateResultReference','rc1046GateResultRoute',
      'rc1046GateResultCountry','rc1046GateResultPallets','rc1046GateResultWeight',
      'rc1046GateResultKgPerPallet','rc1046GateResultLdm'
    ]) assert.match(html,new RegExp(id),file+' fehlt '+id);
    assert.match(html,/<span>Kunde<\/span>/);
    assert.match(html,/<span>Referenz<\/span>/);
    assert.match(html,/<span>Route<\/span>/);
    assert.match(html,/<span>Zielland<\/span>/);
    assert.match(html,/<span>Paletten<\/span>/);
    assert.match(html,/<span>Gesamtgewicht<\/span>/);
    assert.match(html,/<span>Gewicht je Palette<\/span>/);
    assert.match(html,/<span>Lademeter<\/span>/);
  }
});

test('RC1046: Gate41-Laufzeit übernimmt vorhandene Sendungs-, Kunden- und Tarifwerte ohne erfundenen Standard',()=>{
  const html=read('dist-rc1046/index.html');
  const start=html.indexOf('function gateTransit(g,national){');
  const end=html.indexOf('\n\nfunction tableSources(name){',start);
  assert.ok(start>=0&&end>start,'gateTransit fehlt');
  const fn=html.slice(start,end);
  assert.match(fn,/sh\.gate41Transit/);
  assert.match(fn,/sh\.transitTime/);
  assert.match(fn,/customer\.gate41Transit/);
  assert.match(fn,/customer\.transitTime/);
  assert.match(fn,/tar\.defaultGate41Transit/);
  assert.match(fn,/settings\.gate41TransitTimes/);
  assert.match(fn,/return''/,'Ohne Quelle darf keine Laufzeit erfunden werden');
});

test('RC1046 bleibt als historischer Gate41-Autofill-Release reproduzierbar',()=>{
  for(const [file,environment] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=read('dist-rc1046/'+file);
    assert.match(html,new RegExp('ExportHUB RC1046 environment='+environment));
    assert.match(html,/version:'RC1046'/);
  }
  assert.match(read('dist-rc1046/production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1046'/);
});
