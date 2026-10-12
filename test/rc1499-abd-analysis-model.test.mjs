import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const analysis=require('../api/shared/abd-analysis-model.js');

function pos(overrides={}){
 return Object.assign({position:'1',commodityCode:'39269097',originCountry:'DE',value:100,currency:'EUR',missing:[],warnings:[]},overrides);
}

test('RC1499 analysis model groups positions and reconciles invoice total',()=>{
 const out=analysis.buildAbdAnalysis({header:{invoiceNumber:'INV-1',invoiceTotal:150,currency:'EUR'},positions:[pos({value:100}),pos({position:'2',value:50})]});
 assert.equal(out.groups.length,1);
 assert.equal(out.unassigned.length,0);
 assert.equal(out.totals.invoiceTotal,150);
 assert.equal(out.totals.groupedTotal,150);
 assert.equal(out.totals.difference,0);
 assert.equal(out.review.complete,true);
});

test('RC1499 analysis model excludes unassigned positions from grouped total',()=>{
 const out=analysis.buildAbdAnalysis({header:{invoiceTotal:150,currency:'EUR'},positions:[pos({value:100}),pos({position:'2',commodityCode:'',value:50,missing:['commodityCode']})]});
 assert.equal(out.groups.length,1);
 assert.equal(out.unassigned.length,1);
 assert.equal(out.totals.groupedTotal,100);
 assert.equal(out.totals.difference,50);
 assert.equal(out.review.complete,false);
 assert.equal(out.review.missingHsCount,1);
});

test('RC1499 analysis model never reconciles incompatible currencies',()=>{
 const out=analysis.buildAbdAnalysis({header:{invoiceTotal:300,currency:'EUR'},positions:[pos({currency:'EUR',value:100}),pos({position:'2',currency:'USD',value:200})]});
 assert.equal(out.totals.groupedTotal,null);
 assert.equal(out.totals.difference,null);
 assert.equal(out.totals.currencyCompatible,false);
 assert.equal(out.review.complete,false);
 assert.ok(out.review.warnings.includes('currency-mismatch'));
});

test('RC1499 missing invoice total remains unknown and is never invented',()=>{
 const out=analysis.buildAbdAnalysis({header:{invoiceNumber:'INV-2',currency:'EUR'},positions:[pos()]});
 assert.equal(out.header.invoiceNumber,'INV-2');
 assert.equal(out.header.invoiceTotal,null);
 assert.equal(out.totals.invoiceTotal,null);
 assert.equal(out.totals.difference,null);
 assert.equal(out.review.complete,false);
});

test('RC1499 analysis rebuild reflects corrected HS origin and value deterministically',()=>{
 const input={header:{invoiceTotal:125,currency:'EUR'},positions:[pos({commodityCode:'39269097',originCountry:'DE',value:100}),pos({position:'2',commodityCode:'',originCountry:'DE',value:25,missing:['commodityCode']})]};
 const before=analysis.buildAbdAnalysis(input);
 assert.equal(before.groups.length,1);
 assert.equal(before.unassigned.length,1);
 assert.equal(before.totals.difference,25);
 const corrected=structuredClone(input);
 corrected.positions[1].commodityCode='39269097';
 corrected.positions[1].missing=[];
 const after=analysis.buildAbdAnalysis(corrected);
 assert.equal(after.groups.length,1);
 assert.equal(after.groups[0].value,125);
 assert.equal(after.unassigned.length,0);
 assert.equal(after.totals.difference,0);
 assert.equal(after.review.complete,true);
});
