import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs',import.meta.url),'utf8');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;

function template(name){
 const rx=new RegExp('const '+name+'="([^"\\n]*)";');
 const match=build.match(rx);
 assert.ok(match,'release builder must contain '+name);
 return vm.runInNewContext('const text="'+match[1]+'";text');
}
const readiness=template('printReadiness');
const printing=template('printFinish');

async function printDocuments(mode,verify){
 const events=[],win={},shipment={ref:'92PDZ6'},root={children:[{},{}]};
 const stage=new AsyncFunction('sh','ensureOutputReady','docWorkStep','opToken',readiness);
 await stage(shipment,verify||async()=>{events.push('QR-checked');return true},()=>events.push('ready'),'print');
 const frame={contentWindow:{focus(){events.push('focus')},print(){events.push('Ladeliste-CMR-printed')}}};
 const finish=new AsyncFunction('window','mode','root','sref','sid','VERSION','docWorkDone','opToken','frame','sh',printing+';return window.__INDEX352_LAST_PRINT__;');
 const result=await finish(win,mode,root,x=>x.ref,x=>x.id,'RC1710',()=>events.push('done'),'print',frame,shipment);
 return{events,result};
}

test('RC1710 P0: Ladeliste und CMR werden ohne Lieferschein-API oder zusätzlichen PDF-Druck geöffnet',async()=>{
 const {events,result}=await printDocuments('all');
 assert.deepEqual(events,['QR-checked','ready','done','focus','Ladeliste-CMR-printed']);
 assert.equal(result.ok,true);
 assert.equal(result.mode,'all');
 assert.equal(result.ref,'92PDZ6');
 assert.equal(result.pages,2);
 assert.equal('attachmentCount' in result,false,'print metadata must not imply that notes were printed');
});

test('RC1710 P0: fehlende oder zur Microsoft-Anmeldung umgeleitete Lieferscheine verhindern Ladelistendruck nicht',async()=>{
 const {events,result}=await printDocuments('all');
 assert.equal(result.ok,true);
 assert.equal(events.filter(x=>x==='Ladeliste-CMR-printed').length,1);
 assert.doesNotMatch(printing,/attachmentJobs|Lieferscheine|alert\(/);
 assert.doesNotMatch(readiness,/rc1340PrepareDeliveryAttachmentPrints|fetch\(|attachmentJobs/);
});

test('RC1710 P0: QR-Freigabe bleibt Pflicht und auch Nur-Deckblatt lädt keine Lieferscheine',async()=>{
 await assert.rejects(()=>printDocuments('all',async()=>{throw new Error('QR registration not verified')}),/QR registration not verified/);
 const cover=await printDocuments('cover');
 assert.equal(cover.result.mode,'cover');
 assert.deepEqual(cover.events,['QR-checked','ready','done','focus','Ladeliste-CMR-printed']);
 assert.match(build,/RC1710 Keine automatische Lieferschein-Abfrage beim Ladelisten-\/CMR-Druck/);
 assert.match(build,/window\.ExportHUBRC1340AttachmentPrint/,'separate explicit document function remains available');
});
