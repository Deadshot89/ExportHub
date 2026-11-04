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
   assert.match(page,new RegExp('<option value="'+code+'" data-i18n="urgentOrderV2\.'+code+'">'+code+' · '+label+'</option>'));
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
  // Some short words are identically spelled in English and the target language.
  const validSharedWords={es:{'urgentOrderV2.no':'No'},fr:{'urgentOrderV2.expressService':'Express','urgentOrderV2.directShortDelivery':'Direct'},it:{'urgentOrderV2.no':'No'}};
  const lang=langs[j],shared=validSharedWords[lang]&&validSharedWords[lang][key];
  if(shared!==undefined)assert.equal(data[j][key],shared,lang+' shared word changed unexpectedly');
  else if(j>1&&key!=='urgentOrderV2.heroEyebrow')assert.notEqual(data[j][key],data[1][key],lang+' English placeholder '+key);
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

test('all human-readable dropdown choices have explicit six-language translations',()=>{
 const langs=['de','en','pl','es','fr','it'];
 const packs=langs.map(l=>JSON.parse(read('assets/i18n/'+l+'.json')));
 const all=[publicHtml,internalHtml].map(page=>page.split('<script>')[0]).join('\\n');
 for(const label of ['Bitte auswählen','Bitte prüfen','Ja','Nein','Direktlieferung','Lkw','Paketdienst','Kurier','Sonstiges','Alle Prioritäten','Alle Stufen','Alle Lieferarten','Alle Status']){
  const re=new RegExp('<option[^>]*>'+label+'<\\/option>','g');
  for(const match of all.matchAll(re))assert.match(match[0],/data-i18n="urgentOrderV2\.[A-Za-z0-9]+"/,'untranslated dropdown '+label);
 }
 for(const html of [publicHtml,internalHtml]){
  for(const match of html.matchAll(/<option[^>]+data-i18n="(urgentOrderV2\.[A-Za-z0-9]+)"[^>]*>/g)){
   for(let i=0;i<packs.length;i++)assert.ok(packs[i][match[1]],langs[i]+' missing '+match[1]);
  }
 }
 assert.match(publicHtml,/function localizeLineChoices\(/);
 assert.match(internalHtml,/function localizeLineChoices\(/);
 for(const html of [publicHtml,internalHtml])assert.match(html,/option.setAttribute\('data-i18n','urgentOrderV2\.'\+key\)/);

});


test('urgent tracking link uses wonderful-forest on production, isolates testservice and preserves token',()=>{
 const source=script(publicHtml);
 const from=source.indexOf('function urgentTrackingBase(){');
 const until=source.indexOf('\nfunction activateLink(){',from);
 assert.ok(from>=0&&until>from,'canonical link builder must exist');
 const body=source.slice(from,until);
 const make=(hostname,origin)=>{
  const context=vm.createContext({location:{hostname,origin},Set});
  vm.runInContext(body,context);
  return context.urgentTrackingBase();
 };
 const canonical='https://wonderful-forest-0f315e310.7.azurestaticapps.net/urgent-order';
 assert.equal(make('wonderful-forest-0f315e310.7.azurestaticapps.net','https://wonderful-forest-0f315e310.7.azurestaticapps.net'),canonical);
 assert.equal(make('exporthub360.com','https://exporthub360.com'),canonical);
 assert.equal(make('www.exporthub360.de','https://www.exporthub360.de'),canonical);
 const testOrigin='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
 assert.equal(make('ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',testOrigin),testOrigin+'/urgent-order');
 assert.match(source,/trackingUrl'\)\.textContent=urgentTrackingBase\(\)\+'#access='\+encodeURIComponent\(secret\)/);
});


test('internal urgent-order navigation uses wonderful-forest for production and stays on testservice',()=>{
 const source=script(internalHtml);
 assert.match(internalHtml,/id="urgentPublicFormLink"/);
 assert.match(internalHtml,/id="urgentBackToHub"/);
 assert.match(source,/urgentPublicFormLink'\)\.href=urgentPublicOrigin\(\)\+'\/urgent-order'/);
 assert.match(source,/urgentBackToHub'\)\.href=urgentPublicOrigin\(\)\+'\/'/);
 const from=source.indexOf('function urgentPublicOrigin(){');
 const until=source.indexOf('\nlet orders=',from);
 assert.ok(from>=0&&until>from,'navigation origin must be defined');
 const check=(host,origin)=>{
  const ctx=vm.createContext({location:{hostname:host,origin},Set});
  vm.runInContext(source.slice(from,until),ctx);
  return ctx.urgentPublicOrigin();
 };
 const official='https://wonderful-forest-0f315e310.7.azurestaticapps.net';
 assert.equal(check('exporthub360.com','https://exporthub360.com'),official);
 assert.equal(check('wonderful-forest-0f315e310.7.azurestaticapps.net',official),official);
 const testservice='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
 assert.equal(check('ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',testservice),testservice);
});


test('canonical tracking link preserves real capability token when activated and copied',()=>{
 const source=script(publicHtml);
 const functions=[
  source.slice(source.indexOf('function accessFromHash(){'),source.indexOf('\nfunction flag(',source.indexOf('function accessFromHash(){'))),
  source.slice(source.indexOf('function urgentTrackingBase(){'),source.indexOf('\nasync function refresh(){',source.indexOf('function urgentTrackingBase(){')))
 ];
 assert.ok(functions.every(s=>s.startsWith('function ')),'public URL helpers must be extractable');
 const token='uro_'+'B'.repeat(43);
 for(const [hostname,origin,expected] of [
  ['exporthub360.com','https://exporthub360.com','https://wonderful-forest-0f315e310.7.azurestaticapps.net'],
  ['www.exporthub360.de','https://www.exporthub360.de','https://wonderful-forest-0f315e310.7.azurestaticapps.net'],
  ['wonderful-forest-0f315e310.7.azurestaticapps.net','https://wonderful-forest-0f315e310.7.azurestaticapps.net','https://wonderful-forest-0f315e310.7.azurestaticapps.net'],
  ['ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net','https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net','https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net']
 ]){
  const elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:''});return elements.get(id);};
  const ctx=vm.createContext({location:{hostname,origin,hash:'#access='+token},secret:token,$,Set,encodeURIComponent});
  vm.runInContext(functions.join('\n'),ctx);
  assert.equal(ctx.accessFromHash(),token,'existing hash token remains readable');
  vm.runInContext('activateLink()',ctx);
  assert.equal($('tracking').hidden,false,'tracking controls become visible');
  assert.equal($('trackingUrl').textContent,expected+'/urgent-order#access='+token);
 }
 assert.match(source,/clipboard\.writeText\(\$\('trackingUrl'\)\.textContent\)/);
});


test('urgent-only ExportHUB menu opens wonderful-forest while other module routing stays untouched',()=>{
 const menu=read('assets/pack-notification-nav.js');
 const start=menu.indexOf(' function urgentOrdersDestination(){');
 const end=menu.indexOf('\n function ensure(){',start);
 assert.ok(start>=0&&end>start,'urgent-only destination helper is present');
 const helper=menu.slice(start,end);
 const destination=hostname=>{
  const ctx=vm.createContext({w:{location:{hostname}}});
  vm.runInContext(helper,ctx);
  return ctx.urgentOrdersDestination();
 };
 const canonical='https://wonderful-forest-0f315e310.7.azurestaticapps.net/assets/urgent-orders.html';
 for(const hostname of ['wonderful-forest-0f315e310.7.azurestaticapps.net','exporthub360.de','www.exporthub360.de','exporthub360.com','www.exporthub360.com'])
  assert.equal(destination(hostname),canonical);
 assert.equal(destination('ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'),'/assets/urgent-orders.html');
 assert.equal(destination('localhost'),'/assets/urgent-orders.html');
 assert.match(menu,/w\.location\.assign\(urgentOrdersDestination\(\)\)/);
 assert.match(menu,/function openInbox\(/,'the Packmeldung module remains present');
});


test('old Urgent Order URLs redirect only their own page and preserve token fragments',()=>{
 const source=script(publicHtml);
 const begin=source.indexOf('function redirectLegacyUrgentHost(){');
 const end=source.indexOf('\nif(redirectLegacyUrgentHost())return;',begin);
 assert.ok(begin>=0&&end>begin,'legacy redirect helper is present');
 const body=source.slice(begin,end);
 const token='uro_'+'C'.repeat(43);
 const redirect=(hostname,search='',hash='')=>{
  let redirected='';
  const ctx=vm.createContext({location:{hostname,search,hash,replace(url){redirected=url;}}});
  vm.runInContext(body,ctx);
  const active=vm.runInContext('redirectLegacyUrgentHost()',ctx);
  return {active,redirected};
 };
 for(const hostname of ['exporthub360.com','www.exporthub360.de','www.exporthub360.com','exporthub360.de']){
  const result=redirect(hostname,'','#access='+token);
  assert.equal(result.active,true);
  assert.equal(result.redirected,'https://wonderful-forest-0f315e310.7.azurestaticapps.net/urgent-order#access='+token);
 }
 for(const hostname of ['wonderful-forest-0f315e310.7.azurestaticapps.net','ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net','localhost']){
  assert.deepEqual(redirect(hostname),{active:false,redirected:''},hostname+' must not redirect');
 }
 assert.match(source,/if\(redirectLegacyUrgentHost\(\)\)return;/);
});


test('urgent sidebar entry keeps native styling and stays below Packmeldungen after redraw',()=>{
 const menu=read('assets/pack-notification-nav.js');
 const start=menu.indexOf('/* Urgent Order: sidebar add-on immediately below Packmeldungen');
 const end=menu.indexOf('/* Urgent Order: a lightweight, permission-scoped open-request count',start);
 assert.ok(start>=0&&end>start,'dedicated navigation module must exist');
 const source=menu.slice(start,end);
 const handlers={},timers=[],navigation=[];
 const node=(name,attrs={})=>{
  const n={tagName:name,attributes:{...attrs},children:[],parentNode:null,className:'',innerHTML:'',style:{setProperty(){}},setAttribute(k,v){this.attributes[k]=v;},
   getAttribute(k){return this.attributes[k]??null;},addEventListener(k,f){this['on'+k]=f;},
   appendChild(c){return this.insertBefore(c,null);},
   insertBefore(c,ref){
    if(c.parentNode){const old=c.parentNode.children.indexOf(c);if(old>=0)c.parentNode.children.splice(old,1);}
    let index=ref?this.children.indexOf(ref):-1;if(index<0)index=this.children.length;
    this.children.splice(index,0,c);c.parentNode=this;return c;
   },
   get nextSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null;},
   querySelector(selector){
    const clauses=selector.split(',').map(v=>v.trim());
    const matches=c=>clauses.some(clause=>{
     const m=clause.match(/^\[([a-z-]+)(?:="([^"]+)")?\]$/);
     return m&&(m[1] in c.attributes)&&(m[2]===undefined||c.attributes[m[1]]===m[2]);
    });
    const stack=[...this.children];
    while(stack.length){const c=stack.shift();if(matches(c))return c;stack.unshift(...c.children);}
    return null;
   }};
  return n;
 };
 const nav=node('nav'),head=node('head'),body=node('body');
 const dashboard=node('button',{'data-view':'dashboard'}),tasks=node('button',{'data-view':'tasks'}),pack=node('button',{'data-pack-notifications-nav':''});
 tasks.className='index305-menu-entry active';
 pack.className='pack-notification-nav-entry index305-menu-entry';
 nav.appendChild(dashboard);nav.appendChild(tasks);nav.appendChild(pack);
 let currentNav=nav;
 const doc={
  head,documentElement:head,body,readyState:'complete',hidden:false,
  querySelector(sel){
   if(sel==='#nav')return currentNav;
   if(sel==='[data-exporthub-urgent-nav]')return nav.querySelector(sel)||body.querySelector(sel);
   return null;
  },
  getElementById(id){return head.children.find(c=>c.id===id)||null;},
  createElement(tag){return node(tag);},addEventListener(){}
 };
 const win={
  document:doc,location:{hostname:'exporthub360.de',assign(url){navigation.push(url);}},
  addEventListener(name,fn){handlers[name]=fn;},setInterval(fn){timers.push(fn);}
 };
 vm.runInNewContext(source,{window:win,globalThis:win});
 let urgent=nav.querySelector('[data-exporthub-urgent-nav]');
 assert.ok(urgent,'urgent entry must be inserted');
 assert.deepEqual(nav.children.map(n=>n===dashboard?'dashboard':n===tasks?'tasks':n===pack?'pack':'urgent'),['dashboard','tasks','pack','urgent']);
 assert.ok(urgent.className.includes('index305-menu-entry'),'inherit existing menu typography');
 assert.equal(urgent.className.includes('active'),false,'must not inherit active state');
 assert.equal(urgent.className.includes('pack-notification-nav-entry'),false,'must not inherit Packmeldungen styling');
 assert.match(urgent.innerHTML,/index308-nav-icon urgent-orders-nav-icon/);
 assert.match(urgent.innerHTML,/<svg /,'use a native-style SVG icon instead of a text exclamation mark');
 assert.match(urgent.innerHTML,/index308-nav-label urgent-orders-nav-label/);
 assert.equal((head.children.filter(n=>n.id==='exporthub-urgent-nav-style')).length,1);
 const urgentStyles=head.children.find(n=>n.id==='exporthub-urgent-nav-style').textContent;
 assert.match(urgentStyles,/html\[data-eh-design="modern"\]/,'modern sidebar styling remains supported');
 assert.match(urgentStyles,/@media\(max-width:760px\)/,'mobile layout must be responsive');
 assert.match(urgentStyles,/width:auto!important;flex:0 0 auto!important/,'urgent button must not fill mobile navigation width');
 urgent.onclick({preventDefault(){},stopImmediatePropagation(){}});
 assert.equal(navigation[0],'https://wonderful-forest-0f315e310.7.azurestaticapps.net/assets/urgent-orders.html');
 // Simulate a sidebar redraw: the old button appears ahead of Dashboard again.
 nav.insertBefore(urgent,dashboard);
 handlers['exporthub:rendered']();
 assert.deepEqual(nav.children.map(n=>n===dashboard?'dashboard':n===tasks?'tasks':n===pack?'pack':'urgent'),['dashboard','tasks','pack','urgent']);
 assert.strictEqual(nav.querySelector('[data-exporthub-urgent-nav]'),urgent,'reuse the badge owner and click handler');
 timers[0]();
 assert.equal(nav.children.length,4,'no duplicate entries on periodic reconciliation');
 // If Packmeldungen is temporarily absent, fall back to Aufgaben and relocate once it returns.
 nav.children.splice(nav.children.indexOf(pack),1);pack.parentNode=null;
 timers[0]();
 assert.equal(tasks.nextSibling,urgent);
 nav.insertBefore(pack,urgent);timers[0]();
 assert.equal(pack.nextSibling,urgent);
 // Even an accidentally misplaced entry is moved back to the real sidebar.
 nav.children.splice(nav.children.indexOf(urgent),1);urgent.parentNode=null;body.appendChild(urgent);
 timers[0]();
 assert.equal(pack.nextSibling,urgent);
 // Don't create a floating button above Dashboard while the real menu isn't available.
 currentNav=null;nav.children.splice(nav.children.indexOf(urgent),1);urgent.parentNode=null;
 const count=nav.children.length;
 timers[0]();
 assert.equal(nav.children.length,count);
 // A node created by an older runtime must be upgraded without losing its badge.
 currentNav=nav;
 urgent.className='urgent-orders-nav-entry pack-notification-nav-entry active';
 urgent.innerHTML='<span class="index308-nav-icon">!</span><span>Urgent Order</span>';
 delete urgent.attributes['data-urgent-nav-design'];
 const liveBadge=node('span',{'data-urgent-open-count':''});
 liveBadge.textContent='6';
 urgent.setAttribute('aria-label','Urgent Order: 6 offene Anfragen');
 urgent.appendChild(liveBadge);
 nav.insertBefore(urgent,dashboard);
 handlers['exporthub:rendered']();
 assert.equal(pack.nextSibling,urgent);
 assert.equal(urgent.getAttribute('data-urgent-nav-design'),'2');
 assert.ok(urgent.innerHTML.includes('<svg '),'legacy exclamation symbol must become an SVG');
 assert.strictEqual(urgent.querySelector('[data-urgent-open-count]'),liveBadge,'preserve live counter');
 assert.equal(liveBadge.textContent,'6');
 assert.equal(urgent.getAttribute('aria-label'),'Urgent Order: 6 offene Anfragen','accessible count must remain intact');
 assert.equal(urgent.className.includes('active'),false,'old active class must not survive');
 assert.equal(urgent.className.includes('pack-notification-nav-entry'),false);
 assert.equal(head.children.filter(x=>x.id==='exporthub-urgent-nav-style').length,1,'style is not duplicated');
});


test('released sidebar menu treats Urgent Order as an add-on without reshuffling core navigation',()=>{
 const builder=read('.github/rc1112/build-three-env.mjs');
 const canonical=read('index.html');
 const original="var ADDON_BUTTONS='[data-pack-notifications-nav],[data-rc1555-packaging-nav]';";
 const extended="var ADDON_BUTTONS='[data-pack-notifications-nav],[data-rc1555-packaging-nav],[data-exporthub-urgent-nav]';";
 assert.ok(canonical.includes(original),'the existing source menu contract remains unchanged');
 assert.ok(builder.includes('const rc1805CoreAddons='+JSON.stringify(original)+';'));
 assert.ok(builder.includes('const rc1805UrgentAddons='+JSON.stringify(extended)+';'));
 assert.match(builder,/if\(html\.includes\(rc1805CoreAddons\)\)html=html\.replace\(rc1805CoreAddons,rc1805UrgentAddons\)/);
 assert.match(builder,/RC1805 Urgent-Order-Menü wird nicht als Add-on erkannt/);
 for(const file of ['index.html','TESTVERSION.html','demo.html'])assert.ok(builder.includes("'"+file+"'"));
});
