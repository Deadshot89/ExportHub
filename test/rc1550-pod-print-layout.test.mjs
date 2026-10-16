import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const base=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const wrapper=fs.readFileSync('assets/document-print-name.js','utf8');

test('POD: final print layer constrains the driver signature to 16mm',()=>{
  assert.match(wrapper,/height:16mm!important;min-height:0!important;max-height:16mm!important/);
  assert.match(wrapper,/max-height:15mm!important;object-fit:contain!important/);
});
test('RC1556 POD: final print layer recursively suppresses nested legacy pickup text',()=>{
  assert.match(wrapper,/function suppressLegacyPickupContent\(card\)/);
  assert.match(wrapper,/querySelectorAll\('\.rc390-txt,\.rc352-txt'\)/);
  assert.doesNotMatch(wrapper,/\[data-rc1503-pickup-field\]>\.rc390-txt/);
  assert.doesNotMatch(wrapper,/\[data-rc1503-pickup-field\]>\.rc352-txt/);
  assert.match(wrapper,/\[data-rc1503-pickup-field\] \.rc390-txt/);
  assert.match(wrapper,/\[data-rc1503-pickup-field\] \.rc352-txt/);
  assert.match(wrapper,/data-rc1556-legacy-pickup-hidden/);
  assert.match(wrapper,/align-self:start!important/);
});
test('RC1556 POD: value and signature replacement clean legacy descendants before appending canonical values',()=>{
  const putValue=wrapper.slice(wrapper.indexOf('function putValue('),wrapper.indexOf('function putPalletBalance('));
  const putSignature=wrapper.slice(wrapper.indexOf('function putSignature('),wrapper.indexOf('function normalizeDeliveryGrid('));
  assert.match(putValue,/suppressLegacyPickupContent\(card\)/);
  assert.match(putSignature,/suppressLegacyPickupContent\(card\)/);
});
test('POD: pallet balance is rendered as a single normalized value',()=>{
  assert.match(wrapper,/data-rc1543-pallet-single-value/);
  assert.match(wrapper,/return putValue\(card,palletBalanceText\(account\),'rc1305-meta-pallet'\)/);
});
test('POD: print scripts remain valid JavaScript',()=>{
  for(const file of ['assets/rc1305-loading-list-print.js','assets/document-print-name.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});