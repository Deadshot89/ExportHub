import test from 'node:test';
import assert from 'node:assert/strict';
import Module,{createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);

function loadEndpoint({allowed=true}={}){
  const absolute=path.resolve('api/abd-analysis/index.js');
  const original=Module._load;
  const auth={
    async validateSession(){return{user:{id:'U1',rights:{abd:{edit:allowed}}}}},
    isAdmin(){return false},
    environmentFromRequest(){return'testservice'},
    body(req){return req.body||{}}
  };
  const i18n={t(_req,key){return key},tLang(_lang,key){return key}};
  Module._load=function(request,parent,isMain){
    if(request==='@azure/storage-blob')return{BlobServiceClient:{fromConnectionString(){throw new Error('storage must not be used by reanalyze')}}};
    if(request==='../shared/fast-auth-store')return auth;
    if(request==='../shared/i18n')return i18n;
    return original.call(this,request,parent,isMain);
  };
  delete require.cache[require.resolve(absolute)];
  let handler;
  try{handler=require(absolute)}finally{Module._load=original}
  async function call(body){
    const context={log:{error(){}},res:null};
    await handler(context,{method:'POST',headers:{},body});
    return{status:context.res.status,body:JSON.parse(context.res.body)};
  }
  return{call};
}

function position(overrides={}){
  return Object.assign({
    position:'1',description:'Teil',commodityCode:'39269097',originCountry:'DE',
    quantity:1,netMassKg:1,value:100,currency:'EUR',source:'invoice.pdf',sourceRow:1
  },overrides);
}

test('RC1499 API reanalyze rebuilds corrected groups without touching storage',async()=>{
  const fx=loadEndpoint();
  const res=await fx.call({
    action:'reanalyze',
    header:{invoiceNumber:'INV-9',invoiceTotal:150,currency:'EUR'},
    positions:[position(),position({position:'2',commodityCode:'83024900',originCountry:'PL',value:50,sourceRow:2})]
  });
  assert.equal(res.status,200);
  assert.equal(res.body.ok,true);
  assert.equal(res.body.status,'ready');
  assert.equal(res.body.analysis.groups.length,2);
  assert.equal(res.body.analysis.unassigned.length,0);
  assert.equal(res.body.analysis.totals.accountedTotal,150);
  assert.equal(res.body.analysis.totals.difference,0);
  assert.equal(res.body.analysis.review.complete,true);
});

test('RC1499 API reanalyze keeps suggested data pending until confirmed',async()=>{
  const fx=loadEndpoint();
  let res=await fx.call({action:'reanalyze',header:{invoiceTotal:100,currency:'EUR'},positions:[position({confirmed:false,warnings:['ocr-review-required']})]});
  assert.equal(res.status,200);
  assert.equal(res.body.analysis.groups.length,0);
  assert.equal(res.body.analysis.unassigned.length,1);
  assert.equal(res.body.analysis.review.complete,false);

  res=await fx.call({action:'reanalyze',header:{invoiceTotal:100,currency:'EUR'},positions:[position({confirmed:true,warnings:['ocr-review-required']})]});
  assert.equal(res.status,200);
  assert.equal(res.body.analysis.groups.length,1);
  assert.equal(res.body.analysis.unassigned.length,0);
  assert.equal(res.body.analysis.review.complete,true);
});

test('RC1499 API reanalyze remains protected by ABD edit permission',async()=>{
  const fx=loadEndpoint({allowed:false});
  const res=await fx.call({action:'reanalyze',header:{invoiceTotal:100,currency:'EUR'},positions:[position()]});
  assert.equal(res.status,403);
  assert.equal(res.body.code,'ABD_ANALYSIS_FORBIDDEN');
});

test('RC1499 API reanalyze rejects oversized correction payloads',async()=>{
  const fx=loadEndpoint();
  const positions=Array.from({length:501},(_,index)=>position({position:String(index+1),sourceRow:index+1}));
  const res=await fx.call({action:'reanalyze',header:{invoiceTotal:100,currency:'EUR'},positions});
  assert.equal(res.status,400);
  assert.equal(res.body.code,'ABD_REANALYZE_INVALID');
});
