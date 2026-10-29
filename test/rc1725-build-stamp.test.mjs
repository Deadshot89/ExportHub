import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// RC1725: the version display shows the really deployed build (release date + commit) from
// /api/exporthub-health instead of only the RC number, which stays the same across releases.

const i18nSource = fs.readFileSync(new URL('../assets/i18n/rc1725-build-stamp.js', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../assets/rc1725-build-stamp.js', import.meta.url), 'utf8');
const builder = fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs', import.meta.url), 'utf8');

function load({ language = 'de', fetchBody = null } = {}) {
  const calls = [];
  const document = {
    readyState: 'complete',
    head: null,
    body: null,
    documentElement: { setAttribute() {} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  const window = {
    document,
    __EXPORTHUB_VISIBLE_RELEASE_VERSION__: 'RC1370',
    EXPORTHUB_BUILD: { version: 'RC1112' },
    ExportHUBI18n: { language: () => language },
    setTimeout: () => 1,
    addEventListener() {},
    fetch: (url, options) => {
      calls.push({ url, options });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(fetchBody) });
    }
  };
  const context = vm.createContext({ window, document, globalThis: window, Date, Promise, Object, String, isNaN });
  vm.runInContext(i18nSource, context);
  vm.runInContext(source, context);
  return { api: window.ExportHUBBuildStamp1725, calls };
}

const verified = {
  verified: true,
  buildId: 'ece0f2138771a4d9bb95253c2736d3c43d4130e7',
  builtAt: '2026-10-29T17:12:00.000Z',
  environment: 'production'
};

test('RC1725: Stand zeigt Release-Datum (Berliner Zeit) und kurze Build-Kennung', () => {
  const { api } = load();
  assert.ok(api._setDeploymentForTest(verified));
  assert.equal(api.stampText(), 'Stand 29.10.2026, 18:12 · Build ece0f21');
  assert.equal(api.loginText(), 'Version RC1370 · Stand 29.10.2026, 18:12 · Build ece0f21');
});

test('RC1725: ohne verifizierte Deployment-Daten wird nichts angezeigt', () => {
  const { api } = load();
  assert.equal(api._setDeploymentForTest({ ...verified, verified: false }), null);
  assert.equal(api.stampText(), '');
  assert.equal(api._setDeploymentForTest({ ...verified, buildId: 'nicht-hex' }), null);
  assert.equal(api._setDeploymentForTest({ ...verified, builtAt: 'kaputt' }), null);
  assert.equal(api.loginText(), '');
});

test('RC1725: Build-Stand kommt live und ungecacht von /api/exporthub-health', async () => {
  const { api, calls } = load({ fetchBody: { ok: true, deployment: verified } });
  const deployment = await api.load();
  assert.equal(deployment.shortId, 'ece0f21');
  assert.ok(calls.length >= 1);
  assert.match(calls[0].url, /^\/api\/exporthub-health\?rc1725=\d+$/);
  assert.equal(calls[0].options.cache, 'no-store');
});

test('RC1725: Texte gibt es in allen sechs Sprachen', () => {
  for (const language of ['de', 'en', 'fr', 'it', 'es', 'pl']) {
    const { api } = load({ language });
    api._setDeploymentForTest(verified);
    assert.match(api.stampText(), /ece0f21$/, language);
    assert.match(api.loginText(), /RC1370/, language);
  }
  const sandbox = {};
  vm.runInContext(i18nSource, vm.createContext({ window: sandbox }));
  const packs = sandbox.ExportHUBBuildStamp1725I18n.packs;
  const keys = Object.keys(packs.de).sort();
  for (const language of Object.keys(packs)) assert.deepEqual(Object.keys(packs[language]).sort(), keys, language);
});

test('RC1725: technischer Marker RC1112 wird nur in Update-Seite und Release-Center ersetzt', () => {
  assert.match(source, /\.rc524-update-card b,\.rc524-update-card span,\.rc562-release-card strong/);
  assert.match(source, /data-rc1725-technical/);
  assert.doesNotMatch(source, /innerHTML/);
});

test('RC1725: Builder liefert Skript und Texte in allen drei Umgebungen aus', () => {
  assert.match(builder, /\/assets\/i18n\/rc1725-build-stamp\.js\?v=1725/);
  assert.match(builder, /\/assets\/rc1725-build-stamp\.js\?v=1725/);
  assert.match(builder, /'assets\/rc1725-build-stamp\.js',\n  'assets\/i18n\/rc1725-build-stamp\.js',/);
  assert.match(builder, /RC1725 Build-Stand fehlt/);
});
