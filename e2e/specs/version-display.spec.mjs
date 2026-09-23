import {test,expect} from '@playwright/test';
import {
  appEntry,
  attachRuntimeGuards,
  assertRuntimeClean,
  assertNoSourceLeak,
  assertNoHorizontalOverflow
} from '../helpers/exporthub-browser.mjs';

test('RC1231: Login zeigt den aktuellen sichtbaren Release statt RC1112',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Versionsanzeige wird einmal im Laptop-Profil geprüft.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  const body=page.locator('body');
  await expect(body).toContainText(/Aktuelle Version\s+RC1231/i,{timeout:15_000});
  await expect(body).not.toContainText(/Aktuelle Version\s+RC1112/i);
  const base=String(process.env.EXPORTHUB_E2E_BASE_URL||'');
  const isLiveTestservice=process.env.EXPORTHUB_E2E_LIVE==='1'&&/-testservice\./i.test(base);
  if(isLiveTestservice){
    await expect(body).toContainText(/TESTSERVICE\s*·\s*RC1231\s*·\s*NICHT PRODUKTION/i,{timeout:15_000});
    await expect(body).not.toContainText(/TESTSERVICE\s*·\s*RC1112\s*·\s*NICHT PRODUKTION/i);
  }
  await expect(page.locator('html')).toHaveAttribute('data-exporthub-visible-version','RC1231');
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  if(process.env.EXPORTHUB_E2E_STATIC!=='1')await assertRuntimeClean(runtime,testInfo);
});
