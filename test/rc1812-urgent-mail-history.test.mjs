import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const model=require('../api/shared/urgent-orders.js');
const manager={id:'LOG-1',name:'Logistik Eins',rights:{shipmentoverview:{edit:true}}};
const otherManager={id:'LOG-2',name:'Logistik Zwei',globalAdmin:true};
const outsider={id:'NO-RIGHTS',name:'Unberechtigt'};
function order(){return{id:'order-123',email:'cs@example.org',language:'de',items:[{status:'Shipped'}],history:[]};}
test('Urgent Order saves the EXACT edited email before requesting the mail program; not sent',()=>{
 const record=order(),body='Guten Tag,\r\n\r\n  Text aus ExportHUB360  \r\nBeste Grüße\n';
 const subject='SO3002 - individuelle Änderung';
 const mail=model.recordMailHandoff(record,{kind:'shipping',to:'cs@example.org',subject,body,language:'de'},manager,'2026-11-06T11:40:00.000Z');
 assert.equal(mail.body,body);
 assert.equal(mail.subject,subject);
 assert.equal(mail.to,'cs@example.org');
 assert.equal(mail.createdBy.name,'Logistik Eins');
 assert.equal(mail.status,'open_requested');
 assert.equal(mail.sentAt,null);
 assert.equal(record.mailHistory.length,1);
 assert.equal(record.history.at(-1).event,'mail_open_requested');
 assert.equal(record.updatedAt,'2026-11-06T11:40:00.000Z');
});
test('Actual sending requires a separate authenticated manual confirmation; content stays immutable',()=>{
 const record=order(),mail=model.recordMailHandoff(record,{kind:'problem',to:'cs@example.org',subject:'Original',body:'Original content',language:'en'},manager);
 const confirmed=model.confirmMailSent(record,mail.id,otherManager,'2026-11-06T11:45:00.000Z');
 assert.equal(confirmed.status,'sent_confirmed');
 assert.equal(confirmed.sentAt,'2026-11-06T11:45:00.000Z');
 assert.equal(confirmed.sentConfirmedBy.name,'Logistik Zwei');
 assert.equal(confirmed.body,'Original content');
 assert.equal(record.history.at(-1).event,'mail_sent_manually_confirmed');
 const events=record.history.length;
 model.confirmMailSent(record,mail.id,otherManager);
 assert.equal(record.history.length,events,'repeated confirmation is idempotent');
});
test('Only authorized logistics staff can save or confirm; recipient cannot be switched',()=>{
 const record=order(),args={kind:'shipping',to:'cs@example.org',subject:'Email',body:'Text',language:'de'};
 assert.throws(()=>model.recordMailHandoff(record,args,outsider),e=>e.code==='URGENT_FORBIDDEN');
 assert.throws(()=>model.recordMailHandoff(record,{...args,to:'thirdparty@example.org'},manager),e=>e.code==='URGENT_MAIL_RECIPIENT_MISMATCH');
 assert.throws(()=>model.recordMailHandoff(record,{...args,subject:'Bad\r\nBcc: evil@example.org'},manager),e=>e.code==='URGENT_MAIL_SUBJECT_INVALID');
 assert.throws(()=>model.recordMailHandoff(record,{...args,body:' '},manager),e=>e.code==='URGENT_MAIL_BODY_INVALID');
 const unshipped=order();unshipped.items[0].status='Open';
 assert.throws(()=>model.recordMailHandoff(unshipped,args,manager),e=>e.code==='URGENT_NOT_SHIPPED','shipping confirmations require all items shipped');
 assert.equal(unshipped.mailHistory,undefined);
 assert.equal(record.mailHistory,undefined,'failed validations must not create history');
 const mail=model.recordMailHandoff(record,args,manager);
 assert.throws(()=>model.confirmMailSent(record,mail.id,outsider),e=>e.code==='URGENT_FORBIDDEN');
 assert.throws(()=>model.confirmMailSent(record,'unknown',manager),e=>e.code==='URGENT_MAIL_NOT_FOUND');
});

test('Urgent Order mailto flow saves the current editor text before opening the mail application',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const html=fs.readFileSync(path.resolve('assets/urgent-orders.html'),'utf8');
 const start=html.indexOf('async function mailto()');
 const end=html.indexOf('async function copyDraft()',start);
 assert.ok(start>0&&end>start);
 const handler=html.slice(start,end);
 assert.match(handler,/const to=\$\('mailTo'\)\.value,sub=\$\('mailSubject'\)\.value,body=\$\('mailBody'\)\.value/);
 assert.match(handler,/await api\('record-mail-handoff',[\s\S]*?subject:sub,body/);
 assert.ok(handler.indexOf("await api('record-mail-handoff'")<handler.indexOf('window.location.href=uri'),'server-side save must finish before opening the mail program');
 assert.match(handler,/catch\(e\)/,'failed save must be handled without opening Outlook');
 assert.match(html,/data-confirm-mail/,'audit history must expose explicit sent confirmation');
});

test('Urgent Order overview has a dedicated sent-email column with one-click history',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const html=fs.readFileSync(path.resolve('assets/urgent-orders.html'),'utf8');
 assert.match(html,/<span data-i18n="urgentOrderV2.mailColumnTitle">E-Mail versendet<\/span>/);
 assert.match(html,/function mailColumnMarkup\(order\)/);
 assert.match(html,/order\.mailHistory/);
 assert.match(html,/records\.filter\(x=>x\.status==='sent_confirmed'\)/,'yes can only result from a confirmed send');
 assert.match(html,/data-open-mail-history/,'history button is in table cell');
 assert.match(html,/details\.open=true;/,'history action expands the order');
 assert.match(html,/recent\.open=true;/,'history action expands the newest email');
 assert.match(html,/mailColumnMarkup\(order\)/,'status is part of each Urgent Order row');
 assert.match(html,/details\.querySelectorAll\('\[data-open-mail-history\]'\)/);
});

test('Problem notifications and shipping confirmations share the saved mail history and remain distinguishable in the overview',()=>{
 const record=order();
 const problem=model.recordMailHandoff(record,{
  kind:'problem',to:'cs@example.org',subject:'SO3002 - Problem',
  body:'Bitte prüfen: Artikel nicht verfügbar.',language:'de'
 },manager,'2026-11-06T12:00:00.000Z');
 const shipping=model.recordMailHandoff(record,{
  kind:'shipping',to:'cs@example.org',subject:'SO3002 - Versandbestätigung',
  body:'Die Sendung wurde verschickt.',language:'de'
 },manager,'2026-11-06T12:05:00.000Z');
 assert.equal(record.mailHistory.length,2);
 assert.deepEqual(record.mailHistory.map(x=>x.kind),['problem','shipping']);
 assert.deepEqual(record.mailHistory.map(x=>x.status),['open_requested','open_requested']);
 model.confirmMailSent(record,shipping.id,manager,'2026-11-06T12:06:00.000Z');
 assert.equal(record.mailHistory[0].status,'open_requested','problem report must remain unconfirmed when shipping confirmation is sent');
 assert.equal(record.mailHistory[1].status,'sent_confirmed');
 model.confirmMailSent(record,problem.id,otherManager,'2026-11-06T12:08:00.000Z');
 assert.equal(record.mailHistory[0].status,'sent_confirmed');
 assert.equal(record.mailHistory[0].sentConfirmedBy.name,'Logistik Zwei');
 assert.equal(record.mailHistory[0].body,'Bitte prüfen: Artikel nicht verfügbar.');
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.resolve('assets/urgent-orders.html'),'utf8');
 assert.match(html,/\['problem','shipping'\]\.map\(kind=>/,'overview must distinguish the two email types');
 assert.match(html,/mailColumnPartial/,'mixed states must not display a false full sent confirmation');
 assert.match(html,/data-mail="problem"/,'problem report button must stay available');
 assert.match(html,/id:modalOrder,kind:modalKind,to,subject:sub,body/,'problem emails must use the same exact-text save path');
 assert.match(html,/mailKindProblem/,'history must identify problem messages');
});
