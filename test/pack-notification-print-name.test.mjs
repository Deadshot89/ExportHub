import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const printNames=fs.readFileSync('assets/document-print-name.js','utf8');

function api(){
  const document={
    readyState:'loading',addEventListener(){},getElementById(){return null},documentElement:{},
    head:{appendChild(){}},
    createElement(tag){return{tagName:String(tag||'').toUpperCase(),style:{},setAttribute(){},appendChild(){},querySelector(){return null},querySelectorAll(){return[]},className:'',textContent:''};}
  };
  const window={document,console,ExportHUBI18n:null,setTimeout(fn){fn();return 1;}};
  const context=vm.createContext({window,document,console,Array,Object,String,Number,Math,RegExp,Date,globalThis:window});
  vm.runInContext(runtime,context);
  vm.runInContext(printNames,context);
  return window.ExportHUBRC1305LoadingListPrint;
}

test('loading list and cover presentation hide .pdf only for canonical DNC and SIDE names',()=>{
  const print=api();
  const files=print.deliveryFiles({deliveryFiles:[
    {name:'DNC3019222063.pdf'},
    {name:'SIDE250071282.PDF'},
    {name:'Lieferschein Kunde.pdf'},
    {name:'DNC3019222063.pdf'}
  ]});
  assert.deepEqual(Array.from(files),['DNC3019222063','SIDE250071282','Lieferschein Kunde.pdf']);
});

test('print presentation does not mutate stored document metadata',()=>{
  const print=api();
  const document={name:'DNC3019222063.pdf',blobName:'rc1059/production/x',mimeType:'application/pdf'};
  const before=JSON.stringify(document);
  const files=print.deliveryFiles({deliveryFiles:[document]});
  assert.equal(files[0],'DNC3019222063');
  assert.equal(JSON.stringify(document),before);
});
