'use strict';

process.env.EXPORTHUB_SESSION_MAX_HOURS='12';
process.env.EXPORTHUB_SESSION_IDLE_MINUTES='30';
process.env.EXPORTHUB_SESSION_TOUCH_MINUTES='5';
process.env.EXPORTHUB_AUTH_SIGNING_SECRET='rc1115-test-signing-secret';

const test=require('node:test');
const assert=require('node:assert/strict');
const auth=require('../../api/shared/auth-store');

function iso(ms){return new Date(ms).toISOString()}

test('RC1115: aktive Sitzung bleibt innerhalb von Maximal- und Inaktivitätsgrenze gültig',()=>{
  const now=Date.now();
  const session={
    createdAt:iso(now-60*60*1000),
    lastSeenAt:iso(now-10*60*1000),
    expiresAt:iso(now+2*60*60*1000)
  };
  assert.equal(auth.sessionIsActive(session,now),true);
});

test('RC1115: 30 Minuten Inaktivität beendet die Sitzung serverseitig',()=>{
  const now=Date.now();
  const session={
    createdAt:iso(now-60*60*1000),
    lastSeenAt:iso(now-31*60*1000),
    expiresAt:iso(now+2*60*60*1000)
  };
  assert.equal(auth.sessionIsActive(session,now),false);
  assert.ok(auth.sessionIdleExpiresAt(session)<=now);
});

test('RC1115: absolute Sitzungsdauer ist auf 12 Stunden begrenzt',()=>{
  const now=Date.now();
  const session={
    createdAt:iso(now-13*60*60*1000),
    lastSeenAt:iso(now-2*60*1000),
    expiresAt:iso(now+60*60*1000)
  };
  assert.equal(auth.sessionIsActive(session,now),false);
  assert.ok(auth.sessionAbsoluteExpiresAt(session)<=now);
});

test('RC1115: Legacy-Sitzung ohne lastSeenAt fällt sicher auf createdAt zurück',()=>{
  const now=Date.now();
  const session={
    createdAt:iso(now-31*60*1000),
    expiresAt:iso(now+60*60*1000)
  };
  assert.equal(auth.sessionIsActive(session,now),false);
});

test('RC1115: signierte Sitzung übernimmt die verkürzte absolute Laufzeit',()=>{
  const now=Date.now();
  const session={
    id:'SES-RC1115',
    userId:'USER-RC1115',
    username:'Tester',
    createdAt:iso(now),
    lastSeenAt:iso(now),
    expiresAt:iso(now+12*60*60*1000),
    authVersion:1,
    mustChange:false,
    deviceId:'test'
  };
  const token=auth.createSignedSessionToken(session);
  const parsed=auth.verifySignedSessionToken(token);
  assert.ok(parsed);
  assert.equal(parsed.uid,'USER-RC1115');
  assert.ok(parsed.exp-parsed.iat<=12*60*60*1000+1000);
});

test('RC1115: Passwortstandard verlangt mindestens 10 Zeichen',()=>{
  assert.match(auth.passwordPolicy('Aa123456'),/10 Zeichen/);
  assert.equal(auth.passwordPolicy('Abcdef1234'),'');
});
