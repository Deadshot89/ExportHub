import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const quick=fs.readFileSync('assets/rc1315-loading-list-quick-print.js','utf8');
const printRuntime=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function quickApi(){
  const document={
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null},
    querySelectorAll(){return[]},
    documentElement:{lang:'de'},
    head:{appendChild(){}},
    createElement(){return{style:{},setAttribute(){},appendChild(){},className:'',textContent:''}}
  };
  const window={
    document,
    addEventListener(){},
    setTimeout(){return 1},
    clearTimeout(){},
    console,
    location:{href:'https://www.exporthub360.de/'},
    MutationObserver:null
  };
  const context=vm.createContext({window,document,console,Map,Event:function(){},MutationObserver:null,URL,setTimeout,clearTimeout,Date});
  vm.runInContext(quick,context);
  return window.ExportHUBRC1315QuickPrint;
}

function printApi(){
  const document={
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null},
    documentElement:{},
    head:{appendChild(){}},
    createElement(tag){
      return{
        tagName:String(tag||'').toUpperCase(),
        id:'',
        className:'',
        textContent:'',
        style:{},
        setAttribute(){},
        appendChild(){},
        querySelector(){return null},
        querySelectorAll(){return[]}
      };
    }
  };
  const window={document,console,ExportHUBI18n:null};
  const context=vm.createContext({window,document,console,Array,Object,String,Number,Math,RegExp,Date});
  vm.runInContext(printRuntime,context);
  return window.ExportHUBRC1305LoadingListPrint;
}

test('RC1315: QR-/REF-Parser akzeptiert den dedizierten Druckcode und direkte REF',()=>{
  const api=quickApi();
  assert.equal(api.parseRef('EHPRINT:ABC123'),'ABC123');
  assert.equal(api.parseRef('EXPORTHUB-PRINT:XYZ999'),'XYZ999');
  assert.equal(api.parseRef('DEMO02'),'DEMO02');
  assert.equal(api.parseRef('https://www.exporthub360.de/?printRef=DEMO02'),'DEMO02');
  assert.equal(api.parseRef('https://www.exporthub360.de/?ref=ABC123'),'ABC123');
  assert.equal(api.parseRef('kein gueltiger code'),'');
});

test('RC1315: Druck-QR verwendet einen getrennten Payload und erzeugt echtes SVG',()=>{
  const api=printApi();
  assert.equal(api.printRef({ref:'abc123'}),'ABC123');
  assert.equal(api.printRef({ref:'ABC12'}),'');
  const svg=api.qrSvg('EHPRINT:ABC123');
  assert.match(svg,/^<svg\b/);
  assert.match(svg,/class="rc1315-qr-svg"/);
  assert.match(svg,/viewBox="0 0 29 29"/);
  assert.match(svg,/<path d="M/);
});

test('RC1366: Druck-QR liegt oben rechts direkt auf dem Deckblatt und bleibt 12mm groß',()=>{
  assert.doesNotMatch(printRuntime,/pickupSummary\(root,sh\|\|\{\}\);addQuickPrintQr/);
  assert.match(printRuntime,/function enhanceCover\(html,sh\)/);
  assert.match(printRuntime,/addQuickPrintQr\(root,sh\|\|\{\},true\)/);
  assert.match(printRuntime,/payload='EHPRINT:'\+ref/);
  assert.match(printRuntime,/rc1361-print-qr-top-right/); assert.match(printRuntime,/data-rc1361-print-qr-top-right/); assert.ok(printRuntime.includes("important(code,'width','12mm')"));
  assert.ok(printRuntime.includes("important(section,'top','8mm')"));
  assert.ok(printRuntime.includes("important(section,'right','8mm')"));
  assert.ok(printRuntime.includes("important(section,'box-sizing','border-box')"));
  assert.doesNotMatch(printRuntime,/rc1315-print-qr-in-ref/);
});

test('RC1315: Release-Build lädt Schnelldruck und reicht withQr an den Renderer weiter',()=>{
  assert.match(build,/assets\/rc1315-loading-list-quick-print\.js\?v=1322/);
  assert.match(build,/assets\/rc1305-loading-list-print\.js\?v=1385/);
  assert.match(build,/api\.enhance\(out,sh\|\|\{\},withQr===true\)/); assert.match(build,/api\.enhanceCover==='function'/);
  assert.match(build,/'assets\/rc1315-loading-list-quick-print\.js'/);
  assert.match(build,/loadingListQuickPrint:'RC1322/);
});

test('RC1315: Schnelldruck löst den vorhandenen Gesamtdruck aus statt eine zweite Drucklogik zu bauen',()=>{
  assert.match(quick,/\[data-index352-action="print-all"\]/);
  assert.match(quick,/btn\.click\(\)/);
  assert.doesNotMatch(quick,/window\.print\s*\(/);
  assert.match(quick,/addEventListener\('input'/);
  assert.match(quick,/EHPRINT\|EXPORTHUB-PRINT/);
  assert.match(quick,/setTimeout\(function\(\)\{scanTimer=0;trigger\(input\.value\)/);
  assert.match(quick,/keydown/);
  assert.match(quick,/e\.key!=='Enter'/);
});

test('RC1315: zentrale Sprachpakete enthalten alle Schnelldruck-Texte',()=>{
  const keys=[
    'loadingListQuickPrint.title',
    'loadingListQuickPrint.description',
    'loadingListQuickPrint.placeholder',
    'loadingListQuickPrint.button',
    'loadingListQuickPrint.ready',
    'loadingListQuickPrint.printing',
    'loadingListQuickPrint.invalid',
    'loadingListQuickPrint.missing',
    'loadingListQuickPrint.noPrint'
  ];
  for(const lang of ['de','en','pl','es','fr','it']){
    const pack=JSON.parse(fs.readFileSync('assets/i18n/'+lang+'.json','utf8'));
    for(const key of keys)assert.equal(typeof pack[key]==='string'&&pack[key].trim().length>0,true,lang+' fehlt '+key);
  }
});
