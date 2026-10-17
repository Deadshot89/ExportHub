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

test('RC1557: unveränderte Teamdaten werden vor Revision und Blob-Upload als No-Op beendet',()=>{
  assert.match(source,/function\s+storageStateEquivalent\s*\(/,'semantischer State-Vergleich fehlt');
  const save=block('async function saveMerged(','/* RC614:');
  const guard=save.indexOf('storageStateEquivalent(current.state||{},merged)');
  const revision=save.indexOf('revision:Number(current.revision||0)+1');
  const upload=save.indexOf('uploadJson(blob,next,d.etag)');
  assert.ok(guard>=0,'No-Op-Guard fehlt in saveMerged');
  assert.ok(revision>guard,'No-Op-Prüfung muss vor dem Hochzählen der Revision erfolgen');
  assert.ok(upload>guard,'No-Op-Prüfung muss vor dem Blob-Upload erfolgen');
  assert.match(save,/noopSave\s*=\s*true/,'No-Op-Antwort muss als solche markiert werden');
  assert.match(save,/uploadBytes\s*:\s*0/,'No-Op-Save darf keine Uploadbytes melden');
});
