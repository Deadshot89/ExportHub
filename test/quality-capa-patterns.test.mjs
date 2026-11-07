import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { analyze } = require('../api/shared/qm-patterns.js');

const TODAY = '2026-11-07'; // Samstag
let n = 0;
const mk = (o) => ({ id: 'QM-' + (++n), title: 'Fall ' + n, status: 'offen', category: 'versand', severity: 'mittel', area: '', reference: '', rootCause: '', occurredOn: '2026-11-03', createdAt: '2026-11-03T08:00:00Z', ...o });

test('Muster: leere Liste und Fehleingaben liefern eine leere, aber vollständige Auswertung', () => {
  for (const input of [[], null, undefined, [null, 5, 'x']]) {
    const r = analyze(input, { today: TODAY });
    assert.equal(r.total, 0);
    assert.deepEqual(r.hints, []);
    assert.equal(r.byWeekday.length, 7);
  }
});

test('Muster: Zeitraum filtert nach Fehlerdatum, 0 bedeutet alle Fälle', () => {
  const items = [mk({ occurredOn: '2026-11-05' }), mk({ occurredOn: '2026-09-01' }), mk({ occurredOn: '2025-01-01' })];
  assert.equal(analyze(items, { today: TODAY, days: 30 }).total, 1);
  assert.equal(analyze(items, { today: TODAY, days: 90 }).total, 2);
  assert.equal(analyze(items, { today: TODAY, days: 365 }).total, 2);
  assert.equal(analyze(items, { today: TODAY, days: 0 }).total, 3);
  assert.equal(analyze(items, { today: TODAY, days: 30 }).period.from, '2026-10-08');
});

test('Muster: Häufung nach Kategorie nur bei genug Fällen und ausreichendem Anteil', () => {
  const few = [mk({ category: 'verladung' }), mk({ category: 'verladung' }), mk({ category: 'zoll' })];
  assert.equal(analyze(few, { today: TODAY }).hints.some(h => h.code === 'category-cluster'), false, 'zu wenige Fälle');
  const many = [1, 2, 3, 4].map(() => mk({ category: 'verladung' })).concat([mk({ category: 'zoll' }), mk({ category: 'dokumente' })]);
  const hint = analyze(many, { today: TODAY }).hints.find(h => h.code === 'category-cluster');
  assert.deepEqual([hint.key, hint.count, hint.share, hint.total], ['verladung', 4, 67, 6]);
});

test('Muster: Wochentag und Bereich', () => {
  const mon = '2026-11-02';
  const items = [1, 2, 3].map(() => mk({ occurredOn: mon, area: 'Warenausgang' })).concat([mk({ occurredOn: '2026-11-04' }), mk({ occurredOn: '2026-11-05' })]);
  const r = analyze(items, { today: TODAY });
  assert.equal(r.byWeekday[0].count, 3);
  assert.equal(r.hints.find(h => h.code === 'weekday-cluster').day, 0);
  assert.deepEqual(r.byArea[0], { key: 'warenausgang', count: 3 });
  assert.equal(r.hints.find(h => h.code === 'area-cluster').count, 3);
});

test('Muster: Wiederholungen über Referenz und Ursachenwort', () => {
  const items = [
    mk({ reference: 'ab12cd', rootCause: 'Fehlende Scankontrolle an der Rampe' }),
    mk({ reference: 'AB12CD ', rootCause: 'Scankontrolle wurde übersprungen' }),
    mk({ reference: 'ZZ99ZZ', rootCause: 'Keine Scankontrolle vorhanden' }),
    mk({ reference: '', rootCause: 'Unklare Zuständigkeit' })
  ];
  const r = analyze(items, { today: TODAY });
  const byRef = r.repeats.find(x => x.kind === 'reference');
  assert.deepEqual([byRef.key, byRef.count], ['AB12CD', 2]);
  const byCause = r.repeats.find(x => x.kind === 'cause' && x.key === 'scankontrolle');
  assert.equal(byCause.count, 3);
  assert.equal(byCause.ids.length, 3);
  assert.ok(!r.repeats.some(x => x.key === 'wurde'), 'Füllwörter zählen nicht');
  assert.equal(r.hints.find(h => h.code === 'repeat').count, r.repeats.length);
});

test('Muster: unwirksame, überfällige und lange offene Maßnahmen', () => {
  const items = [
    mk({ effectivenessResult: 'unwirksam', status: 'abgeschlossen' }),
    mk({ dueDate: '2026-10-28' }),
    mk({ dueDate: '2026-11-20' }),
    mk({ dueDate: '2026-10-01', status: 'abgeschlossen' }),
    mk({ occurredOn: '2026-09-20', createdAt: '2026-09-20T08:00:00Z' })
  ];
  const r = analyze(items, { today: TODAY });
  assert.equal(r.ineffective.length, 1);
  assert.deepEqual(r.overdue.map(o => o.daysOverdue), [10], 'abgeschlossene und zukünftige Fristen zählen nicht');
  assert.equal(r.longOpen.length, 1);
  assert.equal(r.longOpen[0].days, 48);
  for (const code of ['ineffective', 'overdue', 'long-open']) assert.ok(r.hints.some(h => h.code === code), code);
  assert.equal(r.open, 3);
  assert.equal(r.closed, 2);
});

test('Muster: Ausgabe bleibt klein und enthält keine Freitext-Felder außer Titel', () => {
  const items = Array.from({ length: 40 }, (_, i) => mk({ reference: 'R' + (i % 20) + 'XXXX', rootCause: 'Gemeinsame Ursache Prozess', description: 'GEHEIM' + i }));
  const r = analyze(items, { today: TODAY });
  assert.ok(r.repeats.length <= 8);
  assert.ok(r.repeats.every(x => x.ids.length <= 10));
  assert.ok(!JSON.stringify(r).includes('GEHEIM'));
});

test('Muster: API-Aktion patterns liegt hinter dem Leserecht und verändert keine Daten', () => {
  const src = fs.readFileSync('api/quality-capa/index.js', 'utf8');
  const at = src.indexOf("action==='patterns'"), read = src.indexOf("requireRight(canRead(user),'Qualitätsabweichungen')");
  assert.ok(at > read && read > 0);
  const block = src.slice(at, src.indexOf("if(action==='advise')", at));
  assert.ok(block.length > 80);
  assert.doesNotMatch(block, /mutateRecords|writeJson/);
});

test('Muster: Seite hat Knopf, Zeitraumwahl und alle Hinweis-Texte in sechs Sprachen', () => {
  const page = fs.readFileSync('qualitaet.html', 'utf8');
  const dict = fs.readFileSync('assets/i18n/qualitaet.js', 'utf8');
  assert.match(page, /id="patternBtn"/);
  assert.match(page, /action:'patterns'/);
  assert.match(page, /id="patternDays"/);
  for (const code of ['category-cluster', 'area-cluster', 'weekday-cluster', 'repeat', 'ineffective', 'overdue', 'long-open'])
    assert.ok(page.includes("h.code==='" + code + "'"), code);
  for (const key of ['Muster-Auswertung', 'Keine Auffälligkeiten', 'Montag', 'Sonntag', '{n} Tage'])
    assert.ok(dict.includes("'" + key + "'"), key);
});
