import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function route(config,path){return (config.routes||[]).find(r=>r&&r.route===path)}
// Ladezeit: no-cache + must-revalidate prüft bei jedem Aufruf beim Server nach (immer aktueller Stand), lädt die 5-MB-Seite aber nur bei Änderung neu
function noStore(headers){const v=String(headers&&headers['Cache-Control']||'');return /no-cache/i.test(v)&&/must-revalidate/i.test(v)&&!/max-age=[1-9]|immutable/i.test(v)}

test('RC1064: Produktion liefert Hauptseite und index.html ohne Cache aus',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
  for(const path of ['/','/index.html']){
    const r=route(config,path);
    assert.ok(r,path+': explizite Route fehlt');
    assert.ok(noStore(r.headers),path+': Cache-Control muss no-cache, must-revalidate enthalten (immer revalidieren)');
  }
});

test('RC1064: TESTSERVICE liefert Hauptseite und TESTVERSION ohne Cache aus',()=>{
  const config=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));
  for(const path of ['/','/index.html','/TESTVERSION.html']){
    const r=route(config,path);
    assert.ok(r,path+': explizite TESTSERVICE-Route fehlt');
    assert.ok(noStore(r.headers),path+': TESTSERVICE Cache-Control muss no-cache, must-revalidate enthalten (immer revalidieren)');
  }
});
