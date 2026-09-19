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
function customerAliases(c){return [c&&c.id,c&&c.customerId,c&&c.account,c&&c.customerNumber,c&&c.kundennummer,c&&c.name,c&&c.customerName].map(function(v){return q(v).toLowerCase()}).filter(Boolean)}
function customerFor(s,sh){
 var wanted=[sh&&sh.customerId,sh&&sh.customerAccount,sh&&sh.customerNumber,sh&&sh.customerNo,sh&&sh.customerName,sh&&sh.customer&&sh.customer.name].map(function(v){return q(v).toLowerCase()}).filter(Boolean);
 var list=arr(s&&s.customers);
 return list.find(function(c){var aliases=customerAliases(c);return wanted.some(function(v){return aliases.indexOf(v)>=0})})||null
}
function addressOf(loc){
 if(!obj(loc))return'';
 var direct=q(loc.address||loc.formattedAddress||loc.fullAddress||loc.addressText||loc.deliveryAddress||loc.recipientAddress||loc.shipToAddress);
 if(direct)return direct;
 var street=q(loc.street||loc.strasse||loc.streetName||loc.addressLine1),zip=q(loc.zip||loc.postalCode||loc.postcode||loc.plz),city=q(loc.city||loc.ort||loc.town||loc.place),country=q(loc.country||loc.land||loc.countryName);
 return [street,[zip,city].filter(Boolean).join(' '),country].filter(Boolean).join(', ')
}
function locationId(loc){return q(loc&&(loc.id||loc.locationId||loc.selectedLocationId||loc.siteId||loc.destinationId||loc.code||loc.number))}
function locations(c){
 var out=[];
 [c&&c.locations,c&&c.sites,c&&c.standorte,c&&c.deliveryLocations,c&&c.shippingLocations,c&&c.addresses,c&&c.deliveryAddresses,c&&c.shipToLocations,c&&c.shipToAddresses,c&&c.recipientAddresses,c&&c.customerLocations].forEach(function(list){arr(list).forEach(function(x){if(obj(x))out.push(x)})});
 if(obj(c)&&addressOf(c)){
  var key=q(c.id||c.customerId||c.account||c.customerNumber||'CUSTOMER');
  out.unshift({id:'MAIN-'+key,locationId:'MAIN-'+key,selectedLocationId:'MAIN-'+key,siteId:'MAIN-'+key,destinationId:'MAIN-'+key,name:q(c.locationName||c.siteName)||'Hauptadresse',address:addressOf(c),country:q(c.country||c.land||c.countryName),_derivedMain:true})
 }
 return out
}
function shipmentRef(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)).toUpperCase()}
function targets(s,active){
 var raw=[active,s&&s.shipment,w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.shipment,s&&s.currentShipment,s&&s.selectedShipment],out=[],ref=shipmentRef(active);
 raw.forEach(function(x){
  if(!obj(x)||out.indexOf(x)>=0)return;
  if(x===active||x===(s&&s.shipment)||!ref||shipmentRef(x)===ref)out.push(x)
 });
 return out
}
function writeLocation(sh,value,loc){
 var name=q(loc.name||loc.locationName||loc.siteName||loc.standort||loc.city||loc.ort),address=addressOf(loc),country=q(loc.country||loc.land||loc.countryName);
 sh.locationId=value;sh.selectedLocationId=value;sh.siteId=value;sh.destinationId=value;
 if(name){sh.locationName=name;sh.siteName=name}
 if(address){sh.recipientAddress=address;sh.deliveryAddress=address;sh.destinationAddress=address}
 if(country){sh.recipientCountry=country;sh.destinationCountry=country}
}
function applyLocation(value){
 value=q(value);if(!value)return false;
 var s=state(),active=activeShipment(s);if(!obj(active))return false;
 var c=customerFor(s,active)||customerFor(s,s&&s.shipment),loc=locations(c).find(function(x){return locationId(x)===value});
 if(!loc)return false;
 targets(s,active).forEach(function(sh){writeLocation(sh,value,loc)});
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
