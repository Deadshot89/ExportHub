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
console.log('RC1810 Urgent Order '+target+' verified: 3 workspaces, guided steps and capability-scoped API 403');
