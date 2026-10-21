import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_MODES, PRODUCTION_BASE, safeSummary, probeMode, runProbe } from '../scripts/rc1601-state-startup-readonly-health.mjs';

const success = (data, status=200) => ({ status, text: async()=>JSON.stringify(data) });
const production = { ok:true, environment:'production', version:'RC1458', routeReachable:true };

test('RC1601: fixed production host, strictly read-only ping and health modes',async()=>{
  assert.equal(PRODUCTION_BASE,'https://wonderful-forest-0f315e310.7.azurestaticapps.net');
  assert.deepEqual(ALLOWED_MODES,['ping','health']);
  await assert.rejects(()=>probeMode('save'),/Only read-only/);
});

test('RC1601: no customer data, blob names, auth secrets or error messages leak into output',()=>{
  const body={
    ...production, storageReachable:true,teamStateReadable:true,teamReadMs:2514,
    stateDiagnostics:{inlinePayloadCount:6,sectionBytes:[{key:'customers',bytes:999}]},
    container:'customer-data',blob:'team-state.json',storageSource:'SECRET_CONNECTION_STRING',
    users:[{name:'Customer Name'}],shipments:[{reference:'PRIVATE_REFERENCE'}],
    error:'PRIVATE_STACK_TRACE',customer:'PRIVATE_CUSTOMER',token:'SECRET_TOKEN'
  };
  const output=JSON.stringify(safeSummary(body,'health'));
  assert.match(output,/inlinePayloadCount/);
  assert.match(output,/teamReadMs/);
  for(const secret of ['customer-data','team-state.json','SECRET_CONNECTION_STRING','Customer Name','PRIVATE_REFERENCE','PRIVATE_STACK_TRACE','PRIVATE_CUSTOMER','SECRET_TOKEN','sectionBytes']) {
    assert.ok(!output.includes(secret), 'Leaked '+secret);
  }
});

test('RC1601: GET only, no credentials and a single request per health mode',async()=>{
  const requests=[];
  const result=await probeMode('health',{
    fetchImpl:async(url,options)=>{
      requests.push({url,options});
      return success({...production,storageReachable:true,teamStateReadable:true,teamReadMs:451});
    },
    now:(()=>{let n=0;return()=>n+=20})()
  });
  assert.equal(requests.length,1);
  const req=requests[0];
  assert.equal(req.url,PRODUCTION_BASE+'/api/exporthub-state?mode=health');
  assert.equal(req.options.method,'GET');
  assert.equal(req.options.credentials,'omit');
  assert.equal(req.options.redirect,'error');
  assert.equal(req.options.body,undefined);
  assert.equal(result.ok,true);
  assert.equal(result.teamReadMs,451);
});

test('RC1601: ping 200 is not proof of Azure Storage health',async()=>{
  const ping=await probeMode('ping',{fetchImpl:async()=>success(production)});
  assert.equal(ping.ok,true);
  assert.equal(Object.hasOwn(ping,'storageReachable'),false);
  const health=await probeMode('health',{fetchImpl:async()=>success(production)});
  assert.equal(health.ok,false);
  assert.equal(health.errorCode,'UNHEALTHY_OR_WRONG_ENVIRONMENT');
});

test('RC1601: production health checks fail closed on non-production environment',async()=>{
  const res=await probeMode('health',{fetchImpl:async()=>success({...production,environment:'testservice',storageReachable:true,teamStateReadable:true})});
  assert.equal(res.ok,false);
});

test('RC1601: HTML, HTTP errors and huge responses never print their bodies',async()=>{
  const html=await probeMode('ping',{fetchImpl:async()=>({status:200,text:async()=>'<body>PII</body>'})});
  assert.equal(html.errorCode,'NON_JSON_RESPONSE');
  assert.ok(!JSON.stringify(html).includes('PII'));
  const denied=await probeMode('ping',{fetchImpl:async()=>success({secret:'PRIVATE'},401)});
  assert.equal(denied.errorCode,'HTTP_ERROR');
  const huge=await probeMode('ping',{fetchImpl:async()=>({status:200,text:async()=>('PRIVATE'.repeat(10000))})});
  assert.equal(huge.errorCode,'RESPONSE_TOO_LARGE');
  assert.ok(!JSON.stringify(huge).includes('PRIVATE'));
});

test('RC1601: network failures and request timeouts redact exception details',async()=>{
  const fail=await probeMode('ping',{fetchImpl:async()=>{throw new Error('PRIVATE_ACCESS_TOKEN')}});
  assert.equal(fail.errorCode,'NETWORK_OR_FETCH_ERROR');
  assert.ok(!JSON.stringify(fail).includes('PRIVATE'));
  const timeout=await probeMode('health',{
    schedule:(cb)=>{cb();return 1},
    cancel:()=>{},
    fetchImpl:async(url,options)=>{if(options.signal.aborted)throw new Error('PRIVATE_ERROR');return success(production)}
  });
  assert.equal(timeout.errorCode,'TIMEOUT');
});

test('RC1601: summary indicates failure when one of two required modes is unhealthy',async()=>{
  const lines=[];
  const exitCode=await runProbe({
    probe:async(mode)=>({mode,ok:mode==='ping'}),
    write:line=>lines.push(line)
  });
  assert.equal(exitCode,1);
  assert.equal(lines.length,2);
});
