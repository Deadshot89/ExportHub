import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const doc=require('../api/shipment-documentation/index.js');
const refFiles=require('../api/reference-files/index.js');
const b64=bytes=>Buffer.from(bytes).toString('base64');

test('Sendungsdokumentation: REF muss genau 6 Zeichen haben',()=>{
 assert.equal(doc.reference(' abc123 '),'ABC123');
 for(const invalid of ['','AB12','ABC1234','A-B123','../../x','ABC 23'])assert.throws(()=>doc.reference(invalid));
});
test('Sendungsdokumentation: Felder sauber normalisiert',()=>{
 const x=doc.normalizeFields({shipmentNumber:' 123 ',customer:' Kunde ',dispatchDate:'2026-11-06',colli:' 6 ',weightKg:'125,500',contents:'Fragile Teile'});
 assert.equal(x.shipmentNumber,'123');
 assert.equal(x.customer,'Kunde');
 assert.equal(x.colli,'6');
 assert.equal(x.weightKg,'125.500');
 assert.equal(x.contents,'Fragile Teile');
 assert.equal(x.dispatchDate,'2026-11-06');
});
test('Sendungsdokumentation: ungueltige Werte werden nicht als Versandnachweis gespeichert',()=>{
 for(const x of [{colli:'-2'},{colli:'2.5'},{weightKg:'NaN'},{weightKg:'-5'},{dispatchDate:'morgen'}])assert.throws(()=>doc.normalizeFields(x));
 assert.throws(()=>doc.normalizeFields(null));
});
test('Kundenbeschwerden sind revisioniert und nur mit Login erreichbar',()=>{
 const api=fs.readFileSync('api/shipment-documentation/index.js','utf8');
 assert.match(api,/await auth\.validateSession\(req\)/);
 assert.match(api,/auth\.environmentFromRequest\(req\)/);
 assert.match(api,/expected!==existing\.record\.revision/);
 assert.match(api,/ifMatch:etag/);
 assert.match(api,/ifNoneMatch:'\*'/);
 assert.match(api,/action==='complaint'/);
 assert.match(api,/action==='complaint-status'/);
 assert.match(api,/history\.push\(event\)/);
 assert.match(api,/testservice\/shipment-documentation/);
 assert.match(api,/Content-Type.*application\/json/);
});
test('Fotos und Lieferscheine werden im bestehenden REF-Ordner gesichert und Lieferscheine umbenannt',()=>{
 const image=b64([0xff,0xd8,0xff,0xe0,0x00]);
 const photo=refFiles.documentUploadFile('ABC123',{kind:'sonstiges',fileName:'Versandfoto_Karton.jpg',data:image},new Date('2026-11-06T13:30:00Z'));
 const note=refFiles.documentUploadFile('ABC123',{kind:'lieferschein',fileName:'LS_4711.pdf',data:b64('%PDF-1.7\n')},new Date('2026-11-06T13:30:00Z'));
 assert.equal(photo.name,'Dokument_ABC123_20261106-133000_Versandfoto_Karton.jpg');
 assert.equal(note.name,'Lieferschein_ABC123_20261106-133000_LS_4711.pdf');
});
test('RC1860 ist in Haupt-Build und Sendungsansicht eingebunden',()=>{
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const ui=fs.readFileSync('assets/rc1860-shipment-documentation.js','utf8');
 const azure=JSON.parse(fs.readFileSync('api/shipment-documentation/function.json','utf8'));
 assert.match(build,/rc1860-shipment-documentation\.js\?v=1860/);
 assert.match(build,/'assets\/rc1860-shipment-documentation\.js'/);
 assert.match(ui,/getElementById\('rc786ReferenceFilesCard'\)/);
 assert.match(ui,/action:'complaint'/);
 assert.match(ui,/action:'save'/);
 assert.match(ui,/runtime\.upload\(ref,prepared,type==='photo'\?'sonstiges':'lieferschein'\)/);
 assert.equal(azure.bindings[0].type,'httpTrigger');
 assert.deepEqual(azure.bindings[0].methods,['get','post','options']);
});
