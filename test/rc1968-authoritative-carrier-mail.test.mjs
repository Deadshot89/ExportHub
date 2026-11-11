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
function composers() {
 const html=patchRc1968CarrierMailHtml(source);
 const rc543=html.match(/function emailRecipient\(type,sh,c\)\{[^\n]+\}/);
 const later=html.match(/function carrierTo\(c,sh\)\{[^\n]+\}/);
 assert.ok(rc543,'RC543 Empfängerfunktion fehlt');
 assert.ok(later,'Mailstatus-Bridge Empfängerfunktion fehlt');
 const emailRecipient=vm.runInNewContext('('+rc543[0]+')',{emailList:emailItems});
 const carrierTo=vm.runInNewContext('('+later[0]+')',{mergeEmails:merged});
 return{emailRecipient,carrierTo,html};
}

test('RC1968 #904: beide Mail-Renderer schließen alte Sendungs- und Legacy-Aliase aus',()=>{
 const {emailRecipient,carrierTo}=composers();
 const customer={id:'C-1968',name:'Customer SE',
  carrierEmail:'active-a@freight.example; active-b@freight.example',
  carrierMail:'retired@freight.example',speditionMail:'retired@freight.example',
  mailRecipients:'retired@freight.example'};
 const shipment={reference:'REF1968',carrierEmail:'retired@freight.example',
  speditionMail:'retired@freight.example',forwarderEmail:'retired@freight.example'};
 const approved=['active-a@freight.example','active-b@freight.example'];
 assert.deepEqual(emailItems(emailRecipient('carrier',shipment,customer)),approved);
 assert.deepEqual(Array.from(carrierTo(customer,shipment)),approved);
});

test('RC1968: explizit gelöschtes/geleertes Carrier-Feld ist verbindlich leer',()=>{
 const {emailRecipient,carrierTo}=composers();
 const c={carrierEmail:'',carrierMail:'old@example.com',speditionMail:'old@example.com'};
 const sh={carrierEmail:'old@example.com'};
 assert.equal(emailRecipient('carrier',sh,c),'');
 assert.deepEqual(Array.from(carrierTo(c,sh)),[]);
});

test('RC1968: Kunden ohne neues Feld bleiben mit alten Kundendaten kompatibel',()=>{
 const {emailRecipient,carrierTo}=composers();
 const c={carrierMail:'current@example.com',speditionMail:'stale@example.com'};
 const sh={carrierEmail:'old-shipment@example.com'};
 assert.equal(emailRecipient('carrier',sh,c),'current@example.com');
 assert.deepEqual(Array.from(carrierTo(c,sh)),['current@example.com','stale@example.com']);
 assert.deepEqual(Array.from(carrierTo(null,sh)),['old-shipment@example.com']);
});

test('RC1968: Kundennachricht und eigene Info-Mail werden nicht umgeschrieben',()=>{
 const {html}=composers();
 assert.match(html,/function customerTo\(c,sh\)/);
 assert.match(html,/function salesCc\(c,sh\)/);
 assert.match(html,/function storedCc\(c,sh\)/);
 assert.match(html,/function buildRecipients\(sh,c,target,manualTo\)/);
 assert.ok(html.includes("target==='customer'?customerTo(c,sh):target==='carrier'?carrierTo(c,sh)"));
});

test('RC1968: exakt zwei eindeutige Anker und verpflichtender Release-Build in allen Umgebungen',()=>{
 const {html}=composers();
 assert.equal(RC1968_PATCH_COUNT,2);
 assert.throws(()=>patchRc1968CarrierMailHtml(html),/expected one source anchor/);
 assert.throws(()=>patchRc1968CarrierMailHtml('unvollständiges HTML'),/expected one source anchor/);
 assert.match(build,/import \{patchRc1968CarrierMailHtml\}/);
 assert.match(build,/for\(const file of \['index.html','TESTVERSION.html','demo.html'\]\)\{/);
 assert.match(build,/const rc1968Carrier=patchRc1968CarrierMailHtml\(rc1718Printed,file\)/);
 assert.match(build,/fs\.writeFileSync\(target,rc1968Carrier\.replace\(oldContacts,/);
});

test('RC1968: Server blockiert entfernte Carrier-Adresse vor Vorschau und Graph-Versand',()=>{
 const guard=server.indexOf("if(target==='carrier'){",server.indexOf("const shipment=shipmentFromTeam"));
 const send=server.indexOf('graphMail.sendHtmlMail');
 assert.ok(guard>0&&guard<send,'Carrier-Whitelist muss vor Graph-Send liegen');
 assert.match(server,/Object\.prototype\.hasOwnProperty\.call\(customer,'carrierEmail'\)/);
 assert.match(server,/MAIL_RECIPIENT_NOT_IN_CUSTOMER_FOLDER/);
 assert.match(server,/permitted\.includes\(lower\(to\)\)/);
});
