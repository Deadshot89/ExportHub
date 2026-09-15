(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1117_COUNTRY_COMPLETION__)return;
w.__EXPORTHUB_RC1117_COUNTRY_COMPLETION__=true;
var VERSION='RC1117',busy=false,timer=0;
var COUNTRIES=[
 ['DE','Deutschland',['de','deutschland','germany']],
 ['NL','Niederlande',['nl','niederlande','netherlands','the netherlands']],
 ['BE','Belgien',['be','belgien','belgium']],
 ['FR','Frankreich',['fr','frankreich','france']],
 ['IT','Italien',['it','italien','italy']],
 ['ES','Spanien',['es','spanien','spain']],
 ['PT','Portugal',['pt','portugal']],
 ['PL','Polen',['pl','polen','poland']],
 ['SE','Schweden',['se','schweden','sweden']],
 ['NO','Norwegen',['no','norwegen','norway']],
 ['DK','Dänemark',['dk','dänemark','daenemark','denmark']],
 ['FI','Finnland',['fi','finnland','finland']],
 ['GB','Vereinigtes Königreich',['gb','uk','vereinigtes königreich','vereinigtes koenigreich','united kingdom','great britain']],
 ['IE','Irland',['ie','irland','ireland']],
 ['AT','Österreich',['at','österreich','oesterreich','austria']],
 ['CH','Schweiz',['ch','schweiz','switzerland']],
 ['SI','Slowenien',['si','slowenien','slovenia']],
 ['CZ','Tschechien',['cz','tschechien','czech republic','czechia']],
 ['SK','Slowakei',['sk','slowakei','slovakia']],
 ['HU','Ungarn',['hu','ungarn','hungary']],
 ['RO','Rumänien',['ro','rumänien','rumaenien','romania']],
 ['TR','Türkei',['tr','türkei','tuerkei','turkey','türkiye']],
 ['US','USA',['us','usa','u.s.a.','united states','united states of america']],
 ['CA','Kanada',['ca','kanada','canada']],
 ['MX','Mexiko',['mx','mexiko','mexico']],
 ['CN','China',['cn','china','pr china','people\'s republic of china']],
 ['HK','Hongkong',['hk','hongkong','hong kong']],
 ['IN','Indien',['in','indien','india']],
 ['SG','Singapur',['sg','singapur','singapore']],
 ['TH','Thailand',['th','thailand']],
 ['AU','Australien',['au','australien','australia']],
 ['JP','Japan',['jp','japan']],
 ['KR','Südkorea',['kr','südkorea','suedkorea','south korea','republic of korea']]
];
function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function norm(v){return q(v).toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\./g,'')}
function arr(v){return Array.isArray(v)?v:[]}
function state(){try{return typeof w.__EXPORTHUB_GET_STATE__==='function'?(w.__EXPORTHUB_GET_STATE__()||null):(w.ExportHUBClean&&w.ExportHUBClean.state)||w.appState||null}catch(_){return null}}
function countryByCode(code){code=q(code).toUpperCase();return COUNTRIES.find(function(x){return x[0]===code})||null}
function countryFromValue(value){
 var n=norm(value);if(!n)return null;
 for(var i=0;i<COUNTRIES.length;i++){
  var row=COUNTRIES[i],aliases=row[2];
  for(var j=0;j<aliases.length;j++)if(n===norm(aliases[j]))return{code:row[0],name:row[1]};
 }
 return null
}
function rawAddress(x){if(!x||typeof x!=='object')return q(x);return q(x.address||x.fullAddress||x.formattedAddress||x.addressText||x.deliveryAddress||x.recipientAddress||x.shipToAddress||[x.street||x.strasse||x.addressLine1,[x.zip||x.postalCode||x.postcode||x.plz,x.city||x.ort||x.town].filter(Boolean).join(' '),x.country||x.land||x.countryName].filter(Boolean).join(', '))}
function detect(x){
 if(!x)return null;
 if(typeof x==='string')return detectAddress(x);
 var direct=countryFromValue(x.country||x.land||x.countryName||x.countryCode||x.iso||x.iso2);
 return direct||detectAddress(rawAddress(x))
}
function detectAddress(address){
 var parts=String(address||'').split(/[\n,;|]+/).map(q).filter(Boolean);
 if(!parts.length)return null;
 for(var i=parts.length-1;i>=Math.max(0,parts.length-2);i--){var hit=countryFromValue(parts[i]);if(hit)return hit}
 return null
}
function hasCountry(x){return!!q(x&&(x.country||x.land||x.countryName||x.countryCode||x.iso||x.iso2))}
function applyCountry(x,c){if(!x||!c)return false;var changed=false;if(!q(x.country)){x.country=c.name;changed=true}if(!q(x.land)){x.land=c.name;changed=true}if(!q(x.countryCode)){x.countryCode=c.code;changed=true}return changed}
function locations(c){var out=[],seen=[];['locations','sites','standorte','deliveryLocations','shippingLocations','addresses','deliveryAddresses','shipToLocations','shipToAddresses','recipientAddresses','customerLocations'].forEach(function(k){arr(c&&c[k]).forEach(function(x){if(x&&typeof x==='object'&&seen.indexOf(x)<0){seen.push(x);out.push(x)}})});return out}
function enrichCustomer(c){
 if(!c||typeof c!=='object')return{changed:0,unresolved:0,locations:0};
 var changed=0,unresolved=0,locs=locations(c),known=[];
 locs.forEach(function(loc){var hit=detect(loc);if(hit){known.push(hit.code);if(!hasCountry(loc)&&applyCountry(loc,hit))changed++}else if(!hasCountry(loc))unresolved++});
 if(!hasCountry(c)){
  var own=detect(c),unique=Array.from(new Set(known));
  if(!own&&unique.length===1){var row=countryByCode(unique[0]);if(row)own={code:row[0],name:row[1]}}
  if(own&&applyCountry(c,own))changed++;else if(!own)unresolved++;
 }
 return{changed:changed,unresolved:unresolved,locations:locs.length}
}
function enrich(s){
 s=s||state();var customers=arr(s&&s.customers),changed=0,unresolved=0,locationsCount=0;
 customers.forEach(function(c){var r=enrichCustomer(c);changed+=r.changed;unresolved+=r.unresolved;locationsCount+=r.locations});
 if(s&&typeof s==='object'){s.settings=s.settings&&typeof s.settings==='object'?s.settings:{};s.settings.customerCountryAudit={version:VERSION,customers:customers.length,locations:locationsCount,unresolved:unresolved,checkedAt:new Date().toISOString()}}
 return{changed:changed,unresolved:unresolved,customers:customers.length,locations:locationsCount}
}
async function persist(){
 if(busy)return false;var s=state();if(!s)return false;var r=enrich(s),clean=w.ExportHUBClean;
 if(!r.changed)return false;if(!clean||typeof clean.queueSave!=='function'||typeof clean.flushSave!=='function')return false;
 busy=true;try{await Promise.resolve(clean.queueSave('RC1117 Kunden-/Standort-Länder vervollständigt'));var ok=await Promise.resolve(clean.flushSave('RC1117 Kunden-/Standort-Länder vervollständigt',{force:true,userInitiated:false}));return ok!==false}catch(e){try{w.console&&w.console.warn&&w.console.warn('RC1117 Länder-Vervollständigung konnte noch nicht gespeichert werden',e)}catch(_){}return false}finally{busy=false}
}
function schedule(){if(timer&&w.clearTimeout)w.clearTimeout(timer);timer=w.setTimeout(function(){timer=0;persist()},350)}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
['exporthub:ready','exporthub:state-loaded','exporthub:rendered','exporthub:customer-saved','exporthub:customer-updated'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
w.ExportHUBRC1117CountryCompletion=Object.freeze({version:VERSION,countryFromValue:countryFromValue,detectAddress:detectAddress,enrichCustomer:enrichCustomer,enrich:enrich,persist:persist});
})(window,document);