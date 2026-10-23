/* ExportHUB360 RC1579 – Menü mit aufklappbaren Bereichen und einheitlichem Icon-Satz.
   Die Menüknöpfe bleiben unverändert und in kanonischer Reihenfolge direkt in #nav (RC325 prüft das);
   Bereiche, Reihenfolge und Icons entstehen ausschließlich über CSS (order, mask-image) und eigene Kopfzeilen.
   IT: Fehlerdiagnose, Release-Center und Update stehen als ein Menüpunkt „IT“ (Stellvertreter-Knopf) im Menü;
   ihre echten Knöpfe bleiben in #nav, werden ausgeblendet und von den Reitern oben im Inhalt angesteuert. */
(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBMenu1579)return;
var VERSION='RC1579',STORE='exporthub-rc1579-menu-open',STYLE_ID='exporthub-rc1579-menu-map',IT_STORE='exporthub-rc1579-it-tab';

// Lucide-Icons (ISC-Lizenz), 24×24, Strichstärke 2
var ICONS={
 dashboard:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
 notifications:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
 tasks:'<path d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"/><path d="m9 11 3 3L22 4"/>',
 planning:'<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
 taskdetail:'<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
 shipment:'<path d="M16 16h6M19 13v6"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15M3.29 7 12 12l8.71-5M12 22V12"/>',
 abd:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>',
 shipmentoverview:'<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><path d="M14 4h7M14 9h7M14 15h7M14 20h7"/>',
 shipmentsearch:'<path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15M3.29 7 12 12l8.71-5M12 22V12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/>',
 cmr:'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
 pickupcalendar:'<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M16 2v4M8 2v4M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
 warehouse:'<path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z"/><path d="M6 18h12M6 14h12"/><rect width="12" height="12" x="6" y="10"/>',
 pallet:'<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
 shippingcosts:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 12h5"/><path d="M16 9.5a4 4 0 1 0 0 5.2"/>',
 customerfolder:'<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/><circle cx="12" cy="12.5" r="2"/><path d="M8.5 17.5a3.5 3.5 0 0 1 7 0"/>',
 customs:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
 sop:'<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
 academy:'<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
 inspections:'<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76z"/><path d="m9 12 2 2 4-4"/>',
 ideas:'<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
 reports:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
 history:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
 archive:'<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
 rights:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 teamfile:'<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
 packaging:'<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
 settings:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
 privacy:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
 update:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
 release:'<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
 diagnostics:'<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
 // Bereichs-Icons der Kopfzeilen
 'section-tasks':'<rect width="6" height="6" x="3" y="5" rx="1"/><path d="m3 17 2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
 'section-shipments':'<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12M3.29 7 12 12l8.71-5M7.5 4.27l9 5.15"/>',
 'section-logistics':'<path d="M12 12H5a2 2 0 0 0-2 2v5"/><circle cx="13" cy="19" r="2"/><circle cx="5" cy="19" r="2"/><path d="M8 19h3m5-17v17h6M6 12V7c0-1.1.9-2 2-2h3l5 5"/>',
 'section-knowledge':'<path d="m16 6 4 14M12 6v14M8 8v12M4 4v16"/>',
 'section-reports':'<path d="M21 12c.55 0 1-.45.95-1A10 10 0 0 0 13 2.05c-.55-.05-1 .4-1 .95v8a1 1 0 0 0 1 1z"/><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>',
 'section-admin':'<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>'
};
ICONS.customers=ICONS.customerfolder;
ICONS.selfcorrect='<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>';
ICONS.it='<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/><path d="m7 10 2 2-2 2M11 14h4"/>';
ICONS.packnotifications='<path d="m16 16 2 2 4-4"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15M3.29 7 12 12l8.71-5M12 22V12"/>';

var SECTIONS=[
 // Packmeldungen direkt unter dem Dashboard: der Packtisch-Eingang ist der Start jeder Sendung
 {key:'start',flat:true,accent:'#2563eb',views:['dashboard','packnotifications','notifications']},
 {key:'tasks',accent:'#7c3aed',views:['tasks','planning','taskdetail']},
 {key:'shipments',accent:'#0284c7',views:['shipment','abd','shipmentoverview','shipmentsearch','cmr','pickupcalendar']},
 {key:'logistics',accent:'#ea580c',views:['warehouse','pallet','shippingcosts']},
 {key:'knowledge',accent:'#0d9488',views:['customerfolder','customers','customs','sop','academy','inspections','ideas']},
 {key:'reports',accent:'#4f46e5',views:['reports','history','archive']},
 {key:'admin',accent:'#64748b',views:['rights','teamfile','packaging','settings','privacy','it','diagnostics','release','update']}
];
var SECTION_OF={},FLAT={};SECTIONS.forEach(function(s){if(s.flat)FLAT[s.key]=true;s.views.forEach(function(v){SECTION_OF[v]=s.key})});
SECTION_OF.packagingmasterdata='admin';
var DEFAULT_OPEN=['tasks','shipments'];
var IT_VIEWS=['diagnostics','release','update'];

var nav=null,observer=null,scheduled=false,syncing=false,open=null,lastActiveSection='',contentObserver=null,lastUserSig=null;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function packs(){return w.ExportHUBMenu1579I18n&&w.ExportHUBMenu1579I18n.packs||{}}
function lang(){var l='';try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function')l=q(w.ExportHUBI18n.language()).toLowerCase()}catch(_){}if(!packs()[l]){var sel=d.getElementById('languageSelect');l=q(sel&&sel.value).toLowerCase()}return packs()[l]?l:'de'}
function t(key,vars){var p=packs(),v=(p[lang()]||{})[key];if(v==null)v=(p.de||{})[key];v=String(v==null?key:v);if(vars)Object.keys(vars).forEach(function(k){v=v.split('{'+k+'}').join(vars[k])});return v}
function uri(markup){return 'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+markup+'</svg>')+'")'}
function viewOf(el){return q(el&&el.getAttribute&&(el.getAttribute('data-index321-view')||el.getAttribute('data-view')||el.getAttribute('data-rc626-view')))}
function shown(el){return !!el&&!el.hidden&&el.style.display!=='none'}

function readOpen(){var raw=null,list=null;try{raw=w.localStorage&&w.localStorage.getItem(STORE);if(raw)list=JSON.parse(raw)}catch(_){list=null}if(!Array.isArray(list))return DEFAULT_OPEN.slice();return list.filter(function(k){return typeof k==='string'&&!FLAT[k]})}
function writeOpen(){try{w.localStorage&&w.localStorage.setItem(STORE,JSON.stringify(open))}catch(_){}}

// Reihenfolge, Bereichsfarbe, Icons und Einklappen als ein generiertes Stylesheet
function css(){
 var N='#nav#nav#nav',R=N+'[data-rc1579-ready]',out=[];
 SECTIONS.forEach(function(s,si){
  var base=(si+1)*100;
  if(!s.flat)out.push(N+'>.rc1579-section[data-rc1579-section="'+s.key+'"]{order:'+base+'!important;--rc1579-accent:'+s.accent+';--rc1579-icon:'+uri(ICONS['section-'+s.key])+'}');
  s.views.forEach(function(v,vi){
   var item=itemSel(v),sel=N+'>'+item;
   out.push(sel+'{order:'+(base+vi+1)+'!important;--menu-accent:'+s.accent+'!important}');
   out.push(sel+' .index308-nav-icon{--menu-accent:'+s.accent+'!important;--rc1579-icon:'+uri(ICONS[v])+'}');
   if(IT_VIEWS.indexOf(v)>=0)out.push(R+'>'+item+'{display:none!important}');
   if(!s.flat){
    out.push(sel+'{--rc1579-sub:1}');
    out.push(R+':not([data-rc1579-open~="'+s.key+'"])>'+item+'{display:none!important}');
   }
  });
 });
 // Rechte: ein gesperrter Menüpunkt (RC325 setzt hidden und aria-hidden) bleibt unsichtbar, auch wenn ein Design,
 // ein Stellvertreter (copyLook setzt display inline) oder ein anderes Modul display überschreibt
 out.push(N+'>[hidden],'+N+'>button[aria-hidden="true"]{display:none!important}');
 return out.join('\n');
}
// Verpackungen: eigener Menüknopf in #nav (RC1555) oder Stellvertreter, wenn der Knopf außerhalb liegt
function itemSel(v){if(v==='it')return '[data-rc1579-proxy="it"]';return v==='packaging'?':is([data-rc1579-proxy="packaging"],[data-rc1555-packaging-nav])':':is([data-view="'+v+'"],[data-index321-view="'+v+'"])'}
function ensureStyle(){if(d.getElementById(STYLE_ID))return;var st=d.createElement('style');st.id=STYLE_ID;st.textContent=css();(d.head||d.documentElement).appendChild(st)}

function header(s){
 var h=nav.querySelector(':scope>.rc1579-section[data-rc1579-section="'+s.key+'"]');
 if(!h){
  h=d.createElement('div');h.className='rc1579-section';h.setAttribute('data-rc1579-section',s.key);h.setAttribute('role','button');h.tabIndex=0;
  h.innerHTML='<span class="rc1579-section-icon" aria-hidden="true"></span><span class="rc1579-section-label"></span><span class="rc1579-section-count" aria-hidden="true"></span><span class="rc1579-section-chevron" aria-hidden="true"></span>';
  nav.appendChild(h);
 }
 return h;
}
function setAttr(el,name,value){if(value==null){if(el.hasAttribute(name))el.removeAttribute(name)}else if(el.getAttribute(name)!==String(value))el.setAttribute(name,String(value))}
function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}

function packagingReal(){return d.querySelector('[data-rc1555-packaging-nav]:not([data-rc1579-proxy])')}
function ensureProxy(){
 var real=packagingReal(),proxy=nav.querySelector(':scope>[data-rc1579-proxy="packaging"]')||d.querySelector('[data-rc1579-proxy="packaging"]');
 if(!real||real.parentNode===nav){if(proxy)proxy.remove();d.documentElement.removeAttribute('data-rc1579-packaging');return real||null}
 if(!proxy){
  proxy=d.createElement('button');proxy.type='button';proxy.className='rc1579-proxy';proxy.setAttribute('data-rc1579-proxy','packaging');
  proxy.innerHTML='<span class="index308-nav-icon" aria-hidden="true"></span><span class="index308-nav-label"></span>';
  proxy.addEventListener('click',function(e){e.preventDefault();var r=packagingReal();if(r)r.click();try{if(w.ExportHUBMobileMenu&&w.ExportHUBMobileMenu.isOpen())w.ExportHUBMobileMenu.close()}catch(_){}});
 }
 if(proxy.parentNode!==nav)nav.appendChild(proxy);
 var label=q(real.textContent)||t('packaging');
 setText(proxy.querySelector('.index308-nav-label'),label);setAttr(proxy,'title',q(real.title)||label);setAttr(proxy,'aria-label',label);
 proxy.hidden=!!real.hidden;
 d.documentElement.setAttribute('data-rc1579-packaging','1');
 copyLook(proxy);
 return proxy;
}
// Der Stellvertreter-Knopf übernimmt das Aussehen eines normalen Menüknopfs des aktiven Designs
function copyLook(proxy,activeRef){
 var ref=activeRef||null,fallback=null;
 // a resting button of the same section (Administration), so icon and text colours match the neighbours
 if(!ref)nav.querySelectorAll(':scope>button[data-index321-view]').forEach(function(b){if(ref||b.classList.contains('active')||b.getAttribute('aria-current')==='page'||!SECTION_OF[viewOf(b)]||SECTION_OF[viewOf(b)]==='start'||IT_VIEWS.indexOf(viewOf(b))>=0)return;if(SECTION_OF[viewOf(b)]==='admin')ref=b;else if(!fallback)fallback=b});
 ref=ref||fallback;
 if(!ref)return;
 var key=(d.documentElement.getAttribute('data-eh-design')||'')+'|'+(d.body&&d.body.getAttribute('data-eh-theme')||'')+'|'+Math.round(w.innerWidth/100)+'|'+(activeRef?viewOf(activeRef):'');
 if(proxy.__rc1579Look===key&&proxy.style.length)return;
 var cs=w.getComputedStyle(ref),label=ref.querySelector('.index308-nav-label'),ls=label&&w.getComputedStyle(label),icon=ref.querySelector('.index308-nav-icon');
 // !important: the design sheets colour menu buttons via [data-index321-view] with !important, which the proxy does not carry;
 // without it the label fell back to the old light sidebar colour and "IT" was unreadable on light designs (2026-10-23).
 ['padding-top','padding-right','padding-bottom','padding-left','min-height','border-radius','border-top-width','border-top-style','border-color','border-left-width','border-left-style','border-right-width','border-right-style','border-bottom-width','border-bottom-style','font-family','font-size','font-weight','letter-spacing','line-height','color','column-gap','align-items','justify-content','text-align','background-color','background-image','box-shadow'].forEach(function(p){proxy.style.setProperty(p,cs.getPropertyValue(p),'important')});
 proxy.style.setProperty('display','flex','important');proxy.style.setProperty('width','100%','important');
 if(ls){var pl=proxy.querySelector('.index308-nav-label');['font-size','font-weight','color','letter-spacing','opacity'].forEach(function(p){pl.style.setProperty(p,ls.getPropertyValue(p),'important')})}
 if(icon){var ics=w.getComputedStyle(icon),glyph=w.getComputedStyle(icon,'::before');proxy.style.setProperty('--rc1579-proxy-icon-bg',ics.getPropertyValue('background-color'));proxy.style.setProperty('--rc1579-proxy-icon-border',ics.getPropertyValue('border-color'));proxy.style.setProperty('--rc1579-proxy-icon-fg',glyph.getPropertyValue('background-color'))}
 proxy.__rc1579Look=key;
}

// IT: ein Menüpunkt für Fehlerdiagnose, Release-Center und Update
function itButton(v){return nav&&nav.querySelector(':scope>'+itemSel(v))}
function itAllowed(){return IT_VIEWS.filter(function(v){var b=itButton(v);return b&&!b.hidden&&b.style.display!=='none'})}
function currentView(){return q(d.body&&d.body.getAttribute('data-exporthub-view'))}
function lastItTab(){var v='';try{v=q(w.localStorage&&w.localStorage.getItem(IT_STORE))}catch(_){}return v}
function openIt(v){var allowed=itAllowed();if(allowed.indexOf(v)<0)v=allowed.indexOf(lastItTab())>=0?lastItTab():allowed[0];var b=v&&itButton(v);if(b)b.click()}
function ensureItProxy(active){
 var proxy=nav.querySelector(':scope>[data-rc1579-proxy="it"]');
 if(!proxy){
  proxy=d.createElement('button');proxy.type='button';proxy.className='rc1579-proxy';proxy.setAttribute('data-rc1579-proxy','it');
  proxy.innerHTML='<span class="index308-nav-icon" aria-hidden="true"></span><span class="index308-nav-label"></span>';
  proxy.addEventListener('click',function(e){e.preventDefault();openIt('');try{if(w.ExportHUBMobileMenu&&w.ExportHUBMobileMenu.isOpen())w.ExportHUBMobileMenu.close()}catch(_){}});
  nav.appendChild(proxy);
 }
 var label=t('it'),isActive=IT_VIEWS.indexOf(active)>=0;
 setText(proxy.querySelector('.index308-nav-label'),label);setAttr(proxy,'title',t('itTitle'));setAttr(proxy,'aria-label',t('itTitle'));
 proxy.hidden=itAllowed().length===0;
 setAttr(proxy,'data-rc1579-active',isActive?'1':null);
 copyLook(proxy,isActive?itButton(active):null);
 return proxy;
}
function itTabs(){
 var content=d.getElementById('content'),view=currentView();
 if(!content||!nav)return;
 watchContent(content);
 var bar=content.querySelector(':scope>[data-rc1579-it-tabs]');
 if(IT_VIEWS.indexOf(view)<0){if(bar)bar.remove();return}
 try{w.localStorage&&w.localStorage.setItem(IT_STORE,view)}catch(_){}
 var allowed=itAllowed();
 if(!bar){bar=d.createElement('nav');bar.className='rc1579-it-tabs';bar.setAttribute('data-rc1579-it-tabs','1');content.prepend(bar)}
 else if(content.firstElementChild!==bar)content.prepend(bar);
 setAttr(bar,'aria-label',t('itTitle'));
 var html='<span class="rc1579-it-tabs-title">'+t('it')+'</span>'+allowed.map(function(v){var b=itButton(v),label=q(b&&b.querySelector('.index308-nav-label')&&b.querySelector('.index308-nav-label').textContent)||q(b&&b.textContent)||v;return '<button type="button" data-rc1579-it-tab="'+v+'"'+(v===view?' aria-current="page"':'')+' style="--rc1579-icon:'+uri(ICONS[v]).replace(/"/g,'&quot;')+'"><span aria-hidden="true"></span>'+label.replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})+'</button>'}).join('')+selfCorrectTab();
 if(bar.__rc1579Html!==html){bar.innerHTML=html;bar.__rc1579Html=html}
}
// RC1630: extra IT tab "Selbst korrigieren" (opens a dialog, not a view); only shown to global admins
function selfCorrectTab(){var sc=w.ExportHUBSelfCorrect;if(!sc||typeof sc.allowed!=='function'||!sc.allowed())return'';var label=q(sc.label&&sc.label())||'Selbst korrigieren';return '<button type="button" data-rc1630-self-correct="1" style="--rc1579-icon:'+uri(ICONS.selfcorrect).replace(/"/g,'&quot;')+'"><span aria-hidden="true"></span>'+label.replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})+'</button>'}
function watchContent(content){
 if(contentObserver&&contentObserver.__content===content)return;
 if(contentObserver)contentObserver.disconnect();
 if(!w.MutationObserver)return;
 contentObserver=new MutationObserver(function(){var bar=content.querySelector(':scope>[data-rc1579-it-tabs]');if(IT_VIEWS.indexOf(currentView())>=0?!bar||content.firstElementChild!==bar:!!bar)schedule()});
 contentObserver.__content=content;
 contentObserver.observe(content,{childList:true});
}
d.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-rc1579-it-tab]');if(!b)return;e.preventDefault();var v=b.getAttribute('data-rc1579-it-tab');if(v!==currentView())openIt(v)});

// Benutzerwechsel (Anmeldung, Abmeldung, geänderte Rechte): Rechte im Menü sofort neu anwenden,
// damit kein Menüstand eines vorherigen Benutzers (z. B. Administrator) stehen bleibt
function currentUser(){try{var u=typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'&&w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}catch(_){}var rt=w.ExportHUBClean&&w.ExportHUBClean.runtime;return rt&&rt.user||w.currentUser||null}
function userSig(){var u=currentUser();if(!u)return '';try{return q(u.user||u.login||u.username||u.name)+'|'+q(u.role)+'|'+(u.globalAdmin===true)+'|'+JSON.stringify(u.permissions||[])+'|'+JSON.stringify(u.rights||{})}catch(_){return q(u.user||u.login||u.name)}}
function applyRights(){
 var sig=userSig();if(sig===lastUserSig)return;
 var first=lastUserSig===null;lastUserSig=sig;if(first)return;
 try{if(w.ExportHUBRC325&&typeof w.ExportHUBRC325.buildMenu==='function')w.ExportHUBRC325.buildMenu()}catch(_){}
}

function activeView(){var a=nav.querySelector(':scope>button.active[data-index321-view],:scope>button[aria-current="page"]');return a?viewOf(a):''}

function sync(){
 scheduled=false;
 nav=d.getElementById('nav');if(!nav)return;
 if(nav.querySelectorAll(':scope>button').length<4)return;
 applyRights();
 syncing=true;
 try{
  ensureStyle();watch();
  if(!open)open=readOpen();
  ensureProxy();var active=activeView(),activeSection=SECTION_OF[active]||'';ensureItProxy(active);itTabs();
  if(activeSection&&!FLAT[activeSection]&&activeSection!==lastActiveSection&&open.indexOf(activeSection)<0){open.push(activeSection);writeOpen()}
  lastActiveSection=activeSection;
  SECTIONS.forEach(function(s){
   if(s.flat)return;
   var h=header(s),count=0;
   s.views.forEach(function(v){var b=nav.querySelector(':scope>'+itemSel(v));if(b&&shown(b))count++});
   var name=t(s.key),isOpen=open.indexOf(s.key)>=0;
   if(h.hidden!==(count===0))h.hidden=count===0;
   setText(h.querySelector('.rc1579-section-label'),name);
   setText(h.querySelector('.rc1579-section-count'),String(count));
   setAttr(h,'aria-expanded',isOpen?'true':'false');
   setAttr(h,'aria-label',t('toggle',{name:name}));
   setAttr(h,'title',name);
   setAttr(h,'data-rc1579-current',activeSection===s.key?'1':null);
  });
  setAttr(nav,'data-rc1579-open',open.join(' '));
  setAttr(nav,'data-rc1579-ready',VERSION);
 }finally{syncing=false}
}
function schedule(){if(scheduled)return;scheduled=true;(w.requestAnimationFrame||setTimeout)(sync)}

function watch(){
 if(observer&&observer.__nav===nav)return;
 if(observer)observer.disconnect();
 if(!w.MutationObserver)return;
 observer=new MutationObserver(function(list){
  if(syncing)return;
  for(var i=0;i<list.length;i++){var m=list[i],el=m.target;if(m.type==='childList'||!(el.classList&&el.classList.contains('rc1579-section'))){schedule();return}}
 });
 observer.__nav=nav;
 observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style','aria-current']});
}

function toggle(key,force){
 if(!open)open=readOpen();
 var i=open.indexOf(key),want=force==null?i<0:!!force;
 if(want&&i<0)open.push(key);else if(!want&&i>=0)open.splice(i,1);
 writeOpen();sync();
}
d.addEventListener('click',function(e){var h=e.target&&e.target.closest&&e.target.closest('#nav>.rc1579-section');if(!h)return;e.preventDefault();toggle(h.getAttribute('data-rc1579-section'))});
d.addEventListener('keydown',function(e){var h=e.target&&e.target.closest&&e.target.closest('#nav>.rc1579-section');if(!h)return;var key=h.getAttribute('data-rc1579-section');
 if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(key)}else if(e.key==='ArrowRight'){e.preventDefault();toggle(key,true)}else if(e.key==='ArrowLeft'){e.preventDefault();toggle(key,false)}});

['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:language-changed','exporthub:design-changed','resize'].forEach(function(n){w.addEventListener(n,schedule)});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
// Fallback, falls die Navigation erst spät aufgebaut wird
// Benutzerwechsel ohne Menü-Ereignis erkennen
setInterval(function(){if(userSig()!==lastUserSig)schedule()},1000);
var tries=0,boot=setInterval(function(){tries++;if(nav&&nav.hasAttribute('data-rc1579-ready')||tries>40){clearInterval(boot);return}schedule()},250);

w.ExportHUBMenu1579=Object.freeze({
 version:VERSION,
 sections:SECTIONS.map(function(s){return Object.freeze({key:s.key,views:s.views.slice()})}),
 icons:Object.keys(ICONS),
 open:function(key){toggle(key,true)},
 close:function(key){toggle(key,false)},
 toggle:function(key){toggle(key)},
 refresh:sync,
 openIt:function(v){if(!nav)nav=d.getElementById('nav');if(nav)openIt(q(v))},
 selfTest:function(){
  var n=d.getElementById('nav');if(!n)return{ready:false};
  var buttons=Array.prototype.slice.call(n.querySelectorAll(':scope>button:is([data-view],[data-index321-view]):not([data-rc1555-packaging-nav])')),missing=buttons.map(viewOf).filter(function(v){return !ICONS[v]});
  return{ready:n.getAttribute('data-rc1579-ready')===VERSION,open:(n.getAttribute('data-rc1579-open')||'').split(' ').filter(Boolean),sections:n.querySelectorAll(':scope>.rc1579-section').length,buttons:buttons.length,unmappedViews:buttons.map(viewOf).filter(function(v){return !SECTION_OF[v]}),missingIcons:missing,packagingProxy:!!n.querySelector(':scope>[data-rc1579-proxy="packaging"]')};
 }
});
})(window,document);
