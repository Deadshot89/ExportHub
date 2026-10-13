'use strict';

const crypto=require('crypto');
const https=require('https');
const {createBlobServiceClient}=require('../shared/blob-rest');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const TEST_TEAM_BLOB=process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+String(TEAM_BLOB).replace(/^\/+/,''));
const REPO='Deadshot89/ExportHub';
const REF='refs/heads/taskplannerpro/v2-task10';
const WORKFLOW='taskplanner-v2-rehearsal.yml';
const ISSUER='https://token.actions.githubusercontent.com';
const JWKS_URL='https://token.actions.githubusercontent.com/.well-known/jwks';
const AUDIENCE='exporthub-taskplanner-v2-rehearsal';
let cache={expiresAt:0,keys:[]};

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function header(req,name){const h=req&&req.headers||{};return h[name.toLowerCase()]||h[name]||''}
function body(req){if(req&&req.body&&typeof req.body==='object')return req.body;try{return JSON.parse(req&&req.body||'{}')}catch(_){return{}}}
function json(status,value){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive'},body:JSON.stringify(value)}}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||process.env.AzureWebJobsStorage||''}
function requestEnvironmentEvidence(req){
 const h=req&&req.headers||{};
 return [h.origin,h.Origin,h.referer,h.Referer,h['x-forwarded-host'],h['X-Forwarded-Host'],h['x-original-host'],h['X-Original-Host'],h['x-ms-original-url'],h['X-MS-Original-URL'],h.host,h.Host].map(text).filter(Boolean).join(' ');
}
function httpsJson(url){return new Promise((resolve,reject)=>{const request=https.request(url,{method:'GET',headers:{Accept:'application/json','User-Agent':'ExportHUB-TaskPlanner-V2-Rehearsal'}},res=>{const chunks=[];res.on('data',c=>chunks.push(Buffer.from(c)));res.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');if(res.statusCode>=200&&res.statusCode<300){try{return resolve(JSON.parse(raw||'{}'))}catch(e){return reject(e)}}reject(new Error('OIDC_JWKS_FAILED'))})});request.on('error',reject);request.end()})}
async function authorized(req){
 const token=text(header(req,'x-exporthub-github-oidc'));if(!token)return false;
 try{
  const parts=token.split('.');if(parts.length!==3)return false;
  const jose=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
  const claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  const at=Math.floor(Date.now()/1000),aud=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  if(jose.alg!=='RS256'||!text(jose.kid)||claims.iss!==ISSUER||!aud.includes(AUDIENCE))return false;
  if(claims.repository!==REPO||claims.ref!==REF||text(claims.event_name)!=='push')return false;
  if(text(claims.workflow_ref)!==REPO+'/.github/workflows/'+WORKFLOW+'@'+REF)return false;
  if(!Number(claims.exp)||Number(claims.exp)<=at-30||Number(claims.nbf||0)>at+60||Number(claims.iat||0)>at+60||Number(claims.iat||0)<at-1800)return false;
  if(!cache.keys.length||cache.expiresAt<Date.now()){const jwks=await httpsJson(JWKS_URL);cache={expiresAt:Date.now()+10*60*1000,keys:Array.isArray(jwks.keys)?jwks.keys:[]}}
  const jwk=cache.keys.find(k=>k&&k.kid===jose.kid&&k.kty==='RSA');if(!jwk)return false;
  const key=crypto.createPublicKey({key:jwk,format:'jwk'});
  return crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url'));
 }catch(_){return false}
}
function requireTestservice(req,payload){
 const requested=lower(payload&&payload.environment||header(req,'x-exporthub-environment'));
 const evidence=lower(requestEnvironmentEvidence(req));
 if(requested!=='testservice'||!/-testservice\./.test(evidence))throw Object.assign(new Error('TESTSERVICE_ONLY'),{status:403});
}
async function readTeam(){
 const cs=connectionString();if(!cs)throw Object.assign(new Error('STORAGE_NOT_CONFIGURED'),{status:503});
 const blob=createBlobServiceClient(cs).getContainerClient(TEAM_CONTAINER).getBlockBlobClient(TEST_TEAM_BLOB);
 const response=await blob.download(0),chunks=[];for await(const chunk of response.readableStreamBody)chunks.push(Buffer.from(chunk));
 const raw=Buffer.concat(chunks),parsed=raw.length?JSON.parse(raw.toString('utf8')):{};
 return{team:parsed&&typeof parsed==='object'?parsed:{},bytes:raw.length,etag:response.etag||null};
}
function clone(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v))}
function taskStateOf(team){
 const root=team&&team.state&&typeof team.state==='object'&&!Array.isArray(team.state)?team.state:{};
 return{
  tasks:Array.isArray(root.tasks)?clone(root.tasks):[],
  taskSeries:Array.isArray(root.taskSeries)?clone(root.taskSeries):[],
  taskTemplates:Array.isArray(root.taskTemplates)?clone(root.taskTemplates):[],
  taskCalendar:root.taskCalendar&&typeof root.taskCalendar==='object'?clone(root.taskCalendar):{closures:[]},
  taskSettings:root.taskSettings&&typeof root.taskSettings==='object'?clone(root.taskSettings):{},
  taskArchive:Array.isArray(root.taskArchive)?clone(root.taskArchive):[],
  taskMigrationMeta:root.taskMigrationMeta&&typeof root.taskMigrationMeta==='object'?clone(root.taskMigrationMeta):{}
 };
}

module.exports=async function(context,req){
 try{
  if(req&&req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return}
  if(!req||req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return}
  const payload=body(req);requireTestservice(req,payload);
  if(text(payload.action)!=='snapshot'){context.res=json(400,{ok:false,code:'ACTION_INVALID'});return}
  if(!await authorized(req)){context.res=json(403,{ok:false,code:'WORKFLOW_REQUIRED'});return}
  const current=await readTeam(),state=taskStateOf(current.team),raw=JSON.stringify(state),sha256=crypto.createHash('sha256').update(raw).digest('hex');
  context.res=json(200,{ok:true,rehearsalSnapshot:true,environment:'testservice',revision:Number(current.team&&current.team.revision||0),updatedAt:current.team&&current.team.updatedAt||null,teamBytes:current.bytes,snapshotBytes:Buffer.byteLength(raw),snapshotSha256:sha256,taskCount:state.tasks.length,seriesCount:state.taskSeries.length,state});
 }catch(error){context.res=json(Number(error&&error.status||0)||500,{ok:false,code:text(error&&error.message)||'REHEARSAL_SNAPSHOT_FAILED'})}
};
