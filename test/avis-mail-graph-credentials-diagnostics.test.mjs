import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';

const source=fs.readFileSync('api/shared/graph-mail.js','utf8');
const api=fs.readFileSync('api/avis-upload-mail-readiness/index.js','utf8');
const production=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
const main=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');

const sharedFixtureValue=['fixture','shared','not-a-secret'].join('-');
const dedicatedFixtureValue=['fixture','mail','not-a-secret'].join('-');
const shared={
 EXPORTHUB_GRAPH_TENANT_ID:'shared-tenant',
 EXPORTHUB_GRAPH_CLIENT_ID:'shared-client',
 EXPORTHUB_GRAPH_CLIENT_SECRET:sharedFixtureValue,
 EXPORTHUB_MAIL_SENDER:'mail@example.com'
};
function graphWith(env={},oauth={status:400,code:'invalid_client',description:'AADSTS7000215: The provided secret is invalid.'}){
 const requests=[];
 const https={request(options,callback){
  requests.push(options);
  const req=new EventEmitter();
  req.write=()=>{};req.end=()=>{
   const res=new EventEmitter();res.statusCode=oauth.status;res.headers={};
   callback(res);
   queueMicrotask(()=>{
    res.emit('data',Buffer.from(JSON.stringify({error:oauth.code,error_description:oauth.description})));
    res.emit('end');
   });
  };
  req.destroy=err=>req.emit('error',err);
  return req;
 }};
 const sandbox={module:{exports:{}},require:()=>https,URL,URLSearchParams,Buffer,Date,setTimeout,process:{env:{...shared,...env}}};
 vm.runInNewContext(source,sandbox,{filename:'api/shared/graph-mail.js'});
 return{graph:sandbox.module.exports,requests};
}

test('AVIS Graph credentials: shared app remains valid without dedicated mail overrides',()=>{
 const {graph}=graphWith();
 const cfg=graph.readiness();
 assert.equal(cfg.configured,true);
 assert.equal(cfg.credentialSource,'shared');
 assert.equal(cfg.clientId,'shared-client');
 assert.deepEqual(Array.from(cfg.missing),[]);
});

test('AVIS Graph credentials: partial dedicated overrides never mix with shared secret',()=>{
 const {graph}=graphWith({EXPORTHUB_MAIL_GRAPH_CLIENT_ID:'different-mail-app'});
 const cfg=graph.readiness();
 assert.equal(cfg.configured,false);
 assert.equal(cfg.credentialSource,'dedicated');
 assert.equal(cfg.clientId,'different-mail-app');
 assert.equal(cfg.clientSecret,'');
 assert.deepEqual(Array.from(cfg.missing),['EXPORTHUB_MAIL_GRAPH_TENANT_ID','EXPORTHUB_MAIL_GRAPH_CLIENT_SECRET']);
 assert.equal(cfg.code,'GRAPH_MAIL_CREDENTIALS_INCOMPLETE');
});

test('AVIS Graph credentials: complete dedicated triple overrides shared credentials atomically',()=>{
 const {graph}=graphWith({
  EXPORTHUB_MAIL_GRAPH_TENANT_ID:'mail-tenant',
  EXPORTHUB_MAIL_GRAPH_CLIENT_ID:'mail-client',
  EXPORTHUB_MAIL_GRAPH_CLIENT_SECRET:dedicatedFixtureValue
 });
 const cfg=graph.readiness();
 assert.equal(cfg.configured,true);
 assert.equal(cfg.credentialSource,'dedicated');
 assert.equal(cfg.tenantId,'mail-tenant');
 assert.equal(cfg.clientId,'mail-client');
 assert.equal(cfg.clientSecret,dedicatedFixtureValue);
});

test('AVIS Graph authentication: safe token-rejection categories never reveal the OAuth error details',async()=>{
 for(const [description,expected] of [
  ['AADSTS7000222: The secret has expired; token secret-private-123','CLIENT_SECRET_EXPIRED'],
  ['AADSTS7000215: Invalid client secret secret-private-123','CLIENT_SECRET_REJECTED'],
  ['AADSTS700016: Application secret-private-123 was not found','APPLICATION_NOT_FOUND'],
  ['AADSTS90002: Tenant not found','TENANT_NOT_FOUND'],
  ['Unexpected OAuth error secret-private-123','OAUTH_CREDENTIALS_REJECTED']
 ]){
  const {graph}=graphWith({}, {status:400,code:'invalid_client',description});
  const result=await graph.verifyAuthentication();
  assert.equal(result.code,'GRAPH_AUTH_FAILED');
  assert.equal(result.authenticated,false);
  assert.equal(result.upstreamStatus,400);
  assert.equal(result.authFailureCategory,expected);
  assert.ok(!JSON.stringify(result).includes('secret-private-123'));
  assert.ok(!JSON.stringify(result).includes(sharedFixtureValue));
 }
});

test('AVIS Graph diagnostics: signed API and two release workflows use bounded diagnostics',()=>{
 assert.match(api,/cfg\.code\|\|'GRAPH_MAIL_NOT_CONFIGURED'/);
 assert.match(api,/authFailureCategory:text\(authProbe\.authFailureCategory\)/);
 for(const workflow of [production,main]){
  assert.match(workflow,/authFailureCategory:v\.authFailureCategory/);
  assert.match(workflow,/upstreamStatus:v\.upstreamStatus/);
 }
});
