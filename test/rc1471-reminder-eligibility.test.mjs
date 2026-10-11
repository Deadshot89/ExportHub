import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..');
const HOTFIX=path.join(ROOT,'scripts/rc1471-reminder-eligibility-hotfix.mjs');
const BEFORE="function reminderEligible(sh){if(!sh||isDone(sh)||sh.actualPickupDate||sh.pickedUpAt)return false;var d=shipmentPickup(sh);return !!d&&dayDiff(d,localISO())>0}";
const AFTER="function reminderEligible(sh){return !!sh&&!isDone(sh)&&!sh.actualPickupDate&&!sh.pickedUpAt}";

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'exporthub-rc1471-'));
  const dir=path.join(root,'.github/rc1112');
  fs.mkdirSync(dir,{recursive:true});
  const builderPath=path.join(dir,'build-three-env.mjs');
  fs.writeFileSync(builderPath,`function patchRc1470NewShipmentCleanSlate(html,file){return html}\nfunction patchTaskDetailTab(html,file){return html}\nexport function build(html,file){\n  html=patchRc1470NewShipmentCleanSlate(html,file);\n  return html;\n}\n`,'utf8');
  return {root,builderPath};
}

function apply(root){
  execFileSync(process.execPath,[HOTFIX],{cwd:root,stdio:'pipe'});
}

test('RC1471 hotfix wires the builder exactly once and is idempotent',async()=>{
  const {root,builderPath}=fixture();
  try{
    apply(root);
    apply(root);
    const source=fs.readFileSync(builderPath,'utf8');
    assert.equal(source.split('function patchRc1471ReminderEligibility(html,file){').length-1,1);
    assert.equal(source.split('html=patchRc1471ReminderEligibility(html,file);').length-1,1);
    const mod=await import(pathToFileURL(builderPath).href+'?t='+Date.now());
    const generated=mod.build(BEFORE,'TESTVERSION.html');
    assert.ok(generated.includes(AFTER));
    assert.ok(!generated.includes(BEFORE));
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
});

test('RC1471 keeps reminders visible for every open, not-yet-picked-up shipment',async()=>{
  const {root,builderPath}=fixture();
  try{
    apply(root);
    const mod=await import(pathToFileURL(builderPath).href+'?t='+(Date.now()+1));
    const generated=mod.build(BEFORE,'TESTVERSION.html');
    const match=generated.match(/function reminderEligible\(sh\)\{[^}]+\}/);
    assert.ok(match,'patched reminderEligible function missing');

    const cases=[
      null,
      {status:'Bereit zur Abholung'},
      {status:'Bereit zur Abholung',pickupDate:'2099-12-31'},
      {status:'Bereit zur Abholung',pickupDate:'2000-01-01'},
      {status:'Bereit zur Abholung',actualPickupDate:'2026-10-11'},
      {status:'Bereit zur Abholung',pickedUpAt:'2026-10-11T08:00:00Z'},
      {status:'Abgeschlossen'}
    ];
    const context={
      isDone(sh){return /abgeschlossen|archiviert|storniert|cancelled|canceled|done|closed/i.test(String(sh&&(sh.status||'')));},
      cases
    };
    vm.runInNewContext(`${match[0]}; results=cases.map(reminderEligible);`,context);
    assert.deepEqual(Array.from(context.results),[false,true,true,true,false,false,false]);
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
});
