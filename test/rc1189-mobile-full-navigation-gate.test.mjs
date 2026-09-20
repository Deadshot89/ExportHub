import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nav=fs.readFileSync('e2e/specs/navigation.spec.mjs','utf8');
const config=fs.readFileSync('playwright.config.mjs','utf8');

test('RC1189: vollständige Hauptnavigation läuft auf allen Playwright-Viewports',()=>{
  assert.match(nav,/const\s+views=\[\.\.\.coreViews,\.\.\.wideViews\]/);
  assert.doesNotMatch(nav,/\['laptop','desktop'\]\.includes\(testInfo\.project\.name\).*wideViews/s);
  for(const module of ['shipmentview','documents','warehouse','customs','exams']){
    assert.ok(nav.includes("['"+module+"'"),module+' fehlt in wideViews');
  }
});

test('RC1189: verpflichtende Smartphone-, Tablet- und Desktop-Matrix bleibt aktiv',()=>{
  for(const profile of ['mobile-small','mobile-standard','tablet','laptop','desktop']){
    assert.ok(config.includes("name:'"+profile+"'"),profile+' fehlt in Playwright-Matrix');
  }
});
