import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const scenarioFile='assets/training-center/scenarios/first-shipment.js';
const runtimeFiles=[
  'assets/training-center/training-state.js',
  'assets/training-center/demo-adapter.js',
  'assets/training-center/training-write-guard.js',
  'assets/training-center/training-controller.js',
  'assets/training-center/target-registry.js',
  'assets/training-center/tour-engine.js',
  'assets/training-center/tour-ui.js',
  scenarioFile
];

async function boot(page){
  await page.setContent(`
    <main id="app">
      <button id="rc380NewShipment" data-training-target="shipment.new">Neue Sendung</button>
      <label>Kunde
        <select id="shipmentCustomerSearch" data-training-target="shipment.customer-search">
          <option value="">Bitte wählen</option>
          <option value="DEMO-CUST-001">Demo Kunde GmbH</option>
        </select>
      </label>
      <label>Empfänger
        <select id="index289LocationSelect" data-training-target="shipment.location">
          <option value="">Bitte wählen</option>
          <option value="DEMO-LOC-001">Demo Empfänger · Berlin</option>
        </select>
      </label>
      <label>Sendungsdaten <input id="trainingShipmentDetails" data-training-target="shipment.details" /></label>
      <section id="rc573ColliCard" data-training-target="shipment.colli"><label>Colli <input id="trainingColli" /></label></section>
      <section id="rc363WeightModal" data-training-target="shipment.weight"><label>Gewicht <input id="trainingWeight" /></label></section>
      <button id="rc363BlockDocuments" data-training-target="shipment.documents">Dokumente kontrollieren</button>
      <button id="trainingShipmentReview" data-training-target="shipment.review">Sendungsprüfung</button>
      <button id="rc363BlockAbdDecision" data-training-target="shipment.abd-decision" value="required">ABD erforderlich</button>
      <button id="trainingCustoms" data-training-target="shipment.customs">Zollinformationen prüfen</button>
      <button id="rc363SaveShipment" data-training-target="shipment.save">Sendung speichern</button>
      <button id="trainingShipmentStatus" data-training-target="shipment.status">Ergebnis kontrollieren</button>
    </main>
  `);
  await page.addStyleTag({content:read('assets/training-center/tour.css')});
  await page.evaluate(()=>{
    window.__trainingFetchCalls=[];
    window.__trainingStorageWrites=[];
    window.fetch=(...args)=>{window.__trainingFetchCalls.push(args.map(String));return Promise.resolve({ok:true,json:async()=>({})});};
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){window.__trainingStorageWrites.push({key:String(key),value:String(value)});return original.call(this,key,value);};
  });
  for(const file of runtimeFiles)await page.addScriptTag({content:read(file)});
  await page.evaluate(()=>{
    const keys=['shipment.new','shipment.customer-search','shipment.location','shipment.details','shipment.colli','shipment.weight','shipment.documents','shipment.review','shipment.abd-decision','shipment.customs','shipment.save','shipment.status'];
    const registry=window.ExportHubTrainingTargetRegistry.create();
    for(const key of keys)registry.register(key,root=>root.querySelectorAll(`[data-training-target="${key}"]`));
    const scenario=window.ExportHubTrainingScenarioFirstShipment;
    window.ExportHubTrainingController.start(scenario);
    window.__firstShipmentTour=window.ExportHubTrainingTourUi.mount({root:document.body,scenario,registry});
  });
}

async function expectStep(page,index,title){
  await expect(page.getByText(`Schritt ${index} von 13`)).toBeVisible();
  await expect(page.getByRole('heading',{name:title})).toBeVisible();
}

test('„Meine erste Sendung“ läuft über 13 reale Trainingsaktionen bis 100 % und speichert nur im Demo-State',async({page})=>{
  await boot(page);
  await expect(page.getByText('TRAININGSMODUS – KEINE PRODUKTIVDATEN')).toBeVisible();

  await expectStep(page,1,'Neue Sendung öffnen');
  await page.locator('#rc380NewShipment').click();
  await expectStep(page,2,'Demo-Kunden auswählen');
  await page.locator('#shipmentCustomerSearch').selectOption('DEMO-CUST-001');
  await expectStep(page,3,'Empfänger prüfen');
  await page.locator('#index289LocationSelect').selectOption('DEMO-LOC-001');
  await expectStep(page,4,'Sendungsdaten erfassen');
  await page.locator('#trainingShipmentDetails').fill('Demo Expresssendung');
  await expectStep(page,5,'Colli erfassen');
  await page.locator('#trainingColli').fill('1');
  await expectStep(page,6,'Gewicht erfassen');
  await page.locator('#trainingWeight').fill('12.5');
  await expectStep(page,7,'Dokumente kontrollieren');
  await page.locator('#rc363BlockDocuments').click();
  await expectStep(page,8,'Fehlendes Dokument erkennen');
  await page.locator('#rc363BlockDocuments').click();
  await expectStep(page,9,'Sendungsprüfung durchführen');
  await page.locator('#trainingShipmentReview').click();
  await expectStep(page,10,'Zoll-/ABD-Pflicht beurteilen');
  await page.locator('#rc363BlockAbdDecision').click();
  await expectStep(page,11,'Beispiel-Zollinformationen prüfen');
  await page.locator('#trainingCustoms').click();
  await expectStep(page,12,'Sendung fertigstellen');
  await page.locator('#rc363SaveShipment').click();
  await expectStep(page,13,'Ergebnis kontrollieren');
  await page.locator('#trainingShipmentStatus').click();

  await expect(page.getByText('100 %')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Training abgeschlossen'})).toBeVisible();

  const proof=await page.evaluate(()=>({
    tour:window.__firstShipmentTour.state(),
    state:window.ExportHubTrainingState.snapshot(),
    fetchCalls:window.__trainingFetchCalls.slice(),
    storageWrites:window.__trainingStorageWrites.slice()
  }));
  expect(proof.tour.finished).toBe(true);
  expect(proof.state.shipment.saved).toBe(true);
  expect(proof.state.shipment.id).toBe('DEMO-SHIP-001');
  expect(proof.fetchCalls).toEqual([]);
  expect(proof.storageWrites).toEqual([]);
});

test('Training-Ende und Reload lassen keine Demo-Sendung wiederauferstehen',async({page})=>{
  await boot(page);
  await page.evaluate(()=>window.ExportHubTrainingController.end());
  expect(await page.evaluate(()=>window.ExportHubTrainingState.snapshot())).toBe(null);
  expect(await page.evaluate(()=>window.__trainingFetchCalls.length)).toBe(0);
  expect(await page.evaluate(()=>window.__trainingStorageWrites.length)).toBe(0);

  await page.reload();
  await page.addScriptTag({content:read('assets/training-center/training-state.js')});
  expect(await page.evaluate(()=>window.ExportHubTrainingState.snapshot())).toBe(null);
});
