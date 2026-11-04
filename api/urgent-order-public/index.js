'use strict';
// Public capability access: unique reporter secret, never a shared list of all CS requests.
const crypto=require('node:crypto');
const internal=require('../urgent-orders/index');
const model=require('../shared/urgent-orders');
const guard=new Map();
const MAX_ORDERS=3000,MAX_REPORTER_ORDERS=100,MAX_PUBLIC_CREATES_PER_DAY=200;
function txt(v,max=250){return String(v==null?'':v).trim().slice(0,max);}
function json(status,value){return{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'},body:JSON.stringify(value)};}
function body(req){let value=req&&req.body;if(typeof value==='string'){if(value.length>65000)throw model.problem('URGENT_PAYLOAD_TOO_LARGE','Request is too large.',413);try{value=JSON.parse(value)}catch(_){value={}};}if(!value||typeof value!=='object'||Array.isArray(value))return{};if(JSON.stringify(value).length>65000)throw model.problem('URGENT_PAYLOAD_TOO_LARGE','Request is too large.',413);return value;}
function credential(){
 const token='uro_'+crypto.randomBytes(32).toString('base64url');
 return{token,tokenHash:hashToken(token),id:crypto.randomUUID()};
}
function hashToken(v){return crypto.createHash('sha256').update('ExportHUB360|urgent-reporter|v1|'+String(v)).digest('hex');}
function groupByToken(doc,v){
 const raw=txt(v,100);
 if(!/^uro_[A-Za-z0-9_-]{43}$/.test(raw))return null;
 const hashed=hashToken(raw);
 return(doc.reporterGroups||[]).find(g=>g&&typeof g.tokenHash==='string'&&g.tokenHash===hashed)||null;
}
function publicOrder(order){
 return{
  id:order.id,orderNumber:order.orderNumber,delivery:order.delivery,priority:order.priority,
  orderType:order.orderType||'STANDARD',directOutbound:order.directOutbound||null,
  createdAt:order.createdAt,updatedAt:order.updatedAt,
  items:(order.items||[]).map(x=>({
   id:x.id,line:x.line,article:x.article,quantity:x.quantity,status:x.status,
   checkResult:x.checkResult,minibag:!!x.minibag,newArticle:!!x.newArticle,
   problemNote:x.status==='Problem'?txt(x.problemNote,1000):''
  }))
 };
}
function ip(req){
 const h=req&&req.headers||{};
 const forwarded=txt(h['x-forwarded-for']||h['X-Forwarded-For']||'',120).split(',')[0].trim();
 return forwarded||txt(h['x-azure-clientip']||h['x-client-ip']||'unknown',120);
}
function checkRate(req,action){
 const now=Date.now(),key=crypto.createHash('sha256').update(ip(req)+'|'+action).digest('hex');
 const span=action==='create'?3600000:60000,limit=action==='create'?12:90;
 const r=guard.get(key);
 if(guard.size>10000){for(const [k,v] of guard)if(now-v.start>3600000)guard.delete(k);}
 if(!r||now-r.start>=span){guard.set(key,{start:now,count:1});return;}
 if(++r.count>limit)throw model.problem('URGENT_REPORTER_RATE_LIMIT','Too many requests. Please try again later.',429);
}
function issueGroup(doc,secret,email,now){
 if(doc.reporterGroups.length>=MAX_ORDERS)throw model.problem('URGENT_CAPACITY','Reporter capacity reached.',503);
 const g={id:secret.id,tokenHash:secret.tokenHash,email,createdAt:now};
 doc.reporterGroups.push(g);return g;
}
async function publicAction(req,refs){
 const p=body(req),action=txt(p.action,30);
 if(action==='list'){
  checkRate(req,'list');
  const doc=await internal.readDocument(refs),group=groupByToken(doc,p.accessToken);
  if(!group)throw model.problem('URGENT_REPORTER_ACCESS_DENIED','Invalid or missing tracking link.',403);
  return{orders:doc.orders.filter(o=>o.reporterId===group.id).map(publicOrder).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),environment:refs.environment};
 }
 if(action==='create'){
  checkRate(req,'create');
  const now=new Date().toISOString();
  const secret=credential();
  const provided=txt(p.accessToken,100);
  const result=await internal.write(refs,doc=>{
   let group=provided?groupByToken(doc,provided):null;
   if(provided&&!group)throw model.problem('URGENT_REPORTER_ACCESS_DENIED','Invalid or missing tracking link.',403);
   const reporterEmail=model.email(p.email);
   if(group&&group.email!==reporterEmail)throw model.problem('URGENT_REPORTER_EMAIL_MISMATCH','Use the email address associated with your tracking link.',403);
   if(doc.orders.length>=MAX_ORDERS)throw model.problem('URGENT_CAPACITY','The report service has reached its request limit.',503);
   if(group&&doc.orders.filter(o=>o.reporterId===group.id).length>=MAX_REPORTER_ORDERS)throw model.problem('URGENT_REPORTER_CAPACITY','This tracking link has reached its request limit.',409);
   // Durable daily cap is enforced inside the same ETag-protected write so parallel
   // Azure workers cannot bypass a per-instance memory counter.
   const day=now.slice(0,10),counter=doc.publicDaily&&doc.publicDaily.day===day?Number(doc.publicDaily.count)||0:0;
   if(counter>=MAX_PUBLIC_CREATES_PER_DAY)throw model.problem('URGENT_PUBLIC_DAILY_LIMIT','Daily public reporting capacity reached. Please contact logistics.',429);
   const actor={id:'REPORTER:'+(group?group.id:secret.id),name:'Customer Service'};
   const order=model.createOrder(p,actor,now);
   if(doc.orders.some(o=>o.orderNumber===order.orderNumber))throw model.problem('URGENT_ORDER_EXISTS','This sales order is already reported. Please contact logistics.',409);
   if(!group)group=issueGroup(doc,secret,reporterEmail,now);
   order.reporterId=group.id;
   doc.orders.push(order);
   doc.publicDaily={day,count:counter+1};
   return{order:publicOrder(order),accessToken:provided||secret.token,isNewLink:!provided};
  });
  return{...result,environment:refs.environment};
 }
 throw model.problem('URGENT_ACTION_UNKNOWN','Unknown public report action.',400);
}
module.exports=async function(context,req){
 if(req.method==='OPTIONS'){context.res={status:204,headers:{Allow:'POST, OPTIONS','Cache-Control':'no-store'},body:''};return;}
 if(req.method!=='POST'){context.res=json(405,{ok:false,code:'METHOD_NOT_ALLOWED'});return;}
 try{
  // No session is read or required. Every read must present the reporter's private capability token.
  const refs=internal.storage(req),result=await publicAction(req,refs);
  context.res=json(200,{ok:true,...result});
 }catch(e){
  const status=Number(e&&e.status||e&&e.statusCode)||500;
  const internalCode=String(e&&e.code||'URGENT_PUBLIC_FAILED');
  // Return only recognized operational codes, never Azure credentials, stack traces or host internals.
  const publicCode=/^(?:URGENT_[A-Z0-9_]+|TEST_AUTH_ISOLATION_[A-Z0-9_]+)$/.test(internalCode)?internalCode:'URGENT_PUBLIC_FAILED';
  context.log&&context.log.warn&&context.log.warn('urgent-order-public',internalCode,status);
  const serviceError=status>=500;
  const safeMessages={
   URGENT_STORAGE_MISSING:'Urgent Order ist noch nicht mit dem Datenspeicher verbunden. Bitte die Logistik informieren.',
   URGENT_HOST_UNTRUSTED:'Die Urgent-Order-Umgebung konnte nicht eindeutig geprüft werden. Bitte die Logistik informieren.',
   URGENT_WRITE_UNVERIFIED:'Die Speicherung wurde nicht bestätigt. Bitte zuerst in der Übersicht prüfen, ob der Auftrag vorhanden ist.',
   URGENT_CAPACITY:'Der Dienst hat seine Kapazitätsgrenze erreicht. Bitte die Logistik informieren.'
  };
  const message=serviceError
   ?safeMessages[publicCode]||'Urgent Order ist momentan nicht verfügbar. Bitte erneut versuchen und bei Wiederholung die Logistik informieren.'
   :e&&e.message||'Ungültige Anfrage.';
  context.res=json(status,{ok:false,code:publicCode,message,retryable:serviceError&&publicCode!=='URGENT_WRITE_UNVERIFIED'});
 }
};
module.exports.publicAction=publicAction;
module.exports.groupByToken=groupByToken;
module.exports.hashToken=hashToken;
module.exports.publicOrder=publicOrder;
