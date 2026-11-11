import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fingerprintHtml} from '../.github/asset-fingerprint/fingerprint-assets.mjs';

// The live TESTSERVICE gate must verify the *deployed* cache-busted asset URL,
// not the unfingerprinted builder source. Never disable the real live API checks.
const live=fs.readFileSync('scripts/rc1903-testservice-guest-live.mjs','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const guardLines=live.split(/\r?\n/).filter(line=>
  line.includes('shipment-evidence-guest') && line.includes('assert.match('));
assert.equal(guardLines.length,2,'Both staff SPA and public guest-page gates must remain active');

function getGuard(line){
  const match=line.match(/assert\.match\((?:html|publicHtml),\s*(\/(?:\\.|[^/])+\/),/);
  assert.ok(match,'Keep a real assert.match runtime guard');
  return new RegExp(match[1].slice(1,-1));
}

test('RC1903 TESTSERVICE live guard recognizes the actual fingerprinted guest runtime',()=>{
  assert.match(builder,/shipment-evidence-guest\.js\?v=1907/);
  const input='<script defer src="/assets/shipment-evidence-guest.js?v=1907"></script>';
  const result=fingerprintHtml(input,{
    root:process.cwd(),
    out:path.join(process.cwd(),'.rc1903-no-generated-build')
  });
  assert.equal(result.count,1,'Asset must exist for hashing');
  assert.deepEqual(result.missing,[],'Do not accept a missing guest runtime asset');
  assert.match(result.html,/shipment-evidence-guest\.js\?v=1907&h=[a-f0-9]{10}"/);
  for(const line of guardLines)assert.match(result.html,getGuard(line),
    'Both deployed pages must accept the verified build fingerprint');
});

test('RC1903 live guard remains fail-closed on stale, unfingerprinted or malformed asset URLs',()=>{
  const invalid=[
    '/assets/shipment-evidence-guest.js?v=1907"',
    '/assets/shipment-evidence-guest.js?v=1906&h=abcdef1234"',
    '/assets/shipment-evidence-guest.js?v=1907&h=abc"',
    '/assets/shipment-evidence-guest.js?v=1907&h=not-a-hash"',
    '/assets/other.js?v=1907&h=abcdef1234"'
  ];
  for(const line of guardLines){
    const guard=getGuard(line);
    for(const candidate of invalid)assert.doesNotMatch(candidate,guard,
      'Live gate must reject invalid asset: '+candidate);
  }
});
