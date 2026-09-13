(function(w,d){
'use strict';
if(w.__EXPORTHUB_RC1074_LOGIN_CLEAN__)return;
w.__EXPORTHUB_RC1074_LOGIN_CLEAN__=true;

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function isTechnicalLoginProgress(v){
  var t=q(v);
  return /^(?:Anmeldekonfiguration wird geprüft|TESTSERVICE\s*·\s*Auth-Backend wird geprüft)(?:\s*(?:…|\.{3}))?$/i.test(t)
}
function hideTechnicalLoginProgress(){
  var login=d.getElementById('login');
  if(!login)return;
  var nodes=login.querySelectorAll('*');
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(!isTechnicalLoginProgress(el.textContent))continue;
    el.textContent='';
    el.hidden=true;
    el.style.display='none';
    el.setAttribute('data-rc1074-login-progress-hidden','true');
  }
}
function install(){
  hideTechnicalLoginProgress();
  if(!d.documentElement||w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__)return;
  w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__=new MutationObserver(hideTechnicalLoginProgress);
  w.__EXPORTHUB_RC1074_LOGIN_OBSERVER__.observe(d.documentElement,{subtree:true,childList:true,characterData:true});
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',install,{once:true});else install();
w.addEventListener('exporthub:ready',hideTechnicalLoginProgress);
})(window,document);
