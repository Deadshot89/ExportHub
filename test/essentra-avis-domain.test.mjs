import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const legacy='https://wonderful-forest-0f315e310.7.azurestaticapps.net/customer-avis.html?token=abc';
const branded='https://www.exporthub360.de/avis/abc';
const testservice='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/customer-avis.html?token=abc&environment=testservice';

function browser(file,customers=[]){
 const document={readyState:'loading',addEventListener(){}};
 const sandbox={document,URL,console,setTimeout(){},location:{hostname:'www.exporthub360.de',href:'https://www.exporthub360.de/'},addEventListener(){},appState:{customers}};
 sandbox.window=sandbox;
 let source=fs.readFileSync(file,'utf8');
 const immediate=file.includes('rc1027');
 source=source.replace(immediate?'window.ExportHUBRC1027Lieferavis=api;':'w.ExportHUBRC1166AvisReminder=Object.freeze(',immediate?'window.routeAvis=rc1333SafeAvisUrl;window.ExportHUBRC1027Lieferavis=api;':'w.routeAvis=safeAvisLink;w.ExportHUBRC1166AvisReminder=Object.freeze(');
 vm.runInNewContext(source,sandbox);
 return sandbox.routeAvis;
}
function server(file){
 const sandbox={URL,process,module:{exports:{}},require(name){if(name.includes('auth-store'))return{environmentFromRequest:req=>req.environment||'production',error:(code,message,status)=>Object.assign(new Error(message),{code,status})};return{};}};
 vm.runInNewContext(fs.readFileSync(file,'utf8')+'\nmodule.exports.testRoute={'+(file.includes('reminder')?'safeAvisUrl':'publicAvisUrl,customerForState')+'};',sandbox);
 return sandbox.module.exports.testRoute;
}

for(const file of ['assets/rc1027-lieferavis-immediate.js','assets/rc1166-avis-reminder-overview.js']){
 test(file+': Essentra uses unblocked host for branded and cached legacy links',()=>{
  const route=browser(file);
  for(const sh of [{customerName:'Essentra Components AB – SE'},{customer:{name:'ESSENTRA France'}},{customer:'Essentra UK'}]){
   assert.equal(route(sh,branded),legacy);
   assert.equal(route(sh,legacy),legacy);
  }
  assert.equal(route({customerName:'Hitachi Energy'},legacy),branded);
  assert.equal(route({customerName:'Essentra Components AB'},testservice),testservice);
 });
 test(file+': customer directory identifies Essentra by account, never by sender',()=>{
  const route=browser(file,[{id:'SE1',account:'9000003004',name:'Essentra Components AB'}]);
  assert.equal(route({customerAccount:'9000003004'},branded),legacy);
  assert.equal(route({customer:{customerId:'SE1'}},branded),legacy);
  assert.equal(route({customer:{customerNumber:'9000003004'}},branded),legacy);
  assert.equal(route({customerName:'Hitachi',senderName:'Essentra Components GmbH'},legacy),branded);
 });
}
test('server issuance routes by shipment and resolved customer directory',()=>{
 const {publicAvisUrl,customerForState}=server('api/customer-avis/index.js');
 const sh={customerId:'SE1'},c=customerForState({customers:[{id:'SE1',name:'Essentra Sweden'}]},sh);
 assert.equal(publicAvisUrl('production','abc',{customerName:'Essentra UK'}),legacy);
 assert.equal(publicAvisUrl('production','abc',sh,c),legacy);
 assert.equal(publicAvisUrl('production','abc',{customerName:'Hitachi'}),branded);
 assert.equal(publicAvisUrl('testservice','abc',{customerName:'Essentra UK'}),testservice);
});
test('mail server enforces customer routing while preserving language and rejecting foreign hosts',()=>{
 const {safeAvisUrl}=server('api/avis-reminder-mail/index.js');
 assert.equal(safeAvisUrl({},branded+'?lang=en',{customerName:'Essentra UK'}),legacy+'&lang=en');
 assert.equal(safeAvisUrl({},legacy,{customerName:'Hitachi'}),branded);
 assert.equal(safeAvisUrl({},branded,{customerId:'SE1'},{id:'SE1',name:'Essentra Sweden'}),legacy);
 assert.throws(()=>safeAvisUrl({},'https://evil.example/avis/abc',{customerName:'Essentra UK'}),{code:'AVIS_URL_INVALID'});
 assert.throws(()=>safeAvisUrl({environment:'testservice'},legacy,{customerName:'Essentra UK'}),{code:'AVIS_URL_INVALID'});
});

test('issue endpoint resolves Essentra from the stored customer directory before returning its URL',async()=>{
 const sh={id:'S1',reference:'ABC123',customerAccount:'9000003004'};
 const team={state:{shipments:[sh],customers:[{account:'9000003004',name:'Essentra Sweden'}]}};
 const auth={TEAM_CONTAINER:'exporthub-data',TEAM_BLOB:'team-state.json',hasAnyEditRight:()=>true,async validateSession(){return{user:{name:'Tester'},teamDoc:{value:team}}}};
 const access={body:req=>req.body,json:(status,body)=>({status,body:JSON.stringify(body)}),environment:()=> 'production',async issue(){return{token:'abc',expiresAt:'2030-01-01'}}};
 const sandbox={URL,process:{env:{EXPORTHUB_STORAGE_CONNECTION_STRING:'test-storage'}},module:{exports:{}},require(name){
  if(name==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString:()=>({getContainerClient:()=>({getBlockBlobClient:()=>({})})})}};
  if(name==='../shared/fast-auth-store')return auth;
  if(name==='../shared/public-access-store')return access;
  if(name==='../shared/i18n')return{language:()=> 'de'};
  if(name==='crypto')return crypto;
  return{};
 }};
 vm.runInNewContext(fs.readFileSync('api/customer-avis/index.js','utf8'),sandbox);
 const context={};
 await sandbox.module.exports(context,{method:'POST',body:{action:'issue',shipmentId:'S1',reference:'ABC123'}});
 assert.equal(context.res.status,200,context.res.body);
 assert.equal(JSON.parse(context.res.body).url,legacy);
});

test('mail endpoint uses the stored customer identity for the outgoing message',async()=>{
 const sh={id:'S1',reference:'ABC123',customer:{customerId:'SE1'}};
 const team={state:{shipments:[sh],customers:[{customerId:'SE1',name:'Essentra Sweden'}]}};
 let mail;
 const auth={body:req=>req.body,isAdmin:()=>true,environmentFromRequest:()=> 'production',async validateSession(){return{user:{name:'Tester'},team}},async mutateTeamForRequest(req,fn){return fn(team)},addAudit(){}};
 const sandbox={URL,process,module:{exports:{}},require(name){
  if(name==='crypto')return crypto;
  if(name==='../shared/auth-store')return auth;
  if(name==='../shared/graph-mail')return{async sendTextMail(value){mail=value;return{attempts:1}}};
  return{};
 }};
 vm.runInNewContext(fs.readFileSync('api/avis-reminder-mail/index.js','utf8'),sandbox);
 const context={};
 await sandbox.module.exports(context,{method:'POST',body:{shipmentId:'S1',reference:'ABC123',recipient:'test@example.com',mode:'initial',avisUrl:branded}});
 assert.equal(context.res.status,200);
 assert.ok(mail.body.includes(legacy));
 assert.ok(!mail.body.includes('exporthub360.de'));
});
