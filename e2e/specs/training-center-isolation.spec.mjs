import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const stateSrc=()=>read('assets/training-center/training-state.js');
const demoSrc=()=>read('assets/training-center/demo-adapter.js');
const guardSrc=()=>read('assets/training-center/training-write-guard.js');
const controllerSrc=()=>read('assets/training-center/training-controller.js');

async function boot(page){
  await page.route('https://training.local/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<main id="app"></main>'}));
  await page.goto('https://training.local/');
  await page.evaluate(()=>{
    localStorage.setItem('productive-sentinel','keep-local');
    sessionStorage.setItem('productive-sentinel','keep-session');
    window.__productiveWrites=[];
  });
  await page.addScriptTag({content:stateSrc()});
  await page.addScriptTag({content:demoSrc()});
  await page.addScriptTag({content:guardSrc()});
  await page.addScriptTag({content:controllerSrc()});
}

test('Training business writes bleiben memory-only und verschwinden nach end/reload',async({page})=>{
  await boot(page);
  const result=await page.evaluate(()=>{
    const scenario={id:'first-shipment',demoSeed:{shipment:{id:'DEMO-SHIPMENT',status:'Entwurf'},documents:[],abdRequests:[]}};
    window.ExportHubTrainingController.start(scenario);
    window.ExportHubTrainingWriteGuard.execute({mode:'training',operation:'shipment.save',payload:{id:'DEMO-SHIPMENT',status:'Erstellt'}});
    window.ExportHubTrainingWriteGuard.execute({mode:'training',operation:'document.add',payload:{id:'DEMO-DOC'}});
    window.ExportHubTrainingWriteGuard.execute({mode:'training',operation:'abd.save',payload:{id:'DEMO-ABD'}});
    const beforeEnd=window.ExportHubTrainingState.snapshot();
    window.ExportHubTrainingController.end();
    return {beforeEnd,afterEnd:window.ExportHubTrainingState.snapshot(),local:localStorage.getItem('productive-sentinel'),session:sessionStorage.getItem('productive-sentinel')};
  });
  expect(result.beforeEnd.shipment.status).toBe('Erstellt');
  expect(result.beforeEnd.documents).toEqual([{id:'DEMO-DOC'}]);
  expect(result.beforeEnd.abdRequests).toEqual([{id:'DEMO-ABD'}]);
  expect(result.afterEnd).toBeNull();
  expect(result.local).toBe('keep-local');
  expect(result.session).toBe('keep-session');

  await page.reload();
  expect(await page.evaluate(()=>localStorage.getItem('productive-sentinel'))).toBe('keep-local');
  expect(await page.evaluate(()=>sessionStorage.getItem('productive-sentinel'))).toBe('keep-session');
  expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('DEMO-SHIPMENT');
  expect(await page.evaluate(()=>JSON.stringify(sessionStorage))).not.toContain('DEMO-SHIPMENT');
});

test('produktiver Callback kann im Trainingsmodus nicht ausgelöst werden',async({page})=>{
  await boot(page);
  const proof=await page.evaluate(()=>{
    window.ExportHubTrainingController.start({id:'first-shipment',demoSeed:{shipment:{id:'DEMO-SHIPMENT'}}});
    let message='';
    try{
      window.ExportHubTrainingWriteGuard.execute({mode:'training',operation:'shipment.save',payload:{id:'DEMO-SHIPMENT'},productive:()=>{window.__productiveWrites.push('CALLED');}});
    }catch(error){message=String(error&&error.message||error);}
    const calls=window.__productiveWrites.slice();
    window.ExportHubTrainingController.end();
    return {message,calls};
  });
  expect(proof.message).toContain('TRAINING_PRODUCTIVE_WRITE_BLOCKED');
  expect(proof.calls).toEqual([]);
});
