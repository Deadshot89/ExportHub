import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const api=require('../api/quality-capa/index.js');
const {canRead,canEdit,canClose,newCase,updateCase,closeCase,reopenCase,cleanPatch,advice,relatedCases,recordsOf}=api._test;
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
test('CAPA: private evidence and incident storage is never part of shared shipment state',()=>{
 const apiSource=fs.readFileSync('api/quality-capa/index.js','utf8');
 assert.match(apiSource,/quality\/capa-cases\.json/);
 assert.doesNotMatch(apiSource,/team\.state\.qualityCases/);
 assert.match(apiSource,/requireRight\(canRead/);
 assert.match(apiSource,/requireRight\(canEdit/);
 assert.match(apiSource,/requireRight\(canClose/);
});

test('CAPA: release bundle includes page, server API and menu link',()=>{
 const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
 const menu=fs.readFileSync('assets/rc1579-menu-redesign.js','utf8');
 const page=fs.readFileSync('qualitaet.html','utf8');
 const fn=JSON.parse(fs.readFileSync('api/quality-capa/function.json','utf8'));
 assert.match(build,/fs\.copyFileSync\(qualityPage,path\.join\(OUT,'qualitaet\.html'\)\)/);
 assert.match(build,/quality-capa/);
 assert.match(menu,/ensureQualityLink\(\)/);
 assert.match(menu,/\/qualitaet\.html/);
 assert.match(page,/\/api\/quality-capa/);
 assert.equal(fn.bindings[0].route,'quality-capa');
});
test('CAPA: unauthenticated calls never return cases',async()=>{
 const ctx={};await api(ctx,{method:'POST',headers:{},body:{action:'list'}});
 assert.equal(ctx.res.status,401);assert.equal(JSON.parse(ctx.res.body).ok,false);
});
