/*
 * ExportHUB360 RC1304 – four-design UI switcher.
 * This intentionally leaves the legacy business logic untouched.
 */
(function(){
  'use strict';
  if(window.__EXPORTHUB_RC1304_DESIGN_SWITCHER__)return;
  window.__EXPORTHUB_RC1304_DESIGN_SWITCHER__=true;

  var STORAGE_KEY='exporthub-ui-design';
  var CLASSIC='classic';
  var MODERN='modern';
  var GLASS='glass';
  var NEON='neon';
  var VALUES=[CLASSIC,MODERN,GLASS,NEON];
  var scheduled=false;

  function normalize(value){
    value=String(value||'').toLowerCase().trim();
    return VALUES.indexOf(value)>=0?value:CLASSIC;
  }

  function read(){
    try{return normalize(localStorage.getItem(STORAGE_KEY)||CLASSIC)}
    catch(_){return CLASSIC}
  }

  function write(value){
    try{localStorage.setItem(STORAGE_KEY,value)}catch(_){}
  }

  function setRoot(value){
    value=normalize(value);
    document.documentElement.setAttribute('data-eh-design',value);
    if(document.body)document.body.setAttribute('data-eh-design',value);
    return value;
  }

  function forceLegacyClassic(){
    try{
      var legacy=window.ExportHUBThemeSwitcher;
      if(legacy&&typeof legacy.current==='function'&&legacy.current()!=='current'&&typeof legacy.apply==='function'){
        legacy.apply('current');
      }
    }catch(_){}
  }

  function options(select,value){
    if(!select)return;
    var ready=select.dataset.rc1304==='1'&&
      select.options&&select.options.length===4&&
      select.options[0].value===CLASSIC&&
      select.options[1].value===MODERN&&
      select.options[2].value===GLASS&&
      select.options[3].value===NEON;
    if(!ready){
      select.innerHTML=
        '<option value="'+CLASSIC+'">Klassisch / Alt</option>'+
        '<option value="'+MODERN+'">Modern Business</option>'+
        '<option value="'+GLASS+'">Glass</option>'+
        '<option value="'+NEON+'">Neon Night</option>';
      select.dataset.rc446='1';
      select.dataset.rc1304='1';
    }
    if(select.value!==value)select.value=value;
    select.setAttribute('aria-label','Design auswählen');
  }

  function replaceLegacySelect(value){
    var old=document.getElementById('ehThemeSelect');
    if(!old)return null;
    if(old.dataset.rc1304==='1'){
      options(old,value);
      return old;
    }
    var select=old.cloneNode(false);
    select.id='ehThemeSelect';
    select.className=old.className;
    select.title=old.title||'Design auswählen';
    options(select,value);
    old.replaceWith(select);
    select.addEventListener('change',function(event){
      event.stopPropagation();
      apply(select.value,true);
    });
    return select;
  }

  function ensureTopbar(value){
    var wrap=document.getElementById('ehThemeSwitch');
    if(!wrap){
      var top=document.querySelector('.topbar');
      if(!top)return null;
      wrap=document.createElement('div');
      wrap.id='ehThemeSwitch';
      wrap.className='eh-theme-switch ghost';
      wrap.title='Design auswählen';
      wrap.innerHTML='<span>Design</span><select id="ehThemeSelect" aria-label="Design auswählen"></select>';
      var optionsBox=top.querySelector('.eh-topbar-options')||top;
      optionsBox.appendChild(wrap);
    }
    var select=replaceLegacySelect(value);
    if(!select){
      select=document.createElement('select');
      select.id='ehThemeSelect';
      wrap.appendChild(select);
      options(select,value);
      select.addEventListener('change',function(){apply(select.value,true)});
    }
    wrap.hidden=false;
    wrap.setAttribute('aria-hidden','false');
    return select;
  }

  function ensureLogin(value){
    var card=document.querySelector('#login .login-card');
    if(!card)return null;
    var box=document.getElementById('rc1304LoginTheme');
    if(!box){
      box=document.createElement('label');
      box.id='rc1304LoginTheme';
      box.className='rc1304-login-theme';
      box.innerHTML='<span>Design</span><select id="ehLoginThemeSelect" aria-label="Design auswählen"></select>';
      var anchor=document.getElementById('cleanVersionBadge')||card.querySelector('h1')||card.firstChild;
      if(anchor&&anchor.parentNode===card)anchor.insertAdjacentElement('afterend',box);
      else card.prepend(box);
    }
    var select=document.getElementById('ehLoginThemeSelect');
    if(select&&select.dataset.rc1304!=='1'){
      options(select,value);
      select.addEventListener('change',function(){apply(select.value,true)});
    }else if(select){
      options(select,value);
    }
    return select;
  }

  function syncControls(value){
    var top=document.getElementById('ehThemeSelect');
    var login=document.getElementById('ehLoginThemeSelect');
    if(top&&top.value!==value)top.value=value;
    if(login&&login.value!==value)login.value=value;
  }

  function apply(value,persist){
    value=normalize(value);
    forceLegacyClassic();
    setRoot(value);
    if(persist)write(value);
    ensureTopbar(value);
    ensureLogin(value);
    syncControls(value);
    try{
      window.dispatchEvent(new CustomEvent('exporthub:designchange',{detail:{design:value}}));
    }catch(_){}
    return value;
  }

  function refresh(){
    scheduled=false;
    var value=read();
    forceLegacyClassic();
    setRoot(value);
    ensureTopbar(value);
    ensureLogin(value);
    syncControls(value);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    Promise.resolve().then(refresh);
  }

  setRoot(read());

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){
      refresh();
      setTimeout(refresh,0);
    },{once:true});
  }else{
    refresh();
    setTimeout(refresh,0);
  }

  ['exporthub:ready','exporthub:viewchange','exporthub:logout','pageshow'].forEach(function(name){
    window.addEventListener(name,schedule);
  });

  window.addEventListener('storage',function(event){
    if(event&&event.key===STORAGE_KEY)refresh();
  });

  var observer=new MutationObserver(function(records){
    for(var i=0;i<records.length;i++){
      if(records[i].type==='childList'&&records[i].addedNodes&&records[i].addedNodes.length){
        schedule();
        break;
      }
    }
  });

  function observe(){
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});
  else observe();

  window.ExportHUBDesignSwitcher=Object.freeze({
    version:'RC1304',
    storageKey:STORAGE_KEY,
    designs:Object.freeze([
      Object.freeze({id:CLASSIC,label:'Klassisch / Alt'}),
      Object.freeze({id:MODERN,label:'Modern Business'}),
      Object.freeze({id:GLASS,label:'Glass'}),
      Object.freeze({id:NEON,label:'Neon Night'})
    ]),
    apply:function(value){return apply(value,true)},
    current:function(){return normalize(document.documentElement.getAttribute('data-eh-design')||read())},
    refresh:refresh
  });
})();
