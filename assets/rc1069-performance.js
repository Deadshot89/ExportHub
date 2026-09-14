(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1069_PERFORMANCE__)return;
w.__EXPORTHUB_RC1069_PERFORMANCE__=true;

var SEARCH_DELAY=140,searchTimer=0,lastSearchValue='',searchInstalls=0;
var printPrewarmByKey=Object.create(null),printPrewarmStarted=0,printPrewarmWaited=0;
function q(v){return String(v==null?'':v)}
function clean(v){return q(v).replace(/\s+/g,' ').trim()}
function nativeSetTimeout(){try{return w.ExportHUBClean&&w.ExportHUBClean.native&&w.ExportHUBClean.native.setTimeout||w.setTimeout}catch(_){return w.setTimeout}}
function nativeClearTimeout(){try{return w.ExportHUBClean&&w.ExportHUBClean.native&&w.ExportHUBClean.native.clearTimeout||w.clearTimeout}catch(_){return w.clearTimeout}}
function state(){try{return typeof w.__EXPORTHUB_GET_STATE__==='function'?w.__EXPORTHUB_GET_STATE__():(w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.state)||w.state||{}}catch(_){return w.state||{}}}
function shipmentKey(sh){return clean(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)).toUpperCase()}
function currentPrintShipment(){var s=state(),direct=s&&s.shipment;if(direct&&shipmentKey(direct))return direct;var id=clean(s&&(s.documentShipmentId||s.currentShipmentId||s.selectedShipmentId||s.activeShipmentId)).toUpperCase(),lists=[s&&s.savedShipments,s&&s.shipments];for(var i=0;i<lists.length;i++){var rows=Array.isArray(lists[i])?lists[i]:[];for(var j=0;j<rows.length;j++){var sh=rows[j],key=shipmentKey(sh);if(key&&(key===id||clean(sh&&(sh.id||sh.shipmentId)).toUpperCase()===id))return sh}}return null}
function prewarmPrintOutput(sh){
 var key=shipmentKey(sh);if(!key)return Promise.resolve(false);
 if(printPrewarmByKey[key])return printPrewarmByKey[key];
 var warehouse=w.ExportHUBWarehouse;if(!warehouse||typeof warehouse.register!=='function')return Promise.resolve(false);
 printPrewarmStarted++;
 var pending=Promise.resolve().then(function(){return warehouse.register(sh,false)}).then(function(ok){return ok===true}).catch(function(e){try{console.warn('RC1104 Druck-Vorwärmung',e)}catch(_){}return false});
 printPrewarmByKey[key]=pending;
 pending.finally(function(){if(printPrewarmByKey[key]===pending)delete printPrewarmByKey[key]});
 return pending
}
function isPrintButton(button){if(!button)return false;if(button.matches&&button.matches('[data-index352-action="print-all"]'))return true;return /Gesamtausgabe\s*drucken|Gesamtdruck/i.test(clean(button.textContent))}
function waitForPrintPrewarm(e){
 var button=e&&e.target&&e.target.closest&&e.target.closest('button,a');if(!isPrintButton(button))return false;
 if(button.__rc1104PrintResume){button.__rc1104PrintResume=false;return false}
 var sh=currentPrintShipment(),key=shipmentKey(sh),pending=key&&printPrewarmByKey[key];if(!pending)return false;
 if(e.preventDefault)e.preventDefault();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
 var oldDisabled=!!button.disabled,oldText=button.textContent;button.disabled=true;button.textContent='Druck wird vorbereitet …';printPrewarmWaited++;
 Promise.resolve(pending).catch(function(){return false}).then(function(){button.disabled=oldDisabled;button.textContent=oldText;button.__rc1104PrintResume=true;nativeSetTimeout()(function(){try{button.click()}catch(err){button.__rc1104PrintResume=false;try{console.error('RC1104 Druck fortsetzen',err)}catch(_){}}},0)});
 return true
}
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
 w.document.addEventListener('click',waitForPrintPrewarm,true);
}
if(w.addEventListener){
 ['exporthub:ready','exporthub:viewchange','exporthub:rendered','exporthub:sync'].forEach(function(name){w.addEventListener(name,install)});
 w.addEventListener('exporthub:shipment-saved',function(e){var d=e&&e.detail||{},sh=d.shipment||currentPrintShipment();if(sh)prewarmPrintOutput(sh)});
}
w.ExportHUBRC1069Performance=Object.freeze({version:'RC1069',printOptimizationVersion:'RC1104',searchDelayMs:SEARCH_DELAY,install:install,flushSearch:flushSearch,prewarmPrintOutput:prewarmPrintOutput,waitForPrintPrewarm:waitForPrintPrewarm,stats:function(){return{searchInstalls:searchInstalls,pendingSearch:!!searchTimer,lastSearchValue:lastSearchValue,printPrewarmStarted:printPrewarmStarted,printPrewarmWaited:printPrewarmWaited,pendingPrintPrewarm:Object.keys(printPrewarmByKey).length}}});
})(window);
