import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

function extractFunction(html,name,nextName){
  const start=html.indexOf('function '+name+'(');
  const end=html.indexOf('\nfunction '+nextName+'(',start);
  assert.ok(start>=0&&end>start,name+' fehlt im RC1047-Build');
  return html.slice(start,end);
}

test('RC1047: konkreter Gate41-Fall 5 Paletten 900 kg ergibt 230,45 Euro Grundfracht',()=>{
  execFileSync(process.execPath,['.github/rc1047/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  const html=read('dist-rc1047/index.html');
  const gateRate=extractFunction(html,'gateRate','gateConfiguredBase');
  const ctx={};
  vm.runInNewContext(
    "function num(v){var n=Number(v);return isFinite(n)?n:0;}"+
    gateRate+
    ";result=gateRate(5,900/5)*5;",
    ctx
  );
  assert.equal(Number(ctx.result.toFixed(2)),230.45);
});

test('RC1047: Diesel 3 Prozent und 40 Euro Maut ergeben 277,36 Euro Gesamtpreis',()=>{
  const html=read('dist-rc1047/index.html');
  const diesel=extractFunction(html,'gateDieselPct','configuredDieselPrice');
  const ctx={};
  vm.runInNewContext(
    "function num(v){var n=Number(v);return isFinite(n)?n:0;}"+
    diesel+
    ";var base=230.45,pct=gateDieselPct(1.29),dieselCost=base*pct/100,toll=40,additional=0;result={pct:pct,diesel:dieselCost,total:base+dieselCost+toll+additional};",
    ctx
  );
  assert.equal(ctx.result.pct,3);
  assert.equal(Number(ctx.result.diesel.toFixed(2)),6.91);
  assert.equal(Number(ctx.result.total.toFixed(2)),277.36);
});

test('RC1047: calcGate addiert Maut zwingend in die Gesamtsumme',()=>{
  const html=read('dist-rc1047/index.html');
  const start=html.indexOf('function calcGate(){');
  const end=html.indexOf('\nfunction setLiveValue(',start);
  assert.ok(start>=0&&end>start,'calcGate fehlt');
  const fn=html.slice(start,end);
  assert.match(fn,/total=base\+diesel\+toll\+additional/);
  assert.match(fn,/toll:toll/);
  assert.match(fn,/total:total/);
});

test('RC1047: Maut wird im Gate41-Ergebnis separat angezeigt und Gesamtpreis nutzt r.total',()=>{
  const html=read('dist-rc1047/index.html');
  assert.match(html,/id="rc501GateResultToll"/);
  assert.match(html,/id="rc501GateTotal" class="total">['"]?\+money\(r\.total\)/);
});
