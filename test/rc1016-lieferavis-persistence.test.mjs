import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mergeState } = require('../api/shared/merge.js');

function meta() {
  return { _teamSyncMeta: { fields: {}, tombstones: [] } };
}

function serverAvisCopy(extra = {}) {
  return {
    id: 'S1',
    ref: 'ABC123',
    updatedAt: '2026-09-09T13:00:00.000Z',
    _syncUpdatedAt: '2026-09-09T13:00:00.000Z',
    customerAvisPickupDate: '2026-09-10',
    avisPickupDate: '2026-09-10',
    customerAvisPickupTimeFrom: '10:00',
    avisPickupTimeFrom: '10:00',
    customerAvisPickupTimeTo: '12:00',
    avisPickupTimeTo: '12:00',
    customerAvisPickupPlate: 'VIE-RC1016',
    avisPickupPlate: 'VIE-RC1016',
    customerAvisPickupNote: 'Tor 2',
    avisPickupNote: 'Tor 2',
    customerAvisResponseAt: '2026-09-09T13:00:00.000Z',
    avisResponseAt: '2026-09-09T13:00:00.000Z',
    customerAvisResponseReference: 'ABC123',
    avisResponseReference: 'ABC123',
    customerAvisResponseStatus: 'bestätigt',
    avisResponseStatus: 'bestätigt',
    customerConfirmed: true,
    customerConfirmedAt: '2026-09-09T13:00:00.000Z',
    customerConfirmedVia: 'customer-avis',
    plannedPickupDate: '2026-09-10',
    pickupDate: '2026-09-10',
    ...extra,
  };
}

function staleClientCopy(extra = {}) {
  return {
    id: 'S1',
    ref: 'ABC123',
    updatedAt: '2026-09-09T13:05:00.000Z',
    _syncUpdatedAt: '2026-09-09T13:05:00.000Z',
    plannedPickupDate: '2026-09-08',
    pickupDate: '2026-09-08',
    status: 'Erstellt',
    ...extra,
  };
}

function assertAvisPreserved(shipment, label) {
  assert.equal(shipment.customerAvisPickupDate, '2026-09-10', label + ': Avis-Datum verloren');
  assert.equal(shipment.customerAvisPickupTimeFrom, '10:00', label + ': Von-Zeit verloren');
  assert.equal(shipment.customerAvisPickupTimeTo, '12:00', label + ': Bis-Zeit verloren');
  assert.equal(shipment.customerAvisPickupPlate, 'VIE-RC1016', label + ': Kennzeichen verloren');
  assert.equal(shipment.customerAvisPickupNote, 'Tor 2', label + ': Hinweis verloren');
  assert.equal(shipment.customerConfirmed, true, label + ': Kundenbestätigung verloren');
  assert.equal(shipment.customerConfirmedVia, 'customer-avis', label + ': Bestätigungskanal verloren');
  assert.equal(shipment.customerAvisResponseAt, '2026-09-09T13:00:00.000Z', label + ': Avis-Zeitstempel verloren');
  assert.equal(shipment.plannedPickupDate, '2026-09-10', label + ': geplantes Abholdatum wurde durch alten Client zurückgesetzt');
  assert.equal(shipment.pickupDate, '2026-09-10', label + ': Abholdatum wurde durch alten Client zurückgesetzt');
}

test('RC1016 Lieferavis: neuerer stale Client darf serverseitige Avis-Antwort nicht zurücksetzen', () => {
  const server = {
    ...meta(),
    shipments: [serverAvisCopy()],
    salesSharedShipments: [serverAvisCopy()],
    sharedShipments: [serverAvisCopy()],
    shipmentArchive: [serverAvisCopy()],
  };
  const incoming = {
    ...meta(),
    shipments: [staleClientCopy()],
    salesSharedShipments: [staleClientCopy()],
    sharedShipments: [staleClientCopy()],
    shipmentArchive: [staleClientCopy()],
  };

  const merged = mergeState(server, incoming);

  assertAvisPreserved(merged.shipments[0], 'shipments');
  assertAvisPreserved(merged.salesSharedShipments[0], 'salesSharedShipments');
  assertAvisPreserved(merged.sharedShipments[0], 'sharedShipments');
  assertAvisPreserved(merged.shipmentArchive[0], 'shipmentArchive');
});

test('RC1016 Lieferavis: eine tatsächlich neuere Avis-Antwort darf die vorherige ersetzen', () => {
  const server = { ...meta(), shipments: [serverAvisCopy()] };
  const incoming = {
    ...meta(),
    shipments: [serverAvisCopy({
      customerAvisPickupDate: '2026-09-11',
      avisPickupDate: '2026-09-11',
      customerAvisPickupTimeFrom: '14:00',
      avisPickupTimeFrom: '14:00',
      customerAvisPickupTimeTo: '16:00',
      avisPickupTimeTo: '16:00',
      customerAvisResponseAt: '2026-09-09T13:10:00.000Z',
      avisResponseAt: '2026-09-09T13:10:00.000Z',
      customerConfirmedAt: '2026-09-09T13:10:00.000Z',
      plannedPickupDate: '2026-09-11',
      pickupDate: '2026-09-11',
      updatedAt: '2026-09-09T13:10:00.000Z',
      _syncUpdatedAt: '2026-09-09T13:10:00.000Z',
    })],
  };

  const merged = mergeState(server, incoming);
  assert.equal(merged.shipments[0].customerAvisPickupDate, '2026-09-11');
  assert.equal(merged.shipments[0].customerAvisPickupTimeFrom, '14:00');
  assert.equal(merged.shipments[0].customerAvisPickupTimeTo, '16:00');
  assert.equal(merged.shipments[0].plannedPickupDate, '2026-09-11');
});
