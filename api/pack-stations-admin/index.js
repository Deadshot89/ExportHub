'use strict';
const crypto=require('crypto');
const QRCode=require('qrcode');
const auth=require('../shared/auth-store');
const packStore=require('../shared/pack-notification-store');

const SHARED_STATION_ID='PACK-SHARED';
const SHARED_STATION_NAME='Packbereich';

function text(v){return String(v==null?'':v).trim();}
function json(status,body){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(body)};}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function stationSecret(){return crypto.createHmac('sha256',auth.sessionSigningSecret()).update('ExportHUB/pack-station-admin/v1').digest();}
function stationToken(station){
 const id=text(station&&station.id),version=Math.max(1,Number(station&&station.tokenVersion||0));
 if(!id)throw auth.error('PACK_STATION_ID_REQUIRED','Packzugang-ID fehlt.',400);
 const sig=crypto.createHmac('sha256',stationSecret()).update(id+'|'+version).digest('base64url');
 return 'pks1_'+sig;
}
function publicStation(station){return{id:text(station&&station.id),name:text(station&&station.name),active:station&&station.active!==false,tokenVersion:Number(station&&station.tokenVersion||0),createdAt:text(station&&station.createdAt),updatedAt:text(station&&station.updatedAt),recoverable:Number(station&&station.tokenVersion||0)>0};}
function packOrigin(req,environment){const h=req&&req.headers||{},host=text(h['x-forwarded-host']||h['x-original-host']||h.host||h.Host);if(host)return'https://'+host;if(environment==='production')return'https://exporthub360.com';return'';}
async function qrPayload(req,environment,station){
 const version=Number(station&&station.tokenVersion||0);if(!(version>0))throw auth.error('PACK_STATION_TOKEN_NOT_RECOVERABLE','Der Pack-QR-Code kann nicht wiederhergestellt werden. Bitte QR-Code erneuern.',409);
 const token=stationToken(station),hash=packStore.hashStationToken(token);if(text(station.tokenHash)!==hash)throw auth.error('PACK_STATION_TOKEN_SECRET_CHANGED','Der QR-Code kann mit dem aktuellen Serverschlüssel nicht wiederhergestellt werden. Bitte QR-Code erneuern.',409);
 const path='/pack/'+encodeURIComponent(token),origin=packOrigin(req,environment),url=origin?origin+path:path;
 const qrSvg=await QRCode.toString(url,{type:'svg',errorCorrectionLevel:'M',margin:2,width:420});
 return{path,url,qrSvg};
}
function stations(team){team.state=team.state&&typeof team.state==='object'?team.state:{};team.state.packStations=Array.isArray(team.state.packStations)?team.state.packStations:[];return team.state.packStations;}
function findStation(list,id){return list.find(x=>text(x&&x.id)===text(id))||null;}
function adminName(user){return text(user&&(user.name||user.displayName||user.user||user.username))||'Administrator';}
function ensureSharedStation(list,now){
 let station=findStation(list,SHARED_STATION_ID);
 if(!station){station={id:SHARED_STATION_ID,name:SHARED_STATION_NAME,active:true,tokenVersion:1,tokenHash:'',createdAt:now,updatedAt:now};station.tokenHash=packStore.hashStationToken(stationToken(station));list.push(station);return{station,created:true};}
 station.name=SHARED_STATION_NAME;station.active=true;
 if(!(Number(station.tokenVersion)>0)){station.tokenVersion=1;station.tokenHash=packStore.hashStationToken(stationToken(station));station.updatedAt=now;}
 return{station,created:false};
}

module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return;}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED',message:'Nur POST ist erlaubt.'});return;}
 try{
  const payload=body(req),current=await auth.validateSession(req),user=current.user;
  if(!auth.isAdmin(user))throw auth.error('GLOBAL_ADMIN_REQUIRED','Nur Administratoren dürfen den Pack-QR-Code verwalten.',403);
  const environment=auth.environmentFromRequest(req),action=text(payload.action||'shared').toLowerCase();
  if(action==='shared'||action==='rotate-shared'){
   const result=await auth.mutateTeamForEnvironment(environment,team=>{
    const list=stations(team),now=new Date().toISOString(),ensured=ensureSharedStation(list,now),station=ensured.station;
    if(action==='rotate-shared'){
     station.tokenVersion=Math.max(1,Number(station.tokenVersion||0))+1;
     station.tokenHash=packStore.hashStationToken(stationToken(station));
     station.updatedAt=now;
     auth.addAudit(team,'PACK_SHARED_QR_ROTATED',adminName(user),{stationId:station.id});
    }else if(ensured.created){
     auth.addAudit(team,'PACK_SHARED_QR_CREATED',adminName(user),{stationId:station.id});
    }
    return{station:publicStation(station),rawStation:station};
   });
   const station=result.result.station,raw=result.result.rawStation;
   context.res=json(200,Object.assign({ok:true,station,environment,shared:true},await qrPayload(req,environment,raw)));return;
  }
  if(action==='list'){
   const list=(current.team&&current.team.state&&Array.isArray(current.team.state.packStations)?current.team.state.packStations:[]).map(publicStation).sort((a,b)=>a.name.localeCompare(b.name,'de'));
   context.res=json(200,{ok:true,stations:list,count:list.length,environment});return;
  }
  if(action==='qr'){
   const list=current.team&&current.team.state&&Array.isArray(current.team.state.packStations)?current.team.state.packStations:[],station=findStation(list,payload.id);
   if(!station)throw auth.error('PACK_STATION_NOT_FOUND','Packzugang nicht gefunden.',404);
   context.res=json(200,Object.assign({ok:true,station:publicStation(station),environment},await qrPayload(req,environment,station)));return;
  }
  const result=await auth.mutateTeamForEnvironment(environment,team=>{
   const list=stations(team),now=new Date().toISOString();let station;
   if(action==='create'){
    const name=text(payload.name);if(!name)throw auth.error('PACK_STATION_NAME_REQUIRED','Name des Packzugangs fehlt.',400);
    if(list.some(x=>text(x&&x.name).toLocaleLowerCase('de-DE')===name.toLocaleLowerCase('de-DE')))throw auth.error('PACK_STATION_NAME_EXISTS','Ein Packzugang mit diesem Namen existiert bereits.',409);
    station={id:'PST-'+crypto.randomBytes(10).toString('hex'),name,active:true,tokenVersion:1,tokenHash:'',createdAt:now,updatedAt:now};
    station.tokenHash=packStore.hashStationToken(stationToken(station));list.push(station);
    auth.addAudit(team,'PACK_STATION_CREATED',adminName(user),{stationId:station.id,stationName:station.name,active:true});
   }else{
    station=findStation(list,payload.id);if(!station)throw auth.error('PACK_STATION_NOT_FOUND','Packzugang nicht gefunden.',404);
    if(action==='rotate'){
     station.tokenVersion=Math.max(0,Number(station.tokenVersion||0))+1;station.tokenHash=packStore.hashStationToken(stationToken(station));station.updatedAt=now;
     auth.addAudit(team,'PACK_STATION_QR_ROTATED',adminName(user),{stationId:station.id,stationName:station.name});
    }else if(action==='toggle'){
     station.active=payload.active!==false;station.updatedAt=now;
     auth.addAudit(team,'PACK_STATION_STATUS_CHANGED',adminName(user),{stationId:station.id,stationName:station.name,active:station.active});
    }else throw auth.error('INVALID_ACTION','Unbekannte Pack-QR-Aktion.',400);
   }
   return{station:publicStation(station),rawStation:station};
  });
  const station=result.result.station,raw=result.result.rawStation,response={ok:true,station,environment};
  if(action==='create'||action==='rotate')Object.assign(response,await qrPayload(req,environment,raw));
  context.res=json(200,response);
 }catch(e){context.log&&context.log.error&&context.log.error('pack-stations-admin',e&&e.code,e&&e.message);context.res=json(e.status||e.statusCode||500,{ok:false,code:e.code||'SERVER_ERROR',message:e.message||'Pack-QR-Code konnte nicht verwaltet werden.'});}
};

module.exports.stationToken=stationToken;
module.exports.publicStation=publicStation;
module.exports.ensureSharedStation=ensureSharedStation;
