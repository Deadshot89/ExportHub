// RC1903: Accept the build's content fingerprint only when it matches the exact guest runtime.
// Public standalone HTML may retain its un-fingerprinted ?v=1907 URL; its served bytes
// are independently checked by the TESTSERVICE live gate before any test-data write.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export function requireGuestRuntimeRef(html,expectedBytes,{fingerprintRequired=false}={}){
  const match=String(html||'').match(/\bsrc=["'](\/assets\/shipment-evidence-guest\.js\?v=1907(?:&h=([a-f0-9]{10}))?)["']/);
  assert.ok(match,'Expected guest runtime v=1907 is absent from TESTSERVICE HTML');
  const expectedHash=crypto.createHash('sha256').update(expectedBytes).digest('hex').slice(0,10);
  if(fingerprintRequired)assert.equal(match[2],expectedHash,'TESTSERVICE main HTML guest runtime fingerprint is missing or stale');
  else if(match[2])assert.equal(match[2],expectedHash,'TESTSERVICE public HTML guest runtime fingerprint is stale');
  return match[1];
}
