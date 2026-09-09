import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');

function has(pattern,message){assert.match(html,pattern,message)}

test('RC1017: Mehr-LKW-UI zeigt getrennte operative Aktionen je Teilsendung',()=>{
  has(/id=["']rc1017-subshipments["']/,'Mehr-LKW-Bereich fehlt');
  has(/Sendung\s+['"`]?\+?\s*sequence|Sendung \$\{sequence\} von \$\{total\}/,'Sendung-X-von-Y-Kennzeichnung fehlt');
  has(/rc1017-print-subshipment/,'Ladelisten-Aktion je LKW fehlt');
  has(/rc1017-qr-subshipment/,'QR-Aktion je LKW fehlt');
  has(/rc1017-stow-subshipment/,'Stauplan-Aktion je LKW fehlt');
  has(/LKW erforderlich/,'sichtbare Mehr-LKW-Zusammenfassung fehlt');
});

test('RC1017: Teilsendungsrows werden ausschließlich aus der gewählten subShipmentId gelesen',()=>{
  has(/function\s+rc1017RowsForSubShipment\s*\(/,'Rows-Filterhelper fehlt');
  has(/find\s*\(\s*function\s*\([^)]*\)\s*\{[^}]*subShipmentId/s,'Teilsendung wird nicht über subShipmentId gefunden');
});

test('RC1017: Ladeliste der Teilsendung nutzt vorhandene PDF-Erzeugung mit temporärer Sendungskopie',()=>{
  has(/function\s+rc1017SubShipmentDocumentShipment\s*\(/,'temporäre Dokumentkopie fehlt');
  has(/createPdf\s*\(\s*['"]load1['"]/,'bestehender createPdf-Ladelistenpfad wird nicht wiederverwendet');
  has(/Hauptreferenz/,'Hauptreferenz fehlt auf der Teilladeliste');
  has(/subShipmentLabel/,'Teilsendungsbezeichnung fehlt im Dokumentkontext');
  has(/rc1017KeepQrInPdf\s*=\s*true/,'Teilsendungsdruck markiert seinen QR nicht als PDF-erlaubt');
  has(/rc1017KeepQrInPdf[^\n]{0,180}stripQrForPdf/s,'normaler QR-Strip wird für Teilsendungs-PDF nicht gezielt umgangen');
});

test('RC1017: QR je Teilsendung verwendet Pickup-Init und persistiert keinen Raw-Token in subShipments',()=>{
  has(/function\s+rc1017ActivateSubShipmentQr\s*\(/,'eigene QR-Aktion fehlt');
  has(/\/api\/pickup-init/,'bestehender Pickup-Init-Endpunkt wird nicht genutzt');
  has(/subShipmentSequence/,'QR-Payload enthält Sequenz nicht');
  has(/subShipmentTotal/,'QR-Payload enthält Gesamtzahl nicht');
  has(/rc1017SubShipmentQrRuntime/,'flüchtiger QR-Runtime-Speicher fehlt');
  assert.doesNotMatch(html,/sub\.pickupToken\s*=/,'Raw-Token darf nicht in der Teilsendung persistiert werden');
  assert.doesNotMatch(html,/sub\.pickupQrToken\s*=/,'Raw-QR-Token darf nicht in der Teilsendung persistiert werden');
});

test('RC1017: Stauplan je Teilsendung nutzt dieselbe kanonische buildStowPlan-Geometrie',()=>{
  has(/function\s+rc1017PrintSubShipmentStow\s*\(/,'Teilsendungs-Stauplandruck fehlt');
  has(/buildStowPlan\s*\(\s*rows\s*,\s*currentStowVehicle\s*\(\s*\)\s*\)/,'Teilstauplan nutzt nicht die kanonische Geometrie');
});

test('RC1017: Hauptsendung bleibt eine Übersichtskarte und zeigt nur Teilsendungsfortschritt',()=>{
  has(/Teilsendungen/,'Übersichtszusammenfassung für Teilsendungen fehlt');
  has(/von[^\n]{0,80}abgeholt/,'Fortschritt abgeholter Teilsendungen fehlt');
});
