import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');

function load(){
  const document={
    readyState:'loading',
    addEventListener(){},
    getElementById(){return null},
    querySelectorAll(){return[]},
    createElement(){return{setAttribute(){},appendChild(){},addEventListener(){},remove(){},style:{}}},
    body:{getAttribute(){return''},appendChild(){}},
    head:{appendChild(){}},
    documentElement:{appendChild(){}}
  };
  const sandbox={
    document,
    location:{href:'https://www.exporthub360.de/',hostname:'www.exporthub360.de'},
    setTimeout(){return 1},
    setInterval(){return 1},
    clearTimeout(){},
    addEventListener(){},
    dispatchEvent(){},
    CustomEvent:class{},
    __EXPORTHUB_GET_STATE__(){return{customers:[]}},
    ExportHUBCustomerAvis706:{link(sh){return sh&&sh.testAvisLink||''}},
    console:{warn(){}},
    URL,
    Date,
    Intl,
    Map,
    Set,
    Promise
  };
  sandbox.window=sandbox;
  vm.runInNewContext(runtime,sandbox,{filename:'rc1166-avis-reminder-overview.js'});
  return sandbox.ExportHUBRC1166AvisReminder;
}

test('RC1552: aktive AVIS-Links in Abholerinnerungen verwenden die kanonische .de-Domain',()=>{
  const api=load();
  const generated=api.avisLink({
    reference:'ABC123',
    customerName:'Testkunde',
    customerAvisToken:'abc',
    testAvisLink:'https://example.test/customer-avis.html?token=abc'
  });
  const legacy=api.avisLink({
    reference:'ABC123',
    customerName:'Testkunde',
    customerAvisToken:'legacy-token',
    customerAvisUrl:'https://exporthub360.com/avis/legacy-token'
  });

  assert.equal(generated,'https://www.exporthub360.de/avis/abc');
  assert.equal(legacy,'https://www.exporthub360.de/avis/legacy-token');
  assert.equal(generated.includes('exporthub360.com'),false);
  assert.equal(legacy.includes('exporthub360.com'),false);
});
