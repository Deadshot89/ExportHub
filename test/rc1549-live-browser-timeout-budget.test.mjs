import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config=fs.readFileSync('playwright.config.mjs','utf8');

test('RC1549: Live-Browser-Gate hat genug Budget fuer die vollstaendige Fuenf-Viewport-Matrix',()=>{
  assert.match(
    config,
    /globalTimeout\s*:\s*LIVE\s*\?\s*30\s*\*\s*60\s*\*\s*1000\s*:\s*10\s*\*\s*60\s*\*\s*1000/,
    'Live-Gate muss 30 Minuten Gesamtbudget haben; lokales Gate bleibt bei 10 Minuten.'
  );
});
