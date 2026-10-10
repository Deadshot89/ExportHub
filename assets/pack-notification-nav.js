(function(root){
  'use strict';
  const doc=root.document;
  if(!doc)return;
  let observer=null;
  let timer=0;

  function runtime(){return root.ExportHUBPackNotifications||null;}
  function openInbox(){const api=runtime();return !!(api&&typeof api.renderPackInbox==='function'&&api.renderPackInbox());}
  function injectFallbackStyle(){
    if(doc.getElementById('exporthub-pack-nav-fallback-style'))return;
    const style=doc.createElement('style');style.id='exporthub-pack-nav-fallback-style';
    style.textContent='[data-pack-notifications-nav].pack-notification-nav-fallback{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:8px 12px;border:1px solid var(--rc990-card-border,#dbe4ee);border-radius:12px;background:var(--rc990-card-bg,#fff);color:var(--rc990-text,#172033);font:800 13px/1.2 Inter,ui-sans-serif,system-ui,sans-serif;box-shadow:0 4px 14px rgba(15,23,42,.08);cursor:pointer}[data-pack-notifications-nav].pack-notification-nav-fallback:hover,[data-pack-notifications-nav].pack-notification-nav-fallback:focus-visible{outline:none;border-color:#60a5fa;box-shadow:0 0 0 3px rgba(59,130,246,.12)}';
    (doc.head||doc.documentElement).appendChild(style);
  }
  function taskAnchor(){
    const direct=doc.querySelector('[data-view="tasks"],[data-page="tasks"],[data-nav="tasks"]');
    if(direct)return direct;
    const candidates=Array.from(doc.querySelectorAll('nav a,nav button,[role="navigation"] a,[role="navigation"] button,.sidebar a,.sidebar button'));
    return candidates.find(node=>String(node.textContent||'').trim()==='Aufgaben')||null;
  }
  function clearIdentity(node){
    if(!node)return;
    node.removeAttribute&&node.removeAttribute('id');
    node.removeAttribute&&node.removeAttribute('data-view');
    node.removeAttribute&&node.removeAttribute('data-page');
    node.removeAttribute&&node.removeAttribute('data-nav');
    node.removeAttribute&&node.removeAttribute('href');
    node.removeAttribute&&node.removeAttribute('aria-current');
    node.removeAttribute&&node.removeAttribute('onclick');
    if(node.classList){node.classList.remove('active','is-active','selected','current');}
    if(node.querySelectorAll)for(const child of node.querySelectorAll('[id]'))child.removeAttribute('id');
  }
  function setPackNavLabel(node){
    if(!node)return;
    const descendants=node.querySelectorAll?Array.from(node.querySelectorAll('*')):[];
    const exact=descendants.reverse().find(child=>String(child.textContent||'').trim()==='Aufgaben');
    if(exact){exact.textContent='Packmeldungen';return;}
    if(node.childNodes){
      for(const child of Array.from(node.childNodes)){
        if(child&&child.nodeType===3&&String(child.nodeValue||'').trim()==='Aufgaben'){child.nodeValue='Packmeldungen';return;}
      }
    }
    const label=doc.createElement('span');label.className='pack-notification-nav-label';label.textContent='Packmeldungen';node.appendChild(label);
  }
  function buildFromExistingMenu(){
    const anchor=taskAnchor();if(!anchor||!anchor.parentNode)return null;
    const node=anchor.cloneNode(true);
    clearIdentity(node);
    node.setAttribute('data-pack-notifications-nav','');
    node.setAttribute('aria-label','Packmeldungen');
    node.setAttribute('title','Packmeldungen');
    if(node.tagName==='BUTTON')node.setAttribute('type','button');
    if(node.tagName==='A')node.setAttribute('role','button');
    setPackNavLabel(node);
    anchor.parentNode.insertBefore(node,anchor.nextSibling);
    return node;
  }
  function ensureEntry(){
    let existing=doc.querySelector('[data-pack-notifications-nav]');
    const anchor=taskAnchor();
    if(existing&&anchor&&existing.classList&&existing.classList.contains('pack-notification-nav-fallback')){existing.remove();existing=null;}
    if(existing)return existing;
    const built=buildFromExistingMenu();if(built)return built;
    injectFallbackStyle();
    const host=doc.querySelector('nav,[role="navigation"],.sidebar,.side-nav,.navigation')||doc.body;
    const node=doc.createElement('button');node.type='button';node.className='pack-notification-nav-fallback';node.setAttribute('data-pack-notifications-nav','');node.setAttribute('aria-label','Packmeldungen');node.textContent='Packmeldungen';host.appendChild(node);return node;
  }
  function mutationNeedsRoute(){
    const existing=doc.querySelector('[data-pack-notifications-nav]');
    if(!existing)return true;
    return !!(existing.classList&&existing.classList.contains('pack-notification-nav-fallback')&&taskAnchor());
  }
  function route(){ensureEntry();}
  function schedule(){clearTimeout(timer);timer=setTimeout(route,50);}
  function click(event){
    const node=event.target&&event.target.closest&&event.target.closest('[data-pack-notifications-nav]');if(!node)return;
    event.preventDefault();event.stopPropagation();if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    openInbox();
  }
  function install(){
    ensureEntry();
    doc.addEventListener('click',click,true);
    if(typeof root.MutationObserver==='function'){observer=new root.MutationObserver(function(){if(mutationNeedsRoute())schedule()});observer.observe(doc.documentElement||doc.body,{childList:true,subtree:true});}
    schedule();return true;
  }
  root.ExportHUBPackNotificationNav=Object.freeze({ensureEntry,openInbox,route,install,setPackNavLabel});
  install();
})(typeof window!=='undefined'?window:globalThis);
