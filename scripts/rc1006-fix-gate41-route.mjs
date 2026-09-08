import fs from 'node:fs';

const files = ['index.html', 'TESTVERSION.html'];
const routePattern = /function activeShipmentRoute\(\)\{[\s\S]*?\}function shipmentRows\(\)\{/;
const replacement = `function activeShipmentRoute(){var s=state(),sh=s.shipment||{},c=activeCustomer()||{},locId=firstValue(sh,['locationId','selectedLocationId','siteId','destinationId']),loc=obj(sh.location)?sh.location:(obj(sh.locationData)?sh.locationData:(obj(sh.siteData)?sh.siteData:{}));if(!Object.keys(loc).length&&locId){var pools=[c.locations,c.sites,c.standorte,c.deliveryLocations,c.shippingLocations,c.addresses,c.deliveryAddresses,c.shipToLocations,c.shipToAddresses,c.recipientAddresses,c.customerLocations];outer:for(var pi=0;pi<pools.length;pi++){var list=arr(pools[pi]);for(var li=0;li<list.length;li++){var item=list[li];if(!obj(item))continue;var itemId=q(item.id||item.locationId||item.selectedLocationId||item.siteId||item.destinationId||item.code||item.number);if(itemId&&itemId.toLowerCase()===q(locId).toLowerCase()){loc=item;break outer}}}}var address=firstValue(sh,['recipientAddress','deliveryAddress','destinationAddress','shipToAddress','address'])||firstValue(loc,['address','formattedAddress','fullAddress','addressText','deliveryAddress','recipientAddress','shipToAddress'])||q(c.address),postal=firstValue(sh,['recipientPostal','destinationPostal','postalCode','postcode','zip','plz'])||firstValue(loc,['postalCode','postcode','zip','plz'])||extractPostal(address)||firstValue(c,['postalCode','postcode','zip','plz']),place=firstValue(sh,['recipientCity','destinationCity','city','locationName','site','standort'])||firstValue(loc,['city','ort','town','place','locationName','siteName','name'])||placeFromAddress(address)||firstValue(c,['city','ort','place']),country=firstValue(sh,['destinationCountry','recipientCountry','country','countryName','land'])||firstValue(loc,['country','land','countryName','countryCode'])||firstValue(c,['country','land','countryName','countryCode']);if(!country&&address){var parts=String(address).split(/[\\n,]+/).map(q).filter(Boolean);for(var ci=parts.length-1;ci>=0;ci--){if(countryCode(parts[ci])){country=parts[ci];break}}}if(!country)country='Deutschland';return{postal:postal,place:place,country:country,address:address,locationId:locId,signature:[q(sh.id||sh.shipmentId||sh.ref||sh.reference||sh.shipmentRef),locId,postal,place,country].join('|')}}
function shipmentRows(){`;

for (const file of files) {
  const before = fs.readFileSync(file, 'utf8');
  const matches = before.match(new RegExp(routePattern.source, 'g')) || [];
  if (matches.length !== 1) {
    throw new Error(`${file}: activeShipmentRoute wurde ${matches.length}x gefunden; erwartet genau 1x.`);
  }

  const after = before.replace(routePattern, replacement);
  if (after === before) throw new Error(`${file}: keine Änderung erzeugt.`);
  if (!after.includes("firstValue(sh,['recipientAddress','deliveryAddress','destinationAddress','shipToAddress','address'])")) {
    throw new Error(`${file}: Lieferadress-Fallback fehlt nach dem Patch.`);
  }
  if (!after.includes("firstValue(loc,['country','land','countryName','countryCode'])")) {
    throw new Error(`${file}: Standort-Land-Fallback fehlt nach dem Patch.`);
  }

  fs.writeFileSync(file, after);
  console.log(`${file}: Gate41-Routenquelle aktualisiert`);
}
