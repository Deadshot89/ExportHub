'use strict';

// Which push messages are due. Task reminders use the same TaskPlanner V2 rules as the website
// (reminderCandidates: per-task slots, default 09:00/13:00/15:30, workdays, owner, snooze), loaded
// from a byte-identical copy in ./taskplanner-v2 because the API is deployed without /assets.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const locale = require('./web-push-i18n');

const PLANNER_FILES = ['taskplanner-v2-core.js', 'taskplanner-v2-recurrence.js', 'taskplanner-v2-ui.js'];
const TIME_ZONE = 'Europe/Berlin';
const MAX_ITEMS = 8;
const INBOX_URL = '/assets/web-push/inbox.html';

function text(v) { return String(v == null ? '' : v).trim(); }
function lower(v) { return text(v).toLowerCase(); }
function short(v, n) { const s = text(v).replace(/\s+/g, ' '); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

let planner = null;
function taskPlanner() {
  if (planner) return planner;
  const context = { console, Date, Intl };
  context.globalThis = context;
  for (const file of PLANNER_FILES) vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'taskplanner-v2', file), 'utf8'), context, { filename: file });
  if (!context.ExportHUBTaskUIV2 || typeof context.ExportHUBTaskUIV2.reminderCandidates !== 'function') throw new Error('TaskPlanner V2 Erinnerungslogik fehlt');
  planner = context.ExportHUBTaskUIV2;
  return planner;
}

// Local Berlin wall-clock time with offset, the format reminderCandidates expects.
function berlinNowIso(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((p) => [p.type, p.value]));
  const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  const offsetMin = Math.round((Date.parse(local + 'Z') - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const z = (n) => String(Math.abs(n)).padStart(2, '0');
  return `${local}${offsetMin >= 0 ? '+' : '-'}${z(Math.trunc(offsetMin / 60))}:${z(offsetMin % 60)}`;
}

function isActive(user) { return Boolean(user && user.active !== false && user.disabled !== true && lower(user.status) !== 'deaktiviert'); }

function messageId(prefix, nowIso) { return prefix + '-' + nowIso.replace(/[^0-9]/g, '').slice(0, 14) + '-' + Math.random().toString(36).slice(2, 8); }

function taskPayload(rows, environment, nowIso, language = 'de', existingId) {
  const lang=locale.normalize(language)||'de', t=(key,vars)=>locale.t(key,vars,lang);
  const sorted = rows.slice().sort((a, b) => text(a.priority).localeCompare(text(b.priority)) || text(a.dueAt).localeCompare(text(b.dueAt)));
  const items = sorted.slice(0, MAX_ITEMS).map((r) => ({ title: short(r.title, 90), meta: short([r.customerName, r.priority, r.dueAt ? t('serverDue',{date:formatDue(r.dueAt)}) : ''].filter(Boolean).join(' · '), 90), taskId: short(r.taskId, 80) }));
  const one = sorted.length === 1 ? sorted[0] : null;
  const lines = items.slice(0, 3).map((i) => i.title + (i.meta ? ' · ' + i.meta : ''));
  if (sorted.length > 3) lines.push(t('serverMore',{count:sorted.length-3}));
  const id = existingId || messageId('tasks', nowIso);
  return {
    v: 1, id, kind: 'tasks', language:lang, environment, createdAt: new Date(Date.parse(nowIso)).toISOString(),
    title: one ? t('serverTaskOne',{title:short(one.title,70)}) : t('serverTaskMany',{count:sorted.length}),
    body: lines.join('\n'),
    tag: 'exporthub-tasks-' + nowIso.slice(0, 10) + '-' + text(sorted[0] && sorted[0].slot).replace(':', ''),
    url: INBOX_URL + '?m=' + encodeURIComponent(id),
    open: '/',
    total: sorted.length,
    items
  };
}
function formatDue(value) {
  const m = text(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return '';
  return `${m[3]}.${m[2]}.` + (m[4] && !(m[4] === '00' && m[5] === '00') ? ` ${m[4]}:${m[5]}` : '');
}

// One message per user with all task reminders that are due now and not yet pushed.
function dueTaskMessages(input) {
  const api = taskPlanner();
  const state = input.state && typeof input.state === 'object' ? input.state : {};
  const users = Array.isArray(input.users) ? input.users : [];
  const ledger = input.ledger || {};
  const nowIso = input.nowIso || berlinNowIso();
  const environment = lower(input.environment) === 'testservice' ? 'testservice' : 'production';
  const byUser = new Map();
  for (const s of input.subscriptions || []) {
    if (!s || !s.userId || (s.categories && s.categories.tasks === false)) continue;
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId).push(s);
  }
  const out = [], inactive = [];
  for (const [userId, subs] of byUser) {
    const user = users.find((u) => text(u && u.id) === userId);
    if (!user || !isActive(user)) { inactive.push(...subs.map((s) => s.id)); continue; }
    // JSON round trip: plain objects/arrays of this realm instead of the vm context's
    const rows = JSON.parse(JSON.stringify(api.reminderCandidates(nowIso, state, { id: userId, environment }, { catchUp: true }) || []))
      .filter((r) => r && r.channels && r.channels.website === true && !ledger[pushKey(r.key)]);
    if (!rows.length) continue;
    out.push({ userId, subscriptions: subs, ledgerKeys: rows.map((r) => pushKey(r.key)), payload: taskPayload(rows, environment, nowIso), rows });
  }
  return { nowIso, messages: out, inactiveSubscriptionIds: inactive };
}
function pushKey(reminderKey) { return 'push|' + text(reminderKey); }

function packPayload(notification, environment, nowIso = new Date().toISOString(), language='de', existingId) {
  const lang=locale.normalize(language)||'de',t=(key,vars)=>locale.t(key,vars,lang);
  const n = notification || {};
  const id = existingId || messageId('pack', nowIso.replace(/Z$/, ''));
  const customer = short(n.customer || n.customerName, 80), ref = short(n.reference, 40);
  const details = [ref, n.packageCount ? t('serverColli',{count:n.packageCount}) : '', n.totalWeight ? n.totalWeight + ' kg' : '', short(n.packStationName || n.stationName, 40)].filter(Boolean).join(' · ');
  return {
    v: 1, id, kind: 'pack', language:lang, environment: lower(environment) === 'testservice' ? 'testservice' : 'production', createdAt: nowIso,
    title: t('serverNewPack',{customer:customer?' · '+customer:''}),
    body: details || t('serverPackFallback'),
    tag: 'exporthub-pack-' + short(n.id || ref, 40),
    url: INBOX_URL + '?m=' + encodeURIComponent(id),
    open: '/',
    total: 1,
    items: [{ title: customer || ref || t('kindPack'), meta: details }]
  };
}
function testPayload(environment, nowIso = new Date().toISOString(), language='de') {
  const lang=locale.normalize(language)||'de',t=(key,vars)=>locale.t(key,vars,lang);
  const id = messageId('test', nowIso.replace(/Z$/, ''));
  return { v: 1, id, kind: 'test', language:lang, environment, createdAt: nowIso, title: t('serverTestTitle'), body: t('serverTestBody'), tag: 'exporthub-test', url: INBOX_URL + '?m=' + encodeURIComponent(id), open: '/', total: 0, items: [] };
}

module.exports = { PLANNER_FILES, INBOX_URL, taskPlanner, berlinNowIso, dueTaskMessages, taskPayload, packPayload, testPayload, pushKey, isActive };
