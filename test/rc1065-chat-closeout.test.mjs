import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createTestI18n} from './helpers/i18n.mjs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1065: Main Contract reagiert auch auf beide Static-Web-App-Routenverträge',()=>{
  const wf=read('.github/workflows/rc1002-main-contract.yml');
  assert.match(wf,/staticwebapp\.config\.json/);
  assert.match(wf,/staticwebapp\.testservice\.config\.json/);
  const cfg=JSON.parse(read('staticwebapp.config.json'));
  for(const route of ['/','/index.html']){
    const row=cfg.routes.find(r=>r.route===route);
    assert.ok(row,route+' muss explizit vorhanden sein');
    assert.match(String(row.headers&&row.headers['Cache-Control']||''),/no-store/);
  }
});

test('RC1065: Abholkalender zeigt nur nicht abgeholte Sendungen und bleibt kompakt',()=>{
  const js=read('assets/abholkalender.js'),css=read('assets/abholkalender.css');
  assert.match(js,/shipments\.filter\(shipment => shipmentPickupDate\(shipment\) === dateKey && !shipmentIsCompleted\(shipment\)\)/);
  assert.match(js,/abgeholt\|pod vorhanden\|abgeschlossen\|archiviert/);
  assert.match(css,/RC1052: kompaktere Kalenderkarten/);
  assert.match(css,/\.pickup-item\{padding:7px 8px/);
});

test('RC1065: Dashboard-Aufgaben verwenden echte Fälligkeit und persönlichen Wochenfokus',()=>{
  const src=read('.github/rc1044/build-three-env.mjs');
  assert.match(src,/function workspaceTaskDate\(t\)\{var keys=\['dueDate','due','date','plannedDate','targetDate','deadline'\]/);
  assert.match(src,/workspaceTaskForUser\(t\) && workspaceTaskVisible\(t\)/);
  assert.match(src,/dayKey\(d\)<=todayKey\(\)/);
});

test('RC1065: ABD-Avis ist schnell erzeugbar und serverseitig erst ab Verfügbarkeit buchbar',()=>{
  const runtime=read('assets/rc1049-abd-avis-policy.js');
  const fixer=read('.github/rc1018/fix-mail-wording.mjs');
  const immediate=read('assets/rc1027-lieferavis-immediate.js');
  assert.match(runtime,/minutes<=810\?1:2/);
  assert.match(runtime,/expectedAvailableTime:'10:00'/);
  assert.match(runtime,/ABD NOCH NICHT VORHANDEN/);
  assert.match(fixer,/fastSnapshotIssue=action==='issue'/);
  assert.match(fixer,/ABD_PICKUP_TOO_EARLY/);
  assert.match(fixer,/enforceAbdAppointment\(state,target,payload\);applyAppointment/);
  assert.match(immediate,/async function issueDraftAvis/);
});

test('RC1065: POD-Speicherung und Blob-Dokumente bleiben nach Reload lesbar',()=>{
  const pod=read('.github/rc1044/build-three-env.mjs');
  const blob=read('assets/rc1059-document-blob.js');
  const api=read('api/exporthub-document/index.js');
  assert.match(pod,/POD-Sicherung nach manuellem Upload synchronisiert/);
  assert.match(pod,/flushSave\(reason,\{force:true,userInitiated:true\}\)/);
  assert.match(blob,/storage==='blob'/);
  assert.match(blob,/legacyUrl/);
  assert.match(api,/'Cache-Control':'private, no-store'/);
});

test('RC1065: QR-Bestandsschutz hält alte Linkparameter und resourceKey bei',()=>{
  const html=read('pickup.html'),access=read('api/shared/public-access-store.js');
  for(const p of ["searchParams.get('pickup')","searchParams.get('token')","searchParams.get('qr')","searchParams.get('ehcmd')","searchParams.get('ref')"]){
    assert.ok(html.includes(p),p+' fehlt');
  }
  assert.match(access,/resourceKey/);
});

test('RC1065: Wochenplan bleibt A4 Mo-Fr und NEFF wird erneut aus Live-Daten entfernt',()=>{
  const js=read('assets/abholkalender.js');
  const runtime=read('assets/rc1012-abholkalender-runtime.js');
  const seed=read('api/shared/rc1014-fixed-pickup-seed.js');
  assert.match(js,/const WEEKDAY_KEYS = Object\.freeze\(\{1:'pickupCalendar\.weekday\.1',2:'pickupCalendar\.weekday\.2',3:'pickupCalendar\.weekday\.3',4:'pickupCalendar\.weekday\.4',5:'pickupCalendar\.weekday\.5'\}\)/);
  assert.match(js,/pickupCalendar\.print\.reference/); assert.match(js,/pickupCalendar\.print\.quantity/);
  assert.match(runtime,/@page\{size:A4 landscape/);
  assert.match(seed,/const SEED_VERSION = 9;/);
  assert.match(seed,/isRemovedNeff/);
});

test('RC1065: Gate41 zeigt fehlende Tarifwerte nicht als korrekten Nulltarif',()=>{
  const ui=read('assets/rc1013-gate41-ui.js');
  assert.doesNotMatch(ui,/if\(!national\)base\.value='0\.00'/);
  assert.match(ui,/gate41\.unavailable/);
  assert.match(ui,/gate41\.noRate/);
});

test('RC1065: Avis-Ausnahmen und Pflicht-CC bleiben verbindlich',()=>{
  const avis=read('assets/rc1015-lieferavis-mail-flow.js');
  const cc=read('assets/rc1065-registration-cc.js');
  const fixer=read('.github/rc1018/fix-mail-wording.mjs');
  const finalBuilder=read('.github/rc1048/build-three-env.mjs');
  assert.match(avis,/bmp:'Kunden-IT blockiert den Zugriff'/);
  assert.match(avis,/'böllhof':'Kein Lieferavis für diesen Kunden'/);
  assert.match(cc,/Sevastian Marcu/);
  assert.match(cc,/Daniel Ollmann/);
  assert.match(cc,/SevastianMarcu@essentra\.com/);
  assert.match(cc,/DanielOllmann@essentra\.com/);
  assert.match(cc,/registrationCc\.blocked/);
  assert.match(fixer,/rc1065-registration-cc\.js\?v=1093/);
  assert.match(finalBuilder,/RC1065_CC_TAG/);
  assert.match(finalBuilder,/rc1065-registration-cc\.js\?v=1093/);
  assert.match(finalBuilder,/fs\.copyFileSync\(rc1065AssetSource,rc1065AssetTarget\)/);
});

test('RC1065: mobile Navigation und Navigation ohne F5-Logout bleiben enthalten',()=>{
  const mobile=read('assets/rc1016-mobile-navigation.js');
  const cfg=read('staticwebapp.config.json');
  assert.match(mobile,/ExportHUBRC1016MobileNavigation/);
  assert.match(cfg,/navigationFallback/);
});


test('RC1065: Pflicht-CC Runtime nutzt die persistente Settings-Konfiguration und blockiert bei unvollständiger Pflege',()=>{
  const source=read('assets/rc1065-registration-cc.js');
  const appState={settings:{registrationMandatoryCc:[
    {name:'Sevastian Marcu',email:'sevastian@example.com'},
    {name:'Daniel Ollmann',email:'daniel@example.com'}
  ]}};
  const window={ExportHUBI18n:createTestI18n('de'),__EXPORTHUB_GET_STATE__:()=>appState};
  const context={window,URLSearchParams,console};
  vm.runInNewContext(source,context,{filename:'rc1065-registration-cc.js'});
  const api=window.ExportHUBRC1065RegistrationCC;
  assert.ok(api,'CC-Runtime API fehlt');

  const prepared=api.prepare('mailto:carrier@example.com?subject=Sendungsanmeldung%20ABC123&cc=existing@example.com&body=Bitte%20abholen');
  assert.equal(prepared.ok,true);
  assert.equal(prepared.required,true);
  const decoded=decodeURIComponent(prepared.url);
  assert.match(decoded,/existing@example\.com/);
  assert.match(decoded,/sevastian@example\.com/);
  assert.match(decoded,/daniel@example\.com/);

  const plusSensitive=api.prepare('mailto:carrier@example.com?subject=Lieferavis%20DVT8ZZ&body=Sehr%20geehrte%20Damen%20und%20Herren%2C%0AReferenz%3A%20DVT8ZZ');
  assert.equal(plusSensitive.ok,true);
  assert.equal(plusSensitive.url.includes('Sehr+geehrte'),false);
  assert.match(plusSensitive.url,/body=Sehr%20geehrte%20Damen%20und%20Herren/);

  appState.settings.registrationMandatoryCc=[{name:'Sevastian Marcu',email:'sevastian@example.com'}];
  const withFallback=api.prepare('mailto:carrier@example.com?subject=Lieferavis%20ABC123');
  assert.equal(withFallback.ok,true);
  assert.deepEqual(Array.from(withFallback.missing),[]);
  assert.match(decodeURIComponent(withFallback.url).toLowerCase(),/danielollmann@essentra\.com/);

  const normal=api.prepare('mailto:test@example.com?subject=Hallo');
  assert.equal(normal.ok,true);
  assert.equal(normal.required,false);
});

test('RC1089: Pflicht-CC erkennt Benutzer auch bei Kurzname oder abweichendem Login über die echte E-Mail',()=>{
  const source=read('assets/rc1065-registration-cc.js');
  const appState={users:[
    {name:'Sevastian',email:'SevastianMarcu@essentra.com'},
    {name:'Daniel',user:'D.Ollmann',email:'DanielOllmann@essentra.com'}
  ]};
  const window={ExportHUBI18n:createTestI18n('de'),__EXPORTHUB_GET_STATE__:()=>appState};
  const context={window,URLSearchParams,console};
  vm.runInNewContext(source,context,{filename:'rc1065-registration-cc.js'});
  const prepared=window.ExportHUBRC1065RegistrationCC.prepare('mailto:carrier@example.com?subject=Sendungsanmeldung%20ABC123');
  assert.equal(prepared.ok,true);
  assert.equal(prepared.required,true);
  const decoded=decodeURIComponent(prepared.url).toLowerCase();
  assert.match(decoded,/sevastianmarcu@essentra\.com/);
  assert.match(decoded,/danielollmann@essentra\.com/);
});

test('RC1089: bestätigte Pflicht-CC-Adressen funktionieren auch ohne Benutzerstamm oder gespeicherte CC-Einstellungen',()=>{
  const source=read('assets/rc1065-registration-cc.js');
  const appState={settings:{}};
  const window={ExportHUBI18n:createTestI18n('de'),__EXPORTHUB_GET_STATE__:()=>appState};
  const context={window,URLSearchParams,console};
  vm.runInNewContext(source,context,{filename:'rc1065-registration-cc.js'});
  const prepared=window.ExportHUBRC1065RegistrationCC.prepare('mailto:carrier@example.com?subject=Sendungsanmeldung%20ABC123');
  assert.equal(prepared.ok,true);
  assert.equal(prepared.required,true);
  assert.deepEqual(Array.from(prepared.missing),[]);
  const decoded=decodeURIComponent(prepared.url).toLowerCase();
  assert.match(decoded,/sevastianmarcu@essentra\.com/);
  assert.match(decoded,/danielollmann@essentra\.com/);
});

test('RC1089: Pflicht-CC durchsucht auch verschachtelte Benutzerlisten und Profil-E-Mailfelder',()=>{
  const source=read('assets/rc1065-registration-cc.js');
  const appState={state:{users:[
    {displayName:'Sevastian Marcu',profile:{email:'sevastian.marcu@example.com'}},
    {displayName:'Daniel Ollmann',contact:{emailAddress:'daniel.ollmann@example.com'}}
  ]}};
  const window={ExportHUBI18n:createTestI18n('de'),__EXPORTHUB_GET_STATE__:()=>appState};
  const context={window,URLSearchParams,console};
  vm.runInNewContext(source,context,{filename:'rc1065-registration-cc.js'});
  const resolved=window.ExportHUBRC1065RegistrationCC.resolve();
  assert.equal(resolved.ok,true);
  assert.deepEqual(Array.from(resolved.missing),[]);
  assert.deepEqual(Array.from(resolved.addresses).sort(),['daniel.ollmann@example.com','sevastian.marcu@example.com']);
});

test('RC1065: Pflicht-CC Settings speichern bestätigt in Azure und rollen bei Fehler zurück',async()=>{
  const source=read('assets/rc1065-registration-cc.js');
  const appState={settings:{}};
  const calls=[];
  const window={ExportHUBI18n:createTestI18n('de'),
    __EXPORTHUB_GET_STATE__:()=>appState,
    ExportHUBClean:{
      async queueSave(reason){calls.push(['queue',reason]);return true},
      async flushSave(reason,options){calls.push(['flush',reason,options]);return true}
    },
    dispatchEvent(){return true}
  };
  const context={window,URLSearchParams,console,CustomEvent:function(name,init){this.type=name;this.detail=init&&init.detail}};
  vm.runInNewContext(source,context,{filename:'rc1065-registration-cc.js'});
  const api=window.ExportHUBRC1065RegistrationCC;
  const next=[{name:'Sevastian Marcu',email:'sevastian@example.com'},{name:'Daniel Ollmann',email:'daniel@example.com'}];
  assert.equal(await api.persistCcSettings(next),true);
  assert.equal(appState.settings.registrationMandatoryCc,next);
  assert.equal(calls.length,2);
  assert.equal(calls[0][0],'queue');
  assert.equal(calls[1][0],'flush');
  assert.equal(calls[1][2].force,true);
  assert.equal(calls[1][2].userInitiated,true);

  const previous=appState.settings.registrationMandatoryCc;
  window.ExportHUBClean.flushSave=async()=>false;
  await assert.rejects(()=>api.persistCcSettings([{name:'Sevastian Marcu',email:'changed@example.com'}]),/nicht bestätigt/);
  assert.equal(appState.settings.registrationMandatoryCc,previous,'bei fehlender Azure-Bestätigung muss der vorherige CC-Stand erhalten bleiben');
});

test('RC1065: Global Admin kann beide Pflicht-CC-Adressen in Einstellungen dauerhaft pflegen',()=>{
  const source=read('assets/rc1065-registration-cc.js');
  assert.match(source,/rc1065RegistrationCcSettings/);
  assert.match(source,/registrationCc\.save/);
  assert.match(source,/Sevastian Marcu/);
  assert.match(source,/Daniel Ollmann/);
  assert.match(source,/settings\.registrationMandatoryCc=next/);
  assert.match(source,/queueSave\('Pflicht-CC Anmeldung gespeichert'\)/);
  assert.match(source,/flushSave\('Pflicht-CC Anmeldung gespeichert',\{force:true,userInitiated:true\}\)/);
  assert.match(source,/if\(!globalAdmin\(\)\|\|!settingsVisible\(\)\)/);
  assert.match(source,/@media\(max-width:720px\)/);
});


test('RC1087: Pflicht-CC Adminprüfung verwechselt Funktionsadministratoren nicht mit globalen Admins',()=>{
  const source=read('assets/rc1065-registration-cc.js');
  assert.match(source,/roles=\['global admin','globaler administrator','globaler admin','administrator','admin','vollzugriff'\]/);
  assert.match(source,/roles\.indexOf\(role\)>=0/);
  assert.doesNotMatch(source,/u\.isAdmin===true|u\.admin===true/);
  assert.doesNotMatch(source,/vollzugriff\/\.test\(role\)/);
});


test('RC1093: Pflicht-CC Asset wird mit neuer Cache-Version ausgeliefert',()=>{
  const fixer=read('.github/rc1018/fix-mail-wording.mjs');
  const finalBuilder=read('.github/rc1048/build-three-env.mjs');
  const workflow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  const runtime=read('assets/rc1065-registration-cc.js');
  for(const src of [fixer,finalBuilder,workflow])assert.match(src,/rc1065-registration-cc\.js\?v=1093/);
  assert.doesNotMatch(fixer,/rc1065-registration-cc\.js\?v=1089/);
  assert.doesNotMatch(finalBuilder,/rc1065-registration-cc\.js\?v=1089/);
  assert.doesNotMatch(workflow,/rc1065-registration-cc\.js\?v=1089/);
  assert.match(runtime,/version:'RC1093'/);
});

test('RC1093: bestätigte Pflicht-CC-Fallbacks machen die Anmeldung unabhängig vom Benutzerstamm',()=>{
  const source=read('assets/rc1065-registration-cc.js');
  const appState={users:[],settings:{}};
  const window={ExportHUBI18n:createTestI18n('de'),__EXPORTHUB_GET_STATE__:()=>appState};
  const context={window,URLSearchParams,console};
  vm.runInNewContext(source,context,{filename:'rc1065-registration-cc.js'});
  const prepared=window.ExportHUBRC1065RegistrationCC.prepare('mailto:carrier@example.com?subject=Sendungsanmeldung%20ABC123');
  assert.equal(prepared.ok,true);
  assert.deepEqual(Array.from(prepared.missing),[]);
  const decoded=decodeURIComponent(prepared.url).toLowerCase();
  assert.match(decoded,/sevastianmarcu@essentra\.com/);
  assert.match(decoded,/danielollmann@essentra\.com/);
});
