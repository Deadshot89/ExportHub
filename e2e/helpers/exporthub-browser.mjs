import {expect} from '@playwright/test';

const LEAKS=[
  /window\.open\(['"]about:blank/i,
  /function\s+normalizeActionButtons\s*\(/i,
  /RC824_SOP_DETAILS/,
  /function\s+rc824SopList\s*\(/i,
  /exporthub-rc898-dashboard-only-compact-shipment-inline-avis/i,
  /var\s+rightsModules\s*=/i
];

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function attachRuntimeGuards(page){
  const errors=[],failedRequests=[];
  page.on('pageerror',e=>errors.push('pageerror: '+String(e&&e.message||e)));
  page.on('console',msg=>{
    if(msg.type()!=='error')return;
    const value=msg.text();
    if(/favicon\.ico/i.test(value))return;
    errors.push('console: '+value);
  });
  page.on('requestfailed',req=>{
    if(/favicon\.ico/i.test(req.url()))return;
    failedRequests.push(req.url()+' '+String(req.failure()?.errorText||''));
  });
  return {errors,failedRequests};
}

export async function waitReady(page){
  await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true&&document.body,null,{timeout:20000});
  await pause(250);
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
      const expanded=await button.getAttribute('aria-expanded').catch(()=>null);
      if(expanded!=='true')await button.click({timeout:5000}).catch(()=>{});
      await pause(140);
      return true;
    }
  }
  return false;
}

async function clickCandidate(page,module,labels){
  const selectors=[
    `button[data-view="${module}"]`,`a[data-view="${module}"]`,`[role="button"][data-view="${module}"]`,
    `button[data-target="${module}"]`,`a[data-target="${module}"]`,`[role="button"][data-target="${module}"]`,
    `button[data-nav="${module}"]`,`a[data-nav="${module}"]`,`[role="button"][data-nav="${module}"]`
  ];
  for(const selector of selectors){
    const item=await visible(page.locator(selector));
    if(item){await item.click({timeout:5000});return true}
  }
  for(const label of labels){
    for(const locator of [
      page.getByRole('button',{name:label,exact:true}),
      page.getByRole('link',{name:label,exact:true}),
      page.getByText(label,{exact:true})
    ]){
      const item=await visible(locator);
      if(item){await item.click({timeout:5000});return true}
    }
  }
  return false;
}

export async function openExportHubView(page,module,labels,requiredText){
  for(let pass=0;pass<3;pass++){
    await openMenu(page);
    const clicked=await clickCandidate(page,module,labels);
    if(clicked){
      await pause(350);
      if(requiredText){
        const content=page.locator('#content');
        await expect(content).toContainText(new RegExp(requiredText,'i'));
      }
      return module;
    }
    await openMenu(page);
  }
  throw new Error('Navigation nicht gefunden: '+module+' / '+labels.join(' / '));
}

export async function assertNoSourceLeak(page){
  const body=await page.locator('body').innerText();
  for(const rx of LEAKS)expect(body,'sichtbarer Quellcode: '+rx).not.toMatch(rx);
}

export async function assertNoHorizontalOverflow(page,tolerance=3){
  const dims=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    innerWidth:window.innerWidth
  }));
  expect(dims.scrollWidth,'horizontaler Overflow').toBeLessThanOrEqual(dims.innerWidth+tolerance);
}

export function assertRuntimeClean(runtime){
  expect(runtime.errors,'Browserfehler').toEqual([]);
  expect(runtime.failedRequests,'fehlgeschlagene Requests').toEqual([]);
}
