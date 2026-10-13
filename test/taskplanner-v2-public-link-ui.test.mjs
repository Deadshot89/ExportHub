import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

function load(){
  let queued=0;
  const context={console,Date,Intl,setTimeout,clearTimeout,TextEncoder,TextDecoder,crypto:crypto.webcrypto,location:{origin:'https://www.exporthub360.de'}};
  context.globalThis=context;
  context.ExportHUBClean={queueSave(){queued++;return true}};
  context.navigator={clipboard:{writes:[],async writeText(value){this.writes.push(value)}}};
  context.__queued=()=>queued;
  for(const file of ['assets/taskplanner-v2-core.js','assets/taskplanner-v2-recurrence.js','assets/taskplanner-v2-planner.js','assets/taskplanner-v2-ui.js','assets/taskplanner-v2-planner-ui.js']){
    vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
  }
  return context;
}

function task(){return{id:'T1',title:'Öffentliche Aufgabe',status:'open',priority:'P2',description:'Freigabe',customerName:'Kunde',plannedAt:'2026-10-12T09:00:00+02:00',dueAt:'2026-10-12T16:15:00+02:00',history:[],checklist:[{text:'Öffentlich',public:true,done:false}]}}

test('Planner exportiert funktionalen Public-Link-Action-Handler und persistiert über den vorhandenen ExportHUB-Savepfad',async()=>{
  const ctx=load(),ui=ctx.ExportHUBTaskUIV2,state={tasks:[task()]};let created=null;
  assert.equal(typeof ui.handlePublicLinkAction,'function');
  const result=await ui.handlePublicLinkAction('public-link-create','T1',{state,now:'2026-10-12T12:00:00+02:00',onPublicLinkCreated:value=>{created=value}});
  assert.equal(result.changed,true);
  assert.match(result.url,/^https:\/\/www\.exporthub360\.de\/task\?token=[a-f0-9]{64}$/i);
  assert.equal(ctx.__queued(),1,'ohne expliziten persist-Callback muss der vorhandene queueSave-Pfad genutzt werden');
  assert.equal(created.url,result.url);
  assert.equal(JSON.stringify(state).includes(result.token),false,'Roh-Token darf auch über UI-Aktion nicht in den State gelangen');
  assert.deepEqual(ctx.navigator.clipboard.writes,[result.url]);
});

test('Planner kann aktiven Public-Link über denselben Action-Pfad widerrufen',async()=>{
  const ctx=load(),ui=ctx.ExportHUBTaskUIV2,state={tasks:[task()]};
  await ui.handlePublicLinkAction('public-link-create','T1',{state,now:'2026-10-12T12:00:00+02:00'});
  const before=ctx.__queued(),revoked=await ui.handlePublicLinkAction('public-link-revoke','T1',{state,now:'2026-10-12T12:05:00+02:00'});
  assert.equal(revoked.changed,true);
  assert.equal(state.tasks[0].publicLink.revokedAt,'2026-10-12T12:05:00+02:00');
  assert.equal(ctx.__queued(),before+1);
});

test('Planner-Seite besitzt Detail-Host und delegierte Klickpfade für Öffnen, Erstellen und Widerrufen',()=>{
  const source=fs.readFileSync('assets/taskplanner-v2-planner-ui.js','utf8');
  assert.match(source,/data-tpv2-detail-host/);
  assert.match(source,/public-link-create/);
  assert.match(source,/public-link-revoke/);
  assert.match(source,/handlePublicLinkAction/);
  assert.match(source,/base\.renderDetail/);
  assert.match(source,/data-task-id/);
});
