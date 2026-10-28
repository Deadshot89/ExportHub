import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;

function replacement(name){
 const rx=new RegExp('const '+name+'="([^"\\n]*)";');
 const match=build.match(rx);
 assert.ok(match,'release builder must contain the '+name+' replacement');
 return vm.runInNewContext('const text="'+match[1]+'";text');
}
const ready=replacement('readyNew');
const printing=replacement('printNew');

test('RC1698 P0: shipment 92PDZ6 can start loading-list and CMR printing while a delivery-note API request is still unresolved',async()=>{
 const events=[],shipment={ref:'92PDZ6'};
 let finishFetch;
 const blocked=new Promise(resolve=>{finishFetch=resolve});
 const stage=new AsyncFunction('sh','mode','ensureOutputReady','rc1340PrepareDeliveryAttachmentPrints','docWorkStep','opToken','q',ready+';return{attachmentJobsPromise};');
 const prepared=await stage(shipment,'all',async()=>{events.push('QR-checked');return true},async()=>{events.push('attachment-start');return blocked},()=>{},'op',v=>String(v??''));
 const prefix=printing.slice(0,printing.indexOf('if(attachmentJobs.length)'));
 assert.ok(prefix.includes('frame.contentWindow.print();var attachmentJobs=await attachmentJobsPromise;'),'main print must precede attachment wait');
 const execute=new AsyncFunction('frame','attachmentJobsPromise',prefix+';return attachmentJobs;');
 const frame={contentWindow:{focus(){events.push('focus')},print(){events.push('main-printed')}}};
 const task=execute(frame,prepared.attachmentJobsPromise);
 assert.ok(events.includes('main-printed'),'Ladeliste / CMR main print must open even when document API has not replied');
 assert.ok(!events.includes('attachment-finished'),'the blocked document cannot hold the printer');
 finishFetch([{name:'Verfuegbar.pdf',url:'blob:pdf'}]);
 const attachments=await task;
 assert.equal(attachments.length,1);
 assert.equal(shipment.ref,'92PDZ6');
 assert.ok(events.indexOf('main-printed')>=0);
});

test('RC1698 P0: Microsoft redirect of a delivery note is marked missing only after main documents have started printing',async()=>{
 const events=[],blocked=Object.assign(new Error('Microsoft login redirect'),{code:'AZURE_ROUTE_BLOCKED'});
 const stage=new AsyncFunction('sh','mode','ensureOutputReady','rc1340PrepareDeliveryAttachmentPrints','docWorkStep','opToken','q',ready+';return{attachmentJobsPromise};');
 const result=await stage({ref:'92PDZ6'},'all',async()=>true,async()=>{throw blocked},()=>{},'op',v=>String(v??''));
 const prefix=printing.slice(0,printing.indexOf('if(attachmentJobs.length)'));
 const execute=new AsyncFunction('frame','attachmentJobsPromise',prefix+';return attachmentJobs;');
 const frame={contentWindow:{focus(){events.push('focus')},print(){events.push('main-printed')}}};
 const output=await execute(frame,result.attachmentJobsPromise);
 assert.deepEqual(events,['focus','main-printed']);
 assert.equal(output.length,0);
 assert.equal(output.failed.length,1);
 assert.equal(output.failed[0].code,'AZURE_ROUTE_BLOCKED');
});

test('RC1698 P0: new or incomplete shipments must still pass document/QR readiness; cover-only never fetches delivery-note APIs',async()=>{
 const stage=new AsyncFunction('sh','mode','ensureOutputReady','rc1340PrepareDeliveryAttachmentPrints','docWorkStep','opToken','q',ready+';return{attachmentJobsPromise};');
 let fetched=0;
 await assert.rejects(()=>stage({ref:'92PDZ6'},'all',async()=>{throw new Error('QR registration not verified')},async()=>{fetched++;return[]},()=>{},'op',String),/QR registration not verified/);
 assert.equal(fetched,0,'no print or attachment API when authoritative QR check fails');
 const cover=await stage({ref:'92PDZ6'},'cover',async()=>true,async()=>{fetched++;return[]},()=>{},'op',String);
 assert.equal((await cover.attachmentJobsPromise).length,0);
 assert.equal(fetched,0);
 assert.match(build,/RC1698 Druck muss vor den Lieferschein-API-Abrufen starten/);
});
