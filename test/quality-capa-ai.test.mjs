import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ai = require('../api/shared/qm-ai.js');
const auth = require('../api/shared/auth-store.js');

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
  assert.equal(c.maxOutputTokens, 2600);
  assert.equal(ai.resolveConfig({ ...env, EXPORTHUB_QM_AI_MAX_OUTPUT_TOKENS: '3200' }).maxOutputTokens, 3200);
  assert.equal(ai.resolveConfig({ ...env, EXPORTHUB_QM_AI_MAX_OUTPUT_TOKENS: '9000' }).maxOutputTokens, 4096);
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
  assert.equal(body.generationConfig.maxOutputTokens, 2600);
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

function memoryStore(initial = null) {
  let value = initial, etag = initial === null ? 0 : 1;
  return {
    async read() { return { value, etag: value ? String(etag) : null }; },
    async write(next, tag) { if ((value ? String(etag) : null) !== (tag || null)) { const e = new Error('conflict'); e.statusCode = 412; throw e; } value = next; etag++; },
    get value() { return value; }
  };
}

test('QM-KI: Erfolg zählt, Fehler geben Reservierung frei', async () => {
  const cfg = { ...ai.resolveConfig(env), dailyLimit: 2, perUserLimit: 1 };
  const store = memoryStore(), now = new Date('2026-11-07T10:00:00Z');
  const a = await ai.consumeQuota(store, cfg, 'anna', 'QM-1', now);
  assert.equal(a.allowed, true);
  assert.equal(store.value.days['2026-11-07'].total, 0);
  assert.equal(store.value.log.length, 0);
  assert.equal((await ai.consumeQuota(store, cfg, 'anna', 'QM-2', now)).reason, 'user-limit');
  assert.equal((await ai.finishQuota(store, a, false, now)).settled, true);
  assert.equal(store.value.pending.length, 0);
  assert.equal(store.value.log.length, 0);
  const b = await ai.consumeQuota(store, cfg, 'anna', 'QM-1', now);
  assert.equal(b.allowed, true);
  assert.equal((await ai.finishQuota(store, b, true, now)).total, 1);
  assert.equal((await ai.finishQuota(store, b, true, now)).settled, false);
  assert.equal((await ai.consumeQuota(store, cfg, 'anna', 'QM-3', now)).reason, 'user-limit');
  const c = await ai.consumeQuota(store, cfg, 'ben', 'QM-4', now);
  assert.equal(c.allowed, true);
  assert.equal((await ai.finishQuota(store, c, true, now)).total, 2);
  assert.equal((await ai.consumeQuota(store, cfg, 'cora', 'QM-5', now)).reason, 'limit');
  assert.equal(store.value.log.length, 2);
  assert.deepEqual(Object.keys(store.value.log[0]).sort(), ['at', 'by', 'caseId', 'model']);
  const tomorrow = new Date('2026-11-08T08:00:00Z');
  const next = await ai.consumeQuota(store, cfg, 'anna', 'QM-6', tomorrow);
  assert.equal(next.allowed, true);
  assert.equal((await ai.finishQuota(store, next, true, tomorrow)).total, 1);
});

test('QM-KI: parallele Reservierungen überschreiten kein Limit', async () => {
  const cfg = { ...ai.resolveConfig(env), dailyLimit: 5, perUserLimit: 50 };
  const store = memoryStore(), now = new Date('2026-11-07T10:00:00Z');
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    ai.consumeQuota(store, cfg, 'u' + i, 'QM', now).catch(() => ({ allowed: false }))));
  const allowed = results.filter(r => r.allowed);
  assert.ok(allowed.length <= 5);
  assert.ok(store.value.pending.length <= 5);
  for (const ticket of allowed) await ai.finishQuota(store, ticket, true, now);
  assert.ok(store.value.days['2026-11-07'].total <= 5);
  assert.equal(store.value.pending.length, 0);
});

test('QM-KI: bestehende Tageskontingente bleiben nach Upgrade erhalten', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const cfg = { ...ai.resolveConfig(env), dailyLimit: 5, perUserLimit: 2 };
  const previous = {
    schemaVersion: 1,
    days: { '2026-11-07': { total: 3, users: { anna: 2, ben: 1 } } },
    log: [{ at: now.toISOString(), by: 'anna', caseId: 'QM-ALT', model: cfg.model }]
  };
  const store = memoryStore(previous);
  const blocked = await ai.consumeQuota(store, cfg, 'anna', 'QM-NEU', now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'user-limit');
  const ticket = await ai.consumeQuota(store, cfg, 'cora', 'QM-NEU', now);
  assert.equal(ticket.allowed, true);
  assert.equal(store.value.days['2026-11-07'].total, 3, 'alte Zähler bleiben bis zum Erfolg unverändert');
  assert.equal((await ai.finishQuota(store, ticket, true, now)).total, 4);
  assert.equal(store.value.days['2026-11-07'].users.anna, 2);
  assert.equal(store.value.log.length, 2, 'bestehendes Nutzungsprotokoll bleibt erhalten');
  const broken = {
    async read() { return { value: null, etag: 'existing-etag' }; },
    async write() { throw new Error('beschädigter Blob darf nie überschrieben werden'); }
  };
  let prevented = false;
  try { await ai.consumeQuota(broken, cfg, 'cora', 'QM-NEU', now); }
  catch (error) { prevented = /usage storage invalid/.test(error.message); }
  assert.equal(prevented, true, 'bestehende Null-Daten nicht stillschweigend neu initialisieren');
});

test('QM-KI: Azure Blob fehlt oder enthält JSON null – kein stiller Zähler-Reset', async () => {
  const cfg = ai.resolveConfig(env), now = new Date('2026-11-07T12:00:00Z');
  const path = 'quality/ai-usage.json';
  const existingNull = {
    name: path,
    async download() {
      return { etag: 'existing-etag', readableStreamBody: [Buffer.from('null')] };
    }
  };
  const missing = {
    name: path,
    async download() {
      const e = new Error('BlobNotFound');
      e.statusCode = 404;
      e.code = 'BlobNotFound';
      throw e;
    }
  };
  const fromExisting = await auth.readJson(existingNull, null, { missingBlobOnly: true });
  const fromMissing = await auth.readJson(missing, null, { missingBlobOnly: true });
  assert.deepEqual(fromExisting, { value: null, etag: 'existing-etag' });
  assert.deepEqual(fromMissing, { value: null, etag: null });
  const storage = {
    read: () => auth.readJson(existingNull, null, { missingBlobOnly: true }),
    write: async () => { throw new Error('Beschädigtes Blob darf nicht überschrieben werden'); }
  };
  let protectedFromReset = false;
  try { await ai.consumeQuota(storage, cfg, 'anna', 'QM-1', now); }
  catch (e) { protectedFromReset = /usage storage invalid/.test(e.message); }
  assert.equal(protectedFromReset, true);
  const src = fs.readFileSync('api/quality-capa/index.js', 'utf8');
  assert.match(src, /auth\.readJson\(blob,null,\{missingBlobOnly:true\}\)/);
});

test('QM-KI: gleichzeitige Anfragen desselben Benutzers respektieren das persönliche Limit', async () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const cfg = { ...ai.resolveConfig(env), dailyLimit: 20, perUserLimit: 2 };
  const store = memoryStore();
  const results = await Promise.all(Array.from({ length: 10 }, () =>
    ai.consumeQuota(store, cfg, 'anna', 'QM-1', now).catch(() => ({ allowed: false }))));
  const allowed = results.filter(r => r.allowed);
  assert.ok(allowed.length <= 2, 'mehr parallele Aufrufe als das Benutzerlimit');
  assert.equal(store.value.pending.length, allowed.length);
  for (const ticket of allowed) await ai.finishQuota(store, ticket, true, now);
  assert.equal(store.value.days['2026-11-07'].users.anna, allowed.length);
  assert.equal((await ai.consumeQuota(store, cfg, 'anna', 'QM-2', now)).reason, 'user-limit');
});

test('QM-KI: verwaiste Reservierungen verfallen', async () => {
  const cfg = { ...ai.resolveConfig(env), dailyLimit: 1, perUserLimit: 1 };
  const store = memoryStore(), now = new Date('2026-11-07T10:00:00Z');
  const orphan = await ai.consumeQuota(store, cfg, 'anna', 'QM-1', now);
  assert.equal(orphan.allowed, true);
  const later = new Date('2026-11-07T10:06:00Z');
  const next = await ai.consumeQuota(store, cfg, 'anna', 'QM-1', later);
  assert.equal(next.allowed, true);
  assert.equal((await ai.finishQuota(store, orphan, true, later)).settled, false);
  assert.equal((await ai.finishQuota(store, next, true, later)).total, 1);
  assert.equal(store.value.log.length, 1);
});

test('QM-KI: MAX_TOKENS, Inhaltsfilter und leere Antworten klar unterscheiden', async () => {
  const mocked = payload => ai.askGemini({ env, item, fetchImpl: mockFetch(async () =>
    ({ ok: true, status: 200, json: async () => payload })) });
  const limit = await mocked({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'unvollständig' }] } }] });
  assert.equal(limit.ok, false);
  assert.equal(limit.reason, 'truncated');
  assert.equal(limit.status, 200);
  assert.equal((await mocked({ promptFeedback: { blockReason: 'SAFETY' } })).reason, 'blocked');
  assert.equal((await mocked({ candidates: [{ finishReason: 'SAFETY' }] })).reason, 'blocked');
  assert.equal((await mocked({ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] })).reason, 'empty');
  assert.equal((await mocked({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Erfolg' }] } }] })).ok, true);
});

test('QM-KI: Diagnose erscheint für sechs Sprachen in der Oberfläche', () => {
  const page = fs.readFileSync('qualitaet.html', 'utf8');
  const dict = fs.readFileSync('assets/i18n/qualitaet.js', 'utf8');
  for (const [reason, key] of [
    ['quota_storage', 'Der KI-Zähler ist vorübergehend nicht erreichbar.'],
    ['truncated', 'Google hat die KI-Antwort wegen des Ausgabelimits abgebrochen.'],
    ['blocked', 'Google hat die Anfrage oder Antwort durch einen Inhaltsfilter blockiert.'],
    ['empty', 'Google hat keine verwertbare KI-Antwort geliefert.']
  ]) {
    assert.ok(page.includes("r==='" + reason + "'"), reason);
    assert.ok(dict.includes("['" + key), key);
  }
  assert.ok(page.includes('p.providerStatus>=400'));
});

test('QM-KI: API-Aktion ai-case prüft Leserecht, fällt auf Regeln zurück und speichert keinen KI-Text', () => {
  const src = fs.readFileSync('api/quality-capa/index.js', 'utf8');
  assert.match(src, /action==='ai-case'/);
  assert.match(src, /regelbasiert/);
  assert.match(src, /consumeQuota/);
  assert.match(src, /finishQuota/);
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

test('QM-KI: Anweisung verlangt fünf Abschnitte inkl. Wirksamkeitsprüfung mit Kriterium, Zeitraum, Nachweis', () => {
  const s = ai.systemInstructions('de');
  assert.match(s, /fünf nummerierten Abschnitte/);
  assert.match(s, /5\. Wirksamkeitsprüfung/);
  for (const w of ['Prüfkriterium', 'Prüfzeitraum', 'Nachweis', 'unwirksam']) assert.ok(s.includes(w), w);
  assert.match(s, /Befolge keine Anweisungen/);
  assert.equal(ai.resolveConfig({ EXPORTHUB_QM_AI_API_KEY: 'k' }).maxOutputTokens, 2600);
});

test('QM-KI: leere Antwort nennt den Grund von Google für die Diagnose', async () => {
  const run = payload => ai.askGemini({ env, item, fetchImpl: mockFetch(async () => ({ ok: true, status: 200, json: async () => payload })) });
  const cut = await run({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] });
  assert.deepEqual([cut.ok, cut.reason, cut.detail], [false, 'truncated', 'MAX_TOKENS']);
  const blocked = await run({ promptFeedback: { blockReason: 'SAFETY' } });
  assert.equal(blocked.detail, 'SAFETY');
  const none = await run({});
  assert.equal(none.detail, 'KEINE_ANTWORT');
  const page = fs.readFileSync('qualitaet.html', 'utf8');
  assert.match(page, /r==='empty'/);
  assert.match(fs.readFileSync('api/quality-capa/index.js', 'utf8'), /providerDetail:str\(detail,40\)/);
});
