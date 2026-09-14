import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');

function fn(name){
  const re=new RegExp('function\\s+'+name+'\\s*\\([^)]*\\)\\s*\\{');
  const m=re.exec(html);if(!m)return'';
  let i=m.index+m[0].length-1,depth=0,quote='',esc=false;
  for(;i<html.length;i++){
    const ch=html[i];
    if(quote){if(esc)esc=false;else if(ch==='\\\\')esc=true;else if(ch===quote)quote='';continue}
    if(ch==='"'||ch==="'"||ch==='\`'){quote=ch;continue}
    if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return html.slice(m.index,i+1);
  }
  return'';
}

test('RC1098: Einstellungen bieten Microsoft-Konto wechseln an',()=>{
  assert.match(html,/data-exporthub-ms-switch="1"/);
  assert.match(html,/Microsoft-Konto wechseln/);
});

test('RC1098: vor Kontowechsel werden ungespeicherte Azure-Änderungen gesichert',()=>{
  const src=fn('settleAzureBeforeMicrosoftSwitch');
  assert.ok(src);
  assert.match(src,/flushSave\('Vor Microsoft-Kontowechsel'/);
  assert.match(src,/AZURE_SAVE_REQUIRED/);
  assert.match(src,/AZURE_SAVE_TIMEOUT/);
});

test('RC1098: Kontowechsel beendet die ExportHUB-Sitzung und lokalen Sitzungszustand',()=>{
  const end=fn('endExportHubSessionForMicrosoftSwitch');
  const reset=fn('resetClientSessionForMicrosoftSwitch');
  assert.match(end,/action:'logout'/);
  assert.match(end,/resetClientSessionForMicrosoftSwitch\(\)/);
  assert.match(reset,/runtime\.authToken=''/);
  assert.match(reset,/runtime\.user=null/);
  assert.match(reset,/runtime\.state=null/);
  assert.match(reset,/clearTabSession\(\)/);
});

test('RC1098: Microsoft-Provider wird mit logout_hint abgemeldet',()=>{
  const src=fn('microsoftProviderLogoutUrl');
  assert.match(src,/login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/logout/);
  assert.match(src,/post_logout_redirect_uri/);
  assert.match(src,/logout_hint/);
});

test('RC1098: neuer Microsoft-Login erzwingt Kontoauswahl',()=>{
  const src=fn('microsoftAccountLoginUrl');
  assert.match(src,/prompt:'select_account'/);
  assert.match(src,/max_age:'0'/);
  assert.match(src,/post_login_redirect_uri/);
});

test('RC1098: kompletter Kontowechsel läuft über Provider-Logout und neue Kontoauswahl',()=>{
  const start=fn('switchMicrosoftAccount');
  const stage=fn('handleMicrosoftSwitchStage');
  assert.match(start,/settleAzureBeforeMicrosoftSwitch\(\)/);
  assert.match(start,/endExportHubSessionForMicrosoftSwitch\(\)/);
  assert.match(stage,/stage==='provider'/);
  assert.match(stage,/microsoftProviderLogoutUrl/);
  assert.match(stage,/stage==='login'/);
  assert.match(stage,/microsoftAccountLoginUrl/);
});
