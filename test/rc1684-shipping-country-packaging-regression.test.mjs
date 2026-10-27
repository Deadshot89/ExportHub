import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const rulesSource=fs.readFileSync(new URL('../assets/rc1206-shipping-rules.js',import.meta.url),'utf8');
const pageSources=[
  ['Produktion',fs.readFileSync(new URL('../index.html',import.meta.url),'utf8')],
  ['TESTSERVICE',fs.readFileSync(new URL('../TESTVERSION.html',import.meta.url),'utf8')]
];

test('RC1684: historischer RC1047-Build akzeptiert die aktuelle RC1046-Länderkette',()=>{
  const source=fs.readFileSync(new URL('../.github/rc1047/build-three-env.mjs',import.meta.url),'utf8');
  const functions=source.slice(source.indexOf('function replaceBetween('),source.indexOf('function patchHtml('));
  const patch=vm.runInNewContext(`${functions}\npatchCountryDetection`,{});
  const tail="||countryFromAddress(address)||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])";
  const countryFn="function countryFromAddress(v){return ''}\nfunction shippingPackagingList(){return []}";
  const legacy=`${countryFn}\nvar rawCountry=firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])${tail};`;
  const current=`${countryFn}\nvar rawCountry=firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(locationAddress)||firstValue(recipient,['country'])||firstValue(sh,['recipientCountry'])${tail};`;
  for(const input of [legacy,current]){
    const output=patch(input,'index.html');
    assert.match(output,/firstValue\(c,\['country','land','countryName','countryCode','iso','iso2'\]\)\|\|countryFromAddress\(address\)/);
    assert.doesNotMatch(output,/countryFromAddress\(address\)\|\|firstValue\(c/);
  }
});

test('RC1684: RC1237-Build akzeptiert Standortadresse plus Empfänger- und Sendungsland',()=>{
  const builder=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');
  const snippet=builder.slice(builder.indexOf('function patchMainCountryDetection('),builder.indexOf('function patchAuthSessionTimeout('));
  const patch=vm.runInNewContext(`${snippet}\npatchMainCountryDetection`,{});
  const input=" var lines=raw.split(/[\\n,;|]+/).map(q).filter(Boolean);\n"+
    "var rawCountry=firstValue(loc,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(locationAddress)||firstValue(recipient,['country'])||firstValue(sh,['recipientCountry'])||firstValue(c,['country','land','countryName','countryCode','iso','iso2'])||countryFromAddress(address);";
  const output=patch(input,'index.html');
  assert.match(output,/countryFromAddress\(locationAddress\)\|\|firstValue\(recipient/);
  assert.match(output,/firstValue\(sh,\['recipientCountry'\]\)\|\|countryFromAddress\(address\)\|\|firstValue\(c/);
  assert.match(output,/itProvinces='\|AG\|AL\|AN\|/);
});

test('RC1684: Release-Build übernimmt die korrigierten Versandfunktionen in Produktion, TESTSERVICE und Demo',()=>{
  const builder=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');
  assert.match(builder,/RC1684 Versandkosten-Synchronisierung/);
  assert.match(builder,/function activeShipmentRoute\(\)/);
  assert.match(builder,/function syncCostFromShipment\(\)/);
  assert.match(builder,/for\s*\(const file of \['index\.html','TESTVERSION\.html','demo\.html'\]\)/);
  const start=builder.indexOf('// RC1684 Versandkosten-Synchronisierung');
  const end=builder.indexOf('// RC1680:',start);
  assert.ok(start>=0&&end>start,'Build-Funktion muss vor dem bestehenden POD-Abgleich ausgeführt werden');
  const root=path.dirname(new URL('../index.html',import.meta.url).pathname),output={};
  const fakeFs={
    readFileSync(file){return fs.readFileSync(file,'utf8')},
    writeFileSync(file,value){output[path.basename(file)]=value}
  };
  vm.runInNewContext(builder.slice(start,end),{fs:fakeFs,path,ROOT:root,OUT:path.join(root,'dist-rc1048')});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=output[file];
    assert.ok(html,`RC1684 ${file} muss bearbeitet werden`);
    const startLocation=html.indexOf('function activeLocation(sh,c){');
    const endLocation=html.indexOf('\nfunction activeShipmentRoute()',startLocation);
    const startRoute=html.indexOf('function activeShipmentRoute(){');
    const endRoute=html.indexOf('\nfunction shipmentRows()',startRoute);
    const startSync=html.indexOf('function syncCostFromShipment(){');
    const endSync=html.indexOf('\nfunction calcUps()',startSync);
    const canonical=pageSources[0][1];
    assert.equal(html.slice(startLocation,endLocation),canonical.slice(canonical.indexOf('function activeLocation(sh,c){'),canonical.indexOf('\nfunction activeShipmentRoute()')));
    assert.equal(html.slice(startRoute,endRoute),canonical.slice(canonical.indexOf('function activeShipmentRoute(){'),canonical.indexOf('\nfunction shipmentRows()')));
    assert.equal(html.slice(startSync,endSync),canonical.slice(canonical.indexOf('function syncCostFromShipment(){'),canonical.indexOf('\nfunction calcUps()')));
  }
});

function rulesWith(state){
  const document={readyState:'loading',querySelector(){return null},addEventListener(){},documentElement:{}};
  const window={addEventListener(){},__EXPORTHUB_GET_STATE__:()=>state};
  vm.runInNewContext(rulesSource,{window,document,Event:function(){},setTimeout(){return 1},clearTimeout(){},Intl});
  return window.ExportHUBRC1206ShippingRules;
}

test('RC1684: in der Sendung eingebetteter Lieferstandort schlägt alte Sendungs- und Kundenländer',()=>{
  const state={
    customers:[{id:'C1',country:'Niederlande'}],
    currentShipment:{customerId:'C1',recipientCountry:'Niederlande',postalCode:'5657 EA',
      locationData:{id:'L1',country:'Italia',postalCode:'60044',address:'60044 Fabriano Italia'}}
  };
  const rules=rulesWith(state);
  assert.equal(rules.shipmentDestination().country,'IT');
  assert.equal(rules.shipmentDestination().postal,'60044');
});

test('RC1684: neu ausgewählte Standort-ID schlägt alte eingebettete Standortdaten',()=>{
  const state={customers:[{id:'C1',country:'Niederlande',locations:[
    {id:'L1',country:'Niederlande',postalCode:'5657 EA'},
    {id:'L2',country:'Italia',postalCode:'60044'}
  ]}],currentShipment:{customerId:'C1',selectedLocationId:'L2',
    locationData:{id:'L1',country:'Niederlande',postalCode:'5657 EA'}}};
  const dest=rulesWith(state).shipmentDestination();
  assert.equal(dest.country,'IT');
  assert.equal(dest.postal,'60044');
});

for(const [environment,pageSource] of pageSources)test(`RC1684: ${environment} verwendet den neu gewählten Standort statt stale locationData`,()=>{
  const from=pageSource.indexOf('function activeLocation(sh,c){');
  const to=pageSource.indexOf('\nfunction activeShipmentRoute()',from);
  assert.ok(from>=0&&to>from);
  const context={q:value=>String(value??'').trim(),low:value=>String(value??'').toLowerCase(),
    locationList:c=>c.locations,locationId:l=>l.id,objectAddress:l=>l.address||''};
  const active=vm.runInNewContext(`${pageSource.slice(from,to)}\nactiveLocation`,context);
  const location=active({selectedLocationId:'L2',locationData:{id:'L1',country:'Niederlande'}},{locations:[
    {id:'L1',country:'Niederlande'}, {id:'L2',country:'Italia'}]});
  assert.equal(location.id,'L2');
});

for(const [environment,pageSource] of pageSources)test(`RC1684: ${environment} nutzt ausgewählten Standort vor veraltetem country-Feld`,()=>{
  const from=pageSource.indexOf('function activeShipmentRoute(){');
  const to=pageSource.indexOf('\nfunction shipmentRows()',from);
  assert.ok(from>=0&&to>from,'Versandkosten-Routenfunktion muss vorhanden sein');
  const shipment={id:'S1',reference:'REF-1',recipientCountry:'Niederlande',postalCode:'5657 EA',
    recipientAddress:'Old Address, 5657 EA Eindhoven',customerId:'C1'};
  const location={id:'L1',country:'Italia',postalCode:'60044',city:'Fabriano',address:'60044 Fabriano Italia'};
  const context={
    activeShipmentSource:()=>shipment,activeCustomer:()=>({name:'Testkunde'}),activeLocation:()=>location,
    q:value=>String(value??'').trim(),firstValue:(obj,names)=>names.map(name=>obj?.[name]).find(Boolean)||'',
    objectAddress:obj=>obj?.address||'',extractPostal:()=>'',placeFromAddress:()=>'',
    countryFromAddress:()=>'',countryName:value=>String(value||''),customerName:()=>'',customerNumber:()=>'',
    shipmentKey:sh=>sh.id
  };
  const route=vm.runInNewContext(`${pageSource.slice(from,to)}\nactiveShipmentRoute`,context)();
  assert.equal(route.country,'Italia');
  assert.equal(route.postal,'60044');
});

test('RC1684: unveränderte Colli werden nicht in jedem Versandkosten-Takt neu geschrieben',()=>{
  const state={currentShipment:{packagingRows:[{packagingType:'E3',count:2,kg:20,lengthCm:43,widthCm:31,heightCm:31}]},shippingCosts:{ups:{},gate:{}}};
  const rules=rulesWith(state);
  assert.equal(rules.syncCanonicalShippingState(),true);
  const firstItems=state.shippingCosts.ups.packageItems;
  assert.equal(rules.syncCanonicalShippingState(),false,'ohne Änderung darf keine neue Synchronisation gemeldet werden');
  assert.equal(state.shippingCosts.ups.packageItems,firstItems,'Paketliste darf ihre Identität nicht verlieren');
});

for(const [environment,pageSource] of pageSources)test(`RC1684: ${environment} liefert bei unveränderter Sendung keine erneute Verpackungssynchronisierung`,()=>{
  const from=pageSource.indexOf('function syncCostFromShipment(){');
  const to=pageSource.indexOf('\nfunction calcUps()',from);
  assert.ok(from>=0&&to>from,'Versandkosten-Synchronisierung muss vorhanden sein');
  const costs={ups:{},gate:{},mode:'ups'};
  const route={signature:'REF-1|60044|Italia',postal:'60044',place:'Fabriano',country:'Italia',reference:'REF-1'};
  const load={signature:'E3|2|20',rows:[{type:'E3',count:2,weight:20}],packages:2,pallets:0,totalWeight:20,packageWeight:20,totalLdm:0,
    packageItems:[{type:'E3',count:2,totalWeight:20,length:43,width:31,height:31}]};
  const context={costState:()=>costs,senderRoute:()=>({}),activeShipmentRoute:()=>route,shipmentLoad:()=>load,
    shippingPackaging:()=>({l:43,w:31,h:31}),num:value=>Number(value)||0,q:value=>String(value??'').trim(),
    countryName:value=>String(value||''),countryCode:value=>value==='Italia'?'IT':'',clone:value=>JSON.parse(JSON.stringify(value))};
  const sync=vm.runInNewContext(`${pageSource.slice(from,to)}\nsyncCostFromShipment`,context);
  assert.equal(sync(),true);
  const firstItems=costs.ups.packageItems;
  assert.equal(sync(),false,'gleiche Route und Colli dürfen keinen weiteren Datenwechsel melden');
  assert.equal(costs.ups.packageItems,firstItems,'Paketliste muss bei gleichem Inhalt dieselbe Referenz behalten');
});

test('RC1684: Verpackungsauswahl bleibt bei wiederholter Versandkostenprüfung unberührt',()=>{
  let writes=0;
  const options=['E3','Euro Palette'].map(value=>({value,textContent:value,
    get disabled(){return this._disabled||false},set disabled(value){writes++;this._disabled=value},
    get hidden(){return this._hidden||false},set hidden(value){writes++;this._hidden=value}
  }));
  const select={value:'E3',options,selectedIndex:0,attrs:{},getAttribute(key){return this.attrs[key]??null},setAttribute(key,value){writes++;this.attrs[key]=value}};
  const root={querySelector:query=>query==='[data-rc501-field="packaging"]'?select:null,
    querySelectorAll(){return[]},appendChild(){}};
  const document={readyState:'loading',documentElement:{},activeElement:null,
    querySelector:query=>query.includes('[data-section="ups"]')?root:null,
    querySelectorAll(){return[]},getElementById(){return null},
    createElement(){return{style:{},set textContent(_) {},remove(){}}},addEventListener(){}};
  const state={shippingCosts:{ups:{manualLoad:true,manualRoute:true},gate:{manualLoad:true,manualRoute:true}}};
  const window={addEventListener(){},__EXPORTHUB_GET_STATE__:()=>state};
  vm.runInNewContext(rulesSource,{window,document,Event:function(){},setTimeout(){return 1},clearTimeout(){},Intl});
  const rules=window.ExportHUBRC1206ShippingRules;
  rules.apply();
  writes=0;
  rules.apply();
  assert.equal(writes,0,'gleiche Verpackungsoptionen dürfen nicht fortlaufend neu gesetzt werden');
});
