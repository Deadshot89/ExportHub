import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {packOrigin}=require('../api/pack-stations-admin/index.js');

test('Pack-Link: interner Functions-Host (*.azurewebsites.net) landet nie im QR-Code',()=>{
  const backend='b0427eae-b2b5-43c5-924b-37873bc7aeb8.azurewebsites.net';
  assert.equal(packOrigin({headers:{host:backend}},'production'),'https://exporthub360.com');
  assert.equal(packOrigin({headers:{host:backend}},'testservice'),'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net');
  assert.equal(packOrigin({headers:{host:backend,'x-ms-original-url':'https://exporthub360.com/api/pack-stations-admin?action=shared'}},'production'),'https://exporthub360.com');
  assert.equal(packOrigin({headers:{host:backend,referer:'https://wonderful-forest-0f315e310.7.azurestaticapps.net/'}},'production'),'https://wonderful-forest-0f315e310.7.azurestaticapps.net');
});

test('Pack-Link: fremde Hosts aus Headern werden ignoriert',()=>{
  assert.equal(packOrigin({headers:{origin:'https://evil.example',host:'evil.example'}},'production'),'https://exporthub360.com');
  assert.equal(packOrigin({headers:{'x-forwarded-host':'exporthub360.com.evil.example'}},'production'),'https://exporthub360.com');
});
