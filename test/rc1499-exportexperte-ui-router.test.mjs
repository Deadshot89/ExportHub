// RC1499 TDD: 3-Wege-Start + gruppierte Rechnungsprüfung.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const documentWorkspace=fs.readFileSync('assets/rc1940-documents-workspace.js','utf8');
const i18nSource=fs.readFileSync('assets/i18n/rc1499-exportexperte.js','utf8');
const sandbox={console,Intl,URL,setTimeout,clearTimeout};
vm.runInNewContext(i18nSource,sandbox,{filename:'assets/i18n/rc1499-exportexperte.js'});
const de=sandbox.ExportHUBRC1499I18n.packs.de;

function has(pattern,message){assert.match(source,pattern,message)}

test('RC1942: ABD only offers manual, shipment and saved; invoice upload lives in Documents',()=>{
  assert.equal(de.manualMode,'Manuell');
  assert.equal(de.shipmentMode,'Aus Sendung');
  assert.equal(de.savedMode,'Gespeicherte Anfragen');
  has(/xtr\('manualMode'\)/,'Manueller Pfad fehlt');
  has(/xtr\('shipmentMode'\)/,'Sendungspfad fehlt');
  has(/xtr\('savedMode'\)/,'Gespeicherte ABD-Anfragen fehlen');
  assert.doesNotMatch(source,/data-rc1294-mode=["']invoice["']/,'Alte Rechnungsanalyse im ABD-Router vorhanden');
  assert.doesNotMatch(source,/id="rc1294InvoicePanel"/,'Altes Rechnungsupload-Panel noch in ABD');
  assert.match(documentWorkspace,/data-rc1940-files accept=/,'Dateiupload fehlt im Dokumentenbereich');
  assert.match(documentWorkspace,/scanner\.analyzeFile\(file\)/,'Virenprüfung und Analyse fehlen im Dokumentenbereich');
  has(/ExportHUBRC626\.openAbd\(true\)/,'Aus Sendung muss auf den Bestandspfad delegieren');
  assert.doesNotMatch(source,/function\s+prefillFromShipment\s*\(/,'Shipment-Prefill darf nicht dupliziert werden');
  assert.doesNotMatch(source,/function\s+openAbd\s*\(/,'Legacy-ABD-Handler darf nicht neu definiert werden');
});

test('RC1942: document upload has its own scoped result preview and editor import',()=>{
  assert.match(documentWorkspace,/id='rc1940DocumentUpload'/,'Eigener Upload-Bereich fehlt');
  assert.match(documentWorkspace,/data-rc1940-upload-results/,'Analyse-Vorschau fehlt');
  assert.match(documentWorkspace,/data-rc1940-use/,'Manuelle Übernahme fehlt');
  assert.match(documentWorkspace,/editor\.importAnalysis\(result\.analysis\)/,'Übernahme in Rechnung und Lieferschein fehlt');
  assert.match(source,/function setMode\(/,'ABD-Router braucht weiterhin Modusumschaltung');
});

test('grouped_review_uses_hs_plus_origin_groups_as_primary_rows',()=>{
  has(/analysis\.groups/,'Hauptansicht muss die serverseitigen HS+Ursprung-Gruppen verwenden');
  has(/groupRowsHtml/,'Gruppierte Hauptzeilen müssen separat gerendert werden');
  assert.equal(de.customsPortalData,'Daten für Zollportal');
  has(/xtr\('customsPortalData'\)/,'Gruppierter Zollportal-Export muss sichtbar angeboten werden');
  has(/copyGroupedResults/,'Kopierfunktion muss auf den gruppierten Ergebnissen basieren');
  has(/analysis\.unassigned/,'Nicht zuordenbare Positionen müssen separat sichtbar bleiben');
  has(/<details/,'Originalpositionen dürfen nur als Detailansicht unterhalb der Gruppen erscheinen');
});

test('grouped_review_shows_invoice_header_and_control_totals',()=>{
  has(/invoiceNumber/,'Review muss Rechnungsnummer aus dem Analysemodell anzeigen können');
  has(/invoiceDate/,'Review muss Rechnungsdatum aus dem Analysemodell anzeigen können');
  has(/recipient/,'Review muss Empfänger aus dem Analysemodell anzeigen können');
  has(/invoiceTotal/,'Review muss Rechnungswert anzeigen');
  has(/accountedTotal/,'Review muss den kontrollierten Positionswert anzeigen');
  has(/difference/,'Review muss die Differenz ausweisen');
});

test('grouped_review_exposes_detected_review_missing_states_and_field_copy_actions',()=>{
  for(const key of ['statusDetected','statusReview','statusMissing','copyHs','copyOrigin','copyValue'])assert.equal(typeof de[key],'string',key+' fehlt');
  has(/xtr\('statusDetected'\)/,'Status erkannt fehlt');
  has(/xtr\('statusReview'\)/,'Status prüfen fehlt');
  has(/xtr\('statusMissing'\)/,'Status fehlt fehlt');
  has(/data-rc1294-copy-value/,'Direkte Feld-Kopieraktion fehlt');
  has(/xtr\('copyHs'\)/,'HS-Kopieraktion fehlt');
  has(/xtr\('copyOrigin'\)/,'Ursprung-Kopieraktion fehlt');
  has(/xtr\('copyValue'\)/,'Wert-Kopieraktion fehlt');
  assert.doesNotMatch(source,/>€<\/button>/,'Wert-Kopierbutton darf keine feste EUR-Währung vortäuschen');
  has(/currency=q\(group&&group\.currency\)\|\|'VAL'/,'Wert-Kopierbutton muss die Gruppenwährung verwenden');
});
