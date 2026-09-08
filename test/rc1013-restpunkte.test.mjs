import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const BUILD=path.join(ROOT,'.github/rc1013/build-three-env.mjs');
let built=false;
function build(){
  if(built)return;
  assert.ok(fs.existsSync(BUILD),'RC1013 Drei-Umgebungen-Build fehlt.');
  execFileSync(process.execPath,[BUILD],{cwd:ROOT,stdio:'pipe'});
  built=true;
}
function html(name){build();return fs.readFileSync(path.join(ROOT,'dist-rc1013',name),'utf8');}

for(const file of ['index.html','TESTVERSION.html']){
  test(`${file}: Gate41 behält Deutschland-Fallback bei Sendung ohne erkannten Länderwert`,()=>{
    const out=html(file);
    assert.match(out,/function setRouteData\(x,countryKey,fallbackCountry\)/);
    assert.match(out,/countryName\(d\.country\)\|\|q\(fallbackCountry\)/);
    assert.match(out,/setRouteData\(u,'destinationCountry'\);setRouteData\(g,'country','Deutschland'\)/);
    assert.match(out,/function gateRate\(pallets,kg\).*?<=800.*?return 0/s,'Gate41-Tarifgrenze bis 800 kg darf nicht erfunden oder still überschritten werden.');
  });

  test(`${file}: QR-Registrierung übernimmt einen vom Server neu ausgegebenen Token`,()=>{
    const out=html(file);
    const m=out.match(/function done\(data,compat\)\{([\s\S]*?)function recoverExisting/);
    assert.ok(m,'QR done()-Pfad fehlt.');
    const body=m[1].replace(/\s+/g,' ');
    assert.match(body,/serverToken=q\(data&&data\.token\)/);
    assert.match(body,/validToken\(serverToken\)/);
    for(const field of ['pickupToken','pickupQrToken','qrPickupToken','qrToken']){
      assert.match(body,new RegExp(`${field}:serverToken`),`${field} wird nicht auf den Server-Token synchronisiert.`);
    }
  });

  test(`${file}: RC1013 Diagnose-Erweiterung wird in die echte Oberfläche geladen`,()=>{
    const out=html(file);
    assert.match(out,/rc1013-diagnostics\.js\?v=1013/);
    assert.match(out,/rc1013-gate41-ui\.js\?v=1013/);
  });
}

test('Öffentliche QR-Seite behält den freigegebenen 48-Hex-Sicherheitsvertrag',()=>{
  const pickup=fs.readFileSync(path.join(ROOT,'pickup.html'),'utf8');
  const access=fs.readFileSync(path.join(ROOT,'api/shared/public-access-store.js'),'utf8');
  assert.match(pickup,/\^\[a-f0-9\]\{48\}\$/i);
  assert.match(access,/requestedToken/);
  assert.match(access,/crypto\.randomBytes\(24\)\.toString\('hex'\)/);
});

test('Handy-Benachrichtigungen öffnen ohne Login zuerst die native Detailansicht',()=>{
  const helper=fs.readFileSync(path.join(ROOT,'android-app/app/src/main/java/de/exporthub/test/NotificationHelper.java'),'utf8');
  const detail=fs.readFileSync(path.join(ROOT,'android-app/app/src/main/java/de/exporthub/test/NotificationDetailActivity.java'),'utf8');
  const env=fs.readFileSync(path.join(ROOT,'android-app/app/src/main/java/de/exporthub/test/EnvironmentActivity.java'),'utf8');
  const reminder=fs.readFileSync(path.join(ROOT,'android-app/app/src/main/java/de/exporthub/test/ReminderReceiver.java'),'utf8');
  assert.match(helper,/new Intent\(context, NotificationDetailActivity\.class\)/);
  assert.doesNotMatch(helper,/new Intent\(context, EnvironmentActivity\.class\)/);
  assert.match(helper,/setContentIntent\(pendingIntent\)/);
  assert.match(detail,/extends Activity/);
  assert.match(detail,/Diese Ansicht zeigt nur den Inhalt dieser Handy-Benachrichtigung/);
  assert.match(detail,/open\.setText\("In ExportHUB öffnen"\)/);
  assert.match(detail,/new Intent\(this, EnvironmentActivity\.class\)/);
  assert.match(env,/@JavascriptInterface[\s\S]*?NotificationHelper\.show/);
  assert.match(env,/requestPermissions\(new String\[\]\{Manifest\.permission\.POST_NOTIFICATIONS\}/);
  assert.match(reminder,/NotificationHelper\.show/);
});

test('Fehlerdiagnose klassifiziert Fehler verständlich und zeigt Benutzer, Firma, Code und Bedeutung',()=>{
  const file=path.join(ROOT,'assets/rc1013-diagnostics.js');
  assert.ok(fs.existsSync(file),'RC1013 Diagnose-Formatter fehlt.');
  const source=fs.readFileSync(file,'utf8');
  const sandbox={module:{exports:{}},exports:{},window:null,console};
  vm.runInNewContext(source,sandbox,{filename:'rc1013-diagnostics.js'});
  const api=sandbox.module.exports;
  assert.equal(typeof api.describe,'function','describe(record) fehlt.');
  const d=api.describe({
    level:'error',
    category:'pickup',
    area:'QR-Abholung',
    message:'Dieser öffentliche Link ist ungültig oder nicht mehr aktiv.',
    user:'Max Mustermann',
    userId:'USR-17',
    environment:'production',
    details:{companyName:'Essentra Components GmbH',httpStatus:410,token:'geheim'}
  });
  assert.equal(d.code,'EH-PICKUP-410');
  assert.equal(d.user,'Max Mustermann');
  assert.equal(d.userId,'USR-17');
  assert.equal(d.company,'Essentra Components GmbH');
  assert.match(d.meaning,/QR|Abhol|öffentliche/i);
  assert.ok(d.cause.length>10,'Ursache fehlt.');
  assert.ok(d.nextStep.length>10,'Nächster Schritt fehlt.');
  assert.equal(d.technicalMessage,'Dieser öffentliche Link ist ungültig oder nicht mehr aktiv.');
  assert.doesNotMatch(JSON.stringify(d),/geheim/,'Token darf nicht in Diagnoseansicht gelangen.');
});

test('Fehlerdiagnose-Push enthält Fehlercode, Benutzer und verständliche Bedeutung',()=>{
  build();
  const hub=fs.readFileSync(path.join(ROOT,'dist-rc1013/assets/exporthub-environment-hub.js'),'utf8');
  assert.match(hub,/ExportHUBRC1013Diagnostics/);
  assert.match(hub,/Fehlercode:/);
  assert.match(hub,/Benutzer:/);
  assert.match(hub,/Bedeutung:/);
  assert.match(hub,/Technische Meldung:/);
});

test('Android Diagnose-Detail stellt strukturierte Fehlerdaten statt nur Fließtext dar',()=>{
  const detail=fs.readFileSync(path.join(ROOT,'android-app/app/src/main/java/de/exporthub/test/NotificationDetailActivity.java'),'utf8');
  for(const label of ['Fehlercode','Benutzer','Bedeutung','Technische Meldung']){
    assert.match(detail,new RegExp(label),`${label} fehlt in der nativen Diagnoseansicht.`);
  }
  assert.match(detail,/parseDiagnosticBody/);
  assert.doesNotMatch(detail,/WebView/);
});
