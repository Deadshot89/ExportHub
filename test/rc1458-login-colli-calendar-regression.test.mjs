import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const calendarRuntime=fs.readFileSync('assets/rc1012-abholkalender-runtime.js','utf8');
const authRuntime=fs.readFileSync('assets/rc1289-auth-transport-fallback.js','utf8');

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

function loadAuthGuard(loginVisible=true){
  const alerts=[];
  const login={hidden:!loginVisible,getAttribute:()=>null};
  const window={
    location:{href:'https://www.exporthub360.de/',origin:'https://www.exporthub360.de'},
    document:{getElementById:id=>id==='login'?login:null},
    getComputedStyle:()=>({display:login.hidden?'none':'block',visibility:'visible'}),
    alert:message=>alerts.push(String(message)),
    fetch:()=>Promise.resolve({ok:true}),
    XMLHttpRequest:function(){},
    URL
  };
  vm.runInContext(authRuntime,vm.createContext({window,URL,Date,Promise,Error,TypeError,setTimeout,clearTimeout}),{filename:'assets/rc1289-auth-transport-fallback.js'});
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

test('RC1458: Colli-Pflichtfeldmeldung darf auf dem sichtbaren Login-/Ladebildschirm nicht als Alert erscheinen',()=>{
  const target='Bitte Verpackung, Anzahl und Gewicht in jeder Colli-Zeile vollständig erfassen.';
  const runtime=loadAuthGuard(true);
  runtime.window.alert(target);
  assert.deepEqual(runtime.alerts,[]);

  runtime.window.alert('Andere wichtige Meldung');
  assert.deepEqual(runtime.alerts,['Andere wichtige Meldung']);

  runtime.login.hidden=true;
  runtime.window.alert(target);
  assert.deepEqual(runtime.alerts,['Andere wichtige Meldung',target]);
});

test('RC1458: Produktionsbuild nimmt beide reparierten Runtimes mit Cache-Busting aus dem aktuellen Quellstand',()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  const releasePatch=fs.readFileSync('scripts/rc1458-login-calendar-release.mjs','utf8');
  assert.match(pkg.scripts.pretest,/rc1458-login-calendar-release\.mjs/,'Releasepatch muss vor der Gesamttest-/Buildkette laufen');
  assert.match(releasePatch,/'assets\/rc1012-abholkalender-runtime\.js'/,'Kalender-Runtime muss aus dem aktuellen assets-Verzeichnis in den Build kopiert werden');
  assert.match(releasePatch,/rc1289-auth-transport-fallback\.js\?v=1458/,'Login-Guard braucht einen neuen Browser-Cache-Key');
  assert.match(releasePatch,/rc1012-abholkalender-runtime\.js\?v=1012&rc=1458/,'Kalender-Fix braucht einen neuen Browser-Cache-Key');
});
