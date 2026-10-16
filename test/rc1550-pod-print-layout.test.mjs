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
test('RC1555 POD: both print layers suppress nested legacy pickup text',()=>{
  for(const source of [base,wrapper]){
    assert.match(source,/\[data-rc1503-pickup-field\] \.rc390-txt/);
    assert.match(source,/\[data-rc1503-pickup-field\] \.rc352-txt/);
    assert.doesNotMatch(source,/\[data-rc1503-pickup-field\]>\.rc390-txt/);
  }
});
test('RC1555 POD: card lookup prefers the real outer loading-list card before generic field wrappers',()=>{
  for(const source of [base,wrapper]){
    assert.match(source,/el\.closest\('\.rc390-card,\.rc352-card'\)/);
    assert.match(source,/explicit&&explicit!==root/);
  }
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