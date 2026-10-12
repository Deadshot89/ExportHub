// RC1499 TDD: 3-Wege-Start + gruppierte Rechnungsprüfung.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');

function has(text,message){
  assert.match(source,text,message);
}

test('export_expert_router_offers_three_paths_without_reimplementing_legacy_shipment_prefill',()=>{
  has(/Manuell/,'Router muss den manuellen Bestandspfad anbieten');
  has(/Aus Sendung/,'Router muss den bestehenden Sendungspfad anbieten');
  has(/Rechnung analysieren/,'Router muss die Rechnungsanalyse anbieten');
  has(/ExportHUBRC626\.openAbd\(true\)/,'Aus Sendung muss exakt auf den bestehenden RC626-Pfad delegieren');
  assert.doesNotMatch(source,/function\s+prefillFromShipment\s*\(/,'RC1294 darf den bestehenden Shipment-Prefill nicht duplizieren');
  assert.doesNotMatch(source,/function\s+openAbd\s*\(/,'RC1294 darf den bestehenden RC626-openAbd-Handler nicht neu definieren');
});

test('invoice_path_has_its_own_scoped_review_panel',()=>{
  has(/data-rc1294-mode=["']invoice["']/,'Rechnungsanalyse braucht einen eigenen Router-Modus');
  has(/data-rc1294-invoice-panel/,'Rechnungsanalyse braucht einen eigenen ein-/ausblendbaren Panel-Scope');
  has(/setMode\(/,'Router braucht eine zentrale Modusumschaltung');
});

test('grouped_review_uses_hs_plus_origin_groups_as_primary_rows',()=>{
  has(/analysis\.groups/,'Hauptansicht muss die serverseitigen HS+Ursprung-Gruppen verwenden');
  has(/groupRowsHtml/,'Gruppierte Hauptzeilen müssen separat gerendert werden');
  has(/Daten für Zollportal/,'Gruppierter Zollportal-Export muss sichtbar angeboten werden');
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
