import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');

test('RC1296: Login blendet redundante Infobloecke aus und bleibt funktional',()=>{
  assert.match(runtime,/function installCompactLoginStyles\(\)/);
  assert.match(runtime,/rc1296-login-cleanup-style/);
  assert.match(runtime,/#login \.eh-login-mode-head,#login \.eh-login-environment-note\{display:none!important\}/);
  assert.match(runtime,/#login \.eh-login-environment button span\{display:block!important/);
  assert.match(runtime,/#login \.eh-login-environment button\.is-active,#login \.eh-login-environment button\.active/);
  assert.match(runtime,/0 0 26px rgba\(14,165,233,.48\)/);
  assert.match(runtime,/#login \.rc119-login-remember small\{display:none!important\}/);
  assert.match(runtime,/#login \.login-card\{width:min\(540px,100%\)!important/);
  assert.match(runtime,/#login #loginBtn\{min-height:46px!important/);
  assert.match(runtime,/#login #loginMicrosoftAccountSwitchBtn,#login #adminRecoveryBtn\{/);
});

test('RC1296: Login merkt Benutzername und Passwort ueber sichere Browser-Credentials',()=>{
  assert.match(runtime,/function configureLoginRemember\(\)/);
  assert.match(runtime,/Benutzername & Passwort speichern/);
  assert.match(runtime,/Beim nächsten Besuch automatisch einsetzen\./);
  assert.match(runtime,/setAttribute\('autocomplete','username'\)/);
  assert.match(runtime,/setAttribute\('autocomplete','current-password'\)/);
  assert.match(runtime,/setAttribute\('autocomplete','on'\)/);
});

test('RC1296: Kernfunktionen des Logins werden nicht entfernt',()=>{
  for(const id of ['loginUser','loginPass','loginRemember','loginBtn','loginMicrosoftAccountSwitchBtn','adminRecoveryBtn']){
    assert.doesNotMatch(runtime,new RegExp('#login #'+id+'\\{[^}]*display:none','i'));
  }
  assert.match(runtime,/function install\(\)\{installCompactLoginStyles\(\);configureLoginRemember\(\);cleanLoginStatus\(\);rc1109Schedule\(\);/);
});
