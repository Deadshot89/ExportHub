'use strict';
const https=require('https');
const MAIL_SEND_PERMISSION=Object.freeze({resource:'Microsoft Graph',type:'Application',name:'Mail.Send',id:'b633e1c5-b582-4048-a93e-9f11b44c7e96',adminConsentRequired:true});

function text(v){return String(v==null?'':v).trim()}
function readiness(){
 const tenantId=text(process.env.EXPORTHUB_GRAPH_TENANT_ID);
 const clientId=text(process.env.EXPORTHUB_GRAPH_CLIENT_ID);
 const clientSecret=text(process.env.EXPORTHUB_GRAPH_CLIENT_SECRET);
 const sender=text(process.env.EXPORTHUB_MAIL_SENDER||process.env.EXPORTHUB_POD_DRIVE_USER);
 const missing=[];
 if(!tenantId)missing.push('EXPORTHUB_GRAPH_TENANT_ID');
 if(!clientId)missing.push('EXPORTHUB_GRAPH_CLIENT_ID');
 if(!clientSecret)missing.push('EXPORTHUB_GRAPH_CLIENT_SECRET');
 if(!sender)missing.push('EXPORTHUB_MAIL_SENDER');
 return{configured:missing.length===0,missing,sender,tenantId,clientId,clientSecret}
}
function error(code,message,statusCode){const e=new Error(message);e.code=code;e.statusCode=statusCode||500;return e}
function request(method,url,headers,body,timeoutMs){
 return new Promise((resolve,reject)=>{
  const target=new URL(url),req=https.request({protocol:target.protocol,hostname:target.hostname,port:target.port||443,path:target.pathname+target.search,method,headers:headers||{},timeout:timeoutMs||12000},res=>{
   const chunks=[];res.on('data',c=>chunks.push(Buffer.from(c)));res.on('end',()=>{
    const raw=Buffer.concat(chunks).toString('utf8');let parsed=null;try{parsed=raw?JSON.parse(raw):null}catch(_){}
    if(res.statusCode>=200&&res.statusCode<300)return resolve({status:res.statusCode,headers:res.headers||{},body:parsed});
    const msg=parsed&&parsed.error&&parsed.error.message||parsed&&parsed.message||raw||('HTTP '+res.statusCode);
    const e=error(parsed&&parsed.error&&parsed.error.code||'GRAPH_MAIL_FAILED',msg,res.statusCode);e.responseHeaders=res.headers||{};reject(e)
   })
  });
  req.on('timeout',()=>req.destroy(error('GRAPH_TIMEOUT','Microsoft Graph Zeitüberschreitung.',504)));
  req.on('error',e=>{if(!e.statusCode)e.statusCode=502;if(!e.code)e.code='GRAPH_NETWORK_ERROR';reject(e)});
  if(body)req.write(body);req.end()
 })
}
let tokenCache=null;
function tokenClaims(token){try{const parts=String(token||'').split('.');if(parts.length<2)return{};return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))||{}}catch(_){return{}}}
function mailSendGranted(claims){return Array.isArray(claims&&claims.roles)&&claims.roles.some(r=>text(r).toLowerCase()==='mail.send')}
function permissionRequirement(){return{...MAIL_SEND_PERMISSION}}
async function accessToken(force){
 const cfg=readiness();if(!cfg.configured)throw error('GRAPH_MAIL_NOT_CONFIGURED','Microsoft Graph Mailversand ist noch nicht vollständig konfiguriert.',503);
 if(!force&&tokenCache&&tokenCache.expiresAt>Date.now()+60000)return tokenCache.token;
 const form=new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,scope:'https://graph.microsoft.com/.default',grant_type:'client_credentials'}).toString();
 const r=await request('POST','https://login.microsoftonline.com/'+encodeURIComponent(cfg.tenantId)+'/oauth2/v2.0/token',{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(form),Accept:'application/json'},Buffer.from(form),8000);
 const token=text(r.body&&r.body.access_token);if(!token)throw error('GRAPH_TOKEN_MISSING','Microsoft Graph hat kein Zugriffstoken geliefert.',502);
 tokenCache={token,expiresAt:Date.now()+Math.max(300,Number(r.body&&r.body.expires_in||3600))*1000};return token
}
async function verifyAuthentication(){
 const cfg=readiness();
 if(!cfg.configured)return{configured:false,authenticated:false,code:'GRAPH_MAIL_NOT_CONFIGURED',upstreamStatus:0};
 try{
  const token=await accessToken(true);
  const claims=tokenClaims(token),aud=text(claims.aud),exp=Number(claims.exp||0),nowSec=Math.floor(Date.now()/1000);
  return{configured:true,authenticated:!!token,audienceOk:aud==='https://graph.microsoft.com'||aud==='00000003-0000-0000-c000-000000000000',mailSendGranted:mailSendGranted(claims),expiresInSec:exp>nowSec?exp-nowSec:0,code:'OK',upstreamStatus:200}
 }catch(e){
  tokenCache=null;
  return{configured:true,authenticated:false,audienceOk:false,mailSendGranted:false,expiresInSec:0,code:'GRAPH_AUTH_FAILED',upstreamStatus:Number(e&&e.statusCode||0)||0}
 }
}
function transient(e){return[408,429,500,502,503,504].includes(Number(e&&e.statusCode||0))||['GRAPH_TIMEOUT','GRAPH_NETWORK_ERROR','ECONNRESET','ETIMEDOUT'].includes(e&&e.code)}
function delay(e,n){const h=e&&e.responseHeaders||{},ra=Number(h['retry-after']||0);return ra>0?Math.min(5000,ra*1000):Math.min(2500,350*Math.pow(2,n-1))}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function sendTextMail({to,subject,body,sender}){
 const cfg=readiness();if(!cfg.configured)throw error('GRAPH_MAIL_NOT_CONFIGURED','Microsoft Graph Mailversand ist noch nicht vollständig konfiguriert.',503);
 const actualSender=text(sender)||cfg.sender,email=text(to),sub=text(subject),content=text(body);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw error('MAIL_RECIPIENT_INVALID','Die Empfängeradresse ist ungültig.',400);
 if(!sub||sub.length>200)throw error('MAIL_SUBJECT_INVALID','Der Mailbetreff ist ungültig.',400);
 if(!content||content.length>12000)throw error('MAIL_BODY_INVALID','Der Mailtext ist ungültig.',400);
 const payload=Buffer.from(JSON.stringify({message:{subject:sub,body:{contentType:'Text',content},toRecipients:[{emailAddress:{address:email}}]},saveToSentItems:true}),'utf8');
 let force=false,last=null;
 for(let attempt=1;attempt<=3;attempt++){
  try{
   const token=await accessToken(force),claims=tokenClaims(token);
   if(!mailSendGranted(claims))throw error('GRAPH_MAIL_PERMISSION_MISSING','Microsoft Graph Mail.Send ist für die ExportHUB-App nicht als Application-Berechtigung freigegeben.',503);
   await request('POST','https://graph.microsoft.com/v1.0/users/'+encodeURIComponent(actualSender)+'/sendMail',{Authorization:'Bearer '+token,'Content-Type':'application/json','Content-Length':payload.length,Accept:'application/json'},payload,12000);
   return{ok:true,sender:actualSender,to:email,attempts:attempt}
  }catch(e){
   last=e;
   if(e&&e.statusCode===401&&!force){tokenCache=null;force=true;continue}
   if(attempt<3&&transient(e)){await sleep(delay(e,attempt));force=false;continue}
   throw e
  }
 }
 throw last||error('GRAPH_MAIL_FAILED','E-Mail konnte nicht versendet werden.',502)
}
module.exports={readiness,verifyAuthentication,permissionRequirement,sendTextMail};
