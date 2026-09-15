'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const archive=require('../../api/shared/pod-archive');

const pixelPng=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z8R8AAAAASUVORK5CYII=',
  'base64'
);

test('RC1114 erzeugt einen echten POD-PDF mit Signatur',async()=>{
  const record={
    accessKey:'a'.repeat(64),
    reference:'ABC123',
    customer:'Böllhoff Testkunde',
    recipient:'Wareneingang',
    address:'Musterstraße 1, 47638 Straelen',
    carrierName:'Test Spedition',
    expectedColliCount:2,
    pickupCollectedColliCount:2,
    confirmedAt:'2026-09-15T12:00:00.000Z',
    rows:[{type:'Europalette',count:2,weight:120}],
    pickupHistory:[{
      sequence:1,
      confirmedAt:'2026-09-15T12:00:00.000Z',
      colliCount:2,
      driverName:'Max Fahrer',
      licensePlate:'KLE-AB 123',
      loaderName:'Test Verlader',
      complete:true
    }]
  };
  const pdf=await archive.createPodPdf(record,pixelPng,'image/png');
  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0,5).toString('ascii'),'%PDF-');
  assert.ok(pdf.length>1000);
});

test('RC1114 Dateiname bleibt deterministisch und teilsendungsfähig',()=>{
  assert.equal(archive.fileNameFor({reference:'ABC123'}),'POD_ABC123_Abliefernachweis.pdf');
  assert.equal(archive.fileNameFor({reference:'ABC123',subShipmentSequence:2,subShipmentTotal:3}),'POD_ABC123_Teil_2-von-3_Abliefernachweis.pdf');
});
