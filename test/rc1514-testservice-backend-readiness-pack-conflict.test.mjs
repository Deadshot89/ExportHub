import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const packApiPath='api/pack-notification/index.js';
const playwrightPath='playwright.config.mjs';
const globalSetupPath='e2e/global-setup.mjs';
const packApi=fs.readFileSync(packApiPath,'utf8');
const playwright=fs.readFileSync(playwrightPath,'utf8');

test('RC1514: Live-Playwright startet erst nach nachweislich gesundem TESTSERVICE-State-Backend',()=>{
  assert.match(playwright,/globalSetup\s*:\s*['"]\.\/e2e\/global-setup\.mjs['"]/,'Playwright muss den RC1514-Live-Readiness-Guard vor allen Specs ausführen');
  assert.ok(fs.existsSync(globalSetupPath),'e2e/global-setup.mjs fehlt');
  const setup=fs.readFileSync(globalSetupPath,'utf8');
  assert.match(setup,/EXPORTHUB_E2E_LIVE/,'Readiness darf nur echte Live-Browserläufe blockieren');
  assert.match(setup,/\/api\/exporthub-state\?mode=health/,'Readiness muss die echte State-Health-Route prüfen');
  assert.match(setup,/response\.ok/,'Readiness muss den HTTP-Status auswerten');
  assert.match(setup,/v\.ok===true/,'Readiness muss den JSON-Health-Status auswerten');
  assert.match(setup,/v\.storageReachable===true/,'Azure Storage muss erreichbar sein');
  assert.match(setup,/v\.teamStateReadable===true/,'Team-State muss lesbar sein');
  assert.match(setup,/REQUIRED_CONSECUTIVE=2/,'ein einzelner transienter Health-Erfolg reicht nicht');
  assert.match(setup,/MAX_ATTEMPTS=24/,'Readiness muss begrenzt bleiben');
  assert.match(setup,/SLEEP_MS=5000/,'Backend-Kaltstart muss zwischen Versuchen Zeit bekommen');
  assert.match(setup,/throw new Error\(/,'dauerhaft krankes Backend muss fail-closed bleiben');
});

test('RC1514: Pack-Draft-Saves behandeln Azure 409/412 mit begrenztem Backoff statt rohem 412',()=>{
  assert.match(packApi,/const MAX_RETRIES=12;/,'Pack-State muss dieselbe robuste Retry-Tiefe wie exporthub-state verwenden');
  assert.match(packApi,/const CONFLICT_BACKOFF_BASE_MS=12;/,'Pack-State braucht einen definierten Konflikt-Backoff');
  assert.match(packApi,/function sleep\(ms\)/,'Pack-State braucht einen asynchronen Retry-Delay');
  assert.match(packApi,/function isStorageWriteConflict\(e\)/,'409/412-Erkennung muss zentral und lesbar sein');
  const start=packApi.indexOf('function defaultMutateState()');
  const end=packApi.indexOf('function validateSessionForStation',start);
  assert.ok(start>=0&&end>start,'defaultMutateState-Block fehlt');
  const mutate=packApi.slice(start,end);
  assert.match(mutate,/if\(isStorageWriteConflict\(e\)\)/,'Blob-Konflikte müssen explizit behandelt werden');
  assert.match(mutate,/attempt<MAX_RETRIES-1\)\{await sleep/,'Konflikte müssen vor dem Retry gebremst werden');
  assert.match(mutate,/Math\.min\(250,CONFLICT_BACKOFF_BASE_MS\*Math\.pow\(2,Math\.min\(attempt,4\)\)\)/,'Backoff muss begrenzt exponentiell sein');
  assert.match(mutate,/throw error\('PACK_CONCURRENT_UPDATE'/,'ausgeschöpfte Konflikte dürfen keinen rohen Azure-412 ausgeben');
});
