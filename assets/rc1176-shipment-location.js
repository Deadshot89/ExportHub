(function(w,d){
'use strict';
function q(v){return String(v==null?'':v).trim()}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function activeShipment(s){
 try{if(typeof w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'){var x=w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__();if(obj(x))return x}}catch(_){}
 var list=[s&&s.shipment,s&&s.currentShipment,s&&s.selectedShipment,w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.shipment];
 for(var i=0;i<list.length;i++)if(obj(list[i]))return list[i];
 return null
}
function idOf(v){return q(v&&(v.id||v.customerId||v.account||v.customerNumber||v.kundennummer||v.name||v.customerName)).toLowerCase()}
function customerFor(s,sh){
 var wanted=q(sh&&(sh.customerId||sh.customerAccount||sh.customerNumber||sh.customerNo)).toLowerCase();
 var name=q(sh&&(sh.customerName||sh.customer&&sh.customer.name)).toLowerCase();
 var list=arr(s&&s.customers);
 return list.find(function(c){return wanted&&idOf(c)===wanted})||list.find(function(c){return name&&q(c&&(c.name||c.customerName)).toLowerCase()===name})||null
}
function locations(c){
 var out=[];
 [c&&c.locations,c&&c.sites,c&&c.standorte,c&&c.deliveryLocations,c&&c.shippingLocations,c&&c.addresses,c&&c.deliveryAddresses,c&&c.shipToLocations,c&&c.shipToAddresses,c&&c.recipientAddresses,c&&c.customerLocations].forEach(function(list){arr(list).forEach(function(x){if(obj(x))out.push(x)})});
 return out
}
function locationId(loc){return q(loc&&(loc.id||loc.locationId||loc.selectedLocationId||loc.siteId||loc.destinationId||loc.code||loc.number))}
function addressOf(loc){
 if(!obj(loc))return'';
 var direct=q(loc.address||loc.formattedAddress||loc.fullAddress||loc.addressText||loc.deliveryAddress||loc.recipientAddress||loc.shipToAddress);
 if(direct)return direct;
 var street=q(loc.street||loc.strasse||loc.streetName||loc.addressLine1),zip=q(loc.zip||loc.postalCode||loc.postcode||loc.plz),city=q(loc.city||loc.ort||loc.town||loc.place),country=q(loc.country||loc.land||loc.countryName);
 return [street,[zip,city].filter(Boolean).join(' '),country].filter(Boolean).join(', ')
}
function applyLocation(value){
 value=q(value);if(!value)return false;
 var s=state(),sh=activeShipment(s);if(!obj(sh))return false;
 var c=customerFor(s,sh),loc=locations(c).find(function(x){return locationId(x)===value});
 if(!loc)return false;
 var name=q(loc.name||loc.locationName||loc.siteName||loc.standort||loc.city||loc.ort),address=addressOf(loc),country=q(loc.country||loc.land||loc.countryName);
 sh.locationId=value;sh.selectedLocationId=value;sh.siteId=value;sh.destinationId=value;
 if(name){sh.locationName=name;sh.siteName=name}
 if(address){sh.recipientAddress=address;sh.deliveryAddress=address;sh.destinationAddress=address}
 if(country){sh.recipientCountry=country;sh.destinationCountry=country}
 return true
}
function onLocationChange(ev){
 var el=ev&&ev.target;if(!el||el.id!=='index289LocationSelect')return;
 var value=q(el.value);if(!value)return;
 applyLocation(value);
 var later=function(){
  if(!applyLocation(value))return;
  var current=d.getElementById('index289LocationSelect');
  if(current&&q(current.value)!==value)try{current.value=value}catch(_){}
 };
 (w.setTimeout||setTimeout)(later,0)
}
d.addEventListener('change',onLocationChange,true);
w.ExportHUBShipmentLocation1176=Object.freeze({applyLocation:applyLocation});
})(window,document);
