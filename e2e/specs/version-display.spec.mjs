import {test,expect} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {
  appEntry,
  attachRuntimeGuards,
  assertRuntimeClean,
  assertNoSourceLeak,
  assertNoHorizontalOverflow
} from '../helpers/exporthub-browser.mjs';

function expectedVisibleRelease(){
  const explicit=String(process.env.EXPORTHUB_EXPECTED_VISIBLE_RELEASE||process.env.EXPORTHUB_VISIBLE_RELEASE_VERSION||'').trim().toUpperCase();
  if(/^RC\d+$/.test(explicit))return explicit;
  try{
    const subjects=execFileSync('git',['log','-20','--pretty=%s'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
    const matches=Array.from(String(subjects||'').matchAll(/\bRC(\d+)\b/gi)).map(m=>Number(m[1])).filter(Number.isFinite);
    if(matches.length)return 'RC'+Math.max(...matches);
  }catch(_){}
  return 'RC1112';
}

test('RC1298: Login ist kompakt, eindeutig und produktiv als ExportHUB360 gebrandet',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Versionsanzeige wird einmal im Laptop-Profil geprüft.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  const body=page.locator('body');
  const expected=expectedVisibleRelease();
  await expect(body).toContainText(new RegExp('Aktuelle Version\\s+'+expected,'i'),{timeout:15_000});
  const base=String(process.env.EXPORTHUB_E2E_BASE_URL||'');
  const entry=String(appEntry()||'');
  const isLiveTestservice=process.env.EXPORTHUB_E2E_LIVE==='1'&&/-testservice\./i.test(base);
  const isTestserviceUi=isLiveTestservice||/TESTVERSION\.html/i.test(entry);
  if(isLiveTestservice){
    await expect(body).toContainText(new RegExp('TESTSERVICE\\s*·\\s*'+expected+'\\s*·\\s*NICHT PRODUKTION','i'),{timeout:15_000});
  }
  if(!isTestserviceUi){
    await expect(page).toHaveTitle('ExportHUB360');
    const versionBadge=page.locator('#login .clean-version-badge');
    const modeHead=page.locator('#login .eh-login-mode-head');
    const environmentNote=page.locator('#login .eh-login-environment-note');
    await expect(versionBadge).toHaveCount(1);
    await expect(modeHead).toHaveCount(1);
    await expect(environmentNote).toHaveCount(1);
    await expect(versionBadge).toBeHidden();
    await expect(modeHead).toBeHidden();
    await expect(environmentNote).toBeHidden();

    const environmentButtons=page.locator('#login .eh-login-environment button');
    const activeEnvironment=page.locator('#login .eh-login-environment button.is-active, #login .eh-login-environment button.active, #login .eh-login-environment button[aria-pressed="true"]');
    await expect(environmentButtons).toHaveCount(2);
    await expect(activeEnvironment).toHaveCount(1);
    const environmentStyles=await environmentButtons.evaluateAll(buttons=>buttons.map(button=>({
      active:button.classList.contains('is-active')||button.classList.contains('active')||button.getAttribute('aria-pressed')==='true',
      boxShadow:getComputedStyle(button).boxShadow,
      backgroundImage:getComputedStyle(button).backgroundImage
    })));
    const selected=environmentStyles.find(x=>x.active),idle=environmentStyles.find(x=>!x.active);
    expect(selected&&selected.boxShadow).not.toBe('none');
    expect(selected&&selected.backgroundImage).toContain('linear-gradient');
    expect(idle&&idle.boxShadow).toBe('none');

    await expect(page.locator('#loginRemember')).toBeVisible();
    await expect(page.locator('#loginUser')).toHaveAttribute('autocomplete','username');
    await expect(page.locator('#loginPass')).toHaveAttribute('autocomplete','current-password');
    await expect(page.locator('#loginFields')).toHaveAttribute('autocomplete','on');
  }
  await expect(page.locator('html')).toHaveAttribute('data-exporthub-visible-version',expected);
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  if(process.env.EXPORTHUB_E2E_STATIC!=='1')await assertRuntimeClean(runtime,testInfo);
});
