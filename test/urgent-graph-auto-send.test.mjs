import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const require=createRequire(import.meta.url);
const Module=require('node:module');
const model=require('../api/shared/urgent-orders.js');
const manager={id:'LOG-1',name:'Warehouse',rights:{shipmentoverview:{edit:true}}};
const requestId='5f4624c1-6a4c-4ef6-b94d-1d9750a2f900';
const secondRequestId='5f4624c1-6a4c-4ef6-b94d-1d9750a2f901';
const mail={id:'order-1',kind:'problem',to:'cs@example.org',subject:' Urgent SO3002 ',body:'Original line\r\n  with trailing spaces  \r\n',language:'en',requestId};
function freshOrder(){return{id:'order-1',email:'cs@example.org',language:'en',items:[{status:'Shipped'}],history:[],mailHistory:[]};}

test('Direct send reserves a unique message but does not claim sent without Microsoft acceptance',()=>{
 const order=freshOrder();
 const reserved=model.requestGraphMail(order,mail,manager,'2026-11-07T17:00:00.000Z');
 assert.equal(reserved.existing,false);
 assert.equal(reserved.mail.status,'sending');
 assert.equal(reserved.mail.body,mail.body);
 assert.equal(reserved.mail.subject,mail.subject);
 assert.equal(order.history.at(-1).event,'mail_send_requested');
 const repeated=model.requestGraphMail(order,mail,manager,'2026-11-07T17:00:01.000Z');
 assert.equal(repeated.existing,true);
 assert.equal(repeated.mail.id,reserved.mail.id);
 assert.equal(order.mailHistory.length,1,'idempotent replay cannot create duplicate emails');
 assert.throws(()=>model.requestGraphMail(order,{...mail,requestId:secondRequestId},manager,'2026-11-07T17:00:02.000Z'),e=>e.code==='URGENT_MAIL_DUPLICATE');
 assert.throws(()=>model.requestGraphMail(order,{...mail,subject:'Changed'},manager),e=>e.code==='URGENT_MAIL_REQUEST_CONFLICT');
});

test('Only server-confirmed Graph acceptance adds a sent status and an automatic audit',()=>{
 const order=freshOrder();
 const {mail:record}=model.requestGraphMail(order,mail,manager);
 assert.throws(()=>model.confirmMailSent(order,record.id,manager),e=>e.code==='URGENT_MAIL_STATUS_INVALID','users cannot manually confirm sending status');
 const accepted=model.confirmGraphMailAccepted(order,record.id,'mailer@example.org','2026-11-07T17:01:00.000Z');
 assert.equal(accepted.status,'sent_confirmed');
 assert.equal(accepted.confirmationSource,'graph_accepted');
 assert.equal(accepted.sender,'mailer@example.org');
 assert.equal(accepted.sentConfirmedBy.name,'Microsoft 365');
 assert.equal(order.history.at(-1).event,'mail_graph_accepted');
 const length=order.history.length;
 model.confirmGraphMailAccepted(order,record.id,'mailer@example.org');
 assert.equal(order.history.length,length,'Graph acceptance replay is idempotent');
});

test('Uncertain Graph failures must not create automatic confirmations',()=>{
 const order=freshOrder();
 const {mail:record}=model.requestGraphMail(order,mail,manager);
 model.markGraphMailUnverified(order,record.id);
 assert.equal(record.status,'send_unverified');
 assert.equal(record.sentAt,null);
 assert.equal(order.history.at(-1).event,'mail_graph_unverified');
 assert.throws(()=>model.confirmGraphMailAccepted(order,record.id,'mailer@example.org'),e=>e.code==='URGENT_GRAPH_MAIL_STATUS_INVALID');
});

test('Graph Urgent Order flow persists before sending, retries no transport, and auto-confirms only after Graph success',async()=>{
 const apiPath=require.resolve('../api/urgent-orders/index.js');
 const sent=[];
 const runtime={configured:true,permission:true,fail:false};
 const graph={
  readiness:()=>({configured:runtime.configured,sender:'mailer@example.org'}),
  verifyAuthentication:async()=>({authenticated:runtime.permission,mailSendGranted:runtime.permission}),
  sendTextMail:async args=>{sent.push(args);if(runtime.fail)throw Error('No response');return{ok:true}}
 };
 const auth={
  body:req=>req.body,
  readJson:async blob=>({value:structuredClone(blob.value),etag:String(blob.version)}),
  writeJson:async(blob,doc,etag)=>{
   assert.equal(String(blob.version),etag);
   blob.value=structuredClone(doc);blob.version++;return{etag:String(blob.version)};
  }
 };
 const oldLoad=Module._load;
 Module._load=function(request,parent,isMain){
  if(parent&&parent.filename===apiPath){
   if(request==='@azure/storage-blob')return{BlobServiceClient:{}};
   if(request==='../shared/auth-store')return auth;
   if(request==='../shared/graph-mail')return graph;
  }
  return oldLoad.apply(this,arguments);
 };
 delete require.cache[apiPath];
 let api;
 try{api=require('../api/urgent-orders/index.js')}finally{Module._load=oldLoad;}
 const blob={value:{orders:[freshOrder()],profiles:{},reporterGroups:[]},version:1},refs={blob,environment:'testservice'};
 const req={body:{action:'send-mail-direct',...mail}};
 const sentMessage=await api.execute(req,manager,refs);
 assert.equal(sent.length,1);
 assert.equal(sent[0].subject,mail.subject);
 assert.equal(sent[0].body,mail.body);
 assert.equal(sent[0].maxAttempts,1,'a timeout may have sent the email: do not auto retry');
 assert.equal(sent[0].preserveText,true,'Graph must send the exact editor text');
 assert.equal(sentMessage.mail.status,'sent_confirmed');
 assert.equal(sentMessage.providerAccepted,true);
 assert.equal(blob.value.orders[0].mailHistory[0].confirmationSource,'graph_accepted');
 const again=await api.execute(req,manager,refs);
 assert.equal(again.alreadySent,true);
 assert.equal(sent.length,1,'same click request must not send twice');
 const versionBefore=blob.version;
 runtime.permission=false;
 await assert.rejects(api.execute({body:{...req.body,requestId:secondRequestId}},manager,refs),e=>e.code==='URGENT_GRAPH_PERMISSION_MISSING');
 assert.equal(blob.version,versionBefore,'no reservation without Microsoft Mail.Send');
 runtime.permission=true;
 runtime.fail=true;
 const failedRequest={body:{...req.body,requestId:secondRequestId,subject:'Different issue'}};
 await assert.rejects(api.execute(failedRequest,manager,refs),e=>e.code==='URGENT_GRAPH_SEND_UNVERIFIED');
 assert.equal(blob.value.orders[0].mailHistory.at(-1).status,'send_unverified');
 await assert.rejects(api.execute(failedRequest,manager,refs),e=>e.code==='URGENT_GRAPH_MAIL_PENDING');
 assert.equal(sent.length,2,'never resend an ambiguous Graph request');
});

test('Direct-send UI sends the current text and never asks the user to confirm after Microsoft accepts',async()=>{
 const html=readFileSync(new URL('../assets/urgent-orders.html',import.meta.url),'utf8');
 const a=html.indexOf('async function sendDirect(){'),b=html.indexOf('async function mailto(){',a);
 assert.ok(a>=0&&b>a);
 const els=Object.fromEntries(['mailTo','mailSubject','mailBody','mailLanguage','mailOverlay','sendDirect','openMailer'].map(k=>[k,{value:'',hidden:false,disabled:false}]));
 els.mailTo.value=mail.to;els.mailSubject.value=mail.subject;els.mailBody.value=mail.body;els.mailLanguage.value='en';
 const calls=[],messages=[];
 const context={window:{crypto:{randomUUID:()=>requestId}},$:(id)=>els[id],modalOrder:'order-1',modalKind:'problem',directRequestId:'',orders:[freshOrder()],
  render:()=>{},localeV2:(name,fallback)=>fallback,setMessage:(...a)=>messages.push(a),
  api:async(action,payload)=>{calls.push({action,payload});return{order:{...freshOrder(),mailHistory:[{status:'sent_confirmed',confirmationSource:'graph_accepted'}]}}}
 };
 vm.createContext(context);vm.runInContext(html.slice(a,b),context);
 await context.sendDirect();
 assert.equal(calls.length,1);assert.equal(calls[0].action,'send-mail-direct');
 assert.equal(calls[0].payload.subject,mail.subject);assert.equal(calls[0].payload.body,mail.body);
 assert.equal(els.sendDirect.disabled,true);assert.equal(els.openMailer.disabled,true);
 assert.equal(context.orders[0].mailHistory[0].status,'sent_confirmed');
 assert.equal(messages.at(-1)[2],'ok');
});
