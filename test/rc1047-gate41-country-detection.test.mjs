import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1047: 41189 MG wird nicht als Land MG interpretiert',()=>{
  execFileSync(process.execPath,['.github/rc1047/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  const html=read('dist-rc1047/index.html');
  const start=html.indexOf('function countryCode(v){');
  const end=html.indexOf('function shippingPackagingList(){',start);
  assert.ok(start>=0&&end>start,'Länderblock fehlt');
  const block=html.slice(start,end);
  const ctx={};
  vm.runInNewContext(
    "function q(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim()}"+
    "function low(v){return q(v).toLowerCase()}"+
    block+
    ";result={plain:countryFromAddress('41189 MG'),named:countryFromAddress('41189 MG, Deutschland'),prefixed:countryFromAddress('DE-41189 MG')};",
    ctx
  );
  assert.equal(ctx.result.plain,'','MG ist ein Ortskürzel und darf nicht als Land erkannt werden');
  assert.equal(ctx.result.named,'Deutschland');
  assert.equal(ctx.result.prefixed,'Deutschland');
});

test('RC1047: Kunden- und Standortland haben Vorrang vor Freitextadresse',()=>{
  const html=read('dist-rc1047/index.html');
  const start=html.indexOf('function activeShipmentRoute(){');
  const end=html.indexOf('\n}\nfunction shipmentRows(){',start);
  assert.ok(start>=0&&end>start,'activeShipmentRoute fehlt');
  const fn=html.slice(start,end);
  const customer="firstValue(c,['country','land','countryName','countryCode','iso','iso2'])";
  const address='countryFromAddress(address)';
  assert.ok(fn.indexOf(customer)>=0,'Kundenland fehlt');
  assert.ok(fn.indexOf(address)>=0,'Adressfallback fehlt');
  assert.ok(fn.indexOf(customer)<fn.indexOf(address),'Kundenland muss vor der Adressheuristik ausgewertet werden');
  assert.doesNotMatch(fn,/countryFromAddress\(address\)\|\|firstValue\(c,/);
});

test('RC1047: Gate41 Deutschland-Tarif bleibt unverändert',()=>{
  const html=read('dist-rc1047/index.html');
  assert.match(html,/function gateRate\(pallets,kg\)/);
  for(const rate of ['43.43','46.09','70.92','73.69','94.46','98.61'])assert.ok(html.includes(rate),'Tarif '+rate+' fehlt');
  assert.match(html,/Gate41 ist derzeit nur für nationalen Versand innerhalb Deutschlands freigegeben/);
});

test('RC1047: alle drei Oberflächen zeigen denselben Release',()=>{
  for(const [file,env] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=read('dist-rc1047/'+file);
    assert.match(html,new RegExp('ExportHUB RC1047 environment='+env));
    assert.match(html,/version:'RC1047'/);
    assert.match(html,/function addressCountryCode\(v\)/);
  }
});

test('RC1047: Website Android und Paketmetadaten sind versionsgleich',()=>{
  assert.match(read('production-version.js'),/__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1047'/);
  assert.match(read('android-app/app/build.gradle.kts'),/versionCode\s*=\s*1047/);
  assert.match(read('android-app/app/build.gradle.kts'),/versionName\s*=\s*"1\.0-rc1047"/);
  assert.equal(JSON.parse(read('android-app/app-build-info.json')).releaseCandidate,'RC1047');
  assert.equal(JSON.parse(read('package.json')).version,'1.0.0-rc1047');
});
