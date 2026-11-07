'use strict';
/* ExportHUB360 – Muster-Auswertung für „Fehler & Verbesserungen“.
 * Reine Berechnung über die erfassten Fälle: keine KI, keine Netzwerkaufrufe, keine Kosten.
 * Liefert Zahlen und Hinweis-Codes; die Oberfläche formuliert die Texte in der gewählten Sprache. */
const STOP = new Set(['fehler', 'falsch', 'falsche', 'falscher', 'wurde', 'wurden', 'haben', 'einer', 'einem', 'einen', 'durch', 'wegen', 'nicht', 'beim', 'wieder', 'erneut', 'fehlt', 'fehlte', 'lieferung', 'sendung', 'keine', 'kein', 'dass', 'diese', 'dieser', 'sowie', 'sehr', 'mehr', 'oder', 'aber', 'worden', 'wurde']);
const MAX_ITEMS = 8;

function text(v, max = 200) { return String(v == null ? '' : v).trim().slice(0, max); }
function day(v) { const s = text(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
function caseDay(item) { return day(item && item.occurredOn) || day(text(item && item.createdAt, 10)); }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
function addDays(isoDay, n) { const d = new Date(isoDay + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function tally(list, keyOf) {
  const map = new Map();
  for (const x of list) { const k = keyOf(x); if (k) map.set(k, (map.get(k) || 0) + 1); }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, MAX_ITEMS);
}
function ref(item) { return text(item.reference, 120).toUpperCase().replace(/\s+/g, ''); }
function brief(item) { return { id: text(item.id, 60), title: text(item.title, 180), category: text(item.category, 30) }; }

function analyze(items, options = {}) {
  const today = day(options.today) || new Date().toISOString().slice(0, 10);
  const days = Number(options.days);
  const from = days > 0 ? addDays(today, -days) : '';
  const all = (Array.isArray(items) ? items : []).filter(x => x && typeof x === 'object');
  const list = all.filter(x => { const d = caseDay(x); return !from || (d && d >= from && d <= today); });
  const open = list.filter(x => x.status !== 'abgeschlossen');
  const total = list.length;

  const byCategory = tally(list, x => text(x.category, 30));
  const byArea = tally(list, x => text(x.area, 120).toLowerCase());
  const bySeverity = tally(list, x => text(x.severity, 30));
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]; // Montag = 0
  for (const x of list) { const d = caseDay(x); if (d) weekdayCounts[(new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7]++; }
  const byWeekday = weekdayCounts.map((count, index) => ({ day: index, count }));

  // Wiederholungen: gleiche Referenz oder gleiches Ursachenwort in mehreren Fällen
  const repeats = [];
  const refGroups = new Map();
  for (const x of list) { const r = ref(x); if (r) refGroups.set(r, (refGroups.get(r) || []).concat(x)); }
  for (const [key, group] of refGroups) if (group.length >= 2) repeats.push({ kind: 'reference', key, count: group.length, ids: group.map(g => text(g.id, 60)).slice(0, 10) });
  const wordGroups = new Map();
  for (const x of list) {
    const words = new Set((text(x.rootCause, 2000).toLowerCase().match(/[a-zäöüß]{5,}/g) || []).filter(w => !STOP.has(w)));
    for (const w of words) wordGroups.set(w, (wordGroups.get(w) || []).concat(x));
  }
  for (const [key, group] of wordGroups) if (group.length >= 3) repeats.push({ kind: 'cause', key, count: group.length, ids: group.map(g => text(g.id, 60)).slice(0, 10) });
  repeats.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  const ineffective = list.filter(x => x.effectivenessResult === 'unwirksam').map(brief).slice(0, MAX_ITEMS);
  const overdue = open.filter(x => day(x.dueDate) && day(x.dueDate) < today)
    .map(x => Object.assign(brief(x), { dueDate: day(x.dueDate), daysOverdue: daysBetween(day(x.dueDate), today) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, MAX_ITEMS);
  const longOpen = open.map(x => ({ item: x, age: caseDay(x) ? daysBetween(caseDay(x), today) : 0 })).filter(x => x.age > 30)
    .sort((a, b) => b.age - a.age).slice(0, MAX_ITEMS).map(x => Object.assign(brief(x.item), { days: x.age }));

  // Hinweise als Codes; Schwellen bewusst vorsichtig, damit kleine Fallzahlen nichts „beweisen“.
  const hints = [];
  const share = n => (total ? Math.round((n / total) * 100) : 0);
  if (total >= 5 && byCategory[0] && byCategory[0].count >= 3 && share(byCategory[0].count) >= 40) hints.push({ code: 'category-cluster', key: byCategory[0].key, count: byCategory[0].count, share: share(byCategory[0].count), total });
  if (byArea[0] && byArea[0].count >= 3) hints.push({ code: 'area-cluster', key: byArea[0].key, count: byArea[0].count, total });
  const topDay = byWeekday.reduce((a, b) => (b.count > a.count ? b : a), { day: -1, count: 0 });
  if (total >= 5 && topDay.count >= 3 && share(topDay.count) >= 40) hints.push({ code: 'weekday-cluster', day: topDay.day, count: topDay.count, share: share(topDay.count), total });
  if (repeats.length) hints.push({ code: 'repeat', count: repeats.length });
  if (ineffective.length) hints.push({ code: 'ineffective', count: ineffective.length });
  if (overdue.length) hints.push({ code: 'overdue', count: overdue.length });
  if (longOpen.length) hints.push({ code: 'long-open', count: longOpen.length });

  return {
    period: { from, to: today, days: days > 0 ? days : 0 },
    total, open: open.length, closed: total - open.length,
    byCategory, byArea, bySeverity, byWeekday,
    repeats: repeats.slice(0, MAX_ITEMS), ineffective, overdue, longOpen, hints
  };
}

module.exports = { analyze };
