import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/rc1014-shipment-overview.js',import.meta.url),'utf8');
const start=source.indexOf('  function currentEnvironment()');
const end=source.indexOf('  function apiHeaders()',start);
assert.ok(start>=0&&end>start,'Container preview must provide session and environment helpers');
const helpers=source.slice(start,end);
const expression="const root=globalThis;const q=v=>String(v==null?'':v).trim();\n"+helpers+"\nauthToken()";

function token(hostname,runtime,stored){
 const context={location:{hostname},ExportHUBClean:{runtime:runtime||{}},
  sessionStorage:{getItem:key=>key==='exporthub_rc301_tab_session'?stored:null}};
 return vm.runInNewContext(expression,context);
}
test('P2: container-photo preview can reuse its authenticated tab session after reload',()=>{
 const data=JSON.stringify({token:'valid-tab-token',user:{id:'U1'},environment:'testservice'});
 assert.equal(token('ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',{},data),'valid-tab-token');
});
test('P2: photo preview must not mix production and testservice tokens',()=>{
 const data=JSON.stringify({token:'wrong-environment',user:{id:'U1'},environment:'production'});
 assert.equal(token('ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',{},data),'');
});
test('P2: missing user, malformed session and absent session are not authenticated',()=>{
 assert.equal(token('exporthub360.com',{},JSON.stringify({token:'orphan',environment:'production'})),'');
 assert.equal(token('exporthub360.com',{},'{broken'), '');
 assert.equal(token('exporthub360.com',{},null),'');
});
test('P2: active runtime token still has priority',()=>{
 assert.equal(token('exporthub360.com',{authToken:'active-token'},JSON.stringify({token:'older-token',user:{id:'U1'},environment:'production'})),'active-token');
});
