import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('RC1499 selects full Chromium only for its PDF flow and closes it after success or failure',async()=>{
  const source=fs.readFileSync(new URL('../e2e/specs/public-smoke.spec.mjs',import.meta.url),'utf8');
  const from=source.indexOf("test('RC1499:");
  assert.doesNotMatch(source.slice(0,from),/channel:/);
  for(const browserName of ['chromium','firefox','webkit'])for(const fail of [false,true]){
    let callback,launches=0,closes=0,used;
    const original={},dedicated={close:async()=>{closes++;}};
    const register=(_name,fn)=>{callback=fn;};register.setTimeout=()=>{};register.skip=()=>{};
    const expectedError=new Error('flow failed');
    new Function('test','expect','packStationTokenFromFixture','runPackNotificationLiveFlow',source.slice(from))(
      register,()=>({toMatch:()=>{}}),()=> 'E2E-PACK-fixture',async browser=>{used=browser;if(fail)throw expectedError;});
    const result=callback({browser:original,browserName,headless:true,launchOptions:{timeout:123},
      playwright:{chromium:{launch:async options=>{launches++;assert.deepEqual(options,{timeout:123,headless:true,channel:'chromium'});return dedicated;}}}},
      {project:{name:'laptop'}});
    if(fail)await assert.rejects(result,error=>error===expectedError);else await result;
    assert.equal(used,browserName==='chromium'?dedicated:original);
    assert.equal(launches,browserName==='chromium'?1:0);
    assert.equal(closes,browserName==='chromium'?1:0);
  }
});

test('RC1499 original preview, byte, authentication and download gates remain intact',()=>{
  const helper=fs.readFileSync(new URL('../e2e/helpers/pack-notification-live.mjs',import.meta.url),'utf8');
  assert.match(helper,/await expect\.poll\(\(\)=>packPreview\.url\(\),\{timeout:25_000\}\)\.toMatch\(\/\^\(blob:\|https\?:/);
  assert.match(helper,/\(await ticketResponse\.body\(\)\)\.subarray\(0,5\)\.toString\('latin1'\)\)\.toBe\('%PDF-'\)/);
  assert.match(helper,/viewer\.fetchBytes\(file\)/);
  assert.match(helper,/expect\(originalPdf\.signature\)\.toBe\('%PDF-'\)/);
  assert.match(helper,/expect\(packDownloadBytes\.subarray\(0,5\)\.toString\('latin1'\)\)\.toBe\('%PDF-'\)/);
});
