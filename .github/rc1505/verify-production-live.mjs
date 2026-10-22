import assert from 'node:assert/strict';

const PROD='https://wonderful-forest-0f315e310.7.azurestaticapps.net';
const TEST='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
const BRANDED='https://www.exporthub360.de';
const RELEASE_SHA=process.env.RELEASE_SHA||process.env.GITHUB_SHA||'manual';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function request(url,{method='GET',headers,body,status=200,attempts=8}={}){
  let lastStatus=0,lastBody='',lastError='';
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const separator=url.includes('?')?'&':'?';
      const response=await fetch(`${url}${separator}rc1505=${encodeURIComponent(RELEASE_SHA)}-${attempt}`,{
        method,headers,body,redirect:'follow',signal:AbortSignal.timeout(20000)
      });
      lastStatus=response.status;
      lastBody=await response.text();
      if(response.status===status)return {status:response.status,body:lastBody};
      lastError=`HTTP ${response.status}`;
    }catch(error){lastError=String(error&&error.message||error);}
    if(attempt<attempts)await pause(5000);
  }
  throw new Error(`RC1505 Livevertrag fehlgeschlagen: ${url} erwartet HTTP ${status}, zuletzt ${lastStatus||lastError}; Body=${lastBody.slice(0,240)}`);
}

function markers(label,body,required=[],forbidden=[]){
  for(const marker of required)assert.ok(body.includes(marker),`${label}: Marker fehlt: ${marker}`);
  for(const marker of forbidden)assert.ok(!body.includes(marker),`${label}: veralteter/unerlaubter Marker vorhanden: ${marker}`);
}

async function page(base,path='/',required=[],forbidden=[]){
  const result=await request(`${base}${path}`);
  markers(`${base}${path}`,result.body,required,forbidden);
  return result.body;
}

console.log('RC1505 historische Production-Live-Verträge: Start');

const production=await page(PROD,'/',[
  'ExportHUB RC1112 environment=production-candidate',
  "version:'RC1112'",
  'assets/rc1016-mobile-navigation.js?v=1400',
  'assets/rc1014-shipment-overview.js?v=1370',
  'assets/rc1014-shipment-overview.css?v=1370',
  'assets/rc1065-registration-cc.js?v=1093',
  'assets/rc1077-customer-labels.js?v=1394',
  'assets/rc1079-profile-settings.js?v=1079',
  'assets/rc1080-customer-history.js?v=1080',
  'assets/rc1081-audit-history.js?v=1177',
  'assets/rc1092-customer-mail-contacts.js?v=1600',
  'assets/abholkalender.js?v=1012',
  'assets/rc1012-abholkalender-runtime.js?v=1012',
  'assets/rc1074-login-clean.js?v=1630',
  'assets/rc1013-diagnostics.js?v=1364',
  'assets/rc1013-gate41-ui.js?v=1385',
  'assets/rc1017-multi-truck.js?v=1017',
  'assets/rc1305-loading-list-print.js?v=1379',
  'assets/rc1315-loading-list-quick-print.js?v=1322',
  'assets/rc1027-lieferavis-immediate.js?v=20261005'
]);

const testservice=await page(TEST,'/',[
  'ExportHUB RC1112 environment=testservice',
  "version:'RC1112'",
  'assets/rc1016-mobile-navigation.js?v=1400',
  'assets/rc1014-shipment-overview.js?v=1370',
  'assets/rc1014-shipment-overview.css?v=1370',
  'assets/rc1065-registration-cc.js?v=1093',
  'assets/rc1077-customer-labels.js?v=1394',
  'assets/rc1079-profile-settings.js?v=1079',
  'assets/rc1080-customer-history.js?v=1080',
  'assets/rc1081-audit-history.js?v=1177',
  'assets/rc1092-customer-mail-contacts.js?v=1600',
  'assets/abholkalender.js?v=1012',
  'assets/rc1012-abholkalender-runtime.js?v=1012',
  'assets/rc1074-login-clean.js?v=1630',
  'assets/rc1013-diagnostics.js?v=1364',
  'assets/rc1013-gate41-ui.js?v=1385',
  'assets/rc1017-multi-truck.js?v=1017',
  'assets/rc1305-loading-list-print.js?v=1379',
  'assets/rc1315-loading-list-quick-print.js?v=1322',
  'assets/rc1027-lieferavis-immediate.js?v=20261005'
]);

const demo=await page(TEST,'/demo.html',[
  'ExportHUB RC1112 environment=demo',
  "version:'RC1112'",
  'assets/rc1016-mobile-navigation.js?v=1400',
  'assets/rc1014-shipment-overview.js?v=1370',
  'assets/rc1014-shipment-overview.css?v=1370',
  'assets/rc1065-registration-cc.js?v=1093',
  'assets/rc1077-customer-labels.js?v=1394',
  'assets/rc1092-customer-mail-contacts.js?v=1600',
  'assets/abholkalender.js?v=1012',
  'assets/rc1012-abholkalender-runtime.js?v=1012',
  'assets/rc1074-login-clean.js?v=1630',
  'assets/rc1013-gate41-ui.js?v=1385',
  'assets/rc1017-multi-truck.js?v=1017',
  'assets/rc1305-loading-list-print.js?v=1379',
  'assets/rc1027-lieferavis-immediate.js?v=20261005'
]);

// RC1018 Kalenderbasis live in Produktion und TESTSERVICE.
for(const base of [PROD,TEST]){
  const calendar=(await request(`${base}/assets/abholkalender.js`)).body;
  const runtime=(await request(`${base}/assets/rc1012-abholkalender-runtime.js`)).body;
  markers('RC1018 Kalender',calendar,['calendarScalarText']);
  markers('RC1018 Kalender-Runtime',runtime,['companyId']);
}

// RC1017/RC1320 Mehr-LKW-Browserintegration.
for(const [label,body] of [['production',production],['testservice',testservice],['demo',demo]]){
  markers(`RC1018 Mehr-LKW ${label}`,body,['function rc1017SyncSubShipments(','rc1017-qr-subshipment','rc1017-print-subshipment']);
}
for(const base of [PROD,TEST]){
  const multi=(await request(`${base}/assets/rc1017-multi-truck.js`)).body;
  markers('RC1018 Mehr-LKW Runtime',multi,['ExportHubMultiTruck']);
}

// RC1041 Gate41 nationaler/i18n-Vertrag.
for(const base of [PROD,TEST]){
  const gate=(await request(`${base}/assets/rc1013-gate41-ui.js`)).body;
  markers('RC1041 Gate41',gate,['gate41.calculated']);
}

// RC1092 Kundenkontakte / AVIS-Kundensteuerung.
for(const base of [PROD,TEST]){
  const contacts=(await request(`${base}/assets/rc1092-customer-mail-contacts.js`)).body;
  markers('RC1092 Kundenkontakte',contacts,['__EXPORTHUB_RC1092_CUSTOMER_MAIL_CONTACTS__','data-rc1092-avis-toggle','customerAvisLinkEnabled','customerContacts.savePerson','customerContacts.addToMail']);
  const avis=(await request(`${base}/assets/rc1015-lieferavis-mail-flow.js`)).body;
  markers('RC1092 AVIS-Kundensteuerung',avis,['function rc1330AvisPolicyBlock','customer-policy','customerAvisLinkEnabled']);
}

// RC1543 Palettenkonto-Kontostand bleibt Teil der Ladeliste.
for(const [label,body] of [['production',production],['testservice',testservice]]){
  markers(`RC1543 Palettenkonto-Kontostand ${label}`,body,['function rc1095LoadPalletHtml','rc1095-pallet-account','Palettenkonto','Europaletten-Kontostand / EUR pallet balance','data-rc1543-pallet-balance','palletBalanceCacheKey','rc1095LoadPalletCount(sh,rows(sh))']);
}

// RC1106/RC1177 Historie + Release Notes.
for(const base of [PROD,TEST]){
  const history=(await request(`${base}/assets/rc1081-audit-history.js`)).body;
  markers('RC1177 Historie',history,['__EXPORTHUB_RC1081_AUDIT_HISTORY__','ExportHUBShipmentHistory1071','customerHistory','auditLog','function taskEvents(t)','function palletEvents(p,index)']);
  const shipmentHistory=(await request(`${base}/assets/rc1071-shipment-history.js`)).body;
  markers('RC1106 Sendungshistorie',shipmentHistory,['mail-sent-open|','recordMailSent','shipmentHistory.action.abdMailSent','shipmentHistory.action.workStarted','shipmentHistory.action.registrationStarted']);
  const notes=(await request(`${base}/assets/rc1177-release-notes.js`)).body;
  markers('RC1177 Release Notes',notes,['data-rc1177-release-notes','Aktueller ExportHUB-Stand']);
}

// RC1298/RC1301/RC1303 Login-Runtime cache-frisch und ohne technische Hinweise.
for(const base of [PROD,TEST]){
  await request(`${base}/assets/rc1074-login-clean.js`);
}
for(const [label,body] of [['production',production],['testservice',testservice]]){
  markers(`RC1074 Login ${label}`,body,[],['Anmeldekonfiguration wird geprüft','Auth-Backend wird geprüft']);
}

// RC1364 Diagnose-Autofix: Runtime live, anonymer API-Aufruf bleibt geschützt.
for(const base of [PROD,TEST]){
  const diagnostics=(await request(`${base}/assets/rc1013-diagnostics.js`)).body;
  markers('RC1364 Diagnose',diagnostics,['diagnostics.fixWithChatgpt','__EXPORTHUB_RC1125_DIAGNOSTICS_VIEW_ISOLATION__','/api/diagnostic-autofix','diagnostics.title']);
  const protectedCall=await request(`${base}/api/diagnostic-autofix`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'configuration'}),
    status:401
  });
  assert.match(protectedCall.body,/AUTH_REQUIRED|SESSION_INVALID/,'RC1364 Diagnose-API muss anonymen Zugriff ablehnen');
}

// RC1379 Produktions-Drucklayout live verifizieren.
const printRuntime=(await request(`${PROD}/assets/rc1305-loading-list-print.js`)).body;
markers('RC1379 Produktions-Drucklayout live verifizieren',printRuntime,[
  'data-rc1361-print-qr-top-right',
  "important(section,'top','8mm')",
  "important(section,'right','8mm')",
  "important(code,'width','12mm')",
  "important(svg,'width','12mm')",
  'display:flex!important',
  'flex-direction:column!important',
  'data-rc1363-document-density',
  'font-size:6.2pt!important',
  'align-items:flex-start!important;gap:',
  'align-self:flex-start!important;flex:0 1 auto!important;width:fit-content!important',
  'enhanceRecipient(root,sh||{});enhanceDocuments(root,sh||{})',
  'rc1305-meta-loader',
  'rc1305-meta-plate',
  'rc1305-signature-primary',
  'grid-template-columns:repeat(3,minmax(0,1fr))'
],['rc1305-signature-customs','docColumns=Math.max(1,Math.ceil(docCount/15))']);

// RC1373 Nur-Deckblatt Produktionspfad live verifizieren.
const coverRuntime=(await request(`${PROD}/assets/rc1203-deckblatt-print.js`)).body;
markers('RC1373 Nur-Deckblatt Produktionspfad live verifizieren',production,['assets/rc1203-deckblatt-print.js?v=1373','__EXPORTHUB_PRINT_MODE_OVERRIDE__']);
markers('RC1373 Nur-Deckblatt Runtime',coverRuntime,["__EXPORTHUB_PRINT_MODE_OVERRIDE__='cover'","version:'RC1373'"]);

// RC1374 ExportHUB360 Marken-Domain prüfen – release-blocking, bewusst .de.
const branded=(await request(`${BRANDED}/avis/RC1374TEST`)).body;
markers('RC1374 ExportHUB360 Marken-Domain prüfen',branded,["pathMatch=String(u.pathname||'').match(/\\/avis\\/"]);

// RC1383 AVIS-Runtimes cache-frisch.
for(const base of [PROD,TEST]){
  const immediate=(await request(`${base}/assets/rc1027-lieferavis-immediate.js`)).body;
  markers('RC1383 Lieferavis Runtime',immediate,["version:'RC1069'"]);
}

// RC1322 Direktdruck-Setup wird aus dem gemeinsam kopierten assets-Baum ausgeliefert.
for(const base of [PROD,TEST]){
  const setup=(await request(`${base}/assets/tools/ExportHUB-DirectPrint-Setup.ps1`)).body;
  markers('RC1322 Direktdruck-Setup',setup,['SilentPrintingEnabled','PrintPreviewUseSystemDefaultPrinter','Get-CimInstance Win32_Printer']);
}

// RC1525 + RC1586 QR-Abholseite: Fachfelder und tatsächliche RC1585-Abschlusslogik müssen live ausgeliefert werden.
const rc1586PickupLiveMarkers=[
  'id="sealNumber"',
  'id="containerPhotoLoaded"',
  'id="containerPhotoNumber"',
  'id="containerPhotoSealed"',
  'id="customsDocumentsField"',
  'function pickupCompletionState(data)',
  'if(data.teamStateSynced===false||data.teamStateSyncPending===true||data.oneTimeConsumed===false)',
  'data.podAzureSaved!==true||data.podArchiveSaved!==true',
  'if(showPendingPickupCompletion(data)){recoverPickup.disabled=false;return}',
  'if(showPendingPickupCompletion(data))return;'
];
await page(PROD,'/pickup.html',rc1586PickupLiveMarkers);
await page(TEST,'/pickup.html',rc1586PickupLiveMarkers);

console.log('RC1505 historische Production-/TESTSERVICE-Live-Verträge erfolgreich bestätigt.');
