import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function e3Contexts(source) {
  const contexts = [];
  const re = /\bE3\b/g;
  for (const match of source.matchAll(re)) {
    const from = Math.max(0, match.index - 500);
    const to = Math.min(source.length, match.index + 800);
    contexts.push({ index: match.index, text: source.slice(from, to).replace(/\s+/g, ' ') });
  }
  return contexts;
}

test('Diagnose zeigt alle eigenständigen E3-Definitionen', () => {
  const contexts = e3Contexts(html);
  assert.ok(contexts.length > 0, 'Keine eigenständige E3-Verpackungsdefinition in index.html gefunden.');
  console.log(`E3_OCCURRENCES=${contexts.length}`);
  contexts.forEach((context, i) => console.log(`E3_CONTEXT_${i + 1}@${context.index}: ${context.text}`));
});

test('E3 verwendet ausschließlich die festgelegten Maße 43 x 31 x 31 cm und 0,06 LDM in Verpackungsdefinitionen', () => {
  const contexts = e3Contexts(html);
  const packagingContexts = contexts.filter(({ text }) => /(?:E0|E1|E2|E4|verpack|packag|dimensions|maße|masse|ldm)/i.test(text));
  assert.ok(packagingContexts.length > 0, 'Keine E3-Verpackungsdefinition mit Verpackungskontext gefunden.');

  const correctDimensionPattern = /(?:43\D{0,40}31\D{0,40}31|(?:length|laenge|länge|l)\s*[:=]\s*43[\s\S]{0,180}(?:width|breite|b)\s*[:=]\s*31[\s\S]{0,180}(?:height|hoehe|höhe|h)\s*[:=]\s*31)/i;
  const correctLdmPattern = /(?:0[,.]06|ldm\s*[:=]\s*["']?0?[,.]?06)/i;
  const wrongPackagingContexts = packagingContexts.filter(({ text }) => !(correctDimensionPattern.test(text) && correctLdmPattern.test(text)));

  assert.equal(
    wrongPackagingContexts.length,
    0,
    'Mindestens eine E3-Verpackungsdefinition weicht von 43 x 31 x 31 cm / 0,06 LDM ab:\n' + wrongPackagingContexts.map(({ index, text }) => `@${index}: ${text}`).join('\n---\n')
  );
});
