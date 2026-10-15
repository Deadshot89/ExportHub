import {test,expect} from '@playwright/test';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
const model=read('assets/training-center/model.js');
const store=read('assets/training-center/store.js');
const ui=()=>read('assets/training-center/ui.js');
const runtime=()=>read('assets/training-center/runtime.js');
const css=()=>read('assets/training-center/ui.css');

async function mount(page,design='classic'){
  await page.setContent(`<html data-eh-design="${design}"><head></head><body><main id="center"></main></body></html>`);
  await page.addStyleTag({content:css()});
  await page.addScriptTag({content:model});
  await page.addScriptTag({content:store});
  await page.addScriptTag({content:ui()});
  await page.addScriptTag({content:runtime()});
  await page.evaluate(()=>{
    const t=(key)=>({
      'trainingCenter.title':'SOP & Training Center',
      'trainingCenter.section.standard':'Standardprozesse',
      'trainingCenter.section.customer':'Kundenspezifische SOPs',
      'trainingCenter.section.training':'Interaktive Touren / Trainings',
      'trainingCenter.search':'SOP suchen',
      'trainingCenter.searchPlaceholder':'Prozess, Kunde oder Training suchen',
      'trainingCenter.categories':'Kategorien',
      'trainingCenter.allCategories':'Alle Kategorien',
      'trainingCenter.favorites':'Favoriten',
      'trainingCenter.recents':'Zuletzt verwendet',
      'trainingCenter.metadata.version':'Version',
      'trainingCenter.metadata.owner':'Verantwortlicher',
      'trainingCenter.metadata.changed':'Geändert',
      'trainingCenter.empty':'Keine Einträge',
      'trainingCenter.mobile.navigation':'Navigation'
    }[key]||key);
    const center={
      version:1,
      standardProcesses:[{id:'shipment-registration',title:'Sendung anmelden',categoryId:'shipping',version:'1.0',ownerUserId:'Tobias',changedAt:'2026-10-15T08:00:00Z'}],
      customerSops:[{id:'customer-wuerth',title:'Würth Industrie',baseProcessId:'shipment-registration',categoryId:'shipping',version:'1.0',ownerUserId:'Tobias',changedAt:'2026-10-15T08:00:00Z'}],
      trainings:[{id:'first-shipment',title:'Meine erste Sendung',categoryId:'training',version:'1.0',ownerUserId:'Tobias',changedAt:'2026-10-15T08:00:00Z'}],
      categories:[{id:'shipping',title:'Versand'},{id:'training',title:'Training'}],favorites:['shipment-registration'],recents:['first-shipment'],screenshots:[],learningProgress:[]
    };
    window.ExportHubTrainingCenterRuntime.mount(document.querySelector('#center'),{center,t});
  });
}

for(const design of ['classic','modern','glass','neon']){
  test(`Training Center Shell ist in ${design} responsiv und ohne horizontalen Overflow`,async({page})=>{
    await mount(page,design);
    await expect(page.locator('[data-training-center-shell]')).toBeVisible();
    await expect(page.getByRole('button',{name:'Standardprozesse'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Kundenspezifische SOPs'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Interaktive Touren / Trainings'})).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('Shell-Suche filtert Karten und Section-Tabs sind per Tastatur erreichbar',async({page})=>{
  await mount(page,'modern');
  const search=page.locator('[data-training-center-search]');
  await search.fill('nicht vorhanden');
  await expect(page.getByText('Sendung anmelden')).toHaveCount(0);
  await search.fill('Sendung');
  await expect(page.getByText('Sendung anmelden')).toBeVisible();

  const standard=page.getByRole('button',{name:'Standardprozesse'});
  const customer=page.getByRole('button',{name:'Kundenspezifische SOPs'});
  await standard.focus();
  await page.keyboard.press('ArrowRight');
  await expect(customer).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('button',{name:'Interaktive Touren / Trainings'})).toBeFocused();
});
