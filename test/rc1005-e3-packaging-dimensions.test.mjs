import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function e3Contexts(source) {
  const contexts = [];
  const re = /\bE3\b/g;
  for (const match of source.matchAll(re)) {
    const from = Math.max(0, match.index - 450);
    const to = Math.min(source.length, match.index + 650);
    contexts.push(source.slice(from, to).replace(/\s+/g, ' '));
  }
  return contexts;
}

test('E3 verwendet die festgelegten Maße 43 x 31 x 31 cm und 0,06 LDM', () => {
  const contexts = e3Contexts(html);
  assert.ok(contexts.length > 0, 'Keine eigenständige E3-Verpackungsdefinition in index.html gefunden.');

  const dimensionPattern = /(?:43\D{0,40}31\D{0,40}31|(?:length|laenge|länge|l)\s*[:=]\s*43[\s\S]{0,160}(?:width|breite|b)\s*[:=]\s*31[\s\S]{0,160}(?:height|hoehe|höhe|h)\s*[:=]\s*31)/i;
  const ldmPattern = /(?:0[,.]06|ldm\s*[:=]\s*["']?0?[,.]?06)/i;
  const correct = contexts.some((context) => dimensionPattern.test(context) && ldmPattern.test(context));

  assert.ok(
    correct,
    'E3 ist nicht als 43 x 31 x 31 cm / 0,06 LDM hinterlegt. Gefundene E3-Kontexte:\n' + contexts.slice(0, 12).join('\n---\n')
  );
});
