import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const runtimePath='assets/rc1294-abd-self-service.js';
const runtimeSource=fs.readFileSync(runtimePath,'utf8');
const apiRequire=createRequire(new URL('../api/shared/abd-analysis-model.js',import.meta.url));
const model=apiRequire('./abd-analysis-model.js');
const exporter=apiRequire('./abd-analysis-export.js');

function node(tag='div'){
  return{
    tagName:String(tag).toUpperCase(),hidden:false,disabled:false,innerHTML:'',textContent:'',className:'',children:[],attributes:{},
    setAttribute(name,value){this.attributes[name]=String(value)},
    getAttribute(name){return this.attributes[name]},
    appendChild(child){this.children.push(child);return child},
    addEventListener(){},remove(){this.removed=true},
    querySelector(){return null},querySelectorAll(){return[]}
  }
}

function analysis(fileName,hs,origin,value){
  return{
    fileName,fileType:'csv',
    header:{invoiceNumber:fileName.replace(/\..*$/,''),invoiceTotal:value,currency:'EUR'},
    positions:[{position:'1',itemNumber:'A',description:'Teil',commodityCode:hs,originCountry:origin,quantity:1,netMassKg:1,grossMassKg:1,value,currency:'EUR',source:fileName,confirmed:true}],
    groups:[{key:`${hs}|${origin}`,commodityCode:hs,originCountry:origin,value,currency:'EUR',positionCount:1,status:'complete',warnings:[]}],
    unassigned:[],
    totals:{invoiceTotal:value,groupedTotal:value,unassignedKnownValue:0,accountedTotal:value,difference:0,currency:'EUR',currencies:['EUR'],currencyCompatible:true,valueCoverageComplete:true,unassignedCount:0},
    review:{groupCount:1,readyGroupCount:1,reviewGroupCount:0,unassignedCount:0,missingHsCount:0,missingOriginCount:0,missingValueCount:0,complete:true,warnings:[]}
  }
}

function file(name,content){
  const bytes=Buffer.from(content);
  return{name,type:'text/csv',async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}}
}

test('RC1499 acceptance: mehrere Rechnungen werden in einem Lauf getrennt analysiert und gerendert',async()=>{
  const files=[file('invoice-a.csv','a'),file('invoice-b.csv','b')];
  const input={files};
  const button={disabled:false};
  const status=node();
  const results=node();
  const panel={
    querySelector(selector){
      if(selector==='[data-rc1294-files]')return input;
      if(selector==='[data-rc1294-start]')return button;
      if(selector==='[data-rc1294-status]')return status;
      if(selector==='[data-rc1294-results]')return results;
      return null
    }
  };
  const uploads=[];
  const statusCalls=[];
  const analyses={
    'id-a':analysis('invoice-a.csv','39269097','CN',100),
    'id-b':analysis('invoice-b.csv','73181595','DE',200)
  };
  const document={
    readyState:'loading',documentElement:node('html'),head:node('head'),body:node('body'),
    addEventListener(){},createElement:node,
    getElementById(id){return id==='rc1294AbdAnalysis'?panel:null},
    querySelector(){return null}
  };
  const sandbox={
    console,window:null,document,Uint8Array,Intl,Promise,Buffer,
    btoa(value){return Buffer.from(value,'binary').toString('base64')},
    setTimeout,clearTimeout,
    location:{hostname:'example.test'},
    sessionStorage:{length:0,getItem(){return null},key(){return null}},
    ExportHUBClean:{runtime:{authToken:'test-token'}},
    addEventListener(){},
    async fetch(_url,options){
      const payload=JSON.parse(options.body);
      if(payload.action==='upload'){
        uploads.push(payload.file.name);
        const id=payload.file.name==='invoice-a.csv'?'id-a':'id-b';
        return{ok:true,status:202,async text(){return JSON.stringify({ok:true,upload:{id,name:payload.file.name}})}}
      }
      if(payload.action==='status'){
        statusCalls.push(payload.uploadId);
        return{ok:true,status:200,async text(){return JSON.stringify({ok:true,status:'ready',analysis:analyses[payload.uploadId]})}}
      }
      throw new Error('unexpected action '+payload.action)
    }
  };
  sandbox.window=sandbox;
  vm.runInNewContext(runtimeSource,sandbox,{filename:runtimePath});

  const ok=await sandbox.ExportHUBRC1294ABDAnalysis.start();
  assert.equal(ok,true);
  assert.deepEqual(uploads,['invoice-a.csv','invoice-b.csv']);
  assert.deepEqual(statusCalls,['id-a','id-b']);
  assert.match(results.innerHTML,/invoice-a\.csv/);
  assert.match(results.innerHTML,/invoice-b\.csv/);
  assert.match(results.innerHTML,/39269097/);
  assert.match(results.innerHTML,/73181595/);
  assert.equal(button.disabled,false,'Startbutton muss nach Mehrfachanalyse wieder bedienbar sein');
});

test('RC1499 acceptance: Korrektur, Gruppierung und Export verwenden exakt denselben geprüften Snapshot',()=>{
  const reviewed=model.rebuildReviewedAnalysis({
    header:{invoiceNumber:'INV-ACCEPT',invoiceTotal:300,currency:'EUR'},
    positions:[
      {position:'10',description:'Teil A',commodityCode:'39269097',originCountry:'CN',value:100,currency:'EUR',confirmed:true,source:'invoice.xlsx'},
      {position:'20',description:'Teil B',commodityCode:'39269097',originCountry:'CN',value:25.5,currency:'EUR',confirmed:true,source:'invoice.xlsx'},
      {position:'30',description:'Teil C',commodityCode:'73181595',originCountry:'DE',value:174.5,currency:'EUR',confirmed:true,source:'invoice.xlsx'}
    ]
  });
  assert.equal(reviewed.review.complete,true);
  assert.equal(reviewed.totals.accountedTotal,300);
  assert.equal(reviewed.totals.difference,0);
  assert.deepEqual(reviewed.groups.map(g=>[g.commodityCode,g.originCountry,g.value]),[
    ['39269097','CN',125.5],['73181595','DE',174.5]
  ]);

  const exported=exporter.createExportModel(reviewed);
  assert.deepEqual(exported.groups,reviewed.groups.map(g=>({
    commodityCode:g.commodityCode,originCountry:g.originCountry,value:g.value,currency:g.currency,positionCount:g.positionCount
  })));
  assert.equal(exported.totals.accountedTotal,reviewed.totals.accountedTotal);
  assert.equal(exported.totals.difference,reviewed.totals.difference);
});

test('RC1499 acceptance: unzugeordnete Position sperrt Abschlussdaten und Export',()=>{
  const pending=model.rebuildReviewedAnalysis({
    header:{invoiceNumber:'INV-PENDING',invoiceTotal:100,currency:'EUR'},
    positions:[{position:'10',description:'Offen',commodityCode:'',originCountry:'CN',value:100,currency:'EUR',confirmed:true,source:'scan.pdf'}]
  });
  assert.equal(pending.review.complete,false);
  assert.equal(pending.unassigned.length,1);
  assert.ok(pending.review.warnings.includes('unassigned-positions'));
  assert.throws(()=>exporter.createExportModel(pending),/ABD_EXPORT_NOT_READY/);
});
