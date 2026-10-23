import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const webPush=require('../api/shared/web-push.js');
const storeLib=require('../api/shared/web-push-store.js');
const reminders=require('../api/shared/web-push-reminders.js');
const packStore=require('../api/shared/pack-notification-store.js');

// Receiver side of RFC 8291, only for the tests: what the phone's browser does.
function device(){
  const ecdh=crypto.createECDH('prime256v1');ecdh.generateKeys();
  const auth=crypto.randomBytes(16);
  return{ecdh,auth,subscription:endpoint=>({endpoint,keys:{p256dh:webPush.b64url(ecdh.getPublicKey()),auth:webPush.b64url(auth)}})};
}
function hmac(k,d){return crypto.createHmac('sha256',k).update(d).digest();}
function decrypt(dev,body){
  const salt=body.subarray(0,16),rs=body.readUInt32BE(16),idlen=body[20],asPublic=body.subarray(21,21+idlen),ct=body.subarray(21+idlen);
  assert.equal(rs,4096);
  const secret=dev.ecdh.computeSecret(asPublic),uaPublic=dev.ecdh.getPublicKey();
  const ikm=hmac(hmac(dev.auth,secret),Buffer.concat([Buffer.from('WebPush: info\0'),uaPublic,asPublic,Buffer.from([1])]));
  const prk=hmac(salt,ikm);
  const cek=hmac(prk,Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0,16),nonce=hmac(prk,Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0,12);
  const d=crypto.createDecipheriv('aes-128-gcm',cek,nonce);d.setAuthTag(ct.subarray(ct.length-16));
  const plain=Buffer.concat([d.update(ct.subarray(0,ct.length-16)),d.final()]);
  assert.equal(plain[plain.length-1],2);
  return JSON.parse(plain.subarray(0,plain.length-1).toString('utf8'));
}
function memoryStore(now){
  const blobs=new Map();let etagSeq=0;
  const container=()=>({getBlockBlobClient:name=>({name})});
  const readJson=async(blob,fallback)=>{const hit=blobs.get(blob.name);return hit?{value:JSON.parse(hit.raw),etag:hit.etag}:{value:fallback,etag:null};};
  const uploadJson=async(blob,value,etag)=>{const hit=blobs.get(blob.name);if(etag?(!hit||hit.etag!==etag):hit){const e=new Error('conflict');e.statusCode=412;throw e;}blobs.set(blob.name,{raw:JSON.stringify(value),etag:'e'+(++etagSeq)});};
  return{blobs,store:storeLib.createStore({container,readJson,uploadJson,now:()=>now().toISOString()})};
}

test('Web Push: Verschlüsselung entspricht dem RFC-8291-Testvektor',()=>{
  const out=webPush.encryptPayload({keys:{p256dh:'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',auth:'BTBZMqHH6r4Tts7J_aSIgg'}},'When I grow up, I want to be a watermelon',{privateKey:webPush.fromB64url('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'),salt:webPush.fromB64url('DGv6ra1nlYgDCS1FRnbzlw')});
  assert.equal(webPush.b64url(out),'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('Web Push: Gerät entschlüsselt den Inhalt, VAPID-Signatur ist gültig',async()=>{
  const dev=device(),vapid=webPush.generateVapidKeys(),endpoint='https://fcm.googleapis.com/fcm/send/abc';
  let sent=null;
  const res=await webPush.sendNotification(dev.subscription(endpoint),{title:'Hallo',body:'Welt'},{vapid,subject:'https://www.exporthub360.de',topic:'tasks',transport:async(url,headers,body)=>{sent={url,headers,body};return{status:201}}});
  assert.equal(res.ok,true);
  assert.equal(sent.url,endpoint);
  assert.equal(sent.headers['Content-Encoding'],'aes128gcm');
  assert.deepEqual(decrypt(dev,sent.body),{title:'Hallo',body:'Welt'});
  const m=sent.headers.Authorization.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m);assert.equal(m[4],vapid.publicKey);
  const claims=JSON.parse(Buffer.from(m[2],'base64url').toString());
  assert.equal(claims.aud,'https://fcm.googleapis.com');
  const raw=webPush.fromB64url(vapid.publicKey),pub=crypto.createPublicKey({key:{kty:'EC',crv:'P-256',x:webPush.b64url(raw.subarray(1,33)),y:webPush.b64url(raw.subarray(33))},format:'jwk'});
  assert.equal(crypto.verify('sha256',Buffer.from(m[1]+'.'+m[2]),{key:pub,dsaEncoding:'ieee-p1363'},Buffer.from(m[3],'base64url')),true);
});

test('Web Push: nur bekannte Push-Dienste, abgelaufene Abos werden erkannt',async()=>{
  for(const ok of ['https://fcm.googleapis.com/fcm/send/x','https://updates.push.services.mozilla.com/wpush/v2/x','https://web.push.apple.com/x','https://wns2-par02p.notify.windows.com/w/?token=x'])assert.equal(webPush.allowedEndpoint(ok),true,ok);
  for(const bad of ['http://fcm.googleapis.com/x','https://169.254.169.254/latest','https://evil.example/fcm.googleapis.com','https://fcm.googleapis.com:8443/x','https://user@fcm.googleapis.com/x'])assert.equal(webPush.allowedEndpoint(bad),false,bad);
  const dev=device(),vapid=webPush.generateVapidKeys();
  const gone=await webPush.sendNotification(dev.subscription('https://fcm.googleapis.com/fcm/send/x'),{a:1},{vapid,transport:async()=>({status:410})});
  assert.equal(gone.gone,true);assert.equal(gone.ok,false);
  const down=await webPush.sendNotification(dev.subscription('https://fcm.googleapis.com/fcm/send/x'),{a:1},{vapid,transport:async()=>{throw new Error('ECONNRESET')}});
  assert.equal(down.ok,false);assert.equal(down.gone,false);
  assert.throws(()=>webPush.encryptPayload(dev.subscription('https://fcm.googleapis.com/x'),'x'.repeat(5000)),e=>e.code==='WEB_PUSH_PAYLOAD_TOO_LARGE');
});

test('Web Push: Berliner Ortszeit für Sommer- und Winterzeit',()=>{
  assert.equal(reminders.berlinNowIso(new Date('2026-10-23T11:05:07Z')),'2026-10-23T13:05:07+02:00');
  assert.equal(reminders.berlinNowIso(new Date('2026-12-01T08:00:00Z')),'2026-12-01T09:00:00+01:00');
});

const users=[{id:'u1',user:'anna',name:'Anna'},{id:'u2',user:'ben',name:'Ben'},{id:'u3',user:'old',name:'Alt',active:false}];
function sub(id,userId,extra={}){return{id,userId,endpoint:'https://fcm.googleapis.com/fcm/send/'+id,keys:{},categories:{tasks:true,pack:true},...extra};}

test('Web Push: fällige Aufgaben je Benutzer nach TaskPlanner-Regeln, keine Doppelten',()=>{
  const state={tasks:[
    {id:'t1',title:'Zollpapiere prüfen',dueDate:'2026-10-23',ownerId:'u1',priority:'P1'},
    {id:'t2',title:'Fremde Aufgabe',dueDate:'2026-10-23',ownerId:'u2'},
    {id:'t3',title:'Für alle',dueDate:'2026-10-21'},
    {id:'t4',title:'Erledigt',dueDate:'2026-10-23',ownerId:'u1',status:'done'},
    {id:'t5',title:'Zukunft',dueDate:'2026-10-30',ownerId:'u1'}
  ]};
  const subscriptions=[sub('a','u1'),sub('b','u1'),sub('c','u2',{categories:{tasks:false,pack:true}}),sub('d','u3')];
  const early=reminders.dueTaskMessages({state,users,subscriptions,ledger:{},environment:'production',nowIso:'2026-10-23T08:30:00+02:00'});
  assert.equal(early.messages.length,0,'vor 09:00 nichts');
  const due=reminders.dueTaskMessages({state,users,subscriptions,ledger:{},environment:'production',nowIso:'2026-10-23T13:05:00+02:00'});
  assert.deepEqual(due.inactiveSubscriptionIds,['d']);
  assert.equal(due.messages.length,1);
  const m=due.messages[0];
  assert.equal(m.userId,'u1');
  assert.deepEqual(m.subscriptions.map(s=>s.id),['a','b']);
  assert.deepEqual(m.payload.items.map(i=>i.title).sort(),['Für alle','Zollpapiere prüfen']);
  assert.equal(m.payload.kind,'tasks');
  assert.match(m.payload.title,/2 Aufgaben-Erinnerungen/);
  assert.match(m.payload.url,/^\/assets\/web-push\/inbox\.html\?m=/);
  assert.ok(m.ledgerKeys.every(k=>/^push\|t[13]\|.*\|13:00\|u1\|production$/.test(k)));
  const ledger=Object.fromEntries(m.ledgerKeys.map(k=>[k,'x']));
  assert.equal(reminders.dueTaskMessages({state,users,subscriptions,ledger,environment:'production',nowIso:'2026-10-23T13:40:00+02:00'}).messages.length,0,'gleicher Slot nicht doppelt');
  assert.equal(reminders.dueTaskMessages({state,users,subscriptions,ledger,environment:'production',nowIso:'2026-10-23T15:31:00+02:00'}).messages.length,1,'15:30 kommt wieder');
  assert.equal(reminders.dueTaskMessages({state,users,subscriptions,ledger:{},environment:'production',nowIso:'2026-10-24T13:05:00+02:00'}).messages.length,0,'Samstag kein Versand');
  assert.ok(Buffer.byteLength(JSON.stringify(m.payload))<webPush.MAX_PAYLOAD_BYTES);
});

function apiFixture(){
  let now=new Date('2026-10-23T11:05:00Z');
  const mem=memoryStore(()=>now);
  const devices={a:device(),b:device(),z:device()};
  const sent=[];let sendStatus=201,oidc=true;
  const team={users:users.concat([{id:'u9',user:'leser',name:'Leser',rights:{}}]).map(u=>u.id==='u1'?Object.assign({rights:{shipment:{edit:true}}},u):u),state:{tasks:[{id:'t1',title:'Zollpapiere prüfen',dueDate:'2026-10-23',ownerId:'u1'}]}};
  const sessions={tokA:team.users[0],tokL:team.users[3]};
  const api=require('../api/web-push/index.js');
  const deps={
    store:mem.store,
    validateSession:async req=>{const u=sessions[req.headers['x-exporthub-token']];if(!u){const e=new Error('Sitzung ungültig');e.code='SESSION_INVALID';e.status=401;throw e;}return{user:u};},
    readTeam:async()=>team,
    oidcAuthorized:async()=>oidc,
    send:(subscription,payload,options)=>webPush.sendNotification(subscription,payload,Object.assign({},options,{transport:async(url,headers,body)=>{sent.push({url,headers,body});return{status:sendStatus}}})),
    now:()=>now
  };
  const handler=api.createHandler(deps),notifyPack=api.createPackNotifier(deps);
  const call=(payload,token)=>handler({method:'POST',headers:Object.assign({host:'www.exporthub360.de'},token?{'x-exporthub-token':token}:{}),body:payload}).then(r=>({status:r.status,body:JSON.parse(r.body)}));
  return{api,handler,notifyPack,call,mem,devices,sent,team,setNow:d=>{now=d},setStatus:s=>{sendStatus=s},setOidc:v=>{oidc=v}};
}

test('Web Push API: aktivieren, Status ohne Login, Zeitplan-Versand genau einmal',async()=>{
  const f=apiFixture();
  const cfg=await f.handler({method:'GET',headers:{host:'www.exporthub360.de'}});
  const publicKey=JSON.parse(cfg.body).publicKey;
  assert.equal(webPush.fromB64url(publicKey).length,65);
  assert.equal(JSON.parse((await f.handler({method:'GET',headers:{host:'www.exporthub360.de'}})).body).publicKey,publicKey,'Schlüssel bleibt stabil');
  const subA=f.devices.a.subscription('https://fcm.googleapis.com/fcm/send/A');
  assert.equal((await f.call({action:'subscribe',subscription:subA})).status,401,'Aktivieren braucht Login');
  const on=await f.call({action:'subscribe',subscription:subA,deviceLabel:'Android · Chrome'},'tokA');
  assert.equal(on.status,200);assert.equal(on.body.subscription.packAllowed,true);
  const st=await f.call({action:'status',endpoint:subA.endpoint});
  assert.equal(st.body.subscribed,true);assert.equal(st.body.subscription.deviceLabel,'Android · Chrome');
  assert.equal(JSON.stringify(st.body).includes('u1'),false,'Status verrät keine Benutzer-ID');

  f.setOidc(false);
  assert.equal((await f.call({action:'dispatch-reminders'})).status,401);
  f.setOidc(true);
  const first=await f.call({action:'dispatch-reminders'});
  assert.equal(first.status,200);assert.equal(first.body.sent,1);
  const payload=decrypt(f.devices.a,f.sent[0].body);
  assert.equal(payload.title,'Aufgabe · Zollpapiere prüfen');
  assert.equal(f.sent[0].headers.Topic,'tasks');
  const second=await f.call({action:'dispatch-reminders'});
  assert.equal(second.body.sent,0);assert.equal(f.sent.length,1);

  const test1=await f.call({action:'test',endpoint:subA.endpoint},'tokA');
  assert.equal(test1.status,200);assert.equal(decrypt(f.devices.a,f.sent[1].body).kind,'test');
  assert.equal((await f.call({action:'test',endpoint:subA.endpoint},'tokL')).status,404,'fremdes Gerät nicht testbar');
});

test('Web Push API: Fehlversuch wird wiederholt, abgelaufenes Gerät gelöscht, Abmelden ohne Login',async()=>{
  const f=apiFixture();
  const subA=f.devices.a.subscription('https://fcm.googleapis.com/fcm/send/A');
  await f.call({action:'subscribe',subscription:subA},'tokA');
  f.setStatus(503);
  assert.equal((await f.call({action:'dispatch-reminders'})).body.failed,1);
  f.setStatus(201);
  assert.equal((await f.call({action:'dispatch-reminders'})).body.sent,1,'nach Störung nachgeholt');
  f.setNow(new Date('2026-10-23T13:35:00Z'));
  f.setStatus(410);
  assert.equal((await f.call({action:'dispatch-reminders'})).body.removed,1);
  assert.equal((await f.call({action:'status',endpoint:subA.endpoint})).body.subscribed,false);

  f.setStatus(201);
  await f.call({action:'subscribe',subscription:subA},'tokA');
  const subZ=f.devices.z.subscription('https://updates.push.services.mozilla.com/wpush/v2/Z');
  const moved=await f.call({action:'resubscribe',oldEndpoint:subA.endpoint,subscription:subZ});
  assert.equal(moved.status,200);
  assert.equal((await f.call({action:'status',endpoint:subA.endpoint})).body.subscribed,false);
  assert.equal((await f.call({action:'status',endpoint:subZ.endpoint})).body.subscribed,true);
  assert.equal((await f.call({action:'resubscribe',oldEndpoint:'https://fcm.googleapis.com/fcm/send/unknown',subscription:subA})).status,404);
  const off=await f.call({action:'unsubscribe',endpoint:subZ.endpoint});
  assert.equal(off.body.removed,true);
  assert.equal((await f.call({action:'subscribe',subscription:{endpoint:'https://169.254.169.254/x',keys:subA.keys}},'tokA')).status,400);
});

test('Web Push: Packmeldung geht sofort an berechtigte Geräte, Kategorie abschaltbar',async()=>{
  const f=apiFixture();
  const subA=f.devices.a.subscription('https://fcm.googleapis.com/fcm/send/A'),subB=f.devices.b.subscription('https://fcm.googleapis.com/fcm/send/B');
  await f.call({action:'subscribe',subscription:subA},'tokA');
  await f.call({action:'subscribe',subscription:subB},'tokL');
  const r=await f.notifyPack('production',{id:'n1',reference:'PK-1',customer:'BSH Hausgeräte',packageCount:2,totalWeight:480,packStationName:'Packtisch 01'});
  assert.equal(r.sent,1,'nur Benutzer mit Bearbeitungsrecht');
  const p=decrypt(f.devices.a,f.sent[0].body);
  assert.equal(p.kind,'pack');assert.equal(p.title,'Neue Packmeldung · BSH Hausgeräte');assert.match(p.body,/PK-1 · 2 Colli · 480 kg/);
  await f.call({action:'update',endpoint:subA.endpoint,categories:{pack:false}});
  assert.equal((await f.notifyPack('production',{id:'n2',reference:'PK-2'})).sent,0);
});

test('Packmeldung: neue Meldung löst Web Push aus, Fehler im Push stören die Meldung nicht',async()=>{
  const token='PT01-push-token';
  let state={packStations:[{id:'PT01',name:'Packtisch 01',tokenHash:packStore.hashStationToken(token),active:true}],packSessions:[],packNotifications:[],tasks:[]};
  const pushed=[];
  const api=require('../api/pack-notification/index.js');
  const handler=api.createHandler({now:()=>new Date('2026-10-08T10:00:00.000Z'),mutateState:async(_e,m)=>{const r=await m(JSON.parse(JSON.stringify(state)));state=r.state;return r;},notifyPush:async(env,n)=>{pushed.push({env,n});throw new Error('Push-Dienst down')}});
  const req=(action,body)=>({method:'POST',query:{action},headers:{host:'www.exporthub360.de'},body});
  const session=await handler(req('session',{stationToken:token}));
  const submit={stationToken:token,sessionId:session.body.sessionId,idempotencyKey:'idem-push',customer:'BSH Hausgeräte',deliveryNoteReference:'LS1',packageType:'Europalette',packageCount:1,totalWeight:480,packages:[{packageNo:1,length:120,width:80,height:140,unit:'cm'}],note:'',documents:[{id:'doc-1',name:'LS1.pdf',mimeType:'application/pdf',size:14,data:'data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y='}]};
  const res=await handler(req('submit',submit));
  assert.equal(res.status,201,JSON.stringify(res.body));
  assert.equal(pushed.length,1);assert.equal(pushed[0].env,'production');assert.equal(pushed[0].n.customer,'BSH Hausgeräte');
  const again=await handler(req('submit',submit));
  assert.equal(again.status,200);assert.equal(pushed.length,1,'Wiederholung pusht nicht erneut');
});

test('Web Push: TaskPlanner-Kopie im API-Ordner ist identisch mit assets',()=>{
  for(const file of reminders.PLANNER_FILES)assert.equal(fs.readFileSync('api/shared/taskplanner-v2/'+file,'utf8'),fs.readFileSync('assets/'+file,'utf8'),file+' veraltet: cp assets/'+file+' api/shared/taskplanner-v2/');
});

test('Web Push: Build bindet Client und Manifest ein (nicht in der Demo), Service Worker vorhanden',()=>{
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(build,/function patchWebPush\(html,file\)\{\n  if\(file==='demo\.html'\)return html;/);
  assert.match(build,/html=patchWebPush\(html,file\);/);
  for(const f of ['client.js','sw.js','inbox.html','inbox.js','manifest.json','icon-192.png','badge-96.png']){assert.ok(build.includes("'assets/web-push/"+f+"'"),f);assert.ok(fs.statSync('assets/web-push/'+f).size>0,f);}
  const sw=fs.readFileSync('assets/web-push/sw.js','utf8');
  for(const ev of ['push','notificationclick','pushsubscriptionchange'])assert.ok(sw.includes("addEventListener('"+ev+"'"),ev);
  const manifest=JSON.parse(fs.readFileSync('assets/web-push/manifest.json','utf8'));
  assert.equal(manifest.display,'standalone');
  const wf=fs.readFileSync('.github/workflows/web-push-reminders.yml','utf8');
  assert.match(wf,/audience=exporthub-web-push/);assert.match(wf,/id-token: write/);
  const fn=JSON.parse(fs.readFileSync('api/web-push/function.json','utf8'));
  assert.equal(fn.bindings[0].route,'web-push');
});
