(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1328_MULTI_TRUCK_REFRESH__)return;
w.__EXPORTHUB_RC1328_MULTI_TRUCK_REFRESH__=true;

function arr(v){return Array.isArray(v)?v:[]}
function hasMultiTruck(sh){return !!(sh&&arr(sh.subShipments).length>1)}
function card(){return d.getElementById('rc380StowPlan')}
function panel(){return d.getElementById('rc1017-subshipments')}

function refresh(sh){
 if(!hasMultiTruck(sh))return false;
 if(panel())return true;
 if(!card())return false;
 if(typeof w.rc1017SyncSubShipments!=='function')return false;
 try{
  w.rc1017SyncSubShipments(sh);
  return !!panel()
 }catch(e){
  try{console.warn('RC1328 Mehr-LKW UI-Refresh',e)}catch(_){}
  return false
 }
}

function schedule(sh){
 var delays=[0,100,400,1000,2500,6000];
 delays.forEach(function(delay){
  w.setTimeout(function(){
   if(!hasMultiTruck(sh)||panel())return;
   refresh(sh)
  },delay)
 })
}

function onSaved(event){
 var detail=event&&event.detail||{},sh=detail.shipment;
 if(!hasMultiTruck(sh))return;
 schedule(sh)
}

w.addEventListener('exporthub:shipment-saved',onSaved);
w.addEventListener('exporthub:viewchange',function(){
 try{
  var state=typeof w.__EXPORTHUB_GET_STATE__==='function'?w.__EXPORTHUB_GET_STATE__():null;
  var sh=state&&(state.shipment||state.currentShipment);
  if(hasMultiTruck(sh))schedule(sh)
 }catch(_){}
});
w.ExportHUBRC1328MultiTruckRefresh=Object.freeze({refresh:refresh,onSaved:onSaved,schedule:schedule});
})(window,document);
