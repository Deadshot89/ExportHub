import {chromium} from 'playwright';
const BASE=process.env.RC1018_BROWSER_URL||'http://127.0.0.1:4173/demo.html';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:760}});
try{
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__EXPORTHUB_READY__?.ready===true,null,{timeout:20000});
  const info=await page.evaluate(()=>{
    const visible=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const controls=[...document.querySelectorAll('button,a,[role="button"],[data-view],[data-target],[data-nav]')].filter(visible).slice(0,250).map(el=>({
      tag:el.tagName,
      text:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,120),
      id:el.id||'',
      dataView:el.getAttribute('data-view')||'',
      dataTarget:el.getAttribute('data-target')||'',
      dataNav:el.getAttribute('data-nav')||'',
      href:el.getAttribute('href')||'',
      onclick:el.getAttribute('onclick')||''
    }));
    const globals=Object.getOwnPropertyNames(window).filter(k=>/view|nav|route|render|page|screen/i.test(k)&&typeof window[k]==='function').slice(0,150);
    const customerRefs=[...document.querySelectorAll('*')].filter(el=>{
      const attrs=[...el.attributes||[]].map(a=>`${a.name}=${a.value}`).join(' ');
      return /customers?|kunden/i.test(`${attrs} ${(el.textContent||'').slice(0,160)}`);
    }).slice(0,80).map(el=>({tag:el.tagName,id:el.id||'',cls:el.className||'',attrs:[...el.attributes||[]].map(a=>[a.name,a.value]),text:(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,160),visible:visible(el)}));
    let state=null;try{state=typeof window.__EXPORTHUB_GET_STATE__==='function'?window.__EXPORTHUB_GET_STATE__():window.state||null}catch(_){}
    return{url:location.href,stateView:state?.view||null,globals,controls,customerRefs};
  });
  console.log('RC1018_NAV_DIAGNOSTIC='+JSON.stringify(info));
}finally{await browser.close();}
