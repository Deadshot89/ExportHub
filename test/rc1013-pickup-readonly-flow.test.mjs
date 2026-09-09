import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify(body)}}
function err(code,message,status=400){const e=new Error(message||code);e.code=code;e.status=status;e.statusCode=status;return e}
function bodyOf(res){return JSON.parse(String(res&&res.body||'{}'))}
function loadWithMocks(relativeFile,mocks){const absolute=path.resolve(ROOT,relativeFile),original=Module._load;Module._load=function(request,parent,isMain){if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];return original.call(this,request,parent,isMain)};delete require.cache[require.resolve(absolute)];try{return require(absolute)}finally{Module._load=original}}
function fixture(complete){const token='a'.repeat(48),record={status:complete?'confirmed':'open',complete,expectedColliCount:3,collectedPickupCollis:complete?3:1,confirmedAt:complete?'2026-09-09T08:00:00.000Z':null};const access={async resolve(_req,kind,raw,options){assert.equal(kind,'pickup');assert.equal(raw,token);assert.equal(options&&options.allowUsed,false);return{environment:'testservice',tokenHash:'pickup-hash',record:{usedAt:'2026-09-09T08:00:00.000Z'}}}};const store={json,err,body(req){return req&&req.body&&typeof req.body==='object'?req.body:{}},pickupComplete(value){return value&&value.complete===true},async getRecord(){return{record}},publicRecord(value,raw){return{token:raw,status:value.status,expectedColliCount:value.expectedColliCount,collectedPickupCollis:value.collectedPickupCollis,confirmedAt:value.confirmedAt}}};return{handler:loadWithMocks('api/pickup-status/index.js',{'../shared/public-access-store':access,'../shared/pickup-store':store}),token}}

test('vollständig abgeholter wiederverwendbarer Pickup-Link bleibt nur lesbar',async()=>{const f=fixture(true),context={res:null,log:{error(){}}};await f.handler(context,{method:'GET',query:{token:f.token,environment:'testservice'}});assert.equal(context.res.status,200);const body=bodyOf(context.res);assert.equal(body.readOnly,true);assert.equal(body.oneTime,false);assert.equal(body.confirmedAt,'2026-09-09T08:00:00.000Z');});

test('noch offene wiederverwendbare Pickup-Links bleiben nach usedAt erneut bedienbar',async()=>{const f=fixture(false),context={res:null,log:{error(){}}};await f.handler(context,{method:'GET',query:{token:f.token,environment:'testservice'}});assert.equal(context.res.status,200);const body=bodyOf(context.res);assert.equal(body.readOnly,false);assert.equal(body.oneTime,false);});
