import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const urgent=require('../api/shared/urgent-orders.js');

function sample(status='Problem'){
 return{
  orderNumber:'SO3002',email:'cs@example.org',language:'de',priority:'P1',delivery:'DIRECT',
  orderType:'STANDARD',
  items:[
   {line:'10',article:'ART-100',quantity:2,status},
   {line:'20',article:'ART-200',quantity:1,status}
  ]
 };
}
const currentEmployee={id:'user-42',user:'lager.max',name:'Max Mustermann'};

test('Urgent-Order problem mail uses short DU format, real website issue, order, articles and CURRENT login',()=>{
 const order=sample();
 order.createdBy={id:'creator-17',name:'Former Creator'};
 const draft=urgent.draftMail(order,'problem','de','  Artikel 20 fehlt beim Packen.  ',currentEmployee);
 assert.equal(draft.to,'cs@example.org');
 assert.equal(draft.body,[
  'Hallo,','',
  'Problem: Artikel 20 fehlt beim Packen.','',
  'Auftrag: SO3002',
  'Artikel: ART-100, ART-200','',
  'Gruß','lager.max'
 ].join('\n'));
 assert.doesNotMatch(draft.body,/P1|Lieferart|Status|Former Creator|Mit freundlichen Grüßen/);
 assert.match(draft.subject,/SO3002/);
});

test('English mail uses informal, localized labels and current user, not untranslated D365 status',()=>{
 const draft=urgent.draftMail(sample(),'problem','en','Item 20 is missing in picking.',currentEmployee);
 assert.equal(draft.body,[
  'Hi,','',
  'Issue: Item 20 is missing in picking.','',
  'Sales order: SO3002',
  'Item: ART-100, ART-200','',
  'Cheers,','lager.max'
 ].join('\n'));
 assert.doesNotMatch(draft.body,/Problem|Status|P1|DIRECT/);
});

test('Shipment email stays short, does not claim shipment before statuses allow it',()=>{
 assert.throws(()=>urgent.draftMail(sample(),'shipping','de','',currentEmployee),e=>e.code==='URGENT_NOT_SHIPPED');
 const de=urgent.draftMail(sample('Shipped'),'shipping','de','',currentEmployee);
 const en=urgent.draftMail(sample('Shipped'),'shipping','en','',currentEmployee);
 assert.match(de.body,/Hallo,\n\nWir bestätigen dir den Versand\./);
 assert.match(en.body,/Hi,\n\nWe confirm your order has shipped\./);
 assert.match(de.body,/Gruß\nlager\.max$/);
 assert.match(en.body,/Cheers,\nlager\.max$/);
 assert.doesNotMatch(de.body,/Status:|Lieferart:|Priorität:/);
});

test('Mail composer reuses stored problem notes and API never trusts browser sender identity',()=>{
 const page=readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
 const api=readFileSync(new URL('../api/urgent-orders/index.js',import.meta.url),'utf8');
 assert.match(page,/function websiteProblemText\(order\)/);
 assert.match(page,/item\.problemNote,item\.exceptionReason/);
 assert.match(page,/\$\('mailIssue'\)\.value=kind==='problem'\?websiteProblemText\(o\):''/);
 assert.match(api,/model\.draftMail\(order,model\.text\(p\.kind,30\),model\.language\(p\.language\|\|order\.language\),p\.note,user\)/);
});
