import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page=fs.readFileSync('pickup.html','utf8');
const functionSource=page.match(/function pickupCompletionState\(data\)\{[\s\S]*?\n\}/);
assert.ok(functionSource,'RC1585 pickupCompletionState fehlt');
const state=vm.runInNewContext('('+functionSource[0]+')');

const good={
  complete:true,
  teamStateSynced:true,
  teamStateSyncPending:false,
  oneTimeConsumed:true,
  podAzureSaved:true,
  podArchiveSaved:true
};

test('RC1585: nur vollständig synchronisiert + Haupt-POD + Archiv darf als abgeschlossen gelten',()=>{
  assert.equal(state(good),'done');
  assert.equal(state({...good,complete:false}),'pending');
  assert.equal(state({...good,teamStateSynced:false}),'sync');
  assert.equal(state({...good,teamStateSyncPending:true}),'sync');
  assert.equal(state({...good,oneTimeConsumed:false}),'sync');
  assert.equal(state({...good,podAzureSaved:false}),'archive');
  assert.equal(state({...good,podArchiveSaved:false}),'archive');
  assert.equal(state({...good,podArchiveSaved:undefined}),'archive');
  assert.equal(state({...good,podAzureSaved:undefined}),'archive');
  assert.equal(state(null),'pending');
});

test('RC1585: Erstbestätigung darf ohne gesichertes POD / Team-Sync keinen grünen Abschluss zeigen',()=>{
  const start=page.indexOf("request('pickup-confirm-v2'",page.indexOf("form.addEventListener('submit'"));
  const finish=page.slice(start);
  assert.ok(start>0,'Pickup-Abschluss-Endpunkt fehlt');
  assert.match(finish,/if\(showPendingPickupCompletion\(data\)\)return;/);
  assert.ok(finish.indexOf('if(showPendingPickupCompletion(data))return;')<finish.indexOf('Abholung erfolgreich übertragen'));
  assert.match(page,/form\.hidden=true;[\s\S]*?recovery\.hidden=false;[\s\S]*?Keine zweite Abholung durchführen/);
});

test('RC1585: Recovery behält PIN-Maske bei offenem Sync/POD und lässt neuen sicheren Versuch zu',()=>{
  const recovery=page.slice(page.indexOf("if(recoverPickup)recoverPickup.addEventListener"),page.indexOf('function checkColli'));
  assert.match(recovery,/if\(showPendingPickupCompletion\(data\)\)\{recoverPickup\.disabled=false;return\}/);
  assert.ok(recovery.indexOf('if(showPendingPickupCompletion(data))')<recovery.indexOf('Abholung vollständig abgeschlossen'));
});

test('RC1585: Teilabholung mit fehlender Synchronisierung wird nicht als grün dargestellt',()=>{
  assert.match(page,/syncPending=data\.teamStateSynced===false\|\|data\.teamStateSyncPending===true/);
  assert.match(page,/syncPending\?'bad':'ok'/);
  assert.match(page,/Teilabholung nicht erneut bestätigen/);
});
