import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const model=require('../api/shared/urgent-orders.js');
const html=readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
const translations=lang=>JSON.parse(readFileSync(new URL('../assets/i18n/'+lang+'.json',import.meta.url),'utf8'));
const order={
 orderNumber:'SO3002',email:'cs@example.org',language:'de',
 delivery:'DRP',priority:'P2',items:[{line:'10',article:'ABC',quantity:2,status:'Open'}]
};

test('Urgent Order problem note is checked locally, beside the correct field and before calling the API',()=>{
 assert.match(html,/<textarea id="mailIssue"[^>]*minlength="8"[^>]*maxlength="2000"[^>]*aria-describedby="mailIssueError"/);
 assert.match(html,/<small id="mailIssueError" class="field-error" role="alert" hidden><\/small>/);
 assert.match(html,/function showMailIssueError\(\)[\s\S]*?setAttribute\('aria-invalid','true'\)[\s\S]*?\$\('mailIssue'\)\.focus\(\)/);
 assert.match(html,/\$\('mailIssue'\)\.addEventListener\('input',[\s\S]*?clearMailIssueError\(\)/);
 const start=html.indexOf('async function generateDraft(){');
 const end=html.indexOf('async function mailto(){',start);
 assert.ok(start>0&&end>start);
 const handler=html.slice(start,end);
 const validation=handler.indexOf("if(modalKind==='problem'&&$('mailIssue').value.trim().length<8)");
 const request=handler.indexOf("await api('prepare-mail'");
 assert.ok(validation>=0&&validation<request,'invalid note must not trigger API call');
 assert.match(handler,/if\(e\.code==='URGENT_MAIL_NOTE_REQUIRED'\)\{showMailIssueError\(\);return;\}/);
});

test('A rejected template request does not clear the current mail editor, and the handoff still saves exact text',()=>{
 const start=html.indexOf('async function generateDraft(){');
 const end=html.indexOf('async function mailto(){',start);
 const handler=html.slice(start,end);
 assert.doesNotMatch(handler,/\$\('mailSubject'\)\.value=''/);
 assert.doesNotMatch(handler,/\$\('mailBody'\)\.value=''/);
 const handoff=html.slice(end,html.indexOf('async function copyDraft()',end));
 assert.match(handoff,/const to=\$\('mailTo'\)\.value,sub=\$\('mailSubject'\)\.value,body=\$\('mailBody'\)\.value/);
 assert.ok(handoff.indexOf("await api('record-mail-handoff'")<handoff.indexOf('window.location.href=uri'));
});

test('Backend still enforces a genuine note of >=8 characters without interfering with shipping confirmations',()=>{
 assert.throws(()=>model.draftMail(order,'problem','de','  Kurz  '),e=>e.code==='URGENT_MAIL_NOTE_REQUIRED');
 assert.throws(()=>model.draftMail(order,'problem','en','        '),e=>e.code==='URGENT_MAIL_NOTE_REQUIRED');
 const valid=model.draftMail(order,'problem','de',' Ware fehlt ');
 assert.match(valid.body,/Ware fehlt/);
 assert.equal(valid.to,order.email);
 // A shipment confirmation has its own status restriction, never a note requirement.
 assert.throws(()=>model.draftMail(order,'shipping','de',''),e=>e.code==='URGENT_NOT_SHIPPED');
});

test('German and English field messages exist and remain readable',()=>{
 for(const lang of ['de','en']){
  const i18n=translations(lang);
  assert.ok(i18n['urgentOrderV2.mailNoteRequired'].length>15);
  assert.ok(i18n['urgentOrderV2.mailDraftReady'].length>5);
 }
});
