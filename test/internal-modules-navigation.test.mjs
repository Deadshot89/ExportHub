import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const nav=read('assets/pack-notification-nav.js');
const menu=read('assets/rc1579-menu-redesign.js');

test('all three staff modules stay inside the ExportHUB workspace',()=>{
 assert.match(nav,/function openInbox\(/,'Packmeldungen retain the native inbox');
 assert.match(nav,/renderPackInbox\(\)/,'Packmeldungen can render without an iframe');
 assert.match(nav,/ExportHUBEmbeddedModules\.open\('urgentorders'\)/,'Urgent Order uses the in-app module');
 assert.match(menu,/ExportHUBEmbeddedModules\.open\('quality'\)/,'Quality uses the in-app module');
 assert.doesNotMatch(menu,/location\.assign\('\/qualitaet\.html'\)/,'Quality must not navigate away');
 assert.doesNotMatch(nav,/location\.assign\(urgentOrdersDestination\(\)\)/,'Urgent Order must not navigate away');
});

test('same-origin embedded module renders with an accessible title and preserves ExportHUB navigation',()=>{
 const start=nav.indexOf('/* Internal modules remain in ExportHUB360');
 const end=nav.indexOf('/* Urgent Order: sidebar add-on',start);
 assert.ok(start>=0&&end>start);
 const source=nav.slice(start,end);
 const nodes=[];
 const mk=tag=>({
  tagName:tag,children:[],attributes:{},style:{},addEventListener(name,callback){this['on'+name]=callback},
  setAttribute(k,v){this.attributes[k]=v},
  removeAttribute(k){delete this.attributes[k]},
  appendChild(child){this.children.push(child);return child},
  replaceChildren(...children){this.children=[...children]},
 });
 const head=mk('head'),body=mk('body'),content=mk('main'),urgent=mk('button'),quality=mk('button');
 const listeners={};
 urgent.closest=selector=>selector==='[data-exporthub-urgent-nav]'?urgent:null;
 quality.closest=selector=>selector==='[data-rc1579-proxy="quality"]'?quality:null;
 const document={
  addEventListener(name,handler,capture){listeners[name]={handler,capture}},
  head,body,documentElement:head,
  getElementById(id){if(id==='content')return content;return nodes.find(n=>n.id===id)||null},
  createElement(tag){const n=mk(tag);nodes.push(n);return n},
  querySelector(sel){return sel==='[data-exporthub-urgent-nav]'?urgent:sel==='[data-rc1579-proxy="quality"]'?quality:null}
 };
 const win={document};
 vm.runInNewContext(source,{window:win,globalThis:win});
 assert.equal(win.ExportHUBEmbeddedModules.open('urgentorders'),true);
 assert.equal(content.children.length,1);
 const frame=content.children[0].children[0];
 assert.equal(frame.tagName,'iframe');
 assert.equal(frame.src,'/assets/urgent-orders.html?embedded=1');
 assert.equal(frame.title,'Urgent Order');
 assert.equal(frame.attributes.referrerpolicy,'same-origin');
 assert.equal(body.attributes['data-exporthub-view'],'urgentorders');
 assert.equal(urgent.attributes['aria-current'],'page');
 assert.equal(quality.attributes['aria-current'],undefined);
 assert.equal(win.ExportHUBEmbeddedModules.open('quality'),true);
 const frame2=content.children[0].children[0];
 assert.equal(frame2.src,'/qualitaet.html?embedded=1');
 assert.equal(body.attributes['data-exporthub-view'],'quality');
 assert.equal(urgent.attributes['aria-current'],undefined);
 assert.equal(quality.attributes['aria-current'],'page');
 assert.equal(nodes.filter(n=>n.id==='exporthub-embedded-module-style').length,1,'no duplicate style after switching');

 // Both menu buttons already existed before this runtime loaded. Simulate
 // obsolete navigation listeners still attached to those reused elements.
 assert.equal(listeners.click.capture,true,'document capture intercepts stale handlers before the target');
 let staleRedirects=0;
 for(const [target,expectedView] of [[urgent,'urgentorders'],[quality,'quality']]){
  target.onclick=()=>{staleRedirects++};
  const event={target,defaultPrevented:false,stopped:false,
   preventDefault(){this.defaultPrevented=true},
   stopImmediatePropagation(){this.stopped=true}
  };
  listeners.click.handler(event);
  if(!event.stopped)target.onclick();
  assert.equal(event.defaultPrevented,true);
  assert.equal(event.stopped,true,'old click listener must not run');
  assert.equal(body.attributes['data-exporthub-view'],expectedView);
 }
 assert.equal(staleRedirects,0,'reused menu entries must never open the old standalone route');
 // Disabled quality links remain blocked by the existing menu-rights layer.
 quality.hidden=true;
 const blocked={target:quality,defaultPrevented:false,stopped:false,
  preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true}};
 listeners.click.handler(blocked);
 if(!blocked.stopped)quality.onclick();
 assert.equal(blocked.defaultPrevented,true,'hidden QM link cannot use obsolete navigation');
 assert.equal(blocked.stopped,true);
 assert.equal(staleRedirects,0,'hidden entries must never trigger a stale redirect');
});

test('frame protection is changed only for two same-origin staff pages in both environments',()=>{
 for(const configFile of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
  const cfg=JSON.parse(read(configFile));
  assert.equal(cfg.globalHeaders['Content-Security-Policy'],"frame-ancestors 'none'");
  assert.equal(cfg.globalHeaders['X-Frame-Options'],'DENY');
  for(const route of ['/assets/urgent-orders.html','/qualitaet.html']){
   const match=cfg.routes.filter(r=>r.route===route);
   assert.equal(match.length,1,route+' has one route');
   assert.equal(match[0].headers['Content-Security-Policy'],"frame-ancestors 'self'");
   assert.equal(match[0].headers['X-Frame-Options'],'SAMEORIGIN');
  }
  assert.equal(cfg.routes.find(r=>r.route==='/urgent-order').headers['Content-Security-Policy'],undefined,'public form remains unframeable');
  const all=cfg.routes.filter(r=>r.headers&&r.headers['X-Frame-Options']==='SAMEORIGIN');
  assert.deepEqual(all.map(x=>x.route).sort(),['/assets/urgent-orders.html','/qualitaet.html'].sort());
 }
});
