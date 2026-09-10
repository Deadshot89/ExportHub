import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const SRC=path.join(ROOT,'dist-rc1016');
const OUT=path.join(ROOT,'dist-rc1018');
const VERSION='RC1018';
const CACHE='1018';
const MAIL_TAG='<script id="exporthub-rc1018-mail-language-standard" defer src="/assets/rc1018-mail-language-standard.js?v=1018"></script>';
const SOP_IMAGES_TAG='<script id="exporthub-rc1018-sop-system-images" defer src="/assets/sop/rc1018-sop-system-images.js?v=1018"></script>';
const SHIPMENT_CONTROLLER_ID='exporthub-rc373-shipment-controller';

const RC565_LOCATIONS=`function locations(c){var all=[];
 function addressOf(l,fallbackCountry){if(!l)return'';if(typeof l==='string'||typeof l==='number')return q(l);l=l&&typeof l==='object'?l:{};var street=q(l.street||l.strasse||l.streetName||l.addressLine1),zip=q(l.zip||l.postalCode||l.postcode||l.plz),city=q(l.city||l.ort||l.town||l.place),country=q(l.country||l.land||l.countryName||fallbackCountry),direct=typeof l.address==='string'?q(l.address):'';return direct||q(l.formattedAddress||l.fullAddress||l.addressText||l.deliveryAddress||l.recipientAddress||l.shipToAddress)||[street,[zip,city].filter(Boolean).join(' '),country].filter(Boolean).join('\\n')}
 [c&&c.locations,c&&c.sites,c&&c.standorte,c&&c.deliveryLocations,c&&c.shippingLocations,c&&c.addresses,c&&c.deliveryAddresses,c&&c.shipToLocations,c&&c.shipToAddresses,c&&c.recipientAddresses,c&&c.customerLocations].forEach(function(x){a(x).forEach(function(l){all.push(l)})});
 var mainAddress=addressOf(c,''),mainCountry=q(c&&(c.country||c.land));
 if(mainAddress&&!all.some(function(l){return n(addressOf(l,mainCountry))===n(mainAddress)})){all.unshift({id:'MAIN-'+(cacc(c)||cid(c)||'CUSTOMER'),name:'Hauptadresse',address:mainAddress,country:mainCountry,_derivedMain:true})}
 var seen={};return all.map(function(l,i){if(typeof l==='string'||typeof l==='number')l={address:q(l),name:'Adresse '+(i+1)};else l=l&&typeof l==='object'?l:{};var id=q(l.id||l.locationId||l.selectedLocationId||l.siteId||l.destinationId||l.code||l.number)||('LOC-'+(cacc(c)||cid(c)||'C')+'-'+(i+1));var name=q(l.name||l.locationName||l.siteName||l.standort||l.city||l.ort);var street=q(l.street||l.strasse||l.streetName||l.addressLine1),zip=q(l.zip||l.postalCode||l.postcode||l.plz),city=q(l.city||l.ort||l.town||l.place),country=q(l.country||l.land||l.countryName||c.country||c.land),address=addressOf(l,country);return Object.assign({},l,{id:id,locationId:id,selectedLocationId:id,siteId:id,destinationId:id,name:name,address:address,street:street,zip:zip,city:city,country:country,contact:q(l.contact||l.contactPerson||l.ansprechpartner),email:q(l.email||l.mail),times:q(l.times||l.openingTimes||l.zeiten),hints:q(l.hints||l.note||l.notes||l.hinweise)})}).filter(function(l){var k=n(q(l.id)||((q(l.name)||'')+'|'+(q(l.address)||'')));if(!k||seen[k])return false;seen[k]=1;return true})}
`;

const INDEX289_LOCATION_LIST=`function locationList(c){var map={},out=[];[].concat(arr(c&&c.locations),arr(c&&c.sites),arr(c&&c.standorte),arr(c&&c.deliveryLocations),arr(c&&c.shippingLocations),arr(c&&c.addresses),arr(c&&c.deliveryAddresses),arr(c&&c.shipToLocations),arr(c&&c.shipToAddresses),arr(c&&c.recipientAddresses),arr(c&&c.customerLocations)).forEach(function(l,i){if(typeof l==='string'||typeof l==='number')l={address:q(l),name:'Adresse '+(i+1)};if(!obj(l))return;var address=rawAddress(l),explicit=q(l.id||l.locationId||l.selectedLocationId||l.siteId||l.destinationId||l.code||l.number),name=q(l.name||l.locationName||l.siteName||l.standort||l.city||l.ort),key=explicit||low(name+'|'+address);if(!key||map[key])return;map[key]=1;var id=explicit||('ADDR-'+(cid(c)||'CUSTOMER')+'-'+(out.length+1)),x=Object.assign({},l,{id:id,locationId:id,selectedLocationId:id,siteId:id,destinationId:id});x.name=name||('Adresse '+(out.length+1));x.address=address;out.push(x)});if(c){var main=rawAddress(c);if(main&&!out.some(function(l){return low(rawAddress(l))===low(main)})){var id='MAIN-'+(cid(c)||'CUSTOMER');out.unshift({id:id,locationId:id,selectedLocationId:id,siteId:id,destinationId:id,name:q(c.locationName||c.siteName)||'Hauptadresse',address:main,country:q(c.country||c.land),land:q(c.country||c.land),_derivedMain:true})}}return out}
`;

function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8')}
function write(rel,content){const file=path.join(OUT,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content)}
function injectBeforeHeadClose(html,tag,id){if(html.includes(`id="${id}"`)||html.includes(`id='${id}'`))return html;const idx=html.search(/<\/head\s*>/i);if(idx<0)throw new Error(`${id}: </head> fehlt`);return html.slice(0,idx)+tag+'\n'+html.slice(idx)}
function injectSopImages(html){
  if(html.includes('id="exporthub-rc1018-sop-system-images"'))return html;
  const rx=/(<script\s+id=["']exporthub-rc1016-sop-consolidation["'][^>]*><\/script>)/i;
  if(!rx.test(html))throw new Error('RC1018 SOP-Systembilder: RC1016 Konsolidierung nicht gefunden.');
  return html.replace(rx,`$1\n${SOP_IMAGES_TAG}`);
}
function setVersion(html){
  let out=html.replace(/ExportHUB RC1016 environment=/g,'ExportHUB RC1018 environment=');
  out=out.replace(/version:'RC1016'/g,"version:'RC1018'");
  out=out.replace(/cache:'1016'/g,"cache:'1018'");
  out=out.replace(/(window\.__EXPORTHUB_BUILD__\s*=\s*['"])RC1016(['"])/g,'$1RC1018$2');
  return out
}
function scriptBlock(html,id){
  const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const open=new RegExp(`<script\\b[^>]*id=["']${escaped}["'][^>]*>`,'i');
  const match=open.exec(html);
  if(!match)throw new Error(`${id}: Scriptblock fehlt`);
  const start=match.index,end=html.indexOf('</script>',start+match[0].length);
  if(end<0)throw new Error(`${id}: </script> fehlt`);
  return html.slice(start,end+'</script>'.length)
}
function replaceScriptBlock(html,id,canonicalBlock){
  const current=scriptBlock(html,id);
  return html.replace(current,canonicalBlock)
}
function replaceBetween(source,startMarker,endMarker,replacement,label){
  const start=source.indexOf(startMarker),end=source.indexOf(endMarker,start+startMarker.length);
  if(start<0||end<=start)throw new Error(`RC1018 ${label}: aktive Funktion nicht eindeutig gefunden.`);
  return source.slice(0,start)+replacement+source.slice(end)
}
function patchCriticalShipmentFlow(html){
  let out=replaceBetween(html,'function locations(c){var all=[]','function findLocation(c,v)',RC565_LOCATIONS,'RC565 Standortliste');
  out=replaceBetween(out,'function locationList(c){var map={},out=[];','function savedLocationId(sh,list)',INDEX289_LOCATION_LIST,'Index289 Standortliste');
  return out
}

execFileSync(process.execPath,['.github/rc1016/build-three-env.mjs'],{cwd:ROOT,stdio:'inherit'});
fs.rmSync(OUT,{recursive:true,force:true});
fs.cpSync(SRC,OUT,{recursive:true});

const canonicalProduction=fs.readFileSync(path.join(OUT,'index.html'),'utf8');
const canonicalShipmentController=scriptBlock(canonicalProduction,SHIPMENT_CONTROLLER_ID);
for(const marker of ['function rc1017FitRows(','function rc1017SyncSubShipments(','function renderRc1017SubShipments(','function rc1017ActivateSubShipmentQr(','rc1017-print-subshipment','rc1017-qr-subshipment','rc1017-stow-subshipment']){
  if(!canonicalShipmentController.includes(marker))throw new Error(`RC1018 kanonischer Sendungscontroller ohne Mehr-LKW-Marker: ${marker}`);
}

for(const file of ['index.html','TESTVERSION.html','demo.html']){
  let html=fs.readFileSync(path.join(OUT,file),'utf8');
  if(file!=='index.html')html=replaceScriptBlock(html,SHIPMENT_CONTROLLER_ID,canonicalShipmentController);
  html=patchCriticalShipmentFlow(html);
  html=setVersion(html);
  html=injectSopImages(html);
  html=injectBeforeHeadClose(html,MAIL_TAG,'exporthub-rc1018-mail-language-standard');
  write(file,html);
}

for(const asset of ['assets/rc1018-mail-language-standard.js','assets/rc1018-public-language.js'])write(asset,read(asset));
for(const page of ['customer-avis.html','pickup.html','location.html','pod-notfall.html'])if(fs.existsSync(path.join(ROOT,page)))write(page,read(page));

let probe=read('production-version.js').replace(/RC1016/g,'RC1018').replace(/1016/g,'1018');
if(!probe.includes("__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1018'"))probe="window.__EXPORTHUB_PRODUCTION_VERSION_PROBE__='RC1018';\n// RC1018 gemeinsamer Mail- und Sprachstandard für Produktion, TESTSERVICE und Demo\n";
write('production-version.js',probe);

const manifest={
  schema:'exporthub-rc1018-three-env-v1',
  version:VERSION,
  cache:CACHE,
  sourceRelease:'RC1016',
  retainedReleaseAssets:{multiTruck:'assets/rc1017-multi-truck.js'},
  synchronizedRuntime:{shipmentController:SHIPMENT_CONTROLLER_ID,multiTruck:true,mainAddressWithLocations:true},
  sop:{systemImages:'assets/sop/rc1018-sop-system-images.js',screenshotDirectory:'assets/sop/screenshots'},
  mail:{runtime:'assets/rc1018-mail-language-standard.js',targets:['customer','carrier'],languages:['de','en'],exclusiveModes:['details','avis']},
  publicLanguage:{runtime:'assets/rc1018-public-language.js',pages:['customer-avis.html','pickup.html','location.html'],languages:['de','en']},
  environments:{production:'index.html',testservice:'TESTVERSION.html',demo:'demo.html'}
};
write('rc1018-manifest.json',JSON.stringify(manifest,null,2)+'\n');
console.log('RC1018 build ready: RC1017 Mehr-LKW-Sendungscontroller synchronisiert; Hauptadresse plus Standorte, Mailvorlagen, Lieferavis/Sendungsdetails, SOP-Systembilder und DE/EN in Produktion, TESTSERVICE und Demo.');
