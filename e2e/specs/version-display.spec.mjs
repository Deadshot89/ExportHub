import {test,expect} from '@playwright/test';
import {
  appEntry,
  attachRuntimeGuards,
  assertRuntimeClean,
  assertNoSourceLeak,
  assertNoHorizontalOverflow
} from '../helpers/exporthub-browser.mjs';

test('RC1193: Login zeigt den aktuellen sichtbaren Release statt RC1112',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Versionsanzeige wird einmal im Laptop-Profil geprüft.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  const body=page.locator('body');
  await expect(body).toContainText(/Aktuelle Version\s+RC1193/i,{timeout:15_000});
  await expect(body).not.toContainText(/Aktuelle Version\s+RC1112/i);
  const entry=String(process.env.EXPORTHUB_E2E_ENTRY||'');
  const base=String(process.env.EXPORTHUB_E2E_BASE_URL||'');
  const isTestservice=/TESTVERSION/i.test(entry)||/-testservice\./i.test(base);
  if(isTestservice){
    await expect(body).toContainText(/TESTSERVICE\s*·\s*RC1193\s*·\s*NICHT PRODUKTION/i,{timeout:15_000});
    await expect(body).not.toContainText(/TESTSERVICE\s*·\s*RC1112\s*·\s*NICHT PRODUKTION/i);
  }
  await expect(page.locator('html')).toHaveAttribute('data-exporthub-visible-version','RC1193');
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
