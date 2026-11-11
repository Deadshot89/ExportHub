import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync(new URL('../scripts/rc1810-urgent-public-api-live.mjs',import.meta.url),'utf8');
const PAGE='<div id="tabNew"></div><div id="tabOpen"></div><div id="tabClosed"></div><div id="wizardNext"></div><div id="wizardBack"></div><div id="createPanel"></div><div id="listPanel"></div>';

async function execute({target='testservice',preflightStatus=200,ready=true,unknownIndices=[0],reviewIndices=[],checkedCount=0,privateField=false}={}){
 const calls=[],messages=[];
 const fetch=async(url,options={})=>{
  const address=String(url);
  if(address.includes('/urgent-order?'))return{status:200,text:async()=>PAGE};
  if(!address.includes('/api/urgent-order-public'))throw new Error('Unexpected destination');
  const request=JSON.parse(options.body||'{}');
  calls.push(request);
  if(request.action==='list')
   return{status:403,json:async()=>({ok:false,code:'URGENT_REPORTER_ACCESS_DENIED'})};
  if(request.action==='packing-preflight')
   return{status:preflightStatus,json:async()=>({
    ok:preflightStatus===200,environment:'testservice',ready,
    checkedCount,unknownIndices,reviewIndices,
    ...(privateField?{quantities:{private:1}}:{})
   })};
  throw new Error('Unexpected public API action: '+request.action);
 };
 const process={argv:['node','script',target,'SYNTHETIC-SHA']};
 const pending=vm.runInNewContext('(async()=>{'+script+'\n})()',{
  process,fetch,AbortSignal:{timeout:()=>undefined},console:{log:msg=>messages.push(msg)}
 },{timeout:5000});
 await pending;
 return{calls,messages};
}

test('RC2003: TESTSERVICE checks a private catalog using a synthetic SKU and never writes',async()=>{
 const result=await execute();
 assert.equal(result.calls.filter(x=>x.action==='packing-preflight').length,1);
 assert.equal(result.calls.filter(x=>x.action==='list').length,3);
 assert.equal(result.calls.length,4);
 const preflight=result.calls.find(x=>x.action==='packing-preflight');
 assert.deepEqual(JSON.parse(JSON.stringify(preflight.items)),[{
  article:'RC2003_TESTSERVICE_UNKNOWN_SKU_DO_NOT_IMPORT',quantity:1,minibag:false
 }]);
 assert.match(result.messages.join(' '),/RC2003.*read-only packing preflight/);
 assert.doesNotMatch(script,/action:'(?:create|import-packing-catalog)'/);
});

test('RC2003: missing imported catalog blocks TESTSERVICE release',async()=>{
 await assert.rejects(execute({ready:false}),/URGENT_PACKING_CATALOG_NOT_READY/);
});

test('RC2003: broken preflight endpoint or invalid unknown-item result blocks release',async()=>{
 await assert.rejects(execute({preflightStatus:500}),/URGENT_PACKING_PREFLIGHT_LIVE_FAILED/);
 await assert.rejects(execute({unknownIndices:[]}),/URGENT_PACKING_PREFLIGHT_CONTRACT_MISMATCH/);
 await assert.rejects(execute({checkedCount:1}),/URGENT_PACKING_PREFLIGHT_CONTRACT_MISMATCH/);
 await assert.rejects(execute({privateField:true}),/URGENT_PACKING_PREFLIGHT_DATA_EXPOSURE/);
});

test('RC2003: never probes the private packing catalog in production',async()=>{
 const result=await execute({target:'production'});
 assert.equal(result.calls.some(x=>x.action==='packing-preflight'),false);
});
