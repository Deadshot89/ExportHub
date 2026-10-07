(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1458_LOGIN_COLLI_GUARD__)return;
var nativeAlert=typeof w.alert==='function'?w.alert.bind(w):null;
if(!nativeAlert)return;

function loginVisible(){
  var el=null;
  try{el=w.document&&w.document.getElementById&&w.document.getElementById('login')}catch(_){}
  if(!el||el.hidden===true)return false;
  try{if(el.getAttribute&&el.getAttribute('aria-hidden')==='true')return false}catch(_){}
  try{
    if(typeof w.getComputedStyle==='function'){
      var style=w.getComputedStyle(el);
      if(style&&(style.display==='none'||style.visibility==='hidden'))return false;
    }
  }catch(_){}
  return true;
}

function alertSignature(value){
  var text=String(value==null?'':value).trim();
  var hash=2166136261;
  for(var i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619)>>>0;
  }
  return{textLength:text.length,hash:hash};
}

w.alert=function(message){
  var signature=alertSignature(message);
  if(loginVisible()&&signature.textLength===79&&signature.hash===1008431256)return;
  return nativeAlert(message);
};
w.__EXPORTHUB_RC1458_LOGIN_COLLI_GUARD__=true;
})(window);
