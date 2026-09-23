import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

let built=false;
function build(){
  if(built)return;
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  built=true;
}
function read(file){build();return fs.readFileSync('dist-rc1112/'+file,'utf8')}

test('RC1247: Sessionprüfung verwendet einen einzelnen 120s Request statt 30s Retry-Kaskade',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read(file);
    const patched="const d=await authCall('session',{},runtime.authToken,{timeoutMs:120000,maxAttempts:1});";
    assert.equal(html.split(patched).length-1,1,file+': RC1247 Session-Request fehlt oder ist doppelt');
    assert.equal(html.split("const d=await authCall('session',{});").length-1,0,file+': alter 30s-Defaultpfad ist noch aktiv');
  }
});

test('RC1247: Login-Request bleibt unverändert bei 120s und genau einem Versuch',()=>{
  const html=read('TESTVERSION.html');
  assert.match(html,/testserviceLoginOnce[\s\S]*?timeoutMs:120000,maxAttempts:1/);
  assert.match(html,/async function verifyCurrentSession\(\)[\s\S]*?timeoutMs:120000,maxAttempts:1/);
});

test('RC1247: finaler Builder bleibt syntaktisch gültig',()=>{
  execFileSync(process.execPath,['--check','.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
});
