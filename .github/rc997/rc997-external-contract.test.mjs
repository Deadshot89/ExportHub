import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const cfg=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));
const pickup=fs.readFileSync('pickup.html','utf8');
const avis=fs.readFileSync('customer-avis.html','utf8');
const routes=Array.isArray(cfg.routes)?cfg.routes:[];
const route=(name)=>routes.find(r=>r&&r.route===name)||null;
const excluded=new Set((cfg.navigationFallback&&cfg.navigationFallback.exclude)||[]);

test('RC997 extern: Pickup und Kunden-Avis besitzen eigene HTML-Oberflächen',()=>{
  assert.match(pickup,/Abholung bestätigen/i);
  assert.match(avis,/Kunden-Avis/i);
});

test('RC997 extern: TESTSERVICE /pickup öffnet die echte Pickup-Seite',()=>{
  assert.ok(route('/pickup'),'Route /pickup fehlt');
  assert.equal(route('/pickup').rewrite,'/pickup.html');
  assert.ok(route('/pickup.html'),'Route /pickup.html fehlt');
  assert.notEqual(route('/pickup.html').rewrite,'/TESTVERSION.html','pickup.html darf nicht auf die interne Hauptseite zeigen');
});

test('RC997 extern: TESTSERVICE Kunden-Avis ist als separater externer Flow geroutet',()=>{
  assert.ok(route('/customer-avis'),'Route /customer-avis fehlt');
  assert.equal(route('/customer-avis').rewrite,'/customer-avis.html');
  assert.ok(route('/customer-avis.html'),'Route /customer-avis.html fehlt');
  assert.notEqual(route('/customer-avis.html').rewrite,'/TESTVERSION.html');
});

test('RC997 extern: externe Seiten werden vom Hauptseiten-Fallback ausgeschlossen',()=>{
  for(const p of ['/pickup','/pickup.html','/customer-avis','/customer-avis.html']){
    assert.ok(excluded.has(p),`${p} fehlt in navigationFallback.exclude`);
  }
});

test('RC997 extern: sensible externe Routen erzwingen no-store und no-referrer',()=>{
  for(const p of ['/pickup','/pickup.html','/customer-avis','/customer-avis.html']){
    const r=route(p);assert.ok(r,`${p} fehlt`);
    assert.match(String(r.headers&&r.headers['Cache-Control']||''),/no-store/i,`${p}: no-store fehlt`);
    assert.equal(String(r.headers&&r.headers['Referrer-Policy']||''),'no-referrer',`${p}: Referrer-Policy fehlt`);
  }
});
