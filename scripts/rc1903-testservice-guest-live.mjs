// RC1903: live writes are permitted ONLY on the dedicated TESTSERVICE host.
// This script is invoked after successful main TESTSERVICE deployment; never on production.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
const HOST='ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net';
const sha=String(process.env.RC1903_EXPECTED_SHA||'').trim();
assert.match(sha,/^[0-9a-f]{40}$/i,'A verified 40-character main deployment SHA is required');
const target=new URL(BASE);
assert.equal(target.hostname,HOST,'Refuse any non-TESTSERVICE host');
assert.equal(target.protocol,'https:');
const timeoutMs=20000;
const bytesJpg=Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x00]);
const bytesPdf=Buffer.from('%PDF-1.7\n1 0 obj\nendobj\n');
const api=new URL('/api/shipment-evidence',BASE);
// Match real browser API calls: no client-controlled environment header.
const noStore={'Accept':'application/json','Cache-Control':'no-store'};
// Root HTML is fingerprinted by RC1112 with ?v=...&h=<10 hex chars>.
// The independent /sendungsdokumentation page is not in the fingerprinted HTML list.
const ROOT_GUEST_ASSET=/\/assets\/shipment-evidence-guest\.js\?v=1907&h=[a-f0-9]{10}["']/;
const PUBLIC_GUEST_ASSET=/\/assets\/shipment-evidence-guest\.js\?v=1907["']/;
const safeError=(body)=>String(body?.code||body?.message||'NO_RESPONSE').slice(0,140);
async function request(method,action,data={},token=''){
 const headers={...noStore,'Origin':BASE};
 if(token)headers['X-ExportHUB-Evidence-Token']=token;
 let url=api.toString();
 const options={method,headers,redirect:'error',signal:AbortSignal.timeout(timeoutMs)};
 if(method==='GET')url+='?'+new URLSearchParams({action,...data});
 else{headers['Content-Type']='application/json';options.body=JSON.stringify({action,...data});}
 const response=await fetch(url,options);
 if(action==='public-file')return{status:response.status,data:Buffer.from(await response.arrayBuffer())};
 let payload={};try{payload=await response.json()}catch(_){}
 return{status:response.status,payload};
}
const health=await fetch(new URL('/api/exporthub-health?rc1903='+sha,BASE),{headers:noStore,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
assert.equal(health.status,200,'TESTSERVICE health endpoint must be available');
const healthData=await health.json();
assert.equal(healthData?.deployment?.environment,'testservice','Refuse non-TESTSERVICE deployment');
assert.equal(healthData?.deployment?.verified,true,'Deployment must be verified');
assert.equal(healthData?.deployment?.buildId,sha,'Deployment SHA mismatch; refuse any writes');
const root=await fetch(new URL('/?rc1903='+sha,BASE),{headers:noStore,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
assert.equal(root.status,200);
const html=await root.text();
assert.ok(ROOT_GUEST_ASSET.test(html),'Verified TESTSERVICE HTML must pin guest v1907 plus a content fingerprint');
const publicPage=await fetch(new URL('/sendungsdokumentation',BASE),{headers:noStore,redirect:'follow',signal:AbortSignal.timeout(timeoutMs)});
assert.equal(publicPage.status,200,'Public submission URL not reachable');
const publicHtml=await publicPage.text();
assert.ok(/id="eh1903-guest-root"/.test(publicHtml),'Public submission page missing its root');
assert.ok(PUBLIC_GUEST_ASSET.test(publicHtml),'Public evidence page still serves a stale upload runtime');
const noLogin=await request('GET','list');
assert.equal(noLogin.status,401,'Unauthenticated listing must fail');
const unique=crypto.randomBytes(5).toString('hex');
const fields={
 customer:'RC1903 TESTSERVICE AUTOMATION - TEST DATA ONLY',
 shipmentNumber:'E2E-RC1903-'+unique,
 dispatchDate:new Date().toISOString().slice(0,10),
 colli:'1',weightKg:'0.250',remarks:'Automated TESTSERVICE-only smoke test. Not a real shipment.'
};
const created=await request('POST','public-create',{fields,website:''});
assert.equal(created.status,201,'TESTSERVICE guest create: '+safeError(created.payload));
const {record:initial,publicToken:token}=created.payload;
assert.match(String(initial?.id||''),/^DOK-\d{8}-[A-F0-9]{8}$/);
assert.match(String(token||''),/^[A-Za-z0-9_-]{40,60}$/);
assert.ok(!('history' in initial),'Do not expose history to guests');
assert.ok(!('complaints' in initial),'Do not expose complaints to guests');
let current=initial;
for(const [kind,name,bytes] of [['foto','Test-Versandfoto.jpg',bytesJpg],['lieferschein','Test-Lieferschein.pdf',bytesPdf]]){
 const response=await request('POST','public-upload',{id:initial.id,expectedRevision:current.revision,kind,fileName:name,base64:bytes.toString('base64')},token);
 assert.equal(response.status,200,'TESTSERVICE upload '+kind+': '+safeError(response.payload));
 current=response.payload.record;
 const saved=current.files.find(file=>file.kind===kind);
 assert.ok(saved,'Uploaded '+kind+' missing in guest response');
 const read=await request('GET','public-file',{id:initial.id,fileId:saved.id},token);
 assert.equal(read.status,200,'TESTSERVICE file readback '+kind);
 assert.deepEqual(read.data,bytes,'TESTSERVICE bytes changed for '+kind);
}
// Verify the anonymously created documentation cannot be retrieved without its token.
const noToken=await request('GET','public-get',{id:initial.id});
assert.equal(noToken.status,403,'Missing guest token must not retrieve the created document');
// The anonymous update route must reject a foreign Origin before any write.
const wrongOrigin=await fetch(api,{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),
 headers:{...noStore,'Origin':'https://invalid-test-origin.example','Content-Type':'application/json',
  'X-ExportHUB-Evidence-Token':token},
 body:JSON.stringify({action:'public-upload',id:initial.id,expectedRevision:current.revision,kind:'foto',fileName:'Invalid-Origin.jpg',base64:bytesJpg.toString('base64')})
});
assert.equal(wrongOrigin.status,403,'Cross-origin anonymous update must be forbidden');
const submitted=await request('POST','public-submit',{id:initial.id,expectedRevision:current.revision},token);
assert.equal(submitted.status,200,'Public submission finalization failed: '+safeError(submitted.payload));
assert.ok(submitted.payload.record.submittedAt,'Submission status not persisted');
const locked=await request('POST','public-upload',{id:initial.id,expectedRevision:submitted.payload.record.revision,kind:'foto',fileName:'After-submit.jpg',base64:bytesJpg.toString('base64')},token);
assert.equal(locked.status,403,'Submitted public record must reject further uploads');
const fetched=await request('GET','public-get',{id:initial.id},token);
assert.equal(fetched.status,200);
assert.equal(fetched.payload.record.files.length,2);
assert.equal(fetched.payload.record.fields.shipmentNumber,fields.shipmentNumber);
const forbidden=await request('GET','public-get',{id:initial.id},'A'.repeat(43));
assert.equal(forbidden.status,403,'Incorrect token must not retrieve record');
const complaint=await request('POST','complaint',{id:initial.id,expectedRevision:current.revision,text:'unauthorized'});
assert.equal(complaint.status,401,'Guest must not create complaints');
console.log('RC1903 TESTSERVICE guest smoke succeeded; test-only documentation '+initial.id+'; two file readbacks and access restrictions verified');
