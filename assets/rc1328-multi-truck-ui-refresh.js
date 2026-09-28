(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1328_MULTI_TRUCK_REFRESH__)return;
w.__EXPORTHUB_RC1328_MULTI_TRUCK_REFRESH__=true;

function arr(v){return Array.isArray(v)?v:[]}
function q(v){return String(v==null?'':v).trim()}
function refOf(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef)).toUpperCase()}
function hasMultiTruck(sh){return !!(sh&&arr(sh.subShipments).length>1)}
function card(){return d.getElementById('rc380StowPlan')}
function panel(){return d.getElementById('rc1017-subshipments')}

function state(){
 try{return typeof w.__EXPORTHUB_GET_STATE__==='function'?(w.__EXPORTHUB_GET_STATE__()||null):null}catch(_){return null}
}
function activeReference(s){
 var direct=refOf(s&&(s.shipment||s.currentShipment||s.selectedShipment));
 if(direct)return direct;
 try{
  var input=typeof d.querySelector==='function'?d.querySelector('#rc363BlockCustomer input[maxlength="6"],input[maxlength="6"][pattern*="A-Z0-9"]'):null;
  return q(input&&input.value).toUpperCase()
 }catch(_){return''}
}
function currentMultiTruckShipment(){
 var s=state();if(!s)return null;
 var current=[s.shipment,s.currentShipment,s.selectedShipment].filter(Boolean);
 var saved=arr(s.shipments);
 var ref=activeReference(s);
 var candidates=current.concat(saved);
 if(ref){
  var exact=candidates.find(function(sh){return refOf(sh)===ref&&hasMultiTruck(sh)});
  if(exact)return exact
 }
 return candidates.find(hasMultiTruck)||null
}

function refresh(sh){
 if(!hasMultiTruck(sh))return false;
 if(panel())return true;
 if(!card())return false;
 if(typeof w.rc1017SyncSubShipments!=='function')return false;
 try{
  w.rc1017SyncSubShipments(sh);
  return !!panel()
 }catch(e){
  try{console.warn('RC1333 Mehr-LKW UI-Refresh',e)}catch(_){}
  return false
 }
}

var watchTimer=0,watchRemaining=0;
function watchCurrent(attempts){
 var requested=Math.max(1,Math.round(Number(attempts)||50));
 watchRemaining=Math.max(watchRemaining,requested);
 if(watchTimer)return false;
 function run(){
  watchTimer=0;
  if(panel()){watchRemaining=0;return true}
  var sh=currentMultiTruckShipment();
  if(sh&&refresh(sh)){watchRemaining=0;return true}
  watchRemaining=Math.max(0,watchRemaining-1);
  if(watchRemaining>0)watchTimer=w.setTimeout(run,1000);
  return false
 }
 return run()
}
function schedule(sh){
 if(hasMultiTruck(sh)&&refresh(sh))return true;
 return watchCurrent(50)
}
function scheduleCurrent(){return watchCurrent(50)}

function onSaved(event){
 var detail=event&&event.detail||{},sh=detail.shipment;
 schedule(sh)
}

w.addEventListener('exporthub:shipment-saved',onSaved);
['exporthub:viewchange','exporthub:rendered','exporthub:sync','exporthub:state-loaded','exporthub:shipment-updated'].forEach(function(name){
 w.addEventListener(name,scheduleCurrent)
});
w.addEventListener('click',function(event){
 var target=event&&event.target,button=target&&target.closest&&target.closest('#rc363SaveShipment');
 if(button)watchCurrent(50)
},true);
if(d.readyState==='loading'&&typeof d.addEventListener==='function')d.addEventListener('DOMContentLoaded',scheduleCurrent,{once:true});
else scheduleCurrent();

w.ExportHUBRC1328MultiTruckRefresh=Object.freeze({
 refresh:refresh,
 refreshCurrent:function(){var sh=currentMultiTruckShipment();return sh?refresh(sh):false},
 onSaved:onSaved,
 schedule:schedule,
 scheduleCurrent:scheduleCurrent,
 watchCurrent:watchCurrent,
 currentMultiTruckShipment:currentMultiTruckShipment
});
})(window,document);
