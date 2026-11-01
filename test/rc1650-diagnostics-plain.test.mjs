import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

// RC1650: Fehlerdiagnose in Klartext – plain title, urgency, "Was bedeutet das?" / "Was solltest du tun?"
// for every message type, plus "KI-Korrektur anstoßen" via "Selbst korrigieren".

const require = createRequire(import.meta.url);
require('../assets/i18n/rc1650-diagnostics-plain.js');
require('../assets/rc1650-diagnostics-plain.js');
const plain = globalThis.ExportHUBDiagnosticsPlain;
const packs = globalThis.ExportHUBDiagnosticsPlain1650I18n.packs;

test('RC1650: technische Meldungen werden der richtigen Erklärung zugeordnet', () => {
  const kind = (message, category = '', level = 'error') => plain.classify({ message, category, level });
  assert.deepEqual(kind('Netzwerkfehler bei GET /api/pickup-status', 'network'), { kind: 'network', thing: 'pickupStatus' });
  assert.equal(kind('HTTP 500 bei POST /api/exporthub-document', 'network').kind, 'server');
  assert.equal(kind('HTTP 503 bei GET /api/exporthub-health', 'network').kind, 'unavailable');
  assert.equal(kind('HTTP 404 bei GET /release-assets.json', 'network').thing, 'release');
  assert.equal(kind('HTTP 401 bei POST /api/exporthub-auth', 'network').kind, 'auth');
  assert.equal(kind('HTTP 409 bei POST /api/exporthub-state?mode=save', 'network').kind, 'conflict');
  assert.equal(kind('HTTP 400 bei POST /api/exporthub-state?mode=recovery-preview-customers', 'network').kind, 'rejected');
  assert.deepEqual(kind('Langsamer API-Aufruf: POST /api/exporthub-state?mode=save&ack=1', 'performance', 'warning'), { kind: 'slow', thing: 'save' });
  assert.equal(kind('Browser-Hänger / Long Task', 'performance', 'warning').kind, 'freeze');
  assert.equal(kind('Großer Render-Vorgang: Gesamtbereich update', 'performance', 'warning').kind, 'render');
  assert.equal(kind('Ressource konnte nicht geladen werden: SCRIPT', 'resource').kind, 'resource');
  assert.equal(kind("TypeError: Cannot read properties of undefined (reading 'colli')", 'javascript').kind, 'code');
  assert.equal(kind('Kunden-Historienprüfung nicht abgeschlossen · DEMO_STATE_REQUIRED · Für die Demo-Speicherung fehlt ein gültiger State.', 'console', 'warning').kind, 'demo');
  assert.equal(kind('Irgendetwas Neues', 'system', 'error').kind, 'unknown');
});

test('RC1650: Dringlichkeit richtet sich nach Art, Häufigkeit und Anzahl der Benutzer', () => {
  assert.equal(plain.urgencyOf('code', 1, 1), 'high');
  assert.equal(plain.urgencyOf('server', 1, 1), 'high');
  assert.equal(plain.urgencyOf('network', 3, 1), 'low', 'ein seltener Verbindungsabbruch ist harmlos');
  assert.equal(plain.urgencyOf('network', 978, 2), 'watch');
  assert.equal(plain.urgencyOf('unavailable', 25, 1), 'high');
  assert.equal(plain.urgencyOf('freeze', 400, 4), 'low');
  assert.equal(plain.urgencyOf('unknown', 1, 1, 'error'), 'watch');
});

test('RC1650: Zusammenfassung sortiert Wichtiges nach oben und nutzt dieselben Gruppen wie RC871', () => {
  const rows = [
    { level: 'warning', category: 'performance', message: 'Browser-Hänger / Long Task', count: 400, user: 'Tobias', area: 'abd' },
    { level: 'error', category: 'network', message: 'Netzwerkfehler bei GET /api/pickup-status', count: 900, user: 'Amer', area: 'dashboard' },
    { level: 'error', category: 'network', message: 'Netzwerkfehler bei GET /api/pickup-status', count: 78, user: 'Sikandar', area: 'pallet' },
    { level: 'error', category: 'javascript', message: 'TypeError: x is not a function', count: 2, user: 'Amer', area: 'cmr' },
    { level: 'info', category: 'navigation', message: 'Ansicht gewechselt', count: 50 }
  ];
  const s = plain.summarize(rows);
  assert.deepEqual(s.counts, { high: 1, watch: 1, low: 1 }, 'Info-Einträge zählen nicht mit');
  assert.equal(s.items[0].info.kind, 'code');
  assert.equal(s.top.length, 2, '„Zuerst ansehen“ zeigt nur Wichtiges und Beobachten');
  const net = s.items.find((i) => i.info.kind === 'network').group;
  assert.equal(net.total, 978);
  assert.deepEqual(net.users, ['Amer', 'Sikandar']);
  assert.equal(net.key, 'error|network|netzwerkfehler bei get /api/pickup-status', 'Schlüssel = data-rc871-diag-group');
});

test('RC1650: Erklärungen gibt es für jede Art in allen 6 Sprachen mit gleichen Platzhaltern', () => {
  assert.deepEqual(Object.keys(packs).sort(), ['de', 'en', 'es', 'fr', 'it', 'pl']);
  const keys = Object.keys(packs.de);
  const vars = (v) => (String(v).match(/\{\w+\}/g) || []).sort().join();
  for (const lang of Object.keys(packs)) {
    assert.deepEqual(Object.keys(packs[lang]).sort(), keys.slice().sort(), lang + ': gleiche Schlüssel');
    for (const k of keys) assert.equal(vars(packs[lang][k]), vars(packs.de[k]), `${lang}:${k} Platzhalter`);
  }
  for (const k of ['network', 'auth', 'notfound', 'rejected', 'conflict', 'ratelimit', 'server', 'unavailable', 'slow', 'freeze', 'render', 'resource', 'code', 'storage', 'demo', 'hint', 'unknown']) {
    for (const s of ['_t', '_w', '_d']) assert.ok(packs.de[k + s], k + s);
  }
  const e = plain.explain({ level: 'error', category: 'network', message: 'Netzwerkfehler bei GET /api/pickup-status', total: 978, users: ['Amer', 'Sikandar'] });
  assert.equal(e.title, 'Verbindung zum Server unterbrochen (Abholstatus)');
  assert.equal(e.urgency, 'watch');
});

test('RC1650: Selbst korrigieren behält Eingaben und lässt sich vorausgefüllt öffnen', () => {
  const js = fs.readFileSync(new URL('../assets/rc1630-self-correct.js', import.meta.url), 'utf8');
  assert.match(js, /openDescribe:function\(o\)\{return open\(Object\.assign\(\{\},o\|\|\{\},\{tab:'describe'\}\)\)\}/);
  assert.match(js, /DRAFT_FIELDS=\{rc1630Area:'area',rc1630Description:'description',rc1630Expected:'expected'\}/, 'Neu-Rendern löscht Eingaben nicht mehr');
  const ui = fs.readFileSync(new URL('../assets/rc1650-diagnostics-plain.js', import.meta.url), 'utf8');
});

test('RC1650: Build bindet Klartext-Diagnose und Übersetzungen ein', () => {
  const builder = fs.readFileSync(new URL('../.github/rc1112/build-three-env.mjs', import.meta.url), 'utf8');
  assert.match(builder, /\/assets\/i18n\/rc1650-diagnostics-plain\.js\?v=1650/);
  assert.match(builder, /\/assets\/rc1650-diagnostics-plain\.js\?v=1650/);
  assert.match(builder, /'assets\/rc1650-diagnostics-plain\.js',\n  'assets\/i18n\/rc1650-diagnostics-plain\.js',/);
});

test('RC1650: Fehler melden und „An KI senden“ gehen direkt an den KI-Autofix, Abschaltung wird erklärt', () => {
  const ui = fs.readFileSync(new URL('../assets/rc1650-diagnostics-plain.js', import.meta.url), 'utf8');
  const sc = fs.readFileSync(new URL('../assets/rc1630-self-correct.js', import.meta.url), 'utf8');
  assert.match(sc, /function reportBug\(o\)\{o=o\|\|\{\};return call\(AUTOFIX,\{action:'request-manual'/, 'ein gemeinsamer Aufruf für Dialog und Fehlerdiagnose');
  assert.match(sc, /reportBug:reportBug,autofixConfiguration:autofixConfiguration,/);
  assert.match(ui, /sc\.reportBug\(\{area:report\.area,description:report\.description,expected:report\.expected\}\)/, '„Fehler melden“ sendet direkt');
  assert.match(ui, /function startAi\(el,btn\)\{[\s\S]*?sc\.reportBug\(/, '„An KI senden“ sendet direkt');
  assert.doesNotMatch(ui, /openDescribe\(/, 'kein Umweg über den Dialog mehr');
  assert.match(ui, /if\(c\.enabled===false&&!c\.error\)return\{kind:'off',text:t\('aiOff'\)\}/);
  assert.match(packs.de.aiOff, /EXPORTHUB_AUTOFIX_ENABLED/);
  assert.equal(plain.classify({ category: 'manual', level: 'error', message: 'Abholkalender springt zurück' }).kind, 'manual');
});

test('RC1579: der IT-Stellvertreter übernimmt Farben mit !important, damit er in hellen Designs lesbar ist', () => {
  const js = fs.readFileSync(new URL('../assets/rc1579-menu-redesign.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../assets/rc1579-menu-redesign.css', import.meta.url), 'utf8');
  assert.match(js, /proxy\.style\.setProperty\(p,cs\.getPropertyValue\(p\),'important'\)/);
  assert.match(js, /pl\.style\.setProperty\(p,ls\.getPropertyValue\(p\),'important'\)/);
  assert.match(js, /--rc1579-proxy-icon-fg/);
  assert.match(css, /\[data-rc1579-proxy\] \.index308-nav-icon::before\{background-color:var\(--rc1579-proxy-icon-fg,currentColor\)!important/);
});

test('RC1650: nach dem Melden gibt es eine Rückmeldung und bei fertigem Fix einen Link zum Pull Request (2026-10-29)', () => {
  const pr = 'https://github.com/Deadshot89/ExportHub/pull/1234';
  assert.equal(plain.prUrl({ runUrl: pr }), pr);
  assert.equal(plain.prUrl({ runUrl: 'https://github.com/Deadshot89/ExportHub/actions/runs/1' }), '', 'ein Lauf ist kein PR');
  assert.equal(plain.prUrl({ runUrl: 'https://evil.example/Deadshot89/ExportHub/pull/1' }), '', 'nur Links ins eigene Repository');
  assert.equal(plain.jobState({ autofix: { status: 'testing', runUrl: pr } }), 'pr');
  assert.equal(plain.jobState({ autofix: { status: 'running', runUrl: pr } }), 'running');
  assert.equal(plain.jobState({ autofix: { status: 'failed' } }), 'failed');
  assert.equal(plain.jobState({ resolvedAt: '2026-10-29T10:00:00Z', autofix: { status: 'testing', runUrl: pr } }), 'fixed');
  const ui = fs.readFileSync(new URL('../assets/rc1650-diagnostics-plain.js', import.meta.url), 'utf8');
  assert.match(ui, /class="btn rc1650-pr"/, 'Button „Pull Request öffnen“');
  assert.match(ui, /track\(/, 'gemeldete Aufträge werden verfolgt');
  assert.match(ui, /function notifyDone\(/, 'Meldung, sobald es ein Ergebnis gibt');
  for (const [lang, pack] of Object.entries(packs)) {
    for (const key of ['job_pr', 'openPr', 'openRun', 'close', 'done_pr', 'done_fixed', 'done_failed']) {
      assert.ok(pack[key], `${lang}.${key}`);
    }
    assert.match(pack.reportSent, /\{id\}/, `${lang}.reportSent nennt den Auftrag`);
  }
});

test('RC1650: Abbruchgrund wird lesbar angezeigt, ohne doppelt maskierte Zeichen (2026-10-30)', () => {
  const ui = fs.readFileSync(new URL('../assets/rc1650-diagnostics-plain.js', import.meta.url), 'utf8');
  assert.match(ui, /replace\(\/&\(#39\|#x27\|quot\|lt\|gt\|amp\);\/g/);
  const wf = fs.readFileSync(new URL('../.github/workflows/diagnostic-autofix.yml', import.meta.url), 'utf8');
  assert.match(wf, /sed -n '\/\^BLOCKED:\/,\$p' \.exporthub-autofix\/final\.txt > \/tmp\/exporthub-autofix-final\.txt/);
  assert.doesNotMatch(wf, /aus Sicherheitsgründen blockiert/);
});

test('RC1650: „An KI senden“ gibt es direkt in „Zuerst ansehen“ (2026-10-30)', () => {
  const ui = fs.readFileSync(new URL('../assets/rc1650-diagnostics-plain.js', import.meta.url), 'utf8');
  assert.match(ui, /data-rc1650-ai-top="'\+esc\(i\.group\.key\)/, 'Button pro Zeile');
  assert.match(ui, /if\(b\.hasAttribute\('data-rc1650-ai-top'\)\)aiFromTop\(b\)/);
  assert.match(ui, /function aiFromTop\(btn\)\{[\s\S]*?startAi\(el,btn\)/, 'öffnet den Eintrag und sendet über denselben Weg');
});
