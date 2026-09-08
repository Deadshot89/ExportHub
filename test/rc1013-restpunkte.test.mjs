import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
}

test('Öffentliche QR-Seite behält den freigegebenen 48-Hex-Sicherheitsvertrag',()=>{
  const pickup=fs.readFileSync(path.join(ROOT,'pickup.html'),'utf8');
  const access=fs.readFileSync(path.join(ROOT,'api/shared/public-access-store.js'),'utf8');
  assert.match(pickup,/\^\[a-f0-9\]\{48\}\$/i);
  assert.match(access,/\^\[a-f0-9\]\{48\}\$/.source ? /\^\[a-f0-9\]\{48\}\$/ : /requestedToken/);
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
