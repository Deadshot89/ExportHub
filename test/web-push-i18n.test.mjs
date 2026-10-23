import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const i18n=require('../api/shared/web-push-i18n.js');
const reminders=require('../api/shared/web-push-reminders.js');
const store=require('../api/shared/web-push-store.js');
const front=fs.readFileSync('assets/i18n/web-push.js','utf8');
const api=fs.readFileSync('api/shared/web-push-i18n.js','utf8');

test('Web Push locale: browser and Azure API dictionaries are identical and all six packs complete',()=>{
 assert.equal(front,api,'website and Azure must serve the same translations');
 const locales=['de','en','pl','es','fr','it'];
 assert.deepEqual(Array.from(i18n.supported),locales);
 const keys=Object.keys(i18n.packs.de).sort();
 assert.ok(keys.length>=60);
 for(const code of locales){
   assert.deepEqual(Object.keys(i18n.packs[code]).sort(),keys,code+' must not miss any key');
   assert.ok(keys.every(key=>typeof i18n.packs[code][key]==='string'&&i18n.packs[code][key].trim()),code+' contains empty translations');
   assert.equal(i18n.t('serverTaskOne',{title:'ABC'},code).includes('ABC'),true);
   assert.ok(!i18n.t('serverTaskMany',{count:3},code).includes('{{count}}'));
 }
 assert.equal(i18n.normalize('nl-NL'),'','unsupported language must be rejected');
});

test('Web Push locale: standalone inbox can switch language without authenticated application',()=>{
 const storage={value:'pl'};
 const sandbox={console,URL,CustomEvent:class CustomEvent{},location:{href:'https://exporthub360.com/assets/web-push/inbox.html?m=example'},navigator:{language:'en-US'},
   localStorage:{getItem:()=>storage.value,setItem(_k,v){storage.value=v}},document:{cookie:''},dispatchEvent(){}};
 sandbox.window=sandbox;
 vm.runInNewContext(front,sandbox,{filename:'assets/i18n/web-push.js'});
 const l=sandbox.ExportHUBWebPushI18n;
 assert.equal(l.language(),'pl');
 assert.equal(l.t('inboxTitle'),'Powiadomienia');
 assert.equal(l.setLanguage('es'),'es');
 assert.equal(l.language(),'es');
 assert.equal(l.t('inboxTitle'),'Notificaciones');
});

test('Web Push locale: message payload follows device language and retains stable notification identity',()=>{
 const rows=[{title:'Check customs',priority:'P1',dueAt:'2026-10-23',taskId:'1'}];
 const en=reminders.taskPayload(rows,'production','2026-10-23T13:05:00+02:00','en','same-id');
 const de=reminders.taskPayload(rows,'production','2026-10-23T13:05:00+02:00','de','same-id');
 assert.equal(en.id,de.id);assert.equal(en.language,'en');assert.equal(de.language,'de');
 assert.match(en.title,/Task/);assert.match(de.title,/Aufgabe/);
 assert.match(en.items[0].meta,/due/);assert.match(de.items[0].meta,/fällig/);
 const pack=reminders.packPayload({reference:'PK-1',customer:'Test',packageCount:2},'production','2026-10-23T13:00:00Z','fr');
 assert.match(pack.title,/Nouvelle/);assert.equal(pack.language,'fr');assert.match(pack.body,/colis/);
 const result=reminders.testPayload('testservice','2026-10-23T13:00:00Z','it');
 assert.equal(result.language,'it');assert.match(result.title,/riuscito/);
});

test('Web Push locale: subscription saves language without exposing user ID to unauthenticated status',()=>{
 const doc=store.emptyDoc(),now='2026-10-23T11:00:00.000Z';
 const s={endpoint:'https://fcm.googleapis.com/fcm/send/abc',keys:{p256dh:'abc',auth:'def'}};
 const old=store.upsertSubscription(doc,{subscription:s,user:{id:'u1',name:'Anna'},language:'fr'},now);
 assert.equal(old.language,'fr');
 assert.equal(store.publicSubscription(old).language,'fr');
 assert.equal(JSON.stringify(store.publicSubscription(old)).includes('u1'),false);
 const fresh=store.upsertSubscription(doc,{subscription:s,user:{id:'u1',name:'Anna'}},now);
 assert.equal(fresh.language,'fr','language survives browser resubscribe');
 assert.equal(store.upsertSubscription(doc,{subscription:s,user:{id:'u1',name:'Anna'},language:'nl'},now).language,'fr','invalid language keeps previous selection');
});

test('Web Push locale: translation loads before client, inbox has selector, Service Worker imports locale',()=>{
 const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 assert.match(builder,/WEB_PUSH_I18N_TAG/);
 const inject=builder.slice(builder.indexOf('function patchWebPush('),builder.indexOf('function patchNotificationTasks(',builder.indexOf('function patchWebPush(')));
 assert.ok(inject.indexOf('WEB_PUSH_I18N_TAG')<inject.indexOf('WEB_PUSH_SCRIPT_TAG'));
 const inbox=fs.readFileSync('assets/web-push/inbox.html','utf8');
 assert.match(inbox,/id="language"/);assert.match(inbox,/assets\/i18n\/web-push\.js/);
 const sw=fs.readFileSync('assets/web-push/sw.js','utf8');
 assert.match(sw,/importScripts\('\/assets\/i18n\/web-push\.js/);
 for(const file of ['assets/web-push/client.js','assets/web-push/inbox.js']){
   const s=fs.readFileSync(file,'utf8');
   assert.ok(s.includes('ExportHUBWebPushI18n'),file);
 }
});
