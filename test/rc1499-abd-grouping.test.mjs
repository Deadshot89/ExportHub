import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const grouping=require('../api/shared/abd-grouping.js');

function pos(overrides={}){
 return Object.assign({position:'1',commodityCode:'39269097',originCountry:'DE',value:100,currency:'EUR',missing:[],readyForReview:true},overrides);
}

test('RC1499: gleicher HS-Code und Ursprung bilden genau eine Gruppe und summieren den Warenwert',()=>{
 const out=grouping.groupPositionsByHsOrigin([pos({position:'1',value:100.10}),pos({position:'2',value:49.90})]);
 assert.equal(out.groups.length,1);
 assert.equal(out.groups[0].commodityCode,'39269097');
 assert.equal(out.groups[0].originCountry,'DE');
 assert.equal(out.groups[0].value,150);
 assert.equal(out.groups[0].positionRefs.length,2);
 assert.equal(out.unassigned.length,0);
});

test('RC1499: gleicher HS-Code mit anderem Ursprung bleibt getrennt',()=>{
 const out=grouping.groupPositionsByHsOrigin([pos({originCountry:'DE'}),pos({originCountry:'CN'})]);
 assert.equal(out.groups.length,2);
});

test('RC1499: anderer HS-Code mit gleichem Ursprung bleibt getrennt',()=>{
 const out=grouping.groupPositionsByHsOrigin([pos({commodityCode:'39269097'}),pos({commodityCode:'73181595'})]);
 assert.equal(out.groups.length,2);
});

test('RC1499: fehlende oder unbestätigte Zolldaten bleiben unassigned',()=>{
 const out=grouping.groupPositionsByHsOrigin([
  pos({commodityCode:'',missing:['commodityCode'],readyForReview:false}),
  pos({originCountry:'',missing:['originCountry'],readyForReview:false}),
  pos({value:null,missing:['value'],readyForReview:false}),
  pos({confirmed:false})
 ]);
 assert.equal(out.groups.length,0);
 assert.equal(out.unassigned.length,4);
});

test('RC1499: verschiedene Währungen werden niemals still summiert',()=>{
 const out=grouping.groupPositionsByHsOrigin([pos({currency:'EUR',value:100}),pos({position:'2',currency:'USD',value:200})]);
 assert.equal(out.groups.length,1);
 assert.equal(out.groups[0].value,null);
 assert.equal(out.groups[0].currency,'');
 assert.deepEqual(out.groups[0].valuesByCurrency,{EUR:100,USD:200});
 assert.ok(out.groups[0].warnings.includes('multiple-currencies'));
 assert.equal(out.groups[0].status,'review');
});

test('RC1499: Normalisierung ist deterministisch und erfindet keine Werte',()=>{
 assert.equal(grouping.normalizeCommodityCode('3926 90 97'),'39269097');
 assert.equal(grouping.normalizeOriginCountry(' de '),'DE');
 assert.equal(grouping.normalizeOriginCountry('Deutschland'),'DEUTSCHLAND');
 assert.equal(grouping.normalizeCommodityCode(''),'');
});
