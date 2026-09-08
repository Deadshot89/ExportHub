import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ');
}

for (const file of ['index.html', 'TESTVERSION.html']) {
  const html = fs.readFileSync(file, 'utf8');

  test(`${file}: Gate41 liest weiterhin die aktuelle Empfänger- und Standortquelle`, () => {
    const m = html.match(/function activeShipmentRoute\(\)\{([\s\S]*?)\}\s*function shipmentRows/);
    assert.ok(m, `${file}: activeShipmentRoute fehlt`);
    const body = compact(m[1]);

    assert.match(body, /activeLocation\(sh,c\)/, `${file}: ausgewählter Kundenstandort fehlt.`);
    assert.match(body, /deliveryAddress/, `${file}: deliveryAddress wird nicht gelesen.`);
    assert.match(body, /countryName/, `${file}: kanonische Ländererkennung fehlt.`);
    assert.match(body, /postcode|plz/, `${file}: aktuelle PLZ-Aliase fehlen.`);
  });

  test(`${file}: neue Gate41-Anfrage startet ohne erkanntes Zielland mit Deutschland statt 0-Euro-International`, () => {
    const m = html.match(/function newCostRequest\(kind\)\{([\s\S]*?)\}\s*function saveCost/);
    assert.ok(m, `${file}: newCostRequest fehlt`);
    const body = compact(m[1]);

    assert.match(body, /gateCountry=autoCountry\|\|'Deutschland'/, `${file}: Gate41 hat bei leerer Route kein Deutschland-Fallback.`);
    assert.match(body, /country:gateCountry/, `${file}: Gate41 verwendet das Deutschland-Fallback nicht als Zielland.`);
    assert.match(body, /scope:countryCode\(gateCountry\)==='DE'\?'national':'international'/, `${file}: Gate41 klassifiziert das Fallback nicht als national.`);
  });

  test(`${file}: Gate41 übernimmt gespeicherte Paletten auch ohne Colli-Zeilen`, () => {
    const m = html.match(/function syncCostFromShipment\(\)\{([\s\S]*?)\}\s*function upsFuelDefault/);
    assert.ok(m, `${file}: syncCostFromShipment fehlt`);
    const body = compact(m[1]);

    assert.match(body, /if\(\(load\.rows\.length\|\|load\.pallets>0\)\s*&&\s*!g\.manualLoad\)/, `${file}: Gate41 ignoriert palletCount/totalPallets-Fallback ohne Zeilen.`);
    assert.match(body, /g\.pallets=load\.pallets>0\?load\.pallets:0/, `${file}: Gate41 übernimmt die erkannte Palettenanzahl nicht.`);
    assert.match(body, /g\.totalWeight=load\.totalWeight\|\|0/, `${file}: Gate41 übernimmt das Sendungsgewicht nicht.`);
  });

  test(`${file}: Gate41 Deutschland-Grundtarife bleiben unverändert vorhanden`, () => {
    const m = html.match(/function gateRate\(pallets,kg\)\{([\s\S]*?)\}\s*function gateConfiguredBase/);
    assert.ok(m, `${file}: gateRate fehlt`);
    const body = compact(m[1]);
    for (const rate of ['43.43', '46.09', '70.92', '73.69', '94.46', '98.61']) {
      assert.ok(body.includes(rate), `${file}: Gate41-Tarif ${rate} fehlt.`);
    }
  });
}
