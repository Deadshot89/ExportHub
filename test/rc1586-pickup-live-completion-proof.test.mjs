import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const live=fs.readFileSync('.github/rc1505/verify-production-live.mjs','utf8');
const build=fs.readFileSync('.github/rc1505/verify-build-contract.mjs','utf8');
const page=fs.readFileSync('pickup.html','utf8');

const required=[
  'function pickupCompletionState(data)',
  'if(data.teamStateSynced===false||data.teamStateSyncPending===true||data.oneTimeConsumed===false)',
  'data.podAzureSaved!==true||data.podArchiveSaved!==true',
  'if(showPendingPickupCompletion(data)){recoverPickup.disabled=false;return}',
  'if(showPendingPickupCompletion(data))return;'
];

test('RC1586: Production- und TESTSERVICE-Live-Gate prüfen tatsächlichen RC1585-Code',()=>{
  assert.match(live,/await page\(PROD,'\/pickup\.html',rc1586PickupLiveMarkers\)/);
  assert.match(live,/await page\(TEST,'\/pickup\.html',rc1586PickupLiveMarkers\)/);
  for(const marker of required){
    assert.ok(page.includes(marker),'Abholseite hat Marker nicht: '+marker);
    assert.ok(live.includes(marker),'Release-Live-Gate prüft Marker nicht: '+marker);
  }
});

test('RC1586: Azure-Build-Gate prüft Abschlusslogik vor Veröffentlichung',()=>{
  for(const marker of required.filter(m=>!m.includes('teamStateSynced'))){
    assert.ok(build.includes("includes('dist-rc1112/pickup.html','"+marker+"');"),'Build-Gate fehlt: '+marker);
  }
});

test('RC1586: keine grüne Erfolgsmeldung vor Recovery- und POD-Prüfung',()=>{
  const recovery=page.indexOf('if(showPendingPickupCompletion(data)){recoverPickup.disabled=false;return}');
  const complete=page.indexOf('if(showPendingPickupCompletion(data))return;');
  assert.ok(recovery>0&&complete>recovery);
  assert.ok(complete<page.indexOf('Abholung erfolgreich übertragen'));
});
