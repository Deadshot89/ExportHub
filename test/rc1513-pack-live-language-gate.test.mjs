import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const helper=readFileSync(new URL('../e2e/helpers/pack-notification-live.mjs',import.meta.url),'utf8');

test('RC1513: mutierender Pack-Live-Flow fixiert die Sprache fuer sichtbare deutsche Auswahl',()=>{
  assert.match(
    helper,
    /page\.goto\(`\/pack\/\$\{encodeURIComponent\(token\)\}\?lang=de`/,
    'RC1499 nutzt sichtbare deutsche Auswahltexte und muss deshalb /pack/<token>?lang=de oeffnen'
  );
  assert.match(
    helper,
    /page\.locator\('#packPackageType'\)\.selectOption\(\{label:'Euro Palette'\}\)/,
    'der Live-Flow nutzt mit Euro Palette weiterhin einen sichtbaren deutschen Auswahltext'
  );
});
