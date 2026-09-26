import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');

test('RC1296: Login blendet redundante Infobloecke aus und bleibt funktional',()=>{
  assert.match(runtime,/function installCompactLoginStyles\(\)/);
  assert.match(runtime,/rc1296-login-cleanup-style/);
  assert.match(runtime,/#login \.eh-login-mode-head,#login \.eh-login-environment-note\{display:none!important\}/);
  assert.match(runtime,/#login \.eh-login-environment button span\{display:none!important\}/);
  assert.match(runtime,/#login \.rc119-login-remember small\{display:none!important\}/);
  assert.match(runtime,/#login \.login-card\{width:min\(520px,100%\)!important/);
  assert.match(runtime,/#login #loginBtn\{min-height:46px!important/);
  assert.match(runtime,/#login #loginMicrosoftAccountSwitchBtn,#login #adminRecoveryBtn\{/);
});

test('RC1296: Kernfunktionen des Logins werden nicht entfernt',()=>{
  for(const id of ['loginUser','loginPass','loginRemember','loginBtn','loginMicrosoftAccountSwitchBtn','adminRecoveryBtn']){
    assert.doesNotMatch(runtime,new RegExp('#login #'+id+'\\{[^}]*display:none','i'));
  }
  assert.match(runtime,/function install\(\)\{installCompactLoginStyles\(\);cleanLoginStatus\(\);rc1109Schedule\(\);/);
});
