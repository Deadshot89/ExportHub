import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const endpoint=fs.readFileSync(new URL('../api/customs-ai/index.js',import.meta.url),'utf8');
const route=JSON.parse(fs.readFileSync(new URL('../api/customs-ai/function.json',import.meta.url),'utf8'));

test('RC1532 API: eigener read-only POST-Endpunkt mit bestehender Session-Authentifizierung',()=>{
  assert.match(endpoint,/require\(['"]\.\.\/shared\/fast-auth-store['"]\)/);
  assert.match(endpoint,/validateSession\(req\)/);
  assert.match(endpoint,/require\(['"]\.\.\/shared\/customs-ai-service['"]\)/);
  assert.match(endpoint,/answerCustomsQuestion\(/);
  const trigger=route.bindings.find(binding=>binding.type==='httpTrigger');
  assert.deepEqual(trigger.methods,['post','options']);
  assert.equal(trigger.route,'customs-ai');
});

test('RC1532 API: kein Schreibmodul und kein State-Mutationspfad im KI-Endpunkt',()=>{
  assert.doesNotMatch(endpoint,/saveState|writeState|mergeState|updateState|deleteState|createShipment|abdRequests\s*\.(?:push|splice)|blob.*upload/i);
  assert.doesNotMatch(endpoint,/require\(['"]\.\.\/shared\/(?:state|secure-merge|state-write)/i);
  assert.match(endpoint,/Cache-Control['"]?:['"]no-store/i);
});

test('RC1532 API: Rate-Limit und maximale Fragegröße sind serverseitig erzwungen',()=>{
  assert.match(endpoint,/RATE_WINDOW_MS/);
  assert.match(endpoint,/RATE_MAX/);
  assert.match(endpoint,/QUESTION_TOO_LONG|2_?000|2000/);
});

test('RC1532 API: Antwort gibt niemals Provider-Key oder Rohkontext direkt zurück',()=>{
  assert.doesNotMatch(endpoint,/EXPORTHUB_CUSTOMS_AI_API_KEY|OPENAI_API_KEY/);
  assert.doesNotMatch(endpoint,/process\.env/);
  assert.doesNotMatch(endpoint,/JSON\.stringify\(payload\)/);
});
