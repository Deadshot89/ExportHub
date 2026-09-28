import {test,expect} from '@playwright/test';
import fs from 'node:fs';
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
  const marker=JSON.parse(fs.readFileSync('release-version.json','utf8'));
  const visible=String(marker&&marker.visibleRelease||'').trim().toUpperCase();
  if(!/^RC\d+$/.test(visible))throw new Error('release-version.json visibleRelease ist ungültig');
  return visible;
}

test('RC1311: Login-Theme-Initialisierung scannt die Login-Karte höchstens zweimal',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Login-Performance wird einmal im Laptop-Profil geprüft.');
  await page.addInitScript(()=>{
    const original=Document.prototype.querySelector;
    window.__RC1311_LOGIN_CARD_QUERIES__=0;
    Document.prototype.querySelector=function(selector){
      if(selector==='#login .login-card'){
        const stack=String(new Error().stack||'');
        if(stack.includes('rc1304-theme-switcher.js'))window.__RC1311_LOGIN_CARD_QUERIES__++;
      }
      return original.call(this,selector);
    };
  });
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(250);
  const count=await page.evaluate(()=>window.__RC1311_LOGIN_CARD_QUERIES__||0);
  expect(count).toBeLessThanOrEqual(2);
});

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

    await page.evaluate(()=>{
      const login=document.getElementById('login');
      if(login){login.hidden=true;login.classList.add('hidden')}
      document.title='ExportHUB Online RC9999';
    });
    await expect(page).toHaveTitle('ExportHUB360');
  }
  await expect(page.locator('html')).toHaveAttribute('data-exporthub-visible-version',expected);
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  if(process.env.EXPORTHUB_E2E_STATIC!=='1')await assertRuntimeClean(runtime,testInfo);
});
