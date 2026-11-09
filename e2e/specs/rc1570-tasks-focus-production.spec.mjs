import {test,expect} from '@playwright/test';

// RC1570: isolated, synthetic browser verification against the assets currently
// served by production. No login, customer records, persistent writes or API writes.
test('RC1570 production: task roster, overdue POD/AV, weekly and deletion safety',async({page,request},info)=>{
  test.skip(info.project.name!=='laptop','One deterministic browser profile.');
  const live=process.env.EXPORTHUB_E2E_LIVE==='1';
  test.skip(live&&String(process.env.EXPORTHUB_E2E_PUBLIC_ENV||'').toLowerCase()!=='production',
    'Live use is permitted only for production.');

  const marker=Date.now();
  const [translations,script]=await Promise.all([
    request.get('/assets/i18n/rc1570-tasks-focus.js?rc1570='+marker),
    request.get('/assets/rc1570-tasks-focus.js?rc1570='+marker)
  ]);
  expect(translations.status()).toBe(200);
  expect(script.status()).toBe(200);
  const translationsText=await translations.text();
  const scriptText=await script.text();
  expect(translationsText).toContain('ExportHUBTasksFocus1570I18n');
  expect(scriptText).toContain('ExportHUBTasksFocus1570');

  // Deliberately do NOT navigate to the production app or authenticate.
  // Execute only these two delivered public assets in an about:blank sandbox.
  await page.goto('about:blank');
  await page.evaluate(()=>{
    const tasks=Array.from({length:245},(_,i)=>({
      id:'rc1570-synthetic-'+i,title:'Synthetic task '+i,
      sourceType:'manual',owner:'RC1570 Smoke',dueDate:'2099-01-01'
    }));
    tasks.push(
      {id:'rc1570-manual-late',title:'Synthetic manual overdue',sourceType:'manual',
        owner:'RC1570 Smoke',dueDate:'2020-01-01'},
      {id:'rc1570-pod',title:'Synthetic missing POD',sourceType:'pod',
        group:'Fehlende POD',owner:'RC1570 Smoke',dueDate:'2020-01-02'},
      {id:'task:av-missing:RC1570',title:'Synthetic missing AV',sourceType:'av_missing',
        group:'Ausgangsvermerk',owner:'RC1570 Smoke',dueDate:'2020-01-03'},
      {id:'rc1570-open-shipment',title:'Synthetic open shipment',sourceType:'shipment',
        group:'Offene Sendungen',owner:'RC1570 Smoke',dueDate:'2020-01-04'},
      {id:'rc1570-weekly',title:'Synthetic weekly job',sourceType:'manual',
        recurrence:'weekly',owner:'RC1570 Smoke'},
      {id:'rc1570-done',title:'Synthetic completed',sourceType:'manual',
        status:'done',done:true,owner:'RC1570 Smoke'},
      {id:'rc1570-other',title:'Synthetic other colleague',sourceType:'manual',
        owner:'Different colleague',dueDate:'2020-01-05'}
    );
    const state={tasks,users:[],taskSeries:[],taskManagedDisabled:{},
      _teamSyncMeta:{fields:{},tombstones:[]}};
    const localSaves=[];
    const network=[];
    window.__RC1570_SANDBOX__={state,localSaves,network};
    window.__EXPORTHUB_GET_STATE__=()=>state;
    window.__EXPORTHUB_GET_CURRENT_USER__=()=>({id:'rc1570-smoke',name:'RC1570 Smoke'});
    window.canWrite=area=>area==='tasks';
    window.confirm=()=>true;
    window.alert=()=>{};
    window.ExportHUBClean={
      queueSave(reason){localSaves.push('queue:'+reason);return true;},
      flushSave(reason){localSaves.push('flush:'+reason);return Promise.resolve(true);},
      operationStatus(){}
    };
    // Strict fail-closed network boundary for all synthetic operations.
    window.fetch=function(){network.push('fetch');throw Error('RC1570 no network allowed');};
    window.XMLHttpRequest=class{constructor(){network.push('xhr');throw Error('RC1570 no xhr allowed');}};
    window.navigator.sendBeacon=function(){network.push('beacon');return false;};
  });
  await page.addScriptTag({content:translationsText});
  await page.addScriptTag({content:scriptText});

  const result=await page.evaluate(async()=>{
    const api=window.ExportHUBTasksFocus1570;
    if(!api||api.version!=='RC1570')throw Error('RC1570 delivered asset missing');
    const {state,localSaves,network}=window.__RC1570_SANDBOX__;
    const before=JSON.stringify(state);
    const tv=api._tv;
    tv.mode='list';tv.scope='mine';tv.kind='all';tv.search='';tv.moreCount=100;

    const mine=api.managedRows();
    const html=api.taskViewHtml();
    const node=document.createElement('div');
    node.innerHTML=html;
    const firstVisible=node.querySelectorAll('[data-rc1570-tv-open]').length;
    const paginated=node.querySelector('[data-rc1570-tv-more]')!==null;
    const protectedIds=['rc1570-pod','task:av-missing:RC1570','rc1570-open-shipment'];
    const noSystemDelete=protectedIds.every(id=>!node.querySelector(
      '[data-rc1570-tv-delete="'+id+'"]'));
    const manualDeleteVisible=!!node.querySelector(
      '[data-rc1570-tv-delete="rc1570-manual-late"]');

    tv.kind='overdue';
    const overdue=api.managedRows().rows.map(x=>x.id);
    tv.kind='weekly';const weekly=api.managedRows().rows.map(x=>x.id);
    tv.kind='done';const done=api.managedRows().rows.map(x=>x.id);
    tv.kind='all';tv.scope='all';
    const allCount=api.managedRows().counts.all;
    tv.scope='mine';tv.search='Synthetic task 244';
    const searched=api.managedRows().rows.map(x=>x.id);
    tv.search='';tv.moreCount=300;
    node.innerHTML=api.taskViewHtml();
    const showsLast=!!node.querySelector('[data-rc1570-tv-open="rc1570-synthetic-244"]');
    const initialStateUnchanged=JSON.stringify(state)===before;

    const blockedSystemDeletion=await api._deleteManagedTask('rc1570-pod');
    const deletedManual=await api._deleteManagedTask('rc1570-manual-late');
    const savedDeletion=state._teamSyncMeta.tombstones.some(x=>
      x.collection==='tasks'&&x.id==='rc1570-manual-late'&&x.explicitUserAction===true);
    const manualGone=!state.tasks.some(x=>x.id==='rc1570-manual-late');
    const systemIntact=protectedIds.every(id=>state.tasks.some(x=>x.id===id));

    return {
      mineCount:mine.counts.all,allCount,firstVisible,paginated,
      noSystemDelete,manualDeleteVisible,
      overdue,weekly,done,searched,showsLast,initialStateUnchanged,
      blockedSystemDeletion,deletedManual,savedDeletion,manualGone,systemIntact,
      localSaves,network
    };
  });

  expect(result.mineCount).toBe(251);
  expect(result.allCount).toBe(252);
  expect(result.firstVisible).toBe(100);
  expect(result.paginated).toBe(true);
  expect(result.noSystemDelete).toBe(true);
  expect(result.manualDeleteVisible).toBe(true);
  expect(result.overdue).toEqual(expect.arrayContaining([
    'rc1570-manual-late','rc1570-pod','task:av-missing:RC1570',
    'rc1570-open-shipment'
  ]));
  expect(result.weekly).toContain('rc1570-weekly');
  expect(result.done).toContain('rc1570-done');
  expect(result.searched).toEqual(['rc1570-synthetic-244']);
  expect(result.showsLast).toBe(true);
  expect(result.initialStateUnchanged).toBe(true);
  expect(result.blockedSystemDeletion).toBe(false);
  expect(result.deletedManual).toBe(true);
  expect(result.savedDeletion).toBe(true);
  expect(result.manualGone).toBe(true);
  expect(result.systemIntact).toBe(true);
  expect(result.localSaves.length).toBe(2);
  expect(result.network).toEqual([]);
});
