import {test,expect} from '@playwright/test';

function smokeTask(){
  return {
    id:'rc1547-prod-smoke',
    title:'RC1547 Production Smoke',
    description:'Read-only TaskPlanner V2 production verification',
    customerId:'RC1547',
    customerName:'RC1547 Testkunde',
    area:'Export',
    processId:'abd',
    status:'in_progress',
    priority:'P1',
    startAt:'2026-10-16T08:00:00+02:00',
    plannedAt:'2026-10-16T09:00:00+02:00',
    dueAt:'2026-10-16T16:15:00+02:00',
    latestCompletionAt:'2026-10-16T16:15:00+02:00',
    holidayPolicy:'previous_workday',
    contact:'Disposition',
    checklist:[
      {id:'a',text:'Runtime prüfen',done:true},
      {id:'b',text:'UI prüfen',done:false}
    ],
    comments:[],
    dependencies:[],
    history:[{action:'created',at:'2026-10-16T08:00:00+02:00'}],
    completedAt:'',
    completionMode:''
  };
}

test('RC1547: TaskPlanner V2 rendert auf Production read-only aus isoliertem In-Memory-State',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','RC1547 läuft einmal im Laptop-Profil.');
  const live=process.env.EXPORTHUB_E2E_LIVE==='1';
  const environment=String(process.env.EXPORTHUB_E2E_PUBLIC_ENV||'').toLowerCase();
  test.skip(!live,'RC1547 ist ein expliziter Production-Live-Smoke.');
  test.skip(environment!=='production','RC1547 Live-Gate läuft ausschließlich gegen Production.');

  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error&&error.stack||error)));

  await page.goto('/?rc1547='+Date.now(),{waitUntil:'domcontentloaded'});
  await expect(page.locator('body')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Boolean(
    window.ExportHUBTaskCoreV2&&
    window.ExportHUBTaskUIV2&&
    typeof window.ExportHUBTaskUIV2.renderTasks==='function'&&
    typeof window.ExportHUBTaskUIV2.renderDetail==='function'
  )),{timeout:20_000}).toBe(true);

  const result=await page.evaluate(task=>{
    const core=window.ExportHUBTaskCoreV2;
    const ui=window.ExportHUBTaskUIV2;
    const previous=document.getElementById('rc1547-taskplanner-sandbox');
    if(previous)previous.remove();

    const root=document.createElement('section');
    root.id='rc1547-taskplanner-sandbox';
    root.setAttribute('data-rc1547-production-smoke','1');
    const list=document.createElement('div');
    list.id='rc1547-task-list';
    const detail=document.createElement('div');
    detail.id='rc1547-task-detail';
    root.append(list,detail);
    document.body.appendChild(root);

    const state={tasks:[task],taskSettings:{users:{},reminderLedger:{}}};
    const before=JSON.stringify(state);
    const writes=[];
    const nativeFetch=window.fetch;
    const xhrOpen=window.XMLHttpRequest&&window.XMLHttpRequest.prototype.open;
    const nativeBeacon=window.navigator&&window.navigator.sendBeacon;
    const isWrite=method=>['POST','PUT','PATCH','DELETE'].includes(String(method||'GET').toUpperCase());

    if(typeof nativeFetch==='function')window.fetch=function(input,init){
      const method=init&&init.method||input&&input.method||'GET';
      if(isWrite(method))writes.push('fetch:'+String(method).toUpperCase());
      return nativeFetch.apply(this,arguments);
    };
    if(xhrOpen)window.XMLHttpRequest.prototype.open=function(method){
      if(isWrite(method))writes.push('xhr:'+String(method).toUpperCase());
      return xhrOpen.apply(this,arguments);
    };
    if(typeof nativeBeacon==='function')window.navigator.sendBeacon=function(){writes.push('beacon');return nativeBeacon.apply(this,arguments);};

    try{
      const ctx={state,now:'2026-10-16T10:00:00+02:00',environment:'production',user:{id:'rc1547-readonly'}};
      ui.renderTasks(list,ctx);
      ui.renderDetail(detail,task.id,ctx);
      return {
        coreVersion:String(core.version||''),
        uiVersion:String(ui.version||''),
        taskCount:list.querySelectorAll('[data-task-id="rc1547-prod-smoke"]').length,
        hasList:Boolean(list.querySelector('[data-taskplanner-v2-list]')),
        hasDetail:Boolean(detail.querySelector('[data-taskplanner-v2-detail][data-task-id="rc1547-prod-smoke"]')),
        hasChecklist:Boolean(detail.querySelector('[data-section="checklist"]')),
        hasHistory:Boolean(detail.querySelector('[data-section="history"]')),
        title:list.textContent.includes('RC1547 Production Smoke'),
        customer:list.textContent.includes('RC1547 Testkunde'),
        dueTime:detail.textContent.includes('16:15'),
        stateUnchanged:JSON.stringify(state)===before,
        writes
      };
    }finally{
      if(typeof nativeFetch==='function')window.fetch=nativeFetch;
      if(xhrOpen)window.XMLHttpRequest.prototype.open=xhrOpen;
      if(typeof nativeBeacon==='function')window.navigator.sendBeacon=nativeBeacon;
    }
  },smokeTask());

  expect(result.uiVersion).toBe('2.0');
  expect(result.coreVersion).not.toBe('');
  expect(result.taskCount).toBe(1);
  expect(result.hasList).toBe(true);
  expect(result.hasDetail).toBe(true);
  expect(result.hasChecklist).toBe(true);
  expect(result.hasHistory).toBe(true);
  expect(result.title).toBe(true);
  expect(result.customer).toBe(true);
  expect(result.dueTime).toBe(true);
  expect(result.stateUnchanged).toBe(true);
  expect(result.writes).toEqual([]);
  expect(pageErrors).toEqual([]);

  await page.evaluate(()=>document.getElementById('rc1547-taskplanner-sandbox')?.remove());
});
