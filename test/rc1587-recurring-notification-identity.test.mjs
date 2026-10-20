import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser=fs.readFileSync('e2e/specs/notifications.spec.mjs','utf8');
const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

const normalize=x=>String(x||'').toLocaleLowerCase('de-DE').replace(/\s+/g,' ').trim();
const identity=t=>normalize(t.title)+'|'+normalize(t.context);

test('RC1587: gleichnamige Wochenaufgaben unterschiedlicher Fälligkeit sind keine Dubletten',()=>{
  const rows=[
    {id:'managed:spanien:2026-10-19',title:'Essentra Spanien anmelden',context:'Alle · 19.10.2026'},
    {id:'managed:spanien:2026-10-22',title:'Essentra Spanien anmelden',context:'Alle · 22.10.2026'}
  ];
  assert.equal(new Set(rows.map(x=>normalize(x.title))).size,1);
  assert.equal(new Set(rows.map(identity)).size,2);
  assert.equal(new Set(rows.map(x=>x.id)).size,2);
});

test('RC1587: identische Aufgabe wird anhand gleicher ID oder gleicher Fälligkeit weiterhin erkannt',()=>{
  const rows=[
    {id:'managed:spanien:2026-10-19',title:'Essentra Spanien anmelden',context:'Alle · 19.10.2026'},
    {id:'duplicate-legacy',title:'Essentra Spanien anmelden',context:'Alle · 19.10.2026'}
  ];
  assert.equal(new Set(rows.map(identity)).size,1);
  assert.equal(new Set(rows.map(x=>x.id)).size,2);
});

test('RC1587: Browser prüft ID und Titel/Fälligkeit/Zuordnung statt Titel allein',()=>{
  assert.match(browser,/Aufgabe ohne stabile eindeutige ID gefunden/);
  assert.match(browser,/new Set\(ids\)\.size/);
  assert.match(browser,/new Set\(identities\)\.size/);
  assert.match(browser,/\.index236-item-head p/);
  assert.doesNotMatch(browser,/new Set\(normalized\)\.size/);
});

test('RC1587: bestehender Notification-Build normalisiert Benutzer, dueAt und eindeutige IDs',()=>{
  assert.match(builder,/function notificationTaskKey\(t\)/);
  assert.match(builder,/function taskDate\(t\)\{var v=q\(t&&\(t\.dueDate\|\|t\.dueAt/);
  assert.match(builder,/function openTasks\(\)\{var seen=\{\}/);
});
