'use strict';
const store=require('../shared/pickup-store');
function body(req){try{return store&&typeof store.body==='function'?store.body(req):(req&&req.body||{})}catch(_){return req&&req.body||{}}}
function json(status,payload){if(store&&typeof store.json==='function')return store.json(status,payload);return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:payload}}
module.exports=async function(context,req){
  const method=String(req&&req.method||'GET').toUpperCase();
  if(method==='OPTIONS'){context.res={status:204,headers:{'Cache-Control':'no-store'}};return}
  if(method!=='GET'&&method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Methode nicht erlaubt.'});return}
  try{
    const b=body(req)||{},q=req&&req.query||{};
    const token=String(q.token||b.token||'').trim().toLowerCase();
    if(!token||(store&&typeof store.validToken==='function'&&!store.validToken(token))){context.res=json(400,{ok:false,code:'INVALID_TOKEN',message:'Pickup-Token fehlt oder ist ungültig.'});return}
    if(!store||typeof store.getRecord!=='function')throw Object.assign(new Error('Pickup-Speicher ist nicht verfügbar.'),{code:'PICKUP_STORE_UNAVAILABLE',status:503});
    const got=await store.getRecord(token);
    const record=Object.assign({},got&&got.record||{}, {token});
    if(!got||!got.record){context.res=json(404,{ok:false,code:'PICKUP_NOT_FOUND',message:'Pickup-Vorgang wurde nicht gefunden.'});return}
    if(typeof store.expired==='function'&&store.expired(record)){context.res=json(410,{ok:false,code:'PICKUP_EXPIRED',message:'Pickup-Link ist abgelaufen.',status:record.status||'expired'});return}
    const pub=typeof store.publicRecord==='function'?store.publicRecord(record):record;
    context.res=json(200,Object.assign({ok:true},pub||{}));
  }catch(error){
    const rawStatus=Number(error&& (error.status||error.statusCode)||0);
    const status=rawStatus>=400&&rawStatus<600?rawStatus:503;
    try{context.log.error('pickup-status',error&&error.code||'',error&&error.message||error)}catch(_){}
    context.res=json(status,{ok:false,code:String(error&&error.code||'PICKUP_STATUS_FAILED'),message:status>=500?'Pickup-Status ist vorübergehend nicht verfügbar.':String(error&&error.message||'Pickup-Status konnte nicht geladen werden.')});
  }
};
