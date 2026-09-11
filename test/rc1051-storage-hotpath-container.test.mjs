import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path,'utf8');

function fnBlock(source,startMarker,endMarker){
  const start=source.indexOf(startMarker);
  assert.ok(start>=0,`${startMarker} fehlt`);
  const end=source.indexOf(endMarker,start+startMarker.length);
  assert.ok(end>start,`${endMarker} fehlt`);
  return source.slice(start,end);
}

test('RC1051: Auth-Hotpath erstellt den bekannten Team-Container nicht pro Cold Start erneut',()=>{
  const source=read('api/shared/auth-store.js');
  const block=fnBlock(source,'async function clients()','function parseStoredJson');
  assert.doesNotMatch(block,/createIfNotExists/,'Auth-Hotpath darf keinen Container-Control-Plane-Call ausführen');
});

test('RC1051: Kunden-Avis verwendet den vorhandenen Team-Container ohne createIfNotExists',()=>{
  const source=read('api/customer-avis/index.js');
  const block=fnBlock(source,'async function ensureTeamContainerReady()','async function teamBlob(');
  assert.doesNotMatch(block,/createIfNotExists/,'Lieferavis-Hotpath darf den Team-Container nicht erneut anlegen');
});

test('RC1051: Public-Access-Store verwendet den vorhandenen Zugriffscontainer ohne createIfNotExists',()=>{
  const source=read('api/shared/public-access-store.js');
  const block=fnBlock(source,'async function container()','async function readBuffer(');
  assert.doesNotMatch(block,/createIfNotExists/,'Öffentliche Links dürfen keinen Container-Control-Plane-Call pro Cold Start ausführen');
});
