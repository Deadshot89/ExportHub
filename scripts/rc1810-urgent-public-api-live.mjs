// RC1810: read-only live Urgent Order gate. Never creates customer orders.
const target=process.argv[2]||'testservice';
const expectedBuild=process.argv[3]||'';
const hosts={
 testservice:'https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net',
 production:'https://wonderful-forest-0f315e310.7.azurestaticapps.net'
};
if(!Object.hasOwn(hosts,target))throw new Error('Unknown deployment target');
const base=hosts[target];
async function request(path,options={}){
 const response=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(18000),cache:'no-store',...options});
 return response;
}
const page=await request('/urgent-order?rc1810='+encodeURIComponent(expectedBuild));
if(page.status!==200)throw new Error('URGENT_PUBLIC_PAGE_UNAVAILABLE: HTTP '+page.status);
const html=await page.text();
for(const id of ['tabNew','tabOpen','tabClosed','wizardNext','wizardBack','createPanel','listPanel'])
 if(!html.includes('id="'+id+'"'))throw new Error('URGENT_PUBLIC_LAYOUT_STALE: '+id+' missing');
const payload={action:'list'}; // no token: API must reject with safe 403 after loading its storage
const r=await request('/api/urgent-order-public?rc1810='+encodeURIComponent(expectedBuild),{
 method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Origin':base,'Referer':base+'/urgent-order'},body:JSON.stringify(payload)
});
let data={};try{data=await r.json();}catch{throw new Error('URGENT_API_ROUTING_INVALID: non-JSON HTTP '+r.status);}
const code=String(data.code||'').replace(/[^A-Z0-9_]/g,'').slice(0,80);
if(r.status!==403||data.ok!==false||code!=='URGENT_REPORTER_ACCESS_DENIED'){
 throw new Error('URGENT_API_LIVE_GATE_FAILED: HTTP '+r.status+' code '+(code||'UNKNOWN')+' (expect 403 URGENT_REPORTER_ACCESS_DENIED)');
}
// Browser also enters the Urgent workflow from /test and an embedded iframe.
// Read-only capability rejection must still work with those legitimate referrers.
for(const referer of ['/test?v=1112','/assets/urgent-orders.html?embedded=1']){
 const result=await request('/api/urgent-order-public?rc1810='+encodeURIComponent(expectedBuild),{
  method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Origin':base,'Referer':base+referer},
  body:JSON.stringify({action:'list'})
 });
 let body={};try{body=await result.json();}catch{throw new Error('URGENT_API_ROUTING_INVALID: non-JSON HTTP '+result.status);}
 const code=String(body.code||'').replace(/[^A-Z0-9_]/g,'').slice(0,80);
 if(result.status!==403||body.ok!==false||code!=='URGENT_REPORTER_ACCESS_DENIED')
  throw new Error('URGENT_EMBEDDED_HOST_LIVE_GATE_FAILED: HTTP '+result.status+' code '+(code||'UNKNOWN')+' (expect 403 URGENT_REPORTER_ACCESS_DENIED)');
}
// RC2003: TESTSERVICE-only, read-only proof that the actual private packaging
// catalog has been loaded and the newly added preflight path is reachable.
// Use a deliberately non-existent synthetic SKU; do not query real item IDs,
// log response bodies or send an order creation/import request.
if(target==='testservice'){
 const sentinel='RC2003_TESTSERVICE_UNKNOWN_SKU_DO_NOT_IMPORT';
 const preflight=await request('/api/urgent-order-public?rc2003='+encodeURIComponent(expectedBuild),{
  method:'POST',
  headers:{'Content-Type':'application/json','Accept':'application/json',
   'Origin':base,'Referer':base+'/urgent-order'},
  body:JSON.stringify({action:'packing-preflight',items:[{
   article:sentinel,quantity:1,minibag:false
  }]})
 });
 let result={};
 try{result=await preflight.json();}catch{
  throw new Error('URGENT_PACKING_PREFLIGHT_LIVE_FAILED: non-JSON HTTP '+preflight.status);
 }
 const code=String(result.code||'').replace(/[^A-Z0-9_]/g,'').slice(0,80);
 if(preflight.status!==200||result.ok!==true||result.environment!=='testservice')
  throw new Error('URGENT_PACKING_PREFLIGHT_LIVE_FAILED: HTTP '+preflight.status+' code '+(code||'UNKNOWN'));
 if(result.ready!==true)
  throw new Error('URGENT_PACKING_CATALOG_NOT_READY: private catalog has no verified entries on TESTSERVICE');
 if(result.checkedCount!==0||
  !Array.isArray(result.unknownIndices)||result.unknownIndices.length!==1||result.unknownIndices[0]!==0||
  !Array.isArray(result.reviewIndices)||result.reviewIndices.length!==0)
  throw new Error('URGENT_PACKING_PREFLIGHT_CONTRACT_MISMATCH: synthetic unknown SKU was not classified safely');
 if(Object.hasOwn(result,'quantities')||Object.hasOwn(result,'packingQuantity')||Object.hasOwn(result,'catalog'))
  throw new Error('URGENT_PACKING_PREFLIGHT_DATA_EXPOSURE: unexpected private catalog data in public response');
 console.log('RC2003 Urgent Order TESTSERVICE verified: read-only packing preflight and non-empty private catalog');
}
console.log('RC1810 Urgent Order '+target+' verified: 3 workspaces, guided steps and capability-scoped API 403');
