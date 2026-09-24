(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1193_VISIBLE_RELEASE__)return;
w.__EXPORTHUB_RC1193_VISIBLE_RELEASE__=true;
var VERSION='RC1112';
w.__EXPORTHUB_VISIBLE_RELEASE_VERSION__=VERSION;

function q(v){return String(v==null?'':v)}
function replaceVisibleText(v){
 return q(v)
  .replace(/Aktuelle Version\s+RC\d+/gi,'Aktuelle Version '+VERSION)
  .replace(/TESTSERVICE\s*·\s*RC\d+\s*·\s*NICHT PRODUKTION/gi,'TESTSERVICE · '+VERSION+' · NICHT PRODUKTION')
}
function patchElement(el){
 if(!el||el.nodeType!==1)return false;
 var changed=false;
 if(el.hasAttribute&&el.hasAttribute('data-exporthub-version-label')&&q(el.textContent).trim()!==VERSION){
  el.textContent=VERSION;changed=true
 }
 if(el.childElementCount===0){
  var before=q(el.textContent),after=replaceVisibleText(before);
  if(after!==before){el.textContent=after;changed=true}
 }
 return changed
}
function patch(root){
 var base=root&&root.nodeType?root:d,changed=false;
 try{
  if(base.nodeType===1)changed=patchElement(base)||changed;
  var nodes=base.querySelectorAll?base.querySelectorAll('*'):[];
  for(var i=0;i<nodes.length;i++)changed=patchElement(nodes[i])||changed;
  if(d.title&&/ExportHUB/i.test(d.title)){
   var title=d.title.replace(/\bRC\d+\b/g,VERSION);
   if(title!==d.title){d.title=title;changed=true}
  }
  if(d.documentElement)d.documentElement.setAttribute('data-exporthub-visible-version',VERSION)
 }catch(_){}
 return changed
}
function schedule(){(w.setTimeout||setTimeout)(function(){patch(d)},0)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(name){try{w.addEventListener(name,schedule)}catch(_){}});
if(w.MutationObserver){
 try{
  var pending=false;
  var observer=new MutationObserver(function(){
   if(pending)return;pending=true;
   (w.setTimeout||setTimeout)(function(){pending=false;patch(d)},0)
  });
  observer.observe(d.documentElement||d.body,{childList:true,subtree:true,characterData:true})
 }catch(_){}
}
w.ExportHUBVisibleRelease1193=Object.freeze({version:VERSION,patch:function(){return patch(d)}});
})(window,document);
