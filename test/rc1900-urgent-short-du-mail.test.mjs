import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const urgent=require('../api/shared/urgent-orders.js');
const translator=require('../api/shared/urgent-mail-translation.js');

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
 assert.match(api,/model\.draftMail\(order,kind,lang,translation\.text,user\)/);
 assert.match(page,/noteLanguage:websiteLanguage/);
 assert.match(page,/r\.translationWarningText/);
});

test('Free-text problem is translated to the chosen mail language with server-only API credentials',async()=>{
 let url='',body='',key='';
 const result=await translator.translateIssueNote('Artikel fehlt','de','en',{
  config:{configured:true,endpoint:'https://api.cognitive.microsofttranslator.com',region:'westeurope',key:'server-secret'},
  fetchImpl:async(request,opts)=>{
   url=request;body=opts.body;key=opts.headers['Ocp-Apim-Subscription-Key'];
   return{ok:true,json:async()=>[{detectedLanguage:{language:'de'},translations:[{to:'en',text:'Item missing'}]}]};
  }
 });
 assert.match(url,/to=en/);
 assert.deepEqual(JSON.parse(body),[{Text:'Artikel fehlt'}]);
 assert.equal(key,'server-secret');
 assert.deepEqual(result,{text:'Item missing',translated:true,translationWarning:false});
});

test('No translator is NOT silently treated as an already translated problem',async()=>{
 const result=await translator.translateIssueNote('Artikel fehlt','de','en',{config:{configured:false}});
 assert.deepEqual(result,{text:'Artikel fehlt',translated:false,translationWarning:true});
 const same=await translator.translateIssueNote('Artikel fehlt','de','de',{config:{configured:false}});
 assert.equal(same.translationWarning,false);
});

test('Translator outages keep editable original without claiming successful translation',async()=>{
 const failed=await translator.translateIssueNote('Artikel fehlt','de','en',{
  config:{configured:true,endpoint:'https://translator.example',key:'server-secret'},
  fetchImpl:async()=>{throw Error('offline');}
 });
 assert.equal(failed.text,'Artikel fehlt');
 assert.equal(failed.translationWarning,true);
});
