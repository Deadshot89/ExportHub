import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const prod=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
const testservice=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));

function route(config,path){return (config.routes||[]).find(r=>r.route===path);}
function assertNoStore(config,path,label){
  const r=route(config,path);
  assert.ok(r,`${label}: Route ${path} fehlt`);
  const cache=String(r.headers&&r.headers['Cache-Control']||'').toLowerCase();
  assert.match(cache,/no-store/,`${label}: ${path} muss no-store senden`);
  assert.match(cache,/no-cache/,`${label}: ${path} muss no-cache senden`);
  assert.match(cache,/must-revalidate/,`${label}: ${path} muss must-revalidate senden`);
}

test('RC1018 Produktionsshell wird nie mit altem inline Palettenkonto oder Rechteeditor aus Browsercache ausgeliefert',()=>{
  assertNoStore(prod,'/','Produktion');
  assertNoStore(prod,'/index.html','Produktion');
});

test('RC1018 TESTSERVICE und Demo erzwingen ebenfalls aktuelle Shell',()=>{
  assertNoStore(testservice,'/','TESTSERVICE');
  assertNoStore(testservice,'/TESTVERSION.html','TESTSERVICE');
  assertNoStore(testservice,'/demo.html','Demo');
});