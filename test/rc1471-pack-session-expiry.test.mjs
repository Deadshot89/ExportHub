import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const store=require('../api/shared/pack-notification-store.js');

function state(){
  const token='PT01-expiry-token';
  return {
    token,
    value:{
      packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:store.hashStationToken(token),active:true}],
      packSessions:[],
      packNotifications:[]
    }
  };
}

test('RC1471 P1: Pack-Session ist nach expiresAt serverseitig nicht mehr submitbar',()=>{
  const base=state();
  const created=store.createSession(base.value,'PT01','2026-10-08T10:00:00.000Z');
  assert.equal(created.session.expiresAt,'2026-10-08T18:00:00.000Z');
  assert.throws(
    ()=>store.submitSession(created.state,created.session.id,{idempotencyKey:'expiry-check'},'2026-10-08T18:00:00.001Z'),
    error=>error&&error.code==='PACK_SESSION_EXPIRED'&&Number(error.statusCode||error.status)===409
  );
  assert.equal(store.getSession(created.state,created.session.id).status,'new','abgelehnte Ablaufprüfung darf den Eingabestate nicht mutieren');
});

test('RC1471 P1: Pack-Session ist exakt ab expiresAt abgelaufen',()=>{
  const base=state();
  const created=store.createSession(base.value,'PT01','2026-10-08T10:00:00.000Z');
  assert.throws(
    ()=>store.submitSession(created.state,created.session.id,{idempotencyKey:'expiry-boundary'},'2026-10-08T18:00:00.000Z'),
    error=>error&&error.code==='PACK_SESSION_EXPIRED'&&Number(error.statusCode||error.status)===409
  );
});

test('RC1471 P1: Pack-Session bleibt unmittelbar vor expiresAt submitbar',()=>{
  const base=state();
  const created=store.createSession(base.value,'PT01','2026-10-08T10:00:00.000Z');
  const result=store.submitSession(created.state,created.session.id,{idempotencyKey:'before-expiry'},'2026-10-08T17:59:59.999Z');
  assert.equal(result.created,true);
  assert.equal(store.getSession(result.state,created.session.id).status,'submitted');
});
