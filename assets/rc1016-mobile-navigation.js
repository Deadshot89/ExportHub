(function(root){
  'use strict';

  const ID='rc1016MobileMenuBtn';
  const QUERY='(max-width: 640px)';

  function isMobile(){
    try{return !!(root.matchMedia&&root.matchMedia(QUERY).matches);}catch(_){return false;}
  }
  function menuApi(){return root.ExportHUBMobileMenu||null;}
  function menuOpen(){
    const api=menuApi();
    try{if(api&&typeof api.isOpen==='function')return api.isOpen()===true;}catch(_){ }
    return !!(root.document&&root.document.body&&root.document.body.classList.contains('eh-sidebar-open'));
  }
  function sync(button){
    if(!button)return;
    const open=menuOpen();
    button.setAttribute('aria-expanded',open?'true':'false');
    button.setAttribute('aria-label',open?'Menü schließen':'Menü öffnen');
    button.title=open?'Menü schließen':'Menü öffnen';
  }
  function toggle(event){
    if(event){event.preventDefault();event.stopPropagation();}
    const api=menuApi();
    const open=menuOpen();
    try{
      if(api&&typeof api.open==='function'&&typeof api.close==='function'){
        if(open)api.close();else api.open();
      }else if(root.document&&root.document.body){
        root.document.body.classList.toggle('eh-sidebar-open',!open);
      }
    }finally{
      root.setTimeout(()=>sync(root.document&&root.document.getElementById(ID)),0);
    }
  }
  function ensure(){
    const doc=root.document;
    if(!doc||!doc.body)return null;
    let button=doc.getElementById(ID);
    if(!isMobile()){
      if(button)button.remove();
      return null;
    }
    if(!button){
      button=doc.createElement('button');
      button.id=ID;
      button.type='button';
      button.className='ghost eh-menu-btn rc1016-mobile-menu-btn';
      button.textContent='☰';
      button.setAttribute('data-rc1016-mobile-menu','1');
      button.addEventListener('click',toggle,{passive:false});
      doc.body.appendChild(button);
    }
    sync(button);
    return button;
  }
  function schedule(){root.setTimeout(ensure,0);}

  if(root.addEventListener){
    root.addEventListener('resize',schedule);
    ['exporthub:ready','exporthub:rendered','exporthub:viewchange'].forEach(name=>root.addEventListener(name,schedule));
  }
  if(root.document){
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',ensure,{once:true});
    else ensure();
    try{
      const observer=new MutationObserver(()=>{if(isMobile()&&!root.document.getElementById(ID))schedule();});
      observer.observe(root.document.documentElement,{childList:true,subtree:true});
    }catch(_){ }
  }

  root.ExportHUBRC1016MobileNavigation=Object.freeze({ensure,toggle,menuOpen});
})(globalThis);
