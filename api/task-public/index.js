'use strict';

const crypto=require('crypto');
const {createBlobServiceClient}=require('../shared/blob-rest');

const TEAM_CONTAINER=process.env.EXPORTHUB_STORAGE_CONTAINER||process.env.EXPORTHUB_CONTAINER||'exporthub-data';
const TEAM_BLOB=process.env.EXPORTHUB_STORAGE_BLOB||process.env.EXPORTHUB_STATE_BLOB||'team-state.json';
const TEST_TEAM_BLOB=process.env.EXPORTHUB_TEST_STORAGE_BLOB||('testservice/'+String(TEAM_BLOB).replace(/^\/+/,''));
const ALLOWED_FIELDS=new Set(['description','status','plannedAt','dueAt','latestCompletionAt','checklist','customerName']);

function text(v){return String(v==null?'':v).trim()}
function lower(v){return text(v).toLowerCase()}
function connectionString(){return process.env.EXPORTHUB_STORAGE_CONNECTION_STRING||process.env.EXPORTHUB_STORAGE_CONNECTION||process.env.EXPORTHUB_AZURE_STORAGE_CONNECTION_STRING||''}
function headers(extra={}){return Object.assign({'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow, noarchive'},extra)}
function json(status,value,extra){return{status,headers:headers(extra),body:JSON.stringify(value)}}
function requestEvidence(req){const h=req&&req.headers||{};return text(h['x-forwarded-host']||h['X-Forwarded-Host']||h['x-original-host']||h['X-Original-Host']||h.host||h.Host||'')}
function environmentFromRequest(req){return /-testservice\./i.test(lower(requestEvidence(req)))?'testservice':'production'}
function blobForEnvironment(env){return env==='testservice'?TEST_TEAM_BLOB:TEAM_BLOB}
function validToken(token){return /^[a-f0-9]{64}$/i.test(text(token))}
function tokenHash(token){return crypto.createHash('sha256').update(text(token)).digest('hex')}
function safeEqual(a,b){try{const aa=Buffer.from(text(a).toLowerCase(),'utf8'),bb=Buffer.from(text(b).toLowerCase(),'utf8');return aa.length===bb.length&&aa.length===64&&crypto.timingSafeEqual(aa,bb)}catch(_){return false}}
async function streamText(stream){const chunks=[];for await(const chunk of stream||[])chunks.push(Buffer.from(chunk));return Buffer.concat(chunks).toString('utf8')}
async function readTeamState(env){
  const cs=connectionString();if(!cs)throw Object.assign(new Error('storage unavailable'),{statusCode:503});
  const client=createBlobServiceClient(cs).getContainerClient(TEAM_CONTAINER).getBlockBlobClient(blobForEnvironment(env));
  const download=await client.download(0),raw=await streamText(download.readableStreamBody),parsed=raw?JSON.parse(raw):{};
  const state=parsed&&parsed.state&&typeof parsed.state==='object'?parsed.state:parsed;
  return state&&typeof state==='object'?state:{};
}
function allowedFields(link){const out=[];for(const raw of Array.isArray(link&&link.fields)?link.fields:[]){const field=text(raw);if(ALLOWED_FIELDS.has(field)&&!out.includes(field))out.push(field)}return out}
function publicView(task,link){
  const fields=new Set(allowedFields(link)),out={title:text(task&&task.title)};
  for(const field of ['description','status','plannedAt','dueAt','latestCompletionAt','customerName'])if(fields.has(field)&&text(task&&task[field]))out[field]=task[field];
  if(fields.has('checklist'))out.checklist=(Array.isArray(task&&task.checklist)?task.checklist:[]).filter(item=>item&&(item.public===true||item.isPublic===true)).map(item=>({text:text(item.text||item.label),done:item.done===true}));
  return out;
}
function resolveTask(tasks,hash,env){
  const matches=[];
  for(const task of Array.isArray(tasks)?tasks:[]){
    const link=task&&task.publicLink;if(!link||!safeEqual(link.tokenHash,hash))continue;
    const linkEnv=lower(link.environment);if(linkEnv&&linkEnv!==env)continue;
    matches.push({task,link});
  }
  return matches.length===1?matches[0]:null;
}
async function handle(req){
  const method=upper(req&&req.method||'GET');
  if(method==='OPTIONS')return{status:204,headers:headers({'Allow':'GET, OPTIONS'}),body:''};
  if(method!=='GET')return json(405,{error:'METHOD_NOT_ALLOWED'},{'Allow':'GET, OPTIONS'});
  const token=text(req&&req.query&&req.query.token);if(!validToken(token))return json(404,{error:'TASK_PUBLIC_NOT_FOUND'});
  const env=environmentFromRequest(req),state=await readTeamState(env),found=resolveTask(state.tasks,tokenHash(token),env);
  if(!found)return json(404,{error:'TASK_PUBLIC_NOT_FOUND'});
  if(text(found.link.revokedAt))return json(410,{error:'TASK_PUBLIC_REVOKED'});
  return json(200,publicView(found.task,found.link));
}
function upper(v){return text(v).toUpperCase()}

module.exports=async function(context,req){
  let response;
  try{response=await handle(req||{})}catch(error){const status=Number(error&&error.statusCode||error&&error.status||0);response=json(status===404?404:503,{error:status===404?'TASK_PUBLIC_NOT_FOUND':'TASK_PUBLIC_UNAVAILABLE'})}
  if(context)context.res=response;
  return response;
};
