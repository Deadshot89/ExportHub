const RC565_LOCATIONS=`function locations(c){var all=[];
 function addressOf(l,fallbackCountry){if(!l)return'';if(typeof l==='string'||typeof l==='number')return q(l);l=l&&typeof l==='object'?l:{};var street=q(l.street||l.strasse||l.streetName||l.addressLine1),zip=q(l.zip||l.postalCode||l.postcode||l.plz),city=q(l.city||l.ort||l.town||l.place),country=q(l.country||l.land||l.countryName||fallbackCountry),direct=typeof l.address==='string'?q(l.address):'';return direct||q(l.formattedAddress||l.fullAddress||l.addressText||l.deliveryAddress||l.recipientAddress||l.shipToAddress)||[street,[zip,city].filter(Boolean).join(' '),country].filter(Boolean).join('\\n')}
 [c&&c.locations,c&&c.sites,c&&c.standorte,c&&c.deliveryLocations,c&&c.shippingLocations,c&&c.addresses,c&&c.deliveryAddresses,c&&c.shipToLocations,c&&c.shipToAddresses,c&&c.recipientAddresses,c&&c.customerLocations].forEach(function(x){a(x).forEach(function(l){all.push(l)})});
 var mainAddress=addressOf(c,''),mainCountry=q(c&&(c.country||c.land));
 if(mainAddress&&!all.some(function(l){return n(addressOf(l,mainCountry))===n(mainAddress)})){all.unshift({id:'MAIN-'+(cacc(c)||cid(c)||'CUSTOMER'),name:'Hauptadresse',address:mainAddress,country:mainCountry,_derivedMain:true})}
 var seen={};return all.map(function(l,i){if(typeof l==='string'||typeof l==='number')l={address:q(l),name:'Adresse '+(i+1)};else l=l&&typeof l==='object'?l:{};var id=q(l.id||l.locationId||l.selectedLocationId||l.siteId||l.destinationId||l.code||l.number)||('LOC-'+(cacc(c)||cid(c)||'C')+'-'+(i+1));var name=q(l.name||l.locationName||l.siteName||l.standort||l.city||l.ort);var street=q(l.street||l.strasse||l.streetName||l.addressLine1),zip=q(l.zip||l.postalCode||l.postcode||l.plz),city=q(l.city||l.ort||l.town||l.place),country=q(l.country||l.land||l.countryName||c.country||c.land),address=addressOf(l,country);return Object.assign({},l,{id:id,locationId:id,selectedLocationId:id,siteId:id,destinationId:id,name:name,address:address,street:street,zip:zip,city:city,country:country,contact:q(l.contact||l.contactPerson||l.ansprechpartner),email:q(l.email||l.mail),times:q(l.times||l.openingTimes||l.zeiten),hints:q(l.hints||l.note||l.notes||l.hinweise)})}).filter(function(l){var k=n(q(l.id)||((q(l.name)||'')+'|'+(q(l.address)||'')));if(!k||seen[k])return false;seen[k]=1;return true})}
`;

const INDEX289_LOCATION_LIST=`function locationList(c){var map={},out=[];[].concat(arr(c&&c.locations),arr(c&&c.sites),arr(c&&c.standorte),arr(c&&c.deliveryLocations),arr(c&&c.shippingLocations),arr(c&&c.addresses),arr(c&&c.deliveryAddresses),arr(c&&c.shipToLocations),arr(c&&c.shipToAddresses),arr(c&&c.recipientAddresses),arr(c&&c.customerLocations)).forEach(function(l,i){if(typeof l==='string'||typeof l==='number')l={address:q(l),name:'Adresse '+(i+1)};if(!obj(l))return;var address=rawAddress(l),explicit=q(l.id||l.locationId||l.selectedLocationId||l.siteId||l.destinationId||l.code||l.number),name=q(l.name||l.locationName||l.siteName||l.standort||l.city||l.ort),key=explicit||low(name+'|'+address);if(!key||map[key])return;map[key]=1;var id=explicit||('ADDR-'+(cid(c)||'CUSTOMER')+'-'+(out.length+1)),x=Object.assign({},l,{id:id,locationId:id,selectedLocationId:id,siteId:id,destinationId:id});x.name=name||('Adresse '+(out.length+1));x.address=address;out.push(x)});if(c){var main=rawAddress(c);if(main&&!out.some(function(l){return low(rawAddress(l))===low(main)})){var id='MAIN-'+(cid(c)||'CUSTOMER');out.unshift({id:id,locationId:id,selectedLocationId:id,siteId:id,destinationId:id,name:q(c.locationName||c.siteName)||'Hauptadresse',address:main,country:q(c.country||c.land),land:q(c.country||c.land),_derivedMain:true})}}return out}
`;

function replaceBetween(source,startMarker,endMarker,replacement,label){
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start+startMarker.length);
  if(start<0||end<=start)throw new Error(`RC1018 ${label}: aktive Funktion nicht eindeutig gefunden.`);
  return source.slice(0,start)+replacement+source.slice(end);
}

function patchCalendarRightsEditor(html){
  const open='<script data-inline-source="assets/rc544-auth.js">';
  const start=html.indexOf(open);
  const end=start<0?-1:html.indexOf('</script>',start+open.length);
  if(start<0||end<=start)throw new Error('RC1019 Kalenderfreigabe: aktiver RC544-Rechteeditor nicht gefunden.');
  let block=html.slice(start,end+'</script>'.length);
  const labelOld="archive:'Archiv',settings:'Einstellungen'};";
  const labelNew="archive:'Archiv',settings:'Einstellungen',pickupcalendar:'Abholkalender'};";
  if(!block.includes("pickupcalendar:'Abholkalender'")){
    if(block.split(labelOld).length-1!==1)throw new Error('RC1019 Kalenderfreigabe: LABELS-Anker im RC544-Rechteeditor nicht eindeutig.');
    block=block.replace(labelOld,labelNew);
  }
  const orderOld="'reports','update','teamfile','archive','settings'];";
  const orderNew="'reports','update','teamfile','archive','settings','pickupcalendar'];";
  if(!block.includes("'settings','pickupcalendar']")){
    if(block.split(orderOld).length-1!==1)throw new Error('RC1019 Kalenderfreigabe: VALID_RIGHTS_ORDER-Anker im RC544-Rechteeditor nicht eindeutig.');
    block=block.replace(orderOld,orderNew);
  }
  if(!block.includes("pickupcalendar:'Abholkalender'")||!block.includes("'settings','pickupcalendar']"))throw new Error('RC1019 Kalenderfreigabe: Abholkalender wurde im RC544-Rechteeditor nicht aktiviert.');
  return html.slice(0,start)+block+html.slice(end+'</script>'.length);
}

export function patchCriticalShipmentFlow(html){
  let out=replaceBetween(html,'function locations(c){var all=[]','function findLocation(c,v)',RC565_LOCATIONS,'RC565 Standortliste');
  out=replaceBetween(out,'function locationList(c){var map={},out=[];','function savedLocationId(sh,list)',INDEX289_LOCATION_LIST,'Index289 Standortliste');
  out=patchCalendarRightsEditor(out);
  return out;
}