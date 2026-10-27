import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const auth=require('../api/shared/auth-store.js');
const guard=require('../api/shared/state-write-guard.js');
const src=fs.readFileSync('api/manual-pickup-confirm/index.js','utf8');
const allowed=user=>auth.hasAnyEditRight(user)&&guard.canEditAny(user,['shipment','shipmentoverview','pickupcalendar']);
const employee=(rights)=>({active:true,role:'Benutzer',rights});

test('RC1695: manual pickup endpoint checks relevant module edit rights before mutating team data',()=>{
 assert.match(src,/!auth\.hasAnyEditRight\(session\.user\)\|\|!stateWriteGuard\.canEditAny\(session\.user,\['shipment','shipmentoverview','pickupcalendar'\]\)/);
 const gate=src.indexOf('stateWriteGuard.canEditAny(session.user'),mutation=src.indexOf('await confirmManualPickup(environment,id,reference,payload,session.user)');
 assert.ok(gate>0&&mutation>gate,'rights must be checked before manual pickup writes');
});

test('RC1695: unrelated editor cannot confirm a pickup',()=>{
 for(const key of ['tasks','pallet','customers','ideas','documents','settings']){
  assert.equal(allowed(employee({[key]:{access:'edit'}})),false,key+' rights are unrelated to pickup');
 }
});

test('RC1695: authorized shipment/pickup editors continue to work; readers stay blocked',()=>{
 for(const key of ['shipment','shipmentoverview','pickupcalendar']){
  assert.equal(allowed(employee({[key]:{access:'edit'}})),true,key+' edit may confirm pickup');
  assert.equal(allowed(employee({[key]:{access:'view'}})),false,key+' reader cannot confirm pickup');
 }
 assert.equal(allowed({active:true,globalAdmin:true,role:'Globaler Administrator',rights:{}}),true);
});
