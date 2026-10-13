import {test,expect} from '@playwright/test';
import {
  appEntry,waitReady,openExportHubView,assertNoHorizontalOverflow,
  assertNoSourceLeak,attachRuntimeGuards,assertRuntimeClean
} from '../helpers/exporthub-browser.mjs';

async function openDashboard(page){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'dashboard',['Dashboard'],/Dashboard|Arbeitsfokus|Sendungen|Aufgaben/i,{allowProgrammaticFallback:true});
  await expect.poll(()=>page.evaluate(()=>!!window.ExportHUBDashboard1371)).toBe(true);
  await page.evaluate(()=>window.ExportHUBDashboard1371.remount());
  await expect(page.locator('[data-eh-dashboard-personalized="1"]')).toHaveCount(1);
}

async function setStableDashboardTestUser(page){
  await page.evaluate(()=>{
    const current=(typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'&&window.__EXPORTHUB_GET_CURRENT_USER__())||window.currentUser||{};
    const user={...current,id:'rc1371-e2e-user',username:'rc1371-e2e-user'};
    window.currentUser=user;
    window.__EXPORTHUB_GET_CURRENT_USER__=()=>user;
    if(window.ExportHUBDashboard1371)window.ExportHUBDashboard1371.remount();
  });
}

async function clean(page,runtime,testInfo){
  await assertNoSourceLeak(page);
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
}

test('RC1371: dashboard mounts once, preserves live cards and exposes editor controls',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openDashboard(page);
  const result=await page.evaluate(()=>{
    const api=window.ExportHUBDashboard1371;
    api.enterEditMode();
    const root=api.mountedRoot();
    const widgets=[...root.querySelectorAll('[data-rc1371-widget-id]')];
    const unique=new Set(widgets.map(node=>node.getAttribute('data-rc1371-widget-id')));
    return{
      editing:api.isEditing(),
      roots:document.querySelectorAll('[data-eh-dashboard-personalized="1"]').length,
      widgetCount:widgets.length,
      uniqueCount:unique.size,
      toolbarCount:root.querySelectorAll('[data-rc1371-toolbar="1"]').length,
      templateCount:root.querySelectorAll('[data-rc1371-template-select="1"]').length,
      controls:root.querySelectorAll('[data-rc1371-widget-controls="1"]').length
    };
  });
  expect(result.editing).toBe(true);
  expect(result.roots).toBe(1);
  expect(result.widgetCount).toBeGreaterThan(0);
  expect(result.uniqueCount).toBe(result.widgetCount);
  expect(result.toolbarCount).toBe(1);
  expect(result.templateCount).toBe(1);
  expect(result.controls).toBeGreaterThan(0);
  await clean(page,runtime,testInfo);
});

test('RC1371: add, resize and reorder persist after reload for the current user',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openDashboard(page);
  await setStableDashboardTestUser(page);
  const before=await page.evaluate(()=>{
    const api=window.ExportHUBDashboard1371;
    const user=api.resolveUserIdentity();
    if(!user)throw new Error('stable dashboard user identity missing');
    api.addWidget('quick-shipment');
    api.resizeWidget('quick-shipment','M');
    api.moveWidgetBy('quick-shipment',-1);
    const row=api.currentLayout().widgets.find(item=>item.id==='quick-shipment');
    return{user,key:api.layoutStorageKey(user),row};
  });
  expect(before.user).toBe('rc1371-e2e-user');
  expect(before.key).toMatch(/^exporthub\.dashboard\.layout\.v1\./);
  expect(before.row.visible).toBe(true);
  expect(before.row.size).toBe('M');
  await page.reload({waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'dashboard',['Dashboard'],/Dashboard|Arbeitsfokus|Sendungen|Aufgaben/i,{allowProgrammaticFallback:true});
  await expect.poll(()=>page.evaluate(()=>!!window.ExportHUBDashboard1371)).toBe(true);
  await setStableDashboardTestUser(page);
  const after=await page.evaluate(()=>{
    const api=window.ExportHUBDashboard1371;
    const user=api.resolveUserIdentity();
    const row=api.currentLayout().widgets.find(item=>item.id==='quick-shipment');
    const node=document.querySelector('[data-rc1371-widget-id="quick-shipment"]');
    return{user,row,hidden:node?node.hidden:null,size:node&&node.getAttribute('data-rc1371-size'),order:node&&node.style.order};
  });
  expect(after.user).toBe('rc1371-e2e-user');
  expect(after.row.visible).toBe(true);
  expect(after.row.size).toBe('M');
  expect(after.hidden).toBe(false);
  expect(after.size).toBe('M');
  expect(Number(after.order)).toBeGreaterThanOrEqual(10);
  await clean(page,runtime,testInfo);
});

test('RC1371: widget library searches locally and only exposes permitted widgets',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openDashboard(page);
  await page.evaluate(()=>window.ExportHUBDashboard1371.openLibrary());
  const root=page.locator('[data-eh-dashboard-personalized="1"]');
  const search=root.locator('[data-rc1371-library-search="1"]');
  await expect(search).toBeVisible();
  await search.fill('quick-sop');
  const library=await page.evaluate(()=>{
    const api=window.ExportHUBDashboard1371;
    const allowed=api.libraryWidgets();
    return{
      allPermitted:allowed.every(def=>api.canUseWidget(def)),
      visibleItems:[...document.querySelectorAll('[data-rc1371-library-item="1"]')].filter(node=>!node.hidden).map(node=>node.getAttribute('data-widget-id'))
    };
  });
  expect(library.allPermitted).toBe(true);
  expect(library.visibleItems).toContain('quick-sop');
  expect(library.visibleItems.length).toBe(1);
  await clean(page,runtime,testInfo);
});

test('RC1371: templates differ, standard reset preserves unrelated storage',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openDashboard(page);
  const result=await page.evaluate(()=>{
    const api=window.ExportHUBDashboard1371;
    localStorage.setItem('rc1371-unrelated','keep');
    const registry=api.registry();
    const sig=name=>JSON.stringify(api.templateLayout(name,registry).widgets.map(row=>[row.id,row.visible,row.size,row.order]));
    api.applyTemplate('analyse');
    const selected=document.querySelector('[data-rc1371-template-select="1"]')?.value||'';
    api.restoreStandard();
    return{
      standard:sig('standard'),analysis:sig('analyse'),compact:sig('kompakt'),
      selectedBeforeReset:selected,
      templateAfter:api.currentLayout().template,
      unrelated:localStorage.getItem('rc1371-unrelated')
    };
  });
  expect(result.analysis).not.toBe(result.standard);
  expect(result.compact).not.toBe(result.standard);
  expect(result.selectedBeforeReset).toBe('analyse');
  expect(result.templateAfter).toBe('standard');
  expect(result.unrelated).toBe('keep');
  await clean(page,runtime,testInfo);
});

test('RC1371: theme cycle never duplicates dashboard cards or editor controls',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openDashboard(page);
  for(const design of ['classic','modern','glass','neon','classic']){
    await page.evaluate(value=>{
      if(!window.ExportHUBDesignSwitcher)throw new Error('ExportHUBDesignSwitcher missing');
      window.ExportHUBDesignSwitcher.apply(value);
      window.ExportHUBDashboard1371.remount();
    },design);
    await expect(page.locator('html')).toHaveAttribute('data-eh-design',design);
    const counts=await page.evaluate(()=>{
      const root=document.querySelector('[data-eh-dashboard-personalized="1"]');
      const ids=[...root.querySelectorAll('[data-rc1371-widget-id]')].map(node=>node.getAttribute('data-rc1371-widget-id'));
      return{roots:document.querySelectorAll('[data-eh-dashboard-personalized="1"]').length,toolbar:root.querySelectorAll('[data-rc1371-toolbar="1"]').length,widgets:ids.length,unique:new Set(ids).size};
    });
    expect(counts.roots).toBe(1);
    expect(counts.toolbar).toBe(1);
    expect(counts.widgets).toBe(counts.unique);
  }
  await clean(page,runtime,testInfo);
});

test('RC1371: mobile-safe move controls and quick access use existing navigation',async({page},testInfo)=>{
  const runtime=attachRuntimeGuards(page,testInfo);
  await openDashboard(page);
  const before=await page.evaluate(()=>{
    const api=window.ExportHUBDashboard1371;api.enterEditMode();api.addWidget('quick-tasks');
    return{up:document.querySelectorAll('[data-rc1371-action="moveUp"]').length,down:document.querySelectorAll('[data-rc1371-action="moveDown"]').length,opened:api.openQuickAccess('quick-tasks')};
  });
  expect(before.up).toBeGreaterThan(0);
  expect(before.down).toBeGreaterThan(0);
  expect(before.opened).toBe(true);
  await expect.poll(()=>page.evaluate(()=>String(window.__EXPORTHUB_GET_STATE__?.().view||'').toLowerCase())).toContain('task');
  await assertNoHorizontalOverflow(page);
  await assertRuntimeClean(runtime,testInfo);
});
