import {test,expect} from '@playwright/test';
import {appEntry,assertNoHorizontalOverflow} from '../helpers/exporthub-browser.mjs';

test('RC2035: unified logistics login uses equal card heights and shipped backdrop',async({page},info)=>{
  test.skip(!['laptop','mobile-small'].includes(info.project.name));
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  const login=page.locator('#login[data-eh360-ui="v2"]');
  await expect(login).toBeVisible();
  const css=await login.evaluate(el=>({
    image:getComputedStyle(el).backgroundImage,
    cols:getComputedStyle(el).gridTemplateColumns,
    theme:document.documentElement.getAttribute('data-eh-design')
  }));
  expect(css.image).toContain('rc2035-login-ambient.svg');
  await expect(login.locator('#loginUser')).toBeVisible();
  await expect(login.locator('#loginPass')).toBeVisible();
  await expect(login.locator('#loginLanguageSelect')).toBeVisible();
  const hero=login.locator('.eh360-login-hero');
  const card=login.locator('.login-card');
  if(info.project.name==='laptop'){
    await expect(hero).toBeVisible();
    const a=await hero.boundingBox(),b=await card.boundingBox();
    expect(a&&b).toBeTruthy();
    expect(Math.abs(a.height-b.height)).toBeLessThanOrEqual(3);
    expect(Math.abs(a.y-b.y)).toBeLessThanOrEqual(3);
    await expect(hero.locator('img')).toHaveAttribute('src',/rc1630-login-route\.svg/);
    expect(a.height).toBeGreaterThan(600);
  }else{
    await expect(hero).toBeHidden();
  }
  await assertNoHorizontalOverflow(page);
});

test('RC2035: environment switch remains functional and reflects its selected theme',async({page},info)=>{
  test.skip(info.project.name!=='laptop');
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  const login=page.locator('#login[data-eh360-ui="v2"]');
  const tabs=login.locator('.eh-login-environment button');
  await expect(tabs).toHaveCount(2);
  const origin=await login.evaluate(el=>getComputedStyle(el).backgroundImage);
  const before=await login.locator('#loginBtn').evaluate(el=>getComputedStyle(el).backgroundImage);
  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveClass(/is-active|active/);
  const after=await login.locator('#loginBtn').evaluate(el=>getComputedStyle(el).backgroundImage);
  const backdrop=await login.evaluate(el=>getComputedStyle(el).backgroundImage);
  expect(after).not.toBe(before);
  expect(backdrop).toBe(origin);
  await expect(login.locator('#loginPass')).toBeVisible();
});
