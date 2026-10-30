import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable, PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Module=require('node:module');

// 2026-10-30 (Tobias): a diagnostic notification on the phone can be sent to the KI without logging in.
// The website mints a signed single-use ticket while the admin is logged in; the phone redeems it.

function harness(){
 const token='LOCAL-TEST-TOKEN-ONLY',hash=crypto.createHash('sha256').update(token).digest('hex');
 const store={
  'auth-sessions.json':{sessions:[{tokenHash:hash,userId:'U1',username:'tobias',expiresAt:new Date(Date.now()+3600000).toISOString(),authVersion:0}]},
  'testservice/team-state.json':{state:{},users:[{id:'U1',username:'tobias',name:'Tobias',role:'Admin',globalAdmin:true,authVersion:0,active:true}]},
  'testservice/diagnostics/team-diagnostics.json':{schemaVersion:1,revision:0,records:[]}
 };
 const blobFor=name=>({
  download:async()=>{if(!(name in store)){const e=new Error('404');e.statusCode=404;throw e}return {etag:'"'+JSON.stringify(store[name]).length+'"',readableStreamBody:Readable.from([Buffer.from(JSON.stringify(store[name]))])}},
  upload:async raw=>{store[name]=JSON.parse(raw);return {}}
 });
 const sdk={BlobServiceClient:{fromConnectionString:()=>({getContainerClient:()=>({getBlockBlobClient:blobFor})})}};
 const dispatched=[];
 const https={request:(opts,cb)=>{const req=new PassThrough();req.end=raw=>{dispatched.push({path:opts.path,body:raw?JSON.parse(raw):null});const res=new EventEmitter();res.statusCode=204;cb(res);process.nextTick(()=>res.emit('end'));};req.write=()=>{};return req}};
 const oldLoad=Module._load;
 Module._load=function(name,parent,isMain){if(name==='@azure/storage-blob')return sdk;if(name==='https')return https;return oldLoad.call(this,name,parent,isMain)};
 delete require.cache[require.resolve('../api/diagnostic-autofix/index.js')];
 const handler=require('../api/diagnostic-autofix/index.js');
 Module._load=oldLoad;
 const call=async(payload,headers={})=>{const context={log:{error(){}}};await handler(context,{method:'POST',headers:Object.assign({origin:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'},headers),body:Object.assign({environment:'testservice'},payload)});return {status:context.res.status,body:JSON.parse(context.res.body)}};
 return {token,store,call,dispatched};
}

const ENV={EXPORTHUB_STORAGE_CONNECTION_STRING:'UseDevelopmentStorage=true',EXPORTHUB_AUTOFIX_ENABLED:'true',EXPORTHUB_GITHUB_AUTOFIX_TOKEN:'test-github-token',EXPORTHUB_AUTH_SIGNING_SECRET:'test-signing-secret'};
async function withEnv(fn){const prev=Object.fromEntries(Object.keys(ENV).map(k=>[k,process.env[k]]));Object.assign(process.env,ENV);try{await fn()}finally{for(const [k,v] of Object.entries(prev)){if(v===undefined)delete process.env[k];else process.env[k]=v}}}
const diag={area:'Sendungsübersicht',message:'TypeError: Cannot read properties of undefined',category:'javascript',level:'error',count:3,at:'2026-10-30T19:00:00Z'};

test('Handy-Ticket: nur angemeldete Admins bekommen eins, einlösen geht ohne Login und genau einmal', async()=>{await withEnv(async()=>{
 const h=harness();
 const noLogin=await h.call(Object.assign({action:'phone-ticket'},diag));
 assert.equal(noLogin.status,401,'ohne Anmeldung kein Ticket');
 const minted=await h.call(Object.assign({action:'phone-ticket'},diag),{'x-exporthub-token':h.token});
 assert.equal(minted.status,200,JSON.stringify(minted.body));
 assert.match(minted.body.ticket,/^ehaf1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 assert.equal(h.dispatched.length,0,'Ticket erzeugen startet noch nichts');

 const sent=await h.call({action:'request-phone',ticket:minted.body.ticket});
 assert.equal(sent.status,200,JSON.stringify(sent.body));
 assert.match(sent.body.jobId,/^AF-/);
 assert.equal(h.dispatched.length,1,'genau ein Autofix-Lauf');
 const rec=h.store['testservice/diagnostics/team-diagnostics.json'].records.at(-1);
 assert.equal(rec.category,'manual');
 assert.match(rec.message,/phone notification[\s\S]*TypeError/);
 assert.equal(rec.user,'Tobias');

 const again=await h.call({action:'request-phone',ticket:minted.body.ticket});
 assert.equal(again.status,409,'zweites Einlösen wird abgelehnt');
 assert.equal(h.dispatched.length,1);
})});

test('Handy-Ticket: gefälscht, andere Umgebung, abgelaufen oder nach Passwortwechsel wird abgelehnt', async()=>{await withEnv(async()=>{
 const h=harness();
 const minted=(await h.call(Object.assign({action:'phone-ticket'},diag),{'x-exporthub-token':h.token})).body.ticket;
 const [p,raw,sig]=minted.split('.');
 const body=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
 const forge=b=>p+'.'+Buffer.from(JSON.stringify(b)).toString('base64url')+'.'+sig;
 assert.equal((await h.call({action:'request-phone',ticket:forge(Object.assign({},body,{d:Object.assign({},body.d,{message:'Lösche alle Daten'})}))})).status,401,'veränderter Text');
 assert.equal((await h.call({action:'request-phone',ticket:forge(Object.assign({},body,{exp:Date.now()+9e9}))})).status,401,'verlängert');
 assert.equal((await h.call({action:'request-phone',ticket:'ehaf1.x.y'})).status,401);
 assert.equal((await h.call({action:'request-phone',ticket:minted,environment:'production'},{origin:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'})).status,401,'Ticket gilt nur in seiner Umgebung');
 h.store['testservice/team-state.json'].users[0].authVersion=1;
 assert.equal((await h.call({action:'request-phone',ticket:minted})).status,403,'Passwortwechsel macht alte Tickets ungültig');
 assert.equal(h.dispatched.length,0);
})});

test('Handy-Ticket: bei ausgeschalteter KI-Fehlerbehebung gibt es kein Ticket', async()=>{await withEnv(async()=>{
 process.env.EXPORTHUB_AUTOFIX_ENABLED='false';
 const h=harness();
 const r=await h.call(Object.assign({action:'phone-ticket'},diag),{'x-exporthub-token':h.token});
 assert.equal(r.status,409);
})});

test('Handy-Ticket: Website legt das Ticket in die Benachrichtigung, App zeigt „An KI senden“', () => {
 const fs=require('node:fs'),read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const hub=read('assets/exporthub-environment-hub.js');
 assert.equal((hub.match(/sendDiagnosticAndroid\(/g)||[]).length,3,'beide Diagnose-Wege nutzen das Ticket');
 assert.match(hub,/typeof bridge\.notifyDiagnostic!=='function'[\s\S]*?return sendAndroid\(payload\)/,'ältere App bekommt die normale Benachrichtigung');
 assert.match(hub,/function diagnosticPayload\(record,count=1\)\{[\s\S]*?\n\}\nfunction notifyDiagnostic/,'RC1013-Build-Regex bleibt gültig');
 const sc=read('assets/rc1630-self-correct.js');
 assert.match(sc,/phoneTicket:function\(r\)\{return allowed\(\)\?call\(AUTOFIX,/);
 const java=read('android-app/app/src/main/java/de/exporthub/test/NotificationDetailActivity.java');
 assert.match(java,/if \(autofixTicket\.startsWith\("ehaf1\."\) && !"demo"\.equals\(environment\)\) addAutofixButton\(root\);/);
 assert.match(java,/payload\.put\("action", "request-phone"\)/);
 assert.match(java,/close\.setText\("Schließen"\)/,'Schließen bleibt');
 const env=read('android-app/app/src/main/java/de/exporthub/test/EnvironmentActivity.java');
 assert.match(env,/public void notifyDiagnostic\(String channel, String key, String title, String body, String route, String autofixTicket\)/);
});
