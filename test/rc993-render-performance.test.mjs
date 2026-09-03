import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html', 'utf8');
const releaseText = 'RC993 berechnet die gefilterte und sortierte Sendungsübersicht pro ruhigem Patch nur einmal und verwendet dieselbe Reihenfolge für Kartenverschiebungen und Sortierung.';

function block(startPattern, endPattern, max = 9000) {
  const match = html.match(startPattern);
  if (!match || match.index == null) return '';
  const start = match.index;
  const rest = html.slice(start, start + max);
  if (!endPattern) return rest;
  const end = rest.match(endPattern);
  if (!end || end.index == null) return rest;
  return rest.slice(0, end.index);
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

test('RC993: kanonischer Build und Release-Center-Punkt sind sichtbar', () => {
  assert.match(html, /var\s+BUILD\s*=\s*Object\.freeze\(\{version:'RC993',cache:'993',loginReturn:'\/TESTVERSION\.html\?v=993'\}\)/);
  assert.ok(html.includes(releaseText), 'RC993 Release-Center-Punkt fehlt');
});

test('RC993: ruhiger Overview-Patch berechnet die gefilterte Sendungsliste nur einmal', () => {
  const src = block(/function\s+rc640PatchOverviewQuietly\s*\(/, /function\s+rc640ScheduleOverviewPatch\s*\(/, 7000);
  assert.ok(src, 'rc640PatchOverviewQuietly fehlt');
  assert.equal(countMatches(src, /overviewFiltered\s*\(/g), 1, 'overviewFiltered darf im ruhigen Patch nur einmal berechnet werden');
  assert.match(src, /rc485PatchOverviewCards\s*\(\s*desired\s*\)/, 'vorbereitete Liste muss an den Karten-Patch weitergegeben werden');
  assert.match(src, /overviewReorderExistingCards\s*\(\s*desired\s*\)/, 'vorbereitete Liste muss an die Sortierung weitergegeben werden');
});

test('RC993: Karten-Patch teilt eine vorberechnete Reihenfolge mit allen verschobenen Karten', () => {
  const src = block(/window\.rc485PatchOverviewCards\s*=\s*function\s*\(/, /var\s+rc640OverviewPatchTimer\s*=/, 9000);
  assert.ok(src, 'rc485PatchOverviewCards fehlt');
  assert.match(src, /function\s*\(\s*desired\s*\)/, 'Karten-Patch muss die vorberechnete Liste annehmen');
  assert.match(src, /overviewPlaceChangedCard\s*\(\s*card\s*,\s*sh\s*,\s*desired\s*\)/, 'verschobene Karten müssen dieselbe Liste verwenden');
  assert.doesNotMatch(src, /overviewFiltered\s*\(/, 'Karten-Patch darf die vollständige Liste nicht pro verschobener Karte neu berechnen');
});

test('RC993: Kartenverschiebung und Reorder akzeptieren dieselbe vorberechnete Overview-Liste', () => {
  const move = block(/function\s+overviewPlaceChangedCard\s*\(/, /window\.rc485PatchOverviewCards\s*=/, 7000);
  const reorder = block(/function\s+overviewReorderExistingCards\s*\(/, /function\s+overviewRemoveEmptyGroups\s*\(/, 5000);
  assert.match(move, /function\s+overviewPlaceChangedCard\s*\(\s*card\s*,\s*sh\s*,\s*desired\s*\)/);
  assert.match(move, /Array\.isArray\s*\(\s*desired\s*\)/);
  assert.match(reorder, /function\s+overviewReorderExistingCards\s*\(\s*desired\s*\)/);
  assert.match(reorder, /Array\.isArray\s*\(\s*desired\s*\)/);
});
