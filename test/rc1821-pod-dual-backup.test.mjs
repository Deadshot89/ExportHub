import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {patchPodDualBackup} from '../scripts/rc1821-pod-dual-backup.mjs';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

function planner(html){
 const marker='function signedPodExpected(sh)',start=html.indexOf(marker),end=html.indexOf('function selection(){',start);
 assert.ok(start>=0&&end>start,'beide POD-Auswahlfunktionen müssen vorhanden sein');
 const ctx={
  window:{ExportHUBPickupPOD:{hasSignature:sh=>sh.digital===true}},
  hasSignature:sh=>sh&&sh.signaturePresent!==false,
  manualPodSource:sh=>sh.manual?{kind:'manual-uploaded-pod',name:'POD_TEST.pdf',url:'/api/manual'}:null,
  ref:()=> 'TEST',safe:s=>s,
  q:value=>String(value||'').trim(),
  arr:value=>Array.isArray(value)?value:[],
  realFile:f=>!!(f&&f.url)
 };
 return vm.runInNewContext(html.slice(start,end)+'\n({sourceList,signedPodExpected})',ctx);
}

test('RC1821: digital + manual erzeugt zwei separate PDF-Jobs, manual-only erzeugt keinen Phantom-POD',()=>{
 const output=patchPodDualBackup(read('index.html')),api=planner(output);
 const both=api.sourceList({digital:true,manual:true});
 assert.equal(both.length,2);
 assert.deepEqual(Array.from(both,x=>x.kind),['official-signed-loadlist','manual-uploaded-pod']);
 assert.deepEqual(Array.from(api.sourceList({manual:true}),x=>x.kind),['manual-uploaded-pod']);
 assert.deepEqual(Array.from(api.sourceList({digital:true}),x=>x.kind),['official-signed-loadlist']);
 assert.deepEqual(Array.from(api.sourceList({signaturePresent:false,manual:true})),[]);
 assert.deepEqual(Array.from(api.sourceList({manual:true,podFiles:[{kind:'automatic-pod',url:'/api/official.pdf'}]}),x=>x.kind),['official-signed-loadlist','manual-uploaded-pod']);
});
test('RC1821: in Produktion und TESTSERVICE nur gespeicherte Original-PDFs sichern',()=>{
 for(const env of ['index.html','TESTVERSION.html']){
  const source=read(env),output=patchPodDualBackup(source);
  assert.notEqual(output,source,env+' muss gepatcht werden');
  assert.equal(patchPodDualBackup(output),output,'Patcher ist idempotent');
  const start=output.indexOf('async function downloadAll(){'),end=output.indexOf("document.addEventListener('click'",start),download=output.slice(start,end);
  assert.match(download,/savedSignedPod\(sh\)/);
  assert.doesNotMatch(download,/localSignedPod\(sh\)/,'kein Neurender der digitalen Unterschrift');
  assert.match(download,/manualSuccess\+\+/);
  assert.match(download,/signedSuccess\+\+/);
  assert.match(download,/Vollständigkeit: /);
  assert.match(download,/VOLLSTÄNDIG/);
  assert.match(download,/UNVOLLSTÄNDIG/);
  assert.match(download,/return complete/);
  assert.match(download,/Erwartete POD-Dateien:/);
  assert.match(download,/Fehlende POD-Dateien:/);
 }
});
test('RC1821 Build: drei Umgebungen erhalten den unveränderten Original-POD-Gate',()=>{
 const builder=read('.github/rc1013/build-three-env.mjs');
 assert.match(builder,/import \{patchPodDualBackup\} from '\.\.\/\.\.\/scripts\/rc1821-pod-dual-backup\.mjs'/);
 assert.match(builder,/return patchPodDualBackup\(marker\(/);
 assert.match(builder,/const production=prepare\(/);
 assert.match(builder,/const testservice=prepare\(/);
 assert.match(builder,/const demo=prepare\(/);
});

test('RC1821: Erfolgs- und Fehlerprotokoll zählt nur wirklich gesicherte PDFs',async()=>{
 const patched=patchPodDualBackup(read('index.html'));
 const start=patched.indexOf('async function downloadAll(){'),end=patched.indexOf("document.addEventListener('click'",start);
 const fn=patched.slice(start,end);
 async function run(failOriginal){
  const button={disabled:false},status={className:'',textContent:''},bar={style:{width:''}};
  const jobs=[
   {sh:{ref:'ABC123'},src:{kind:'official-signed-loadlist'}},
   {sh:{ref:'ABC123'},src:{kind:'manual-uploaded-pod',name:'POD_ABC123.pdf'}}
  ];
  let archive=null;
  const context={
   syncPromise:null,syncServer:async()=>{},update:()=>({list:[{ref:'ABC123'}],jobs,from:'',to:''}),
   modal:()=>({querySelector:selector=>selector==='#rc422PodDownload'?button:selector==='#rc422PodStatus'?status:bar}),
   ref:sh=>sh.ref,q:value=>String(value||''),safe:value=>value,
   podDate:()=> '2026-11-05',VERSION:'RC1821',
   savedSignedPod:async()=>{if(failOriginal)throw new Error('Original nicht abrufbar');return{bytes:new Uint8Array([37,80,68,70])}},
   load:async()=>({ext:'pdf',bytes:new Uint8Array([37,80,68,70])}),
   zip:entries=>({size:200,entries}),
   saveBlob:out=>{archive=out},TextEncoder
  };
  const api=vm.runInNewContext(fn+'\n({downloadAll})',context);
  const complete=await api.downloadAll();
  const text=new TextDecoder().decode(archive.entries.find(e=>e.name==='POD_Sicherung_Protokoll.txt').data);
  return{complete,text,archive,status,button};
 }
 const good=await run(false);
 assert.equal(good.complete,true);
 assert.equal(good.archive.entries.length,3,'zwei PDFs und eine Protokolldatei');
 assert.match(good.text,/Gesicherte POD-Dateien: 2/);
 assert.match(good.text,/Davon manuell hochgeladen: 1/);
 assert.match(good.text,/Davon digital unterschriebene Ladelisten: 1/);
 assert.match(good.text,/Vollständigkeit: VOLLSTÄNDIG/);
 const partial=await run(true);
 assert.equal(partial.complete,false,'ein fehlendes Original darf nie als vollständig gelten');
 assert.equal(partial.archive.entries.length,2,'nur der manuelle POD und das Protokoll dürfen im Archiv stehen');
 assert.match(partial.text,/Erwartete POD-Dateien: 2/);
 assert.match(partial.text,/Gesicherte POD-Dateien: 1/);
 assert.match(partial.text,/Fehlende POD-Dateien: 1/);
 assert.match(partial.text,/Davon digital unterschriebene Ladelisten: 0/);
 assert.match(partial.text,/Vollständigkeit: UNVOLLSTÄNDIG/);
 assert.match(partial.status.textContent,/UNVOLLSTÄNDIG/);
 assert.equal(partial.button.disabled,false);
});
