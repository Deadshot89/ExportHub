(function(w,d){
'use strict';
function q(v){return String(v==null?'':v).trim()}
function arr(v){return Array.isArray(v)?v:[]}
function obj(v){return !!v&&typeof v==='object'&&!Array.isArray(v)}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function')return w.__EXPORTHUB_GET_STATE__()||{}}catch(_){}return w.ExportHUBClean&&w.ExportHUBClean.state||w.appState||{}}
function activeShipment(s){
 var draft=s&&s.shipment;
 if(obj(draft))return draft;
 try{if(typeof w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function'){var x=w.__EXPORTHUB_GET_ACTIVE_SHIPMENT__();if(obj(x))return x}}catch(_){}
 var list=[s&&s.currentShipment,s&&s.selectedShipment,w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.shipment];
 for(var i=0;i<list.length;i++)if(obj(list[i]))return list[i];
 return null
}
function customerAliases(c){return [c&&c.id,c&&c.customerId,c&&c.account,c&&c.customerNumber,c&&c.kundennummer,c&&c.name,c&&c.customerName].map(function(v){return q(v).toLowerCase()}).filter(Boolean)}
function shipmentCustomerKey(sh){return q(sh&&(sh.customerId||sh.customerAccount||sh.customerNumber||sh.customerNo||sh.customerName||sh.customer&&sh.customer.name)).toLowerCase()}
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
function locationId(loc){return q(loc&&(loc.id||loc.locationId||loc.selectedLocationId||loc.siteId||loc.destinationId||loc.deliveryLocationId||loc.shipToLocationId||loc.recipientLocationId||loc.code||loc.number))}
function locations(c){
 var out=[];
 [c&&c.locations,c&&c.sites,c&&c.standorte,c&&c.deliveryLocations,c&&c.shippingLocations,c&&c.addresses,c&&c.deliveryAddresses,c&&c.shipToLocations,c&&c.shipToAddresses,c&&c.recipientAddresses,c&&c.customerLocations].forEach(function(list){arr(list).forEach(function(x){if(obj(x))out.push(x)})});
 if(obj(c)&&addressOf(c)){
  var key=q(c.id||c.customerId||c.account||c.customerNumber||'CUSTOMER');
  out.unshift({id:'MAIN-'+key,locationId:'MAIN-'+key,selectedLocationId:'MAIN-'+key,siteId:'MAIN-'+key,destinationId:'MAIN-'+key,deliveryLocationId:'MAIN-'+key,shipToLocationId:'MAIN-'+key,recipientLocationId:'MAIN-'+key,name:q(c.locationName||c.siteName)||'Hauptadresse',address:addressOf(c),country:q(c.country||c.land||c.countryName),_derivedMain:true})
 }
 return out
}
function findLocation(s,active,value){
 var preferred=customerFor(s,active)||customerFor(s,s&&s.shipment),list=locations(preferred),i,loc;
 for(i=0;i<list.length;i++)if(locationId(list[i])===value)return list[i];
 var customers=arr(s&&s.customers);
 for(var c=0;c<customers.length;c++){
  list=locations(customers[c]);
  for(i=0;i<list.length;i++){loc=list[i];if(locationId(loc)===value)return loc}
 }
 return null
}
function shipmentRef(sh){return q(sh&&(sh.ref||sh.reference||sh.shipmentRef||sh.referenceNumber||sh.id||sh.shipmentId)).toUpperCase()}
function targets(s,active){
 var raw=[active,s&&s.shipment,w.ExportHUBClean&&w.ExportHUBClean.runtime&&w.ExportHUBClean.runtime.shipment,s&&s.currentShipment,s&&s.selectedShipment],out=[],ref=shipmentRef(active),customerKey=shipmentCustomerKey(active);
 raw.forEach(function(x){
  if(!obj(x)||out.indexOf(x)>=0)return;
  var sameRef=ref&&shipmentRef(x)===ref,sameCustomer=!ref&&customerKey&&shipmentCustomerKey(x)===customerKey;
  if(x===active||x===(s&&s.shipment)||sameRef||sameCustomer)out.push(x)
 });
 return out
}
function writeLocation(sh,value,loc){
 var name=q(loc.name||loc.locationName||loc.siteName||loc.standort||loc.city||loc.ort),address=addressOf(loc),country=q(loc.country||loc.land||loc.countryName);
 sh.locationId=value;sh.selectedLocationId=value;sh.siteId=value;sh.destinationId=value;sh.deliveryLocationId=value;sh.shipToLocationId=value;sh.recipientLocationId=value;
 if(name){sh.locationName=name;sh.siteName=name;sh.destinationName=name}
 if(address){sh.recipientAddress=address;sh.deliveryAddress=address;sh.destinationAddress=address}
 if(country){sh.recipientCountry=country;sh.destinationCountry=country}
}
function applyLocation(value,expectedCustomerKey){
 value=q(value);if(!value)return false;
 var s=state(),active=activeShipment(s);if(!obj(active))return false;
 var actualCustomerKey=shipmentCustomerKey(active)||shipmentCustomerKey(s&&s.shipment);
 if(expectedCustomerKey&&actualCustomerKey&&expectedCustomerKey!==actualCustomerKey)return false;
 var loc=findLocation(s,active,value);if(!loc)return false;
 targets(s,active).forEach(function(sh){writeLocation(sh,value,loc)});
 return true
}
var pending=null,pendingSeq=0,observer=null;
function clearPending(){pending=null;pendingSeq++}
function currentSelect(){return d.getElementById&&d.getElementById('index289LocationSelect')}
function selectedOptionExists(select,value){
 if(!select||!select.options)return true;
 for(var i=0;i<select.options.length;i++)if(q(select.options[i]&&select.options[i].value)===value)return true;
 return false
}
function repairPending(seq){
 if(!pending||seq!==pendingSeq||Date.now()>pending.expiresAt){if(pending&&Date.now()>pending.expiresAt)pending=null;return false}
 var s=state(),active=activeShipment(s),actualCustomerKey=shipmentCustomerKey(active)||shipmentCustomerKey(s&&s.shipment);
 if(pending.customerKey&&actualCustomerKey&&pending.customerKey!==actualCustomerKey){clearPending();return false}
 var value=pending.value,current=currentSelect();
 if(current&&!selectedOptionExists(current,value))return false;
 var ok=applyLocation(value,pending.customerKey);
 if(current&&q(current.value)!==value)try{current.value=value}catch(_){}
 return ok
}
function scheduleRepairs(seq){
 [0,40,100,220,450,900,1600,2600,4200,6500,9000,12000,15000].forEach(function(delay){(w.setTimeout||setTimeout)(function(){repairPending(seq)},delay)})
}
function onLocationChange(ev){
 var el=ev&&ev.target;if(!el||el.id!=='index289LocationSelect')return;
 var value=q(el.value),s=state(),active=activeShipment(s);
 pendingSeq++;
 if(!value){pending=null;return}
 pending={value:value,customerKey:shipmentCustomerKey(active)||shipmentCustomerKey(s&&s.shipment),expiresAt:Date.now()+18000};
 applyLocation(value,pending.customerKey);
 scheduleRepairs(pendingSeq)
}
function onCustomerInput(ev){
 var el=ev&&ev.target,id=q(el&&el.id);
 if(id!=='shipmentCustomerSearch'&&id!=='index289CustomerSearch'&&id!=='shipmentCustomer')return;
 if(!pending)return;
 var seq=pendingSeq,expectedCustomerKey=pending.customerKey;
 (w.setTimeout||setTimeout)(function(){
  if(!pending||seq!==pendingSeq)return;
  var s=state(),active=activeShipment(s),actualCustomerKey=shipmentCustomerKey(active)||shipmentCustomerKey(s&&s.shipment);
  if(expectedCustomerKey&&actualCustomerKey&&expectedCustomerKey!==actualCustomerKey){clearPending();return}
  repairPending(seq)
 },0)
}
function onRendered(){if(pending)repairPending(pendingSeq)}
w.addEventListener('change',onLocationChange,true);
w.addEventListener('input',onCustomerInput,true);
w.addEventListener('change',onCustomerInput,true);
['exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:shipment-saved'].forEach(function(name){try{w.addEventListener(name,onRendered)}catch(_){}});
if(typeof MutationObserver!=='undefined'){
 try{
  observer=new MutationObserver(function(){if(pending)repairPending(pendingSeq)});
  observer.observe(d.documentElement||d.body,{childList:true,subtree:true})
 }catch(_){}
}
w.ExportHUBShipmentLocation1176=Object.freeze({version:'RC1196',applyLocation:applyLocation,repairPending:function(){return repairPending(pendingSeq)},clearPending:clearPending});
})(window,document);
