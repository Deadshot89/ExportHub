import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const files=[
  'assets/training-center/i18n.js',
  'assets/training-center/target-registry.js',
  'assets/training-center/tour-engine.js',
  'assets/training-center/tour-ui.js'
];

async function boot(page){
  await page.setContent(`
    <html lang="de"><body><main id="app">
      <button id="step-one">Ziel Eins</button>
      <button id="step-two">Ziel Zwei</button>
      <button id="focus-return">Vorheriger Fokus</button>
    </main></body></html>
  `);
  await page.addStyleTag({content:read('assets/training-center/tour.css')});
  for(const file of files)await page.addScriptTag({content:read(file)});
  await page.evaluate(()=>{
    const registry=window.ExportHubTrainingTargetRegistry.create();
    registry.register('target.one',root=>root.querySelectorAll('#step-one'));
    registry.register('target.two',root=>root.querySelectorAll('#step-two'));
    document.querySelector('#step-one').setAttribute('data-training-target','target.one');
    document.querySelector('#step-two').setAttribute('data-training-target','target.two');
    const scenario={id:'tour-ui',steps:[
      {stepId:'s1',title:'Erster Schritt',targetElement:'target.one',expectedAction:'click',validation:[],helpText:'Klicke Ziel Eins',successText:'Eins erledigt',nextStep:'s2'},
      {stepId:'s2',title:'Zweiter Schritt',targetElement:'target.two',expectedAction:'click',validation:[],helpText:'Klicke Ziel Zwei',successText:'Zwei erledigt',nextStep:null}
    ]};
    document.querySelector('#focus-return').focus();
    window.__tour=window.ExportHubTrainingTourUi.mount({root:document.body,scenario,registry});
  });
}

test('Tour zeigt permanenten Trainingsbanner, Fortschritt und verdeckt das aktuelle Ziel nicht',async({page})=>{
  await boot(page);
  await expect(page.getByText('TRAININGSMODUS – KEINE PRODUKTIVDATEN')).toBeVisible();
  await expect(page.getByText('Alle Kunden, Sendungen, Dokumente und Zollinformationen dieser Tour sind Beispieldaten und werden nicht produktiv gespeichert.')).toBeVisible();
  await expect(page.getByText('Schritt 1 von 2')).toBeVisible();
  await expect(page.getByText('0 %')).toBeVisible();
  const target=await page.locator('#step-one').boundingBox();
  const panel=await page.locator('[data-training-tour-panel]').boundingBox();
  expect(target).toBeTruthy();
  expect(panel).toBeTruthy();
  const overlaps=!(panel.x+panel.width<=target.x||target.x+target.width<=panel.x||panel.y+panel.height<=target.y||target.y+target.height<=panel.y);
  expect(overlaps).toBe(false);
});

test('echter Klick auf korrektes Ziel avanciert; falsches Ziel nicht',async({page})=>{
  await boot(page);
  await page.locator('#step-two').click({force:true});
  await expect(page.getByText('Schritt 1 von 2')).toBeVisible();
  await page.locator('#step-one').click();
  await expect(page.getByText('Schritt 2 von 2')).toBeVisible();
  await expect(page.getByText('50 %')).toBeVisible();
});

test('Escape verlangt Bestätigung und Tour-Ende stellt vorherigen Fokus wieder her',async({page})=>{
  await boot(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/Training wirklich beenden/i)).toBeVisible();
  await page.getByRole('button',{name:/Abbrechen/i}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').getByRole('button',{name:'Tour beenden'}).click();
  await expect(page.locator('[data-training-tour-root]')).toHaveCount(0);
  await expect(page.locator('#focus-return')).toBeFocused();
});
