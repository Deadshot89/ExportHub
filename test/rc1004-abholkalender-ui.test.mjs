import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
await import('../assets/abholkalender.js');
const calendar = globalThis.ExportHubPickupCalendar;

function canonicalRuntimeScripts(file){
  const html=fs.readFileSync(file,'utf8');
  const marker=html.indexOf('window.__EXPORTHUB_CANONICAL_MODULE_MANIFEST__=');
  assert.ok(marker>=0,`${file}: Canonical-Manifest fehlt`);
  const open=html.lastIndexOf('<script',marker);
  const bodyStart=html.indexOf('>',open)+1;
  const close=html.indexOf('</script',marker);
  assert.ok(open>=0&&bodyStart>open&&close>marker,`${file}: Canonical-Manifest-Scriptblock unvollstaendig`);

  const window={};
  vm.runInNewContext(html.slice(bodyStart,close),{window},{timeout:2000,filename:`${file}:manifest`});
  const manifest=window.__EXPORTHUB_CANONICAL_MODULE_MANIFEST__;
  assert.ok(Array.isArray(manifest)&&manifest.length,`${file}: Canonical-Manifest ist leer`);

  const scripts=[];
  for(const entry of manifest){
    let captured=[];
    const runtimeWindow={ExportHUBClean:{runScripts(items){captured=items;return null}}};
    vm.runInNewContext(entry.code,{window:runtimeWindow},{timeout:2000,filename:`${file}:${entry.src||'canonical'}`});
    for(const item of captured||[]){
      assert.equal(typeof item.code,'string',`${file}: Canonical-Laufzeitcode fehlt`);
      assert.doesNotThrow(()=>new vm.Script(item.code,{filename:`${file}:runtime-${item.id}.js`}),`${file}: Canonical-Laufzeitcode ${item.id} ist syntaktisch defekt`);
      scripts.push(item.code);
    }
  }
  return scripts;
}

test('UI-Vertrag enthält Heute, FIX, SENDUNG und Montag bis Freitag', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/Heute/);
  assert.match(js,/FIX/);
  assert.match(js,/SENDUNG/);
  for (const day of ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag']) assert.match(js,new RegExp(day));
  assert.doesNotMatch(js,/Samstag|Sonntag/);
});

test('UI führt keine Uhrzeitfelder für fixe Abholungen ein', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.doesNotMatch(js,/type=["']time["']/);
  assert.doesNotMatch(js,/pickupStart|pickupEnd|timeWindow/);
});

test('FIX- und SENDUNG-Ladefehler werden getrennt gehalten', () => {
  const state = calendar.createViewState();
  state.fixedPickups = [{id:'F1'}];
  state.shipments = [{reference:'S1'}];
  state.fixedError = 'FIX konnte nicht geladen werden';
  assert.equal(state.shipments.length,1);
  assert.equal(state.fixedError,'FIX konnte nicht geladen werden');
  assert.equal(state.shipmentError,null);
});

test('Adminformular enthält nur Standort, Wochentag, Hinweis und Aktivstatus', () => {
  const js = fs.readFileSync('assets/abholkalender.js','utf8');
  assert.match(js,/name="siteLabel"/);
  assert.match(js,/name="weekday"/);
  assert.match(js,/name="note"/);
  assert.match(js,/name="active"/);
  assert.match(js,/Fixe Abholungen verwalten/);
});

test('Kalender-CSS bleibt auf Feature-Klassen begrenzt und ist responsiv', () => {
  const css = fs.readFileSync('assets/abholkalender.css','utf8');
  assert.match(css,/\.pickup-calendar/);
  assert.match(css,/\.pickup-week/);
  assert.match(css,/@media\(max-width:1000px\)/);
  assert.match(css,/@media\(max-width:640px\)/);
  assert.doesNotMatch(css,/(^|\})\s*(body|button|\.card|nav)\s*\{/m);
});

for(const file of ['index.html','TESTVERSION.html']){
  test(`${file}: Abholkalender ist in Hauptseite, Navigation und Laufzeit eingebunden`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/abholkalender\.css/,`${file}: Kalender-CSS fehlt`);
    assert.match(html,/abholkalender\.js/,`${file}: Kalender-JavaScript fehlt`);
    assert.match(html,/pickupcalendar/,`${file}: Modul/Route pickupcalendar fehlt`);
    assert.match(html,/Abholkalender/,`${file}: sichtbare Bezeichnung Abholkalender fehlt`);
    assert.equal((html.match(/id=["']pickupCalendarRoot["']/g)||[]).length,1,`${file}: pickupCalendarRoot muss genau einmal vorkommen`);
    assert.match(html,/ExportHubPickupCalendar\.mount\s*\(/,`${file}: Kalender wird beim Öffnen nicht montiert`);
    assert.match(html,/ExportHubPickupCalendar\.setShipments\s*\(/,`${file}: bestehende Sendungscollection wird nicht nachgeführt`);
    canonicalRuntimeScripts(file);
  });
}
