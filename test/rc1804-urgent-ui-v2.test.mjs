import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const publicHtml=read('assets/urgent-order-report.html');
const internalHtml=read('assets/urgent-orders.html');
const script=page=>{
 const match=page.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,'inline runtime missing');
 assert.doesNotThrow(()=>new vm.Script(match[1]));
 return match[1];
};
function renderedViews(source,initial,views){
 const code=script(source);
 const line=code.split('\n').find(s=>s.startsWith('function showView(view){'));
 assert.ok(line,'tab switch must be an actual function');
 const nodes=new Map();
 const $=id=>{
  if(!nodes.has(id))nodes.set(id,{hidden:false,tabIndex:0,textContent:'',attributes:{},setAttribute(key,value){this.attributes[key]=value;}});
  return nodes.get(id);
 };
 const ctx=vm.createContext({$,localeV2:(k,source)=>source,tab:'open',currentTab:'open',activeView:initial});
 vm.runInContext(line,ctx);
 return{ctx,$,select:next=>ctx.showView(next)};
}
test('public page has three exclusive workspaces, no simultaneous form and table',()=>{
 const source=script(publicHtml);
 for(const id of ['tabNew','tabOpen','tabClosed','createPanel','listPanel','countOpen','countClosed','orderType','typeStandardHelp','typeDirectHelp'])assert.match(publicHtml,new RegExp('id="'+id+'"'));
 assert.match(publicHtml,/<section class="panel" id="listPanel" hidden>/);
 assert.match(publicHtml,/\.board\{display:block\}/);
 const v=renderedViews(publicHtml,'new');
 v.select('new');
 assert.equal(v.$('createPanel').hidden,false);
 assert.equal(v.$('listPanel').hidden,true);
 v.select('open');
 assert.equal(v.$('createPanel').hidden,true);
 assert.equal(v.$('listPanel').hidden,false);
 assert.equal(v.$('tabOpen').attributes['aria-selected'],'true');
 v.select('closed');
 assert.equal(v.$('createPanel').hidden,true);
 assert.equal(v.$('listPanel').hidden,false);
 assert.equal(v.ctx.tab,'closed');
 assert.equal(v.$('tabClosed').attributes['aria-selected'],'true');
 assert.match(source,/showView\('open'\);render\(\)/,'after submit opens tracking view');
});
test('internal logistics separates order creation from open/closed status lists',()=>{
 const source=script(internalHtml);
 for(const id of ['internalNew','internalOpen','internalClosed','internalCreatePanel','internalListPanel','internalOpenCount','internalClosedCount'])assert.match(internalHtml,new RegExp('id="'+id+'"'));
 assert.match(internalHtml,/\.layout\{display:block\}/);
 const v=renderedViews(internalHtml,'open');
 v.select('new');
 assert.equal(v.$('internalCreatePanel').hidden,false);
 assert.equal(v.$('internalListPanel').hidden,true);
 v.select('open');
 assert.equal(v.$('internalCreatePanel').hidden,true);
 assert.equal(v.$('internalListPanel').hidden,false);
 assert.equal(v.ctx.currentTab,'open');
 v.select('closed');
 assert.equal(v.$('internalListPanel').hidden,false);
 assert.equal(v.ctx.currentTab,'closed');
 assert.match(source,/orders\.filter\(isClosedOrder\)\.length/,'counts still based on all orders');
});
test('urgent priority values remain P1..P4, but labels use the customer-defined meanings',()=>{
 for(const page of [publicHtml,internalHtml]){
  for(const [code,label] of [['P1','Sondertransport'],['P2','Express Lieferung'],['P3','Backlog'],['P4','Auftrag von Heute']])
   assert.match(page,new RegExp('<option value="'+code+'" data-i18n="urgentOrderV2\\.'+code+'">'+code+' · '+label+'</option>'));
 }
 assert.match(publicHtml,/esc\(priorityText\(o\.priority\)\)/);
 assert.match(internalHtml,/escapeHtml\(priorityText\(order\.priority\)\)/);
 assert.match(publicHtml,/value="STANDARD"/);
 assert.match(publicHtml,/value="DIRECT_OUTBOUND"/);
 assert.match(publicHtml,/typeStandardHelp/);
 assert.match(publicHtml,/typeDirectHelp/);
 assert.match(script(publicHtml),/typeStandardHelp'\)\.hidden=direct/);
 assert.match(script(publicHtml),/typeDirectHelp'\)\.hidden=!direct/);
});
test('six-language workspaces do not reuse English placeholders for the updated text',()=>{
 const langs=['de','en','pl','es','fr','it'];
 const data=langs.map(l=>JSON.parse(read('assets/i18n/'+l+'.json')));
 const keys=Object.keys(data[0]).filter(k=>k.startsWith('urgentOrderV2.'));
 assert.ok(keys.length>=44);
 for(let j=1;j<langs.length;j++)for(const key of keys){
  assert.equal(typeof data[j][key],'string',langs[j]+' missing '+key);
  assert.ok(data[j][key].trim(),langs[j]+' empty '+key);
  if(j>1&&key!=='urgentOrderV2.heroEyebrow')assert.notEqual(data[j][key],data[1][key],langs[j]+' English placeholder '+key);
 }
 const repaired=['019','022','024','025','026','027','029','031','034','035','036','037','039','043','044','045','047','048','049','051','052','054','055','056','057','060','061','062','064','066','069','070','071','073','074','076','077','079'];
 for(let j=2;j<langs.length;j++)for(const suffix of repaired)assert.notEqual(data[j]['urgentOrder.ui.'+suffix],data[1]['urgentOrder.ui.'+suffix],langs[j]+' untranslated previous UI label '+suffix);
});

test('public request rendering calls the actual translation helper, including dynamic status cards',()=>{
 const source=script(publicHtml);
 assert.match(source,/function localeV2\(/);
 assert.match(source,/function statusText\(/);
 assert.match(source,/function priorityText\(/);
 assert.doesNotMatch(source,/\blabelFor\(/,'undefined translation helper must never be referenced');
 assert.match(source,/localeV2\(ids\[code\]/);
 assert.match(source,/localeV2\('arrivalShort'/);
 assert.match(source,/localeV2\('quantityShort'/);
});

test('status updates report feedback inside the visible request list, not the hidden creation form',()=>{
 const source=script(internalHtml);
 assert.match(internalHtml,/id="listMessage" class="message" role="status"/);
 assert.match(source,/setMessage\('listMessage',localeV2\('statusSaved'/);
 assert.match(source,/catch\(e\)\{select\.value=previous\|\|'Open';setMessage\('listMessage',e\.message,'error'\)/);
});
