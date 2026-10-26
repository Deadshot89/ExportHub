import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));
const pickup=fs.readFileSync('pickup.html','utf8');
const storeSource=fs.readFileSync('api/shared/pickup-store.js','utf8');

function pickupStore(){
 const original=Module._load;
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return {BlobServiceClient:{fromConnectionString(){throw new Error('Pure address helper must not access storage')}}};
  return original.call(this,name,parent,isMain);
 };
 const id=require.resolve('../api/shared/pickup-store.js');
 delete require.cache[id];
 try{return require(id)}finally{Module._load=original}
}

test('RC1666: public QR route never falls back to either authenticated SPA',()=>{
 const testConfig=JSON.parse(fs.readFileSync('staticwebapp.testservice.config.json','utf8'));
 for(const [name,site] of [['PRODUCTION',config],['TESTSERVICE',testConfig]]){
  for(const route of ['/pickup','/pickup.html','/pickup/*','/pickup.html/*']){
   const entry=site.routes.find(r=>r.route===route);
   assert.ok(entry,name+': missing explicit public route '+route);
   assert.deepEqual(entry.allowedRoles,['anonymous']);
   if(route!=='/pickup.html')assert.equal(entry.rewrite,'/pickup.html');
   assert.ok(site.navigationFallback.exclude.includes(route),name+': index fallback for '+route);
   assert.match(entry.headers['Cache-Control'],/no-store/);
  }
 }
});

test('RC1666: public pickup page provides seal, three photos and ABD handover after counting',()=>{
 assert.match(pickup,/id="form" hidden/);
 assert.match(pickup,/pickup-status\?token=/);
 assert.match(pickup,/var pm=String\(u.pathname/);
 assert.match(pickup,/id="sealNumber"/);
 for(const id of ['containerPhotoLoaded','containerPhotoNumber','containerPhotoSealed','customsDocumentsConfirmed']){
  assert.ok(pickup.includes('id="'+id+'"'),id);
 }
 assert.ok(pickup.indexOf('id="colliSection"')<pickup.indexOf('id="containerSection"'));
 assert.match(pickup,/\[hidden\]\{display:none!important\}/);
});

test('RC1666: lookup of saved shipments rejects contradictory ID/reference',()=>{
 const address=storeSource.slice(storeSource.indexOf('async function resolveShipmentAddress'),storeSource.indexOf('function normalizeTransportMode'));
 const container=storeSource.slice(storeSource.indexOf('async function resolveShipmentContainerConfig'),storeSource.indexOf('function abdPresent'));
 for(const section of [address,container]){
  assert.match(section,/state\.savedShipments/);
  assert.match(section,/if\(sid&&xid&&sid!==xid\)return false/);
  assert.match(section,/if\(ref&&xref&&ref!==xref\)return false/);
 }
 assert.match(storeSource,/address:addressFromSource\(r\)\|\|''/);
});

test('RC1666: delivery address never degrades to a dash or standalone country',()=>{
 const store=pickupStore();
 assert.equal(store.addressFromSource({recipientAddress:'-',deliveryAddress:'Tor 2, Am Lager 5, 41334 Nettetal'}),'Tor 2, Am Lager 5, 41334 Nettetal');
 assert.equal(store.addressFromSource({address:'—',locationData:{street:'Hafenstraße 9',zip:'41460',city:'Neuss'}}),'Hafenstraße 9, 41460 Neuss');
 assert.equal(store.addressFromSource({recipientAddress:{street:'Logistikweg 8',postalCode:'47906',city:'Kempen'}}),'Logistikweg 8, 47906 Kempen');
 assert.equal(store.addressFromSource({address:'-',country:'DE'}),'');
 assert.equal(store.addressFromSource({address:'Alte Hauptadresse 1',locationData:{street:'Zustellort 7',postalCode:'41334',city:'Nettetal'}}),'Zustellort 7, 41334 Nettetal');
 assert.equal(store.addressFromSource({address:'Alte Hauptadresse 1',deliveryAddress:'Lieferweg 3'}),'Lieferweg 3');
});


test('RC1666: stale shipment copy does not mask valid saved address or required container evidence',async()=>{
 const team={
  state:{
   shipments:[
    {id:'SHIP-1',ref:'TEST123',recipientAddress:'-',containerDocumentationRequired:false},
    {id:'WRONG-SHIP',ref:'TEST123',recipientAddress:'Falsche Straße 99',containerDocumentationRequired:true}
   ],
   savedShipments:[
    {id:'SHIP-1',ref:'TEST123',deliveryAddress:{street:'Richtiger Weg 4',zip:'41334',city:'Nettetal'},transportMode:'sea',containerDocumentationRequired:true}
   ],
   customers:[{id:'C-1',name:'Kunde',address:'Hauptstraße 1'}]
  }
 };
 const original=Module._load;
 const previous=process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
 process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='mock-only-for-test';
 const fakeBlob={
  async download(){return{readableStreamBody:Readable.from([Buffer.from(JSON.stringify(team))]),etag:'mock-1'}}
 };
 Module._load=function(name,parent,isMain){
  if(name==='@azure/storage-blob')return {
   BlobServiceClient:{fromConnectionString(){return{
    getContainerClient(){return{async createIfNotExists(){},getBlockBlobClient(){return fakeBlob}}}
   }}}
  };
  return original.call(this,name,parent,isMain)
 };
 const id=require.resolve('../api/shared/pickup-store.js');
 delete require.cache[id];
 let store;
 try{store=require(id)}finally{Module._load=original}
 try{
  const record={shipmentId:'SHIP-1',reference:'TEST123',address:'-'};
  assert.equal(await store.resolveShipmentAddress(record,'testservice'),'Richtiger Weg 4, 41334 Nettetal');
  const cfg=await store.resolveShipmentContainerConfig(record,'testservice');
  assert.equal(cfg.containerDocumentationRequired,true);
  assert.equal(cfg.transportMode,'sea');
 }finally{
  if(previous===undefined)delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=previous;
 }
});


test('RC1666: already printed /?pickup=TOKEN QR bypasses the login SPA on both sites',()=>{
 const redirect=fs.readFileSync('assets/rc1666-public-pickup-query-redirect.js','utf8');
 const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(builder,/if\(file==='index.html'\|\|file==='TESTVERSION.html'\)/);
 assert.match(builder,/injectImmediateRuntimeAfterHead\(html,'<script id="exporthub-rc1666-public-pickup-redirect">'\+redirect/);
 const lastFeaturePatch=builder.indexOf('html=patchTaskPlannerV2UiCutover(html,file);');
 const redirectInsertion=builder.indexOf("const redirect=fs.readFileSync(path.join(ROOT,'assets/rc1666-public-pickup-query-redirect.js')");
 const finalWrite=builder.indexOf('fs.writeFileSync(target,html);',lastFeaturePatch);
 assert.ok(lastFeaturePatch>=0&&lastFeaturePatch<redirectInsertion&&redirectInsertion<finalWrite,'QR redirect must be inserted after auth and other head modifications');
 assert.match(builder,/redirect not first executable head script/);
 const cases=[
  {base:'https://www.exporthub360.de',query:'/?pickup='+'a'.repeat(48),token:'a'.repeat(48)},
  {base:'https://example-testservice.azurestaticapps.net',query:'/?pickup='+'b'.repeat(48)+'&environment=testservice',token:'b'.repeat(48),env:'testservice'},
  {base:'https://www.exporthub360.de',query:'/?ehcmd=pickup&ref=ABCDEF12',token:'ABCDEF12'},
  {base:'https://www.exporthub360.de',query:'/?pickup=bad',token:'invalid'}
 ];
 for(const c of cases){
  const navigations=[];
  const location={href:c.base+c.query,replace(url){navigations.push(url)}};
  vm.runInNewContext(redirect,{window:{location},URL},{timeout:1000});
  assert.equal(navigations.length,1,c.query+': QR must be redirected');
  const target=new URL(navigations[0]);
  assert.equal(target.origin,c.base);
  assert.equal(target.pathname,'/pickup.html');
  assert.equal(target.searchParams.get('token'),c.token);
  assert.equal(target.searchParams.get('environment'),c.env||null);
 }
 for(const query of ['/', '/?view=dashboard', '/?token=unrelated-password-reset']){
  const navigations=[],location={href:'https://www.exporthub360.de'+query,replace(x){navigations.push(x)}};
  vm.runInNewContext(redirect,{window:{location},URL},{timeout:1000});
  assert.equal(navigations.length,0,'ordinary website login must be unchanged: '+query);
 }
});
