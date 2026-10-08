(function(root){
  'use strict';
  const doc=root.document;
  if(!doc)return;
  let observer=null;
  let timer=0;

  function runtime(){return root.ExportHUBPackNotifications||null;}
  function isPackHash(){return String(root.location&&root.location.hash||'').toLowerCase()==='#packmeldungen';}
  function openInbox(){const api=runtime();return !!(api&&typeof api.renderPackInbox==='function'&&api.renderPackInbox());}
  function injectFallbackStyle(){
    if(doc.getElementById('exporthub-pack-nav-fallback-style'))return;
    const style=doc.createElement('style');style.id='exporthub-pack-nav-fallback-style';
    style.textContent='[data-pack-notifications-nav].pack-notification-nav-fallback{position:fixed;right:18px;bottom:18px;z-index:9998;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:10px 14px;border:1px solid #2563eb;border-radius:999px;background:#fff;color:#1e40af;font:800 13px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;box-shadow:0 10px 30px rgba(15,23,42,.18);cursor:pointer}[data-pack-notifications-nav].pack-notification-nav-fallback:hover,[data-pack-notifications-nav].pack-notification-nav-fallback:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(37,99,235,.18),0 10px 30px rgba(15,23,42,.18)}';
    (doc.head||doc.documentElement).appendChild(style);
  }
  function navHost(){
    return doc.querySelector('aside nav,aside [role="navigation"],nav[aria-label],nav,[role="navigation"],aside,.sidebar,.side-nav,.navigation');
  }
  function navTemplate(host){
    if(!host||!host.querySelector)return null;
    return host.querySelector('a[href],button,[data-view],[data-page],[data-nav]');
  }
  function ensureEntry(){
    let existing=doc.querySelector('[data-pack-notifications-nav]');
    if(existing)return existing;
    const host=navHost();
    if(host){
      const template=navTemplate(host);
      const node=doc.createElement(template&&template.tagName==='A'?'a':'button');
      if(template&&template.className)node.className=template.className;
      node.setAttribute('data-pack-notifications-nav','');
      node.setAttribute('aria-label','Packmeldungen');
      if(node.tagName==='A')node.setAttribute('href','#packmeldungen');else node.setAttribute('type','button');
      node.textContent='Packmeldungen';
      host.appendChild(node);
      return node;
    }
    injectFallbackStyle();
    const node=doc.createElement('button');node.type='button';node.className='pack-notification-nav-fallback';node.setAttribute('data-pack-notifications-nav','');node.setAttribute('aria-label','Packmeldungen');node.textContent='Packmeldungen';doc.body.appendChild(node);return node;
  }
  function route(){ensureEntry();if(isPackHash())openInbox();}
  function schedule(){clearTimeout(timer);timer=setTimeout(route,50);}
  function click(event){const node=event.target&&event.target.closest&&event.target.closest('[data-pack-notifications-nav]');if(!node)return;event.preventDefault();event.stopPropagation();if(root.location)root.location.hash='#packmeldungen';openInbox();}
  function install(){
    ensureEntry();
    doc.addEventListener('click',click,true);
    root.addEventListener&&root.addEventListener('hashchange',route);
    if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(schedule);observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});}
    route();return true;
  }
  root.ExportHUBPackNotificationNav=Object.freeze({ensureEntry,openInbox,route,install});
  install();
})(typeof window!=='undefined'?window:globalThis);
