import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const i18n=read('assets/training-center/i18n.js');
const registry=read('assets/training-center/coverage-registry.js');
const coverage=read('assets/training-center/coverage.js');
const dashboard=read('assets/training-center/coverage-dashboard.js');
const css=read('assets/training-center/ui.css');

async function mount(page){
  await page.setContent('<html lang="de" data-eh-design="modern"><head></head><body><main id="coverage"></main></body></html>');
  await page.addStyleTag({content:css});
  await page.addScriptTag({content:i18n});
  await page.addScriptTag({content:registry});
  await page.addScriptTag({content:coverage});
  await page.addScriptTag({content:dashboard});
  await page.evaluate(()=>{
    const center={
      version:1,
      standardProcesses:[{
        id:'shipment-registration',title:'Sendung in ExportHUB360 anmelden',version:'1.0',status:'released',
        steps:[
          {stepId:'shipment-new',title:'Neue Sendung',shortInstruction:'Kurz',explanation:'Erklärung',purpose:'Zweck',checkpoints:['Prüfung'],commonErrors:['Fehler'],warnings:['Hinweis'],targetElement:'shipment.new',expectedAction:'click',validation:['ok'],helpText:'Hilfe',successText:'Erfolg',screenshotId:'shipment-new'},
          {stepId:'shipment-abd',title:'ABD prüfen',shortInstruction:'Kurz',explanation:'Erklärung',purpose:'Zweck',checkpoints:['Prüfung'],commonErrors:['Fehler'],warnings:['Hinweis'],targetElement:'shipment.abd-decision',expectedAction:'decision',validation:['ok'],helpText:'Hilfe',successText:'Erfolg',screenshotId:'shipment-abd'}
        ]
      }],
      customerSops:[{id:'customer-demo',customerId:'DEMO',customerName:'Demo Kunde GmbH',baseProcessId:'shipment-registration',status:'released'}],
      trainings:[{id:'first-shipment',processId:'shipment-registration',steps:[{stepId:'one',targetElement:'shipment.new'}]}],
      screenshots:[
        {id:'shipment-new',processId:'shipment-registration',stepId:'shipment-new',src:'/assets/training-center/screenshots/shipment-new.png'},
        {id:'shipment-abd',processId:'shipment-registration',stepId:'shipment-abd',src:'/assets/training-center/screenshots/shipment-abd.png'}
      ]
    };
    window.ExportHubTrainingCoverageDashboard.mount(document.querySelector('#coverage'),{center});
  });
}

test('Coverage behält KPI-, Filter- und Tabellenlayout ohne Seiten-Overflow',async({page})=>{
  await mount(page);
  await expect(page.getByRole('heading',{name:'SOP & Training Center Coverage'})).toBeVisible();
  await expect(page.locator('.training-coverage-kpi')).toHaveCount(6);
  await expect(page.locator('[data-coverage-filter]')).toHaveCount(4);
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('[data-kpi="rate"] strong')).toHaveText('8%');
  await expect(page.locator('[data-kpi="missing"] strong')).toHaveText('23');
  await expect(page.locator('[data-kpi="complete"] strong')).toHaveText('2');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('Status- und Fähigkeitsfilter funktionieren und lassen sich zurücksetzen',async({page})=>{
  await mount(page);
  const rows=page.locator('tbody [data-coverage-row]');
  await expect(rows).toHaveCount(25);
  await page.locator('[data-coverage-filter="status"]').selectOption('complete');
  await expect(rows).toHaveCount(2);
  await page.locator('[data-coverage-filter="capability"]').selectOption('tour');
  await expect(rows).toHaveCount(2);
  await page.locator('[data-coverage-reset]').click();
  await expect(rows).toHaveCount(25);
});
