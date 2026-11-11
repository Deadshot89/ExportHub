import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchRc1968CarrierMailHtml,RC1968_PATCH_COUNT} from '../scripts/rc1968-authoritative-carrier-mail.mjs';

const source=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const server=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');

function emailItems(value) {
 return String(value==null?'':value).split(/[;,\s]+/).map(x=>x.trim()).filter(x=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
}
function merged(...values) {
 const result=[],seen=new Set();
 values.forEach(value=>emailItems(value).forEach(mail=>{
  if(!seen.has(mail.toLowerCase())){seen.add(mail.toLowerCase());result.push(mail)}
 }));
 return result;
}
function composers(customers=[]) {
 const html=patchRc1968CarrierMailHtml(source);
 const rc543=html.match(/function emailRecipient\(type,sh,c\)\{[^\n]+\}/);
 const later=html.match(/function carrierTo\(c,sh\)\{[^\n]+\}/);
 assert.ok(rc543,'RC543 Empfängerfunktion fehlt');
 assert.ok(later,'Mailstatus-Bridge Empfängerfunktion fehlt');
 const findCustomer=key=>customers.find(c=>[c.id,c.account,c.customerNumber,c.name].includes(key))||null;
 const emailRecipient=vm.runInNewContext('('+rc543[0]+')',{emailList:emailItems,findCustomer});
 const carrierTo=vm.runInNewContext('('+later[0]+')',{mergeEmails:merged,findCustomer});
 return{emailRecipient,carrierTo,html};
}

test('RC1968 #904: beide Mail-Renderer schließen alte Sendungs- und Legacy-Aliase aus',()=>{
 const customer={id:'C-1968',name:'Customer SE',
  carrierEmail:'active-a@freight.example; active-b@freight.example',
  carrierMail:'retired@freight.example',speditionMail:'retired@freight.example',
  mailRecipients:'retired@freight.example'};
 const {emailRecipient,carrierTo}=composers([customer]);
 const shipment={customerId:'C-1968',reference:'REF1968',carrierEmail:'retired@freight.example',
  speditionMail:'retired@freight.example',forwarderEmail:'retired@freight.example'};
 const approved=['active-a@freight.example','active-b@freight.example'];
 assert.deepEqual(emailItems(emailRecipient('carrier',shipment,customer)),approved);
 assert.deepEqual(Array.from(carrierTo(customer,shipment)),approved);
});

test('RC1968: Übersichtserinnerung ignoriert entfernte Sendungs-E-Mail',()=>{
 const html=patchRc1968CarrierMailHtml(source);
 const excerpt=html.match(/function recipient\(sh,target\)\{[^\n]+\}/);
 assert.ok(excerpt,'Übersichts-Reminder-Empfängerberechnung fehlt');
 const customer={id:'C-1968',carrierEmail:'active@freight.example',carrierMail:'retired@freight.example'};
 const func=vm.runInNewContext('('+excerpt[0]+')',{
  customerFor(){return{carrierEmail:'retired@freight.example'}},
  main(){return{customers:[customer]}},
  arr(x){return Array.isArray(x)?x:[]},
  q(x){return String(x==null?'':x).trim()},
  emailList:emailItems,
  low(v){return String(v==null?'':v).toLowerCase()}
 });
 const result=func({customerId:'C-1968',carrierEmail:'retired@freight.example',speditionMail:'retired@freight.example'},'carrier');
 assert.deepEqual(Array.from(result.to),['active@freight.example']);
});

test('RC1968: explizit gelöschtes/geleertes Carrier-Feld ist verbindlich leer',()=>{
 const c={id:'C-EMPTY',carrierEmail:'',carrierMail:'old@example.com',speditionMail:'old@example.com'};
 const {emailRecipient,carrierTo}=composers([c]);
 const sh={customerId:'C-EMPTY',carrierEmail:'old@example.com'};
 assert.equal(emailRecipient('carrier',sh,c),'');
 assert.deepEqual(Array.from(carrierTo(c,sh)),[]);
});

test('RC1968: Kunden ohne neues Feld bleiben mit alten Kundendaten kompatibel',()=>{
 const c={id:'C-LEGACY',carrierMail:'current@example.com',speditionMail:'stale@example.com'};
 const {emailRecipient,carrierTo}=composers([c]);
 const sh={customerId:'C-LEGACY',carrierEmail:'old-shipment@example.com'};
 assert.equal(emailRecipient('carrier',sh,c),'current@example.com');
 assert.deepEqual(Array.from(carrierTo(c,sh)),['current@example.com','stale@example.com']);
 const absent=composers();
 assert.deepEqual(Array.from(absent.carrierTo(null,sh)),[],'Ohne aktuellen Kundenordner darf eine gespeicherte Sendung keine Empfänger freigeben');
 assert.equal(absent.emailRecipient('carrier',sh,null),'');
});

test('RC1968: Kundennachricht und eigene Info-Mail werden nicht umgeschrieben',()=>{
 const {html}=composers();
 assert.match(html,/function customerTo\(c,sh\)/);
 assert.match(html,/function salesCc\(c,sh\)/);
 assert.match(html,/function storedCc\(c,sh\)/);
 assert.match(html,/function buildRecipients\(sh,c,target,manualTo\)/);
 assert.ok(html.includes("target==='customer'?customerTo(c,sh):target==='carrier'?carrierTo(c,sh)"));
});

test('RC1968: exakt drei eindeutige Anker und verpflichtender Release-Build in allen Umgebungen',()=>{
 const {html}=composers();
 assert.equal(RC1968_PATCH_COUNT,3);
 assert.throws(()=>patchRc1968CarrierMailHtml(html),/expected one source anchor/);
 assert.throws(()=>patchRc1968CarrierMailHtml('unvollständiges HTML'),/expected one source anchor/);
 assert.match(build,/import \{patchRc1968CarrierMailHtml\}/);
 assert.match(build,/for\(const file of \['index.html','TESTVERSION.html','demo.html'\]\)\{/);
 assert.match(build,/const rc1968Carrier=patchRc1968CarrierMailHtml\(rc1718Printed,file\)/);
 assert.match(build,/fs\.writeFileSync\(target,(?:patchRc1982MetaDeltaHtml\()?rc1968Carrier\.replace\(oldContacts,/);
});

test('RC1968: Server blockiert entfernte Carrier-Adresse vor Vorschau und Graph-Versand',()=>{
 const guard=server.indexOf("if(target==='carrier'){",server.indexOf("const shipment=shipmentFromTeam"));
 const send=server.indexOf('graphMail.sendHtmlMail');
 assert.ok(guard>0&&guard<send,'Carrier-Whitelist muss vor Graph-Send liegen');
 assert.match(server,/Object\.prototype\.hasOwnProperty\.call\(customer,'carrierEmail'\)/);
 assert.match(server,/MAIL_RECIPIENT_NOT_IN_CUSTOMER_FOLDER/);
 assert.match(server,/MAIL_CUSTOMER_FOLDER_NOT_FOUND/);
 assert.match(server,/permitted\.includes\(lower\(to\)\)/);
});


test('RC1968: Backend rejects removed recipients in both preview and real-send paths before Graph',async()=>{
 let graphCalls=0;
 const currentCustomer={id:'C-1968',carrierEmail:'active-a@freight.example; active-b@freight.example'};
 const team={state:{shipments:[{id:'S1',reference:'REF1968',customerId:'C-1968',carrierEmail:'retired@freight.example'}],customers:[currentCustomer]}};
 const auth={
  async validateSession(){return{user:{rights:{shipmentoverview:{edit:true}}},team}},
  isAdmin(){return true},
  body(req){return req.body},
  error(code,message,status){return Object.assign(new Error(message),{code,status})},
  environmentFromRequest(){return'testservice'}
 };
 const sandbox={
  module:{exports:{}},process:{env:{}},URL,Date,console:{error(){}},
  require(id){
   if(id==='crypto')return{randomBytes(){throw new Error('Must not create mail history')}}
   if(id==='../shared/auth-store')return auth;
   if(id==='../shared/graph-mail')return{async sendHtmlMail(){graphCalls++;throw new Error('Must not deliver mail')}};
   if(id==='../shared/avis-mail-html')return{
    renderAvisMailHtml(){throw new Error('Must not render HTML')},
    activeClosureNotices(){return[]},closureNoticeHtml(){return''}
   };
   throw new Error('Unexpected dependency: '+id);
  }
 };
 vm.runInNewContext(server,sandbox,{filename:'api/avis-reminder-mail/index.js'});
 const handler=sandbox.module.exports;
 async function check(action,customers,recipient,code) {
  team.state.customers=customers;
  const context={res:null,log:{error(){}}};
  await handler(context,{method:'POST',body:{action,shipmentId:'S1',reference:'REF1968',target:'carrier',mode:'initial',recipient}});
  assert.equal(context.res.status,409);
  const body=JSON.parse(context.res.body);
  assert.equal(body.ok,false);
  assert.equal(body.code,code);
 }
 for(const action of ['preview','']){
  await check(action,[currentCustomer],'retired@freight.example','MAIL_RECIPIENT_NOT_IN_CUSTOMER_FOLDER');
  await check(action,[{...currentCustomer,carrierEmail:''}],'active-a@freight.example','MAIL_RECIPIENT_NOT_IN_CUSTOMER_FOLDER');
  await check(action,[],'retired@freight.example','MAIL_CUSTOMER_FOLDER_NOT_FOUND');
 }
 assert.equal(graphCalls,0,'No Graph call is allowed for an unapproved carrier');
});
