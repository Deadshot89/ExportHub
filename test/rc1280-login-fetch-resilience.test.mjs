import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

let built=false;
function build(){
  if(built)return;
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  built=true;
}
function readBuilt(file){
  build();
  return fs.readFileSync('dist-rc1112/'+file,'utf8');
}
function resilientSource(file='index.html'){
  const html=readBuilt(file);
  const start=html.indexOf('function apiEndpointLabel(url){');
  const end=html.indexOf('\nasync function jsonFetch(url,options){',start);
  assert.ok(start>=0,file+': apiEndpointLabel/resilientFetch fehlt');
  assert.ok(end>start,file+': Ende von resilientFetch fehlt');
  const source=html.slice(start,end);
  assert.match(source,/async function resilientFetch\(url,options\)/,file+': resilientFetch fehlt im Testausschnitt');
  return source;
}
function harness(fetchImpl){
  const source=resilientSource();
  const native={
    fetch:fetchImpl,
    setTimeout(fn,ms){return setTimeout(fn,Math.min(Number(ms)||0,2))},
    clearTimeout(id){clearTimeout(id)}
  };
  const context={
    location:{protocol:'https:',href:'https://wonderful-forest-0f315e310.7.azurestaticapps.net/index.html'},
    native,
    URL,
    Error,
    Promise,
    Object,
    Math,
    Number,
    String,
    AbortController:undefined,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(source+'\n;globalThis.__resilientFetch=resilientFetch;',context,{filename:'rc1280-resilient-fetch.vm.js'});
  return context.__resilientFetch;
}

test('RC1280 P1: transienter Browser-Fehler Failed to fetch wird automatisch erneut versucht',async()=>{
  let calls=0;
  const expected={ok:true,status:200};
  const resilientFetch=harness(async()=>{
    calls+=1;
    if(calls<3)throw new TypeError('Failed to fetch');
    return expected;
  });
  const result=await resilientFetch('/api/exporthub-auth',{
    method:'POST',
    body:'{"action":"login"}',
    maxAttempts:4,
    timeoutMs:3000
  });
  assert.equal(result,expected);
  assert.equal(calls,3,'Login-Fetch muss nach transientem Netzwerkfehler erneut versucht werden');
});

test('RC1280 P1: dauerhafter Failed-to-fetch endet kontrolliert als API_UNREACHABLE',async()=>{
  let calls=0;
  const resilientFetch=harness(async()=>{
    calls+=1;
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(
    ()=>resilientFetch('/api/exporthub-auth',{
      method:'POST',
      body:'{"action":"login"}',
      maxAttempts:4,
      timeoutMs:3000
    }),
    error=>{
      assert.equal(error&&error.code,'API_UNREACHABLE');
      assert.match(String(error&&error.message||''),/Azure-API nicht erreichbar.*\/api\/exporthub-auth/i);
      assert.doesNotMatch(String(error&&error.message||''),/Failed to fetch/i);
      return true;
    }
  );
  assert.equal(calls,4,'Dauerhafter Netzwerkfehler muss exakt bis zum Versuchslimit wiederholt werden');
});

test('RC1280 P1: Produktion und TESTSERVICE verwenden resilientFetch fuer Auth',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const html=readBuilt(file);
    assert.match(html,/async function authCall\(action,payload,token,requestOptions\)[\s\S]*?return jsonFetch\(AUTH_API,opts\);/,file+': authCall nutzt jsonFetch nicht');
    assert.match(html,/async function jsonFetch\(url,options\)[\s\S]*?const res=await resilientFetch\(url,opts\);/,file+': jsonFetch nutzt resilientFetch nicht');
    assert.match(html,/async function login\(manual\)[\s\S]*?authCall\('login',\{username:name,password:pass,deviceId:runtime\.deviceId/,file+': Produktionslogin nutzt Auth-Pfad nicht');
  }
});

test('RC1280 P1: Loginseite und API werden nicht aus Browsercache bedient',()=>{
  const cfg=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
  const route=path=>cfg.routes.find(item=>item.route===path);
  for(const path of ['/','/index.html']){
    assert.match(String(route(path)?.headers?.['Cache-Control']||''),/no-store/i,path+': no-store fehlt');
    assert.match(String(route(path)?.headers?.['Cache-Control']||''),/no-cache/i,path+': no-cache fehlt');
  }
  assert.match(String(route('/api/*')?.headers?.['Cache-Control']||''),/no-store/i,'/api/*: no-store fehlt');
  for(const file of ['index.html','TESTVERSION.html']){
    const html=readBuilt(file);
    assert.doesNotMatch(html,/serviceWorker\s*\.\s*register\s*\(/i,file+': unerwartete Service-Worker-Registrierung');
  }
});
