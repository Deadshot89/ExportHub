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

async function visible(locator){
  const count=await locator.count();
  for(let i=count-1;i>=0;i--){
    const item=locator.nth(i);
    if(await item.isVisible().catch(()=>false))return item;
  }
  return null;
}

async function openMenu(page){
  for(const selector of ['#rc1016MobileMenuBtn','#ehMenuBtn']){
    const button=page.locator(selector).first();
    if(await button.count()&&await button.isVisible().catch(()=>false)){
      await button.click({timeout:5000}).catch(()=>{});
      await pause(150);
      return true;
    }
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
  await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true,null,{timeout:25_000});
  await pause(220);
}

export async function openExportHubView(page,module,labels=[],requiredText,options={}){
  const selectors=[
    `button[data-view="${module}"]`,`a[data-view="${module}"]`,`[role="button"][data-view="${module}"]`,
    `button[data-target="${module}"]`,`a[data-target="${module}"]`,`[role="button"][data-target="${module}"]`,
    `button[data-nav="${module}"]`,`a[data-nav="${module}"]`,`[role="button"][data-nav="${module}"]`
  ];

  for(let pass=0;pass<3;pass++){
    for(const selector of selectors){
      const item=await visible(page.locator(selector));
      if(!item)continue;
      await item.click({timeout:7000});
      await pause(300);
      await waitForRequired(page,requiredText);
      return module;
    }

    for(const label of labels){
      const candidates=[
        page.getByRole('button',{name:label,exact:true}),
        page.getByRole('link',{name:label,exact:true}),
        page.getByText(label,{exact:true})
      ];
      for(const locator of candidates){
        const item=await visible(locator);
        if(!item)continue;
        await item.click({timeout:7000});
        await pause(300);
        await waitForRequired(page,requiredText);
        return module;
      }
    }
    await openMenu(page);
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
    /favicon\.ico/i
  ];

  page.on('pageerror',error=>state.pageErrors.push(clean(error?.stack||error?.message||error)));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    const loc=message.location?.()||{};
    const line=clean(`${message.text()} ${loc.url||''}`);
    if(allowConsole.some(rx=>rx.test(line)))return;
    if(process.env.EXPORTHUB_E2E_STATIC==='1'&&/Failed to load resource/i.test(line)&&/\/api\//i.test(line))return;
    state.consoleErrors.push(line);
  });
  page.on('requestfailed',request=>{
    const url=clean(request.url());
    if(/favicon\.ico/i.test(url))return;
    state.requestFailures.push(`${request.method()} ${url} · ${clean(request.failure()?.errorText||'failed')}`);
  });
  page.on('response',response=>{
    if(response.status()<500)return;
    const request=response.request();
    const type=request.resourceType();
    if(!['document','script','stylesheet','xhr','fetch'].includes(type))return;
    state.httpErrors.push(`${response.status()} ${request.method()} ${clean(response.url())}`);
  });
  state.test=testInfo?.title||'';
  state.project=testInfo?.project?.name||'';
  return state;
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

export function appEntry(){
  return process.env.EXPORTHUB_E2E_ENTRY||'/demo.html';
}
