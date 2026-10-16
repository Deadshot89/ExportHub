import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const base=fs.readFileSync('assets/rc1305-loading-list-print.js','utf8');
const wrapper=fs.readFileSync('assets/document-print-name.js','utf8');

test('POD: both print layers constrain the driver signature to 16mm',()=>{
  for(const source of [base,wrapper]){
    assert.match(source,/height:16mm!important;min-height:0!important;max-height:16mm!important/);
    assert.match(source,/max-height:15mm!important;object-fit:contain!important/);
  }
});

test('POD: final print layer removes nested legacy pickup text, not only direct children',()=>{
  assert.match(base,/\[data-rc1503-pickup-field\]>\.rc390-txt/);
  assert.match(base,/\[data-rc1503-pickup-field\]>\.rc352-txt/);
  assert.match(wrapper,/\[data-rc1503-pickup-field\] \.rc390-txt/);
  assert.match(wrapper,/\[data-rc1503-pickup-field\] \.rc352-txt/);
  assert.match(wrapper,/function clearLegacyPickupContent\(card\)/);
  assert.match(wrapper,/querySelectorAll\('\.rc390-txt,\.rc352-txt'\)/);
  assert.match(wrapper,/clearLegacyPickupContent\(card\)/);
});

test('POD: final print layer collapses fixed-height legacy pickup grids',()=>{
  assert.match(wrapper,/function compactPickupGrid\(cards\)/);
  assert.match(wrapper,/data-rc1555-compact-pickup-grid/);
  assert.match(wrapper,/setProperty\('height','auto','important'\)/);
  assert.match(wrapper,/setProperty\('grid-template-rows','none','important'\)/);
  assert.match(wrapper,/setProperty\('grid-auto-rows','auto','important'\)/);
  assert.match(wrapper,/setProperty\('align-content','start','important'\)/);
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