import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('RC1048: Gate41-Stammdaten werden in allen drei Umgebungen eingebaut',()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  for(const [file,env] of [['index.html','production-candidate'],['TESTVERSION.html','testservice'],['demo.html','demo']]){
    const html=read('dist-rc1048/'+file);
    assert.match(html,new RegExp('ExportHUB RC1048 environment='+env));
    assert.match(html,/id="rc1048GateMaster"/);
    assert.match(html,/Gate41-Stammdaten Deutschland/);
    assert.match(html,/function saveGateMaster\(\)/);
    assert.match(html,/gate41TransitTimes=\{DE:transit\}/);
    assert.match(html,/gate41DieselPrice/);
  }
});

test('RC1048: PLZ-Zonenparser akzeptiert nur echte Zone 1 bis 8',()=>{
  const html=read('dist-rc1048/index.html');
  const start=html.indexOf('function gateMasterParseZones(text){');
  const end=html.indexOf('\nfunction gateMasterParseToll(text){',start);
  assert.ok(start>=0&&end>start,'PLZ-Zonenparser fehlt');
  const fn=html.slice(start,end);
  const ctx={};
  vm.runInNewContext(
    "function q(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim()}"+
    fn+
    ";result={ok:gateMasterParseZones('41=4\\n411=5'),bad:gateMasterParseZones('41=9\\nABC=4')};",
    ctx
  );
  assert.equal(ctx.result.ok.errors.length,0);
  assert.equal(ctx.result.ok.rows.length,2);
  assert.equal(ctx.result.ok.rows[0].postalPrefix,'411','Längere Präfixe müssen Vorrang haben');
  assert.equal(ctx.result.bad.errors.length,2);
});

test('RC1048: Mautparser baut Zone-Gewicht-Tabelle ohne erfundene Werte',()=>{
  const html=read('dist-rc1048/index.html');
  const start=html.indexOf('function gateMasterParseToll(text){');
  const end=html.indexOf('\nfunction saveGateMaster(){',start);
  assert.ok(start>=0&&end>start,'Mautparser fehlt');
  const fn=html.slice(start,end);
  const ctx={};
  vm.runInNewContext(
    "function q(v){return String(v==null?'':v).replace(/\\s+/g,' ').trim()}"+
    fn+
    ";result=gateMasterParseToll('4;500;30,50\\n4;1000;40.00\\n2;500;25');",
    ctx
  );
  assert.equal(ctx.result.errors.length,0);
  assert.equal(ctx.result.toll['4'].length,2);
  assert.equal(ctx.result.toll['4'][0].maxKg,500);
  assert.equal(ctx.result.toll['4'][1].price,40);
});

test('RC1048: Gate41-Zone wird nicht mehr aus Start-PLZ geraten',()=>{
  const html=read('dist-rc1048/index.html');
  const start=html.indexOf('function configuredZoneInfo(c,g){');
  const end=html.indexOf('\nfunction lookupInternationalPrice(g){',start);
  assert.ok(start>=0&&end>start,'configuredZoneInfo fehlt');
  const fn=html.slice(start,end);
  assert.doesNotMatch(fn,/source:'Start-PLZ'/);
  assert.doesNotMatch(fn,/originZone/);
  assert.doesNotMatch(fn,/charAt\(0\)/);
  assert.match(fn,/source:'manuell'/);
  assert.match(fn,/deutsche Zonentabelle/);
});

test('RC1048: bestehende Gate41-Preisregression 230,45 + 6,91 + 40 = 277,36 bleibt erhalten',()=>{
  const html=read('dist-rc1048/index.html');
  assert.match(html,/function gateRate\(pallets,kg\)/);
  for(const rate of ['46.09','43.43','73.69','70.92','98.61','94.46'])assert.ok(html.includes(rate),'Tarif fehlt '+rate);
  const calcStart=html.indexOf('function calcGate(){');
  const calcEnd=html.indexOf('\nfunction setLiveValue(',calcStart);
  assert.match(html.slice(calcStart,calcEnd),/total=base\+diesel\+toll\+additional/);
});

test('RC1049: Release-Test-Fix bildet die von der Release-Vorbereitung benötigten APIs im Temp-Verzeichnis ab',()=>{
  const releaseTest=read('test/rc1027-lieferavis-release.test.mjs');
  assert.match(releaseTest,/api\/exporthub-state\/index\.js/);
  assert.match(releaseTest,/api\/customer-avis\/index\.js/);
  assert.match(releaseTest,/copyFileSync/);
});
