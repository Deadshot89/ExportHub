import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const helper=readFileSync(new URL('../e2e/helpers/pack-notification-live.mjs',import.meta.url),'utf8');

test('RC1513: mutierender Pack-Live-Flow bleibt deterministisch auf Deutsch',()=>{
  assert.match(
    helper,
    /page\.goto\(`\/pack\/\$\{encodeURIComponent\(token\)\}\?lang=de`/,
    'RC1499 TESTSERVICE-Liveflow muss /pack/<token>?lang=de öffnen'
  );
});
