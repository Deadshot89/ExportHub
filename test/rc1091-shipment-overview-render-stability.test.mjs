import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1091: bestehende Sendungsmetadaten werden bei identischen Werten nicht erneut in den DOM geschrieben',()=>{
  const source=read('assets/rc1014-shipment-overview.js');
  let writes=0,appends=0;
  const created={_v:'Erfasst: 14.09.2026',get textContent(){return this._v},set textContent(v){writes++;this._v=String(v)}};
  const colli={_v:'Colli: 3',get textContent(){return this._v},set textContent(v){writes++;this._v=String(v)}};
  const row={querySelector(sel){if(sel==='.rc1014-shipment-created')return created;if(sel==='.rc1014-shipment-colli')return colli;return null}};
  const card={dataset:{shipment:'ABC123'},textContent:'ABC123',querySelector(sel){return sel==='[data-rc1014-shipment-meta]'?row:null},appendChild(){appends++},setAttribute(){}};
  const document={body:{getAttribute(name){return name==='data-exporthub-view'?'shipmentoverview':''}},querySelectorAll(){return[card]},createElement(){throw new Error('Bestehende Meta-Zeile darf nicht neu erstellt werden')}};
  const context={document,Date,console,setTimeout(fn){fn();return 1},clearTimeout(){},addEventListener(){}};context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'rc1014-shipment-overview.js'});
  const api=context.ExportHUBRC1014ShipmentOverview;
  assert.equal(api.enhanceShipmentOverview([{id:'ABC123',createdAt:'2026-09-14T08:00:00Z',totalColli:3}]),1);
  assert.equal(writes,0,'identische Metadaten dürfen keinen textContent-Write auslösen');
  assert.equal(appends,0,'bestehende Metadaten dürfen nicht erneut angehängt werden');
});

test('RC1091: Overview-Enhancer ist auf echte Sendungskarten begrenzt und unterdrückt direkten Render-Feedback',()=>{
  const source=read('assets/rc1014-shipment-overview.js');
  assert.doesNotMatch(source,/\[data-reference\],\.card/,'generische .card-Auswahl darf nicht mehr alle Karten der Ansicht scannen');
  assert.match(source,/__EXPORTHUB_RC1091_SHIPMENT_OVERVIEW_STABLE__/);
  assert.match(source,/Date\.now\(\)-lastMutationAt<750/);
  assert.match(source,/if\(!root\.document\|\|timer\)return false/);
});

test('RC1091: finaler RC1048-Build rendert Erfasst und Colli direkt in overviewCardHtml und bustet den Asset-Cache',()=>{
  const build=read('.github/rc1048/build-three-env.mjs');
  assert.match(build,/function patchShipmentOverviewInlineMeta\(/);
  assert.match(build,/rc1091MetaHtml/);
  assert.match(build,/data-rc1014-shipment-meta/);
  assert.match(build,/rc1014-shipment-overview\.js\?v=1091/);
  assert.match(build,/shipmentOverviewRenderStability:\{version:'RC1091'/);
  assert.match(build,/\['assets\/rc1014-shipment-overview\.js','assets\/rc1013-diagnostics\.js'/);
});

test('RC1091: Produktionsdeploy prüft den neuen Sendungsübersichts-Cache-Key',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/assets\/rc1014-shipment-overview\.js\?v=1091/);
  assert.doesNotMatch(flow,/dist-rc1048\/index\.html[^\n]*rc1014-shipment-overview\.js\?v=1016/);
});


test('RC1091: finaler Drei-Umgebungen-Build erzeugt die stabilisierte Übersicht ohne Generatorfehler',()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/assets\/rc1014-shipment-overview\.js\?v=1091/,file+': RC1091 Cache-Key fehlt');
    assert.match(html,/var rc1091OverviewApi=window\.ExportHUBRC1014ShipmentOverview/,file+': direkte Overview-Metadaten fehlen');
    assert.match(html,/\+rc1091MetaHtml\+/,file+': Metadaten werden nicht direkt in die Karte gerendert');
  }
  assert.match(read('dist-rc1048/assets/rc1014-shipment-overview.js'),/__EXPORTHUB_RC1091_SHIPMENT_OVERVIEW_STABLE__/);
});
