import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function route(config,path){return (config.routes||[]).find(r=>r&&r.route===path)}
function noStore(headers){return /no-store/i.test(String(headers&&headers['Cache-Control']||''))&&/no-cache/i.test(String(headers&&headers['Cache-Control']||''))&&/must-revalidate/i.test(String(headers&&headers['Cache-Control']||''))}

test('RC1064: Produktion liefert Hauptseite und index.html ohne Cache aus',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
  for(const path of ['/','/index.html']){
    const r=route(config,path);
    assert.ok(r,path+': explizite Route fehlt');
    assert.ok(noStore(r.headers),path+': Cache-Control muss no-store, no-cache, must-revalidate enthalten');
  }
});

test('RC1064: TESTSERVICE liefert Hauptseite und TESTVERSION ohne Cache aus',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));
  for(const path of ['/','/index.html','/TESTVERSION.html']){
    const r=route(config,path);
    assert.ok(r,path+': explizite TESTSERVICE-Route fehlt');
    assert.ok(noStore(r.headers),path+': TESTSERVICE Cache-Control muss no-store, no-cache, must-revalidate enthalten');
  }
});
