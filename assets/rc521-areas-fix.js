(function(){
'use strict';
if(window.__EXPORTHUB_RC521_AREAS__)return;
window.__EXPORTHUB_RC521_AREAS__=true;
var nativeTimeout=(window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setTimeout)||window.setTimeout.bind(window);
var scheduled=0,settleTimer=0,areaObserver=null,titleObserver=null,installed=false,working=false;
function q(v){return String(v==null?'':v).trim()}
function stateObj(){try{return window.state||state||{}}catch(_){return window.state||{}}}
function isShipment(){var s=stateObj();return q(s.view)==='shipment'||!!document.querySelector('#content .rc344-root')||/^\s*🚚?\s*Sendung erstellen/i.test(q((document.querySelector('#content h1,#content h2')||{}).textContent))}
function root(){return document.getElementById('content')}
function savedCard(){var r=root();if(!r)return null;var h=Array.from(r.querySelectorAll('h2,h3,h4')).find(function(x){return /^Gespeicherte Sendungen/i.test(q(x.textContent))});return h&&(h.closest('.card,.rc344-card,section,article')||h.parentElement)}
function colliCard(){var r=root();if(!r)return null;var h=Array.from(r.querySelectorAll('h2,h3,h4')).find(function(x){return /Collis,\s*Maße,\s*Gewicht,\s*Lademeter/i.test(q(x.textContent))});return h&&(h.closest('.card,.rc344-card,section,article')||h.parentElement)}
function removeOldMail(){['rc416ShipmentMail','rc410ShipmentMail','rc409ShipmentMail','rc404ShipmentMail','rc404ShipmentMailPanel','rc390ShipmentMail','rc385ShipmentMail'].forEach(function(id){var x=document.getElementById(id);if(x)x.remove()});var old=document.getElementById('rc344MailBox');if(old){var txt=q(old.textContent);if(/Mail Bereich|Empfängerart|Mail in Outlook/i.test(txt))old.remove()}}
function ensureMail(){
 removeOldMail();
 var panel=document.getElementById('rc418ShipmentMail');
 try{if(typeof window.rc418EnsureMail==='function')window.rc418EnsureMail(true)}catch(e){window.__RC521_MAIL_ERROR__=q(e&&e.message||e)}
 panel=document.getElementById('rc418ShipmentMail');
 if(!panel){try{if(typeof window.rc429EnsureShipmentSections==='function')window.rc429EnsureShipmentSections()}catch(e){window.__RC521_SECTION_ERROR__=q(e&&e.message||e)}panel=document.getElementById('rc418ShipmentMail')}
 if(panel){
  panel.hidden=false;panel.style.display='';panel.style.visibility='visible';panel.classList.add('rc521-mail-area');
  var saved=savedCard();if(saved&&saved.parentNode&&panel.nextElementSibling!==saved)saved.parentNode.insertBefore(panel,saved);
 }
 return !!panel
}
function ensureStow(){
 var panel=document.getElementById('rc424TruckPanel');
 if(!panel){try{if(typeof window.rc424UpdateTruckPlan==='function')window.rc424UpdateTruckPlan()}catch(e){window.__RC521_STOW_ERROR__=q(e&&e.message||e)}panel=document.getElementById('rc424TruckPanel')}
 if(!panel){try{if(typeof window.rc429EnsureShipmentSections==='function')window.rc429EnsureShipmentSections()}catch(_){}panel=document.getElementById('rc424TruckPanel')}
 if(panel){
  panel.hidden=false;panel.style.display='';panel.style.visibility='visible';panel.classList.remove('hidden');panel.classList.add('rc521-stow-area');
  var card=colliCard();if(card&&card.parentNode&&card.nextElementSibling!==panel)card.parentNode.insertBefore(panel,card.nextSibling);
 }
 return !!panel
}
function fixVersion(){try{var title='ExportHUB RC521',node=document.querySelector('title');if(node)node.textContent=title;var td=Object.getOwnPropertyDescriptor(document,'title');if(!td||td.configurable){try{if(td&&td.configurable)delete document.title;Object.defineProperty(document,'title',{configurable:false,enumerable:true,get:function(){return title},set:function(){var n=document.querySelector('title');if(n&&n.textContent!==title)n.textContent=title}})}catch(_){document.title=title}}else{document.title=title}var r=root();if(r){var w=document.createTreeWalker(r,NodeFilter.SHOW_TEXT,null),n;while((n=w.nextNode()))if(/Private\s+RC\d+|ExportHUB\s+Private\s+RC\d+/i.test(n.nodeValue||''))n.nodeValue=String(n.nodeValue).replace(/ExportHUB\s+Private\s+RC\d+/gi,title).replace(/Private\s+RC\d+/gi,'RC521')}}catch(_){}}
function refresh(){
 if(working)return false;working=true;
 fixVersion();
 if(!isShipment()){working=false;return true}
 try{
  ensureStow();ensureMail();fixVersion();
  var mail=!!document.getElementById('rc418ShipmentMail'),stow=!!document.getElementById('rc424TruckPanel');
  window.__EXPORTHUB_RC521_AREA_STATUS__={mail:mail,stow:stow,at:new Date().toISOString()};
  return mail&&stow
 }finally{working=false}
}
function schedule(ms){var clear=(window.ExportHUBClean&&window.ExportHUBClean.native.clearTimeout)||clearTimeout;if(scheduled)try{clear(scheduled)}catch(_){}if(settleTimer)try{clear(settleTimer)}catch(_){}scheduled=nativeTimeout(function(){scheduled=0;refresh();settleTimer=nativeTimeout(function(){settleTimer=0;refresh()},520)},Math.max(0,Number(ms)||0))}
function wrap(name){var old=window[name];if(typeof old!=='function'||old.__rc521Areas)return;var fn=function(){var out=old.apply(this,arguments);schedule(0);return out};fn.__rc521Areas=true;fn.__rc521Base=old;try{window[name]=fn;if(name==='render')render=fn;if(name==='setView')setView=fn}catch(_){window[name]=fn}}
function install(){
 if(installed){schedule(0);return}installed=true;
 wrap('render');wrap('setView');
 try{var MO=(window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.MutationObserver)||window.MutationObserver,host=root();if(MO&&host){areaObserver=new MO(function(ms){if(working)return;if(ms&&ms.some(function(m){return m.type==='childList'}))schedule(25)});areaObserver.observe(host,{childList:true})}var tn=document.querySelector('title');if(MO&&tn){titleObserver=new MO(function(){if(tn.textContent!=='ExportHUB RC521')tn.textContent='ExportHUB RC521'});titleObserver.observe(tn,{childList:true,characterData:true,subtree:true})}}catch(e){window.__RC521_AREA_OBSERVER_ERROR__=q(e&&e.message||e)}
 document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('button,a');if(!b)return;if(/Sendung erstellen|Neue Sendung|Kunde übernehmen|Neue Zeile|Entfernen|Neu berechnen|Stauplan/i.test(q(b.textContent)))schedule(40)},true);
 document.addEventListener('change',function(e){var x=e.target;if(!x)return;if(x.closest&&x.closest('#content'))schedule(40)},true);
 document.addEventListener('input',function(e){var x=e.target;if(x&&x.closest&&x.closest('.rc344-colli-row,[data-rc344-row]'))schedule(90)},true);
 schedule(0);nativeTimeout(function(){wrap('render');wrap('setView');schedule(0)},250);
}
window.ExportHUBRC521={install:install,refresh:refresh,ensureMail:ensureMail,ensureStow:ensureStow};
})();
