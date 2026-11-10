// RC1343: synthetic JPEG/PDF roundtrip on one fixed isolated Azure preview host.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const host='ashy-grass-065b7b803-rc1343ts.westeurope.6.azurestaticapps.net';
const base='https://'+host;
const sha=String(process.env.RC1343_EXPECTED_SHA||'');
assert.match(sha,/^[0-9a-f]{40}$/i);
assert.equal(process.env.GITHUB_REPOSITORY,'Deadshot89/ExportHub');
assert.equal(process.env.GITHUB_REF,'refs/heads/fix/rc1903-remove-legacy-fields-all-internal-20261110');
const keyPath=process.env.RC1343_PREVIEW_KEY_FILE;
assert.ok(keyPath&&fs.existsSync(keyPath));
const key=fs.readFileSync(keyPath,'utf8').trim();
assert.match(key,/^[A-Za-z0-9_-]{40,80}$/);

async function request(method,action,data={},evidenceToken='',origin=base,withKey=true){
 const headers={Accept:'application/json','Cache-Control':'no-store',Origin:origin};
 if(withKey)headers['X-ExportHUB-RC1343-Test-Token']=key;
 if(evidenceToken)headers['X-ExportHUB-Evidence-Token']=evidenceToken;
 let url=base+'/api/shipment-evidence';
 const options={method,headers,redirect:'error',signal:AbortSignal.timeout(20000)};
 if(method==='GET')url+='?'+new URLSearchParams({action,...data});
 else{headers['Content-Type']='application/json';options.body=JSON.stringify({action,...data})}
 const r=await fetch(url,options);
 if(action==='public-file')return{status:r.status,bytes:Buffer.from(await r.arrayBuffer())};
 let body={};try{body=await r.json()}catch(_){}
 return{status:r.status,body};
}
const h=await fetch(base+'/api/exporthub-health?rc1343='+sha,{
 headers:{'Cache-Control':'no-store'},redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(h.status,200,'Preview health endpoint must be live');
const health=await h.json();
assert.equal(health.deployment?.verified,true);
assert.equal(health.deployment?.environment,'testservice');
assert.equal(health.deployment?.buildId,sha,'Wrong deployment SHA: refuse ALL writes');
const page=await fetch(base+'/?rc1343='+sha,{redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(page.status,200);
const html=await page.text();
assert.match(html,/eh1903-guest-root/);
assert.match(html,/\/assets\/shipment-evidence-guest\.js\?v=1907/);

const unauth=await request('GET','public-get',{id:'DOK-20000101-AAAAAAAA'},'',base,false);
assert.equal(unauth.status,403,'Preview key gate missing');
const master=await request('POST','public-customer-lookup',{customerNumber:'A0001'});
assert.equal(master.status,403,'Customer master exposed');
const isolation=await request('GET','public-get',{id:'DOK-20000101-AAAAAAAA'},'invalid');
assert.equal(isolation.status,404,'Separate TESTSERVICE storage not verified: refuse writes');

const fields={
 customer:'RC1343 SYNTHETIC TEST ONLY',
 shipmentNumber:'RC1343-'+crypto.randomBytes(5).toString('hex'),
 dispatchDate:new Date().toISOString().slice(0,10),
 colli:'1',weightKg:'0.250',remarks:'Synthetic isolated preview, NOT a shipment.',
 customerMode:'',exporthubRef:''
};
const cross=await request('POST','public-create',{fields,website:''},'','https://invalid-rc1343.example');
assert.equal(cross.status,403,'Cross-origin writes allowed');
const create=await request('POST','public-create',{fields,website:''});
assert.equal(create.status,201,'Create failed: '+String(create.body.code||create.body.message||create.status).slice(0,120));
const id=create.body.record?.id,token=create.body.publicToken;
assert.match(id,/^DOK-\d{8}-[A-F0-9]{8}$/);
assert.match(token,/^[A-Za-z0-9_-]{40,60}$/);
let revision=create.body.record.revision;
// Complete JPEG generated from a 1 x 1 pixel synthetic image.
const jpg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDBooor9APhz//Z','base64');
const pdf=Buffer.from('%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
for(const [kind,name,bytes] of [['foto','RC1343-test.jpg',jpg],['lieferschein','RC1343-test.pdf',pdf]]){
 const uploaded=await request('POST','public-upload',{id,expectedRevision:revision,kind,fileName:name,base64:bytes.toString('base64')},token);
 assert.equal(uploaded.status,200,'Upload failed: '+kind+' '+String(uploaded.body.code||uploaded.body.message||uploaded.status).slice(0,100));
 const file=(uploaded.body.record?.files||[]).find(f=>f.kind===kind&&f.size===bytes.length);
 assert.ok(file&&/^[0-9a-f-]{36}$/i.test(file.id),'Archive metadata mismatch');
 const read=await request('GET','public-file',{id,fileId:file.id},token);
 assert.equal(read.status,200,'Binary download failed');
 assert.deepEqual(read.bytes,bytes,'Stored JPEG/PDF bytes changed');
 const verify=await request('GET','public-get',{id},token);
 assert.equal(verify.status,200);
 assert.ok((verify.body.record?.files||[]).some(f=>f.id===file.id&&f.name===file.name&&f.size===bytes.length),'File not persisted');
 revision=verify.body.record.revision;
}
const submitted=await request('POST','public-submit',{id,expectedRevision:revision},token);
assert.equal(submitted.status,200);
assert.ok(submitted.body.record?.submittedAt);
const locked=await request('POST','public-upload',{id,expectedRevision:submitted.body.record.revision,kind:'foto',fileName:'late.jpg',base64:jpg.toString('base64')},token);
assert.equal(locked.status,403);
console.log('RC1343 isolated TESTSERVICE verified: synthetic 1px JPEG and PDF uploaded, exact binary readback, record persistence and security controls. No production writes.');
