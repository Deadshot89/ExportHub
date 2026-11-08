/* RC1930: Rahmen der neuen Designs (Frost, Graphit, Azur, Stahl, Polar).
   Kopfzeile wie im Entwurf: Suche, Glocke, Benutzerknopf. Sprache, Design, „Mehr“ und Abmelden
   bleiben dieselben Elemente (gleiche Handler) und werden per CSS als Benutzermenü aufgeklappt.
   Die Glocke öffnet den bestehenden Menüpunkt Benachrichtigungen. Keine Daten, keine Logik. */
(function(){
  'use strict';
  if(window.__EXPORTHUB_RC1930_FRAME__)return;
  window.__EXPORTHUB_RC1930_FRAME__=true;
  var d=document,html=d.documentElement,timer=0;
  var BELL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0"/></svg>';
  function tr(key){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function'){var v=window.ExportHUBI18n.t(key);if(v&&v!==key)return v}}catch(_){}return key}
  function on(){return html.hasAttribute('data-eh-palette')&&window.matchMedia&&window.matchMedia('(min-width:1024px)').matches}
  function initials(){
    var el=d.getElementById('profileName'),name=String(el&&el.textContent||'').trim();
    var parts=name.split(/\s+/).filter(Boolean);
    return ((parts[0]||'?').charAt(0)+(parts.length>1?parts[parts.length-1].charAt(0):'')).toUpperCase();
  }
  function bellTarget(){return d.querySelector('#nav [data-view="notifications"]')}
  function setOpen(top,open){
    if(!top)return;
    if(open)top.setAttribute('data-rc1930-open','');else top.removeAttribute('data-rc1930-open');
    var user=d.querySelector('.rc1930-user');if(user)user.setAttribute('aria-expanded',open?'true':'false');
  }
  function ensure(){
    timer=0;
    progress();
    var top=d.querySelector('header.topbar');
    if(!on()){
      if(html.hasAttribute('data-rc1930-frame'))html.removeAttribute('data-rc1930-frame');
      setOpen(top,false);
      return;
    }
    if(!top)return;
    if(!html.hasAttribute('data-rc1930-frame'))html.setAttribute('data-rc1930-frame','');
    var bell=top.querySelector('.rc1930-bell'),user=d.querySelector('.rc1930-user');
    if(!bell){
      bell=d.createElement('button');bell.type='button';bell.className='rc1930-topbtn rc1930-bell';bell.setAttribute('data-rc739-no-loading','1');bell.innerHTML=BELL;
      top.appendChild(bell);
    }
    if(!user){
      user=d.createElement('button');user.type='button';user.className='rc1930-topbtn rc1930-user';user.setAttribute('data-rc739-no-loading','1');user.setAttribute('aria-haspopup','true');user.setAttribute('aria-expanded','false');
      top.appendChild(user);
    }
    // Reihenfolge wie im Entwurf: Suche … Glocke, Benutzer ganz rechts.
    // Menü oben (Frost): der Benutzerknopf sitzt rechts in der Menüleiste, die Glocke rechts neben der Suche
    var navActions=html.getAttribute('data-eh-layout')==='top'?d.querySelector('#rc1820TopNav .rc1820-actions'):null;
    if(navActions){if(user.parentNode!==navActions)navActions.appendChild(user)}
    else if(bell.nextSibling!==user)top.insertBefore(user,bell.nextSibling);
    var search=top.querySelector('.search');
    if(search&&!search.querySelector('.rc1930-kbd')){var kbd=d.createElement('kbd');kbd.className='rc1930-kbd';kbd.setAttribute('aria-hidden','true');search.appendChild(kbd)}
    var kbdEl=search&&search.querySelector('.rc1930-kbd'),kbdText=(/Mac|iPhone|iPad/.test(navigator.platform||'')?'⌘':tr('rc1930.ctrl'))+' K';
    if(kbdEl&&kbdEl.textContent!==kbdText)kbdEl.textContent=kbdText;
    var label=tr('rc1930.userMenu'),bellLabel=tr('rc1930.notifications');
    if(user.getAttribute('aria-label')!==label){user.setAttribute('aria-label',label);user.title=label}
    if(bell.getAttribute('aria-label')!==bellLabel){bell.setAttribute('aria-label',bellLabel);bell.title=bellLabel}
    var ini=initials();if(user.textContent!==ini)user.textContent=ini;
    var target=bellTarget(),alert=!!(target&&target.classList.contains('index236-has-alerts'));
    if(alert!==bell.hasAttribute('data-rc1930-alert')){if(alert)bell.setAttribute('data-rc1930-alert','');else bell.removeAttribute('data-rc1930-alert')}
  }
  /* Fortschrittsring der Leiste „Startklar“: erledigte Schritte der Sendungsmaske (RC1902) zählen */
  function progress(){
    var form=d.getElementById('rc1902ShipmentForm');
    if(!form)return;
    var steps=form.querySelectorAll('.rc1902-step'),done=form.querySelectorAll('.rc1902-step.is-ok').length;
    var nav=form.querySelector('.rc1902-steps');
    if(!html.hasAttribute('data-eh-palette')||!steps.length||!nav){if(form.hasAttribute('data-rc1930-progress'))form.removeAttribute('data-rc1930-progress');return}
    var label=done+'/'+steps.length,pct=Math.round(done/steps.length*100)+'%';
    var summary=nav.querySelector('.rc1902-summary'),title=tr('rc1930.ready');
    if(summary&&summary.getAttribute('data-rc1930-title')!==title)summary.setAttribute('data-rc1930-title',title);
    if(form.getAttribute('data-rc1930-progress')!==label)form.setAttribute('data-rc1930-progress',label);
    if(nav.getAttribute('data-rc1930-label')!==label)nav.setAttribute('data-rc1930-label',label);
    if(form.style.getPropertyValue('--rc1930-p')!==pct)form.style.setProperty('--rc1930-p',pct);
  }
  function schedule(){if(!timer)timer=setTimeout(ensure,60)}
  d.addEventListener('click',function(event){
    var t=event.target;if(!t||!t.closest)return;
    var top=d.querySelector('header.topbar');
    if(t.closest('.rc1930-user')){setOpen(top,!top.hasAttribute('data-rc1930-open'));return}
    if(t.closest('.rc1930-bell')){var b=bellTarget();if(b)b.click();return}
    var open=d.querySelector('header.topbar[data-rc1930-open]');
    if(open&&!t.closest('header.topbar .eh-topbar-tools'))setOpen(open,false);
    else if(open&&t.closest('#logoutBtn,.eh-topbar-more-menu button'))setTimeout(function(){setOpen(open,false)},0);
  });
  d.addEventListener('keydown',function(event){
    // Strg+K / ⌘K springt in die Suche (nur in den neuen Designs)
    if((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&String(event.key).toLowerCase()==='k'&&html.hasAttribute('data-eh-palette')){
      var input=d.getElementById('globalSearch');
      if(input&&input.offsetParent!==null){event.preventDefault();input.focus();if(input.select)input.select()}
      return;
    }
    if(event.key!=='Escape')return;
    var open=d.querySelector('header.topbar[data-rc1930-open]');
    if(!open)return;
    setOpen(open,false);
    var user=d.querySelector('.rc1930-user');if(user)user.focus();
  });
  ['exporthub:ready','exporthub:viewchange','exporthub:designchange','exporthub:language-changed','resize'].forEach(function(name){window.addEventListener(name,schedule)});
  try{new MutationObserver(schedule).observe(html,{attributes:true,attributeFilter:['data-eh-palette']})}catch(_){}
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  setInterval(function(){if(html.hasAttribute('data-eh-palette'))ensure()},4000);
  var pTimer=0;
  try{new MutationObserver(function(){if(!pTimer&&html.hasAttribute('data-eh-palette'))pTimer=setTimeout(function(){pTimer=0;progress()},120)}).observe(d.body||html,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}catch(_){}
  window.rc1930DesignRahmen={refresh:ensure};
})();
