import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const policy=require('../api/shared/user-policy.js');
const authApi=fs.readFileSync('api/exporthub-auth/index.js','utf8');
const authStore=fs.readFileSync('api/shared/auth-store.js','utf8');
const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');
const fastAuth=fs.readFileSync('api/shared/fast-auth-store.js','utf8');

test('RC1256: Auth-API enthält keinen zweiten Faktor mehr',()=>{
  assert.doesNotMatch(authApi,/MFA_ENROLL_REQUIRED|MFA_REQUIRED|MFA_REAUTH_REQUIRED/);
  assert.doesNotMatch(authApi,/mfaChallenge|mfaCode|mfaEnrollment|mfaVerifiedAt|mfaTotp/);
  assert.doesNotMatch(authApi,/Authenticator|zweiten Faktor/i);
});

test('RC1256: Session-Validierung erzwingt keinen zweiten Faktor',()=>{
  assert.doesNotMatch(authStore,/MFA_REAUTH_REQUIRED|mfaVerifiedAt|allowUnverifiedMfa/);
  assert.doesNotMatch(fastAuth,/MFA_REAUTH_REQUIRED|mfaVerifiedAt|allowUnverifiedMfa/);
  assert.doesNotMatch(stateApi,/MFA_REAUTH_REQUIRED|mfaVerifiedAt|mfaEnabled|mfaEnrolledAt/);
});

test('RC1256: vorhandene MFA-Altbestände werden bei Benutzern entfernt',()=>{
  const normalized=policy.normalizeUser({
    user:'admin.test',
    globalAdmin:true,
    mfa:{enabled:true,enrolledAt:'2026-09-24T00:00:00Z',secret:{data:'legacy-secret'}}
  },0);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized,'mfa'),false);
  const publicUser=policy.publicUser(normalized,true);
  assert.equal(Object.prototype.hasOwnProperty.call(publicUser,'mfa'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicUser,'mfaEnabled'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(publicUser,'mfaEnrolledAt'),false);
  assert.doesNotMatch(JSON.stringify(publicUser),/legacy-secret/);
});

test('RC1256: Passwort- und Rechtebasis bleibt erhalten',()=>{
  assert.equal(policy.isAdmin({globalAdmin:true}),true);
  assert.equal(policy.isPrivilegedUser({rights:{shipment:{level:'admin',functionAdmin:true}}}),true);
  assert.equal(policy.isPrivilegedUser({rights:{shipment:{level:'edit',edit:true}}}),false);
});

test('RC1256: geänderte Serverdateien sind syntaktisch gültig',()=>{
  for(const file of [
    'api/shared/user-policy.js',
    'api/shared/auth-store.js',
    'api/shared/fast-auth-store.js',
    'api/exporthub-auth/index.js',
    'api/exporthub-state/index.js'
  ]){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});
