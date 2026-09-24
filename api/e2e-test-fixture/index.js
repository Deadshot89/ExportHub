'use strict';

const crypto=require('crypto');
const https=require('https');
const {createBlobServiceClient}=require('../shared/blob-rest');
const auth=require('../shared/auth-store');
const {MODULES,normalizeUser,publicUser}=require('../shared/user-policy');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const TEST_TEAM_BLOB=process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+String(TEAM_BLOB).replace(/^\/+/,'')); 
const REPO='Deadshot89/ExportHub';
const WORKFLOW='azure-static-web-apps-wonderful-forest-0f315e310.yml';
const OIDC_ISSUER='https://token.actions.githubusercontent.com';
const OIDC_JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';
const OIDC_AUDIENCE='exporthub-e2e-fixture';
const MAX_RETRIES=5;
const E2E_SESSION_TTL_MS=45*60*1000;
let oidcCache={expiresAt:0,keys:[]};

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function now(){return new Date().toISOString()}
function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v))}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function header(req,name){const h=req&&req.headers||{};return h[name.toLowerCase()]||h[name]||''}
function json(status,value){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},body:JSON.stringify(value)}}
function error(code,message,status=400){const e=new Error(message);e.code=code;e.status=status;return e}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function safeRunId(v){
 const raw=text(v);
 if(!/^E2E-[A-Za-z0-9._-]{3,100}$/.test(raw))throw error('RUN_ID_INVALID','Ungültige E2E-Run-ID.',400);
 return raw;
}
function requireTestservice(req,payload){
 const headerEnvironment=lower(header(req,'x-exporthub-environment'));
 const payloadEnvironment=lower(payload&&payload.environment);
 if(headerEnvironment!=='testservice'||payloadEnvironment!=='testservice')throw error('TESTSERVICE_ONLY','RC1139 darf ausschließlich gegen die ExportHUB-Testservice-Datenumgebung ausgeführt werden.',403);
 return 'testservice';
}
function service(){
 const cs=connectionString();if(!cs)throw error('STORAGE_NOT_CONFIGURED','Azure-Speicher ist nicht konfiguriert.',503);
 return createBlobServiceClient(cs);
}
async function readJson(blob){
 const r=await blob.download(0),chunks=[];for await(const c of r.readableStreamBody)chunks.push(Buffer.from(c));
 const raw=Buffer.concat(chunks);let value;
 try{value=JSON.parse(raw.toString('utf8'))}catch(_){throw error('STATE_JSON_INVALID','TESTSERVICE-Team-State ist nicht lesbar.',500)}
 return{value,etag:r.etag||null,bytes:raw.length};
}
async function uploadJson(blob,value,etag){
 const raw=JSON.stringify(value),bytes=Buffer.byteLength(raw);
 const result=await blob.upload(raw,bytes,{blobHTTPHeaders:{blobContentType:'application/json; charset=utf-8'},conditions:etag?{ifMatch:etag}:{ifNoneMatch:'*'},metadata:{schema:String(value.schemaVersion||3),revision:String(value.revision||0),clientversion:'RC1139-e2e-fixture',updatedepoch:String(Date.parse(value.updatedAt||'')||Date.now())}});
 return{etag:result&&result.etag||null,bytes};
}
function httpsJson(url){
 return new Promise((resolve,reject)=>{
  const req=https.request(url,{method:'GET',headers:{Accept:'application/json','User-Agent':'ExportHUB-RC1139'}},res=>{
   const chunks=[];res.on('data',c=>chunks.push(Buffer.from(c)));res.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');if(res.statusCode>=200&&res.statusCode<300){try{return resolve(JSON.parse(raw||'{}'))}catch(e){return reject(e)}}reject(error('OIDC_JWKS_FAILED','GitHub OIDC-Schlüssel konnten nicht geladen werden.',502))});
  });
  req.on('error',reject);req.end();
 });
}
async function githubOidcAuthorized(req){
 const token=text(header(req,'x-exporthub-github-oidc'));if(!token)return false;
 try{
  const parts=token.split('.');if(parts.length!==3)return false;
  const jose=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(jose.alg!=='RS256'||!text(jose.kid))return false;
  const at=Math.floor(Date.now()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(claims.iss!==OIDC_ISSUER||!aud.includes(OIDC_AUDIENCE))return false;
  if(claims.repository!==REPO||claims.ref!=='refs/heads/main')return false;
  if(!['push','workflow_dispatch'].includes(text(claims.event_name)))return false;
  if(claims.workflow_ref!==REPO+'/.github/workflows/'+WORKFLOW+'@refs/heads/main')return false;
  if(!Number(claims.exp)||Number(claims.exp)<=at-30)return false;
  if(Number(claims.nbf||0)>at+60||Number(claims.iat||0)>at+60||Number(claims.iat||0)<at-1800)return false;
  if(!oidcCache.keys.length||oidcCache.expiresAt<Date.now()){
   const jwks=await httpsJson(OIDC_JWKS_URL);oidcCache={expiresAt:Date.now()+10*60*1000,keys:Array.isArray(jwks.keys)?jwks.keys:[]};
  }
  const jwk=oidcCache.keys.find(k=>k&&k.kid===jose.kid&&k.kty==='RSA');if(!jwk)return false;
  const key=crypto.createPublicKey({key:jwk,format:'jwk'});
  return crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url'));
 }catch(_){return false}
}
function e2eRights(){
 const allowed=new Set(['start','dashboard','shipment','shipmentoverview','shipmentview','documents','tasks','notifications','pickupcalendar','customerfolder','warehouse','pallet','shippingcosts','customs','sop','academy','exams','history']);
 const rights={};
 for(const id of MODULES){
  const edit=allowed.has(id);
  rights[id]={level:edit?'edit':'none',visible:edit,read:edit,edit,admin:false,functionAdmin:false};
 }
 return rights;
}
function e2eReminderRecipient(){
 const sender=text(process.env.EXPORTHUB_MAIL_SENDER||process.env.EXPORTHUB_POD_DRIVE_USER);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender))throw error('E2E_MAIL_SENDER_NOT_CONFIGURED','Für den RC1255 AVIS-Erinnerungs-E2E ist kein gültiger ExportHUB-Mail-Absender konfiguriert.',503);
 return sender;
}
function e2eCustomer(runId){
 const suffix=crypto.createHash('sha256').update(runId).digest('hex').slice(0,8).toUpperCase();
 const id='E2E-CUSTOMER-'+suffix,locationId='E2E-LOC-'+suffix,reminderRecipient=e2eReminderRecipient();
 return{
  id,
  account:'E2E'+suffix.slice(0,5),
  customerNumber:'E2E'+suffix.slice(0,5),
  customerNo:'E2E'+suffix.slice(0,5),
  name:'E2E TEST CUSTOMER '+suffix,
  customerName:'E2E TEST CUSTOMER '+suffix,
  customerEmail:reminderRecipient,
  email:reminderRecipient,
  contactDirectory:[{name:'ExportHUB E2E Reminder Mailbox',email:reminderRecipient,role:'avis',_e2eRunId:runId}],
  country:'DE',
  active:true,
  locations:[{
   id:locationId,
   locationId,
   name:'E2E Test Standort '+suffix,
   street:'E2E Teststraße 1',
   zip:'00000',
   postalCode:'00000',
   city:'Teststadt',
   country:'DE',
   address:'E2E Teststraße 1\n00000 Teststadt\nDeutschland',
   _e2eRunId:runId
  }],
  _e2eRunId:runId,
  createdAt:now(),
  updatedAt:now()
 };
}
function e2eNonAdminRights(){
 const allowed=new Set(['start','dashboard','rights','pickupcalendar']);
 const rights={};
 for(const id of MODULES){
  const view=allowed.has(id);
  rights[id]={level:view?'view':'none',visible:view,read:view,edit:false,admin:false,functionAdmin:false};
 }
 return rights;
}
function e2eNonAdminUser(runId){
 const suffix=runId.replace(/[^A-Za-z0-9_-]/g,'-').slice(-70);
 return normalizeUser({
  id:'E2E-USER-NONADMIN-'+suffix,
  user:'e2e.nonadmin.'+suffix.toLowerCase(),
  login:'e2e.nonadmin.'+suffix.toLowerCase(),
  username:'e2e.nonadmin.'+suffix.toLowerCase(),
  name:'E2E TEST Nicht-Admin '+suffix,
  role:'Benutzer',
  globalAdmin:false,
  isGlobalAdmin:false,
  permissions:[],
  rights:e2eNonAdminRights(),
  active:true,
  disabled:false,
  mustChange:false,
  authVersion:0,
  _e2eRunId:runId,
  createdAt:now(),
  updatedAt:now()
 },1);
}
function e2eUser(runId){
 const suffix=runId.replace(/[^A-Za-z0-9_-]/g,'-').slice(-80);
 return normalizeUser({
  id:'E2E-USER-'+suffix,
  user:'e2e.'+suffix.toLowerCase(),
  login:'e2e.'+suffix.toLowerCase(),
  username:'e2e.'+suffix.toLowerCase(),
  name:'E2E TEST Browser '+suffix,
  role:'Globaler Administrator',
  globalAdmin:true,
  isGlobalAdmin:true,
  permissions:['*'],
  rights:e2eRights(),
  active:true,
  disabled:false,
  mustChange:false,
  authVersion:0,
  _e2eRunId:runId,
  createdAt:now(),
  updatedAt:now()
 },0);
}
function e2eMarked(item){
 return !!(item&&typeof item==='object'&&/^E2E-[A-Za-z0-9._-]{3,100}$/.test(text(item._e2eRunId)));
}
function removeStaleE2ERecords(state){
 const out=state&&typeof state==='object'&&!Array.isArray(state)?clone(state):{};
 let removed=0;
 for(const [key,value] of Object.entries(out)){
  if(!Array.isArray(value))continue;
  const next=value.filter(item=>{
   const match=e2eMarked(item);
   if(match)removed++;
   return !match;
  });
  out[key]=next;
 }
 return{state:out,removed};
}
function removeRunRecords(state,runId){
 const out=state&&typeof state==='object'&&!Array.isArray(state)?clone(state):{};
 let removed=0;
 for(const [key,value] of Object.entries(out)){
  if(!Array.isArray(value))continue;
  const next=value.filter(item=>{
   const match=item&&typeof item==='object'&&text(item._e2eRunId)===runId;
   if(match)removed++;
   return !match;
  });
  out[key]=next;
 }
 return{state:out,removed};
}
async function mutateTestTeam(mutator){
 const container=service().getContainerClient(TEAM_CONTAINER),blob=container.getBlockBlobClient(TEST_TEAM_BLOB);
 for(let attempt=0;attempt<MAX_RETRIES;attempt++){
  const current=await readJson(blob),team=current.value&&typeof current.value==='object'?current.value:{schemaVersion:3,revision:0,state:{},users:[]};
  const result=await mutator(clone(team));
  if(result.changed===false)return{team,result:result.value,bytes:current.bytes};
  const next=result.team;
  next.schemaVersion=Math.max(3,Number(next.schemaVersion||3));
  next.revision=Number(team.revision||0)+1;
  next.updatedAt=now();
  next.updatedBy='RC1139 GitHub E2E';
  next.clientVersion='RC1139-e2e-fixture';
  try{const uploaded=await uploadJson(blob,next,current.etag);return{team:next,result:result.value,bytes:uploaded.bytes}}
  catch(e){if(e&&(e.statusCode===409||e.statusCode===412)&&attempt<MAX_RETRIES-1)continue;if(e&&(e.statusCode===409||e.statusCode===412))throw error('CONCURRENT_UPDATE','TESTSERVICE wurde parallel geändert; RC1139 hat sicher abgebrochen.',409);throw e}
 }
 throw error('CONCURRENT_UPDATE','TESTSERVICE konnte nach mehreren Konfliktversuchen nicht aktualisiert werden.',409);
}
function signedSessionFor(user,runId,label){
 const createdAt=now(),session={
  id:'E2E-SESSION-'+label+'-'+crypto.createHash('sha256').update(runId+'|'+label).digest('hex').slice(0,20),
  userId:user.id,
  username:user.user,
  environment:'testservice',
  deviceId:'e2e-playwright',
  createdAt,
  expiresAt:new Date(Date.now()+E2E_SESSION_TTL_MS).toISOString(),
  authVersion:Number(user.authVersion||0),
  mustChange:false
 };
 return{token:auth.createSignedSessionToken(session),expiresAt:session.expiresAt};
}
async function prepare(runId){
 const mutation=await mutateTestTeam(async team=>{
  team.state=team.state&&typeof team.state==='object'?team.state:{};
  team.users=Array.isArray(team.users)?team.users:[];
  const staleState=removeStaleE2ERecords(team.state);
  team.state=staleState.state;
  const beforeUsers=team.users.length;
  team.users=team.users.filter(u=>!e2eMarked(u));
  const purgedStaleUsers=beforeUsers-team.users.length;
  const user=e2eUser(runId),nonAdminUser=e2eNonAdminUser(runId),customer=e2eCustomer(runId);
  const ids=new Set([user.id,nonAdminUser.id]);
  const cleaned=team.users.filter(u=>!ids.has(text(u&&u.id)));
  cleaned.push(user,nonAdminUser);team.users=cleaned;
  team.state.users=cleaned.map(u=>publicUser(u,false));
  team.state.customers=Array.isArray(team.state.customers)?team.state.customers.filter(x=>text(x&&x.id)!==customer.id):[];
  team.state.customers.push(customer);
  return{team,value:{user,nonAdminUser,customer,purgedStaleRecords:staleState.removed,purgedStaleUsers},changed:true};
 });
 const user=mutation.result.user,nonAdminUser=mutation.result.nonAdminUser,customer=mutation.result.customer;
 const adminSession=signedSessionFor(user,runId,'ADMIN'),nonAdminSession=signedSessionFor(nonAdminUser,runId,'NONADMIN');
 return{ok:true,action:'prepare',environment:'testservice',runId,token:adminSession.token,user:publicUser(user,false),expiresAt:adminSession.expiresAt,nonAdminToken:nonAdminSession.token,nonAdminUser:publicUser(nonAdminUser,false),nonAdminExpiresAt:nonAdminSession.expiresAt,customer:{id:customer.id,account:customer.account,name:customer.name,locationId:customer.locations[0].id,locationName:customer.locations[0].name},purgedStaleRecords:mutation.result.purgedStaleRecords,purgedStaleUsers:mutation.result.purgedStaleUsers,teamBytes:mutation.bytes};
}
async function cleanup(runId){
 const mutation=await mutateTestTeam(async team=>{
  team.state=team.state&&typeof team.state==='object'?team.state:{};
  team.users=Array.isArray(team.users)?team.users:[];
  const beforeUsers=team.users.length;
  team.users=team.users.filter(u=>text(u&&u._e2eRunId)!==runId);
  const cleaned=removeRunRecords(team.state,runId);team.state=cleaned.state;
  team.state.users=team.users.map(u=>publicUser(u,false));
  const removedUsers=beforeUsers-team.users.length,removed=removedUsers+cleaned.removed;
  return{team,value:{removed,removedUsers,removedRecords:cleaned.removed},changed:removed>0};
 });
 return{ok:true,action:'cleanup',environment:'testservice',runId,...mutation.result,teamBytes:mutation.bytes};
}

module.exports=async function(context,req){
 try{
  if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
  const payload=body(req);requireTestservice(req,payload);
  if(!await githubOidcAuthorized(req))throw error('E2E_FIXTURE_FORBIDDEN','RC1139 Fixture darf nur vom signierten GitHub-Releaseworkflow aufgerufen werden.',403);
  const action=lower(payload.action),runId=safeRunId(payload.runId);
  if(action==='prepare'){context.res=json(200,await prepare(runId));return}
  if(action==='cleanup'){context.res=json(200,await cleanup(runId));return}
  throw error('ACTION_INVALID','Erlaubt sind prepare und cleanup.',400);
 }catch(e){
  try{context.log&&context.log.error&&context.log.error('RC1139 E2E fixture error',e&&e.code,e&&e.message)}catch(_){}
  context.res=json(Number(e&&e.status||e&&e.statusCode||500),{ok:false,code:e&&e.code||'SERVER_ERROR',message:e&&e.message||'RC1139 Fixture fehlgeschlagen.'});
 }
};
