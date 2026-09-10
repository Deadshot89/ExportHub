import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/exporthub-state/index.js','utf8');

function block(startMarker,endMarker){
  const start=source.indexOf(startMarker);
  assert.ok(start>=0,`${startMarker} fehlt`);
  const end=source.indexOf(endMarker,start+startMarker.length);
  assert.ok(end>start,`${endMarker} fehlt`);
  return source.slice(start,end);
}

test('RC1026: Team-Blob speichert Benutzer nicht doppelt in state.users',()=>{
  const save=block('async function saveMerged(','/* RC614:');
  assert.match(save,/delete merged\.users/,'eingehende state.users müssen vor dem Speichern entfernt werden');
  assert.doesNotMatch(save,/merged\.users\s*=/,'state.users darf nicht erneut in den Team-Blob geschrieben werden');

  const client=block('function clientStateForRead(','async function metadataOnly(');
  assert.match(client,/key===['"]users['"]/,'persistierte Altbestände von state.users müssen beim Lesen ignoriert werden');
  assert.match(client,/out\.state\.users=clone\(out\.users\)/,'Clients müssen users weiterhin im bisherigen State-Format erhalten');
});

test('RC1026: Save-Telemetrie zeigt Uploadgröße und Konfliktanzahl',()=>{
  assert.match(source,/uploadBytes/,'Uploadgröße fehlt in der Save-Telemetrie');
  assert.match(source,/conflictCount/,'Konfliktanzahl fehlt in der Save-Telemetrie');
  assert.match(source,/X-ExportHUB-Upload-Bytes/,'Uploadgröße fehlt in den Response-Headern');
  assert.match(source,/X-ExportHUB-Save-Conflicts/,'Konfliktanzahl fehlt in den Response-Headern');
});
