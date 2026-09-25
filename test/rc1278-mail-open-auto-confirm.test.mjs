import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy=fs.readFileSync('assets/rc1049-abd-avis-policy.js','utf8');

test('RC1278: Versandmail wird beim Outlook-Öffnen automatisch bestätigt',()=>{
  assert.match(policy,/__EXPORTHUB_RC1278_MAIL_OPEN_AUTOCONFIRM__/);
  assert.match(policy,/isMainMailOpen\(b\)[\s\S]*?openFn[\s\S]*?confirmFn/);
  assert.match(policy,/historyCount\(sh\)<=before\)confirmFn\(\)/);
  assert.match(policy,/window\.addEventListener\('click',intercept,true\)/);
});

test('RC1278: ABD-Mail bestätigt den Versand direkt in beiden ABD-Pfaden',()=>{
  assert.match(policy,/isRc543AbdOpen\(b\)[\s\S]*?rc543ConfirmAbdMail/);
  assert.match(policy,/isRc626AbdOpen\(b\)[\s\S]*?ExportHUBRC626[\s\S]*?confirmRc626Abd/);
  assert.match(policy,/rc542AbdMarkSent/);
  assert.match(policy,/a\.mailConfirmed=true/);
  assert.match(policy,/a\.mailStatus='Versendet'/);
});

test('RC1278: zusätzliche Bestätigungsbuttons werden ausgeblendet',()=>{
  assert.match(policy,/rc543ConfirmMailButton/);
  assert.match(policy,/rc543ConfirmAbdMail/);
  assert.match(policy,/Mail als versendet bestätigen\|ABD-Anfrage als versendet bestätigen/);
  assert.match(policy,/style\.setProperty\('display','none','important'\)/);
});

for(const file of ['index.html','TESTVERSION.html']){
  test(`RC1278: ${file} lädt die zentrale ABD-/Mail-Policy`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/assets\/rc1049-abd-avis-policy\.js/);
  });
}
