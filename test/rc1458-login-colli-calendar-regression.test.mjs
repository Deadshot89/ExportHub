import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const calendarRuntime=fs.readFileSync('assets/rc1012-abholkalender-runtime.js','utf8');
const authRuntime=fs.readFileSync('assets/rc1289-auth-transport-fallback.js','utf8');
const loginGuardRuntime=fs.readFileSync('assets/rc1458-login-colli-guard.js','utf8');
const companyContext=fs.readFileSync('api/shared/company-context.js','utf8');

function loadCalendar(state){
  const calls=[];
  const root={innerHTML:''};
  const window={
    __EXPORTHUB_GET_STATE__:()=>state,
    location:{hostname:'www.exporthub360.de',pathname:'/index.html'},
    document:{getElementById:()=>root},
    canRead:()=>true,
    ExportHubPickupCalendar:{mount:(element,options)=>{calls.push({element,options});return{}}}
  };
  vm.runInContext(calendarRuntime,vm.createContext({window,globalThis:window}),{filename:'assets/rc1012-abholkalender-runtime.js'});
  assert.equal(window.pickupcalendar(),true);
  return calls[0].options;
}

function loadLoginGuard(loginVisible=true){
  const alerts=[];
  const login={hidden:!loginVisible,getAttribute:()=>null};
  const window={
    document:{getElementById:id=>id==='login'?login:null},
    getComputedStyle:()=>({display:login.hidden?'none':'block',visibility:'visible'}),
    alert:message=>alerts.push(String(message))
  };
  vm.runInContext(loginGuardRuntime,vm.createContext({window}),{filename:'assets/rc1458-login-colli-guard.js'});
  return{window,login,alerts};
}

test('RC1458: normaler Benutzer ohne Firmenbindung sendet keinen globalen Firmenkontext an den Abholkalender',()=>{
  const options=loadCalendar({companyId:'ESSENTRA',currentCompanyId:'ESSENTRA',currentUser:{user:'Carsten',role:'Benutzer'},shipments:[]});
  assert.equal(options.companyId,'');
});

test('RC1458: normale Benutzer verwenden nur eine am Benutzer freigegebene Firma',()=>{
  const options=loadCalendar({companyId:'ESSENTRA',currentUser:{user:'Carsten',role:'Benutzer',companyId:'TENNECO'},shipments:[]});
  assert.equal(options.companyId,'TENNECO');
});

test('RC1458: globale Administratoren dürfen den aktiven Firmenkontext weiterhin verwenden',()=>{
  const options=loadCalendar({companyId:'ESSENTRA',currentUser:{user:'Tobias',role:'Globaler Administrator',globalAdmin:true},shipments:[]});
  assert.equal(options.companyId,'ESSENTRA');
});

test('RC1458: Backend-Firmenisolation bleibt unverändert streng',()=>{
  assert.match(companyContext,/wanted !== 'legacy-default'/,'Legacy-Fallback muss explizit erlaubt bleiben');
  assert.match(companyContext,/COMPANY_FORBIDDEN/,'Fremde Firmen müssen weiterhin serverseitig abgewiesen werden');
  assert.match(companyContext,/wanted \|\| allowed\[0\] \|\| 'legacy-default'/,'Ohne Client-Header muss der Server den erlaubten Kontext selbst wählen');
});

test('RC1458: Colli-Pflichtfeldmeldung darf auf dem sichtbaren Login-/Ladebildschirm nicht als Alert erscheinen',()=>{
  const target='Bitte Verpackung, Anzahl und Gewicht in jeder Colli-Zeile vollständig erfassen.';
  const runtime=loadLoginGuard(true);
  runtime.window.alert(target);
  assert.deepEqual(runtime.alerts,[]);

  runtime.window.alert('Andere wichtige Meldung');
  assert.deepEqual(runtime.alerts,['Andere wichtige Meldung']);

  runtime.login.hidden=true;
  runtime.window.alert(target);
  assert.deepEqual(runtime.alerts,['Andere wichtige Meldung',target]);
});

test('RC1458: Login-Guard bleibt vom RC1289 Auth-Transport-Fallback getrennt',()=>{
  assert.doesNotMatch(authRuntime,/RC1458|COLLI_LOGIN_GUARD|COLLI_MESSAGE/,'RC1289 darf nicht erneut für Login-/Colli-Verhalten erweitert werden');
  assert.match(loginGuardRuntime,/__EXPORTHUB_RC1458_LOGIN_COLLI_GUARD__/,'RC1458 braucht einen eigenen, isolierten Runtime-Guard');
  assert.doesNotMatch(loginGuardRuntime,/Bitte Verpackung|Colli-Zeile vollständig erfassen/,'Der Guard darf keinen hardcodierten deutschen UI-Text einführen');
});

test('RC1458: Produktionsbuild lädt den neuen Login-Guard ohne den RC1289 Sicherheitsvertrag umzuversionieren',()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  const releasePatch=fs.readFileSync('scripts/rc1458-login-calendar-release.mjs','utf8');
  assert.match(pkg.scripts.pretest,/rc1458-login-calendar-release\.mjs/,'Releasepatch muss vor der Gesamttest-/Buildkette laufen');
  assert.match(releasePatch,/'assets\/rc1012-abholkalender-runtime\.js'/,'Kalender-Runtime muss aus dem aktuellen assets-Verzeichnis in den Build kopiert werden');
  assert.match(releasePatch,/'assets\/rc1458-login-colli-guard\.js'/,'Login-Guard muss als eigenes Asset in den Build kopiert werden');
  assert.match(releasePatch,/rc1458-login-colli-guard\.js\?v=1458/,'Login-Guard braucht einen eigenen Browser-Cache-Key');
  assert.doesNotMatch(releasePatch,/rc1289-auth-transport-fallback\.js\?v=1458/,'RC1289 muss auf seinem verifizierten Cache-/Versionsvertrag bleiben');
  assert.match(releasePatch,/rc1289-auth-transport-fallback\.js\?v=1289/,'RC1289 v=1289 muss explizit erhalten bleiben');
  assert.match(releasePatch,/rc1012-abholkalender-runtime\.js\?v=1012&rc=1458/,'Kalender-Fix braucht einen neuen Browser-Cache-Key');
});
