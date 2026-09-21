import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1198-cover-only-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

test('RC1198: Nur-Deckblatt- und Nur-CMR-Aktionen sind vorhanden',()=>{
  assert.match(source,/Nur Deckblatt drucken/);
  assert.match(source,/Nur CMR drucken/);
  assert.match(source,/triggerCoverOnly/);
  assert.match(source,/triggerCmrOnly/);
  assert.match(source,/pendingMode==='cover'/);
  assert.match(source,/pendingMode==='cmr'/);
});

test('RC1198: Deckblatt wird deutlich kontrastreicher gebaut',()=>{
  assert.match(build,/border:14mm solid #061a3a!important/);
  assert.match(build,/border-top-width:24mm!important/);
  assert.match(build,/outline:3mm solid #facc15!important/);
  assert.match(build,/background:linear-gradient\(180deg,#08245d 0,#1d4ed8 58mm,#2563eb 118mm,#60a5fa 188mm,#bfdbfe 100%\)/);
  assert.match(build,/background:#facc15/);
});

test('RC1198: Empfängeradresse wird auf dem Deckblatt größer hervorgehoben',()=>{
  assert.match(source,/data-rc1198-recipient-highlight/);
  assert.match(source,/fontSize='22pt'/);
  assert.match(source,/fontSize='19pt'/);
  assert.match(source,/border='2\.5mm solid #061a3a'/);
  assert.match(source,/Empfänger\(\?:adresse\)\?|Lieferadresse|Recipient|Delivery address/);
});

test('RC1198: Runtime wird in alle drei Umgebungen eingebaut',()=>{
  assert.match(build,/assets\/rc1198-cover-only-print\.js\?v=1198/);
  assert.match(build,/'assets\/rc1198-cover-only-print\.js'/);
  assert.match(build,/coverOnlyPrint:'RC1198 dedicated Nur Deckblatt drucken action in shipment creation'/);
});

test('RC1198: Einzeldruck isoliert Deckblatt und CMR separat',()=>{
  const fakeNode=(className,text='')=>({
    className,textContent:text,style:{},attrs:{},
    cloneNode(){return fakeNode(className,text)},
    setAttribute(k,v){this.attrs[k]=v},
    querySelectorAll(){return[]},
    querySelector(){return null}
  });
  const cover=fakeNode('rc352-cover','Empfänger Test GmbH Hauptstraße 1');
  const cmr=fakeNode('rc390-cmr','CMR');
  const body={children:[],set innerHTML(v){this.children=[]},appendChild(n){this.children.push(n)}};
  const head={children:[],appendChild(n){this.children.push(n)}};
  const doc={
    body,head,
    createElement(){return{style:{},textContent:''}},
    querySelector(sel){if(sel.includes('rc352-cover'))return cover;return null},
    querySelectorAll(sel){
      if(sel.includes('rc352-cmr'))return[cmr];
      if(sel==='div,section,article,td,li')return[];
      return[]
    }
  };
  const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(){return null}};
  const window={document,addEventListener(){},setTimeout(){return 1},open(){return null}};
  vm.runInNewContext(source,{window,document,setTimeout:window.setTimeout,String,Array,Object,Date,console,MutationObserver:undefined});
  assert.equal(window.ExportHUBRC1198CoverOnly.isolateCoverInPrintWindow({document:doc}),true);
  assert.equal(body.children.length,1);
  body.children=[];
  assert.equal(window.ExportHUBRC1198CoverOnly.isolateCmrInPrintWindow({document:doc}),true);
  assert.equal(body.children.length,1);
});
