import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(root={}){
  const source=fs.readFileSync('assets/pack-notification-internal.js','utf8');
  const context={window:root,globalThis:root,console,Date,Intl,setTimeout,clearTimeout};
  vm.runInContext(source,vm.createContext(context),{filename:'pack-notification-internal.js'});
  return root.ExportHUBPackNotifications;
}

function detailHarness(notification){
  const host={innerHTML:'',appended:null,appendChild(node){this.appended=node;}};
  const body={getAttribute(){return'';},setAttribute(){}};
  const document={
    __packNotificationsInstalled:true,
    body,
    documentElement:{},
    getElementById:id=>id==='content'?host:null,
    querySelector:()=>null,
    createElement:()=>({innerHTML:'',className:'',id:'',addEventListener(){}}),
    addEventListener(){}
  };
  const state={packNotifications:[notification],tasks:[]};
  const root={
    document,
    __EXPORTHUB_GET_STATE__:()=>state,
    ExportHUBPackI18n:{
      t(key){
        const values={
          'shipment.customer':'Kunde',
          'shipment.customerNumber':'Kundennummer'
        };
        return values[key]||key;
      },
      language:()=> 'de'
    }
  };
  return{api:load(root),host};
}

test('RC1536: Packmeldungsmodell behaelt Kundenname und Kundennummer fuer die Detailansicht',()=>{
  const api=load({document:{__packNotificationsInstalled:true}});
  const [model]=api.inboxItems({packNotifications:[{
    id:'pn-1536',reference:'PK-1536',customer:'Würth Industrie Service GmbH & Co. KG',customerId:'C100',customerAccount:'9000003004',status:'new'
  }]});
  assert.equal(model.customer,'Würth Industrie Service GmbH & Co. KG');
  assert.equal(model.customerId,'C100');
  assert.equal(model.customerAccount,'9000003004');
});

test('RC1536: Packmeldungsdetail zeigt den Kunden explizit in den Versanddaten',()=>{
  const notification={
    id:'pn-1536',reference:'PK-1536',customer:'Würth Industrie Service GmbH & Co. KG',customerId:'C100',customerAccount:'9000003004',
    packageType:'Euro Palette',packageCount:2,totalWeight:680,packages:[],documents:[],status:'new',createdAt:'2026-10-14T18:32:00.000Z'
  };
  const {api,host}=detailHarness(notification);
  assert.equal(api.openNotificationDetail(notification),true);
  assert.ok(host.appended,'Detailansicht wurde nicht gerendert');
  assert.match(host.appended.innerHTML,/<dt>Kunde<\/dt><dd>Würth Industrie Service GmbH &amp; Co\. KG<\/dd>/);
  assert.match(host.appended.innerHTML,/<dt>Kundennummer<\/dt><dd>9000003004<\/dd>/);
});
