import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Test the actual RC1703 code embedded into the release builder, not a copy
// of the intended logic. Packmeldungen may contain either Blob pointers or
// migrated API URLs; the latter used to retain Azure's Microsoft-login cookie.
const source=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const begin="var options={credentials:'same-origin',cache:'no-store',redirect:'manual'},documentApi=false;";
const finish='var response=await fetch(url,options);';
const start=source.indexOf(begin),end=start<0?-1:source.indexOf(finish,start);
assert.ok(start>=0 && end>start,'RC1703 migrated PDF fetch is present');
const snippet=source.slice(start,end+finish.length);

async function run(url,helper){
  const calls=[];
  const origin='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
  await vm.runInNewContext('(async()=>{'+snippet+'})()',{
    url,URL,helper,q:v=>String(v==null?'':v).trim(),
    window:{location:{href:origin+'/TESTVERSION.html',origin}},
    fetch:async(u,options)=>{calls.push({url:u,options});return{ok:true,status:200};}
  });
  assert.equal(calls.length,1);
  return calls[0].options;
}

test('P0: migrated TESTSERVICE pack PDF URL uses existing ExportHUB token without Microsoft cookie',async()=>{
  const options=await run('/api/exporthub-document?blob=rc1059%2Ftestservice%2Faa%2Ftest', {
    headers(){return{'X-ExportHUB-Token':'E2E-SESSION',Authorization:'Bearer E2E-SESSION'};}
  });
  assert.equal(options.credentials,'omit');
  assert.equal(options.redirect,'manual');
  assert.equal(options.headers.Authorization,'Bearer E2E-SESSION');
});

test('P0: only protected document URL omits credentials; unrelated requests retain existing policy',async()=>{
  const helper={headers(){throw new Error('must not access document session for unrelated URLs')}};
  for(const url of ['/api/pack-notification?action=draft-list','https://other.example/sample.pdf']){
    const options=await run(url,helper);
    assert.equal(options.credentials,'same-origin');
    assert.equal(options.headers,undefined);
  }
});

test('P0: document URL without ExportHUB session fails closed',async()=>{
  await assert.rejects(run('/api/exporthub-document?blob=missing',null),/ExportHUB-Sitzung/);
});
