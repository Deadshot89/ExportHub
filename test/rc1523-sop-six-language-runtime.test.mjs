import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const LANGS=['de','en','pl','es','fr','it'];
const packs=Object.fromEntries(LANGS.map(lang=>[lang,JSON.parse(fs.readFileSync(`assets/i18n/${lang}.json`,'utf8'))]));

function interpolate(value,vars){
  return String(value??'').replace(/\{\{\s*([\w.-]+)\s*\}\}/g,(_,key)=>vars&&Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):'');
}
function i18n(lang){
  return {t(key,vars){return interpolate(packs[lang][key]??packs.de[key]??key,vars);}};
}
function load(rel,sandbox={}){
  const ctx={console,Intl,URL,setTimeout,clearTimeout,...sandbox};
  ctx.globalThis=ctx;
  vm.runInNewContext(fs.readFileSync(rel,'utf8'),ctx,{filename:rel});
  return ctx;
}

test('RC1523: alle SOPMaster-i18n-Keys sind in DE/EN/PL/ES/FR/IT identisch und nicht leer',()=>{
  const keys=Object.keys(packs.de).filter(key=>key.startsWith('sop.')).sort();
  for(const lang of LANGS){
    const langKeys=Object.keys(packs[lang]).filter(key=>key.startsWith('sop.')).sort();
    assert.deepEqual(langKeys,keys,`${lang}: SOP-Keymenge weicht ab`);
    for(const key of keys)assert.equal(typeof packs[lang][key]==='string'&&packs[lang][key].trim().length>0,true,`${lang}: leerer Wert ${key}`);
  }
});

test('RC1523: Tour und Prüfung rendern echte lokalisierte UI statt deutscher Fallbacks',()=>{
  for(const lang of LANGS){
    const ctx=load('assets/sop/rc1501-sop-tour-ui.js',{ExportHUBI18n:i18n(lang)});
    const exam=ctx.ExportHubSopTourUi.render({mode:'exam',status:'active',sopNumber:'SOP-X',title:'Test SOP',task:'',requiredSteps:[{id:'a'},{id:'b'}],correctSteps:[{id:'a'}],errors:[],skippedSteps:[],helpCount:0});
    assert.match(exam,new RegExp(packs[lang]['sop.exam.mode'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(exam,new RegExp(packs[lang]['sop.exam.requestHelp'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    if(lang!=='de')assert.doesNotMatch(exam,/PRÜFUNGSMODUS|Hilfe anfordern/);
    const tour=ctx.ExportHubSopTourUi.render({mode:'training',status:'active',sopNumber:'SOP-X',title:'',currentStep:{instruction:'Do it'},stepNumber:1,total:2,percent:50,index:0});
    assert.match(tour,new RegExp(packs[lang]['sop.training.mode'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(tour,new RegExp(packs[lang]['sop.tour.currentTask'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    if(lang!=='de')assert.doesNotMatch(tour,/TRAININGSMODUS|Aktuelle Aufgabe/);
  }
});

test('RC1523: Target-Picker rendert seine Bedienung in allen sechs Sprachen',()=>{
  for(const lang of LANGS){
    const base={renderDocument(){return'';},renderWorkspace(){return'';},mount(){return null;}};
    const ctx=load('assets/sop/rc1502-sop-target-picker-ui.js',{ExportHUBI18n:i18n(lang),ExportHubIsoSopUi:base});
    const html=ctx.ExportHubSopTargetPickerUi.targetStatusMarkup({target:{stableKey:''}});
    assert.match(html,new RegExp(packs[lang]['sop.target.title'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(html,new RegExp(packs[lang]['sop.target.select'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    if(lang!=='de')assert.doesNotMatch(html,/>Tourziel<|>Ziel auswählen</);
  }
});

test('RC1523: Coverage-Dashboard rendert Überschrift, Filterzustand und Leermeldung lokalisiert',()=>{
  for(const lang of LANGS){
    const ctx=load('assets/sop/rc1506-sop-coverage-dashboard.js',{ExportHUBI18n:i18n(lang)});
    const html=ctx.ExportHubSopCoverageDashboard.render({items:[],summary:{total:0,percentage:0,red:0,yellow:0,green:0,tour:0,image:0},options:{areas:[]},customers:[],context:{}},{});
    assert.match(html,new RegExp(packs[lang]['sop.coverage.title'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.match(html,new RegExp(packs[lang]['sop.coverage.noMatches'].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    if(lang!=='de')assert.doesNotMatch(html,/Abdeckungsquote|Keine SOPs für die gewählten Filter/);
  }
});
