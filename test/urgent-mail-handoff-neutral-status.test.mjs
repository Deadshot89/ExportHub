import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
const langs=['de','en','pl','es','fr','it'];
const translations=Object.fromEntries(langs.map(lang=>[
 lang,JSON.parse(readFileSync(new URL('../assets/i18n/'+lang+'.json',import.meta.url),'utf8'))
]));
const start=html.indexOf('function mailColumnMarkup(order){');
const end=html.indexOf('function render(){',start);
assert.ok(start>0&&end>start,'mail overview and history functions are present');

function markupFor(order,lang='de'){
 const texts=translations[lang],ctx={
  localeV2:(key,fallback)=>texts['urgentOrderV2.'+key]||fallback,
  escapeHtml:v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  mailDate:()=> '07.11.2026, 18:00',
  canManage:true,
  txt:v=>String(v==null?'':v)
 };
 vm.createContext(ctx);
 vm.runInContext(html.slice(start,end),ctx);
 return{column:ctx.mailColumnMarkup(order),history:ctx.mailHistoryMarkup(order)};
}

test('Email handed to Outlook shows handoff and never an unverified sent badge',()=>{
 const order={orderNumber:'SO3002',mailHistory:[{
  id:'msg-1',kind:'problem',to:'cs@example.org',language:'de',
  subject:'Urgent SO3002',body:'Actual text from ExportHUB360',
  status:'open_requested',createdAt:'2026-11-07T17:00:00Z',createdBy:{name:'Logistik'}
 }]};
 const {column,history}=markupFor(order);
 assert.match(column,/An E-Mail-Programm übergeben/);
 assert.match(history,/An E-Mail-Programm übergeben/);
 assert.match(history,/Nur an das E-Mail-Programm übergeben/);
 assert.match(history,/Actual text from ExportHUB360/);
 assert.doesNotMatch(column,/Nicht bestätigt|Ja · manuell bestätigt|E-Mail versendet/);
 assert.doesNotMatch(column,/order-mail-badge sent/);
 assert.doesNotMatch(history,/data-confirm-mail|Tatsächlichen Versand bestätigen/);
});

test('Mixed historic confirmations do not mislabel new email handoffs',()=>{
 const order={orderNumber:'SO3002',mailHistory:[
  {id:'old',kind:'shipping',status:'sent_confirmed',to:'cs@example.org',subject:'Old',body:'Old body',createdBy:{name:'Logistik'},createdAt:'2026-11-06',sentAt:'2026-11-06',sentConfirmedBy:{name:'Colleague'}},
  {id:'new',kind:'problem',status:'open_requested',to:'cs@example.org',subject:'New',body:'New body',createdBy:{name:'Logistik'},createdAt:'2026-11-07'}
 ]};
 const {column,history}=markupFor(order);
 assert.match(column,/Übergeben · früher bestätigt/);
 assert.match(column,/Problemmeldung: An E-Mail-Programm übergeben/);
 assert.match(history,/Versand früher manuell bestätigt/);
 assert.match(history,/An E-Mail-Programm übergeben/);
 assert.doesNotMatch(history,/data-confirm-mail/);
});

test('No email records remain distinct from transferred emails',()=>{
 const {column,history}=markupFor({orderNumber:'SO3002',mailHistory:[]});
 assert.match(column,/Keine E-Mail/);
 assert.match(history,/Noch keine E-Mails/);
 assert.doesNotMatch(column,/An E-Mail-Programm übergeben/);
});

test('All supported languages avoid mandatory confirmation and false sent labels',()=>{
 for(const lang of langs){
  const dict=translations[lang],order={orderNumber:'SO3002',mailHistory:[{
   id:'msg-1',kind:'problem',to:'cs@example.org',subject:'SO3002',body:'Message body',
   language:lang,createdBy:{name:'Logistik'},status:'open_requested'
  }]};
  const {column,history}=markupFor(order,lang);
  for(const key of ['mailIntro','mailColumnTitle','mailColumnPending','mailStatusOpenRequested','mailSaved','mailHandoffDisclaimer']){
   assert.ok(dict['urgentOrderV2.'+key]?.length>10,lang+' missing '+key);
  }
  assert.ok(column.includes(dict['urgentOrderV2.mailColumnPending']),lang+' pending label wrong');
  assert.ok(history.includes(dict['urgentOrderV2.mailStatusOpenRequested']),lang+' history label wrong');
  assert.ok(history.includes(dict['urgentOrderV2.mailHandoffDisclaimer']),lang+' disclaimer missing');
  assert.doesNotMatch(history,/data-confirm-mail/);
 }
});

test('No Graph integration or new automatic send action added to the existing Outlook flow',()=>{
 const api=readFileSync(new URL('../api/urgent-orders/index.js',import.meta.url),'utf8');
 const handoff=html.slice(html.indexOf('async function mailto(){'),html.indexOf('async function copyDraft(){'));
 assert.match(handoff,/await api\('record-mail-handoff'/);
 assert.match(handoff,/window\.location\.href=uri/);
 assert.ok(handoff.indexOf("await api('record-mail-handoff'")<handoff.indexOf('window.location.href=uri'));
 assert.doesNotMatch(handoff,/send-mail-direct|confirm-mail-sent|graphMail/);
 assert.doesNotMatch(html,/data-confirm-mail/);
 assert.doesNotMatch(api,/if\(action==='send-mail-direct'\)/);
 assert.doesNotMatch(api,/graphMail\.sendTextMail/);
});
