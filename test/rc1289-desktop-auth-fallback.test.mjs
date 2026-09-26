import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const runtime=fs.readFileSync('assets/rc1289-auth-transport-fallback.js','utf8');

function makeXhr(result){
  const calls=[];
  class FakeXHR{
    constructor(){this.headers={};this.status=0;this.statusText='';this.responseText='';calls.push(this)}
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(k,v){this.headers[String(k).toLowerCase()]=String(v)}
    getAllResponseHeaders(){return 'content-type: application/json\r\ncache-control: no-store\r\n'}
    send(body){
      this.body=body;
      const r=typeof result==='function'?result(this):result;
      this.status=r?.status??200;
      this.statusText=r?.statusText??'OK';
      this.responseText=r?.body??'{"ok":true}';
      queueMicrotask(()=>this.onload&&this.onload());
    }
    abort(){queueMicrotask(()=>this.onabort&&this.onabort())}
  }
  return {FakeXHR,calls};
}
function load({fetchImpl,xhrResult}){
  const {FakeXHR,calls}=makeXhr(xhrResult);
  const window={
    location:{href:'https://wonderful-forest-0f315e310.7.azurestaticapps.net/',origin:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'},
    fetch:fetchImpl,
    XMLHttpRequest:FakeXHR,
    URL,
    Promise,
    Error,
    TypeError,
    Date,
    Object,
    Array,
    String,
    Number,
    RegExp
  };
  vm.runInNewContext(runtime,{window,URL,Promise,Error,TypeError,Date,Object,Array,String,Number,RegExp,queueMicrotask},{filename:'rc1289-auth-transport-fallback.js'});
  return {window,calls};
}

test('RC1289 P1: Failed-to-fetch beim Login fällt einmalig auf XHR desselben Auth-Endpunkts zurück',async()=>{
  let fetchCalls=0;
  const x=load({
    fetchImpl:async()=>{fetchCalls++;throw new TypeError('Failed to fetch')},
    xhrResult:{status:200,body:'{"ok":true,"user":{"name":"Desktop Test"}}'}
  });
  const res=await x.window.fetch('/api/exporthub-auth',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:'{"action":"login","username":"Desktop","password":"secret"}'
  });
  assert.equal(fetchCalls,1);
  assert.equal(x.calls.length,1);
  assert.equal(x.calls[0].method,'POST');
  assert.match(x.calls[0].url,/\/api\/exporthub-auth$/);
  assert.equal(x.calls[0].headers['content-type'],'application/json');
  assert.equal(res.ok,true);
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.ok,true);
  assert.equal(body.user&&body.user.name,'Desktop Test');
  assert.equal(x.window.__EXPORTHUB_RC1289_AUTH_TRANSPORT_FALLBACK__.fallbacks,1);
  assert.equal(x.window.__EXPORTHUB_RC1289_AUTH_TRANSPORT_FALLBACK__.lastEndpoint,'/api/exporthub-auth');
});

test('RC1289 P1: erfolgreicher nativer Fetch bleibt unverändert und verwendet kein XHR',async()=>{
  const expected={ok:true,status:200,json:async()=>({ok:true})};
  const x=load({fetchImpl:async()=>expected});
  const res=await x.window.fetch('/api/exporthub-auth',{method:'POST',body:'{}'});
  assert.equal(res,expected);
  assert.equal(x.calls.length,0);
  assert.equal(x.window.__EXPORTHUB_RC1289_AUTH_TRANSPORT_FALLBACK__.fallbacks,0);
});

test('RC1289 P1: andere API-Schreibpfade werden bei Fetch-Fehler nicht wiederholt',async()=>{
  const x=load({fetchImpl:async()=>{throw new TypeError('Failed to fetch')}});
  await assert.rejects(()=>x.window.fetch('/api/exporthub-state',{method:'POST',body:'{}'}),/Failed to fetch/);
  assert.equal(x.calls.length,0,'State-/Speicher-POST darf nicht per XHR dupliziert werden');
});

test('RC1289 P1: Abort wird nicht als Netzwerkfehler erneut gesendet',async()=>{
  const error=new Error('The operation was aborted.');error.name='AbortError';
  const x=load({fetchImpl:async()=>{throw error}});
  await assert.rejects(()=>x.window.fetch('/api/exporthub-auth',{method:'POST',body:'{}'}),e=>e===error);
  assert.equal(x.calls.length,0);
});

test('RC1289: Produktion und TESTSERVICE laden den Fallback synchron vor dem App-Boot und bauen das Asset aus',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    const tag='<script id="exporthub-rc1289-auth-transport-fallback" src="/assets/rc1289-auth-transport-fallback.js?v=1289"></script>';
    const at=html.indexOf(tag),headOpen=html.search(/<head\b[^>]*>/i),headEnd=html.toLowerCase().indexOf('</head>');
    assert.ok(at>headOpen&&at<headEnd,file+': RC1289 Fallback fehlt im Head');
    assert.doesNotMatch(tag,/\bdefer\b/,'Fallback muss vor dem nachfolgenden App-JavaScript laufen');
  }
  assert.ok(fs.existsSync('dist-rc1112/assets/rc1289-auth-transport-fallback.js'),'RC1289 Asset fehlt im Build');
  const demo=fs.readFileSync('dist-rc1112/demo.html','utf8');
  assert.doesNotMatch(demo,/rc1289-auth-transport-fallback/,'Demo darf keinen echten Auth-Fallback benötigen');
});
