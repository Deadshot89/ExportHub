import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import store from '../api/shared/customer-portal-store.js';

const key=crypto.createHash('sha256').update('fixed-test-key').digest();

test('RC1159: AES-256-GCM speichert Portal-Secrets nicht im Klartext',()=>{
  const encrypted=store.encryptSecret('SECRET-USER-RC1159',key);
  const serialized=JSON.stringify(encrypted);
  assert.doesNotMatch(serialized,/SECRET-USER-RC1159/);
  assert.equal(encrypted.alg,'aes-256-gcm');
  assert.equal(store.decryptSecret(encrypted,key),'SECRET-USER-RC1159');
});
test('RC1159: manipuliertes GCM-Tag wird fail-closed abgewiesen',()=>{
  const encrypted=store.encryptSecret('SECRET-PASS-RC1159',key);
  encrypted.tag=Buffer.alloc(16,1).toString('base64url');
  assert.throws(()=>store.decryptSecret(encrypted,key),e=>e&&e.code==='SECRET_DECRYPT_FAILED');
});
test('RC1159: Metadaten enthalten niemals Ciphertext oder Klartext-Zugangsdaten',()=>{
  const row={id:'P1',name:'Portal',url:'https://portal.example/',usernameEncrypted:store.encryptSecret('SECRET-U',key),passwordEncrypted:store.encryptSecret('SECRET-P',key),active:true};
  const meta=store.metadata(row),serialized=JSON.stringify(meta);
  assert.equal(meta.hasUsername,true);assert.equal(meta.hasPassword,true);
  assert.equal('usernameEncrypted' in meta,false);assert.equal('passwordEncrypted' in meta,false);
  assert.doesNotMatch(serialized,/SECRET-U|SECRET-P|ciphertext|tag|iv/);
});
test('RC1159: nur HTTPS-Portale sind zulässig und URL-Credentials werden entfernt',()=>{
  assert.throws(()=>store.cleanUrl('http://example.test'),e=>e&&e.code==='PORTAL_URL_INVALID');
  assert.equal(store.cleanUrl('https://user:pass@example.test/path'),'https://example.test/path');
});
test('RC1159: TESTSERVICE nutzt eigenes Credential-Blob',()=>{
  assert.match(store.blobName('testservice'),/^testservice\//);
  assert.doesNotMatch(store.blobName('production'),/^testservice\//);
});
