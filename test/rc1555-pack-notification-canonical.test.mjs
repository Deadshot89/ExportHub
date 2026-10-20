import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const packStore=require('../api/shared/pack-notification-store.js');
const api=require('../api/pack-notification/index.js');

function fixture(){
  const token='PT01-rc1555-canonical';
  let state={
    packagingTypes:[
      {id:'PKG-BOX-A',name:'Spezialbox A',code:'BOXA',description:'Kanonische Testbox',l:88,w:55,h:44,ldm:0.21,active:true},
      {id:'PKG-NODIM',name:'Neue Sonderverpackung',code:'NEWBOX',description:'Maße werden beim Packen erfasst',l:null,w:null,h:null,ldm:null,active:true},
      {id:'PKG-INACTIVE',name:'Alte Kiste',code:'OLD',description:'',l:70,w:50,h:40,ldm:0.15,active:false},
      {id:'PKG-E3',name:'E3',code:'E3',description:'',l:60,w:40,h:22,ldm:0.10,active:true}
    ],
    // Must not become a second runtime source once canonical packagingTypes exists.
    colliTypes:[{id:'LEGACY-ONLY',name:'Legacy Only',l:99,w:88,h:77,ldm:0.33}],
    inactiveColliTypes:[],disabledPackagingAliases:[],
    packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(token),active:true}],
    packSessions:[],packNotifications:[],packDrafts:[],tasks:[]
  };
  const handler=api.createHandler({
    now:()=>new Date('2026-10-16T18:10:00.000Z'),
    rateLimit:()=>{},
    mutateState:async(_environment,mutator)=>{
      const result=await mutator(JSON.parse(JSON.stringify(state)));
      state=result.state;
      return result;
    }
  });
  return{token,handler,state:()=>state};
}

function request(action,body){return{method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body};}
function pdf(){return{id:'doc-1',name:'DNC3019222063.pdf',mimeType:'application/pdf',size:14,data:'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y='};}
function submitPayload(token,sessionId,overrides={}){return{
  stationToken:token,sessionId,idempotencyKey:'idem-rc1555-001',customer:'Testkunde',customerSource:'manual',deliveryNoteReference:'DNC3019222063.pdf',
  packageType:'Spezialbox A',packageTypeId:'PKG-BOX-A',packageCount:1,totalWeight:120,
  packages:[{packageNo:1,length:88,width:55,height:44,unit:'cm'}],note:'',documents:[pdf()],...overrides
};}

test('RC1555 QR packaging-list exposes active canonical packagingTypes only and E3 comes from protected master seed',async()=>{
  const f=fixture();
  const res=await f.handler(request('packaging-list',{stationToken:f.token}));
  assert.equal(res.status,200);
  assert.equal(res.body.ok,true);
  const box=res.body.packaging.find(x=>x.id==='PKG-BOX-A');
  assert.deepEqual(box,{id:'PKG-BOX-A',name:'Spezialbox A',code:'BOXA',length:88,width:55,height:44,ldm:0.21,source:'master'});
  const noDim=res.body.packaging.find(x=>x.id==='PKG-NODIM');
  assert.deepEqual(noDim,{id:'PKG-NODIM',name:'Neue Sonderverpackung',code:'NEWBOX',length:null,width:null,height:null,ldm:null,source:'master'},'active packaging without preset dimensions must stay selectable so packers can enter dimensions manually');
  assert.equal(res.body.packaging.some(x=>x.name==='Legacy Only'),false,'legacy colliTypes must not become a second runtime source');
  assert.equal(res.body.packaging.some(x=>x.id==='PKG-INACTIVE'),false,'inactive master packaging must not be selectable');
  const e3=res.body.packaging.find(x=>x.id==='PKG-E3');
  assert.deepEqual(e3,{id:'PKG-E3',name:'E3',code:'E3',length:43,width:31,height:31,ldm:0.06,source:'master'});
});

test('RC1555 QR submit stores canonical packaging id plus immutable snapshot while keeping compatibility text',async()=>{
  const f=fixture();
  const session=await f.handler(request('session',{stationToken:f.token}));
  assert.equal(session.status,201);
  const submit=await f.handler(request('submit',submitPayload(f.token,session.body.sessionId)));
  assert.equal(submit.status,201);
  const notification=f.state().packNotifications[0];
  assert.equal(notification.packageType,'Spezialbox A');
  assert.equal(notification.packagingTypeId,'PKG-BOX-A');
  assert.deepEqual(notification.packagingSnapshot,{name:'Spezialbox A',code:'BOXA',description:'Kanonische Testbox',lengthCm:88,widthCm:55,heightCm:44,ldm:0.21});
  const master=f.state().packagingTypes.find(x=>x.id==='PKG-BOX-A');
  master.name='Spezialbox A Neu';
  master.code='BOXNEW';
  master.l=100;
  assert.deepEqual(notification.packagingSnapshot,{name:'Spezialbox A',code:'BOXA',description:'Kanonische Testbox',lengthCm:88,widthCm:55,heightCm:44,ldm:0.21},'historical QR snapshot must not follow later master changes');
});

test('RC1555 QR submit accepts active packaging without preset dimensions when actual package dimensions are entered',async()=>{
  const f=fixture();
  const session=await f.handler(request('session',{stationToken:f.token}));
  const submit=await f.handler(request('submit',submitPayload(f.token,session.body.sessionId,{packageType:'Neue Sonderverpackung',packageTypeId:'PKG-NODIM',packages:[{packageNo:1,length:77,width:66,height:55,unit:'cm'}]})));
  assert.equal(submit.status,201);
  const notification=f.state().packNotifications[0];
  assert.equal(notification.packagingTypeId,'PKG-NODIM');
  assert.deepEqual(notification.packagingSnapshot,{name:'Neue Sonderverpackung',code:'NEWBOX',description:'Maße werden beim Packen erfasst',lengthCm:null,widthCm:null,heightCm:null,ldm:null});
  assert.deepEqual(notification.packages,[{packageNo:1,length:77,width:66,height:55,unit:'cm'}]);
});

test('RC1555 QR submit rejects inactive or unknown packaging instead of trusting client text',async()=>{
  const f=fixture();
  const session=await f.handler(request('session',{stationToken:f.token}));
  const res=await f.handler(request('submit',submitPayload(f.token,session.body.sessionId,{packageType:'Alte Kiste',packageTypeId:'PKG-INACTIVE'})));
  assert.equal(res.status,409);
  assert.equal(res.body.code,'PACK_PACKAGE_TYPE_INACTIVE');
  assert.equal(f.state().packNotifications.length,0);
});

test('RC1555 canonical resolver keeps legacy no-space aliases such as Europalette compatible',()=>{
  const resolved=api.resolvePackagingSelection({colliTypes:[],inactiveColliTypes:[],disabledPackagingAliases:[]},'Europalette','');
  assert.equal(resolved.packagingTypeId,'PKG-EURO-PALETTE');
  assert.equal(resolved.packageType,'Euro Palette');
  assert.equal(resolved.packagingSnapshot.lengthCm,120);
  assert.equal(resolved.packagingSnapshot.widthCm,80);
});