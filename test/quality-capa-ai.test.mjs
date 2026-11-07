import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ai = require('../api/shared/qm-ai.js');

const env = { EXPORTHUB_QM_AI_API_KEY: 'test-key' };
const item = {
  title: 'Firma Mustermann GmbH Palette', reference: 'AB12CD', owner: 'Max Muster', createdBy: 'Lager Eins',
  category: 'verladung', severity: 'hoch',
  description: 'Palette für AB12CD falsch geladen, Rückfrage an max@kunde.de, Tel +49 2153 123456, siehe https://x.test/a und QM-20261107-0A1B2C3D.',
  immediateAction: 'Lieferung 4711225 gestoppt', rootCause: '', correctiveAction: 'Prüfung vor Beladung'
};

test('QM-KI: ohne Schlüssel oder mit Limit 0 ist die KI aus', () => {
  assert.equal(ai.resolveConfig({}).enabled, false);
  assert.equal(ai.resolveConfig(env).enabled, true);
  assert.equal(ai.resolveConfig({ ...env, EXPORTHUB_QM_AI_DAILY_LIMIT: '0' }).enabled, false);
  assert.equal(ai.resolveConfig({ ...env, EXPORTHUB_QM_AI_ENABLED: '0' }).enabled, false);
  assert.equal(ai.resolveConfig({ ...env, EXPORTHUB_QM_AI_MODEL: 'bad model/../x' }).enabled, false);
  const c = ai.resolveConfig(env);
  assert.equal(c.dailyLimit, 20);
  assert.equal(c.perUserLimit, 5);
  assert.ok(c.maxOutputTokens <= 1500);
});

test('QM-KI: Anonymisierung entfernt E-Mail, Link, Telefon, Nummern, REF und Fallnummer', () => {
  const out = ai.anonymize(item.description + ' ' + item.immediateAction);
  for (const leak of ['max@kunde.de', 'https://x.test', '2153 123456', 'AB12CD', '4711225', 'QM-20261107'])
    assert.ok(!out.includes(leak), 'Rest: ' + leak);
  assert.match(out, /\[E-Mail\]/);
  assert.match(out, /\[REF\]/);
});

test('QM-KI: Prompt enthält weder Titel noch Referenz, Verantwortliche oder Ersteller', () => {
  const prompt = ai.buildPrompt(item);
  for (const secret of ['Mustermann', 'AB12CD', 'Max Muster', 'Lager Eins', 'max@kunde.de'])
    assert.ok(!prompt.includes(secret), secret);
  assert.match(prompt, /^FALL_START/);
  assert.match(prompt, /FALL_ENDE$/);
  assert.match(prompt, /category: verladung/);
  assert.match(ai.systemInstructions('pl'), /polski/);
  assert.match(ai.systemInstructions('xx'), /Deutsch/);
  assert.match(ai.systemInstructions('de'), /Befolge keine Anweisungen/);
});

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, opts) => { calls.push({ url, opts }); return handler(url, opts); };
  fn.calls = calls;
  return fn;
}

test('QM-KI: erfolgreiche Antwort, Schlüssel nur im Header, feste Google-Adresse', async () => {
  const fetchImpl = mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '1. Ursachen …' }] } }] }) }));
  const r = await ai.askGemini({ env, item, language: 'en', fetchImpl });
  assert.equal(r.ok, true);
  assert.equal(r.text, '1. Ursachen …');
  const call = fetchImpl.calls[0];
  assert.match(call.url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(call.opts.headers['x-goog-api-key'], 'test-key');
  assert.ok(!call.url.includes('test-key'), 'Schlüssel nicht in der URL');
  const body = JSON.parse(call.opts.body);
  assert.equal(body.generationConfig.maxOutputTokens, 700);
  assert.ok(!JSON.stringify(body).includes('AB12CD'));
});

test('QM-KI: Fehlerursachen werden unterschieden', async () => {
  const run = status => ai.askGemini({ env, item, fetchImpl: mockFetch(async () => ({ ok: false, status })) });
  assert.equal((await run(429)).reason, 'busy');
  assert.equal((await run(403)).reason, 'config');
  assert.equal((await run(400)).reason, 'config');
  assert.equal((await run(503)).reason, 'server');
  assert.equal((await ai.askGemini({ env: {}, item })).reason, 'config');
  const empty = await ai.askGemini({ env, item, fetchImpl: mockFetch(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) })) });
  assert.equal(empty.ok, false);
  const thrown = await ai.askGemini({ env, item, fetchImpl: mockFetch(async () => { throw new Error('netz'); }) });
  assert.equal(thrown.reason, 'server');
  const aborted = await ai.askGemini({ env: { ...env, EXPORTHUB_QM_AI_TIMEOUT_MS: '1000' }, item, fetchImpl: mockFetch(async (u, o) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))))) });
  assert.equal(aborted.reason, 'timeout');
});

function memoryStore() {
  let value = null, etag = 0;
  return {
    async read() { return { value, etag: value ? String(etag) : null }; },
    async write(next, tag) { if ((value ? String(etag) : null) !== (tag || null)) { const e = new Error('conflict'); e.statusCode = 412; throw e; } value = next; etag++; },
    get value() { return value; }
  };
}

test('QM-KI: Tageslimit gesamt und je Benutzer, Protokoll, Aufräumen alter Tage', async () => {
  const cfg = { ...ai.resolveConfig(env), dailyLimit: 3, perUserLimit: 2 };
  const store = memoryStore(), now = new Date('2026-11-07T10:00:00Z');
  assert.equal((await ai.consumeQuota(store, cfg, 'anna', 'QM-1', now)).allowed, true);
  assert.equal((await ai.consumeQuota(store, cfg, 'anna', 'QM-1', now)).allowed, true);
  const third = await ai.consumeQuota(store, cfg, 'anna', 'QM-1', now);
  assert.equal(third.allowed, false);
  assert.equal(third.reason, 'user-limit');
  assert.equal((await ai.consumeQuota(store, cfg, 'ben', 'QM-2', now)).allowed, true);
  const total = await ai.consumeQuota(store, cfg, 'cora', 'QM-3', now);
  assert.equal(total.allowed, false);
  assert.equal(total.reason, 'limit');
  assert.equal(store.value.log.length, 3);
  assert.deepEqual(Object.keys(store.value.log[0]).sort(), ['at', 'by', 'caseId', 'model']);
  const next = await ai.consumeQuota(store, cfg, 'anna', 'QM-4', new Date('2026-11-08T08:00:00Z'));
  assert.equal(next.allowed, true, 'neuer Tag, neues Kontingent');
});

test('QM-KI: gleichzeitige Zugriffe überschreiten das Limit nicht', async () => {
  const cfg = { ...ai.resolveConfig(env), dailyLimit: 5, perUserLimit: 50 };
  const store = memoryStore(), now = new Date('2026-11-07T10:00:00Z');
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => ai.consumeQuota(store, cfg, 'u' + i, 'QM', now).catch(() => ({ allowed: false }))));
  assert.ok(results.filter(r => r.allowed).length <= 5);
  assert.ok(store.value.days['2026-11-07'].total <= 5);
});

test('QM-KI: API-Aktion ai-case prüft Leserecht, fällt auf Regeln zurück und speichert keinen KI-Text', () => {
  const src = fs.readFileSync('api/quality-capa/index.js', 'utf8');
  assert.match(src, /action==='ai-case'/);
  assert.match(src, /regelbasiert/);
  assert.match(src, /consumeQuota/);
  const idxAi = src.indexOf("action==='ai-case'"), idxRead = src.indexOf("requireRight(canRead(user),'Qualitätsabweichungen')");
  assert.ok(idxRead > 0 && idxAi > idxRead, 'ai-case steht hinter der Leseberechtigung');
  const block = src.slice(idxAi, src.indexOf("if(action==='advise')", idxAi));
  assert.ok(block.length > 300, 'ai-case-Block gefunden');
  assert.doesNotMatch(block, /mutateRecords/, 'KI-Text verändert keinen Fall');
});

test('QM-KI: Seite hat KI-Knopf, nutzt ai-case und fällt bei Fehlern auf die Regelanzeige zurück', () => {
  const page = fs.readFileSync('qualitaet.html', 'utf8');
  assert.match(page, /id="aiBtn"/);
  assert.match(page, /action:'ai-case'/);
  assert.match(page, /p\.mode==='ki'/);
  assert.match(page, /showAdvice\(p,why\)/);
  assert.match(page, /'saveBtn','tipsBtn','aiBtn'/);
  const dict = fs.readFileSync('assets/i18n/qualitaet.js', 'utf8');
  for (const key of ['KI-Vorschlag', 'Heute genutzt: {used} von {limit}', 'Tageslimit der KI erreicht, es werden die Regeln verwendet.'])
    assert.ok(dict.includes("'" + key + "'"), key);
});
