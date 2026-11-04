import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/pack-notification.js','utf8');

function row(type,dimensions){
 const fields=Object.fromEntries(Object.entries(dimensions).map(([key,value])=>[key,{value}]));
 return {fields,querySelector(selector){
  if(selector==='[data-pack-type]')return {value:type};
  return fields[selector.match(/data-dim="([^"]+)"/)?.[1]]||null;
 }};
}

function copy(rows,entries){
 let click,validations=0;
 const scope={
  els:{copyDimensions:{addEventListener:(event,handler)=>{assert.equal(event,'click');click=handler}}},
  packageRows:()=>rows,mergePackagingOptions:()=>entries,validateForm:()=>{validations++}
 };
 for(const [start,end] of [
  ['function normalizePackagingName(','function masterPackagingEntry('],
  ['function rowPackageEntry(','function packageSelectHtml('],
  ['if(els.copyDimensions)els.copyDimensions.addEventListener(','if(els.progress)']
 ]){
  const begin=source.indexOf(start),finish=source.indexOf(end,begin);
  assert.ok(begin>=0&&finish>begin,'Production handler and packaging lookup must be available');
  vm.runInNewContext(source.slice(begin,finish),scope);
 }
 click();
 return validations;
}

test('copy dimensions updates only the same canonical packaging type in mixed Collis',()=>{
 const dimensions={length:'120',width:'80',height:'150'};
 const rows=[row('Euro Pallet',dimensions),row('Carton',{length:'40',width:'30',height:'20'}),row('EURO-PALLET',{length:'121',width:'81',height:'151'})];
 assert.equal(copy(rows,[{id:'PALLET-1',label:'Euro Pallet'},{id:'CARTON-1',label:'Carton'}]),1);
 assert.deepEqual(Object.fromEntries(Object.entries(rows[1].fields).map(([key,input])=>[key,input.value])),{length:'40',width:'30',height:'20'});
 assert.deepEqual(Object.fromEntries(Object.entries(rows[2].fields).map(([key,input])=>[key,input.value])),dimensions);
});

test('copy dimensions cannot overwrite rows when the first packaging type is unresolved',()=>{
 const rows=[row('',{length:'120',width:'80',height:'150'}),row('Carton',{length:'40',width:'30',height:'20'})];
 copy(rows,[{id:'CARTON-1',label:'Carton'}]);
 assert.equal(rows[1].fields.length.value,'40');
 assert.equal(rows[1].fields.width.value,'30');
 assert.equal(rows[1].fields.height.value,'20');
});

test('copy dimensions supports catalog fallback types without IDs and skips unknown targets',()=>{
 const rows=[row('Euro Pallet',{length:'120',width:'80',height:'150'}),row('EURO-PALLET',{length:'1',width:'2',height:'3'}),row('Unknown',{length:'4',width:'5',height:'6'})];
 copy(rows,[{id:'',label:'Euro Pallet'}]);
 assert.equal(rows[1].fields.length.value,'120');
 assert.equal(rows[1].fields.width.value,'80');
 assert.equal(rows[1].fields.height.value,'150');
 assert.equal(rows[2].fields.length.value,'4');
 assert.equal(rows[2].fields.width.value,'5');
 assert.equal(rows[2].fields.height.value,'6');
});
