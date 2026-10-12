import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView,assertNoHorizontalOverflow} from '../helpers/exporthub-browser.mjs';

async function openAbdEditor(page){
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await openExportHubView(page,'sop',['SOP & Portale','SOP','SOP-Handbuch'],/SOP|Portale/i);
  const open=page.locator('[data-sop-open="SOP-EH-060"]').first();
  await expect(open).toBeVisible();
  await open.click();
  const document=page.locator('.rc1007-sop-document[data-sop-number="SOP-EH-060"]');
  await expect(document).toBeVisible();
  const editor=document.locator('[data-sop-editor]');
  await expect(editor,'Demo-SOP muss mit Admin-/Edit-Recht den Editor zeigen').toBeVisible();
  if(!(await editor.locator('[data-sop-editor-version]').count())){
    await editor.locator('[data-sop-editor-field="draft-version"]').fill('2.1');
    await editor.locator('[data-sop-editor-field="draft-reason"]').fill('RC1502 Target-Picker E2E');
    await editor.locator('[data-sop-editor-action="create-draft"]').click();
    await expect(document.locator('[data-sop-editor-version="2.1"]')).toBeVisible();
  }
  return document;
}

for(const viewport of ['desktop','mobile-standard']){
  test(`RC1502: Target Picker speichert nur stabiles data-tour-key und blockiert Produktivklick (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    const document=await openAbdEditor(page);
    const row=document.locator('[data-sop-editor-step]').first();
    await expect(row).toBeVisible();
    await expect(row.locator('[data-sop-editor-action="pick-target"]')).toBeVisible();

    const sidebarTarget=page.locator('[data-sop-open="SOP-EH-060"]').first();
    await expect(sidebarTarget).toHaveAttribute('data-tour-key','sop-open-SOP-EH-060');
    const beforeOpenCount=await page.locator('.rc1007-sop-document[data-sop-number="SOP-EH-060"]').count();

    await row.locator('[data-sop-editor-action="pick-target"]').click();
    await expect(page.locator('html')).toHaveClass(/rc1502-sop-target-picking/);
    await expect(row.locator('.rc1502-sop-target-status')).toContainText(/Klicke jetzt/i);

    await sidebarTarget.click();
    await expect(page.locator('html')).not.toHaveClass(/rc1502-sop-target-picking/);
    const refreshed=page.locator('.rc1007-sop-document[data-sop-number="SOP-EH-060"]');
    await expect(refreshed).toBeVisible();
    const refreshedRow=refreshed.locator('[data-sop-editor-step]').first();
    const targetBlock=refreshedRow.locator('[data-sop-editor-target-key="sop-open-SOP-EH-060"]');
    await expect(targetBlock).toBeVisible();
    await expect(targetBlock.locator('code')).toHaveText('sop-open-SOP-EH-060');
    expect(await page.locator('.rc1007-sop-document[data-sop-number="SOP-EH-060"]').count()).toBe(beforeOpenCount);

    await targetBlock.locator('[data-sop-editor-action="test-target"]').click();
    await expect(targetBlock.locator('.rc1502-sop-target-status')).toContainText(/eindeutig gefunden/i);

    await targetBlock.locator('[data-sop-editor-action="pick-target"]').click();
    await expect(page.locator('html')).toHaveClass(/rc1502-sop-target-picking/);
    await targetBlock.locator('[data-sop-editor-action="cancel-target-pick"]').click();
    await expect(page.locator('html')).not.toHaveClass(/rc1502-sop-target-picking/);

    const persisted=await page.evaluate(()=>{
      const state=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():{};
      const doc=(state.isoSops||[]).find(item=>item.number==='SOP-EH-060');
      const draft=(doc&&doc.versions||[]).find(item=>item.version===doc.draftVersion);
      const step=draft&&draft.content&&draft.content.steps&&draft.content.steps[0];
      return step&&step.target||null;
    });
    expect(persisted).toEqual({stableKey:'sop-open-SOP-EH-060',selector:'[data-tour-key="sop-open-SOP-EH-060"]'});
    await assertNoHorizontalOverflow(page);
  });
}
