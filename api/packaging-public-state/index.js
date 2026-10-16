'use strict';
const auth=require('../shared/auth-store');
const packApi=require('../pack-notification');
const packStore=require('../shared/pack-notification-store');

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('de-DE');}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function json(status,value){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(value)};}
function configuredTokenValid(token){let stations=[];try{stations=JSON.parse(process.env.EXPORTHUB_PACK_STATIONS_JSON||'[]')}catch(_){return false;}const wanted=packStore.hashStationToken(token);return(Array.isArray(stations)?stations:[]).some(s=>s&&s.active!==false&&text(s.token)&&packStore.hashStationToken(s.token)===wanted);}
function validateStationToken(state,token){try{return packStore.validateStationToken(state,token);}catch(e){if(configuredTokenValid(token))return{id:'configured',name:'Configured Pack Station',active:true};throw e;}}
function disabledPackaging(state){const out=[],seen=new Set();const add=value=>{const clean=text(value).replace(/\s+/g,' ').slice(0,120),key=norm(clean);if(!key||seen.has(key))return;seen.add(key);out.push(clean);};for(const item of Array.isArray(state&&state.inactiveColliTypes)?state.inactiveColliTypes:[])add(item&&item.name);for(const alias of Array.isArray(state&&state.disabledPackagingAliases)?state.disabledPackagingAliases:[])add(alias);return out;}

module.exports=async function(context,req){
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return;}
  if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'});return;}
  try{
    const payload=body(req),token=text(payload.stationToken);
    if(!token)throw auth.error('PACK_STATION_TOKEN_REQUIRED','Packtisch-Token fehlt.',400);
    const environment=packApi.resolveEnvironment(req,payload),clients=await auth.clientsForEnvironment(environment),teamDoc=await auth.readJson(clients.team,auth.emptyTeam()),team=teamDoc.value||auth.emptyTeam(),state=team.state&&typeof team.state==='object'?team.state:{};
    validateStationToken(state,token);
    const disabled=disabledPackaging(state);
    context.res=json(200,{ok:true,disabledPackaging:disabled,count:disabled.length,environment});
  }catch(e){
    context.log&&context.log.warn&&context.log.warn('packaging-public-state',e&&e.code,e&&e.message);
    context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'PACKAGING_PUBLIC_STATE_FAILED',message:e.message||'Verpackungsstatus konnte nicht geladen werden.'});
  }
};

module.exports.disabledPackaging=disabledPackaging;
module.exports.validateStationToken=validateStationToken;
