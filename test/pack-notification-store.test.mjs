import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);

function loadStore(){
  return require('../api/shared/pack-notification-store.js');
}

function baseState(store){
  const token='PT01-2vbV-7Zx1-9nJp-4KqM';
  return {
    token,
    state:{
      packStations:[{
        id:'PT01',
        name:'Packtisch 01',
        tokenHash:store.hashStationToken(token),
        active:true,
        createdAt:'2026-10-08T08:00:00.000Z',
        updatedAt:'2026-10-08T08:00:00.000Z'
      }],
      packSessions:[],
      packNotifications:[]
    }
  };
}

test('station token is stored and compared only as SHA-256 hash',()=>{
  const store=loadStore();
  const token='PT01-secret-token';
  const hash=store.hashStationToken(token);
  assert.match(hash,/^[a-f0-9]{64}$/);
  assert.notEqual(hash,token);
  const {state}=baseState(store);
  assert.equal(store.validateStationToken(state,'PT01-2vbV-7Zx1-9nJp-4KqM').id,'PT01');
});

test('invalid or deactivated station token is rejected',()=>{
  const store=loadStore();
  const {state,token}=baseState(store);
  assert.throws(()=>store.validateStationToken(state,'wrong-token'),e=>e&&e.code==='PACK_STATION_INVALID');
  state.packStations[0].active=false;
  assert.throws(()=>store.validateStationToken(state,token),e=>e&&e.code==='PACK_STATION_INACTIVE');
});

test('each scan creates an unpredictable independent session for the same station',()=>{
  const store=loadStore();
  const {state}=baseState(store);
  const a=store.createSession(state,'PT01','2026-10-08T10:00:00.000Z');
  const b=store.createSession(a.state,'PT01','2026-10-08T10:00:01.000Z');
  assert.notEqual(a.session.id,b.session.id);
  assert.match(a.session.id,/^[a-f0-9-]{32,}$/i);
  assert.match(b.session.id,/^[a-f0-9-]{32,}$/i);
  assert.equal(a.session.packStationId,'PT01');
  assert.equal(b.session.packStationId,'PT01');
  assert.equal(b.state.packSessions.length,2);
  assert.deepEqual(b.state.packSessions.map(x=>x.id).sort(),[a.session.id,b.session.id].sort());
});

test('session operations do not mutate another session',()=>{
  const store=loadStore();
  const {state}=baseState(store);
  const first=store.createSession(state,'PT01','2026-10-08T10:00:00.000Z');
  const second=store.createSession(first.state,'PT01','2026-10-08T10:00:01.000Z');
  const expired=store.expireSession(second.state,first.session.id,'2026-10-08T18:00:00.000Z');
  assert.equal(store.getSession(expired.state,first.session.id).status,'expired');
  assert.equal(store.getSession(expired.state,second.session.id).status,'new');
});

test('submitted session is idempotent and repeat submit returns same notification',()=>{
  const store=loadStore();
  const {state}=baseState(store);
  const created=store.createSession(state,'PT01','2026-10-08T10:00:00.000Z');
  const payload={
    idempotencyKey:'idem-001',
    customer:'BSH Hausgeräte',
    deliveryNoteReference:'LS123456',
    packageType:'Europalette',
    packageCount:1,
    totalWeight:480,
    packages:[{packageNo:1,length:120,width:80,height:140,unit:'cm'}],
    note:'',
    documents:[{id:'doc-1',name:'LS123456.pdf',storage:'blob',blobName:'pack/doc-1',mimeType:'application/pdf',size:1234}]
  };
  const first=store.submitSession(created.state,created.session.id,payload,'2026-10-08T10:02:00.000Z');
  assert.equal(first.created,true);
  assert.equal(first.notification.status,'new');
  assert.match(first.notification.reference,/^PK-[A-Z0-9]{8,}$/);
  assert.equal(store.getSession(first.state,created.session.id).status,'submitted');

  const second=store.submitSession(first.state,created.session.id,payload,'2026-10-08T10:02:03.000Z');
  assert.equal(second.created,false);
  assert.equal(second.notification.id,first.notification.id);
  assert.equal(second.notification.reference,first.notification.reference);
  assert.equal(second.state.packNotifications.length,1);
});

test('expired session cannot be submitted',()=>{
  const store=loadStore();
  const {state}=baseState(store);
  const created=store.createSession(state,'PT01','2026-10-08T10:00:00.000Z');
  const expired=store.expireSession(created.state,created.session.id,'2026-10-08T18:00:00.000Z');
  assert.throws(()=>store.submitSession(expired.state,created.session.id,{idempotencyKey:'idem-x'},'2026-10-08T18:01:00.000Z'),e=>e&&e.code==='PACK_SESSION_EXPIRED');
});

test('generic state merge preserves two concurrent pack sessions from the same station',()=>{
  const {mergeState}=require('../api/shared/merge.js');
  const meta={_teamSyncMeta:{fields:{},tombstones:[]}};
  const server={...meta,packSessions:[{id:'session-a',packStationId:'PT01',status:'new',createdAt:'2026-10-08T10:00:00.000Z'}]};
  const incoming={...meta,packSessions:[{id:'session-b',packStationId:'PT01',status:'new',createdAt:'2026-10-08T10:00:01.000Z'}]};
  const merged=mergeState(server,incoming);
  assert.deepEqual(merged.packSessions.map(x=>x.id).sort(),['session-a','session-b']);
});

test('document blob store treats packNotifications as a first-class document root',()=>{
  const documents=require('../api/shared/document-blob-store.js');
  assert.ok(documents.ROOT_COLLECTIONS.includes('packNotifications'));
});
