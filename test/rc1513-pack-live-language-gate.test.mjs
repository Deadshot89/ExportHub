import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const helper=readFileSync(new URL('../e2e/helpers/pack-notification-live.mjs',import.meta.url),'utf8');

test('RC1513: mutierender Pack-Live-Flow fixiert Deutsch ohne fragile Textassertions',()=>{
  assert.match(
    helper,
    /page\.goto\(`\/pack\/\$\{encodeURIComponent\(token\)\}\?lang=de`/,
    'RC1499 muss /pack/<token>?lang=de öffnen, damit sprachabhängige UI-Aktionen deterministisch bleiben'
  );
  for(const staleText of ['Entwurf gespeichert','Anzahl Paletten','Entwurf weiterbearbeiten']){
    assert.doesNotMatch(
      helper,
      new RegExp(`toContainText\\(['\"]${staleText}['\"]`),
      `RC1513 darf den robusten semantischen Live-Nachweis nicht wieder an den UI-Text „${staleText}“ koppeln`
    );
  }
});
