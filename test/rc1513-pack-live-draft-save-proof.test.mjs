import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const helper=fs.readFileSync('e2e/helpers/pack-notification-live.mjs','utf8');

test('RC1513: Pack-Live-Gate proves draft-save by HTTP response and persisted draft id instead of transient translated text',()=>{
  assert.match(helper,/waitForResponse\(/,'live flow must wait for the real draft-save response');
  assert.match(helper,/searchParams\.get\('action'\)===['"]draft-save['"]/,'response predicate must target only draft-save');
  assert.match(helper,/saveResponse\.ok\(\)/,'draft-save HTTP status must be asserted');
  assert.match(helper,/savePayload\?\.ok/,'draft-save JSON success must be asserted');
  assert.match(helper,/savePayload\?\.draft\?\.id/,'server-persisted draft id must be required');
  assert.match(helper,/getAttribute\('data-draft-id'\)/,'draft card id must be compared with the server-persisted id');
});

test('RC1513: Pack-Live-Gate is locale-independent around draft save and reopen',()=>{
  for(const staleText of ['Entwurf gespeichert','Anzahl Paletten','Entwurf weiterbearbeiten']){
    assert.doesNotMatch(helper,new RegExp(staleText),`live helper must not depend on translated text: ${staleText}`);
  }
});
