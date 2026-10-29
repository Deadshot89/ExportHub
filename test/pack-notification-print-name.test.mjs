import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const printNames=fs.readFileSync('assets/document-print-name.js','utf8');

function browserContext(){
  const document={
    readyState:'loading',addEventListener(){},getElementById(){return null},documentElement:{},
    head:{appendChild(){}},
    createElement(tag){return{tagName:String(tag||'').toUpperCase(),style:{},setAttribute(){},appendChild(){},querySelector(){return null},querySelectorAll(){return[]},className:'',textContent:''};}
  };
  const window={document,console,ExportHUBI18n:null,setTimeout(fn){fn();return 1;}};
  const context=vm.createContext({window,document,console,Array,Object,String,Number,Math,RegExp,Date,globalThis:window});
  return{window,document,context};
}

function runtimeOnlyApi(){
  const env=browserContext();
  vm.runInContext(runtime,env.context);
  return env.window.ExportHUBRC1305LoadingListPrint;
}

function api(){
  const env=browserContext();
  vm.runInContext(runtime,env.context);
  vm.runInContext(printNames,env.context);
  return env.window.ExportHUBRC1305LoadingListPrint;
}

test('RC1517: echte RC1305-Runtime dedupliziert DNC-Nummer und gleichnamige PDF ohne Wrapper',()=>{
  const print=runtimeOnlyApi();
  const files=print.deliveryFiles({
    deliveryFiles:[
      'DNC3019224495','DNC3019224498','DNC3019224501','DNC3019224518',
      'SalesPackingSlip-TobiasLimberg-83182_13102026_142333_312_83735_P.pdf',
      'SalesPackingSlip-TobiasLimberg-83182_13102026_142335_578_83950_P.pdf',
      'SalesPackingSlip-TobiasLimberg-83182_13102026_142337_515_83167_P.pdf',
      'SalesPackingSlip-TobiasLimberg-83182_13102026_142340_171_83041_P.pdf'
    ],
    deliveryNotesFiles:[
      'DNC3019224495.pdf','DNC3019224498.pdf','DNC3019224501.pdf','DNC3019224518.pdf'
    ]
  });
  assert.deepEqual(Array.from(files),[
    'DNC3019224495','DNC3019224498','DNC3019224501','DNC3019224518',
    'SalesPackingSlip-TobiasLimberg-83182_13102026_142333_312_83735_P.pdf',
    'SalesPackingSlip-TobiasLimberg-83182_13102026_142335_578_83950_P.pdf',
    'SalesPackingSlip-TobiasLimberg-83182_13102026_142337_515_83167_P.pdf',
    'SalesPackingSlip-TobiasLimberg-83182_13102026_142340_171_83041_P.pdf'
  ]);
});

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

test('P0 pack loading list ignores stale SalesPackingSlip text when stored delivery PDFs exist',()=>{
  const print=runtimeOnlyApi();
  const sh={
    id:'S1',ref:'ABC123',packNotificationId:'PN1',
    deliveryFiles:[{name:'DNC3019222063.pdf',storage:'blob',blobName:'rc1059/production/aa/'+('a'.repeat(64))}]
  };
  const stale='SalesPackingSlip-JolantaBatkowska-116394_28102026_100515_703_116963_P.pdf';
  assert.deepEqual(Array.from(print.deliveryFilesForPrint(sh,stale)),['DNC3019222063']);
  assert.deepEqual(Array.from(print.deliveryFilesForPrint({deliveryFiles:[]},stale)),[stale],
    'legacy shipments with no structured attachments must retain their printable fallback');
});
