import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const handoff=fs.readFileSync('assets/rc1499-exportexperte-handoff.js','utf8');
const exportUi=fs.readFileSync('assets/rc1499-abd-export.js','utf8');
const pack=fs.readFileSync('assets/i18n/rc1499-exportexperte.js','utf8');
const analysisApi=fs.readFileSync('api/abd-analysis/index.js','utf8');
const exporter=fs.readFileSync('api/shared/abd-analysis-export.js','utf8');

test('RC1499 UI release contract: three start routes remain routing-only',()=>{
  assert.match(runtime,/data-rc1294-mode=["']manual["']/,'Manueller ABD-Einstieg fehlt');
  assert.match(runtime,/data-rc1294-mode=["']shipment["']/,'Sendungs-ABD-Einstieg fehlt');
  assert.match(runtime,/data-rc1294-mode=["']invoice["']/,'Rechnungsanalyse-Einstieg fehlt');
  assert.match(runtime,/if\(mode==='shipment'\)[\s\S]*?ExportHUBRC626\.openAbd\(true\)/,'Bestehender Sendungsflow wird nicht verwendet');
  assert.doesNotMatch(runtime,/if\(mode==='manual'\)[\s\S]{0,500}(replaceChildren|innerHTML\s*=)/,'Manueller Altflow darf nicht ersetzt werden');
});

test('RC1499 UI release contract: grouped review is primary and original positions stay detail-only',()=>{
  assert.match(runtime,/rc1294-group-table/,'Gruppierte Haupttabelle fehlt');
  assert.match(runtime,/rc1294-details/,'Originalpositionen-Details fehlen');
  assert.match(runtime,/analysis\.groups/,'Serverseitige Gruppen werden nicht gerendert');
  assert.match(runtime,/analysis\.unassigned/,'Unassigned-Bereich fehlt');
  assert.match(runtime,/totals\.difference/,'Kontrollsumme/Differenz fehlt in der UI');
  assert.match(runtime,/data-rc1499-edit-hs/,'HS-Korrektur fehlt');
  assert.match(runtime,/data-rc1499-edit-origin/,'Ursprungskorrektur fehlt');
  assert.match(runtime,/data-rc1499-edit-value/,'Warenwertkorrektur fehlt');
  assert.match(runtime,/action:'reanalyze'/,'Korrekturen werden nicht serverseitig neu analysiert');
});

test('RC1499 UI release contract: mandatory formats and server safety gates remain connected',()=>{
  assert.match(runtime,/accept=["'][^"']*\.pdf[^"']*\.jpg[^"']*\.jpeg[^"']*\.png[^"']*\.xlsx[^"']*\.csv/i,'Pflichtformate fehlen im Dateiupload');
  assert.match(analysisApi,/pdf\|xlsx\|csv\|jpg\|jpeg\|png/,'Server akzeptiert nicht alle Pflichtformate');
  assert.match(analysisApi,/Microsoft Defender for Storage/,'Defender-/Quarantänepfad fehlt');
  assert.match(analysisApi,/analyzeWithOcr/,'OCR-Pfad für Scan/Bild fehlt');
});

test('RC1499 UI release contract: handoff and exports consume reviewed state without duplicate grouping',()=>{
  assert.match(handoff,/ExportHUBRC626[\s\S]*?openAbd\(\)/,'Neutraler Legacy-ABD-Handoff fehlt');
  assert.doesNotMatch(handoff,/(confirmRc626Abd|saveAbd|sendAbd|openOutlook)/i,'Handoff darf keine Legacy-Aktion automatisch auslösen');
  assert.match(runtime,/snapshot:snapshot/,'Read-only Analyse-Snapshot fehlt');
  assert.match(exportUi,/ExportHUBRC1294ABDAnalysis[\s\S]*?snapshot/,'Export konsumiert nicht den geprüften Snapshot');
  assert.match(exportUi,/\/api\/abd-analysis\/export/,'Exportendpoint fehlt im Client');
  assert.doesNotMatch(exportUi,/groupPositionsByHsOrigin|normalizeCommodityCode|normalizeOriginCountry/,'Browserexport darf keine Gruppierungslogik duplizieren');
  assert.doesNotMatch(exporter,/groupPositionsByHsOrigin/,'Exporter darf keine Gruppierung erneut berechnen');
});

test('RC1499 UI release contract: six-language feature pack remains key-identical',()=>{
  for(const language of ['de','en','pl','es','fr','it'])assert.match(pack,new RegExp('\\b'+language+':Object\\.freeze\\('),language+' Sprachpaket fehlt');
  assert.match(pack,/prepareAbd/,'Handoff-Text fehlt im Feature-Sprachpaket');
  assert.match(pack,/rc1499-exportexperte-handoff\.js\?v=1499/,'Feature-Lader fehlt');
});
