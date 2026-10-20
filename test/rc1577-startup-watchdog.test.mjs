import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1067-startup-recovery.js','utf8');

function fakeBrowser(){
  let now=100000, seq=0,visible=false, message='', reloads=0;
  const scheduled=new Map(),mounted=new Map(),events={};
  const content={textContent:'Dashboard · Sendungsübersicht · Azure-Teamdaten werden geladen …',style:{}};
  const panel={hidden:false,classList:{contains(name){return name==='hidden'&&!visible}},getAttribute(){return null}};
  const loadText={get textContent(){return message}};
  const body={textContent:'',getAttribute(key){return key==='data-exporthub-view'?'dashboard':'';},appendChild(node){mounted.set(node.id,node)}};
  const document={readyState:'complete',body,
    getElementById(id){return id==='content'?content:id==='cleanLoadPanel'?panel:id==='cleanLoadText'?loadText:mounted.get(id)||null},
    querySelector(){return{}},
    createElement(tag){return {tag,children:[],style:{},setAttribute(){},appendChild(child){this.children.push(child)},remove(){mounted.delete(this.id)}}}
  };
  const window={document,location:{hostname:'www.exporthub360.de',pathname:'/',reload(){reloads++}},
    sessionStorage:{length:0,getItem(){return null}},setView(){},
    addEventListener(name,fn){events[name]=fn},
    setTimeout(fn,ms){const id=++seq;scheduled.set(id,{fn,due:now+ms});return id},
    clearTimeout(id){scheduled.delete(id)}};
  class Clock extends Date{static now(){return now}}
  vm.runInNewContext(source,{window,Date:Clock,AbortController,encodeURIComponent});
  function advance(ms){
    const target=now+ms;let loops=0;
    while(true){
      const entry=[...scheduled.entries()].filter(([,v])=>v.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];
      if(!entry)break;
      if(++loops>250)throw Error('watchdog timer loop');
      scheduled.delete(entry[0]);now=entry[1].due;entry[1].fn();
    }
    now=target;
  }
  return {watch:window.ExportHUBRC1067StartupRecovery,advance,activate(text){visible=true;message=text},hide(){visible=false},get shown(){return mounted.has('rc1574StartupStall')},get reloads(){return reloads},events};
}

test('RC1577: hidden loading overlay and stale content are not mistaken for a broken UI',()=>{
  const b=fakeBrowser();
  assert.equal(b.watch.isBroken(),false);
  b.advance(60000);
  assert.equal(b.shown,false);
});

test('RC1577: delayed login triggers retry only after 25 seconds continuously stalled',()=>{
  const b=fakeBrowser();
  b.advance(60000); // user stays on login page before sign-in
  b.activate('Azure-Teamdaten werden geladen … · 0 s');
  assert.equal(b.watch.isBroken(),true,'visible blocking overlay must override stale interactive dashboard');
  b.advance(25000);
  assert.equal(b.shown,false,'no alert before 25 seconds of observed loading');
  b.advance(5000);
  assert.equal(b.shown,true,'retry panel must appear even for late login');
  b.hide();
  b.advance(5000);
  assert.equal(b.shown,false,'stale panel is cleared once loading ends');
});

test('RC1577: the login-spinner alone is not enough to trigger an Azure-data warning',()=>{
  const b=fakeBrowser();
  b.activate('Anmeldedaten werden geprüft …');
  b.advance(50000);
  assert.equal(b.shown,false);
  assert.equal(b.watch.isBroken(),false);
});

test('RC1577: recovery-ready signal clears retry without clearing session storage',()=>{
  const b=fakeBrowser();
  b.activate('Azure-Teamdaten werden geladen …');
  b.advance(30000);
  assert.equal(b.shown,true);
  b.events['exporthub:ready']();
  assert.equal(b.shown,false);
});
