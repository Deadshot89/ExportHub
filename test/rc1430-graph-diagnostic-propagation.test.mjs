import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const reminderSource=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const mutationSource=fs.readFileSync('e2e/specs/testservice-mutation.spec.mjs','utf8');

test('RC1430 P1: sichere Graph-Upstream-Meldung erreicht die optionale Backend-Diagnose',()=>{
  assert.match(reminderSource,/upstreamMessage:text\(e&&e\.upstreamMessage\)/);
});

test('RC1430 P1: Diagnosepfad gibt weiterhin keine Token oder Secrets aus',()=>{
  const catchStart=reminderSource.lastIndexOf('catch(e)');
  const reminderBlock=catchStart>=0?reminderSource.slice(catchStart):reminderSource;
  assert.doesNotMatch(reminderBlock,/access_token|clientSecret|Authorization:|Bearer\s+/i);
});
