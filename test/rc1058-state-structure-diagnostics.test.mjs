import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('api/exporthub-state/index.js','utf8');

test('RC1058: Health berechnet nur aggregierte State-Bereichsgrößen',()=>{
  assert.match(source,/function\s+stateSizeDiagnostics\s*\(state\)/);
  assert.match(source,/sectionBytes/);
  assert.match(source,/documentPayloadBytes/);
  assert.match(source,/inlinePayloadCount/);
  assert.match(source,/documentFieldCounts/);
});

test('RC1058: Diagnose erkennt eingebettete data-URLs und Base64-Payloads ohne Inhalte auszugeben',()=>{
  assert.match(source,/data:/);
  assert.match(source,/base64/i);
  assert.doesNotMatch(source,/stateDiagnostics\s*:\s*teamCheck\.value/);
});

test('RC1058: State-Health liefert nur die aggregierte Diagnose',()=>{
  assert.match(source,/stateDiagnostics\s*:\s*stateSizeDiagnostics\(teamCheck\.value&&teamCheck\.value\.state\)/);
});
