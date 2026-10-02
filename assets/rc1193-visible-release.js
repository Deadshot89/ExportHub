(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1193_VISIBLE_RELEASE__)return;
w.__EXPORTHUB_RC1193_VISIBLE_RELEASE__=true;
var VERSION='RC1112';
w.__EXPORTHUB_VISIBLE_RELEASE_VERSION__=VERSION;

var timer=0,pendingFull=false,pendingRoots=[];
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
function elementRoot(node){
 if(!node)return null;
 if(node.nodeType===1)return node;
 if(node.nodeType===3)return node.parentElement||node.parentNode||null;
 return null
}
function contains(a,b){
 try{return a===b||!!(a&&a.contains&&a.contains(b))}catch(_){return a===b}
}
function queueRoot(node){
 var root=elementRoot(node);if(!root)return false;
 for(var i=0;i<pendingRoots.length;i++)if(contains(pendingRoots[i],root))return true;
 for(var j=pendingRoots.length-1;j>=0;j--)if(contains(root,pendingRoots[j]))pendingRoots.splice(j,1);
 pendingRoots.push(root);return true
}
function flush(){
 timer=0;
 var full=pendingFull,roots=pendingRoots.slice();pendingFull=false;pendingRoots.length=0;
 if(full||!roots.length)return patch(d);
 var changed=false;
 for(var i=0;i<roots.length;i++)changed=patch(roots[i])||changed;
 return changed
}
function arm(){
 if(timer)return true;
 timer=(w.setTimeout||setTimeout)(flush,0);return true
}
function schedule(){
 pendingFull=true;pendingRoots.length=0;return arm()
}
function scheduleMutations(records){
 if(pendingFull)return arm();
 var queued=false,list=records||[];
 for(var i=0;i<list.length;i++){
  var record=list[i]||{};
  if(record.type==='characterData'){
   queued=queueRoot(record.target)||queued;
   continue
  }
  var added=record.addedNodes||[];
  for(var j=0;j<added.length;j++)queued=queueRoot(added[j])||queued
 }
 if(!queued){pendingFull=true;pendingRoots.length=0}
 return arm()
}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded'].forEach(function(name){try{w.addEventListener(name,schedule)}catch(_){}});
if(w.MutationObserver){
 try{
  var observer=new w.MutationObserver(scheduleMutations);
  observer.observe(d.documentElement||d.body,{childList:true,subtree:true,characterData:true})
 }catch(_){}
}
w.ExportHUBVisibleRelease1193=Object.freeze({version:VERSION,patch:function(){return patch(d)},schedule:schedule});
})(window,document);
