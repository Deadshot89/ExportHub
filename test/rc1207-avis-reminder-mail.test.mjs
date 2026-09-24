import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const api=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const graph=fs.readFileSync('api/shared/graph-mail.js','utf8');
const runtime=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const e2eFixture=fs.readFileSync('api/e2e-test-fixture/index.js','utf8');
const e2eMutation=fs.readFileSync('e2e/specs/testservice-mutation.spec.mjs','utf8');


function loadReminderEndpoint(){
 const calls=[],team={state:{shipments:[{id:'S1',reference:'ABC123'}],auditLog:[]}};
 const mockAuth={
  body:req=>req&&req.body&&typeof req.body==='object'?req.body:{},
  async validateSession(){return{user:{id:'U1',name:'RC1255 Test',globalAdmin:true,rights:{shipmentoverview:{level:'admin',admin:true}}}}},
  isAdmin:user=>user&&user.globalAdmin===true,
  environmentFromRequest:req=>String(req&&req.headers&&req.headers['x-exporthub-environment']||'production').toLowerCase()==='testservice'?'testservice':'production',
  error:(code,message,status=400)=>Object.assign(new Error(message),{code,status}),
  async mutateTeamForRequest(_req,mutator){return{team,result:await mutator(team)}},
  addAudit:(doc,type,actor,details)=>{doc.state.auditLog.push({type,actor,details})}
 };
 const mockGraph={async sendTextMail(message){calls.push(message);return{ok:true,attempts:1}}};
 const require=createRequire(import.meta.url),target=path.resolve('api/avis-reminder-mail/index.js'),original=Module._load;
 Module._load=function(request,parent,isMain){
  if(request==='../shared/auth-store')return mockAuth;
  if(request==='../shared/graph-mail')return mockGraph;
  return original.call(this,request,parent,isMain);
 };
 delete require.cache[require.resolve(target)];
 let endpoint;
 try{endpoint=require(target)}finally{Module._load=original}
 return{endpoint,calls,team};
}
async function invokeReminder(endpoint,avisUrl){
 const context={res:null,log:{error(){}}};
 await endpoint(context,{method:'POST',headers:{
  'x-forwarded-host':'exporthub-internal-functions.azurewebsites.net',
  'x-exporthub-environment':'testservice'
 },body:{shipmentId:'S1',reference:'ABC123',recipient:'internal@example.com',target:'customer',language:'de',avisUrl}});
 return{status:context.res.status,body:JSON.parse(context.res.body)};
}

test('RC1207: Mail-Backend und Graph-Client sind syntaktisch gültig',()=>{
 execFileSync(process.execPath,['--check','api/avis-reminder-mail/index.js'],{stdio:'pipe'});
 execFileSync(process.execPath,['--check','api/shared/graph-mail.js'],{stdio:'pipe'});
});

test('RC1207: API verlangt ExportHUB-Sitzung und Bearbeitungsrecht',()=>{
 assert.match(api,/auth\.validateSession\(req\)/);
 assert.match(api,/rights&&user\.rights\.shipmentoverview|user&&user\.rights&&user\.rights\.shipmentoverview/);
 assert.match(api,/MAIL_SEND_FORBIDDEN/);
});

test('RC1207: Server erzeugt sicheren Avis-Text selbst',()=>{
 assert.match(api,/customer-avis\\\.html/);
 assert.match(api,/AVIS_URL_INVALID/);
 assert.match(api,/function subject\(/);
 assert.match(api,/function body\(/);
 assert.doesNotMatch(api,/p\.subject/);
 assert.doesNotMatch(api,/p\.body/);
});

test('RC1207: Graph sendMail nutzt Application-Token und Sent Items',()=>{
 assert.match(graph,/grant_type:'client_credentials'/);
 assert.match(graph,/https:\/\/graph\.microsoft\.com\/\.default/);
 assert.match(graph,/\/sendMail'/);
 assert.match(graph,/saveToSentItems:true/);
 assert.match(graph,/EXPORTHUB_MAIL_SENDER/);
});

test('RC1207: erfolgreicher Versand schreibt Sendungshistorie und Audit',()=>{
 assert.match(api,/type:'mail-sent'/);
 assert.match(api,/label:'Avis-Erinnerung versendet'/);
 assert.match(api,/mailType:'avis-reminder'/);
 assert.match(api,/AVIS_REMINDER_SENT/);
 assert.match(api,/shipmentHistory/);
 assert.match(api,/mailHistory/);
});

test('RC1207: Frontend zeigt Erfolg und Build liefert API aus',()=>{
 assert.match(runtime,/Erinnerungsmail erfolgreich an/);
 assert.match(runtime,/exporthub:history-updated/);
 assert.match(build,/avis-reminder-mail\/index\.js/);
 assert.match(build,/avis-reminder-mail\/function\.json/);
 assert.match(build,/shared\/graph-mail\.js/);
});


test('RC1255: TESTSERVICE prüft den echten Reminder ohne externe Kundenadresse',()=>{
 assert.match(e2eFixture,/function e2eReminderRecipient\(\)/);
 assert.match(e2eFixture,/EXPORTHUB_MAIL_SENDER\|\|process\.env\.EXPORTHUB_POD_DRIVE_USER/);
 assert.match(e2eFixture,/customerEmail:reminderRecipient/);
 assert.match(e2eMutation,/RC1255 P2: AVIS-Erinnerung/);
 assert.match(e2eMutation,/getByRole\('button',\{name:\/Avis-Erinnerung senden\/i\}\)/);
 assert.match(e2eMutation,/\[data-recipient\]/);
 assert.match(e2eMutation,/\[data-open\]/);
 assert.match(e2eMutation,/Avis-Erinnerung versendet/);
 assert.match(e2eMutation,/AVIS_REMINDER_SENT/);
 assert.match(e2eMutation,/page\.request\.get\(issued\.url\)/);
 assert.match(e2eMutation,/action:'authorize'/);
 execFileSync(process.execPath,['--check','api/e2e-test-fixture/index.js'],{stdio:'pipe'});
 execFileSync(process.execPath,['--check','e2e/specs/testservice-mutation.spec.mjs'],{stdio:'pipe'});
});


test('RC1255: TESTSERVICE akzeptiert kanonischen AVIS-Host trotz Azure-internem Forwarded-Host',async()=>{
 const h=loadReminderEndpoint();
 const good=await invokeReminder(h.endpoint,'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net/customer-avis.html?token=test');
 assert.equal(good.status,200);
 assert.equal(good.body.ok,true);
 assert.equal(h.calls.length,1,'gültiger TESTSERVICE-Link muss den Graph-Mailversand erreichen');
 assert.equal(h.team.state.shipments[0].mailHistory[0].type,'avis-reminder');
 assert.equal(h.team.state.auditLog[0].type,'AVIS_REMINDER_SENT');

 const bad=await invokeReminder(h.endpoint,'https://evil.example/customer-avis.html?token=test');
 assert.equal(bad.status,400);
 assert.equal(bad.body.code,'AVIS_URL_INVALID');
 assert.equal(h.calls.length,1,'fremder Host darf keinen weiteren Mailversand auslösen');
});
