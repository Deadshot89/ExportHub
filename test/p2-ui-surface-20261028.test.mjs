import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(p,'utf8');

test('P2: Sprache wird trotz Capture-Guard im Benutzerprofil gespeichert',()=>{
 const core=read('assets/rc1267-i18n.js'),profile=read('assets/rc1079-profile-settings.js');
 assert.match(core,/stopImmediatePropagation/);
 assert.match(core,/exporthub:language-user-selected/);
 assert.match(profile,/addEventListener\('exporthub:language-user-selected'/);
 assert.match(profile,/saveProfile\(name,language\)/);
 assert.match(profile,/if\(n!=='exporthub:language-changed'\)applyProfileLanguage\(\)/);
});

test('P2: Sprachauswahl-UI fasst mehrfach eingehende Render-Events in einem Frame zusammen',()=>{
 const src=read('assets/rc1018-mail-language-standard.js');
 assert.match(src,/var refreshPending=false/);
 assert.match(src,/if\(refreshPending\)return/);
 assert.match(src,/requestAnimationFrame\(run\)/);
});

test('P2: Kunden-AVIS schont unveraendertes DOM und ignoriert alte Zeitfenster',()=>{
 const page=read('customer-avis.html');
 assert.match(page,/renderKey===lastAvisRenderKey&&host.firstChild/);
 assert.match(page,/key==='session'\|\|key==='sessionExpiresAt'/);
 assert.match(page,/requestId!==slotRequestSequence/);
 assert.match(page,/!customerUploadInteraction&&!appointmentInteraction\)render\(data\)/);
 assert.match(page,/setInterval\(function\(\)\{if\(!document.hidden&&session\)refresh\(\)\},15000\)/);
});

test('P2: offene Sendungen ohne Vollabholung, Teilabholung sichtbar, POD bleibt Aufgabe',()=>{
 const src=read('assets/rc1558-dashboard-overview.js');
 const w={document:undefined};
 vm.runInNewContext(src,{window:w,globalThis:w,console});
 const data=[
  {id:'OPEN',status:'Bereit zur Abholung'},
  {id:'PICKED',status:'Abgeholt'},
  {id:'PICKED_FLAG',status:'Erstellt',pickupConfirmed:true},
  {id:'PICKED_DATE',status:'Erstellt',actualPickupAt:'2026-10-28T14:00:00'},
  {id:'PARTIAL',status:'Teilabholung',pickedUp:true},
  {id:'POD',status:'POD vorhanden'},
  {id:'CANCELLED',status:'Storniert'}
 ];
 const api={shipmentOpenList:()=>data,taskOpenList:()=>[],dueTask:()=>false,shipmentNeedsDocuments:()=>false,shipmentNeedsPod:s=>s.id==='PICKED'};
 const model=w.ExportHUBDashboardOverview1558.buildModel(api,data,new Date('2026-10-28T12:00:00'));
 assert.deepEqual(Array.from(model.sets.open,s=>s.id),['OPEN','PARTIAL']);
 assert.equal(model.kpis.find(k=>k.id==='open').value,2);
 assert.deepEqual(Array.from(model.sets.pod,s=>s.id),['PICKED']);
 assert.equal(model.kpis.find(k=>k.id==='pod').value,1);
});
