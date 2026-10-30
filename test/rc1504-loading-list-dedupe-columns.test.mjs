import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/document-print-name.js','utf8');
const context={};
vm.runInNewContext(source,context,{filename:'assets/document-print-name.js'});
const api=context.ExportHUBDocumentPrintNames;

function gridHarness(labels){
  const inserted=[];
  const removedProperties=[];
  const attributes={};
  const items=labels.map(text=>({
    textContent:text,
    removed:false,
    classList:{contains(){return false;}},
    remove(){this.removed=true;}
  }));
  const grid={
    parentNode:{insertBefore(node){inserted.push(node);}},
    style:{removeProperty(name){removedProperties.push(name);}},
    querySelectorAll(){return items;},
    setAttribute(name,value){attributes[name]=String(value);}
  };
  const scope={querySelectorAll(){return[grid];},querySelector(){return null;}};
  const template={content:scope,_html:'',set innerHTML(value){this._html=String(value);},get innerHTML(){return this._html;}};
  const document={
    readyState:'complete',documentElement:{},addEventListener(){},
    createElement(tag){
      if(tag==='template')return template;
      if(tag==='style')return{attributes:{},textContent:'',setAttribute(name,value){this.attributes[name]=String(value);}};
      return{};
    }
  };
  const window={document};
  const browserContext=vm.createContext({window,document,console,Array,Object,String,Number,Math,RegExp,Date,globalThis:window});
  vm.runInContext(source,browserContext,{filename:'assets/document-print-name.js'});
  return{api:window.ExportHUBDocumentPrintNames,items,inserted,removedProperties,attributes};
}

test('RC1504: normale Lieferschein-PDFs behalten die Endung, DNC/SIDE nicht',()=>{
  assert.ok(api);
  assert.equal(api.printName('DNC3019222063.pdf'),'DNC3019222063');
  assert.equal(api.printName('SIDE250071282.pdf'),'SIDE250071282');
  assert.equal(api.printName('Lieferschein Kunde.pdf'),'Lieferschein Kunde.pdf');
});

test('RC1504: DNC-Nummer und gleichnamige PDF-Datei teilen denselben Deduplizierungs-Schluessel',()=>{
  assert.equal(typeof api.canonicalDeliveryKey,'function');
  assert.equal(api.canonicalDeliveryKey('DNC3019222063'),api.canonicalDeliveryKey('DNC3019222063.pdf'));
  assert.equal(api.canonicalDeliveryKey('/download/DNC3019222063.pdf?token=abc'),'dnc3019222063');
  assert.notEqual(api.canonicalDeliveryKey('Lieferschein A.pdf'),api.canonicalDeliveryKey('Lieferschein B.pdf'));
});

test('RC1504: Lieferscheine stehen zu zehnt pro Spalte nebeneinander',()=>{
  assert.equal(typeof api.documentColumnCount,'function');
  assert.equal(api.documentColumnCount(0),1);
  assert.equal(api.documentColumnCount(10),1);
  assert.equal(api.documentColumnCount(11),2);
  assert.equal(api.documentColumnCount(20),2);
  assert.equal(api.documentColumnCount(28),3);
  assert.equal(api.documentColumnCount(40),4);
});

test('Lieferscheine laufen in jeder Spalte von oben nach unten, die letzte Spalte bleibt kürzer',()=>{
  // 12 entries, 2 columns, 10 rows: row-major cells read 0,10 | 1,11 | 2,-1 ...
  const slots=Array.from(api.columnMajorSlots(12,2));
  assert.deepEqual(slots.slice(0,6),[0,10,1,11,2,-1]);
  assert.equal(slots.filter(x=>x>=0).length,12);
  assert.deepEqual(Array.from(api.columnMajorSlots(3,1)),[0,1,2]);
});

test('RC1504: Druck-Wrapper normalisiert das Dokumentraster vor der Bild-4-Wiederherstellung',()=>{
  assert.match(source,/function normalizeDeliveryGrid\(html\)/);
  assert.match(source,/restorePickupFields\(normalizeDeliveryGrid\(base\.enhance\(html,safe,withQr\)\),safe\)/);
  assert.match(source,/data-rc1504-document-columns/);
});

test('RC1504: zwei Spalten gelten nur im Druck und veraendern die Bildschirmansicht nicht',()=>{
  assert.match(source,/@media print\{/);
  assert.match(source,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.doesNotMatch(source,/grid\.style\.setProperty\('display','grid','important'\)/);
});

test('RC1504: Grid-Normalisierung entfernt DNC-Dubletten, behaelt normale PDF-Namen und laesst sechs Eintraege in einer Spalte',()=>{
  const h=gridHarness([
    'DNC3019222063.pdf','DNC3019222063',
    'Lieferschein 1.pdf','Lieferschein 2.pdf','Lieferschein 3.pdf','Lieferschein 4.pdf','Lieferschein 5.pdf'
  ]);
  h.api.normalizeDeliveryGrid('<div>print</div>');
  assert.equal(h.items.filter(item=>!item.removed).length,6);
  assert.equal(h.items[0].textContent,'DNC3019222063');
  assert.equal(h.items[1].removed,true);
  assert.equal(h.items[2].textContent,'Lieferschein 1.pdf');
  assert.equal(h.attributes['data-rc1504-document-columns'],'1');
  assert.ok(h.removedProperties.includes('display'));
  assert.ok(h.removedProperties.includes('flex-direction'));
  assert.ok(h.removedProperties.includes('align-items'));
  assert.equal(h.inserted.length,1);
  assert.match(h.inserted[0].textContent,/@media print\{/);
});
