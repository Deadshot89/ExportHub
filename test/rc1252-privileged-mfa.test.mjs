import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url);
const mfa=require('../api/shared/mfa-totp.js');
const policy=require('../api/shared/user-policy.js');
const authApi=fs.readFileSync('api/exporthub-auth/index.js','utf8');
const authStore=fs.readFileSync('api/shared/auth-store.js','utf8');
const stateApi=fs.readFileSync('api/exporthub-state/index.js','utf8');
const fastAuth=fs.readFileSync('api/shared/fast-auth-store.js','utf8');
const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');
const config=JSON.parse(fs.readFileSync('staticwebapp.config.json','utf8'));

test('RC1252: TOTP folgt dem RFC-SHA1-Vektor und blockiert Replay',()=>{
  const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(mfa.codeForCounter(secret,1),'287082');
  assert.equal(mfa.verifyCode(secret,'287082',59000,-1),1);
  assert.equal(mfa.verifyCode(secret,'287082',59000,1),null);
});

test('RC1252: TOTP-Secret wird verschlüsselt gespeichert und korrekt entschlüsselt',()=>{
  const secret=mfa.generateSecret(),root='unit-test-signing-secret';
  const sealed=mfa.sealSecret(secret,root);
  assert.equal(sealed.alg,'aes-256-gcm');
  assert.notEqual(sealed.data,secret);
  assert.doesNotMatch(JSON.stringify(sealed),new RegExp(secret));
  assert.equal(mfa.openSecret(sealed,root),secret);
  assert.match(mfa.enrollmentUri('admin.user',secret),/^otpauth:\/\/totp\/ExportHUB%3Aadmin\.user\?/);
});

test('RC1252: MFA gilt nur für globale und Funktions-Admins',()=>{
  assert.equal(policy.isPrivilegedUser({globalAdmin:true}),true);
  assert.equal(policy.isPrivilegedUser({rights:{shipment:{level:'admin',functionAdmin:true}}}),true);
  assert.equal(policy.isPrivilegedUser({rights:{shipment:{level:'edit',edit:true}}}),false);
});

test('RC1252: Auth-API erzwingt Challenge, Fehlversuchssperre und Resetpfade',()=>{
  assert.match(authApi,/MFA_ENROLL_REQUIRED/);
  assert.match(authApi,/MFA_REQUIRED/);
  assert.match(authApi,/mfaTotp\.verifyCode/);
  assert.match(authApi,/failedAttempts >= 5/);
  assert.match(authApi,/15 \* 60 \* 1000/);
  assert.match(authApi,/MFA_RESET_BY_ADMIN/);
  assert.match(authApi,/MFA_RESET_BY_RECOVERY/);
  assert.match(authApi,/mfaVerified: outcome\.mfaVerified === true/);
});

test('RC1252: privilegierte Sessions benötigen MFA, TESTSERVICE-E2E bleibt isoliert',()=>{
  assert.match(authStore,/MFA_REAUTH_REQUIRED/);
  assert.match(authStore,/isPrivilegedUser\(user\).*?!session\.mfaVerifiedAt/s);
  assert.match(authStore,/testserviceE2E/);
  assert.match(authStore,/mfaVerifiedAt:/);
  assert.match(stateApi,/MFA_REAUTH_REQUIRED/);
  assert.match(stateApi,/testserviceE2E/);
  assert.match(fastAuth,/MFA_REAUTH_REQUIRED/);
  assert.match(fastAuth,/isSignedTestserviceE2E/);
  assert.match(stateApi,/['"]mfa['"]\]\.forEach/);
  assert.doesNotMatch(stateApi,/return u;\s*}\s*function publicUsers[\s\S]{0,200}mfa\.secret/);
});

test('RC1252: Client erhält nur MFA-Status, niemals MFA-Secret',()=>{
  const user=policy.publicUser({user:'admin',globalAdmin:true,mfa:{enabled:true,enrolledAt:'2026-09-24T00:00:00Z',secret:{data:'cipher'}}},true);
  assert.equal(user.mfaEnabled,true);
  assert.equal(user.mfaEnrolledAt,'2026-09-24T00:00:00Z');
  assert.equal(Object.prototype.hasOwnProperty.call(user,'mfa'),false);
  assert.doesNotMatch(JSON.stringify(user),/cipher/);
});

test('RC1252: Login-Runtime ergänzt Authenticator-Code ohne Legacy-Login umzubauen',()=>{
  assert.match(runtime,/rc1252InstallFetch/);
  assert.match(runtime,/mfaChallenge:rc1252Mfa\.challenge/);
  assert.match(runtime,/autocomplete='one-time-code'|autocomplete='one-time-code'|autocomplete='one-time-code'/);
  assert.match(runtime,/Zweiten Faktor einrichten/);
  assert.match(runtime,/Authenticator-Code/);
  assert.match(runtime,/ExportHUBRC1252Mfa/);
  const route=config.routes.find(r=>r.route==='/assets/rc1074-login-clean.js');
  assert.ok(route);
  assert.match(String(route.headers&&route.headers['Cache-Control']||''),/no-store/);
});

test('RC1252: geänderte Server- und Browser-Runtimes sind syntaktisch gültig',()=>{
  for(const file of ['api/shared/mfa-totp.js','api/shared/user-policy.js','api/shared/auth-store.js','api/shared/fast-auth-store.js','api/exporthub-auth/index.js','api/exporthub-state/index.js','assets/rc1074-login-clean.js']){
    execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
});


test('RC1253: Produktionsruntime trägt den P0-MFA-Enrollment-Rolloutmarker',()=>{
  const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');
  assert.match(runtime,/__EXPORTHUB_RC1253_MFA_ENROLLMENT_UI__/);
  assert.match(runtime,/mfaEnrollmentSecret/);
  assert.match(runtime,/mfaEnrollmentUri/);
  assert.match(runtime,/6-stelliger Authenticator-Code/);
});


test('RC1254: nativer Login-Pfad verarbeitet MFA-Ersteinrichtung direkt',()=>{
  const runtime=fs.readFileSync('assets/rc1074-login-clean.js','utf8');
  const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
  assert.match(runtime,/function rc1252Prepare\(body\)/);
  assert.match(runtime,/function rc1252HandleError\(error\)/);
  assert.match(runtime,/capture:rc1252Capture,prepare:rc1252Prepare,handleError:rc1252HandleError/);
  assert.match(runtime,/data-rc1252-signature/);
  assert.match(build,/function patchMfaLoginFlow\(html,file\)/);
  assert.match(build,/ExportHUBRC1252Mfa\.prepare\(body\)/);
  assert.match(build,/ExportHUBRC1252Mfa\.handleError\(e\)/);
  assert.match(build,/err\.data=data/);
});
