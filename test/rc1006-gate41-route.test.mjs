import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html', 'TESTVERSION.html']) {
  const html = fs.readFileSync(file, 'utf8');

  test(`${file}: Gate41 übernimmt die vollständige aktuelle Standortquelle`, () => {
    const m = html.match(/function activeShipmentRoute\(\)\{([\s\S]*?)\}function shipmentRows/);
    assert.ok(m, `${file}: activeShipmentRoute/shipmentRows fehlt`);
    const body = m[1].replace(/\s+/g, ' ');

    assert.match(body, /deliveryAddress/, `${file}: Gate41 ignoriert deliveryAddress aus der aktuellen Standortlogik.`);
    assert.match(body, /locationData|siteData/, `${file}: Gate41 ignoriert den normalisierten ausgewählten Standort.`);
    assert.match(body, /countryName/, `${file}: Gate41 ignoriert countryName und kann dadurch das Zielland verlieren.`);
    assert.match(body, /postcode|plz/, `${file}: Gate41 ignoriert aktuelle PLZ-Aliase.`);
    assert.match(body, /selectedLocationId|destinationId/, `${file}: Gate41 berücksichtigt die aktuellen Standort-IDs nicht.`);
  });

  test(`${file}: Gate41 Deutschland-Grundtarife bleiben vorhanden`, () => {
    const m = html.match(/function gateRate\(pallets,kg\)\{([\s\S]*?)\}function/);
    assert.ok(m, `${file}: gateRate fehlt`);
    const body = m[1].replace(/\s+/g, ' ');
    assert.match(body, /43\.43/);
    assert.match(body, /46\.09/);
    assert.match(body, /70\.92/);
    assert.match(body, /73\.69/);
    assert.match(body, /94\.46/);
    assert.match(body, /98\.61/);
  });
}
