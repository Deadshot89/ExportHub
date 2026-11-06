import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const api=require('../api/quality-capa/index.js');
const {canRead,canEdit,canClose,newCase,updateCase,closeCase,reopenCase,cleanPatch,advice,relatedCases,recordsOf,validatedSnapshot,verifyChain,reportCase,addReportNote,withIntegrity,parseAttachment,addAttachment,canAttach,verifyAttachmentBytes}=api._test;
const admin={name:'QM Leitung',role:'Admin'};
const staff={name:'Warenausgang',role:'Mitarbeiter',rights:{sop:{level:'edit',read:true,edit:true}}};
const viewer={name:'Leser',role:'Mitarbeiter',rights:{sop:{level:'view',read:true}}};
const noAccess={name:'Extern',role:'Mitarbeiter',rights:{sop:{level:'none'}}};
function fresh(){return newCase({title:'Falsche Palette',description:'Eine falsche Palette stand an der Verladung',reference:'REF-TEST-01',category:'verladung',severity:'hoch'},staff)}
test('CAPA: role permissions are independently enforced by API',()=>{
 assert.equal(canRead(noAccess),false);
 assert.equal(canRead(viewer),true);assert.equal(canEdit(viewer),false);assert.equal(canClose(viewer),false);
 assert.equal(canEdit(staff),true);assert.equal(canClose(staff),false);
 assert.equal(canClose(admin),true);
});
test('CAPA: server owns IDs, status, revision and actor',()=>{
 const item=newCase({title:'Fehler',description:'Beschreibung',revision:98,status:'abgeschlossen',createdBy:'Fake'},staff);
 assert.match(item.id,/^QM-\d{8}-[0-9A-F]{8}$/);
 assert.equal(item.revision,1);assert.equal(item.status,'offen');assert.equal(item.createdBy,'Warenausgang');
 assert.equal(item.history[0].action,'ANGELEGT');
});
test('CAPA: validations and optimistic concurrency',()=>{
 assert.throws(()=>newCase({description:'Titel fehlt'},staff),/Pflicht/);
 assert.throws(()=>cleanPatch({category:'unbekannt'}),/Ungültige Auswahl/);
 assert.throws(()=>cleanPatch({dueDate:'morgen'}),/Datum/);
 assert.throws(()=>cleanPatch({occurredOn:'2026-02-30'}),/Datum/);
 const item=fresh();assert.throws(()=>updateCase(item,{revision:2,title:'neu'},staff),/inzwischen/);
 updateCase(item,{revision:1,status:'ursachenanalyse',rootCause:'Kein Scan vor Beladung'},staff);
 assert.equal(item.status,'ursachenanalyse');assert.equal(item.revision,2);
 assert.deepEqual(item.history.at(-1).changedFields.sort(),['rootCause','status']);
 assert.throws(()=>updateCase(item,{revision:2,status:'abgeschlossen'},staff),/nicht erlaubt/);
});
test('CAPA: closing is prohibited until root cause, action and effective evidence',()=>{
 const item=fresh();assert.throws(()=>closeCase(item,{revision:1},admin),/Abschluss erst/);
 updateCase(item,{revision:1,rootCause:'Fehlende Referenzkontrolle',correctiveAction:'Prüfung vor der Verladung',effectivenessResult:'unwirksam',verifiedOn:'2026-11-05',effectivenessEvidence:'Zwei weitere Fehler'},staff);
 assert.throws(()=>closeCase(item,{revision:2},admin),/Abschluss erst/);
 updateCase(item,{revision:2,effectivenessResult:'wirksam',effectivenessEvidence:'Zehn Verladungen ohne Wiederholung'},staff);
 closeCase(item,{revision:3},admin);
 assert.equal(item.status,'abgeschlossen');assert.equal(item.verifiedBy,'QM Leitung');
 assert.throws(()=>updateCase(item,{revision:4,title:'heimlich'},staff),/wieder öffnen/);
});
test('CAPA: reopening requires meaningful explanation and is logged',()=>{
 const item=fresh();
 Object.assign(item,{rootCause:'Grund',correctiveAction:'Maßnahme',effectivenessResult:'wirksam',effectivenessEvidence:'Nachweis',verifiedOn:'2026-11-05'});
 closeCase(item,{revision:1},admin);
 assert.throws(()=>reopenCase(item,{revision:2,reason:'nö'},admin),/Grund/);
 reopenCase(item,{revision:2,reason:'Wiederholung beim Kunden'},admin);
 assert.equal(item.status,'ursachenanalyse');assert.equal(item.closedAt,'');assert.equal(item.effectivenessResult,'offen');
 assert.equal(item.effectivenessEvidence,'');assert.equal(item.verifiedOn,'');assert.equal(item.history.at(-1).action,'WIEDEREROEFFNET');
});
test('CAPA: recommendations are rule based, shipment-specific and have no external dependency',()=>{
 const s=advice({title:'Palette falsch verladen',description:'Mehrfach passiert',severity:'hoch'});
 assert.ok(s.some(x=>/Verladefreigabe/.test(x.title)));
 assert.ok(s.some(x=>/Wiederholungsfehler/.test(x.title)));
 assert.ok(s.some(x=>/Verantwortliche/.test(x.title)));
});

test('CAPA: revising verified root cause or corrective measure resets proof and blocks closure',()=>{
 const item=fresh();
 updateCase(item,{revision:1,rootCause:'Ursache A',correctiveAction:'Scan A',effectivenessResult:'wirksam',effectivenessEvidence:'Prüfung A',verifiedOn:'2026-11-05',status:'wirksamkeitspruefung'},staff);
 assert.equal(item.effectivenessResult,'wirksam');
 updateCase(item,{revision:2,correctiveAction:'Scan B',effectivenessResult:'wirksam',effectivenessEvidence:'Prüfung A',verifiedOn:'2026-11-05'},staff);
 assert.equal(item.correctiveAction,'Scan B');
 assert.equal(item.effectivenessResult,'offen');
 assert.equal(item.effectivenessEvidence,'');
 assert.equal(item.verifiedOn,'');
 assert.equal(item.status,'massnahme');
 assert.ok(item.history.at(-1).changedFields.includes('effectivenessResult'));
 assert.throws(()=>closeCase(item,{revision:3},admin),/Abschluss erst/);
 updateCase(item,{revision:3,effectivenessResult:'wirksam',effectivenessEvidence:'Prüfung mit Scan B',verifiedOn:'2026-11-05',status:'wirksamkeitspruefung'},staff);
 closeCase(item,{revision:4},admin);
 assert.equal(item.status,'abgeschlossen');
});
test('CAPA: changed root cause after verification returns the case to analysis',()=>{
 const item=fresh();
 updateCase(item,{revision:1,rootCause:'Ursache A',correctiveAction:'Maßnahme A',effectivenessResult:'wirksam',effectivenessEvidence:'10 Fälle kontrolliert',verifiedOn:'2026-11-05',status:'wirksamkeitspruefung'},staff);
 updateCase(item,{revision:2,rootCause:'Ursache B'},staff);
 assert.equal(item.status,'ursachenanalyse');
 assert.equal(item.effectivenessResult,'offen');
 assert.equal(item.effectivenessEvidence,'');
 assert.equal(item.verifiedOn,'');
});
test('CAPA: related incidents show confirmed measures only when effectiveness was verified',()=>{
 const now=new Date().toISOString(),base=fresh();
 const prior={...fresh(),id:'QM-OLD',title:'Falsche Palette bei Verladung',category:'verladung',description:'Eine falsche Palette wurde geladen',status:'abgeschlossen',effectivenessResult:'wirksam',correctiveAction:'Scan bei Verladung',updatedAt:now};
 const open={...prior,id:'QM-OPEN',status:'massnahme',correctiveAction:'Nur ungeprüfter Entwurf'};
 const unrelated={...prior,id:'QM-OTHER',title:'Stromverbrauch am Standort',description:'Beleuchtung defekt',category:'umwelt',reference:'REF-OTHER-02',rootCause:''};
 const hits=relatedCases(base,[base,prior,open,unrelated]);
 assert.equal(hits.length,2);
 assert.equal(hits[0].verifiedMeasure,'Scan bei Verladung');
 assert.ok(hits.every(x=>x.id!=='QM-OTHER'&&x.id!==base.id));
 assert.equal(hits.find(x=>x.id==='QM-OPEN').verifiedMeasure,'');
});
test('CAPA: corrupted or unsupported blob data cannot silently become an empty case list',()=>{
 const valid=fresh();
 assert.deepEqual(recordsOf({schemaVersion:1,items:[valid]}),[valid]);
 assert.deepEqual(recordsOf({schemaVersion:1,items:[]}),[]);
 assert.throws(()=>recordsOf({schemaVersion:1,items:{}}),/Datenverlust/);
 assert.throws(()=>recordsOf({schemaVersion:2,items:[valid]}),/Datenverlust/);
 assert.throws(()=>recordsOf({schemaVersion:1,items:[null]}),/Datenverlust/);
 assert.throws(()=>recordsOf({schemaVersion:1,items:[{id:'QM-BROKEN'}]}),/Datenverlust/);
});
test('CAPA: existing JSON null must never become a writable empty list',()=>{
 const valid={schemaVersion:1,revision:1,items:[fresh()]};
 assert.equal(validatedSnapshot({etag:'etag-one',value:valid}).length,1);
 assert.deepEqual(validatedSnapshot({etag:null,value:{schemaVersion:1,revision:0,items:[]}}),[]);
 assert.throws(()=>validatedSnapshot({etag:'etag-existing',value:{schemaVersion:1,revision:0,items:[]}}),/Datenverlust/);
 assert.throws(()=>validatedSnapshot({etag:'etag-existing',value:{schemaVersion:1,items:[]}}),/Datenverlust/);
 assert.throws(()=>validatedSnapshot({etag:null,value:{schemaVersion:1,revision:-1,items:[]}}),/Datenverlust/);
});

test('CAPA: private evidence and incident storage is never part of shared shipment state',()=>{
 const apiSource=fs.readFileSync('api/quality-capa/index.js','utf8');
 assert.match(apiSource,/quality\/capa-cases\.json/);
 assert.doesNotMatch(apiSource,/team\.state\.qualityCases/);
 assert.match(apiSource,/requireRight\(canRead/);
 assert.match(apiSource,/requireRight\(canEdit/);
 assert.match(apiSource,/requireRight\(canClose/);
});

test('CAPA: release packages include the QM page in every permitted environment',()=>{
 const main=fs.readFileSync('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml','utf8');
 const prod=fs.readFileSync('.github/workflows/exporthub-production-release.yml','utf8');
 const exception=fs.readFileSync('.github/workflows/exporthub-testservice.yml','utf8');
 for(const [flow,target] of [[main,'.rc1112_testservice_app'],[prod,'.rc1112_production_app'],[exception,'.rc1112_testservice_app']]){
  assert.match(flow,new RegExp('cp dist-rc1112/pickup\\.html[^\\n]*dist-rc1112/qualitaet\\.html '+target.replaceAll('.','\\.')+'/'));
  assert.ok(flow.includes('test -s '+target+'/qualitaet.html'),'QM page must be verified in release package');
 }
 assert.ok(main.includes("      - 'qualitaet.html'"),'QM page-only change must trigger Main verification');
});

test('CAPA: release bundle includes page, server API and menu link',()=>{
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const menu=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
 const embeddedNav=fs.readFileSync('assets/pack-notification-nav.js','utf8');
 const page=fs.readFileSync('qualitaet.html','utf8');
 const fn=JSON.parse(fs.readFileSync('api/quality-capa/function.json','utf8'));
 assert.match(build,/fs\.copyFileSync\(qualityPage,path\.join\(OUT,'qualitaet\.html'\)\)/);
 assert.match(build,/quality-capa/);
 assert.match(menu,/ensureQualityLink\(\)/);
 assert.match(menu,/ExportHUBEmbeddedModules\.open\('quality'\)/,'QM menu must open inside ExportHUB360');
 assert.match(embeddedNav,/quality:\{path:'\/qualitaet\.html\?embedded=1'/,'QM page must be loaded from same-origin module allowlist');
 assert.doesNotMatch(menu,/location\.assign\(['"]\/qualitaet\.html/,'QM menu must not redirect the browser');
 assert.match(page,/\/api\/quality-capa/);
 assert.equal(fn.bindings[0].route,'quality-capa');
});
test('CAPA: unauthenticated calls never return cases',async()=>{
 const ctx={};await api(ctx,{method:'POST',headers:{},body:{action:'list'}});
 assert.equal(ctx.res.status,401);assert.equal(JSON.parse(ctx.res.body).ok,false);
});

test('CAPA: history is hash-chained, never truncated, and tampering is detected',()=>{
 const item=fresh();
 for(let i=0;i<40;i++)updateCase(item,{revision:item.revision,description:'Beschreibung '+i},staff);
 assert.equal(item.history.length,41,'Verlauf wird nicht mehr gekürzt');
 assert.deepEqual(item.history.map(e=>e.seq),Array.from({length:41},(_,i)=>i+1));
 assert.equal(item.history[0].prevHash,'GENESIS');
 assert.equal(item.history[1].prevHash,item.history[0].hash);
 assert.deepEqual(verifyChain(item.history),{ok:true,brokenAt:0,legacy:0});
 const edited=JSON.parse(JSON.stringify(item.history));edited[5].actor='Fremder';
 assert.equal(verifyChain(edited).ok,false);assert.equal(verifyChain(edited).brokenAt,6);
 const removed=JSON.parse(JSON.stringify(item.history));removed.splice(10,1);
 assert.equal(verifyChain(removed).ok,false);
 const reordered=JSON.parse(JSON.stringify(item.history));[reordered[3],reordered[4]]=[reordered[4],reordered[3]];
 assert.equal(verifyChain(reordered).ok,false);
});
test('CAPA: existing history without hashes is accepted as legacy prefix and extended with a chain',()=>{
 const item=fresh();item.history=[{at:'2026-10-01T10:00:00.000Z',action:'ANGELEGT',actor:'Alt',notes:'',changedFields:[]},{at:'2026-10-02T10:00:00.000Z',action:'AKTUALISIERT',actor:'Alt',notes:'',changedFields:['title']}];
 updateCase(item,{revision:1,title:'Neu'},staff);
 assert.equal(item.history.length,3);assert.equal(item.history[2].prevHash,'LEGACY');
 assert.deepEqual(verifyChain(item.history),{ok:true,brokenAt:0,legacy:2});
 const bad=JSON.parse(JSON.stringify(item.history));bad.splice(1,0,{at:'x',action:'X',actor:'Y',notes:'',changedFields:[]});
 assert.equal(verifyChain(bad).ok,false,'unverkettete Einträge nach verketteten sind nicht zulässig');
});
test('CAPA: a case with broken history cannot be modified until reviewed',()=>{
 const item=fresh();item.history[0].actor='Manipuliert';
 assert.throws(()=>updateCase(item,{revision:1,title:'x'},staff),/Verlauf/);
 assert.throws(()=>closeCase(item,{revision:1},admin),/Verlauf/);
 assert.equal(withIntegrity(item).historyIntegrity.ok,false);
});
test('CAPA: every authenticated employee can report, but only report-level fields are accepted',()=>{
 const plain={name:'Lager',user:'lager1',role:'Mitarbeiter',rights:{sop:{level:'none'}}};
 assert.equal(canRead(plain),false);
 const item=reportCase({title:'Falsche Ware',description:'Falsche Ware geladen',category:'verladung',rootCause:'erfunden',correctiveAction:'x',status:'abgeschlossen',effectivenessResult:'wirksam',owner:'Chef'},plain,[]);
 assert.equal(item.status,'offen');assert.equal(item.rootCause,'');assert.equal(item.correctiveAction,'');
 assert.equal(item.effectivenessResult,'');assert.equal(item.owner,'');
 assert.equal(item.createdBy,'Lager');assert.equal(item.createdByUser,'lager1');
 assert.equal(item.history[0].action,'GEMELDET');
});
test('CAPA: reporting is limited per user and per day',()=>{
 const plain={name:'Lager',user:'lager1',role:'Mitarbeiter'};
 const items=[];
 for(let i=0;i<20;i++)items.unshift(reportCase({title:'F'+i,description:'B'},plain,items));
 assert.throws(()=>reportCase({title:'Zu viel',description:'B'},plain,items),/Meldungen/);
 const other={name:'Anderer',user:'andere',role:'Mitarbeiter'};
 assert.ok(reportCase({title:'Ok',description:'B'},other,items));
});
test('CAPA: reporters may only add a note to their own still-open report',()=>{
 const plain={name:'Lager',user:'lager1',role:'Mitarbeiter'};
 const item=reportCase({title:'Falsche Ware',description:'B'},plain,[]);
 addReportNote(item,{note:'Es war Palette 3'},plain);
 assert.equal(item.history.at(-1).action,'ERGAENZT');assert.equal(item.history.at(-1).notes,'Es war Palette 3');
 assert.throws(()=>addReportNote(item,{note:'x'},{name:'Fremd',user:'fremd'}),/eigene/);
 assert.throws(()=>addReportNote(item,{note:''},plain),/Ergänzung/);
 item.status='ursachenanalyse';
 assert.throws(()=>addReportNote(item,{note:'spät'},plain),/offen/);
});

const PDF=Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF');
const PNG=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.alloc(16)]);
const JPG=Buffer.from([0xff,0xd8,0xff,0xe0,0,0,0,0]);
const upload=(name,buf)=>({fileName:name,data:buf.toString('base64')});
test('CAPA attachments: only PDF/JPG/PNG with matching content are accepted',()=>{
 assert.equal(parseAttachment(upload('Foto 1.PNG',PNG)).mime,'image/png');
 assert.equal(parseAttachment(upload('scan.jpeg',JPG)).mime,'image/jpeg');
 const pdf=parseAttachment(upload('Beleg.pdf',PDF));
 assert.equal(pdf.mime,'application/pdf');assert.equal(pdf.size,PDF.length);
 assert.match(pdf.sha256,/^[0-9a-f]{64}$/);
 assert.throws(()=>parseAttachment(upload('virus.exe',PDF)),/PDF, JPG oder PNG/);
 assert.throws(()=>parseAttachment(upload('fake.pdf',PNG)),/inhalt/i);
 assert.throws(()=>parseAttachment(upload('leer.pdf',Buffer.alloc(0))),/leer|ungültig/i);
 assert.throws(()=>parseAttachment({fileName:'a.pdf',data:'***'}),/ungültig/i);
 assert.throws(()=>parseAttachment(upload('gross.pdf',Buffer.concat([PDF,Buffer.alloc(15*1024*1024)]))),/15 MB/);
});
test('CAPA attachments: file names are sanitised, id and blob path are server-owned',()=>{
 const a=parseAttachment(upload('..\\..\\evil/name?.pdf',PDF));
 assert.doesNotMatch(a.name,/[\/?:*"<>|]/);
 assert.match(a.id,/^[0-9a-f]{16}$/);
 const item=fresh();addAttachment(item,a,staff);
 assert.match(item.attachments[0].blobPath,new RegExp('^quality/attachments/'+item.id+'/'+a.sha256+'\\.pdf$'));
 assert.equal(item.history.at(-1).action,'ANHANG');assert.equal(item.attachments[0].uploadedBy,'Warenausgang');
 assert.equal(item.revision,2);
});
test('CAPA attachments: duplicates are idempotent, limit is 10, closed or broken cases refuse',()=>{
 const item=fresh();const a=parseAttachment(upload('a.pdf',PDF));
 addAttachment(item,a,staff);const rev=item.revision;
 assert.equal(addAttachment(item,a,staff).attachments.length,1);assert.equal(item.revision,rev,'Duplikat ändert nichts');
 for(let i=0;i<9;i++)addAttachment(item,parseAttachment(upload('f'+i+'.pdf',Buffer.concat([PDF,Buffer.from(String(i))]))),staff);
 assert.equal(item.attachments.length,10);
 assert.throws(()=>addAttachment(item,parseAttachment(upload('elf.pdf',Buffer.concat([PDF,Buffer.from('elf')]))),staff),/10 Anhänge/);
 const closed=fresh();closed.status='abgeschlossen';
 assert.throws(()=>addAttachment(closed,a,staff),/abgeschlossen|öffnen/);
 const broken=fresh();broken.history[0].actor='X';
 assert.throws(()=>addAttachment(broken,a,staff),/Verlauf/);
});
test('CAPA attachments: who may attach and download integrity',()=>{
 const plain={name:'Lager',user:'lager1',role:'Mitarbeiter',rights:{sop:{level:'none'}}};
 const own=reportCase({title:'T',description:'B'},plain,[]);
 assert.equal(canAttach(own,plain),true,'Melder an eigener offener Meldung');
 assert.equal(canAttach(own,{name:'Fremd',user:'fremd'}),false);
 assert.equal(canAttach(own,staff),true,'Bearbeiter');
 own.status='ursachenanalyse';assert.equal(canAttach(own,plain),false);
 const a=parseAttachment(upload('a.pdf',PDF));
 assert.equal(verifyAttachmentBytes(a,PDF),true);
 assert.equal(verifyAttachmentBytes(a,Buffer.concat([PDF,Buffer.from('x')])),false);
});
