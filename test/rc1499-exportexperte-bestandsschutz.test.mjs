// RC1499 Bestandsschutz: dieser Test friert den vorhandenen ABD-Kern vor dem Upgrade ein.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index=fs.readFileSync('index.html','utf8');
const testversion=fs.readFileSync('TESTVERSION.html','utf8');
const analysis=fs.readFileSync('assets/rc1294-abd-self-service.js','utf8');
const policy=fs.readFileSync('assets/rc1049-abd-avis-policy.js','utf8');
const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');

function both(re,message){
  assert.match(index,re,'index.html: '+message);
  assert.match(testversion,re,'TESTVERSION.html: '+message);
}

test('manual_abd_flow_contract_remains_available',()=>{
  both(/id=["']rc626Abd["']/i,'ABD-Hauptbereich fehlt');
  both(/ABD-Anfrage erstellen/i,'bestehender manueller ABD-Einstieg fehlt');
  both(/Kunde/i,'Kundenfeld/-suche fehlt');
  both(/Referenz/i,'Referenznummer fehlt');
  both(/Empf[aä]ngerland|Zielland/i,'Empfängerland fehlt');
  both(/Deutsch/i,'Sprache Deutsch fehlt');
  both(/Englisch/i,'Sprache Englisch fehlt');
  both(/ABD[^<]{0,20}Empf[aä]nger|Empf[aä]nger[^<]{0,20}ABD/i,'ABD-Empfänger fehlt');
  both(/Colli/i,'Colli-Funktionen fehlen');
  both(/Gesamtgewicht/i,'Gesamtgewicht fehlt');
  both(/Outlook/i,'Outlook-Aktion fehlt');
  both(/Mailtext/i,'Mailtext-Funktion fehlt');
  both(/ABD[^<]{0,40}speichern|speichern[^<]{0,40}ABD/i,'ABD-Speicheraktion fehlt');

  assert.match(analysis,/getElementById\('rc626Abd'\)/,'Analyse muss im bestehenden ABD-Bereich mounten');
  assert.doesNotMatch(analysis,/host\.innerHTML\s*=/,'Rechnungsanalyse darf den Altflow nicht ersetzen');
});

test('shipment_abd_flow_contract_remains_available',()=>{
  assert.match(stateApi,/linkedShipmentId/,'ABD-State muss Sendungsverknüpfung behalten');
  assert.match(stateApi,/linkedShipmentRef/,'ABD-State muss Sendungsreferenz behalten');
  assert.match(stateApi,/source:\s*['"]abd-request['"]/,'ABD-State-Evidence fehlt');
  assert.match(policy,/isRc626AbdOpen/,'bestehende RC626-ABD-Erkennung fehlt');
  assert.match(policy,/ExportHUBRC626/,'bestehende RC626-ABD-Brücke fehlt');
});

test('invoice_analysis_is_additive_only',()=>{
  assert.match(analysis,/appendChild\(p\)/,'Analysepanel muss additiv eingehängt werden');
  assert.match(analysis,/data-rc1294-abd-analysis/,'Analysepanel braucht eigenen Scope');
  assert.doesNotMatch(analysis,/replaceChildren\(/,'Analyse darf bestehende ABD-Kinder nicht ersetzen');
});
