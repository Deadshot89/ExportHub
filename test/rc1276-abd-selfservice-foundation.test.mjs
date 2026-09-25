import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function api(){
  const src=fs.readFileSync('assets/rc1276-abd-selfservice-foundation.js','utf8');
  const context={};
  context.globalThis=context;
  vm.runInNewContext(src,context,{filename:'assets/rc1276-abd-selfservice-foundation.js'});
  assert.ok(context.ExportHUBRC1276AbdSelfService,'RC1276 Foundation fehlt');
  return context.ExportHUBRC1276AbdSelfService;
}

test('RC1276 importiert die vorgesehenen Excel-Spalten positionsweise',()=>{
  const out=api().importRows([{
    POSITION:1,
    ARTIKELNUMMER:'A-100',
    WARENBESCHREIBUNG:'Kunststoff-Befestigungsteil',
    HS_CODE:'392690',
    WARENNUMMER_8:'39269097',
    HERKUNFTSLAND:'DE',
    BESTIMMUNGSLAND:'CH',
    WARENWERT:'1250,50',
    WAEHRUNG:'EUR',
    EIGENMASSE_KG:'100,2',
    ROHMASSE_KG:'110,5',
    PACKSTUECKART:'CT',
    PACKSTUECKE:4
  }]);
  assert.equal(out.length,1);
  assert.equal(out[0].positionNo,1);
  assert.equal(out[0].commodityCode8,'39269097');
  assert.equal(out[0].hsCode6,'392690');
  assert.equal(out[0].originCountry,'DE');
  assert.equal(out[0].destinationCountry,'CH');
  assert.equal(out[0].invoiceValue,1250.5);
  assert.equal(out[0].netMassKg,100.2);
  assert.equal(out[0].grossMassKg,110.5);
});

test('RC1276 akzeptiert sechsstelligen HS-Code nicht als vollständige Ausfuhr-Warennummer',()=>{
  const position=api().normalizePosition({
    WARENBESCHREIBUNG:'Teil',
    HS_CODE:'392690',
    HERKUNFTSLAND:'DE',
    WARENWERT:10,
    WAEHRUNG:'EUR',
    EIGENMASSE_KG:1
  },0);
  const check=api().validatePosition(position);
  assert.equal(position.hsCode6,'392690');
  assert.equal(position.commodityCode8,'');
  assert.equal(check.valid,false);
  assert.ok(check.issues.some(x=>x.code==='COMMODITY_CODE_REQUIRES_8_DIGITS'));
});

test('RC1276 erkennt widersprüchliche Gewichte',()=>{
  const a=api();
  const position=a.normalizePosition({
    WARENBESCHREIBUNG:'Teil',
    WARENNUMMER_8:'39269097',
    HERKUNFTSLAND:'DE',
    WARENWERT:10,
    WAEHRUNG:'EUR',
    EIGENMASSE_KG:5,
    ROHMASSE_KG:4,
    PACKSTUECKART:'CT',
    PACKSTUECKE:1
  },0);
  const check=a.validatePosition(position);
  assert.equal(check.valid,false);
  assert.ok(check.issues.some(x=>x.code==='GROSS_LT_NET'));
});

test('RC1276 behandelt Y- und Unterlagencodes immer als fachlich prüfpflichtig',()=>{
  const a=api();
  const position=a.normalizePosition({
    WARENBESCHREIBUNG:'Teil',
    WARENNUMMER_8:'39269097',
    HERKUNFTSLAND:'DE',
    WARENWERT:10,
    WAEHRUNG:'EUR',
    EIGENMASSE_KG:1,
    ROHMASSE_KG:2,
    PACKSTUECKART:'CT',
    PACKSTUECKE:1,
    Y_CODE:'Y901',
    UNTERLAGEN_CODE:'3LLD',
    UNTERLAGEN_REFERENZ:'NB-123'
  },0);
  const check=a.validatePosition(position);
  assert.deepEqual(Array.from(position.yCodes),['Y901']);
  assert.equal(position.supportingDocuments[0].reviewRequired,true);
  assert.ok(check.issues.some(x=>x.code==='SUPPORTING_CODES_NEED_REVIEW'&&x.severity==='review'));
});

test('RC1276 fasst Positionen zusammen, meldet aber keine Portalbereitschaft ohne valide Positionen',()=>{
  const a=api();
  const rows=a.importRows([
    {WARENBESCHREIBUNG:'A',WARENNUMMER_8:'39269097',HERKUNFTSLAND:'DE',WARENWERT:100,WAEHRUNG:'EUR',EIGENMASSE_KG:2,ROHMASSE_KG:3,PACKSTUECKART:'CT',PACKSTUECKE:1},
    {WARENBESCHREIBUNG:'B',WARENNUMMER_8:'',HERKUNFTSLAND:'DE',WARENWERT:50,WAEHRUNG:'EUR',EIGENMASSE_KG:1,ROHMASSE_KG:2,PACKSTUECKART:'CT',PACKSTUECKE:1}
  ]);
  const s=a.summarize(rows);
  assert.equal(s.positionCount,2);
  assert.equal(s.totals.invoiceValue,150);
  assert.equal(s.totals.netMassKg,3);
  assert.equal(s.readyForReview,false);
  assert.ok(s.errorCount>=1);
});

test('RC1276 Foundation ist nicht an Produktionsseiten verdrahtet',()=>{
  for(const file of ['index.html','TESTVERSION.html','demo.html','.github/rc1048/build-three-env.mjs']){
    const src=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(src,/rc1276-abd-selfservice-foundation\.js/i,file+' darf die Foundation noch nicht laden');
  }
});
