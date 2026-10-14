import {test,expect} from '@playwright/test';

const USER_ID='rc1530-production-dashboard-smoke';
const STORAGE_PREFIX='exporthub.dashboard.layout.v1.';

async function prepareDashboardSandbox(page){
  return page.evaluate(({userId})=>{
    const api=window.ExportHUBDashboard1371;
    if(!api)throw new Error('RC1530: ExportHUBDashboard1371 fehlt auf Production.');

    try{api.unmount()}catch(_){}
    window.__EXPORTHUB_GET_CURRENT_USER__=()=>({id:userId,username:userId});

    const previous=document.getElementById('rc1530-dashboard-sandbox');
    if(previous)previous.remove();

    const root=document.createElement('section');
    root.id='rc1530-dashboard-sandbox';
    root.setAttribute('data-exporthub-dashboard','1');

    const makeWidget=(id,title)=>{
      const card=document.createElement('article');
      card.id=id;
      card.className='dashboard-card';
      card.setAttribute('data-dashboard-widget','1');
      card.setAttribute('data-widget-id',id);
      card.textContent=title;
      root.appendChild(card);
      return card;
    };

    makeWidget('rc1530-a','RC1530 A');
    makeWidget('rc1530-b','RC1530 B');
    document.body.appendChild(root);

    api.registerWidget({id:'rc1530-a',titleKey:'RC1530 A',category:'kpis',defaultSize:'M',allowedSizes:['S','M','L'],defaultVisible:true});
    api.registerWidget({id:'rc1530-b',titleKey:'RC1530 B',category:'analyses',defaultSize:'M',allowedSizes:['M','L','XL'],defaultVisible:true});

    if(api.mount(root)!==true)throw new Error('RC1530: Dashboard-Sandbox konnte nicht gemountet werden.');
    return {
      version:api.version,
      key:api.layoutStorageKey(userId),
      hasToolbar:!!root.querySelector('[data-rc1371-toolbar="1"]')
    };
  },{userId:USER_ID});
}

test('RC1530 Production: Dashboard-Personalisierung speichert Editorzustand über Reload und lässt sich sauber zurücksetzen',async({page})=>{
  test.skip(process.env.EXPORTHUB_E2E_LIVE!=='1','RC1530 läuft nur im Live-Release-Gate.');
  test.skip(String(process.env.EXPORTHUB_E2E_PUBLIC_ENV||'').toLowerCase()!=='production','RC1530 läuft ausschließlich gegen Production.');

  await page.goto('/?rc1530='+Date.now(),{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Boolean(window.ExportHUBDashboard1371)),{timeout:15_000}).toBe(true);

  const initial=await prepareDashboardSandbox(page);
  expect(initial.version).toBe('RC1371');
  expect(initial.key).toMatch(new RegExp('^'+STORAGE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  expect(initial.hasToolbar).toBe(true);

  const changed=await page.evaluate(({userId})=>{
    const api=window.ExportHUBDashboard1371;
    const root=document.getElementById('rc1530-dashboard-sandbox');
    const key=api.layoutStorageKey(userId);

    if(api.enterEditMode()!==true)throw new Error('RC1530: Editor konnte nicht aktiviert werden.');
    if(root.getAttribute('data-rc1371-editing')!=='1')throw new Error('RC1530: sichtbarer Editierzustand fehlt.');
    if(api.openLibrary()!==true||!root.querySelector('[data-rc1371-library="1"]'))throw new Error('RC1530: Widget-Bibliothek fehlt.');
    api.closeLibrary();

    if(api.resizeWidget('rc1530-a','L')!==true)throw new Error('RC1530: Größenänderung wurde nicht gespeichert.');
    if(api.hideWidget('rc1530-b')!==true)throw new Error('RC1530: Ausblenden wurde nicht gespeichert.');
    if(api.moveWidget('rc1530-b','rc1530-a')!==true)throw new Error('RC1530: Reihenfolge wurde nicht gespeichert.');

    const state=api.currentLayout();
    const a=state.widgets.find(row=>row.id==='rc1530-a');
    const b=state.widgets.find(row=>row.id==='rc1530-b');
    const raw=localStorage.getItem(key);
    if(!raw)throw new Error('RC1530: persönlicher Layout-State fehlt im localStorage.');

    return {
      key,
      stored:JSON.parse(raw),
      a,
      b,
      aSize:document.getElementById('rc1530-a').getAttribute('data-rc1371-size'),
      bHidden:document.getElementById('rc1530-b').hidden,
      editing:api.isEditing()
    };
  },{userId:USER_ID});

  expect(changed.key).toContain(STORAGE_PREFIX);
  expect(changed.a?.size).toBe('L');
  expect(changed.aSize).toBe('L');
  expect(changed.b?.visible).toBe(false);
  expect(changed.bHidden).toBe(true);
  expect(changed.editing).toBe(true);
  expect(changed.stored.widgets.some(row=>row.id==='rc1530-a'&&row.size==='L')).toBe(true);
  expect(changed.stored.widgets.some(row=>row.id==='rc1530-b'&&row.visible===false)).toBe(true);

  await page.reload({waitUntil:'domcontentloaded'});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.ExportHUBDashboard1371)),{timeout:15_000}).toBe(true);
  await prepareDashboardSandbox(page);

  const restored=await page.evaluate(({userId})=>{
    const api=window.ExportHUBDashboard1371;
    const state=api.currentLayout();
    const a=state.widgets.find(row=>row.id==='rc1530-a');
    const b=state.widgets.find(row=>row.id==='rc1530-b');
    const key=api.layoutStorageKey(userId);
    const result={
      persisted:localStorage.getItem(key)!==null,
      a,
      b,
      aSize:document.getElementById('rc1530-a').getAttribute('data-rc1371-size'),
      bHidden:document.getElementById('rc1530-b').hidden
    };
    api.restoreStandard();
    result.resetRemoved=localStorage.getItem(key)===null;
    result.templateAfterReset=api.currentLayout().template;
    return result;
  },{userId:USER_ID});

  expect(restored.persisted).toBe(true);
  expect(restored.a?.size).toBe('L');
  expect(restored.aSize).toBe('L');
  expect(restored.b?.visible).toBe(false);
  expect(restored.bHidden).toBe(true);
  expect(restored.resetRemoved).toBe(true);
  expect(restored.templateAfterReset).toBe('standard');

  await page.evaluate(()=>{
    try{window.ExportHUBDashboard1371?.unmount()}catch(_){}
    document.getElementById('rc1530-dashboard-sandbox')?.remove();
  });
});
