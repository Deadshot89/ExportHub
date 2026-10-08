import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const api=require('../api/pack-notification/index.js');

function loadInternal(){
  const source=fs.readFileSync('assets/pack-notification-internal.js','utf8');
  const root={};
  const context=vm.createContext({window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout});
  vm.runInContext(source,context,{filename:'pack-notification-internal.js'});
  return root.ExportHUBPackNotifications;
}

function state(){return{
  packNotifications:[{
    id:'pn-1',reference:'PK-20261008ABCDEF',customer:'BSH Hausgeräte',packStationId:'PT01',packStationName:'Packtisch 01',deliveryNoteReference:'',packageType:'Europalette',packageCount:2,totalWeight:680,packages:[{packageNo:1,length:120,width:80,height:145,unit:'cm'},{packageNo:2,length:120,width:80,height:130,unit:'cm'}],documents:[{id:'doc-1',name:'DNC3019222063.pdf',storage:'blob',blobName:'rc1059/production/aa/'+('a'.repeat(64)),mimeType:'application/pdf',size:100}],status:'new',createdAt:'2026-10-08T10:42:00.000Z'
  }],
  tasks:[{
    id:'task:pack:pn-1',sourceType:'pack_notification',sourceId:'pn-1',sourceRef:'PK-20261008ABCDEF',group:'Packmeldungen',title:'Neue Packmeldung · BSH Hausgeräte',status:'open',priority:'P2',unread:true,createdAt:'2026-10-08T10:42:00.000Z'
  }]
};}

test('submitted pack notification projects to one non-generic task',()=>{
  const n=state().packNotifications[0];
  const task=api.taskFor(n,'production');
  assert.equal(task.sourceType,'pack_notification');
  assert.equal(task.group,'Packmeldungen');
  assert.equal(task.sourceId,n.id);
  assert.match(task.title,/Neue Packmeldung · BSH Hausgeräte/);
  assert.notEqual(task.title,'Aufgabe');
});

test('pack helper finds source record and counts unread exactly once',()=>{
  const internal=loadInternal(),s=state();
  assert.equal(internal.isPackTask(s.tasks[0]),true);
  assert.equal(internal.findNotification(s,s.tasks[0]).id,'pn-1');
  assert.equal(internal.unreadCount(s),1);
  s.tasks.push({...s.tasks[0]});
  assert.equal(internal.unreadCount(s),1,'duplicate task identity must not double-count badge');
});

test('markRead clears only selected pack task unread marker',()=>{
  const internal=loadInternal(),s=state();
  s.tasks.push({id:'task:pack:pn-2',sourceType:'pack_notification',sourceId:'pn-2',sourceRef:'PK-2',group:'Packmeldungen',title:'Neue Packmeldung · Würth',status:'open',unread:true});
  internal.markRead(s,'task:pack:pn-1','2026-10-08T10:45:00.000Z');
  assert.equal(s.tasks[0].unread,false);
  assert.equal(s.tasks[0].readAt,'2026-10-08T10:45:00.000Z');
  assert.equal(s.tasks[1].unread,true);
});

test('pack task section model includes customer, weight, station and documents',()=>{
  const internal=loadInternal(),s=state();
  const model=internal.detailModel(s,s.tasks[0]);
  assert.equal(model.customer,'BSH Hausgeräte');
  assert.equal(model.totalWeight,680);
  assert.equal(model.stationName,'Packtisch 01');
  assert.equal(model.packages.length,2);
  assert.equal(model.documents.length,1);
  assert.equal(model.documents[0].name,'DNC3019222063.pdf');
});

test('pack inbox is derived from packNotifications and works without tasks',()=>{
  const internal=loadInternal(),s=state();
  s.tasks=[];
  const items=internal.inboxItems(s);
  assert.equal(items.length,1);
  assert.equal(items[0].notificationId,'pn-1');
  assert.equal(items[0].customer,'BSH Hausgeräte');
  assert.equal(items[0].unread,true);
  assert.equal(internal.inboxUnreadCount(s),1);
});

test('pack inbox owns a separate navigation target and does not require tasks view',()=>{
  const adapter=fs.readFileSync('assets/pack-notification-internal.js','utf8');
  assert.match(adapter,/data-pack-notifications-nav/);
  assert.match(adapter,/renderPackInbox/);
  assert.match(adapter,/packnotifications/);
  assert.doesNotMatch(adapter,/currentView\(\)!==['"]tasks['"][\s\S]*renderPackInbox/);
});

test('pack navigation is a true SPA view and reuses the existing menu item structure',()=>{
  const nav=fs.readFileSync('assets/pack-notification-nav.js','utf8');
  assert.match(nav,/cloneNode\(true\)/,'menu structure must be cloned, not rebuilt');
  assert.match(nav,/setPackNavLabel/,'cloned menu label must be replaced without flattening structure');
  assert.doesNotMatch(nav,/location\.hash\s*=\s*['"]#packmeldungen/,'pack nav must not invoke the legacy hash router');
  assert.doesNotMatch(nav,/setAttribute\(['"]href['"],[ ]*['"]#packmeldungen/);
  assert.match(nav,/openInbox\(\)/,'click should render the inbox directly');
});

test('existing rc1014 five-group contract remains untouched and adapter owns pack-specific UI',()=>{
  const lifecycle=fs.readFileSync('assets/rc1014-task-lifecycle.js','utf8');
  const runtime=fs.readFileSync('assets/rc1014-task-runtime.js','utf8');
  const adapter=fs.readFileSync('assets/pack-notification-internal.js','utf8');
  assert.match(lifecycle,/Object\.freeze\(\['Offene Sendungen','Fehlende POD','Kunde angemeldet','Picks','Offene ABDs'\]\)/);
  assert.doesNotMatch(runtime,/pack_notification|ExportHUBPackNotifications/);
  assert.match(adapter,/pack_notification/);
  assert.match(adapter,/renderPackInbox/);
  assert.match(adapter,/openNotificationDetail/);
});
