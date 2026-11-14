import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1067-startup-recovery.js','utf8');

function createBrowser() {
 const elements=new Map(), timers=[];
 const wrapper={insertions:0,insertBefore(node,before){assert.equal(before,label);this.insertions++;elements.set(node.id,node)}};
 const label={textContent:'Azure-Teamdaten werden geladen … · 5 s',parentNode:wrapper};
 const panel={hidden:false,classList:{contains(){return false}},contains(node){return node===label||node.id==='eh1904LogisticsScene'},getAttribute(){return null}};
 const head={appendChild(node){elements.set(node.id,node)}};
 const doc={readyState:'complete',head,body:{textContent:''},
  getElementById(id){return id==='cleanLoadPanel'?panel:id==='cleanLoadText'?label:elements.get(id)||null},
  createElement(tag){return {tag,id:'',style:{},attributes:{},setAttribute(key,val){this.attributes[key]=val}}},
  querySelector(){return null}};
 const win={document:doc,sessionStorage:{length:0,getItem(){return null}},
  addEventListener(){},location:{hostname:'example.com',pathname:'/'},
  setTimeout(fn,ms){timers.push([fn,ms]);return timers.length},clearTimeout(){}};
 vm.runInNewContext(source,{window:win,Date,encodeURIComponent,AbortController});
 return {elements,wrapper,label,win,advance(){const next=timers.find(([fn,ms])=>ms===5000);if(next)next[0]()}};
}

test('RC1904 adds a lightweight, decorative logistics scene without changing loading text',()=>{
 const b=createBrowser();
 const scene=b.elements.get('eh1904LogisticsScene');
 assert.ok(scene,'the scene should mount during the initial startup watchdog pass');
 assert.equal(scene.attributes['aria-hidden'],'true');
 assert.match(scene.innerHTML,/eh1904-building/);
 assert.match(scene.innerHTML,/eh1904-parcel/);
 assert.match(scene.innerHTML,/eh1904-truck/);
 assert.equal(b.label.textContent,'Azure-Teamdaten werden geladen … · 5 s');
 assert.equal(b.wrapper.insertions,1);
 b.advance();
 assert.equal(b.wrapper.insertions,1,'watchdog polling must never duplicate the scene');
});

test('RC1904 supports reduced motion and keeps startup/recovery logic unchanged',()=>{
 const b=createBrowser();
 const css=b.elements.get('eh1904LogisticsStyles').textContent;
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@keyframes eh1904Parcel/);
 assert.equal(typeof b.win.ExportHUBRC1067StartupRecovery.watch,'function');
 assert.equal(typeof b.win.ExportHUBRC1067StartupRecovery.check,'function');
});
