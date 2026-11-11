import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const internal=require('../api/urgent-orders/index.js');
const publicApi=require('../api/urgent-order-public/index.js');
const model=require('../api/shared/urgent-orders.js');
const pubHtml=fs.readFileSync('assets/urgent-order-report.html','utf8');
const staffHtml=fs.readFileSync('assets/urgent-orders.html','utf8');
const live=fs.readFileSync('scripts/rc1810-urgent-public-api-live.mjs','utf8');

test('RC1876: production and test hosts are explicitly classified, secrets never reflected',()=>{
 const marker='TOP_SECRET_ORDER_TOKEN_890';
 const report=internal.safeHostDiagnostic({headers:{
  Host:'internal.azurewebsites.net',
  Origin:'https://unknown-preview.azurestaticapps.net/urgent-order#access='+marker,
  'X-Forwarded-Host':'wonderful-forest-0f315e310.7.azurestaticapps.net',
  Cookie:'exporthub='+marker,
  Authorization:'Bearer '+marker
 }});
 assert.equal(report.direct,'azure-functions-worker');
 assert.equal(report.forwarded,'canonical-production');
 assert.equal(report.origin,'untrusted-preview');
 assert.ok(['production','testservice','missing'].includes(report.verifiedDeployment));
 assert.doesNotMatch(JSON.stringify(report),/TOP_SECRET|Authorization|Cookie|access=|azurewebsites\.net|unknown-preview/);
 const legacy=internal.safeHostDiagnostic({headers:{host:'www.exporthub360.com',origin:'https://exporthub360.com'}});
 assert.equal(legacy.direct,'legacy-production');
 const safeTest=internal.safeHostDiagnostic({headers:{host:'ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'}});
 assert.equal(safeTest.direct,'testservice');
});

test('RC1876: unverified worker rejects writes even if caller spoofs production Origin',()=>{
 assert.throws(
  ()=>internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net',Origin:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'}},''),
  e=>e.code==='URGENT_HOST_UNTRUSTED'
 );
 assert.throws(
  ()=>internal.resolveStorageEnvironment({headers:{host:'untrusted-preview.westeurope.azurestaticapps.net','x-forwarded-host':'wonderful-forest-0f315e310.7.azurestaticapps.net'}},'production'),
  e=>e.code==='URGENT_HOST_UNTRUSTED'
 );
 assert.equal(internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net'}},'production'),'production');
 assert.equal(internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net'}},'testservice'),'testservice');
});

test('RC1876: both urgent endpoints log only sanitized evidence for host failures',async()=>{
 const original=internal.storage,logs=[],secret='LOG_PRIVATE_012';
 internal.storage=()=>{throw model.problem('URGENT_HOST_UNTRUSTED','private failure '+secret,503)};
 try{
  const context={res:null,log:{warn(...args){logs.push(args)}}};
  await publicApi(context,{method:'POST',headers:{Host:'worker.azurewebsites.net',Cookie:secret,Origin:'https://evil.example/'+secret},body:{action:'list'}});
  assert.equal(context.res.status,503);
  const value=JSON.parse(context.res.body);
  assert.equal(value.code,'URGENT_HOST_UNTRUSTED');
  assert.equal(value.retryable,false,'an unverified host must not be retried without verification');
  assert.deepEqual(value.diagnostic,{direct:'azure-functions-worker',forwarded:'absent',origin:'other',verifiedDeployment:internal.safeHostDiagnostic({headers:{}}).verifiedDeployment});
  assert.doesNotMatch(JSON.stringify(value.diagnostic),/LOG_PRIVATE|azurewebsites\\.net|evil\\.example|access=/);
  assert.doesNotMatch(JSON.stringify(logs),/LOG_PRIVATE|evil\.example|Cookie/);
  assert.ok(logs.some(x=>x[0]==='urgent-host-evidence'));
 }finally{internal.storage=original}
 const source=fs.readFileSync('api/urgent-orders/index.js','utf8');
 assert.match(source,/if\(e&&e.code==='URGENT_HOST_UNTRUSTED'\)context\.log/);
 assert.match(source,/api\.urgent\.hostUntrusted/);
});

test('RC1876: new urgent links target only wonderful-forest, legacy tokens remain redirected',()=>{
 const production='wonderful-forest-0f315e310.7.azurestaticapps.net';
 assert.match(staffHtml,/function urgentPublicOrigin\(\)/);
 assert.match(staffHtml,/productionHost='wonderful-forest-0f315e310\.7\.azurestaticapps\.net'/);
 assert.match(staffHtml,/urgentPublicFormLink'\)\.href=urgentPublicOrigin\(\)\+'\/urgent-order'/);
 assert.match(pubHtml,/function redirectLegacyUrgentHost\(\)/);
 assert.match(pubHtml,/location\.search\|\|''/);
 assert.match(pubHtml,/location\.hash\|\|''/);
 assert.match(pubHtml,/function urgentTrackingBase\(\)/);
 assert.match(pubHtml,/trackingUrl'\)\.textContent=urgentTrackingBase\(\)\+'#access='\+encodeURIComponent\(secret\)/);
 assert.match(live,/r\.status!==403/);
 assert.doesNotMatch(live,/action:'create'/,'production smoke remains read-only');
 assert.equal(production.includes('exporthub360.com'),false);
});

test('RC1876: host verification message is translated in all six API languages',()=>{
 for(const lang of ['de','en','pl','es','fr','it']){
  const dict=JSON.parse(fs.readFileSync('api/shared/i18n/'+lang+'.json','utf8'));
  assert.ok(String(dict['api.urgent.hostUntrusted']||'').length>40,lang);
  assert.ok(dict['api.urgent.serverError'],lang);
 }
});

test('official TESTSERVICE /test shell is a valid urgent-order origin and is covered by the read-only live gate',()=>{
 const official='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
 const base='https://'+official;
 const config=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));
 const route=config.routes.find(x=>x.route==='/test');
 assert.equal(route.rewrite,'/TESTVERSION.html');
 assert.equal(internal.resolveStorageEnvironment({headers:{host:official,origin:base,referer:base+'/test?v=1112'}},'testservice'),'testservice');
 assert.equal(internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net',origin:base,referer:base+'/assets/urgent-orders.html?embedded=1'}},'testservice'),'testservice');
 assert.throws(()=>internal.resolveStorageEnvironment({headers:{host:'worker.azurewebsites.net',origin:base,referer:base+'/test?v=1112'}},''),e=>e.code==='URGENT_HOST_UNTRUSTED','a browser URL must not replace verified deployment evidence');
 assert.match(live,/\/test\?v=1112/);
 assert.match(live,/\/assets\/urgent-orders\.html\?embedded=1/);
});
