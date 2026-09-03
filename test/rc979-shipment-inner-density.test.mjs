import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html', 'utf8');

function buildNumber() {
  const m = html.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  assert.ok(m, 'BUILD-Marker fehlt');
  assert.equal(m[1], m[2], 'BUILD und Cache müssen identisch sein');
  return Number(m[1]);
}

function styleBlock() {
  const m = html.match(/<style id="rc979-shipment-inner-density">([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

test('RC979: Build ist auf RC979 oder höher angehoben', () => {
  assert.ok(buildNumber() >= 979, 'BUILD muss RC979 oder höher sein');
});

test('RC979: alte 100-Prozent-Innenhöhen werden nur in den vier freigegebenen Sendungsbereichen neutralisiert', () => {
  const css = styleBlock();
  assert.ok(css, 'RC979 Density-Style fehlt');
  for (const id of ['rc363BlockCustomer','rc363BlockShipment','rc363BlockColli','rc363BlockDocuments']) {
    assert.match(css, new RegExp(`#${id}[^\\{]*\\{[^\\}]*height:auto!important[^\\}]*min-height:0!important`, 's'), `${id} muss auf natürliche Höhe zurückgesetzt werden`);
  }
  for (const forbidden of ['rc363BlockStow','rc363BlockMail','rc363BlockActions','rc380StowPlan','rc543MailArea']) {
    assert.ok(!css.includes(forbidden), `${forbidden} darf RC979 nicht verändern`);
  }
});

test('RC979: Kunde, Sendungsdaten und Dokumente richten Inhalte oben statt künstlich gestreckt aus', () => {
  const css = styleBlock();
  for (const id of ['rc363BlockCustomer','rc363BlockShipment','rc363BlockDocuments']) {
    assert.match(css, new RegExp(`#${id} \\.rc363-process-body[^\\{]*\\{[^\\}]*align-items:start!important[^\\}]*align-content:start!important`, 's'), `${id} muss innen oben ausrichten`);
    assert.match(css, new RegExp(`#${id} \\.rc363-process-body>\\*[^\\{]*\\{[^\\}]*height:auto!important[^\\}]*min-height:0!important`, 's'), `${id} darf Kinder nicht auf 100% Höhe ziehen`);
  }
  assert.match(css, /#rc363BlockCustomer \.rc363-process-body>:is\(\.okbox,\.badbox,\.notice,\.infobox\)[^{]*\{[^}]*min-height:0!important/s, 'Kundenhinweise dürfen keine starre 72px Mindesthöhe mehr erzwingen');
});

test('RC979: lange Textfelder starten kompakter und wachsen weiterhin automatisch', () => {
  const css = styleBlock();
  assert.match(css, /#rc363BlockShipment #rc896ShipmentFieldGrid textarea[^\{]*\{[^\}]*min-height:64px!important[^\}]*height:auto!important/s, 'Sendungs-Langtexte müssen kompakter starten');
  assert.match(css, /#rc363BlockDocuments \.rc899-doc-main textarea[^\{]*\{[^\}]*min-height:72px!important[^\}]*height:auto!important[^\}]*max-height:none!important/s, 'Dokument-Langtexte müssen kompakter starten und frei wachsen');
  assert.ok(html.includes('data-rc973-autogrow'), 'RC973 Auto-Grow muss erhalten bleiben');
});

test('RC979: innere Abstände werden verdichtet ohne RC977-Colli-Typografie oder Feldhöhe anzutasten', () => {
  const css = styleBlock();
  assert.match(css, /#rc896ShipmentFieldGrid[^\{]*\{[^\}]*gap:8px 10px!important/s, 'Sendungsfeld-Raster soll dichter werden');
  assert.match(css, /#rc363BlockDocuments \.rc899-doc-main[^\{]*\{[^\}]*gap:6px!important/s, 'Dokumentbereich soll dichter werden');
  assert.match(css, /#rc363BlockColli #rc573ColliCard #rowsBox[^\{]*\{[^\}]*gap:5px!important/s, 'Colli-Zeilen sollen enger zusammenrücken');
  assert.ok(!/font-size|--rc977-colli-font|\.rc682-packaging-toggle/.test(css), 'RC979 darf die RC977-Colli-Typografie nicht überschreiben');
  assert.ok(!/--rc971-control-h|height:42px/.test(css), 'RC979 darf die Feldhöhe nicht neu definieren');
});
