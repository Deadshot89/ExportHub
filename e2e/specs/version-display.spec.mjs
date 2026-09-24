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
    const match=String(subjects||'').match(/\bRC(\d+)\b/i);
    if(match)return 'RC'+match[1];
  }catch(_){}
  return 'RC1112';
}

test('RC1265: Login zeigt automatisch den aktuellen sichtbaren Release',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Versionsanzeige wird einmal im Laptop-Profil geprüft.');
  const runtime=attachRuntimeGuards(page,testInfo);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  const body=page.locator('body');
  const expected=expectedVisibleRelease();
  await expect(body).toContainText(new RegExp('Aktuelle Version\\s+'+expected,'i'),{timeout:15_000});
  const base=String(process.env.EXPORTHUB_E2E_BASE_URL||'');
  const isLiveTestservice=process.env.EXPORTHUB_E2E_LIVE==='1'&&/-testservice\./i.test(base);
  if(isLiveTestservice){
    await expect(body).toContainText(new RegExp('TESTSERVICE\\s*·\\s*'+expected+'\\s*·\\s*NICHT PRODUKTION','i'),{timeout:15_000});
  }
  await expect(page.locator('html')).toHaveAttribute('data-exporthub-visible-version',expected);
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  if(process.env.EXPORTHUB_E2E_STATIC!=='1')await assertRuntimeClean(runtime,testInfo);
});
