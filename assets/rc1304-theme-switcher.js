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
  function tr(key){
    try{
      if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function'){
        var value=window.ExportHUBI18n.t(key);
        if(value&&value!==key)return value;
      }
    }catch(_){}
    return key;
  }

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
        '<option value="'+CLASSIC+'"></option>'+
        '<option value="'+MODERN+'"></option>'+
        '<option value="'+GLASS+'"></option>'+
        '<option value="'+NEON+'"></option>';
      select.dataset.rc446='1';
      select.dataset.rc1304='1';
    }
    select.options[0].textContent=tr('theme.classic');
    select.options[1].textContent=tr('theme.modernBusiness');
    select.options[2].textContent=tr('theme.glass');
    select.options[3].textContent=tr('theme.neonNight');
    if(select.value!==value)select.value=value;
    select.setAttribute('aria-label',tr('theme.select'));
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
    select.title=tr('theme.select');
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
      wrap.title=tr('theme.select');
      wrap.innerHTML='<span data-rc1304-theme-label></span><select id="ehThemeSelect"></select>';
      wrap.querySelector('[data-rc1304-theme-label]').textContent=tr('theme.label');
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
    wrap.title=tr('theme.select');
    var topLabel=wrap.querySelector('[data-rc1304-theme-label]')||wrap.querySelector('span');
    if(topLabel)topLabel.textContent=tr('theme.label');
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
      box.innerHTML='<span data-rc1304-theme-label></span><select id="ehLoginThemeSelect"></select>';
      box.querySelector('[data-rc1304-theme-label]').textContent=tr('theme.label');
      var anchor=document.getElementById('cleanVersionBadge')||card.querySelector('h1')||card.firstChild;
      if(anchor&&anchor.parentNode===card)anchor.insertAdjacentElement('afterend',box);
      else card.prepend(box);
    }
    var loginLabel=box.querySelector('[data-rc1304-theme-label]')||box.querySelector('span');
    if(loginLabel)loginLabel.textContent=tr('theme.label');
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

  ['exporthub:ready','exporthub:viewchange','exporthub:logout','exporthub:language-changed','pageshow'].forEach(function(name){
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
      Object.freeze({id:CLASSIC,labelKey:'theme.classic'}),
      Object.freeze({id:MODERN,labelKey:'theme.modernBusiness'}),
      Object.freeze({id:GLASS,labelKey:'theme.glass'}),
      Object.freeze({id:NEON,labelKey:'theme.neonNight'})
    ]),
    apply:function(value){return apply(value,true)},
    current:function(){return normalize(document.documentElement.getAttribute('data-eh-design')||read())},
    refresh:refresh
  });
})();
