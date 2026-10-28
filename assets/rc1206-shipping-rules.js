(()=>{
'use strict';
if(window.__EXPORTHUB_RC1206_SHIPPING_RULES__)return;window.__EXPORTHUB_RC1206_SHIPPING_RULES__=true;
var UPS_ZONES={"BE":{"fallback":"3"},"BG":{"fallback":"41"},"DK":{"fallback":"3"},"DE":{"fallback":"1"},"GB":{"fallback":"704"},"EE":{"fallback":"41"},"FI":{"fallback":"4"},"FR":{"fallback":"4"},"GR":{"fallback":"5"},"IE":{"fallback":"5"},"IT":{"ranges":[["10000","50999","4"]],"fallback":"5"},"HR":{"fallback":"31"},"LV":{"fallback":"41"},"LI":{"fallback":"6"},"LT":{"fallback":"41"},"LU":{"fallback":"3"},"MC":{"fallback":"4"},"NL":{"fallback":"3"},"NO":{"fallback":"6"},"AT":{"fallback":"4"},"PL":{"fallback":"31"},"PT":{"fallback":"5"},"RO":{"fallback":"41"},"SE":{"fallback":"4"},"CH":{"fallback":"6"},"SK":{"fallback":"31"},"SI":{"fallback":"31"},"ES":{"fallback":"5"},"CZ":{"fallback":"3"},"HU":{"fallback":"41"}},UPS_RATES={"1":[[1,3.27],[2,3.27],[3,4.35],[4,4.35],[5,4.35],[10,4.35],[20,4.35],[30,9.43],[40,13.84],[50,16.48],[55,16.92],[60,17.41],[65,17.88],[70,18.35]],"3":[[1,7.93],[4,7.93],[5,8.55],[20,8.55],[30,27.71],[40,38.58],[50,50.96],[55,55.77],[60,60.61],[65,65.31],[70,70.23]],"4":[[1,12.66],[4,12.66],[5,13.36],[20,13.36],[30,42.1],[40,59.55],[50,78.03],[55,85.67],[60,93.2],[65,100.82],[70,108.35]],"5":[[1,16.88],[4,16.88],[5,22.29],[20,22.29],[30,54.56],[40,78.07],[50,97.36],[55,104.82],[60,112.41],[65,119.94],[70,127.47]],"6":[[1,17.39],[4,17.39],[5,18.03],[10,18.8],[20,25.59],[30,63.13],[40,97.66],[50,132.21],[55,138.96],[60,145.7],[65,152.35],[70,159.11]],"31":[[1,14.69],[4,14.69],[5,14.95],[20,14.95],[30,34.2],[40,54.89],[50,66.12],[55,71.76],[60,77.49],[65,83.23],[70,88.93]],"41":[[1,15.08],[4,15.08],[5,15.91],[20,15.91],[30,39.12],[40,68.46],[50,89.01],[55,97.06],[60,105.11],[65,113.17],[70,121.16]],"505":[[1,12.66],[4,12.66],[5,13.36],[20,13.36],[30,42.1],[40,59.55],[50,78.03],[55,85.67],[60,93.2],[65,100.82],[70,108.35]]};
function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function tr(key,vars){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.t==='function')return window.ExportHUBI18n.t(key,vars)}catch(_){}return key}
function currentLanguage(){try{return window.ExportHUBI18n&&typeof window.ExportHUBI18n.language==='function'?window.ExportHUBI18n.language():'de'}catch(_){return'de'}}
function countryDisplay(cc){try{return new Intl.DisplayNames([currentLanguage()],{type:'region'}).of(cc)||cc}catch(_){return cc}}
function num(v){var raw=String(v==null?'':v).trim().replace(/\s+/g,'').replace(/[^0-9,.-]/g,'');if(!raw)return 0;var neg=raw.charAt(0)==='-';raw=raw.replace(/-/g,'');var comma=raw.lastIndexOf(','),dot=raw.lastIndexOf('.');if(comma>=0&&dot>=0){if(comma>dot)raw=raw.replace(/\./g,'').replace(',','.');else raw=raw.replace(/,/g,'')}else if(comma>=0)raw=raw.replace(/\./g,'').replace(',','.');else raw=raw.replace(/,/g,'');var n=Number((neg?'-':'')+raw);return Number.isFinite(n)?n:0}
function section(kind){return document.querySelector('#rc626Shipping [data-section="'+kind+'"]')||document.querySelector('#rc626Shipping .rc501-'+kind)||null}
function packagingSelect(kind){var root=section(kind);if(!root)return null;return root.querySelector('[data-rc501-field="packaging"]')||Array.from(root.querySelectorAll('select')).find(function(s){var p=q((s.closest('label')||s.parentElement||{}).textContent);return /verpackung|packaging/i.test(p)})||null}
function restrictPackaging(kind,rule,label){var s=packagingSelect(kind);if(!s)return false;var opts=Array.from(s.options||[]),allowed=opts.filter(function(o){var text=q(o.textContent)+' '+q(o.value);return typeof rule==='function'?!!rule(text,o):rule.test(text)});opts.forEach(function(o){var ok=allowed.indexOf(o)>=0;if(o.disabled===ok)o.disabled=!ok;if(o.hidden===ok)o.hidden=!ok});if(allowed.length&&allowed.indexOf(s.options[s.selectedIndex])<0){s.value=allowed[0].value;s.dispatchEvent(new Event('change',{bubbles:true}))}if(!s.getAttribute||s.getAttribute('data-rc1206-packaging')!==label)s.setAttribute('data-rc1206-packaging',label);return allowed.length>0}
function inputByLabel(root,rx){if(!root)return null;var nodes=Array.from(root.querySelectorAll('input,select'));return nodes.find(function(el){var host=el.closest('label,.rc501-field,.field,.form-group')||el.parentElement;return rx.test(q(host&&host.textContent))})||null}
function packageCount(){var load=canonicalLoad('ups');if(load.count>0)return load.count;var root=section('ups'),el=root&&(root.querySelector('[data-rc501-field="packages"],[data-rc501-field="packageCount"],[data-rc501-field="count"],[data-rc501-field="colli"]')||inputByLabel(root,/pakete|kartons|anzahl|colli/i)),entered=Math.round(num(el&&el.value));if(entered>0)return entered;var individual=upsIndividualWeights();if(individual.length)return individual.length;return 1}
function moneyFromLine(root,rx){var lines=Array.from(root.querySelectorAll('.rc501-result-line,div,tr'));for(var i=0;i<lines.length;i++){var t=q(lines[i].textContent);if(rx.test(t)){var b=lines[i].querySelector('b,strong,[id]');var n=num(b?q(b.textContent):t);if(n>=0)return n}}return 0}
function validUpsPostal(cc,pc){pc=q(pc).toUpperCase().replace(/[\s-]/g,'');if(cc==='NL')return /^[0-9]{4}[A-Z]{2}$/.test(pc);if(cc==='GB')return /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/.test(pc);return /^[0-9]{4,5}$/.test(pc)}
function resolveUpsZone(cc,pc){cc=q(cc).toUpperCase();pc=q(pc).toUpperCase().replace(/[\s-]/g,'');var d=UPS_ZONES[cc];if(!d)return'';var n=Number(pc.replace(/\D/g,''));if(d.ranges&&n){for(var i=0;i<d.ranges.length;i++){var r=d.ranges[i];if(n>=Number(r[0])&&n<=Number(r[1]))return r[2]}}return d.fallback||''}
function upsRate(zone,kg){var a=UPS_RATES[String(zone)]||[];kg=Math.max(.01,Number(kg)||0);for(var i=0;i<a.length;i++)if(kg<=a[i][0])return a[i][1];return 0}
function upsIndividualWeights(){try{var rows=candidateRows(),out=[];rows.forEach(function(r){r=r||{};var type=packageType(r),n=rowCount(r),w=rowWeight(r);if(w>0&&(!type||isUpsPackageType(type))){var each=w/Math.max(1,n);for(var j=0;j<Math.max(1,n);j++)out.push(each)}});return out}catch(_){return[]}}
function upsIndividualBase(zone,weights){var total=0;for(var i=0;i<weights.length;i++){var r=upsRate(zone,weights[i]);if(!r)return 0;total+=r}return Math.round(total*100)/100}
function upsTotalWeight(){var load=canonicalLoad('ups');if(load.totalWeight>0)return load.totalWeight;var individual=upsIndividualWeights();if(individual.length)return individual.reduce(function(sum,v){return sum+(Number(v)||0)},0);var r=section('ups'),e=r&&inputByLabel(r,/gesamt.*gewicht|gewicht.*gesamt|total.*weight/i),entered=num(e&&e.value);if(entered>0)return entered;var sh=activeShipment();return num(sh.totalWeight||sh.grossWeight||sh.weight||sh.gesamtgewicht||sh.bruttogewicht)}
function euro(v){try{if(window.ExportHUBI18n&&typeof window.ExportHUBI18n.formatCurrency==='function')return window.ExportHUBI18n.formatCurrency(Number(v||0),'EUR')}catch(_){}return new Intl.NumberFormat(undefined,{style:'currency',currency:'EUR'}).format(Number(v||0))}
function countryCode(v){var raw=q(v).toUpperCase(),x=raw,m={DEUTSCHLAND:'DE',GERMANY:'DE',NIEDERLANDE:'NL',NEDERLAND:'NL',NEDERLANDS:'NL',NETHERLANDS:'NL','THE NETHERLANDS':'NL',HOLLAND:'NL',BELGIEN:'BE',BELGIUM:'BE',LUXEMBURG:'LU',LUXEMBOURG:'LU',FRANKREICH:'FR',FRANCE:'FR',ITALIEN:'IT',ITALIA:'IT',ITALY:'IT',POLEN:'PL',POLAND:'PL',TSCHECHIEN:'CZ',CZECHIA:'CZ','CZECH REPUBLIC':'CZ','ÖSTERREICH':'AT',OESTERREICH:'AT',AUSTRIA:'AT',SCHWEIZ:'CH',SWITZERLAND:'CH',SPANIEN:'ES',SPAIN:'ES',PORTUGAL:'PT',DÄNEMARK:'DK',DAENEMARK:'DK',DENMARK:'DK',SCHWEDEN:'SE',SWEDEN:'SE',NORWEGEN:'NO',NORWAY:'NO',FINNLAND:'FI',FINLAND:'FI',IRLAND:'IE',IRELAND:'IE',UNGARN:'HU',HUNGARY:'HU',SLOWAKEI:'SK',SLOVAKIA:'SK',SLOWENIEN:'SI',SLOVENIA:'SI',KROATIEN:'HR',CROATIA:'HR',RUMÄNIEN:'RO',RUMANIEN:'RO',ROMANIA:'RO',BULGARIEN:'BG',BULGARIA:'BG',GRIECHENLAND:'GR',GREECE:'GR',ESTLAND:'EE',ESTONIA:'EE',LETTLAND:'LV',LATVIA:'LV',LITAUEN:'LT',LITHUANIA:'LT',LIECHTENSTEIN:'LI',MONACO:'MC','VEREINIGTES KÖNIGREICH':'GB','VEREINIGTES KOENIGREICH':'GB','UNITED KINGDOM':'GB','GREAT BRITAIN':'GB',GROSSBRITANNIEN:'GB','GROßBRITANNIEN':'GB',UK:'GB',TÜRKEI:'TR',TURKEI:'TR',TURKEY:'TR',SERBIEN:'RS',SERBIA:'RS','BOSNIEN UND HERZEGOWINA':'BA','BOSNIA AND HERZEGOVINA':'BA',NORDMAZEDONIEN:'MK','NORTH MACEDONIA':'MK',MAZEDONIEN:'MK',MACEDONIA:'MK',ALBANIEN:'AL',ALBANIA:'AL',ZYPERN:'CY',CYPRUS:'CY',MALTA:'MT',USA:'US','UNITED STATES':'US','UNITED STATES OF AMERICA':'US'};if(UPS_ZONES[x])return x;if(/^(TR|US|RS|BA|MK|AL|CY|MT)$/.test(x))return x;if(m[x])return m[x];var code=raw.match(/(?:^|[\s,(\[/_-])(DE|NL|BE|BG|DK|GB|EE|FI|FR|GR|IE|IT|HR|LV|LI|LT|LU|MC|NO|AT|PL|PT|RO|SE|CH|SK|SI|ES|CZ|HU|TR|US|RS|BA|MK|AL|CY|MT)(?:$|[\s,)\]/_-])/);if(code)return code[1];var keys=Object.keys(m).sort(function(a,b){return b.length-a.length});for(var i=0;i<keys.length;i++){var k=keys[i];if(raw.indexOf(k)>=0)return m[k]}return''}
function state(){try{return typeof window.__EXPORTHUB_GET_STATE__==='function'?(window.__EXPORTHUB_GET_STATE__()||{}):(typeof window.state==='function'?(window.state()||{}):(window.appState||window.__EXPORTHUB_STATE__||{}))}catch(_){return window.appState||window.__EXPORTHUB_STATE__||{}}}
function activeShipment(){var s=state(),c=[];try{if(typeof window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function')c.push(window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__())}catch(_){}var key=q(s.currentShipmentId||s.selectedShipmentId||s.activeShipmentId||s.openShipmentId||s.currentShipmentRef||s.selectedShipmentRef||s.activeShipmentRef||s.openShipmentRef),pool=(Array.isArray(s.shipments)?s.shipments:[]).concat(Array.isArray(s.savedShipments)?s.savedShipments:[]);if(key)pushMatch:for(var p=0;p<pool.length;p++){var sh=pool[p];if([sh&&sh.id,sh&&sh.shipmentId,sh&&sh.ref,sh&&sh.reference].some(function(v){return q(v)===key})){c.push(sh);break pushMatch}}c.push(s.currentShipment,s.selectedShipment,s.activeShipment,s.openShipment,s.shipment);for(var i=0;i<c.length;i++)if(c[i]&&typeof c[i]==='object')return c[i];return{}}
function inferCountryFromAddress(v){var raw=q(v).toUpperCase();if(!raw)return'';var direct=countryCode(raw);if(direct)return direct;var pref=raw.match(/\b(DE|NL|BE|BG|DK|GB|EE|FI|FR|GR|IE|IT|HR|LV|LI|LT|LU|MC|NO|AT|PL|PT|RO|SE|CH|SK|SI|ES|CZ|HU|TR|US|RS|BA|MK|AL|CY|MT)\s*[- ]\s*[A-Z0-9]{3,10}\b/);if(pref)return pref[1];var m=raw.match(/\b([0-9]{5})\b[\s\S]*\b([A-Z]{2})\b\s*$/),it='|AG|AL|AN|AO|AP|AQ|AR|AT|AV|BA|BG|BI|BL|BN|BO|BR|BS|BT|BZ|CA|CB|CE|CH|CI|CL|CN|CO|CR|CS|CT|CZ|EN|FC|FE|FG|FI|FM|FR|GE|GO|GR|IM|IS|KR|LC|LE|LI|LO|LT|LU|MB|MC|ME|MI|MN|MO|MS|MT|NA|NO|NU|OR|PA|PC|PD|PE|PG|PI|PN|PO|PR|PT|PU|PV|PZ|RA|RC|RE|RG|RI|RM|RN|RO|SA|SI|SO|SP|SR|SS|SU|SV|TA|TE|TN|TO|TP|TR|TS|TV|UD|VA|VB|VC|VE|VI|VR|VS|VT|VV|';if(m&&it.indexOf('|'+m[2]+'|')>=0)return'IT';return''}
function shippingCustomer(s,sh){var wanted=[sh&&sh.customerId,sh&&sh.customerAccount,sh&&sh.customerNumber,sh&&sh.customerNo,sh&&sh.customerName,sh&&sh.customer&&sh.customer.name].map(function(v){return q(v).toLowerCase()}).filter(Boolean),list=Array.isArray(s&&s.customers)?s.customers:[];return list.find(function(c){var aliases=[c&&c.id,c&&c.customerId,c&&c.account,c&&c.customerNumber,c&&c.kundennummer,c&&c.name,c&&c.customerName].map(function(v){return q(v).toLowerCase()}).filter(Boolean);return wanted.some(function(v){return aliases.indexOf(v)>=0})})||null}
function shippingLocation(c,sh){
 var embedded=sh&&(sh.locationData||sh.siteData||sh.selectedLocation||sh.location||sh.deliveryLocation||sh.shippingLocation||sh.shipToLocation||sh.recipientLocation||sh.destination);
 var wanted=q(sh&&(sh.selectedLocationId||sh.locationId||sh.siteId||sh.destinationId||sh.deliveryLocationId||sh.shipToLocationId||sh.recipientLocationId));
 if(wanted&&c&&typeof c==='object'){
  var lists=[c.locations,c.sites,c.standorte,c.deliveryLocations,c.shippingLocations,c.addresses,c.deliveryAddresses,c.shipToLocations,c.shipToAddresses,c.recipientAddresses,c.customerLocations],all=[];
  for(var i=0;i<lists.length;i++)if(Array.isArray(lists[i]))all=all.concat(lists[i]);
  var hit=all.find(function(loc){var id=q(loc&&(loc.id||loc.locationId||loc.selectedLocationId||loc.siteId||loc.destinationId||loc.deliveryLocationId||loc.shipToLocationId||loc.recipientLocationId||loc.code||loc.number));return id&&id===wanted});
  if(hit)return hit;
  if(wanted==='MAIN-'+q(c.id||c.customerId||c.account||c.customerNumber||'CUSTOMER'))return c;
 }
 if(embedded&&typeof embedded==='object'&&!Array.isArray(embedded)){
  var embeddedId=q(embedded.id||embedded.locationId||embedded.selectedLocationId||embedded.siteId||embedded.destinationId||embedded.deliveryLocationId||embedded.shipToLocationId||embedded.recipientLocationId||embedded.code||embedded.number);
  if(!wanted||!embeddedId||wanted===embeddedId)return embedded;
 }
 return null;
}
function shippingAddress(v){if(!v||typeof v!=='object'||Array.isArray(v))return q(v);var direct=q(v.address||v.formattedAddress||v.fullAddress||v.addressText||v.deliveryAddress||v.recipientAddress||v.shipToAddress);if(direct)return direct;return q([v.street||v.strasse||v.streetName||v.addressLine1,v.addressLine2||v.address2,v.postalCode||v.postcode||v.zip||v.plz,v.city||v.ort||v.town||v.place,v.country||v.land||v.countryName].filter(Boolean).join(' '))}
function shippingPostal(v){if(!v||typeof v!=='object'||Array.isArray(v))return'';return q(v.postalCode||v.postcode||v.zip||v.plz)}
function shipmentCandidates(){
 var s=state(),out=[];
 function push(x){if(x&&typeof x==='object'&&!Array.isArray(x)&&out.indexOf(x)<0)out.push(x)}
 var key=q(s.currentShipmentId||s.selectedShipmentId||s.activeShipmentId||s.openShipmentId||s.currentShipmentRef||s.selectedShipmentRef||s.activeShipmentRef||s.openShipmentRef),pool=(Array.isArray(s.shipments)?s.shipments:[]).concat(Array.isArray(s.savedShipments)?s.savedShipments:[]);
 if(key)push(pool.find(function(sh){return[sh&&sh.id,sh&&sh.shipmentId,sh&&sh.ref,sh&&sh.reference].some(function(v){return q(v)===key})}));
 push(s.currentShipment);push(s.selectedShipment);push(s.activeShipment);push(s.openShipment);
 try{if(typeof window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__==='function')push(window.__EXPORTHUB_GET_ACTIVE_SHIPMENT__())}catch(_){}
 push(s.shipment);
 var active=activeShipment(),ids=[active&&active.id,active&&active.shipmentId,active&&active.ref,active&&active.reference,active&&active.shipmentRef].map(function(v){return q(v).toUpperCase()}).filter(Boolean);
 if(!ids.length)return out;
 // Another shipment's longer Colli list must not override the opened shipment.
 // Copies of the SAME shipment may contribute more complete details.
 return out.filter(function(sh){
  if(sh===active)return true;
  return[sh.id,sh.shipmentId,sh.ref,sh.reference,sh.shipmentRef].some(function(v){return q(v)&&ids.indexOf(q(v).toUpperCase())>=0})
 });
}
function packageType(r){return q(r&&(r.type||r.packaging||r.verpackung||r.packageType||r.packagingType||r.name||r.label))}
function isPalletType(v){return /palette|palett|pallet|skid/i.test(q(v))}
function isUpsPackageType(v){var x=q(v);return !!x&&!isPalletType(x)&&(/karton|carton|package|paket|umschlag|envelope|holzbox|wood(?:en)?\s*box|crate|kiste|\be[0-6]\b/i.test(x))}
function rowCount(r){return Math.max(0,Math.round(num(r&&(r.count||r.quantity||r.qty||r.anzahl||r.pieces||r.colliCount))||1))}
function rowWeight(r){return Math.max(0,num(r&&(r.weight||r.gewicht||r.kg||r.totalWeight||r.weightTotal||r.rowWeight||r.grossWeight||r.totalKg||r.gewichtGesamt)))}
function rowDim(r,key){var aliases=key==='l'?['l','length','lengthCm','laenge','länge']:key==='w'?['w','width','widthCm','breite']:['h','height','heightCm','hoehe','höhe'];for(var i=0;i<aliases.length;i++){var v=num(r&&r[aliases[i]]);if(v>0)return v}return 0}
function candidateListScore(list){var recognized=0,typed=0,details=0;list.forEach(function(r){r=r||{};var t=packageType(r),rawCount=num(r.count||r.quantity||r.qty||r.anzahl||r.pieces||r.colliCount);if(t){typed++;if(isPalletType(t)||isUpsPackageType(t))recognized++}if(rawCount>0)details+=3;if(rowWeight(r)>0)details+=3;if(rowDim(r,'l')>0)details++;if(rowDim(r,'w')>0)details++;if(rowDim(r,'h')>0)details++});return recognized*100000+typed*1000+details*10+Math.min(list.length,99)}
function candidateRows(){var cs=shipmentCandidates(),best=[],bestScore=-1;for(var i=0;i<cs.length;i++){var sh=cs[i]||{},lists=[sh.packagingRows,sh.packageRows,sh.colliRows,sh.colli,sh.collis,sh.packages,sh.handlingUnits,sh.shipmentRows,sh.rows,sh.items,sh.lines];for(var j=0;j<lists.length;j++){var list=lists[j];if(!Array.isArray(list)||!list.length)continue;var score=candidateListScore(list);if(score>bestScore){best=list;bestScore=score}}}return best}
function canonicalPackageItems(rows){return(rows||[]).map(function(r){var n=rowCount(r),type=packageType(r);return{count:n,totalWeight:rowWeight(r),length:rowDim(r,'l'),width:rowDim(r,'w'),height:rowDim(r,'h'),type:type}}).filter(function(x){return x.count>0&&(x.type||x.totalWeight>0||x.length>0||x.width>0||x.height>0)})}
function canonicalLoad(kind){var rows=candidateRows(),selected=rows.filter(function(r){return kind==='gate'?isPalletType(packageType(r)):isUpsPackageType(packageType(r))});if(!selected.length&&kind==='ups')selected=rows.filter(function(r){return !isPalletType(packageType(r))&&!!packageType(r)});var count=0,totalWeight=0,ldm=0,types=[],dims=[];selected.forEach(function(r){var n=rowCount(r),t=packageType(r),l=rowDim(r,'l'),w=rowDim(r,'w'),h=rowDim(r,'h');count+=n;totalWeight+=rowWeight(r);ldm+=Math.max(0,num(r&&(r.actualLdm!==undefined?r.actualLdm:r.ldm)))*(r&&r.actualLdm!==undefined?1:n);if(t&&types.indexOf(t)<0)types.push(t);if(l>0&&w>0&&h>0)dims.push(l+'x'+w+'x'+h)});var sameDims=dims.length===selected.length&&dims.length>0&&dims.every(function(x){return x===dims[0]}),first=selected[0]||{};return{rows:selected,count:count,totalWeight:totalWeight,packaging:types.length===1?types[0]:'',l:sameDims?rowDim(first,'l'):0,w:sameDims?rowDim(first,'w'):0,h:sameDims?rowDim(first,'h'):0,ldm:ldm,packageItems:canonicalPackageItems(selected)}}
function shippingField(kind,names,rx){for(var i=0;i<names.length;i++){var e=document.querySelector('#rc626Shipping [data-section="'+kind+'"][data-rc501-field="'+names[i]+'"]');if(e)return e}var root=section(kind);if(root&&root.querySelector){for(var j=0;j<names.length;j++){var x=root.querySelector('[data-rc501-field="'+names[j]+'"]');if(x)return x}if(rx)return inputByLabel(root,rx)}return null}
function setAutoValue(el,value){if(!el||value===undefined||value===null||value==='')return false;if(document.activeElement===el)return false;var next=String(value);if(String(el.value==null?'':el.value)===next)return false;if(el.tagName==='SELECT'&&el.options){var opt=Array.from(el.options).find(function(o){return q(o.value).toLowerCase()===q(next).toLowerCase()||q(o.textContent).toLowerCase()===q(next).toLowerCase()});if(!opt)return false;el.value=opt.value}else el.value=next;return true}
function shipmentDestination(){var s=state(),sh=activeShipment(),customer=shippingCustomer(s,sh),loc=shippingLocation(customer,sh),locAddress=shippingAddress(loc),rawAddress=locAddress||sh.recipientAddress||sh.destinationAddress||sh.deliveryAddress||sh.shipToAddress||sh.address,nested=rawAddress&&typeof rawAddress==='object'&&!Array.isArray(rawAddress)?rawAddress:{},address=shippingAddress(rawAddress),postal=shippingPostal(loc)||q(sh.recipientPostalCode||sh.destinationPostalCode||sh.deliveryPostalCode||sh.shipToPostalCode||sh.postalCode||sh.postcode||sh.zip||sh.plz||nested.postalCode||nested.postcode||nested.zip||nested.plz),locationCountry=countryCode(loc&&(loc.countryCode||loc.country||loc.land||loc.countryName||loc.iso||loc.iso2)),fromAddress=inferCountryFromAddress(address),direct=countryCode(sh.recipientCountry||sh.destinationCountry||sh.deliveryCountry||sh.shipToCountry||nested.countryCode||nested.country),customerCountry=countryCode(customer&&(customer.countryCode||customer.country||customer.land||customer.countryName||customer.iso||customer.iso2)),fallback=countryCode(sh.countryCode||sh.country||sh.land);if(!postal&&address){var m=address.match(/\b[0-9]{4,5}(?:\s?[A-Z]{2})?\b/i);if(m)postal=q(m[0])}return{country:locationCountry||(locAddress?inferCountryFromAddress(locAddress):'')||direct||fromAddress||customerCountry||fallback,address:address,postal:postal}}
function syncCanonicalShippingState(){var s=state(),dest=shipmentDestination(),ups=canonicalLoad('ups'),gate=canonicalLoad('gate'),costs=s.shippingCosts||(s.shippingCosts={}),u=costs.ups||(costs.ups={}),g=costs.gate||(costs.gate={}),changed=false;function set(obj,key,value){if(value===undefined||value===null||value==='')return;if(String(obj[key]==null?'':obj[key])!==String(value)){obj[key]=value;changed=true}}if(!u.manualRoute){if(dest.country)set(u,'destinationCountry',countryDisplay(dest.country));if(dest.postal)set(u,'destinationPostal',dest.postal)}if(!g.manualRoute){if(dest.country)set(g,'country',countryDisplay(dest.country));if(dest.postal)set(g,'destinationPostal',dest.postal)}if(ups.rows.length&&!u.manualLoad){set(u,'packages',ups.count);set(u,'totalKg',ups.totalWeight);if(ups.packaging)set(u,'packaging',ups.packaging);if(ups.l>0)set(u,'length',ups.l);if(ups.w>0)set(u,'width',ups.w);if(ups.h>0)set(u,'height',ups.h);if(JSON.stringify(u.packageItems||[])!==JSON.stringify(ups.packageItems)){u.packageItems=ups.packageItems.map(function(x){return Object.assign({},x)});changed=true}}if(gate.rows.length&&!g.manualLoad){set(g,'pallets',gate.count);set(g,'totalWeight',gate.totalWeight);if(gate.packaging)set(g,'packaging',gate.packaging);if(gate.ldm>0)set(g,'totalLdm',Math.round(gate.ldm*100)/100)}return changed}
function installLegacyBridge(){var legacy=window.syncCostFromShipment;if(typeof legacy!=='function'||legacy.__rc1548CanonicalBridge)return false;function bridged(){var changed=!!legacy.apply(this,arguments);return syncCanonicalShippingState()||changed}bridged.__rc1548CanonicalBridge=true;bridged.__rc1548Legacy=legacy;window.syncCostFromShipment=bridged;return true}
function syncShipmentCostFields(){
 syncCanonicalShippingState();
 var costs=state().shippingCosts||{},uState=costs.ups||{},gState=costs.gate||{};
 var dest=shipmentDestination(),ups=canonicalLoad('ups'),gate=canonicalLoad('gate');
 if(!uState.manualRoute)syncUpsCountryField(dest.country);
 var postal=shippingField('ups',['destinationPostal','postal','postcode','zip','plz'],/ziel.*plz|plz|postleitzahl|postal|zip/i);
 if(!uState.manualRoute&&dest.postal)setAutoValue(postal,dest.postal);
 var upack=shippingField('ups',['packaging'],/verpackung|packaging/i);
 if(!uState.manualLoad){
  if(ups.packaging)setAutoValue(upack,ups.packaging);
  setAutoValue(shippingField('ups',['packages','packageCount','count','colli'],/pakete|kartons|anzahl|colli/i),ups.count>0?ups.count:'');
  setAutoValue(shippingField('ups',['totalKg','totalWeight','weight'],/gesamt.*gewicht|gewicht.*gesamt|total.*weight/i),ups.totalWeight>0?ups.totalWeight:'');
  setAutoValue(shippingField('ups',['length','l'],/länge|laenge|length/i),ups.l>0?ups.l:'');
  setAutoValue(shippingField('ups',['width','w'],/breite|width/i),ups.w>0?ups.w:'');
  setAutoValue(shippingField('ups',['height','h'],/höhe|hoehe|height/i),ups.h>0?ups.h:'');
 }
 var gCountry=shippingField('gate',['country'],/zielland|land|country/i);
 if(!gState.manualRoute&&gCountry&&dest.country)setAutoValue(gCountry,countryDisplay(dest.country));
 var gpack=shippingField('gate',['packaging'],/verpackung|packaging/i);
 if(!gState.manualLoad){
  if(gate.packaging)setAutoValue(gpack,gate.packaging);
  setAutoValue(shippingField('gate',['pallets','packages','count','colli'],/paletten|pallets|anzahl|colli/i),gate.count>0?gate.count:'');
  setAutoValue(shippingField('gate',['totalWeight','weight'],/gesamt.*gewicht|gewicht.*gesamt|total.*weight/i),gate.totalWeight>0?gate.totalWeight:'');
  setAutoValue(shippingField('gate',['length','l'],/länge|laenge|length/i),gate.l>0?gate.l:'');
  setAutoValue(shippingField('gate',['width','w'],/breite|width/i),gate.w>0?gate.w:'');
  setAutoValue(shippingField('gate',['height','h'],/höhe|hoehe|height/i),gate.h>0?gate.h:'');
  setAutoValue(shippingField('gate',['ldm'],/lademeter|ldm/i),gate.ldm>0?Math.round(gate.ldm*100)/100:'');
 }
 return{destination:dest,ups:ups,gate:gate}
}
function syncUpsCountryField(cc){var r=section('ups'),e=r&&inputByLabel(r,/zielland|land|country/i);if(!e||!cc||countryCode(e.value)===cc)return;var label=countryDisplay(cc);if(e.tagName==='SELECT'&&e.options){var o=Array.from(e.options).find(function(x){return countryCode(x.value)===cc||countryCode(x.textContent)===cc});if(o)e.value=o.value;else return}else e.value=label;try{e.dispatchEvent(new Event('change',{bubbles:true}))}catch(_){}}
function upsCountry(){
 var s=state(),u=(s.shippingCosts||{}).ups||{},d=shipmentDestination(),r=section('ups'),e=r&&inputByLabel(r,/zielland|land|country/i);
 var cc=u.manualRoute?(countryCode(e&&e.value)||countryCode(u.destinationCountry)):(d.country||countryCode(e&&e.value));
 if(cc&&!u.manualRoute)syncUpsCountryField(cc);
 return cc
}
function upsPostal(){
 var s=state(),u=(s.shippingCosts||{}).ups||{},d=shipmentDestination(),r=section('ups'),e=r&&inputByLabel(r,/ziel.*plz|plz|postleitzahl|postal|zip/i);
 var v=u.manualRoute?(q(e&&e.value)||q(u.destinationPostal)):(d.postal||q(e&&e.value));
 return q(v).toUpperCase().replace(/[\s-]/g,'')
}
function fuelPct(){return 36}
function resultLine(card,rx){var lines=Array.from(card.querySelectorAll('.rc501-result-line,tr'));for(var i=0;i<lines.length;i++){var l=lines[i],label=l.querySelector('span,th,td');if(label&&rx.test(q(label.textContent)))return l}return null}
function setResultLine(card,rx,label,value){var l=resultLine(card,rx);if(!l)return false;var a=l.querySelector('span,th,td'),b=l.querySelector('b,strong');if(a)setText(a,label);if(b)setText(b,value);return true}
/* Nur bei echter Änderung schreiben: Text- und HTML-Schreibvorgänge sind childList-Mutationen und wecken den eigenen MutationObserver erneut (Endlosschleife). */
function setText(node,text){text=String(text==null?'':text);if(node&&node.textContent!==text)node.textContent=text}
function setHtml(node,html){if(node&&node.__rc1206Html!==html){node.innerHTML=html;node.__rc1206Html=html}}
function updateUpsTotal(){syncShipmentCostFields();var root=section('ups');if(!root)return;var card=root.querySelector('.rc501-result-card,.rc626-result')||root,count=packageCount(),cc=upsCountry(),pc=upsPostal(),zone=validUpsPostal(cc,pc)?resolveUpsZone(cc,pc):'',weight=upsTotalWeight(),individual=upsIndividualWeights(),hasIndividual=individual.length===count,kgPer=count>0?weight/count:weight,packageRates=hasIndividual?individual.map(function(v){return upsRate(zone,v)}):[],per=hasIndividual?upsIndividualBase(zone,individual):upsRate(zone,kgPer);var warn=document.getElementById('rc1207UpsWarning');if(!cc||!pc||!zone||!per){if(!warn){warn=document.createElement('div');warn.id='rc1207UpsWarning';warn.style.cssText='margin-top:8px;padding:8px 10px;border-radius:8px;background:#fff3cd;color:#664d03;font-weight:600';card.appendChild(warn)}setText(warn,!cc||!pc?tr('ups.missingDestination'):!zone?tr('ups.zoneNotFound'):tr('ups.rateMissing',{zone:zone}));return}if(warn)warn.remove();var base=hasIndividual?per:per*count,pct=fuelPct(),fuel=base*pct/100,extra=moneyFromLine(card,/zusatzkosten|additional|costs?/i),total=base+fuel+extra;setResultLine(card,/preisgruppe|zone|price group/i,tr('ups.priceZone'),'EU / '+zone);setResultLine(card,/grundpreis|base price/i,tr('ups.baseComplete'),euro(base));setResultLine(card,/fuel|carburant|combustible|paliwo/i,tr('ups.fuelComplete',{pct:pct.toFixed(2)}),euro(fuel));setResultLine(card,/zusatzkosten|additional costs|frais supplémentaires|costes adicionales|costi aggiuntivi/i,tr('ups.extraComplete'),euro(extra));var row=document.getElementById('rc1206UpsShipmentTotal');if(!row){row=document.createElement('div');row.id='rc1206UpsShipmentTotal';row.className='rc501-result-line rc1206-ups-total';row.style.cssText='margin-top:12px;padding:12px 0 2px;border-top:3px solid currentColor;font-size:1.18em;font-weight:800';row.innerHTML='<span></span><b></b>';var lines=card.querySelector('.rc501-result-lines');(lines||card).appendChild(row)}var cartons=tr(count===1?'ups.cartonOne':'ups.cartonMany',{count:count});setText(row.querySelector('span'),tr('ups.totalComplete')+' · '+cartons);setText(row.querySelector('b'),euro(total));row.dataset.zone=zone;row.dataset.country=cc;row.dataset.postal=pc;var weightInfo=hasIndividual?tr('ups.individualWeights',{weights:individual.map(function(v){return v.toFixed(1)}).join(' / ')}):count>1?tr('ups.estimated',{weight:kgPer.toFixed(1)}):tr('ups.weight',{weight:kgPer.toFixed(1)});row.title=tr('ups.tooltip',{cartons:cartons,zone:zone,weightInfo:weightInfo,base:euro(base),pct:pct.toFixed(2)});var summary=document.getElementById('rc1334UpsPriceMeaning');if(!summary){summary=document.createElement('div');summary.id='rc1334UpsPriceMeaning';summary.style.cssText='margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(37,99,235,.08);font-weight:700;line-height:1.45';card.appendChild(summary)}var packageText=hasIndividual?packageRates.map(function(v,i){return (i+1)+': '+euro(v)}).join(' · '):(count+' × '+euro(per));setHtml(summary,'<div><strong>'+tr('ups.totalComplete')+':</strong> '+euro(total)+'</div><div style="font-size:.92em;font-weight:600;opacity:.86">UPS Grundtarif je Paket: '+packageText+' · '+tr('ups.baseComplete')+': '+euro(base)+' · '+tr('ups.fuelComplete',{pct:pct.toFixed(2)})+': '+euro(fuel)+'</div>')}
function apply(){installLegacyBridge();syncCanonicalShippingState();restrictPackaging('ups',function(text){return isUpsPackageType(text)},'Karton');restrictPackaging('gate',function(text){return isPalletType(text)},'Palette');updateUpsTotal()}
var timer=0,shippingObserver=null,observedShippingRoot=null;
function watchShipping(){
 var root=document.querySelector('#rc626Shipping');
 if(root===observedShippingRoot)return;
 if(shippingObserver)shippingObserver.disconnect();
 observedShippingRoot=root||null;
 if(root&&shippingObserver)shippingObserver.observe(root,{subtree:true,childList:true});
}
function schedule(){watchShipping();clearTimeout(timer);timer=setTimeout(apply,60)}
function onShippingInteraction(ev){
 var target=ev&&ev.target;if(!target)return;
 var root=document.querySelector('#rc626Shipping');
 if(root&&((root.contains&&root.contains(target))||target===root)){schedule();return}
 // Shipment recipient changes happen outside the shipping-cost panel.
 // They must still update the destination at the next cost calculation.
 var id=q(target.id);
 if(/^(index289LocationSelect|shipmentCustomerSearch|index289CustomerSearch|shipmentCustomer)$/.test(id))schedule()
}
window.addEventListener('input',onShippingInteraction,true);window.addEventListener('change',onShippingInteraction,true);window.addEventListener('click',onShippingInteraction,true);['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:shipment-opened','exporthub:shipment-updated','exporthub:state-synced','exporthub:state-updated','exporthub:language-changed'].forEach(function(n){window.addEventListener(n,schedule)});
if(window.MutationObserver){
 shippingObserver=new window.MutationObserver(schedule);
 // This global observer detects replacement of the shipping mount only.
 // Ordinary changes elsewhere in ExportHUB must never trigger shipping renders.
 new window.MutationObserver(function(records){
  for(var i=0;i<records.length;i++){
   var record=records[i],nodes=Array.from(record.addedNodes||[]).concat(Array.from(record.removedNodes||[]));
   for(var j=0;j<nodes.length;j++){
    var node=nodes[j];
    if(node&&node.nodeType===1&&(node.id==='rc626Shipping'||(node.querySelector&&node.querySelector('#rc626Shipping')))){
     watchShipping();schedule();return
    }
   }
  }
 }).observe(document.documentElement,{subtree:true,childList:true});
 watchShipping();
}
installLegacyBridge();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.ExportHUBRC1206ShippingRules=Object.freeze({fuelPct:fuelPct,apply:apply,packageCount:packageCount,resolveUpsZone:resolveUpsZone,validUpsPostal:validUpsPostal,upsRate:upsRate,upsIndividualBase:upsIndividualBase,upsRates:UPS_RATES,countryCode:countryCode,inferCountryFromAddress:inferCountryFromAddress,shipmentDestination:shipmentDestination,activeShipment:activeShipment,upsTotalWeight:upsTotalWeight,parseNumber:num,isUpsPackageType:isUpsPackageType,isPalletType:isPalletType,canonicalLoad:canonicalLoad,syncShipmentCostFields:syncShipmentCostFields,syncCanonicalShippingState:syncCanonicalShippingState,installLegacyBridge:installLegacyBridge});
})();
