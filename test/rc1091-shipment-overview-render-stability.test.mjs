import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createTestI18n} from './helpers/i18n.mjs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1091: bestehende Sendungsmetadaten werden bei identischen Werten nicht erneut in den DOM geschrieben',()=>{
  const source=read('assets/rc1014-shipment-overview.js');
  let writes=0,appends=0;
  const created={_v:'Erfasst: 14.09.2026',get textContent(){return this._v},set textContent(v){writes++;this._v=String(v)}};
  const colli={_v:'Colli: 3',get textContent(){return this._v},set textContent(v){writes++;this._v=String(v)}};
  const row={querySelector(sel){if(sel==='.rc1014-shipment-created')return created;if(sel==='.rc1014-shipment-colli')return colli;return null}};
  const card={dataset:{shipment:'ABC123'},textContent:'ABC123',querySelector(sel){return sel==='[data-rc1014-shipment-meta]'?row:null},appendChild(){appends++},setAttribute(){}};
  const document={body:{getAttribute(name){return name==='data-exporthub-view'?'shipmentoverview':''}},querySelectorAll(){return[card]},createElement(){throw new Error('Bestehende Meta-Zeile darf nicht neu erstellt werden')}};
  const context={document,Date,console,ExportHUBI18n:createTestI18n('de'),setTimeout(fn){fn();return 1},clearTimeout(){},addEventListener(){}};context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'rc1014-shipment-overview.js'});
  const api=context.ExportHUBRC1014ShipmentOverview;
  assert.equal(api.enhanceShipmentOverview([{id:'ABC123',createdAt:'2026-09-14T08:00:00Z',totalColli:3}]),1);
  assert.equal(writes,0,'identische Metadaten dürfen keinen textContent-Write auslösen');
  assert.equal(appends,0,'bestehende Metadaten dürfen nicht erneut angehängt werden');
});

test('RC1127: Kunden-Abholdatum kommt ausschließlich aus der Lieferavis-Antwort',()=>{
  const source=read('assets/rc1014-shipment-overview.js');
  const context={console,Date,ExportHUBI18n:createTestI18n('de'),setTimeout(fn){fn();return 1},clearTimeout(){},addEventListener(){}};context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'rc1014-shipment-overview.js'});
  const api=context.ExportHUBRC1014ShipmentOverview;
  const avis=api.shipmentMeta({
    id:'ABC123',
    createdAt:'2026-09-16T08:00:00Z',
    totalColli:4,
    plannedPickupDate:'2026-09-17',
    customerAvisPickupDate:'2026-09-18',
    customerAvisPickupTimeFrom:'10:00',
    customerAvisPickupTimeTo:'12:00'
  });
  assert.equal(avis.customerPickupDate,'18.09.2026');
  assert.equal(avis.customerPickupLabel,'Kunden-Abholung: 18.09.2026 · 10:00–12:00');
  const internalOnly=api.shipmentMeta({id:'DEF456',plannedPickupDate:'2026-09-19',pickupDate:'2026-09-19'});
  assert.equal(internalOnly.customerPickupLabel,'','Internes/geplantes Abholdatum darf nicht als Kundenantwort erscheinen');
  const compat=api.shipmentMeta({id:'GHI789',avisPickupDate:'2026-09-20'});
  assert.equal(compat.customerPickupLabel,'Kunden-Abholung: 20.09.2026');
});

test('RC1091: Overview-Enhancer ist auf echte Sendungskarten begrenzt und unterdrückt direkten Render-Feedback',()=>{
  const source=read('assets/rc1014-shipment-overview.js');
  assert.doesNotMatch(source,/\[data-reference\],\.card/,'generische .card-Auswahl darf nicht mehr alle Karten der Ansicht scannen');
  assert.match(source,/__EXPORTHUB_RC1091_SHIPMENT_OVERVIEW_STABLE__/);
  assert.match(source,/Date\.now\(\)-lastMutationAt<750/);
  assert.match(source,/if\(!root\.document\|\|timer\)return false/);
});

test('RC1127: finaler RC1048-Build rendert Kunden-Abholtermin direkt in overviewCardHtml und bustet JS/CSS-Cache',()=>{
  const build=read('.github/rc1048/build-three-env.mjs');
  assert.match(build,/function patchShipmentOverviewInlineMeta\(/);
  assert.match(build,/rc1091MetaHtml/);
  assert.match(build,/rc1127PickupHtml/);
  assert.match(build,/data-rc1127-customer-pickup/);
  assert.match(build,/rc1014-shipment-overview\.js\?v=1127/);
  assert.match(build,/rc1014-shipment-overview\.css\?v=1127/);
  assert.match(build,/shipmentOverviewRenderStability:\{version:'RC1127'/);
  assert.match(build,/customerPickupDateFromAvis:true/);
  assert.match(build,/assets\/rc1014-shipment-overview\.js/,'RC1127 Runtime muss weiterhin in den finalen Build kopiert werden');
});

test('RC1127: Produktionsdeploy prüft die neuen Sendungsübersichts-Cache-Keys',()=>{
  const flow=read('.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml');
  assert.match(flow,/assets\/rc1014-shipment-overview\.js\?v=1127/);
  assert.match(flow,/assets\/rc1014-shipment-overview\.css\?v=1127/);
  assert.doesNotMatch(flow,/dist-rc1048\/index\.html[^\n]*rc1014-shipment-overview\.js\?v=1016/);
});


test('RC1091: finaler Drei-Umgebungen-Build erzeugt die stabilisierte Übersicht ohne Generatorfehler',()=>{
  execFileSync(process.execPath,['.github/rc1048/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1048/'+file);
    assert.match(html,/assets\/rc1014-shipment-overview\.js\?v=1127/,file+': RC1127 JS Cache-Key fehlt');
    assert.match(html,/assets\/rc1014-shipment-overview\.css\?v=1127/,file+': RC1127 CSS Cache-Key fehlt');
    assert.match(html,/var rc1091OverviewApi=window\.ExportHUBRC1014ShipmentOverview/,file+': direkte Overview-Metadaten fehlen');
    assert.match(html,/rc1127PickupHtml/,file+': Kunden-Abholtermin fehlt in overviewCardHtml');
    assert.match(html,/data-rc1127-customer-pickup/,file+': Kunden-Abholtermin besitzt keinen stabilen Marker');
    assert.match(html,/\+rc1091MetaHtml\+/,file+': Metadaten werden nicht direkt in die Karte gerendert');
  }
  assert.match(read('dist-rc1048/assets/rc1014-shipment-overview.js'),/__EXPORTHUB_RC1091_SHIPMENT_OVERVIEW_STABLE__/);
});
