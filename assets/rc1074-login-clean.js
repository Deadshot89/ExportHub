(function(w,d){
'use strict';
if(w.__EXPORTHUB_RC1074_LOGIN_CLEAN__)return;
w.__EXPORTHUB_RC1074_LOGIN_CLEAN__=true;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function isTechnicalLoginProgress(v){
  var t=q(v);
  return /^(?:Anmeldekonfiguration wird geprüft|TESTSERVICE\s*·\s*(?:Auth-Backend wird geprüft|Zugangsdaten eingeben))(?:\s*(?:…|\.{3}|\.))?$/i.test(t)
}
function isStatusNode(el){
  if(!el||el.nodeType!==1)return false;
  var id=q(el.id).toLowerCase(),cls=q(el.className).toLowerCase();
  return /status|message|notice|alert|hint/.test(id+' '+cls)||el.hasAttribute('role')&&q(el.getAttribute('role')).toLowerCase()==='status'||el.hasAttribute('aria-live')
}
function hideNode(el){
  if(el.getAttribute('data-rc1074-login-progress-hidden')==='true'&&el.hidden&&el.style.display==='none')return;
  el.hidden=true;
  el.style.display='none';
  el.setAttribute('data-rc1074-login-progress-hidden','true');
}
function showNode(el){
  if(el.getAttribute('data-rc1074-login-progress-hidden')!=='true')return;
  el.hidden=false;
  el.style.removeProperty('display');
  el.removeAttribute('data-rc1074-login-progress-hidden');
}
function cleanLoginStatus(){
  var login=d.getElementById('login');
  if(!login)return;
  var nodes=login.querySelectorAll('*');
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i],t=q(el.textContent);
    if(isTechnicalLoginProgress(t)){el.textContent='';hideNode(el);continue}
    if(isStatusNode(el)&&!t){hideNode(el);continue}
    if(t&&!isTechnicalLoginProgress(t))showNode(el);
  }
}
function install(){
  cleanLoginStatus();
  if(!d.documentElement||w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__)return;
  w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__=new MutationObserver(cleanLoginStatus);
  w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__.observe(d.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','style']});
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',install,{once:true});else install();
w.addEventListener('exporthub:ready',cleanLoginStatus);
})(window,document);
