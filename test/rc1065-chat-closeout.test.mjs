import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  assert.match(js,/const WEEKDAYS = Object\.freeze\(\{1:'Montag',2:'Dienstag',3:'Mittwoch',4:'Donnerstag',5:'Freitag'\}\)/);
  assert.match(js,/Ref: \$\{esc\(ref\)\} · Anzahl: \$\{collis\.expected\}/);
  assert.match(runtime,/@page\{size:A4 landscape/);
  assert.match(seed,/const SEED_VERSION = 8;/);
  assert.match(seed,/isRemovedNeff/);
});

test('RC1065: Gate41 zeigt fehlende Tarifwerte nicht als korrekten Nulltarif',()=>{
  const ui=read('assets/rc1013-gate41-ui.js');
  assert.doesNotMatch(ui,/if\(!national\)base\.value='0\.00'/);
  assert.match(ui,/nicht berechenbar/);
  assert.match(ui,/Für Deutschland konnte trotz gültiger Paletten- und Gewichtsdaten kein Grundtarif berechnet werden/);
});

test('RC1065: Avis-Ausnahmen und Pflicht-CC bleiben verbindlich',()=>{
  const avis=read('assets/rc1015-lieferavis-mail-flow.js');
  const cc=read('assets/rc1065-registration-cc.js');
  const fixer=read('.github/rc1018/fix-mail-wording.mjs');
  assert.match(avis,/bmp:'Kunden-IT blockiert den Zugriff'/);
  assert.match(avis,/'böllhof':'Kein Lieferavis für diesen Kunden'/);
  assert.match(cc,/Sevastian Marcu/);
  assert.match(cc,/Daniel Ollmann/);
  assert.match(cc,/Pflicht-CC konnte nicht aus den ExportHUB-Benutzerdaten aufgelöst werden/);
  assert.match(fixer,/rc1065-registration-cc\.js\?v=1065/);
});

test('RC1065: mobile Navigation und Navigation ohne F5-Logout bleiben enthalten',()=>{
  const mobile=read('assets/rc1016-mobile-navigation.js');
  const cfg=read('staticwebapp.config.json');
  assert.match(mobile,/ExportHUBRC1016MobileNavigation/);
  assert.match(cfg,/navigationFallback/);
});
