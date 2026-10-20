import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Ursachen aus dem Fehlerdiagnose-Export vom 19.10.2026 (Produktion, 5000 Einträge).

const ORIGIN='https://wonderful-forest-0f315e310.7.azurestaticapps.net';
function loadFallback(fetchImpl){
  const calls=[];
  class FakeXHR{
    constructor(){calls.push(this);this.status=0;this.responseText=''}
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(){}
    getAllResponseHeaders(){return 'content-type: application/json\r\n'}
    send(){this.status=200;this.statusText='OK';this.responseText='{"ok":true}';queueMicrotask(()=>this.onload&&this.onload())}
    abort(){}
  }
  const window={location:{href:ORIGIN+'/',origin:ORIGIN},fetch:fetchImpl,XMLHttpRequest:FakeXHR};
  vm.runInNewContext(fs.readFileSync('assets/rc1289-auth-transport-fallback.js','utf8'),{window,URL,Promise,Error,TypeError,Date,Object,Array,String,Number,RegExp,queueMicrotask});
  return {window,calls};
}
const failingFetch=async()=>{throw new TypeError('Failed to fetch')};

test('Diagnose: lesende Same-Origin-Abrufe nutzen bei "Failed to fetch" den XHR-Ausweichweg',async()=>{
  for(const url of ['/api/pickup-status?token=abc','/assets/i18n/de.json','/production-version.js','/index.html']){
    const x=loadFallback(failingFetch);
    const res=await x.window.fetch(url,{method:'GET',cache:'no-store'});
    assert.equal(res.ok,true,url);
    assert.equal(JSON.stringify(await res.json()),'{"ok":true}');
    assert.equal(x.calls.length,1,url+' muss genau einmal per XHR wiederholt werden');
    assert.equal(x.calls[0].method,'GET');
  }
});

test('Diagnose: Schreibaufrufe und fremde Adressen werden weiterhin nicht dupliziert',async()=>{
  const post=loadFallback(failingFetch);
  await assert.rejects(()=>post.window.fetch('/api/exporthub-state?mode=save',{method:'POST',body:'{}'}),/Failed to fetch/);
  assert.equal(post.calls.length,0);
  const foreign=loadFallback(failingFetch);
  await assert.rejects(()=>foreign.window.fetch('https://example.com/data.json'),/Failed to fetch/);
  assert.equal(foreign.calls.length,0);
});

function block(html,start,end){const s=html.indexOf(start);assert.ok(s>=0,start+' fehlt');const e=html.indexOf(end,s+start.length);assert.ok(e>s,end+' fehlt');return html.slice(s,e)}

for(const file of ['index.html','TESTVERSION.html']){
  const html=fs.readFileSync(file,'utf8');

  test(`Diagnose (${file}): Abholstatus-Abgleich pausiert nach Netzwerkfehlern statt alle Sendungen sofort abzufragen`,()=>{
    const helpers=block(html,'function networkPaused(','function randomToken(');
    const ctx={Date,Math};vm.runInNewContext('var networkPauseUntil=0,networkFailures=0;'+helpers,ctx);
    assert.equal(ctx.networkPaused(),false);
    ctx.noteNetworkFailure();
    assert.equal(ctx.networkPaused(),true,'Nach einem Netzwerkfehler muss pausiert werden');
    const first=vm.runInNewContext('networkPauseUntil',ctx)-Date.now();
    ctx.noteNetworkFailure();ctx.noteNetworkFailure();
    const third=vm.runInNewContext('networkPauseUntil',ctx)-Date.now();
    assert.ok(first>=25000&&third>first,'Die Pause muss wachsen');
    for(let i=0;i<20;i++)ctx.noteNetworkFailure();
    assert.ok(vm.runInNewContext('networkPauseUntil',ctx)-Date.now()<=10*60*1000,'Höchstens 10 Minuten Pause');
    const sync=block(html,'function syncOne(sh,force)','async function syncAll(');
    assert.match(sync,/if\(!\(e&&e\.status\)\)\{noteNetworkFailure\(\);break\}/,'Netzwerkfehler ohne HTTP-Status beenden den Durchlauf');
    assert.match(sync,/networkFailures=0;networkPauseUntil=0;/,'Erfolg hebt die Pause auf');
    assert.match(block(html,'async function syncAll(force)','function qrMarkup('),/if\(networkPaused\(\)\)break;/);
  });

  test(`Diagnose (${file}): fehlende Bearbeitungsrechte lösen keine wiederholten Hintergrund-Speicherungen und Fehlerfenster aus`,()=>{
    const save=block(html,'function currentUserKey(','function isSessionError(');
    assert.match(save,/if\(options\.userInitiated!==true&&writeForbiddenForCurrentUser\(\)\)return skipForbiddenSave\(\);/);
    assert.match(save,/else if\(code==='WRITE_FORBIDDEN'\|\|code==='STATE_MODULE_WRITE_FORBIDDEN'\)\{runtime\.saveRetryCount=0;runtime\.writeForbiddenUser=currentUserKey\(\);skipForbiddenSave\(\);if\(options\.userInitiated===true\)alert\(/);
    assert.match(save,/runtime\.writeForbiddenUser='';if\(info\)info\.textContent=\(d\.concurrentMerge/,'Erfolgreiches Speichern hebt die Sperre auf');
    const helpers=block(html,'function currentUserKey(','async function flushSave(');
    const runtime={user:{id:'U-AMER'},pendingSave:true,dirty:true,saveTimer:null};
    const ctx={runtime,text:v=>String(v==null?'':v).trim(),by:()=>null,native:{clearTimeout(){}}};
    vm.runInNewContext(helpers,ctx);
    assert.equal(ctx.writeForbiddenForCurrentUser(),false);
    runtime.writeForbiddenUser=ctx.currentUserKey();
    assert.equal(ctx.writeForbiddenForCurrentUser(),true);
    assert.equal(ctx.skipForbiddenSave(),false);
    assert.equal(runtime.pendingSave,true,'Unsaved changes stay pending');assert.equal(runtime.dirty,true,'Unsaved edits cannot be marked clean');
    runtime.user={id:'U-ADMIN'};
    assert.equal(ctx.writeForbiddenForCurrentUser(),false,'Die Sperre gilt nur für den abgelehnten Benutzer');
  });
}

test('Diagnose: Kundenportal fragt bei unverändertem Kunden nicht bei jedem Render erneut ab',()=>{
  const src=fs.readFileSync('assets/rc1160-customer-portal-credentials.js','utf8');
  assert.match(src,/if\(force==='event'&&sameContext&&boxMounted\(\)\)return;/);
  assert.match(src,/w\.addEventListener\(name,function\(\)\{schedule\('event'\)\}\)/);
  assert.equal(src.split("Promise.all([portalApi('list'").length-1,1,'Portal-Abfragen laufen nur noch über den Cache');
  const helpers=src.slice(src.indexOf('var portalCache='),src.indexOf('function boxMounted('));
  let calls=0;
  const ctx={Date,Promise,portalApi:()=>{calls++;return Promise.resolve({})},customerId:c=>c.id};
  vm.runInNewContext(helpers,ctx);
  ctx.loadPortals({id:'K1'});ctx.loadPortals({id:'K1'});
  assert.equal(calls,2,'Zweiter Aufruf für denselben Kunden kommt aus dem Cache');
  ctx.loadPortals({id:'K2'});
  assert.equal(calls,4,'Anderer Kunde lädt neu');
});
