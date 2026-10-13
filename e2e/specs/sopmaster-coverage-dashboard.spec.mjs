import {test,expect} from '@playwright/test';
import path from 'node:path';

const ROOT=process.cwd();
const script=name=>path.join(ROOT,'assets','sop',name);

async function loadDashboard(page){
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app"></main></body></html>`);
  await page.addStyleTag({path:script('rc1506-sop-coverage-dashboard.css')});
  for(const file of [
    'rc1500-sop-step-contract.js',
    'rc1007-sop-model.js',
    'rc1500-sop-overlay.js',
    'rc1502-sop-visuals.js',
    'rc1501-sop-tour-targets.js',
    'rc1505-sop-function-registry.js',
    'rc1505-sop-coverage.js',
    'rc1506-sop-coverage-dashboard.js'
  ]) await page.addScriptTag({path:script(file)});

  await page.evaluate(()=>{
    const step=(id,key,title)=>({
      id,order:1,title,instruction:`${title} durchführen`,expectedAction:'click',
      target:{stableKey:key,selector:`[data-tour-key="${key}"]`},checks:[],
      tour:{enabled:true,highlight:true,blockWrongNavigation:true},
      training:{enabled:true,sideEffectPolicy:'sandbox'},
      exam:{relevant:true,required:true,weight:1,allowHint:false}
    });
    const document=(number,area,stepId,key,title,{image=true}={})=>({
      id:`DOC-${number}`,type:'process',number,title,area,currentVersion:'2.0',version:'2.0',status:'Freigegeben',approvedBy:'QA',
      versions:[{version:'2.0',status:'Freigegeben',title,approvedBy:'QA',content:{steps:[step(stepId,key,title)]},visuals:image?[{type:'screenshot',stepId,src:`/assets/sop/screenshots/${number}.png`,required:true,annotations:[]}]:[]}]
    });
    const overlay={
      id:'OV-C1',type:'customer',customerId:'C1',baseProcessSop:'SOP-EH-060',number:'SOP-C1-060',currentVersion:'1.0',version:'1.0',status:'Freigegeben',
      versions:[{version:'1.0',status:'Freigegeben',title:'Kundenhinweis ABD',approvedBy:'QA',content:{overlays:[{action:'enrich-step',stepId:'step-abd',warnings:['Kundenhinweis']}]},visuals:[]}]
    };
    const entries=[
      {id:'customs.abd.decision',view:'shipment',action:'decide-abd-required',sopNumber:'SOP-EH-060',stepId:'step-abd',targetKey:'shipment-abd-decision',area:'Export / Zoll',requiredImage:true,requiredTour:true,requiredExam:true,required:true,customerScoped:true,customerOverlayRequired:true},
      {id:'shipping.documents',view:'shipment',action:'documents',sopNumber:'SOP-EH-061',stepId:'step-docs',targetKey:'shipment-documents',area:'Versand',requiredImage:true,requiredTour:true,requiredExam:true,required:true,customerScoped:false},
      {id:'admin.missing',view:'admin',action:'missing',sopNumber:'SOP-EH-999',stepId:'step-missing',targetKey:'admin-missing',area:'Administration',requiredImage:false,requiredTour:false,requiredExam:false,required:true,customerScoped:false}
    ];
    const documents=[
      document('SOP-EH-060','Export / Zoll','step-abd','shipment-abd-decision','ABD Entscheidung'),
      document('SOP-EH-061','Versand','step-docs','shipment-documents','Versanddokumente',{image:false}),
      overlay
    ];
    window.__RC1506_NAV__=null;
    window.__RC1506_CONTROLLER__=window.ExportHubSopCoverageDashboard.mount('#app',{
      entries,documents,customers:[{id:'C1',name:'Kunde Alpha'},{id:'C2',name:'Kunde Beta'}],customerId:'C1',assetExists:()=>true,
      onNavigate:target=>{window.__RC1506_NAV__=target;}
    });
  });
}

for(const viewport of ['desktop','mobile-standard']){
  test(`RC1506: Coverage/Admin-Dashboard rendert, filtert und navigiert stabil (${viewport})`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!==viewport,`nur ${viewport}`);
    await loadDashboard(page);

    const dashboard=page.locator('[data-sop-coverage-dashboard]');
    await expect(dashboard).toBeVisible();
    await expect(dashboard).toContainText('SOPMaster Coverage');
    await expect(dashboard.locator('[data-kpi="coverage"]')).toContainText('Abdeckungsquote');
    await expect(dashboard.locator('[data-kpi="red"]')).toContainText('1');
    await expect(dashboard.locator('[data-kpi="yellow"]')).toContainText('1');
    await expect(dashboard.locator('[data-kpi="green"]')).toContainText('1');
    await expect(dashboard.locator('[data-kpi="tour"]')).toContainText('2');
    await expect(dashboard.locator('[data-kpi="image"]')).toContainText('1');
    await expect(dashboard).toContainText('Kunde Alpha');

    const rows=dashboard.locator('tbody tr[data-coverage-row-id]');
    await expect(rows).toHaveCount(3);

    await dashboard.locator('[data-coverage-filter="area"]').selectOption('Export / Zoll');
    await expect(dashboard.locator('tbody tr[data-coverage-row-id]')).toHaveCount(1);
    await expect(dashboard).toContainText('customs.abd.decision');

    await dashboard.locator('[data-coverage-filter="capability"]').selectOption('tour');
    await expect(dashboard.locator('tbody tr[data-coverage-row-id]')).toHaveCount(1);

    await dashboard.locator('[data-coverage-reset]').click();
    await expect(dashboard.locator('tbody tr[data-coverage-row-id]')).toHaveCount(3);
    await expect(dashboard.locator('[data-coverage-filter="customerId"]')).toHaveValue('');

    await dashboard.locator('[data-coverage-filter="customerId"]').selectOption('C1');
    await dashboard.locator('tr[data-coverage-row-id="customs.abd.decision"] [data-coverage-nav="step"]').click();
    await expect.poll(()=>page.evaluate(()=>window.__RC1506_NAV__)).toMatchObject({kind:'step',view:'sop',sopNumber:'SOP-EH-060',stepId:'step-abd'});

    const dims=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
    expect(dims.scrollWidth).toBeLessThanOrEqual(dims.clientWidth+4);

    if(viewport==='mobile-standard'){
      const display=await dashboard.locator('.rc1506-table').evaluate(el=>getComputedStyle(el).display);
      expect(display).toBe('block');
      const action=dashboard.locator('tr[data-coverage-row-id="customs.abd.decision"] [data-coverage-nav="sop"]');
      const box=await action.boundingBox();
      expect(box?.height||0).toBeGreaterThanOrEqual(43);
    }
  });
}
