import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const model=require('../api/shared/abd-analysis-model.js');

const legacy={
 positions:[
  {position:'1',invoiceNumber:'INV-42',commodityCode:'39269097',originCountry:'DE',value:100,currency:'EUR',missing:[],warnings:[]},
  {position:'2',invoiceNumber:'INV-42',commodityCode:'39269097',originCountry:'DE',value:50,currency:'EUR',missing:[],warnings:[]}
 ],
 totals:{value:150,netMassKg:12.5,grossMassKg:13.1},
 currencies:['EUR'],readyCount:2,reviewCount:0,fileName:'invoice.csv',fileType:'csv'
};

test('RC1499 envelope preserves legacy extraction data and adds grouped model',()=>{
 const out=model.enrichLegacyAnalysis(legacy,{invoiceTotal:150});
 assert.equal(out.positions,legacy.positions);
 assert.equal(out.fileName,'invoice.csv');
 assert.equal(out.totals.value,150,'legacy extracted value stays available');
 assert.equal(out.totals.netMassKg,12.5);
 assert.equal(out.header.invoiceNumber,'INV-42');
 assert.equal(out.header.currency,'EUR');
 assert.equal(out.groups.length,1);
 assert.equal(out.groups[0].value,150);
 assert.equal(out.totals.invoiceTotal,150);
 assert.equal(out.totals.groupedTotal,150);
 assert.equal(out.totals.difference,0);
});

test('RC1499 envelope does not invent ambiguous invoice number or currency',()=>{
 const out=model.enrichLegacyAnalysis({positions:[
  {...legacy.positions[0],invoiceNumber:'INV-A',currency:'EUR'},
  {...legacy.positions[1],invoiceNumber:'INV-B',currency:'USD'}
 ],totals:{value:150}},{});
 assert.equal(out.header.invoiceNumber,'');
 assert.equal(out.header.currency,'');
 assert.equal(out.totals.currencyCompatible,false);
 assert.equal(out.review.complete,false);
});
