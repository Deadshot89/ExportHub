import test from 'node:test';
import assert from 'node:assert/strict';
import testserviceReadiness from '../e2e/helpers/testservice-readiness.mjs';

function fakeResponse(status,payload){
  return {
    status,
    ok:status>=200&&status<300,
    async json(){return payload;}
  };
}

test('RC1541 P0: TESTSERVICE readiness prüft nach Health auch den echten Session-/Team-State-Read',async()=>{
  const previous={
    live:process.env.EXPORTHUB_E2E_LIVE,
    publicEnv:process.env.EXPORTHUB_E2E_PUBLIC_ENV,
    baseUrl:process.env.EXPORTHUB_E2E_BASE_URL,
    token:process.env.EXPORTHUB_E2E_SESSION_TOKEN,
    fetch:globalThis.fetch
  };
  const calls=[];
  try{
    process.env.EXPORTHUB_E2E_LIVE='1';
    process.env.EXPORTHUB_E2E_PUBLIC_ENV='testservice';
    process.env.EXPORTHUB_E2E_BASE_URL='https://exporthub-testservice.example.invalid/';
    process.env.EXPORTHUB_E2E_SESSION_TOKEN='rc1541-e2e-session';

    globalThis.fetch=async(input,init={})=>{
      const url=String(input);
      calls.push({url,headers:init.headers||{}});
      if(/mode=health/.test(url))return fakeResponse(200,{ok:true,environment:'testservice'});
      if(/mode=read/.test(url))return fakeResponse(200,{ok:true,environment:'testservice',revision:1,state:{},users:[]});
      return fakeResponse(404,{ok:false});
    };

    await testserviceReadiness();

    const stateRead=calls.find(call=>/\/api\/exporthub-state\?[^#]*mode=read/.test(call.url)&&/[?&]full=1(?:&|$)/.test(call.url));
    assert.ok(stateRead,'Readiness darf nach grünem Health nicht fertig sein, bevor mode=read&full=1 erfolgreich geprüft wurde.');
    const headers=Object.fromEntries(Object.entries(stateRead.headers).map(([key,value])=>[key.toLowerCase(),String(value)]));
    assert.equal(headers['x-exporthub-environment'],'testservice');
    assert.equal(headers['x-exporthub-token'],'rc1541-e2e-session');
    assert.equal(headers['x-exporthub-session'],'rc1541-e2e-session');
    assert.equal(headers.authorization,'Bearer rc1541-e2e-session');
  }finally{
    if(previous.live===undefined)delete process.env.EXPORTHUB_E2E_LIVE;else process.env.EXPORTHUB_E2E_LIVE=previous.live;
    if(previous.publicEnv===undefined)delete process.env.EXPORTHUB_E2E_PUBLIC_ENV;else process.env.EXPORTHUB_E2E_PUBLIC_ENV=previous.publicEnv;
    if(previous.baseUrl===undefined)delete process.env.EXPORTHUB_E2E_BASE_URL;else process.env.EXPORTHUB_E2E_BASE_URL=previous.baseUrl;
    if(previous.token===undefined)delete process.env.EXPORTHUB_E2E_SESSION_TOKEN;else process.env.EXPORTHUB_E2E_SESSION_TOKEN=previous.token;
    globalThis.fetch=previous.fetch;
  }
});
