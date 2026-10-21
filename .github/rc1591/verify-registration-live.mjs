// RC1591: verify that the RC1590 registration safety logic is actually served by
// the just-deployed TESTSERVICE/production environment. This test is read-only.
import assert from 'node:assert/strict';

const endpoints=Object.freeze({
  testservice:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',
  production:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'
});
const environment=String(process.argv[2]||'').trim().toLowerCase();
assert.ok(Object.hasOwn(endpoints,environment),'RC1591: expected testservice or production');
const expected=String(process.env.RELEASE_SHA||process.env.GITHUB_SHA||'').trim();
assert.match(expected,/^[0-9a-f]{40}$/i,'RC1591: exact expected deployment commit SHA required');
const base=endpoints[environment];

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function probe(path,check,label){
  let reason='no response';
  for(let attempt=1;attempt<=12;attempt++){
    const separator=path.includes('?')?'&':'?';
    const url=base+path+separator+'rc1591='+expected+'-'+attempt;
    try{
      const response=await fetch(url,{redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(response.status!==200)throw new Error('HTTP '+response.status)
      const text=await response.text();
      check(text);
      console.log('RC1591 '+environment+' '+label+' verified');
      return;
    }catch(error){reason=String(error&&error.message||error)}
    if(attempt<12)await sleep(5000);
  }
  throw new Error('RC1591 '+environment+' '+label+' not verified: '+reason);
}

await probe('/api/exporthub-health',body=>{
  const result=JSON.parse(body);
  assert.equal(result.deployment?.verified,true,'deployment identity must be verified');
  assert.equal(result.deployment?.environment,environment,'incorrect environment');
  assert.equal(result.deployment?.buildId,expected,'stale deployment build');
},'deployment SHA');

await probe('/assets/taskplanner-v2-workflow.js',body=>{
  for(const required of ["'registration-confirmed'","emailHistoryId","shipmentRegisteredFromSave","shipment.registered","detail.azureSaved!==true"])
    assert.ok(body.includes(required),'task workflow missing '+required);
  assert.ok(body.includes("q(row.type).toLowerCase()!=='registration-confirmed'"),'Outlook-open false completion guard absent');
},'registration workflow');

await probe('/assets/rc1071-shipment-history.js',body=>{
  for(const required of ['data-rc1590-confirm-registration','confirmRegistrationMail','registrationConfirmedForMail',
    'REGISTRATION_CONFIRM_PENDING','maxAgeMs=2*60*60*1000','SAVE_NOT_CONFIRMED',
    "type:'registration-confirmed'",'exporthub:tasks-updated'])
    assert.ok(body.includes(required),'history runtime missing '+required);
},'send confirmation history');

for(const language of ['de','en','pl','es','fr','it']){
  await probe('/assets/i18n/'+language+'.json',body=>{
    const locale=JSON.parse(body);
    for(const key of ['shipmentHistory.action.registrationConfirmed','shipmentHistory.registration.help',
      'shipmentHistory.registration.confirmButton','shipmentHistory.registration.failed',
      'shipmentHistory.registration.success','shipmentHistory.registration.storageUnavailable'])
      assert.ok(typeof locale[key]==='string'&&locale[key].trim(),language+': missing '+key);
  },language+' translation');
}

console.log('RC1591 '+environment+' all read-only registration release gates passed for '+expected);
