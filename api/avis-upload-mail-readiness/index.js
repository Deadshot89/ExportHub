'use strict';

const crypto=require('crypto');
const https=require('https');
const graphMail=require('../shared/graph-mail');

const REPO='Deadshot89/ExportHub';
const WORKFLOW='azure-static-web-apps-wonderful-forest-0f315e310.yml';
const OIDC_ISSUER='https://token.actions.githubusercontent.com';
const OIDC_JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';
const OIDC_AUDIENCE='exporthub-avis-upload-mail-readiness';
const ALLOWED_EVENTS=['push','workflow_dispatch'];
const DEFAULT_RECIPIENT='DespatchNettetal@essentra.onmicrosoft.com';
let oidcCache={expiresAt:0,keys:[]};

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function json(status,value){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(value)}}
function header(req,name){const h=req&&req.headers||{};return h[name.toLowerCase()]||h[name]||''}
function error(code,message,status=400){const e=new Error(message||code);e.code=code;e.status=status;return e}
function validEmail(v){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(v))}
function environmentOf(req){
 const requested=lower(header(req,'x-exporthub-environment'));
 const host=lower(header(req,'x-forwarded-host')||header(req,'x-original-host')||header(req,'host'));
 const hostTest=/-testservice\./.test(host);
 const hostAzure=/\.azurestaticapps\.net(?:[:/]|$)/.test(host);
 const hostProd=hostAzure&&!hostTest;
 if(!['production','testservice'].includes(requested))throw error('ENVIRONMENT_REQUIRED','Umgebung fehlt.',400);
 if(hostTest&&requested!=='testservice')throw error('ENVIRONMENT_MISMATCH','TESTSERVICE darf keine Produktionsbereitschaft bestätigen.',409);
 if(hostProd&&requested!=='production')throw error('ENVIRONMENT_MISMATCH','Produktion darf keine TESTSERVICE-Bereitschaft bestätigen.',409);
 return requested
}
function httpsJson(url){
 return new Promise((resolve,reject)=>{
  const request=https.request(url,{method:'GET',headers:{Accept:'application/json','User-Agent':'ExportHUB-RC1249'}},response=>{
   const chunks=[];response.on('data',chunk=>chunks.push(Buffer.from(chunk)));response.on('end',()=>{
    const raw=Buffer.concat(chunks).toString('utf8');
    if(response.statusCode>=200&&response.statusCode<300){try{return resolve(JSON.parse(raw||'{}'))}catch(e){return reject(e)}}
    reject(error('OIDC_JWKS_FAILED','GitHub OIDC-Schlüssel konnten nicht geladen werden.',502))
   })
  });
  request.on('error',reject);request.end()
 })
}
async function githubOidcAuthorized(req){
 const token=text(header(req,'x-exporthub-github-oidc'));if(!token)return false;
 try{
  const parts=token.split('.');if(parts.length!==3)return false;
  const jose=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(jose.alg!=='RS256'||!text(jose.kid))return false;
  const nowSec=Math.floor(Date.now()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.iss!==OIDC_ISSUER||!aud.includes(OIDC_AUDIENCE))return false;
  if(claims.repository!==REPO||claims.ref!=='refs/heads/main'||!ALLOWED_EVENTS.includes(text(claims.event_name)))return false;
  if(claims.workflow_ref!==REPO+'/.github/workflows/'+WORKFLOW+'@refs/heads/main')return false;
  if(!Number(claims.exp)||Number(claims.exp)<=nowSec-30)return false;
  if(Number(claims.nbf||0)>nowSec+60||Number(claims.iat||0)>nowSec+60||Number(claims.iat||0)<nowSec-1800)return false;
  if(!oidcCache.keys.length||oidcCache.expiresAt<Date.now()){
   const jwks=await httpsJson(OIDC_JWKS_URL);oidcCache={expiresAt:Date.now()+10*60*1000,keys:Array.isArray(jwks.keys)?jwks.keys:[]}
  }
  const jwk=oidcCache.keys.find(k=>k&&k.kid===jose.kid&&k.kty==='RSA');if(!jwk)return false;
  const key=crypto.createPublicKey({key:jwk,format:'jwk'});
  return crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url'))
 }catch(_){return false}
}

module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:''};return}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
 try{
  if(!await githubOidcAuthorized(req))throw error('WORKFLOW_REQUIRED','Readiness darf nur durch den signierten ExportHUB-Releaseworkflow geprüft werden.',403);
  const environment=environmentOf(req),cfg=graphMail.readiness(),recipient=text(process.env.EXPORTHUB_AVIS_UPLOAD_NOTIFICATION_TO)||DEFAULT_RECIPIENT;
  if(!cfg.configured||!validEmail(recipient)){
   context.res=json(503,{ok:false,configured:false,authenticated:false,environment,recipientConfigured:validEmail(recipient),missing:Array.isArray(cfg.missing)?cfg.missing:[],code:!cfg.configured?'GRAPH_MAIL_NOT_CONFIGURED':'MAIL_RECIPIENT_INVALID',version:'RC1270'});return
  }
  const authProbe=await graphMail.verifyAuthentication();
  if(!authProbe.authenticated){
   context.res=json(503,{ok:false,configured:true,authenticated:false,environment,recipientConfigured:true,code:authProbe.code||'GRAPH_AUTH_FAILED',upstreamStatus:Number(authProbe.upstreamStatus||0),version:'RC1270'});return
  }
  context.res=json(200,{ok:true,configured:true,authenticated:true,audienceOk:authProbe.audienceOk===true,environment,recipient,version:'RC1270'})
 }catch(e){
  context.res=json(Number(e&&e.status||e&&e.statusCode||500),{ok:false,configured:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||'AVIS-Mail-Readiness fehlgeschlagen.',version:'RC1249'})
 }
};
