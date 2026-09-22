import {expect} from '@playwright/test';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const SOURCE_LEAK_PATTERNS=[
  /window\.open\(\s*['"]about:blank/i,
  /function\s+normalizeActionButtons\s*\(/i,
  /RC824_SOP_DETAILS/i,
  /function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{[^}]{0,240}\}\s*(?:var|const|let)\s+[A-Za-z_$]/i
];

function clean(value){
  return String(value??'')
    .replace(/([?&](?:token|access_token|code|sig|signature)=)[^&#\s]+/gi,'$1[REDACTED]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/gi,'$1[REDACTED]');
}

async function scrollMenuItemIntoView(page,item){
  await item.evaluate(el=>{
    const nav=el.closest&&el.closest('#nav');
    if(nav){
      const target=Math.max(0,el.offsetTop-(nav.clientHeight-el.offsetHeight)/2);
      if(typeof nav.scrollTo==='function')nav.scrollTo({top:target,behavior:'auto'});
      else nav.scrollTop=target;
    }
  }).catch(()=>{});
  await item.scrollIntoViewIfNeeded().catch(()=>{});
  await pause(100);
}

async function visible(page,locator,options={}){
  const count=await locator.count().catch(()=>0);
  const viewport=page.viewportSize();
  const allowScroll=options.scrollIntoView===true;
  for(let i=count-1;i>=0;i--){
    const item=locator.nth(i);
    if(!(await item.isVisible().catch(()=>false)))continue;
    if(allowScroll)await scrollMenuItemIntoView(page,item);
    let box=await item.boundingBox().catch(()=>null);
    if(!box||!viewport)return item;
    let intersects=box.x+box.width>0&&box.y+box.height>0&&box.x<viewport.width&&box.y<viewport.height;
    if(intersects)return item;
    if(!allowScroll)continue;
    await scrollMenuItemIntoView(page,item);
    box=await item.boundingBox().catch(()=>null);
    if(!box)return null;
    intersects=box.x+box.width>0&&box.y+box.height>0&&box.x<viewport.width&&box.y<viewport.height;
    if(intersects)return item;
  }
  return null;
}

async function mobileToggleExpanded(page){
  return page.evaluate(()=>{
    for(const selector of ['#rc1016MobileMenuBtn','#ehMenuBtn']){
      const button=document.querySelector(selector);
      if(!button)continue;
      const style=getComputedStyle(button),rect=button.getBoundingClientRect();
      const visible=style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0&&rect.width>0&&rect.height>0&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight;
      if(!visible)continue;
      const expanded=button.getAttribute('aria-expanded');
      if(expanded!==null)return expanded==='true';
    }
    return null;
  }).catch(()=>null);
}

async function mobileNavOnScreen(page){
  return page.evaluate(()=>{
    const nav=document.getElementById('nav');
    if(!nav)return false;
    const style=getComputedStyle(nav),rect=nav.getBoundingClientRect();
    return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)>0&&
      rect.width>0&&rect.height>0&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight;
  }).catch(()=>false);
}

async function menuIsOpen(page){
  if(await mobileNavOnScreen(page))return true;
  const expanded=await mobileToggleExpanded(page);
  if(expanded===false)return false;
  return false;
}

async function waitForMenuOpen(page,timeout=3000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(await menuIsOpen(page))return true;
    await pause(80);
  }
  return false;
}

async function openMenu(page){
  if(await menuIsOpen(page))return true;
  for(const selector of ['#rc1016MobileMenuBtn','#ehMenuBtn']){
    const button=await visible(page,page.locator(selector));
    if(!button)continue;
    await button.click({timeout:5000}).catch(()=>{});
    if(await waitForMenuOpen(page))return true;
  }
  return false;
}

async function contentText(page){
  const content=page.locator('#content').first();
  if(await content.count()&&await content.isVisible().catch(()=>false))return content.innerText();
  return page.locator('body').innerText();
}

async function waitForRequired(page,requiredText){
  if(!requiredText)return;
  const rx=requiredText instanceof RegExp?requiredText:new RegExp(String(requiredText),'i');
  await expect.poll(()=>contentText(page),{timeout:10_000,message:'Erwarteter View-Inhalt fehlt'}).toMatch(rx);
}

export async function waitReady(page){
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(()=>document.body&&document.body.innerText.length>10,null,{timeout:20_000});
  const markerReady=await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true,null,{timeout:process.env.EXPORTHUB_E2E_LIVE==='1'?18_000:25_000}).then(()=>true).catch(()=>false);
  if(!markerReady){
    if(process.env.EXPORTHUB_E2E_LIVE!=='1')throw new Error('ExportHUB Ready-Marker wurde nicht gesetzt.');
    await page.waitForFunction(()=>{
      const body=document.body,content=document.getElementById('content');
      const view=String(body&&body.getAttribute&&body.getAttribute('data-exporthub-view')||'').trim();
      const text=String(content&&content.innerText||'').trim();
      const interactive=typeof window.setView==='function'||!!document.querySelector('[data-view],[data-target],[data-nav]');
      return !!content&&text.length>10&&!!view&&interactive;
    },null,{timeout:20_000});
  }
  await pause(220);
}

function responsiveViewport(page){
  const viewport=page.viewportSize();
  return !!(viewport&&viewport.width<=900);
}

export async function settleStateSave(page,options={}){
  if(process.env.EXPORTHUB_E2E_LIVE!=='1')return {skipped:true};
  const timeout=Math.max(3000,Number(options.timeout||25_000));
  const stableMs=Math.max(200,Number(options.stableMs||600));
  const deadline=Date.now()+timeout;
  let stableSince=0;
  let forced=false;

  while(Date.now()<deadline){
    const snapshot=await page.evaluate(()=>{
      const clean=window.ExportHUBClean;
      const runtime=clean&&clean.runtime;
      if(!clean||!runtime)return {available:false,idle:true};
      return {
        available:true,
        saving:runtime.saving===true,
        pending:runtime.pendingSave===true,
        dirty:runtime.dirty===true,
        hasTimer:!!runtime.saveTimer,
        lastErrorCode:String(runtime.lastSaveErrorCode||''),
        lastErrorMessage:String(runtime.lastSaveErrorMessage||'')
      };
    });

    if(!snapshot.available)return snapshot;
    const busy=snapshot.saving||snapshot.pending||snapshot.dirty||snapshot.hasTimer;
    if(!busy){
      if(!stableSince)stableSince=Date.now();
      if(Date.now()-stableSince>=stableMs)return snapshot;
      await pause(120);
      continue;
    }
    stableSince=0;

    if(!snapshot.saving&&(snapshot.pending||snapshot.dirty)&&!forced){
      forced=true;
      const remaining=Math.max(1000,Math.min(18_000,deadline-Date.now()));
      const result=await page.evaluate(async timeoutMs=>{
        const clean=window.ExportHUBClean;
        if(!clean||typeof clean.flushSave!=='function')return {ok:false,error:'ExportHUB flushSave fehlt'};
        let timer=0;
        try{
          return await Promise.race([
            Promise.resolve(clean.flushSave('RC1155 Browser-Gate wartet auf Azure-Speicherung',{force:true,userInitiated:true}))
              .then(ok=>({ok:ok===true})),
            new Promise(resolve=>{timer=setTimeout(()=>resolve({ok:false,timeout:true,error:'Azure-Save Drain Timeout'}),timeoutMs)})
          ]);
        }catch(error){
          return {ok:false,error:String(error&&error.message||error)};
        }finally{
          if(timer)clearTimeout(timer);
        }
      },remaining);
      if(result&&result.timeout)throw new Error(result.error);
      if(result&&result.ok!==true){
        const details=await page.evaluate(()=>{
          const r=window.ExportHUBClean&&window.ExportHUBClean.runtime||{};
          return String(r.lastSaveErrorCode||'')+' '+String(r.lastSaveErrorMessage||'');
        }).catch(()=>'');
        throw new Error('Azure-Speicherung konnte vor Browser-Navigation nicht bestätigt werden.'+(details?' '+details:''));
      }
      continue;
    }

    await pause(150);
  }

  const finalState=await page.evaluate(()=>{
    const r=window.ExportHUBClean&&window.ExportHUBClean.runtime||{};
    return {saving:!!r.saving,pending:!!r.pendingSave,dirty:!!r.dirty,hasTimer:!!r.saveTimer,lastErrorCode:String(r.lastSaveErrorCode||''),lastErrorMessage:String(r.lastSaveErrorMessage||'')};
  }).catch(()=>({}));
  throw new Error('Azure-Speicherung blieb vor Browser-Navigation aktiv: '+JSON.stringify(finalState));
}

async function activateNavigationTarget(page,item,module,requiredText){
  const before=await page.evaluate(()=>String(document.getElementById('content')?.innerText||''));
  const clicked=await item.click({timeout:7000}).then(()=>true).catch(()=>false);
  if(!clicked)return false;
  const changed=await page.waitForFunction(({mod,beforeText})=>{
    const content=document.getElementById('content');
    const text=String(content&&content.innerText||'');
    const contentView=String(content&&content.getAttribute&&content.getAttribute('data-view')||'');
    const bodyView=String(document.body&&document.body.getAttribute&&document.body.getAttribute('data-exporthub-view')||'');
    const active=[...document.querySelectorAll('[data-view]')].some(el=>
      String(el.getAttribute('data-view')||'')===mod&&
      (el.getAttribute('aria-current')==='true'||el.classList.contains('active'))
    );
    return active||contentView===mod||bodyView===mod||text!==beforeText;
  },{mod:module,beforeText:before},{timeout:5000}).then(()=>true).catch(()=>false);
  if(!changed)return false;
  await pause(220);
  await waitForRequired(page,requiredText);
  return true;
}

export async function openExportHubView(page,module,labels=[],requiredText,options={}){
  const selectors=[
    `button[data-view="${module}"]`,`a[data-view="${module}"]`,`[role="button"][data-view="${module}"]`,
    `button[data-target="${module}"]`,`a[data-target="${module}"]`,`[role="button"][data-target="${module}"]`,
    `button[data-nav="${module}"]`,`a[data-nav="${module}"]`,`[role="button"][data-nav="${module}"]`
  ];

  attempts:
  for(let pass=0;pass<3;pass++){
    const viewport=page.viewportSize();
    let menuOpened=false;
    if(responsiveViewport(page))menuOpened=(await menuIsOpen(page))||(await openMenu(page));
    const allowScroll=Boolean(menuOpened||(viewport&&viewport.width>=768));

    for(const selector of selectors){
      const item=await visible(page,page.locator(selector),{scrollIntoView:allowScroll});
      if(!item)continue;
      if(await activateNavigationTarget(page,item,module,requiredText))return module;
      continue attempts;
    }

    for(const label of labels){
      const candidates=[
        page.getByRole('button',{name:label,exact:true}),
        page.getByRole('link',{name:label,exact:true}),
        page.getByText(label,{exact:true})
      ];
      for(const locator of candidates){
        const item=await visible(page,locator,{scrollIntoView:allowScroll});
        if(!item)continue;
        if(await activateNavigationTarget(page,item,module,requiredText))return module;
        continue attempts;
      }
    }
    if(responsiveViewport(page))await openMenu(page);
  }

  if(options.allowProgrammaticFallback===true){
    const opened=await page.evaluate(mod=>{
      if(typeof window.setView!=='function')return false;
      if(typeof window.canView==='function'&&!window.canView(mod))return false;
      window.setView(mod);
      return true;
    },module).catch(()=>false);
    if(opened){
      await pause(300);
      await waitForRequired(page,requiredText);
      return module;
    }
  }

  throw new Error(`Navigation nicht gefunden: ${module} · ${labels.join(' / ')}`);
}

export async function assertNoSourceLeak(page){
  const text=await page.locator('body').innerText();
  for(const pattern of SOURCE_LEAK_PATTERNS){
    expect(text,`Sichtbarer Quellcode-Leak: ${pattern}`).not.toMatch(pattern);
  }
}

export async function assertNoHorizontalOverflow(page,tolerance=4){
  const dims=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
    bodyScrollWidth:document.body?.scrollWidth||0
  }));
  expect(dims.scrollWidth,`Horizontales Overflow: ${JSON.stringify(dims)}`).toBeLessThanOrEqual(dims.clientWidth+tolerance);
}

export function attachRuntimeGuards(page,testInfo){
  const state={pageErrors:[],consoleErrors:[],requestFailures:[],httpErrors:[]};
  const allowConsole=[
    /favicon\.ico/i,
    /Failed to load resource.*(?:400|401|403|404|410)/i
  ];

  page.on('pageerror',error=>state.pageErrors.push(clean(error?.stack||error?.message||error)));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    const loc=message.location?.()||{};
    const line=clean(`${message.text()} ${loc.url||''}`);
    if(allowConsole.some(rx=>rx.test(line)))return;
    if(process.env.EXPORTHUB_E2E_STATIC==='1'&&/Failed to load resource/i.test(line)&&/\/api\//i.test(line))return;
    const currentUrl=clean(page.url());
    const demoContext=/\/demo(?:\.html)?(?:[?#]|$)/i.test(currentUrl)||/https?:\/\/[^\s]+\/demo(?:\.html)?(?:[?#\s]|$)/i.test(line);
    const intentionalDemoBlock=/RC1033 Lieferavis Fast-Path exporthub:(?:viewchange|rendered) Error: Diese Außenwirkung ist in der Fake-Demo absichtlich deaktiviert\./i.test(line);
    if(demoContext&&intentionalDemoBlock)return;
    state.consoleErrors.push(line);
  });
  page.on('requestfailed',request=>{
    const url=clean(request.url());
    if(/favicon\.ico/i.test(url))return;
    state.requestFailures.push(`${request.method()} ${url} · ${clean(request.failure()?.errorText||'failed')}`);
  });
  page.on('response',response=>{
    const status=response.status();
    if(status<400)return;
    const request=response.request();
    const type=request.resourceType();
    const coreAsset=['document','script','stylesheet'].includes(type);
    const serverFailure=status>=500&&['xhr','fetch'].includes(type);
    if(!coreAsset&&!serverFailure)return;
    state.httpErrors.push(`${status} ${request.method()} ${clean(response.url())}`);
  });
  state.test=testInfo?.title||'';
  state.project=testInfo?.project?.name||'';
  return state;
}

export function acknowledgePickupStatusNavigationAbort(state){
  if(!state||!Array.isArray(state.requestFailures))return 0;
  const before=state.requestFailures.length;
  state.requestFailures=state.requestFailures.filter(line=>{
    const value=clean(line);
    return !(/^GET\s+/i.test(value)&&/\/api\/pickup-status\?/i.test(value)&&/net::ERR_ABORTED$/i.test(value));
  });
  return before-state.requestFailures.length;
}

export function acknowledgeConfirmedStateSaveNavigationAbort(state){
  if(!state||!Array.isArray(state.requestFailures))return 0;
  const before=state.requestFailures.length;
  state.requestFailures=state.requestFailures.filter(line=>{
    const value=clean(line);
    if(!/^POST\s+/i.test(value)||!/net::ERR_ABORTED$/i.test(value))return true;
    if(!/\/api\/exporthub-state\?/i.test(value))return true;
    const query=value.split('?')[1]?.split(' · ')[0]||'';
    const params=new URLSearchParams(query);
    return !(params.get('mode')==='save'&&params.get('ack')==='1');
  });
  return before-state.requestFailures.length;
}

export async function assertRuntimeClean(state,testInfo){
  const payload={
    test:state.test,
    project:state.project,
    pageErrors:state.pageErrors,
    consoleErrors:state.consoleErrors,
    requestFailures:state.requestFailures,
    httpErrors:state.httpErrors
  };
  if(testInfo){
    await testInfo.attach('rc1124-browser-runtime.json',{
      body:Buffer.from(JSON.stringify(payload,null,2)),
      contentType:'application/json'
    });
  }
  expect(payload.pageErrors,'Unbehandelte pageerror-Ereignisse').toEqual([]);
  expect(payload.consoleErrors,'Unerwartete Console-Errors').toEqual([]);
  expect(payload.requestFailures,'Fehlgeschlagene Browser-Requests').toEqual([]);
  expect(payload.httpErrors,'HTTP-5xx bei Kern-Requests').toEqual([]);
}

export async function installE2ESession(page){
  const token=String(process.env.EXPORTHUB_E2E_SESSION_TOKEN||'').trim();
  const userB64=String(process.env.EXPORTHUB_E2E_USER_B64||'').trim();
  const runId=String(process.env.EXPORTHUB_E2E_RUN_ID||'').trim();
  if(!token||!userB64||!runId)throw new Error('RC1139 E2E-Session-Umgebung fehlt.');
  let user;
  try{user=JSON.parse(Buffer.from(userB64,'base64').toString('utf8'))}
  catch(_){throw new Error('RC1139 E2E-Benutzer konnte nicht dekodiert werden.')}
  if(process.env.EXPORTHUB_E2E_LIVE==='1'){
    const base=String(process.env.EXPORTHUB_E2E_BASE_URL||'').trim();
    let target;
    try{target=new URL(base)}catch(_){throw new Error('RC1146 Live-E2E-Basis-URL ist ungültig.')}
    if(target.protocol!=='https:')throw new Error('RC1146 Live-E2E-Cookie darf nur über HTTPS gesetzt werden.');
    await page.context().addCookies([{
      name:'eh_session',
      value:token,
      domain:target.hostname,
      path:'/api',
      httpOnly:true,
      secure:true,
      sameSite:'Strict'
    }]);
  }
  await page.addInitScript(({token,user,runId})=>{
    try{
      sessionStorage.setItem('exporthub_rc301_tab_session',JSON.stringify({
        token,
        user,
        deviceId:'e2e-playwright',
        view:'dashboard',
        savedAt:Date.now(),
        version:'RC1139',
        _e2eRunId:runId
      }));
    }catch(_){}
  },{token,user,runId});
  return{token,user,runId};
}

export function appEntry(){
  return process.env.EXPORTHUB_E2E_ENTRY||'/demo.html';
}