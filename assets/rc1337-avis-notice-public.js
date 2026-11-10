/* RC1337 – Public AVIS closure notice: optional, non-interactive, reduced-motion safe. */
(function(w,d){
 'use strict';
 if(w.__EXPORTHUB_RC1337_PUBLIC_NOTICE__)return;
 w.__EXPORTHUB_RC1337_PUBLIC_NOTICE__=true;
 var last='',inFlight=false;
 function q(v){return String(v==null?'':v).trim()}
 function language(){var fromUrl='';try{fromUrl=new URL(w.location.href).searchParams.get('lang')||''}catch(_){}
  var fromI18n='';try{fromI18n=w.ExportHUBI18n&&w.ExportHUBI18n.language&&w.ExportHUBI18n.language()||''}catch(_){}
  return (fromUrl||fromI18n||d.documentElement.lang||'de').split('-')[0].toLowerCase();
 }
 function el(tag,className,txt){var n=d.createElement(tag);if(className)n.className=className;if(txt!=null)n.textContent=txt;return n}
 function installCss(){
  if(d.getElementById('rc1337AvisNoticeCss'))return;
  var s=el('style');s.id='rc1337AvisNoticeCss';
  s.textContent='.rc1337-notice{position:relative;overflow:hidden;border:1px solid #b9d9e1;border-left:4px solid #367b9e;border-radius:16px;padding:18px 20px;background:linear-gradient(125deg,#f0f7f9,#fff);box-shadow:0 6px 18px rgba(15,45,70,.06);color:#203a4e}.rc1337-notice h2{font-size:17px;margin:0 0 8px;color:#174a67;line-height:1.35}.rc1337-notice p{font-size:13px;line-height:1.55;margin:0 0 12px}.rc1337-notice dl{display:grid;gap:8px;margin:0 0 12px}.rc1337-notice dl>div{display:flex;justify-content:space-between;gap:14px;border-bottom:1px solid #d7e7eb;padding-bottom:7px}.rc1337-notice dt{color:#526d7f;font-size:12px}.rc1337-notice dd{margin:0;font-size:13px;font-weight:700;text-align:right}.rc1337-notice .rc1337-greeting{margin:0;color:#42677b;font-size:12px}.rc1337-decor{position:absolute;right:25px;top:7px;font-size:21px;color:#75a8bb;opacity:.65;pointer-events:none;user-select:none;animation:rc1337-drift 9s ease-in-out infinite alternate}.rc1337-decor.second{right:65px;top:25px;font-size:12px;animation-delay:-5s;opacity:.35}@keyframes rc1337-drift{from{transform:translateY(-3px) rotate(-9deg)}to{transform:translateY(12px) rotate(15deg)}}@media(max-width:600px){.rc1337-notice{padding:14px}.rc1337-notice dl>div{display:block}.rc1337-notice dd{text-align:left;margin-top:3px}}@media(prefers-reduced-motion:reduce){.rc1337-decor{animation:none!important}}';
  d.head.appendChild(s);
 }
 function render(model){
  var current=d.getElementById('rc1337AvisNotice');if(current)current.remove();
  if(!model||!model.title)return;
  installCss();
  var main=d.querySelector('main.portal');if(!main)return;
  var section=el('section','rc1337-notice');section.id='rc1337AvisNotice';section.setAttribute('role','note');section.setAttribute('aria-label',model.title);
  section.appendChild(el('h2','',model.title));section.appendChild(el('p','',model.intro));
  var dl=el('dl');
  function item(label,value){var r=el('div');r.appendChild(el('dt','',label));r.appendChild(el('dd','',value));dl.appendChild(r)}
  item(model.lastLabel,model.lastPickup);
  item(model.closedLabel,model.closedFrom+' – '+model.closedUntil);
  item(model.firstLabel,model.firstPickup);
  section.appendChild(dl);section.appendChild(el('p','rc1337-greeting',model.greeting));
  if(model.animate){var a=el('span','rc1337-decor','❄');a.setAttribute('aria-hidden','true');section.appendChild(a);var b=el('span','rc1337-decor second','❄');b.setAttribute('aria-hidden','true');section.appendChild(b)}
  var status=d.getElementById('status');main.insertBefore(section,status||main.children[1]||null);
 }
 function refresh(){
  var lang=language();if(inFlight&&lang===last)return;last=lang;inFlight=true;
  w.fetch('/api/avis-notice?lang='+encodeURIComponent(lang),{credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}})
   .then(function(r){if(!r.ok)throw new Error('Notice unavailable');return r.json()})
   .then(function(data){if(lang===last)render(data&&data.notice)})
   .catch(function(){if(lang===last)render(null)})
   .finally(function(){inFlight=false});
 }
 function boot(){refresh();w.addEventListener('exporthub:language-changed',refresh);w.addEventListener('popstate',refresh)}
 if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window,document);