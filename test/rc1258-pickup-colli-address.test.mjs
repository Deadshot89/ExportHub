import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function loadWithMocks(relativeFile,mocks){
  const absolute=path.resolve(ROOT,relativeFile),original=Module._load;
  Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};
  delete require.cache[require.resolve(absolute)];
  try{return require(absolute)}finally{Module._load=original}
}

test('RC1258: Colli-Prüfung steht vor den Sendungsdetails und erhält den Erstfokus',()=>{
  const html=fs.readFileSync('pickup.html','utf8');
  assert.ok(html.indexOf('id="colliSection"')>=0);
  assert.ok(html.indexOf('id="details"')>html.indexOf('id="colliSection"'),'Sendungsdetails stehen noch vor der Colli-Prüfung');
  assert.match(html,/<h2>Colli-Prüfung/);
  assert.match(html,/id="colli"[^>]*autofocus/);
  assert.match(html,/document\.getElementById\('colli'\).*focus/s);
});

test('RC1258: Adressableitung ignoriert Platzhalter und nutzt echte Liefer-/Standortadresse',()=>{
  const store=loadWithMocks('api/shared/pickup-store.js',{'@azure/storage-blob':{BlobServiceClient:{fromConnectionString(){throw new Error('Storage darf für den Pure-Helper nicht benötigt werden')}}}});
  assert.equal(store.addressFromSource({recipientAddress:'-',deliveryAddress:'Teststraße 1, 47906 Kempen, Deutschland'}),'Teststraße 1, 47906 Kempen, Deutschland');
  assert.equal(store.addressFromSource({recipientAddress:'—',locationData:{street:'Am Lager 7',postalCode:'41334',city:'Nettetal',country:'Deutschland'}}),'Am Lager 7, 41334 Nettetal, Deutschland');
});

test('RC1258: Pickup-Init und Pickup-Status verwenden den serverseitigen Adress-Fallback',()=>{
  const init=fs.readFileSync('api/pickup-init/index.js','utf8');
  const status=fs.readFileSync('api/pickup-status/index.js','utf8');
  assert.match(init,/store\.addressFromSource\(src\)/);
  assert.match(init,/store\.resolveShipmentAddress/);
  assert.match(status,/store\.resolveShipmentAddress/);
  assert.match(status,/record\.address=address/);
});
