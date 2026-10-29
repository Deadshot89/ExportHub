/* ExportHUB360 RC1725 – shows the really deployed build (release date + commit) next to the version.
   The RC number alone never changes between releases (visible RC1370, technical RC1112), so it cannot tell
   whether a site already runs the newest release. The deploy writes api/release-metadata.json (RC1553) and
   /api/exporthub-health returns it; this script reads it once and adds "Stand <date> · Build <sha>" to the
   login, the Update page and the Release-Center. It also replaces the technical marker RC1112 in those two
   admin views by the visible release. Texts live in assets/i18n/rc1725-build-stamp.js. */
(function(w,d){
'use strict';
if(!w||!d||w.ExportHUBBuildStamp1725)return;
var VERSION='RC1725',STYLE_ID='rc1725-build-stamp-style',LOGIN_ID='rc1725LoginBuildStamp',UPDATE_ID='rc1725UpdateBuildStamp',RELEASE_ID='rc1725ReleaseBuildStamp';
var HEALTH_URL='/api/exporthub-health';
var deployment=null,timer=0,observer=null,started=false;

function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLowerCase()}
function packs(){var p=w.ExportHUBBuildStamp1725I18n;return(p&&p.packs)||{}}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(packs()[l])return l}}catch(_){}return'de'}
function t(key){var all=packs(),s=(all[lang()]||{})[key];if(s==null)s=(all.de||{})[key];return q(s==null?key:s)}
function visibleRelease(){var v=q(w.__EXPORTHUB_VISIBLE_RELEASE_VERSION__).toUpperCase();return/^RC\d+$/.test(v)?v:''}
function technicalBuild(){try{var v=q(w.EXPORTHUB_BUILD&&w.EXPORTHUB_BUILD.version).toUpperCase();return/^RC\d+$/.test(v)?v:''}catch(_){return''}}

function validDeployment(v){
 if(!v||v.verified!==true)return null;
 var id=low(v.buildId),at=new Date(q(v.builtAt));
 if(!/^[0-9a-f]{7,40}$/.test(id)||isNaN(at.getTime()))return null;
 return{buildId:id,shortId:id.slice(0,7),builtAt:at,environment:low(v.environment)}
}
function formatDate(dt){
 var l=lang(),locale=l==='en'?'en-GB':(l==='de'?'de-DE':l);
 try{return dt.toLocaleString(locale,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Berlin'})}
 catch(_){return dt.toISOString().slice(0,16).replace('T',' ')}
}
function stampText(){return deployment?t('stand')+' '+formatDate(deployment.builtAt)+' · '+t('build')+' '+deployment.shortId:''}
/* The login hides the old version badge, so its stamp names the release itself. */
function loginText(){var v=visibleRelease(),s=stampText();return s&&v?t('version')+' '+v+' · '+s:s}

function ensureStyle(){
 if(d.getElementById(STYLE_ID)||!d.head)return;
 var s=d.createElement('style');s.id=STYLE_ID;
 s.textContent=
  '#'+LOGIN_ID+'{display:block;margin-top:4px;font-size:11px;font-weight:700;line-height:1.35;color:#64748b;letter-spacing:.01em}'+
  'html[data-eh-design] #login#login[data-eh360-ui="v2"] .login-card>#'+LOGIN_ID+'{order:41}'+
  'html[data-eh-design="neon"] #login#login[data-eh360-ui="v2"] .login-card>#'+LOGIN_ID+'{color:rgba(226,232,240,.78)}'+
  '#'+RELEASE_ID+'{display:block;margin-top:5px;font-size:11px;font-weight:800;color:#475569}';
 d.head.appendChild(s)
}
function setText(el,text){if(el&&el.textContent!==text){el.textContent=text;return true}return false}

/* RC1112 is the technical deploy marker, not a release. In the admin views show the visible release instead. */
function patchTechnicalMarkers(){
 var tech=technicalBuild(),visible=visibleRelease(),changed=false;
 if(!tech||!visible||tech===visible)return false;
 var nodes=d.querySelectorAll('.rc524-update-card b,.rc524-update-card span,.rc562-release-card strong');
 for(var i=0;i<nodes.length;i++){
  var el=nodes[i];
  if(el.childElementCount===0&&q(el.textContent).toUpperCase()===tech){el.textContent=visible;el.setAttribute('data-rc1725-technical',tech);changed=true}
 }
 return changed
}
function patchLogin(text){
 var badge=d.getElementById('cleanVersionBadge');if(!badge||!badge.parentNode)return false;
 var el=d.getElementById(LOGIN_ID),changed=false;
 if(!el){el=d.createElement('div');el.id=LOGIN_ID;el.className='rc1725-build-stamp';changed=true}
 if(el.previousElementSibling!==badge){badge.parentNode.insertBefore(el,badge.nextSibling);changed=true}
 return setText(el,text)||changed
}
function patchUpdatePage(text){
 var grid=d.querySelector('.rc524-update-card .rc524-update-grid');if(!grid)return false;
 var el=d.getElementById(UPDATE_ID),changed=false;
 if(!el||el.parentNode!==grid){
  if(el&&el.parentNode)el.parentNode.removeChild(el);
  el=d.createElement('article');el.id=UPDATE_ID;el.appendChild(d.createElement('strong'));el.appendChild(d.createElement('span'));
  grid.appendChild(el);changed=true
 }
 changed=setText(el.firstChild,t('label'))||changed;
 return setText(el.lastChild,text)||changed
}
function patchReleaseCenter(text){
 var cards=d.querySelectorAll('.rc562-release-grid .rc562-release-card'),target=null;
 var wanted=deployment&&deployment.environment==='production'?/^PRODUKTION$/i:/^AKTIVE TESTVERSION$/i;
 for(var i=0;i<cards.length;i++){var head=cards[i].querySelector('span');if(head&&wanted.test(q(head.textContent))){target=cards[i];break}}
 if(!target)return false;
 var el=d.getElementById(RELEASE_ID),changed=false;
 if(!el||el.parentNode!==target){
  if(el&&el.parentNode)el.parentNode.removeChild(el);
  el=d.createElement('small');el.id=RELEASE_ID;target.appendChild(el);changed=true
 }
 return setText(el,text)||changed
}
function patch(){
 timer=0;
 var changed=false;
 try{
  changed=patchTechnicalMarkers()||changed;
  var text=stampText();
  if(text){
   ensureStyle();
   changed=patchLogin(loginText())||changed;
   changed=patchUpdatePage(text)||changed;
   changed=patchReleaseCenter(text)||changed;
   d.documentElement.setAttribute('data-exporthub-build-id',deployment.shortId)
  }
 }catch(_){}
 return changed
}
function schedule(){if(!timer)timer=(w.setTimeout||setTimeout)(patch,120);return true}

function load(){
 if(w.__EXPORTHUB_DEMO_MODE__===true||typeof w.fetch!=='function')return Promise.resolve(null);
 return w.fetch(HEALTH_URL+'?rc1725='+Date.now(),{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}})
  .then(function(r){return r&&r.ok?r.json():null})
  .then(function(body){deployment=validDeployment(body&&body.deployment);schedule();return deployment})
  .catch(function(){return null})
}
function start(){
 if(started)return;started=true;
 schedule();
 try{
  if(typeof w.MutationObserver==='function'&&d.body){observer=new w.MutationObserver(schedule);observer.observe(d.body,{childList:true,subtree:true})}
 }catch(_){}
 ['exporthub:rendered','exporthub:viewchange','exporthub:language-changed'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
 load()
}

w.ExportHUBBuildStamp1725=Object.freeze({
 version:VERSION,
 load:load,
 patch:patch,
 stampText:stampText,
 loginText:loginText,
 deployment:function(){return deployment},
 _setDeploymentForTest:function(v){deployment=validDeployment(v);return deployment}
});
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window!=='undefined'?window:null,typeof document!=='undefined'?document:null);
