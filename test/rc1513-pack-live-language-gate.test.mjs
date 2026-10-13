import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const helper=readFileSync(new URL('../e2e/helpers/pack-notification-live.mjs',import.meta.url),'utf8');

test('RC1513: mutierender Pack-Live-Flow fixiert die Sprache für deutsche Textverträge',()=>{
  assert.match(
    helper,
    /page\.goto\(`\/pack\/\$\{encodeURIComponent\(token\)\}\?lang=de`/,
    'RC1499 prüft deutsche UI-Texte und muss deshalb /pack/<token>?lang=de öffnen'
  );
  assert.match(helper,/toContainText\('Entwurf gespeichert'/);
  assert.match(helper,/toContainText\('Anzahl Paletten'/);
  assert.match(helper,/toContainText\('Entwurf weiterbearbeiten'/);
});
