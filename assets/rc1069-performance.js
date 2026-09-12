(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1069_PERFORMANCE__)return;
w.__EXPORTHUB_RC1069_PERFORMANCE__=true;

var SEARCH_DELAY=140,searchTimer=0,lastSearchValue='',searchInstalls=0;
function q(v){return String(v==null?'':v)}
function nativeSetTimeout(){try{return w.ExportHUBClean&&w.ExportHUBClean.native&&w.ExportHUBClean.native.setTimeout||w.setTimeout}catch(_){return w.setTimeout}}
function nativeClearTimeout(){try{return w.ExportHUBClean&&w.ExportHUBClean.native&&w.ExportHUBClean.native.clearTimeout||w.clearTimeout}catch(_){return w.clearTimeout}}
function flushSearch(input){
 if(searchTimer){try{nativeClearTimeout()(searchTimer)}catch(_){}searchTimer=0}
 if(!input||typeof input.__rc1069OriginalOnInput!=='function')return false;
 lastSearchValue=q(input.value);
 try{input.__rc1069OriginalOnInput.call(input,{type:'input',target:input,currentTarget:input,rc1069:true})}catch(e){console.error('RC1069 Suche',e)}
 return true
}
function installSearch(){
 if(!w.document)return false;
 var input=w.document.getElementById('globalSearch');if(!input)return false;
 var current=input.oninput;
 if(input.__rc1069SearchInstalled===true){
   if(typeof current==='function'&&current!==input.__rc1069DebouncedOnInput&&current!==input.__rc1069OriginalOnInput)input.__rc1069OriginalOnInput=current;
   return true
 }
 if(typeof current!=='function')return false;
 input.__rc1069OriginalOnInput=current;
 input.__rc1069DebouncedOnInput=function(){
   var self=input,value=q(self.value);
   if(value===lastSearchValue&&searchTimer===0)return;
   if(searchTimer){try{nativeClearTimeout()(searchTimer)}catch(_){}searchTimer=0}
   var delay=/^\s*update\s+exporthub\s*$/i.test(value)?0:SEARCH_DELAY;
   searchTimer=nativeSetTimeout()(function(){searchTimer=0;flushSearch(self)},delay)
 };
 input.oninput=input.__rc1069DebouncedOnInput;
 input.addEventListener('keydown',function(e){if(e&&e.key==='Enter'){e.preventDefault();flushSearch(input)}},true);
 input.__rc1069SearchInstalled=true;searchInstalls++;
 return true
}
function install(){
 installSearch();
 return true
}
function schedule(){
 var set=nativeSetTimeout();set(install,0);set(install,180);set(install,600)
}
if(w.document){
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
}
if(w.addEventListener){
 ['exporthub:ready','exporthub:viewchange','exporthub:rendered','exporthub:sync'].forEach(function(name){w.addEventListener(name,install)})
}
w.ExportHUBRC1069Performance=Object.freeze({version:'RC1069',searchDelayMs:SEARCH_DELAY,install:install,flushSearch:flushSearch,stats:function(){return{searchInstalls:searchInstalls,pendingSearch:!!searchTimer,lastSearchValue:lastSearchValue}}});
})(window);
