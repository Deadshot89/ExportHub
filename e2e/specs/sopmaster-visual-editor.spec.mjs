import {test,expect} from '@playwright/test';
import {appEntry,waitReady,openExportHubView,assertNoHorizontalOverflow} from '../helpers/exporthub-browser.mjs';

const SOP='SOP-EH-060';
const DRAFT='2.1';
const STEP_ID='rc1502-e2e-step';
const IMAGE='/assets/sop/screenshots/rc1018-abd.png';
const TARGET='sop-open-SOP-EH-060';

async function openSop(page){
  await openExportHubView(page,'sop',['SOP & Portale','SOP','SOP-Handbuch'],/SOP|Portale/i);
  const open=page.locator(`[data-sop-open="${SOP}"]`).first();
  await expect(open).toBeVisible();
  await open.click();
  const doc=page.locator(`.rc1007-sop-document[data-sop-number="${SOP}"]`);
  await expect(doc).toBeVisible();
  await expect(doc.locator('[data-sop-editor]')).toBeVisible();
  return doc;
}

async function stateSnapshot(page){
  return page.evaluate(({sop,draft,stepId})=>{
    const state=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():{};
    const stored=(state.isoSops||[]).find(item=>item.number===sop)||null;
    const canonical=window.ExportHubIsoSopCatalog&&window.ExportHubIsoSopCatalog.get?window.ExportHubIsoSopCatalog.get(sop):null;
    const doc=stored||canonical;
    const released=(doc&&doc.versions||[]).find(item=>item.version==='2.0')||null;
    const draftVersion=(doc&&doc.versions||[]).find(item=>item.version===draft)||null;
    const step=draftVersion&&draftVersion.content&&draftVersion.content.steps&&draftVersion.content.steps.find(item=>item.id===stepId)||null;
    return {released:released?JSON.stringify(released):'',draftVersion:doc&&doc.draftVersion||'',step,visuals:draftVersion&&draftVersion.visuals||[]};
  },{sop:SOP,draft:DRAFT,stepId:STEP_ID});
}

async function durableSnapshot(page){
  return page.evaluate(async({sop,draft,stepId})=>{
    const summarize=state=>{
      const doc=state&&Array.isArray(state.isoSops)?state.isoSops.find(item=>item&&item.number===sop):null;
      const draftVersion=doc&&Array.isArray(doc.versions)?doc.versions.find(item=>item&&item.version===draft):null;
      const step=draftVersion&&draftVersion.content&&Array.isArray(draftVersion.content.steps)?draftVersion.content.steps.find(item=>item&&item.id===stepId):null;
      return {draftVersion:doc&&doc.draftVersion||'',step,visuals:draftVersion&&Array.isArray(draftVersion.visuals)?draftVersion.visuals:[]};
    };
    let local={};
    try{local=JSON.parse(localStorage.getItem('exporthub-team-state')||'{}')||{};}catch(_){}
    const demo=window.__EXPORTHUB_DEMO_STATE__&&window.__EXPORTHUB_DEMO_STATE__.state||{};
    let api={};
    try{
      const response=await fetch('/api/exporthub-state?mode=read&full=1',{method:'GET',credentials:'same-origin',cache:'no-store'});
      const payload=await response.json();
      api=payload&&payload.state||payload&&payload.team&&payload.team.state||{};
    }catch(_){}
    return {local:summarize(local),demo:summarize(demo),api:summarize(api)};
  },{sop:SOP,draft:DRAFT,stepId:STEP_ID});
}

for(const viewport of ['desktop','mobile-standard']){
  test(`RC1502: Visual Editor speichert Draft vollständig und erhält Released 2.0 nach Reload (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
    await waitReady(page);
    let doc=await openSop(page);
    const before=await stateSnapshot(page);
    expect(before.released).not.toBe('');

    const editor=doc.locator('[data-sop-editor]');
    if(!(await editor.locator(`[data-sop-editor-version="${DRAFT}"]`).count())){
      await editor.locator('[data-sop-editor-field="draft-version"]').fill(DRAFT);
      await editor.locator('[data-sop-editor-field="draft-reason"]').fill('RC1502 Visual-Editor Reload E2E');
      await editor.locator('[data-sop-editor-action="create-draft"]').click();
    }
    doc=page.locator(`.rc1007-sop-document[data-sop-number="${SOP}"]`);
    await expect(doc.locator(`[data-sop-editor-version="${DRAFT}"]`)).toBeVisible();

    const currentEditor=doc.locator('[data-sop-editor]');
    await currentEditor.locator('[data-sop-editor-field="new-step-id"]').fill(STEP_ID);
    await currentEditor.locator('[data-sop-editor-field="new-step-title"]').fill('E2E Zusatzprüfung');
    await currentEditor.locator('[data-sop-editor-field="new-step-instruction"]').fill('Zusatzprüfung im Visual-Editor durchführen.');
    await currentEditor.locator('[data-sop-editor-action="add-step"]').click();

    doc=page.locator(`.rc1007-sop-document[data-sop-number="${SOP}"]`);
    let row=doc.locator(`[data-sop-editor-step="${STEP_ID}"]`);
    await expect(row).toBeVisible();
    const beforeIndex=await row.evaluate(el=>Array.from(el.parentElement.children).indexOf(el));
    const up=row.locator('[data-sop-editor-action="move-up"]');
    if(await up.isEnabled())await up.click();
    doc=page.locator(`.rc1007-sop-document[data-sop-number="${SOP}"]`);
    row=doc.locator(`[data-sop-editor-step="${STEP_ID}"]`);
    const afterIndex=await row.evaluate(el=>Array.from(el.parentElement.children).indexOf(el));
    expect(afterIndex).toBeLessThanOrEqual(beforeIndex);

    const editorAfterMove=doc.locator('[data-sop-editor]');
    await editorAfterMove.locator('[data-sop-editor-field="visual-step"]').selectOption(STEP_ID);
    await editorAfterMove.locator('[data-sop-editor-field="visual-src"]').fill(IMAGE);
    await editorAfterMove.locator('[data-sop-editor-field="visual-caption"]').fill('RC1502 E2E ABD-Schrittbild');
    await editorAfterMove.locator('[data-sop-editor-action="assign-visual"]').click();

    doc=page.locator(`.rc1007-sop-document[data-sop-number="${SOP}"]`);
    row=doc.locator(`[data-sop-editor-step="${STEP_ID}"]`);
    const stableTarget=page.locator(`[data-sop-open="${SOP}"]`).first();
    await expect(stableTarget).toHaveAttribute('data-tour-key',TARGET);
    await row.locator('[data-sop-editor-action="pick-target"]').click();
    await expect(page.locator('html')).toHaveClass(/rc1502-sop-target-picking/);
    await stableTarget.click();
    await expect(page.locator('html')).not.toHaveClass(/rc1502-sop-target-picking/);

    let saved=await stateSnapshot(page);
    expect(saved.draftVersion).toBe(DRAFT);
    expect(saved.step).toBeTruthy();
    expect(saved.step.target).toEqual({stableKey:TARGET,selector:`[data-tour-key="${TARGET}"]`});
    expect(saved.visuals.some(item=>item.stepId===STEP_ID&&item.src===IMAGE&&item.caption==='RC1502 E2E ABD-Schrittbild')).toBe(true);
    expect(saved.released).toBe(before.released);

    const persistence=page.locator('[data-sop-persist-status]').first();
    await expect(persistence).toHaveAttribute('data-sop-persist-status','saved',{timeout:15000});

    const durable=await durableSnapshot(page);
    for(const [layer,snapshot] of Object.entries(durable)){
      expect(snapshot.draftVersion,`${layer}: Draft-Version muss vor Reload dauerhaft gespeichert sein`).toBe(DRAFT);
      expect(snapshot.step,`${layer}: Schritt muss vor Reload dauerhaft gespeichert sein`).toBeTruthy();
      expect(snapshot.step.target,`${layer}: Tourziel muss vor Reload dauerhaft gespeichert sein`).toEqual({stableKey:TARGET,selector:`[data-tour-key="${TARGET}"]`});
      expect(snapshot.visuals.some(item=>item.stepId===STEP_ID&&item.src===IMAGE),`${layer}: Schrittbild muss vor Reload dauerhaft gespeichert sein`).toBe(true);
    }

    await page.reload({waitUntil:'domcontentloaded'});
    await waitReady(page);
    doc=await openSop(page);
    await expect(doc.locator(`[data-sop-editor-version="${DRAFT}"]`)).toBeVisible();
    row=doc.locator(`[data-sop-editor-step="${STEP_ID}"]`);
    await expect(row).toBeVisible();
    await expect(row.locator(`[data-sop-editor-target-key="${TARGET}"]`)).toBeVisible();

    saved=await stateSnapshot(page);
    expect(saved.draftVersion).toBe(DRAFT);
    expect(saved.step).toBeTruthy();
    expect(saved.step.target).toEqual({stableKey:TARGET,selector:`[data-tour-key="${TARGET}"]`});
    expect(saved.visuals.some(item=>item.stepId===STEP_ID&&item.src===IMAGE)).toBe(true);
    expect(saved.released).toBe(before.released);
    await assertNoHorizontalOverflow(page);
  });
}
