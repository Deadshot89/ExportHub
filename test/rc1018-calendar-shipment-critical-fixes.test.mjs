import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import Module from 'node:module';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const OLD_STORAGE = process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
let built = false;
test.after(()=>{
  if(OLD_STORAGE===undefined) delete process.env.EXPORTHUB_STORAGE_CONNECTION_STRING;
  else process.env.EXPORTHUB_STORAGE_CONNECTION_STRING=OLD_STORAGE;
});

function buildRc1018(){
  if (built) return;
  execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  built = true;
}
function between(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,`${start} konnte nicht isoliert werden`);
  return source.slice(a,b);
}
function builtHtml(){
  buildRc1018();
  return fs.readFileSync(path.join(ROOT,'dist-rc1018','index.html'),'utf8');
}
function evalRc565Locations(){
  const src=between(builtHtml(),'function locations(c){var all=[]','function findLocation(c,v)');
  return Function(`
    const a=v=>Array.isArray(v)?v:[];
    const q=v=>String(v==null?'':v).trim();
    const n=v=>q(v).toLowerCase();
    const cacc=c=>q(c&&(c.account||c.customerNumber||c.customerNo));
    const cid=c=>q(c&&(c.id||c.customerId||c.account||c.customerNumber));
    ${src}
    return locations;
  `)();
}
function evalIndex289Locations(){
  const html=builtHtml();
  const start='function locationList(c){var map={},out=[];';
  const src=between(html,start,'function savedLocationId(sh,list)');
  return Function(`
    const arr=v=>Array.isArray(v)?v:[];
    const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
    const q=v=>String(v==null?'':v).trim();
    const low=v=>q(v).toLowerCase();
    const cid=c=>q(c&&(c.id||c.customerId||c.account||c.customerNumber));
    const rawAddress=x=>q(x&&((typeof x.address==='string'&&x.address)||(typeof x.recipientAddress==='string'&&x.recipientAddress)||(typeof x.deliveryAddress==='string'&&x.deliveryAddress)||x.fullAddress||x.formattedAddress));
    ${src}
    return locationList;
  `)();
}

function makeMemoryBlobRest(){
  const blobs=new Map();
  let serial=1;
  function notFound(){const e=new Error('Blob not found');e.statusCode=404;return e;}
  function conflict(){const e=new Error('Condition not met');e.statusCode=412;return e;}
  return {
    blobs,
    createBlobServiceClient(){return {getContainerClient(containerName){return {getBlockBlobClient(name){
      const key=`${containerName}/${name}`;
      return {
        async download(){const item=blobs.get(key);if(!item)throw notFound();return {etag:item.etag,readableStreamBody:(async function*(){yield item.data;})()};},
        async upload(raw,_length,options={}){const current=blobs.get(key),cond=options.conditions||{};if(cond.ifMatch&&(!current||current.etag!==cond.ifMatch))throw conflict();if(cond.ifNoneMatch==='*'&&current)throw conflict();const etag=`\"e${serial++}\"`;blobs.set(key,{data:Buffer.from(String(raw)),etag});return {etag};}
      };
    }};}};}
  };
}
function loadFixedStore(memory){
  process.env.EXPORTHUB_STORAGE_CONNECTION_STRING='rc1018-memory';
  const target=require.resolve('../api/shared/fixed-pickup-store.js');
  const seed=require.resolve('../api/shared/rc1014-fixed-pickup-seed.js');
  const original=Module._load;
  Module._load=function(request,parent,isMain){if(request==='./blob-rest')return memory;return original.call(this,request,parent,isMain);};
  delete require.cache[target];delete require.cache[seed];
  try{return require(target);}finally{Module._load=original;}
}

test('RC1018 Kalender: bereits initialisierter aber leerer Essentra-FIX-Speicher wird selbstheilend ergänzt',async()=>{
  const memory=makeMemoryBlobRest();
  const store=loadFixedStore(memory);
  const blob=store.blobName('production','essentra');
  const doc={schemaVersion:1,seedVersion:2,environment:'production',companyKey:'essentra',revision:7,updatedAt:'2026-09-09T12:00:00.000Z',items:[]};
  memory.blobs.set(`exporthub-data/${blob}`,{data:Buffer.from(JSON.stringify(doc)),etag:'\"old\"'});
  const items=await store.list('production','essentra',{includeInactive:true});
  assert.deepEqual(items.map(x=>`${x.siteLabel}|${x.weekday}`).sort(),[
    'BMP|3','Faurecia|2','Frankreich|1','Italien|1','Neff|1','O’Hare|1'
  ].sort());
});

test('RC1018 Standorte: RC565 führt Hauptadresse und zusätzliche gespeicherte Standorte gleichzeitig',()=>{
  const locations=evalRc565Locations();
  const list=locations({id:'C1',account:'1001',name:'Kunde',address:'Hauptweg 1, 41061 Mönchengladbach',country:'DE',locations:[{id:'L2',name:'Werk 2',address:'Nebenweg 2, 41747 Viersen',country:'DE'}]});
  assert.equal(list.length,2);
  assert.ok(list.some(x=>String(x.id).startsWith('MAIN-')&&x.address.includes('Hauptweg 1')),'Hauptadresse fehlt als auswählbarer Standort');
  assert.ok(list.some(x=>x.id==='L2'&&x.address.includes('Nebenweg 2')),'Zusatzstandort fehlt');
});

test('RC1018 Standorte: sichtbarer Index289-Selector enthält Hauptadresse und Zusatzstandort parallel',()=>{
  const locationList=evalIndex289Locations();
  const list=locationList({id:'C1',name:'Kunde',address:'Hauptweg 1, 41061 Mönchengladbach',country:'DE',locations:[{id:'L2',name:'Werk 2',address:'Nebenweg 2, 41747 Viersen',country:'DE'}]});
  assert.equal(list.length,2);
  assert.ok(list.some(x=>String(x.id).startsWith('MAIN-')&&x.address.includes('Hauptweg 1')));
  assert.ok(list.some(x=>x.id==='L2'&&x.address.includes('Nebenweg 2')));
});

test('RC1018 Lieferavis: ungespeicherter Draft darf seine Referenz ohne vorherigen DOM-Speicherzustand verwenden',async()=>{
  const source=fs.readFileSync('assets/rc1015-lieferavis-mail-flow.js','utf8');
  const shipment={reference:'ABC123',customerName:'Normaler Kunde'};
  const persists=[],toggles=[],alerts=[];
  const document={
    readyState:'complete',
    querySelectorAll(){return[];},
    getElementById(){return null;},
    addEventListener(){}
  };
  const base={enabled(){return true;},link(){return'https://avis.example/customer';},async toggle(on){toggles.push(on);return true;},injectMailBody(_s,_t,b){return b;}};
  const state={shipment,shipments:[]};
  const window={document,ExportHUBCustomerAvis706:base,ExportHUBClean:{state},ExportHUBRC565:{async persistShipment(){persists.push('persist');state.shipments=[shipment];return true;}},addEventListener(){},console};
  const context=vm.createContext({window,document,console,alert:m=>alerts.push(String(m)),requestAnimationFrame:fn=>fn(),setTimeout:fn=>fn()});
  vm.runInContext(source,context,{filename:'assets/rc1015-lieferavis-mail-flow.js'});
  const ok=await window.ExportHUBCustomerAvis706.toggle(true);
  assert.equal(ok,true);
  assert.deepEqual(persists,['persist']);
  assert.deepEqual(toggles,[true]);
  assert.deepEqual(alerts,[]);
});
