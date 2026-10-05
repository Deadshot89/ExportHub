import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';

async function failedSend({tokenStatus=200,sendStatus=401,senders=['DespatchNettetal@essentra.com'],environment={},domainTenant='sender-tenant',lookupStatus=200,lookup={id:'mailbox-id',mail:'DespatchNettetal@essentra.com',userPrincipalName:'despatch@tenant.example',userType:'Member'},headers={}}={}){
 const calls=[],claims={aud:'https://graph.microsoft.com',roles:['Mail.Send'],tid:'app-tenant',appid:'client-test',exp:Math.floor(Date.now()/1000)+3600};
 const token='x.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.x';
 const https={request(options,callback){
  calls.push(options);
  const req=new EventEmitter();req.write=body=>options.testBody=body.toString();req.destroy=e=>req.emit('error',e);
  req.end=()=>{
   const res=new EventEmitter();res.headers={};
   let body;
   if(options.path.endsWith('/token')){res.statusCode=tokenStatus;body=tokenStatus===200?{access_token:token,expires_in:3600}:{error:'invalid_client',error_description:'AADSTS700016: Application was not found in the target directory.'};}
   else if(options.path.includes('/.well-known/')){res.statusCode=200;body={issuer:'https://login.microsoftonline.com/'+domainTenant+'/v2.0'};}
   else if(options.method==='GET'){res.statusCode=lookupStatus;body=lookupStatus===200?lookup:{error:{code:'Authorization_RequestDenied',message:'Denied'}};}
   else{res.statusCode=sendStatus;res.headers=headers;body=null;}
   callback(res);queueMicrotask(()=>{if(body)res.emit('data',Buffer.from(JSON.stringify(body)));res.emit('end');});
  };return req;
 }};
 const sandbox={URL,URLSearchParams,Buffer,Date,setTimeout,process:{env:{EXPORTHUB_GRAPH_TENANT_ID:'app-tenant',EXPORTHUB_GRAPH_CLIENT_ID:'client-test',EXPORTHUB_GRAPH_CLIENT_SECRET:'secret-test',EXPORTHUB_MAIL_SENDER:'configured@example.com',...environment}},module:{exports:{}},require:()=>https};
 vm.runInNewContext(fs.readFileSync('api/shared/graph-mail.js','utf8'),sandbox);
 let error;
 try{for(const sender of senders)await sandbox.module.exports.sendTextMail({to:'internal@example.com',sender,subject:'Test',body:'Test'});}catch(e){error=e;}
 return{error,calls,token};
}

test('persistent 401 reports tenant mismatch and matching sender directory without exposing credentials',async()=>{
 const {error,calls,token}=await failedSend();
 assert.equal(error.code,'GRAPH_SEND_UNAUTHORIZED');
 assert.equal(error.diagnostics.token.audienceOk,true);
 assert.equal(error.diagnostics.token.mailSendGranted,true);
 assert.equal(error.diagnostics.token.clientMatchesConfigured,true);
 assert.equal(error.diagnostics.senderDomain.tenantMatchesToken,false);
 assert.equal(error.diagnostics.senderDirectory.found,true);
 assert.equal(error.diagnostics.senderDirectory.mailMatches,true);
 assert.equal(error.diagnostics.senderDirectory.upnMatches,false);
 assert.equal(calls.filter(c=>c.method==='POST'&&c.path.endsWith('/sendMail')).length,2,'one refreshed-token retry, no extra mail');
 const metadata=calls.find(c=>c.path.includes('/.well-known/'));
 assert.equal(metadata.headers.Authorization,undefined,'domain discovery never receives Graph token');
 assert.ok(!JSON.stringify(error.diagnostics).includes(token));
 assert.ok(!JSON.stringify(error.diagnostics).includes('secret-test'));
});

test('matching tenant is distinguished from a denied directory lookup',async()=>{
 const {error}=await failedSend({domainTenant:'app-tenant',lookupStatus:403});
 assert.equal(error.diagnostics.senderDomain.tenantMatchesToken,true);
 assert.equal(error.diagnostics.senderDirectory.status,403);
 assert.equal(error.diagnostics.senderDirectory.found,false);
 assert.equal(error.diagnostics.senderDirectory.code,'Authorization_RequestDenied');
});

test('Microsoft response-header reasons are bounded and scrubbed while correlation ID is preserved',async()=>{
 const {error}=await failedSend({headers:{'request-id':'request-123','x-ms-diagnostics':'2000003;reason="Invalid tenant secret-test";error_category="invalid_tenant"','www-authenticate':'Bearer error="invalid_token", error_description="secret-test"','set-cookie':'private-cookie'}});
 assert.equal(error.diagnostics.upstream.requestId,'request-123');
 assert.equal(error.diagnostics.upstream.category,'invalid_tenant');
 assert.match(error.diagnostics.upstream.reason,/Invalid tenant/);
 assert.ok(!JSON.stringify(error.diagnostics).includes('secret-test'));
 assert.ok(!JSON.stringify(error.diagnostics).includes('private-cookie'));
});

test('guest sender is distinguished from a local member account',async()=>{
 const {error}=await failedSend({lookup:{id:'guest-id',mail:'DespatchNettetal@essentra.com',userPrincipalName:'guest#EXT#@tenant.example',userType:'Guest'}});
 assert.equal(error.diagnostics.senderDirectory.guest,true);
});

test('real mail gate runs before broad browser matrix and both remain required',()=>{
 const source=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const mail=source.indexOf("npx playwright test e2e/specs/testservice-mutation.spec.mjs --project=laptop --grep 'RC1255 P2:'");
 const broad=source.indexOf('npx playwright test             e2e/specs/navigation.spec.mjs',source.indexOf('id: rc1124_testservice_browser_gate'));
 assert.ok(mail>=0&&broad>mail);
 assert.ok(source.indexOf('Deploy ExportHUB production',broad)>broad);
});

test('Essentra sender acquires its token from the Essentra authority, preserving the configured app credentials',async()=>{
 const {calls}=await failedSend();
 const tokenRequests=calls.filter(c=>c.path.endsWith('/token'));
 assert.equal(tokenRequests.length,2);
 for(const req of tokenRequests)assert.equal(req.path,'/essentra.com/oauth2/v2.0/token');
});

test('mail-specific app credentials can be configured without altering the shared drive credentials',async()=>{
 const {calls}=await failedSend({environment:{EXPORTHUB_MAIL_GRAPH_CLIENT_ID:'mail-client-test',EXPORTHUB_MAIL_GRAPH_CLIENT_SECRET:'mail-secret-test'}});
 const form=new URLSearchParams(calls.find(c=>c.path.endsWith('/token')).testBody);
 assert.equal(form.get('client_id'),'mail-client-test');
 assert.equal(form.get('client_secret'),'mail-secret-test');
 assert.equal(form.get('scope'),'https://graph.microsoft.com/.default');
});

test('missing app in the correct tenant remains an explicit OAuth error, with no fallback to the wrong tenant',async()=>{
 const {error,calls}=await failedSend({tokenStatus:400});
 assert.equal(error.upstreamCode,'invalid_client');
 assert.match(error.upstreamMessage,/AADSTS700016/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].path,'/essentra.com/oauth2/v2.0/token');
});

test('cached token from another authority is never reused for the Essentra mailbox',async()=>{
 const {error,calls}=await failedSend({sendStatus:202,senders:['configured@example.com','DespatchNettetal@essentra.com']});
 assert.equal(error,undefined);
 assert.deepEqual(calls.filter(c=>c.path.endsWith('/token')).map(c=>c.path),['/app-tenant/oauth2/v2.0/token','/essentra.com/oauth2/v2.0/token']);
 assert.equal(calls.filter(c=>c.path.endsWith('/sendMail')).length,2);
});
