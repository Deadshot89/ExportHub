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
function compact(v){return String(v||'').replace(/\s+/g,' ').trim()}

test('RC1098 Audit: Microsoft-Kontowechsel besitzt vollständigen aktiven Ablauf',()=>{
  assert.match(html,/Microsoft-Konto wechseln/);
  assert.match(html,/data-exporthub-ms-switch/);
  for(const name of [
    'resetClientSessionForMicrosoftSwitch',
    'microsoftProviderLogoutUrl',
    'microsoftAccountLoginUrl',
    'settleAzureBeforeMicrosoftSwitch',
    'endExportHubSessionForMicrosoftSwitch',
    'switchMicrosoftAccount',
    'handleMicrosoftSwitchStage'
  ]){
    const body=fn(name);
    assert.ok(body,name+' fehlt');
    console.log('RC1098_FN_'+name.toUpperCase()+'='+compact(body));
  }
});
