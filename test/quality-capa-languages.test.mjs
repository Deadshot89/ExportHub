import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const page = fs.readFileSync('qualitaet.html', 'utf8');
const i18nSrc = fs.readFileSync('assets/i18n/qualitaet.js', 'utf8');
const linkSrc = fs.readFileSync('assets/shipment-error-report.js', 'utf8');
const build = fs.readFileSync('.github/rc1112/build-three-env.mjs', 'utf8');
const LANGS = ['de', 'en', 'pl', 'es', 'fr', 'it'];

function loadI18n(search = '', stored = '') {
  const win = { location: { href: 'https://x.test/qualitaet.html' + search }, localStorage: { getItem: () => stored, setItem() {} }, URL };
  win.window = win;
  win.document = { readyState: 'complete', body: null, documentElement: { setAttribute() {} }, addEventListener() {} };
  vm.runInNewContext(i18nSrc, win);
  return win.ExportHUBQualityI18n;
}

test('QM-Seite: jeder Text hat alle sechs Sprachen mit gleichen Platzhaltern', () => {
  const api = loadI18n();
  assert.deepEqual(Array.from(api.languages), LANGS);
  assert.ok(api.entries.length > 120);
  const ph = s => (String(s).match(/\{[a-z]+\}/g) || []).sort().join();
  for (const row of api.entries) {
    assert.equal(row.length, 6, row[0]);
    row.forEach((cell, i) => assert.ok(String(cell).trim(), LANGS[i] + ': ' + row[0]));
    row.slice(1).forEach(cell => assert.equal(ph(cell), ph(row[0]), row[0]));
  }
});

test('QM-Seite: Sprache aus URL, sonst gespeicherte Sprache, sonst Deutsch', () => {
  assert.equal(loadI18n('?lang=pl').language(), 'pl');
  assert.equal(loadI18n('', 'fr').language(), 'fr');
  assert.equal(loadI18n('?lang=xx').language(), 'de');
  const en = loadI18n('?lang=en');
  assert.equal(en.t('Fall speichern'), 'Save case');
  assert.equal(en.t('{n} Anhänge gespeichert', { n: 3 }), '3 attachment(s) saved');
  assert.equal(en.t('Unbekannter Text'), 'Unbekannter Text', 'unbekannte Texte bleiben unverändert');
  assert.equal(loadI18n().t('Fall speichern'), 'Fall speichern');
});

test('QM-Seite: Seitenskript nutzt T() für Meldungen, Sprachwahl und Meldeformular ohne Leserecht', () => {
  assert.match(page, /<script src="\/assets\/i18n\/qualitaet\.js\?v=1"><\/script>/);
  assert.match(page, /id="langSelect"/);
  for (const l of ['de', 'en', 'pl', 'es', 'fr', 'it']) assert.match(page, new RegExp('<option value="' + l + '">'));
  assert.match(page, /T\('Nicht gespeicherte Änderungen verwerfen\?'\)/);
  assert.match(page, /e\.code==='FORBIDDEN'\)\{showReportOnly\(\)/);
  assert.match(page, /action:'report'/);
  assert.doesNotMatch(page, /'de-DE'/, 'Datumsformat folgt der Sprache');
  const scripts = [...page.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code));
});

test('QM-Seite: ?ref= wird nur als gültige Sendungsreferenz übernommen', () => {
  assert.match(page, /\[A-Za-z0-9\]\{6\}/);
  assert.match(page, /form\.elements\.reference\.value=refParam/);
});

test('Sendungsansicht: Link „Fehler melden“ öffnet QM-Seite mit REF und Sprache', () => {
  const doc = { body: null, readyState: 'complete', addEventListener() {}, querySelector: () => null };
  const packWin = { document: {} };
  packWin.window = packWin;
  vm.runInNewContext(fs.readFileSync('assets/i18n/shipment-error-report.js', 'utf8'), packWin);
  const win = { ExportHUBShipmentErrorReportI18n: packWin.ExportHUBShipmentErrorReportI18n, __EXPORTHUB_RC776_VIEW_SHIPMENT__: { ref: 'ab12cd' }, ExportHUBI18n: { language: () => 'en' }, document: doc, requestAnimationFrame: f => f() };
  win.window = win;
  vm.runInNewContext(linkSrc, Object.assign(win, { document: doc }));
  const api = win.ExportHUBShipmentErrorReport;
  assert.equal(api.reportUrl(), '/qualitaet.html?lang=en&ref=AB12CD');
  win.__EXPORTHUB_RC776_VIEW_SHIPMENT__ = { ref: '<script>' };
  assert.equal(api.reportUrl(), '/qualitaet.html?lang=en', 'ungültige REF wird nicht angehängt');
  for (const l of LANGS) assert.ok(packWin.ExportHUBShipmentErrorReportI18n.packs[l].button, l);
  assert.match(linkSrc, /window\.open\(reportUrl\(\),'_blank','noopener'\)/);
});

test('Build und Routing liefern Sprachmodul und Sendungs-Link in allen Umgebungen aus', () => {
  assert.match(build, /assets\/shipment-error-report\.js\?v=1/);
  assert.match(build, /'assets\/shipment-error-report\.js',/);
  assert.match(build, /'assets\/i18n\/shipment-error-report\.js',/);
  assert.match(build, /'assets\/i18n\/qualitaet\.js',/);
  const cfg = JSON.parse(fs.readFileSync('staticwebapp.config.json', 'utf8'));
  for (const route of ['/assets/shipment-error-report.js', '/assets/i18n/qualitaet.js'])
    assert.ok(cfg.routes.some(r => r.route === route), route);
});
