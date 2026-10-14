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
  var refreshTimer=0;
  var RC1532_COMPLETION_STYLE_ID='exporthub-rc1532-theme-completion';
  var RC1532_COMPLETION_CSS=String.raw`
/* RC1532 THEME COMPLETION PASS
   Completes the visual component matrix for Modern, Glass and Neon.
   Klassisch remains untouched because every public selector is explicitly scoped. */
html[data-eh-design]:not([data-eh-design="classic"]) body{
  --eh-sem-success:#15803d;
  --eh-sem-warning:#b45309;
  --eh-sem-danger:#b91c1c;
  --eh-sem-info:#0369a1;
  --eh-menu-bg:var(--pc-surface,#fff);
  --eh-menu-line:var(--pc-line,#dce5ef);
  --eh-menu-text:var(--pc-text,#172033);
  --eh-menu-shadow:var(--pc-shadow-float,0 22px 55px rgba(15,23,42,.18));
  --eh-menu-radius:10px;
  --eh-tooltip-bg:#172033;
  --eh-tooltip-text:#fff;
}
html[data-eh-design="modern"] body{
  --eh-menu-radius:10px;
  --eh-menu-bg:#fff;
  --eh-menu-line:#d8e2ec;
  --eh-menu-text:#172033;
  --eh-tooltip-bg:#172033;
  --eh-tooltip-text:#f8fafc;
}
html[data-eh-design="glass"] body{
  --eh-menu-radius:14px;
  --eh-menu-bg:rgba(255,255,255,.96);
  --eh-menu-line:#d5e0ea;
  --eh-menu-text:#24364b;
  --eh-tooltip-bg:rgba(20,38,61,.96);
  --eh-tooltip-text:#f8fbff;
}
html[data-eh-design="neon"] body{
  --eh-menu-radius:7px;
  --eh-menu-bg:#0b1728;
  --eh-menu-line:#294866;
  --eh-menu-text:#dcecff;
  --eh-tooltip-bg:#06101d;
  --eh-tooltip-text:#bff6ff;
}

html[data-eh-design]:not([data-eh-design="classic"]) :is(
  button,a,input,select,textarea,[tabindex],[role="button"],[role="tab"],[role="switch"]
):focus-visible{
  outline:3px solid var(--pc-focus,#60a5fa)!important;
  outline-offset:2px!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) :is(
  button,input,select,textarea,.btn,[role="button"],[role="switch"]
):is(:disabled,[disabled],[aria-disabled="true"]){
  opacity:.5!important;
  cursor:not-allowed!important;
  filter:saturate(.55)!important;
  box-shadow:none!important;
  transform:none!important;
}

html[data-eh-design]:not([data-eh-design="classic"]) #content :is(input[type="checkbox"],input[type="radio"]){
  width:18px!important;
  min-width:18px!important;
  max-width:18px!important;
  height:18px!important;
  min-height:18px!important;
  margin:0 7px 0 0!important;
  padding:0!important;
  accent-color:var(--pc-primary,#2563eb)!important;
  box-shadow:none!important;
  vertical-align:-3px!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content input[type="radio"]{border-radius:50%!important}
html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.check,.checkbox,.radio,.choice,label:has(>input[type="checkbox"]),label:has(>input[type="radio"])){
  display:inline-flex!important;
  align-items:center!important;
  gap:6px!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) :is(.switch,.toggle,.toggle-switch,[role="switch"]){
  position:relative!important;
  min-width:42px!important;
  min-height:24px!important;
  border:1px solid var(--pc-line-strong,#c4d1df)!important;
  border-radius:999px!important;
  background:var(--pc-surface-3,#eef3f8)!important;
  transition:background .16s ease,border-color .16s ease,box-shadow .16s ease!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) :is(.switch,.toggle,.toggle-switch,[role="switch"])[aria-checked="true"],
html[data-eh-design]:not([data-eh-design="classic"]) :is(.switch,.toggle,.toggle-switch,[role="switch"]).active{
  border-color:var(--pc-primary,#2563eb)!important;
  background:var(--pc-primary,#2563eb)!important;
}

html[data-eh-design]:not([data-eh-design="classic"]) :is(
  .dropdown-menu,.context-menu,.popover,[role="menu"],[role="listbox"]
){
  z-index:1100!important;
  min-width:180px!important;
  max-width:min(420px,calc(100vw - 24px))!important;
  padding:6px!important;
  border:1px solid var(--eh-menu-line)!important;
  border-radius:var(--eh-menu-radius)!important;
  background:var(--eh-menu-bg)!important;
  color:var(--eh-menu-text)!important;
  box-shadow:var(--eh-menu-shadow)!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) :is(
  .dropdown-menu,.context-menu,.popover,[role="menu"],[role="listbox"]
) :is(a,button,[role="menuitem"],[role="option"]){
  display:flex!important;
  align-items:center!important;
  width:100%!important;
  min-height:36px!important;
  padding:7px 9px!important;
  border:0!important;
  border-radius:calc(var(--eh-menu-radius) - 4px)!important;
  background:transparent!important;
  color:inherit!important;
  text-align:left!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) :is(
  .dropdown-menu,.context-menu,.popover,[role="menu"],[role="listbox"]
) :is(a,button,[role="menuitem"],[role="option"]):is(:hover,[aria-selected="true"],[aria-current="true"]){
  background:var(--pc-primary-soft,#e8f1ff)!important;
  color:var(--pc-title,#0f172a)!important;
}

html[data-eh-design]:not([data-eh-design="classic"]) :is(.tooltip,[role="tooltip"]){
  max-width:320px!important;
  padding:7px 9px!important;
  border:1px solid color-mix(in srgb,var(--eh-tooltip-text) 16%,transparent)!important;
  border-radius:8px!important;
  background:var(--eh-tooltip-bg)!important;
  color:var(--eh-tooltip-text)!important;
  box-shadow:0 10px 28px rgba(15,23,42,.20)!important;
  font-size:11px!important;
  line-height:1.35!important;
  letter-spacing:.005em!important;
}

html[data-eh-design]:not([data-eh-design="classic"]) #content :is(
  .dropzone,.upload-zone,.upload-area,.file-drop,.file-upload
){
  min-height:110px!important;
  padding:18px!important;
  border:1.5px dashed var(--pc-line-strong,#c4d1df)!important;
  border-radius:14px!important;
  background:var(--pc-surface-2,#f8fafc)!important;
  color:var(--pc-muted,#64748b)!important;
  text-align:center!important;
  transition:border-color .16s ease,background .16s ease,box-shadow .16s ease!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content :is(
  .dropzone,.upload-zone,.upload-area,.file-drop,.file-upload
):is(:hover,.is-dragover,[data-dragover="true"]){
  border-color:var(--pc-primary,#2563eb)!important;
  background:var(--pc-primary-soft,#e8f1ff)!important;
  box-shadow:0 0 0 3px color-mix(in srgb,var(--pc-primary,#2563eb) 12%,transparent)!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content input[type="file"]{
  min-height:42px!important;
  padding:6px!important;
  border-radius:10px!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content input[type="file"]::file-selector-button{
  min-height:30px!important;
  margin-right:10px!important;
  padding:5px 10px!important;
  border:1px solid var(--pc-line-strong,#c4d1df)!important;
  border-radius:8px!important;
  background:var(--pc-surface-2,#f8fafc)!important;
  color:var(--pc-text,#172033)!important;
  font:inherit!important;
  font-weight:750!important;
}

html[data-eh-design]:not([data-eh-design="classic"]) #content :is(input[type="date"],input[type="datetime-local"],input[type="time"]){
  font-variant-numeric:tabular-nums!important;
}
html[data-eh-design="modern"] #content :is(input[type="date"],input[type="datetime-local"],input[type="time"]),
html[data-eh-design="glass"] #content :is(input[type="date"],input[type="datetime-local"],input[type="time"]){color-scheme:light}
html[data-eh-design="neon"] #content :is(input[type="date"],input[type="datetime-local"],input[type="time"]){color-scheme:dark}

html[data-eh-design]:not([data-eh-design="classic"]) #content progress{
  width:100%!important;
  height:10px!important;
  overflow:hidden!important;
  border:0!important;
  border-radius:999px!important;
  background:var(--pc-surface-3,#eef3f8)!important;
  accent-color:var(--pc-primary,#2563eb)!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.progress,.progress-track){
  overflow:hidden!important;
  min-height:8px!important;
  border-radius:999px!important;
  background:var(--pc-surface-3,#eef3f8)!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.progress-bar,.progress-fill){
  min-height:8px!important;
  border-radius:inherit!important;
  background:linear-gradient(90deg,var(--pc-primary,#2563eb),var(--pc-primary-2,#06b6d4))!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.spinner,.loader){
  display:inline-block!important;
  width:22px!important;
  height:22px!important;
  border:3px solid var(--pc-line,#dce5ef)!important;
  border-top-color:var(--pc-primary,#2563eb)!important;
  border-radius:50%!important;
  animation:eh1532spin .8s linear infinite!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content .skeleton{
  position:relative!important;
  overflow:hidden!important;
  min-height:16px!important;
  border-radius:8px!important;
  background:linear-gradient(90deg,var(--pc-surface-3,#eef3f8),var(--pc-surface-2,#f8fafc),var(--pc-surface-3,#eef3f8))!important;
  background-size:220% 100%!important;
  animation:eh1532skeleton 1.25s ease-in-out infinite!important;
}
@keyframes eh1532spin{to{transform:rotate(360deg)}}
@keyframes eh1532skeleton{to{background-position:-220% 0}}

html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.okbox,.badbox,.notice,.infobox){
  min-height:0!important;
  padding:11px 13px!important;
  border:1px solid currentColor!important;
  border-left-width:4px!important;
  border-radius:10px!important;
  box-shadow:none!important;
  font-weight:650!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content .okbox{color:var(--eh-sem-success)!important;background:#f0fdf4!important}
html[data-eh-design]:not([data-eh-design="classic"]) #content .badbox{color:var(--eh-sem-danger)!important;background:#fff1f2!important}
html[data-eh-design]:not([data-eh-design="classic"]) #content .notice{color:var(--eh-sem-warning)!important;background:#fffbeb!important}
html[data-eh-design]:not([data-eh-design="classic"]) #content .infobox{color:var(--eh-sem-info)!important;background:#f0f9ff!important}

html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.chart-container,.report-chart,.chart-card,.kpi-chart,.diagram){
  min-width:0!important;
  padding:14px!important;
  border:1px solid var(--pc-line,#dce5ef)!important;
  border-radius:14px!important;
  background:var(--pc-surface,#fff)!important;
  box-shadow:var(--pc-shadow-soft,0 6px 18px rgba(15,23,42,.06))!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.chart-container,.report-chart,.chart-card,.kpi-chart,.diagram) :is(svg,canvas){max-width:100%!important}

html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.breadcrumb,.breadcrumbs){
  display:flex!important;
  align-items:center!important;
  gap:6px!important;
  flex-wrap:wrap!important;
  margin:0 0 12px!important;
  color:var(--pc-muted,#64748b)!important;
  font-size:12px!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.pagination,.pager){
  display:flex!important;
  align-items:center!important;
  justify-content:flex-end!important;
  gap:6px!important;
  flex-wrap:wrap!important;
  margin-top:12px!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.pagination,.pager) :is(button,a){
  min-width:34px!important;
  min-height:34px!important;
  padding:5px 8px!important;
  border:1px solid var(--pc-line,#dce5ef)!important;
  border-radius:8px!important;
  background:var(--pc-surface,#fff)!important;
  color:var(--pc-text,#172033)!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content details{
  border:1px solid var(--pc-line,#dce5ef)!important;
  border-radius:12px!important;
  background:var(--pc-surface,#fff)!important;
  overflow:hidden!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) #content details>summary{
  cursor:pointer!important;
  padding:11px 13px!important;
  font-weight:800!important;
  color:var(--pc-title,#0f172a)!important;
  background:var(--pc-surface-2,#f8fafc)!important;
}
html[data-eh-design]:not([data-eh-design="classic"]) :is(footer,.footer,#footer){
  margin-top:20px!important;
  padding:14px 16px!important;
  border-top:1px solid var(--pc-line,#dce5ef)!important;
  color:var(--pc-muted,#64748b)!important;
  background:transparent!important;
  font-size:12px!important;
}

html[data-eh-design="modern"] #content :is(.dropzone,.upload-zone,.upload-area,.file-drop,.file-upload){
  border-color:#9bbce0!important;
  background:#f7fbff!important;
}
html[data-eh-design="modern"] :is(.dropdown-menu,.context-menu,.popover,[role="menu"],[role="listbox"]){
  box-shadow:0 18px 42px rgba(15,23,42,.14)!important;
}
html[data-eh-design="modern"] #content :is(.chart-container,.report-chart,.chart-card,.kpi-chart,.diagram){
  border-top:3px solid #2563eb!important;
}

html[data-eh-design="glass"] :is(.dropdown-menu,.context-menu,.popover,[role="menu"],[role="listbox"]){
  background:rgba(255,255,255,.96)!important;
  backdrop-filter:blur(18px) saturate(125%)!important;
  box-shadow:0 18px 44px rgba(43,57,76,.16)!important;
}
html[data-eh-design="glass"] #content :is(.dropzone,.upload-zone,.upload-area,.file-drop,.file-upload){
  border-color:#9fb7cf!important;
  background:#fff!important;
  box-shadow:0 5px 16px rgba(43,57,76,.05)!important;
}
html[data-eh-design="glass"] #content :is(.chart-container,.report-chart,.chart-card,.kpi-chart,.diagram){
  background:#fff!important;
  border-color:#d8e2ec!important;
  box-shadow:0 6px 18px rgba(51,65,85,.07)!important;
}

html[data-eh-design="neon"] :is(.dropdown-menu,.context-menu,.popover,[role="menu"],[role="listbox"]){
  border-color:#294866!important;
  background:#0b1728!important;
  box-shadow:0 22px 52px rgba(0,0,0,.48),0 0 20px rgba(34,211,238,.06)!important;
}
html[data-eh-design="neon"] :is(.tooltip,[role="tooltip"]){
  border-color:#235373!important;
  background:#06101d!important;
  color:#bff6ff!important;
  box-shadow:0 10px 30px rgba(0,0,0,.48),0 0 14px rgba(34,211,238,.08)!important;
}
html[data-eh-design="neon"] #content :is(.dropzone,.upload-zone,.upload-area,.file-drop,.file-upload){
  border-color:#2e5777!important;
  background:#0b1728!important;
  color:#8fa8c0!important;
}
html[data-eh-design="neon"] #content :is(.okbox,.badbox,.notice,.infobox){background:#0b1728!important}
html[data-eh-design="neon"] #content .okbox{color:#86efac!important;border-color:#236443!important}
html[data-eh-design="neon"] #content .badbox{color:#fda4af!important;border-color:#7f2d3b!important}
html[data-eh-design="neon"] #content .notice{color:#fcd34d!important;border-color:#785d1e!important}
html[data-eh-design="neon"] #content .infobox{color:#7dd3fc!important;border-color:#245d78!important}
html[data-eh-design="neon"] #content :is(.chart-container,.report-chart,.chart-card,.kpi-chart,.diagram){
  border-color:#1d3b59!important;
  background:#0b1728!important;
  box-shadow:inset 2px 0 0 rgba(34,211,238,.45),0 10px 26px rgba(0,0,0,.24)!important;
}
html[data-eh-design="neon"] #content details{border-radius:8px!important;border-color:#294866!important;background:#0b1728!important}
html[data-eh-design="neon"] #content details>summary{background:#10243a!important;color:#dcecff!important}
html[data-eh-design="neon"] :is(footer,.footer,#footer){border-top-color:#1d3855!important;color:#7896b2!important}

@media(max-width:760px){
  html[data-eh-design]:not([data-eh-design="classic"]) :is(.dropdown-menu,.context-menu,.popover,[role="menu"],[role="listbox"]){
    max-width:calc(100vw - 16px)!important;
    max-height:min(70vh,520px)!important;
    overflow:auto!important;
  }
  html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.chart-container,.report-chart,.chart-card,.kpi-chart,.diagram){
    overflow-x:auto!important;
    -webkit-overflow-scrolling:touch!important;
  }
  html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.pagination,.pager){
    justify-content:flex-start!important;
    flex-wrap:wrap!important;
  }
  html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.dropzone,.upload-zone,.upload-area,.file-drop,.file-upload){
    min-height:92px!important;
    padding:14px!important;
  }
}
@media(prefers-reduced-motion:reduce){
  html[data-eh-design]:not([data-eh-design="classic"]) #content :is(.spinner,.loader,.skeleton){animation:none!important}
}
`;

  function ensureCompletionStyles(){
    if(document.getElementById(RC1532_COMPLETION_STYLE_ID))return;
    var style=document.createElement('style');
    style.id=RC1532_COMPLETION_STYLE_ID;
    style.setAttribute('data-rc1532','theme-completion');
    style.textContent=RC1532_COMPLETION_CSS;
    (document.head||document.documentElement).appendChild(style);
  }

  function tr(key){
    try{
      if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function'){
        var value=window.ExportHUBI18n.t(key);
        if(value&&value!==key)return value;
      }
    }catch(_){}
    return key;
  }
  function setText(node,value){
    if(!node)return;
    value=String(value==null?'':value);
    if(node.textContent!==value)node.textContent=value;
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
    if(document.documentElement.getAttribute('data-eh-design')!==value)document.documentElement.setAttribute('data-eh-design',value);
    if(document.body&&document.body.getAttribute('data-eh-design')!==value)document.body.setAttribute('data-eh-design',value);
    return value;
  }

  function protectVersionBadge(){
    var badge=document.getElementById('cleanVersionBadge');
    if(!badge)return false;
    if(badge.getAttribute('data-i18n-ignore')==='1')return true;
    badge.setAttribute('data-i18n-ignore','1');
    try{
      if(window.ExportHUBBuild&&typeof window.ExportHUBBuild.applyVersion==='function'){
        window.ExportHUBBuild.applyVersion();
      }else if(window.ExportHUBBuild&&typeof window.ExportHUBBuild.apply==='function'){
        window.ExportHUBBuild.apply();
      }
      if(window.ExportHUBVisibleRelease1193&&typeof window.ExportHUBVisibleRelease1193.patch==='function'){
        window.ExportHUBVisibleRelease1193.patch();
      }
    }catch(_){}
    return true;
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
    setText(select.options[0],tr('theme.classic'));
    setText(select.options[1],tr('theme.modernBusiness'));
    setText(select.options[2],tr('theme.glass'));
    setText(select.options[3],tr('theme.neonNight'));
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
      setText(wrap.querySelector('[data-rc1304-theme-label]'),tr('theme.label'));
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
    setText(topLabel,tr('theme.label'));
    wrap.hidden=false;
    wrap.setAttribute('aria-hidden','false');
    return select;
  }

  function ensureLogin(value){
    var box=document.getElementById('rc1304LoginTheme');
    var existingSelect=document.getElementById('ehLoginThemeSelect');
    if(box&&existingSelect){
      var existingLabel=box.querySelector('[data-rc1304-theme-label]')||box.querySelector('span');
      setText(existingLabel,tr('theme.label'));
      options(existingSelect,value);
      return existingSelect;
    }
    var card=document.querySelector('#login .login-card');
    if(!card)return null;
    if(!box){
      box=document.createElement('label');
      box.id='rc1304LoginTheme';
      box.className='rc1304-login-theme';
      box.innerHTML='<span data-rc1304-theme-label></span><select id="ehLoginThemeSelect"></select>';
      setText(box.querySelector('[data-rc1304-theme-label]'),tr('theme.label'));
      var anchor=document.getElementById('cleanVersionBadge')||card.querySelector('h1')||card.firstChild;
      if(anchor&&anchor.parentNode===card)anchor.insertAdjacentElement('afterend',box);
      else card.prepend(box);
    }
    var loginLabel=box.querySelector('[data-rc1304-theme-label]')||box.querySelector('span');
    setText(loginLabel,tr('theme.label'));
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
    var value=read();
    forceLegacyClassic();
    setRoot(value);
    protectVersionBadge();
    ensureTopbar(value);
    ensureLogin(value);
    syncControls(value);
  }

  function schedule(){
    if(refreshTimer)clearTimeout(refreshTimer);
    refreshTimer=setTimeout(function(){
      refreshTimer=0;
      refresh();
    },40);
  }

  ensureCompletionStyles();
  setRoot(read());

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',refresh,{once:true});
  }else{
    refresh();
  }

  ['exporthub:ready','exporthub:viewchange','exporthub:logout','exporthub:language-changed','pageshow'].forEach(function(name){
    window.addEventListener(name,schedule);
  });

  window.addEventListener('storage',function(event){
    if(event&&event.key===STORAGE_KEY)refresh();
  });

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
