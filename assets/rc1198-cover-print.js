(function(w,d){
'use strict';
if(w.__EXPORTHUB_RC1198_COVER_PRINT__)return;
w.__EXPORTHUB_RC1198_COVER_PRINT__=true;
function q(v){return String(v==null?'':v).trim()}
function state(){try{return typeof w.__EXPORTHUB_GET_STATE__==='function'?w.__EXPORTHUB_GET_STATE__()||{}:(w.ExportHUBClean&&w.ExportHUBClean.state)||w.state||{}}catch(_){return w.state||{}}}
function shipment(){var s=state();return s&&s.shipment&&typeof s.shipment==='object'?s.shipment:null}
function key(sh){return q(sh&&(sh.id||sh.shipmentId||sh._syncId||sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber))}
function ref(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber)).toUpperCase()}
function api(){var a=w.ExportHUBIndex240;return a&&typeof a.find==='function'&&typeof a.print==='function'?a:null}
function savedFor(sh){
 var a=api(),id=key(sh),r=ref(sh),saved=null;
 if(!a||!sh)return null;
 if(id)saved=a.find(id);
 if(!saved&&r)saved=a.find(r);
 return saved||null
}
function selectSaved(saved){
 var s=state(),id=key(saved)||ref(saved);
 if(!id)return false;
 s.documentShipmentId=id;
 s.selectedShipmentId=id;
 s.currentShipmentId=id;
 return true
}
function printSaved(button){
 var sh=shipment(),a=api(),saved=savedFor(sh);
 if(!a||!saved)return false;
 selectSaved(saved);
 if(button){button.disabled=false;button.textContent='🖨 Nur Deckblatt drucken'}
 a.print('cover');
 return true
}
function fail(button,message){
 if(button){button.disabled=false;button.textContent='🖨 Nur Deckblatt drucken'}
 try{w.alert(message)}catch(_){}
 return false
}
function waitForSaved(button,startedAt){
 if(printSaved(button))return true;
 if(Date.now()-startedAt>30000)return fail(button,'Die Sendung konnte nicht rechtzeitig gespeichert werden. Bitte Speichern prüfen und Deckblatt erneut drucken.');
 (w.setTimeout||setTimeout)(function(){waitForSaved(button,startedAt)},250);
 return true
}
function printCover(button){
 if(printSaved(button))return false;
 var save=d.getElementById('rc363SaveShipment');
 if(!save)return fail(button,'Bitte die Sendung zuerst speichern. Der Speichern-Button wurde nicht gefunden.');
 if(save.disabled)return fail(button,'Die Sendung kann aktuell noch nicht gespeichert werden. Bitte Pflichtfelder prüfen.');
 if(button){button.disabled=true;button.textContent='Sendung wird gespeichert …'}
 try{save.click()}catch(e){return fail(button,'Die Sendung konnte nicht gespeichert werden.')}
 waitForSaved(button,Date.now());
 return false
}
function install(){
 var host=d.getElementById('rc363BlockActions');
 if(!host)return false;
 var existing=host.querySelector('[data-rc1198-print-cover="1"]');
 if(existing)return true;
 var toolbar=host.querySelector('.toolbar,.actions,[class*="toolbar"],[class*="actions"]')||host;
 var button=d.createElement('button');
 button.type='button';
 button.className='btn';
 button.setAttribute('data-rc1198-print-cover','1');
 button.setAttribute('title','Druckt ausschließlich das farbige Deckblatt dieser Sendung');
 button.textContent='🖨 Nur Deckblatt drucken';
 toolbar.appendChild(button);
 return true
}
function onClick(e){
 var button=e&&e.target&&e.target.closest&&e.target.closest('[data-rc1198-print-cover="1"]');
 if(!button)return;
 e.preventDefault();
 printCover(button)
}
d.addEventListener('click',onClick,false);
function schedule(){install();(w.setTimeout||setTimeout)(install,120);(w.setTimeout||setTimeout)(install,500)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:rendered','exporthub:viewchange','exporthub:shipment-saved','exporthub:ready'].forEach(function(name){try{w.addEventListener(name,schedule)}catch(_){}});
w.ExportHUBRC1198CoverPrint=Object.freeze({version:'RC1198',install:install,printCover:printCover,printSaved:printSaved,savedFor:savedFor});
})(window,document);
