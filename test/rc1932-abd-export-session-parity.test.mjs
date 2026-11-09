import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Regression for #1190: a successful invoice upload must not be followed by
// a Proforma/ABD export using an unrelated or TESTSERVICE session token.
const modules=[
 'assets/rc1549-abd-proforma.js',
 'assets/rc1499-abd-export.js'
];

function tokenFrom(moduleName,runtime,stored={},hostname='www.exporthub360.de'){
 const source=fs.readFileSync(moduleName,'utf8');
 const from=source.indexOf('function authToken(){');
 const to=source.indexOf('function headers(){',from);
 assert.ok(from>=0&&to>from,moduleName+': auth functions must be present');
 const segment=source.slice(from,to);
 assert.match(segment,/getItem\('exporthub_rc301_tab_session'\)/);
 assert.doesNotMatch(segment,/sessionStorage\.length|sessionStorage\.key\(/,'Never enumerate arbitrary browser session records');
 const lookedUp=[];
 const root={
  ExportHUBClean:{runtime},
  location:{hostname},
  sessionStorage:{getItem(key){lookedUp.push(key);return Object.hasOwn(stored,key)?stored[key]:null}}
 };
 const scope={root,q(value){return String(value==null?'':value).trim()}};
 vm.runInNewContext(segment+'\nthis.readToken=authToken;',scope,{timeout:1000});
 return{token:scope.readToken(),lookedUp};
}

for(const moduleName of modules){
 test('RC1932: '+moduleName+' honors runtime and canonical tab session',()=>{
  const production={exporthub_rc301_tab_session:JSON.stringify({token:'PROD',user:{id:'employee'},environment:'production'})};
  assert.equal(tokenFrom(moduleName,{authToken:'ACTIVE'},production).token,'ACTIVE');
  assert.equal(tokenFrom(moduleName,{token:'SECONDARY'},production).token,'SECONDARY');
  assert.equal(tokenFrom(moduleName,{sessionToken:'THIRD'},production).token,'THIRD');
  const matching=tokenFrom(moduleName,{},production);
  assert.equal(matching.token,'PROD');
  assert.deepEqual(matching.lookedUp,['exporthub_rc301_tab_session']);
  assert.equal(tokenFrom(moduleName,{},production,'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net').token,'');
  const testservice={exporthub_rc301_tab_session:JSON.stringify({token:'TEST',user:{id:'employee'},environment:'testservice'})};
  assert.equal(tokenFrom(moduleName,{},testservice,'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net').token,'TEST');
 });

 test('RC1932: '+moduleName+' never accepts foreign, anonymous or corrupted session data',()=>{
  const unrelated={other:JSON.stringify({token:'FOREIGN',user:{id:'attacker'}})};
  assert.equal(tokenFrom(moduleName,{},unrelated).token,'');
  assert.equal(tokenFrom(moduleName,{},{
   exporthub_rc301_tab_session:JSON.stringify({token:'ANONYMOUS',environment:'production'})
  }).token,'');
  assert.equal(tokenFrom(moduleName,{},{
   exporthub_rc301_tab_session:'not-json'
  }).token,'');
  const testSession={exporthub_rc301_tab_session:JSON.stringify({
   token:'TEST',user:{id:'employee'},dataEnvironment:'testservice'
  })};
  assert.equal(tokenFrom(moduleName,{},testSession,'www.exporthub360.de').token,'');
  assert.equal(tokenFrom(moduleName,{},testSession,'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net').token,'TEST');
 });
}
