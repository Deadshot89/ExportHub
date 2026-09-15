import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1096-packaging-groups.js','utf8');
const builder=fs.readFileSync('.github/rc1048/build-three-env.mjs','utf8');

test('RC1096: Verpackungsauswahl wird in drei feste Gruppen gegliedert',()=>{
  assert.match(runtime,/\['packages','pallets','other'\]/);
  assert.match(runtime,/cat==='packages'\?'Pakete':cat==='pallets'\?'Paletten':'Sonstiges'/);
  assert.match(runtime,/rc1096-packaging-grid/);
  assert.match(runtime,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(runtime,/@media\(max-width:720px\)/);
});

test('RC1096: Verpackungsoptionen bleiben lesbar und werden nicht durch altes Grid zerlegt',()=>{
  assert.match(runtime,/display:block!important/);
  assert.match(runtime,/white-space:normal!important/);
  assert.match(runtime,/overflow-wrap:break-word!important/);
  assert.match(runtime,/min-width:0!important/);
  assert.match(runtime,/grid-template-columns:none!important/);
});

test('RC1096: E-Nummern gehören zu Pakete und Paletten werden separat erkannt',()=>{
  assert.match(runtime,/\^e\\s\*\\d\+/i);
  assert.match(runtime,/karton\|kartons\|paket\|pakete\|box\|boxes\|carton\|cartons/);
  assert.match(runtime,/palette\|palett\|pallet\|skid/);
});

test('RC1096: Umschlag ist eine echte native Verpackungsoption im finalen Build',()=>{
  assert.match(builder,/function patchPackagingGroups\(html,file\)/);
  assert.match(builder,/name:'Umschlag',l:0,w:0,h:0,ldm:0/);
  assert.match(builder,/sources\.push\(\[\{name:'Umschlag'/);
});

test('RC1096: Runtime wird in Produktion TESTSERVICE und Demo ausgeliefert',()=>{
  assert.match(builder,/RC1096_PACKAGING_TAG/);
  assert.match(builder,/rc1096-packaging-groups\.js\?v=1096/);
  assert.match(builder,/'assets\/rc1096-packaging-groups\.js'/);
  assert.match(builder,/packagingMenu:\{version:'RC1096'/);
  assert.match(builder,/columns:\['Pakete','Paletten','Sonstiges'\]/);
  assert.match(builder,/addsEnvelope:true/);
});
