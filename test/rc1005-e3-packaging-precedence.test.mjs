import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html','TESTVERSION.html']) {
  const html = fs.readFileSync(file,'utf8');

  test(`${file}: E0 bis E6 haben Vorrang vor gespeicherten Altwerten`, () => {
    const m = html.match(/function packagingList\(\)\{([\s\S]*?)\}function applyPackaging/);
    assert.ok(m, `${file}: packagingList/applyPackaging fehlt`);
    const body = m[1].replace(/\s+/g,' ');

    assert.match(
      body,
      /fixed=PACK\.filter\(function\(x\)\{return \/\^E\[0-6\]\$\/i\.test\(q\(x\.name\)\)\}\)/,
      `${file}: Die festen Kartons E0 bis E6 müssen aus PACK als unveränderliche Stammdaten markiert werden.`
    );
    assert.match(
      body,
      /sources=\[fixed,arr\(s\.colliTypes\)\]/,
      `${file}: E0 bis E6 müssen vor state.colliTypes ausgewertet werden, damit z. B. ein alter E3-Wert 60x40x22 die Stammdaten 43x31x31 nicht überschreibt.`
    );
    assert.match(
      body,
      /sources\.push\(PACK\)/,
      `${file}: Die restlichen Standardverpackungen müssen weiterhin als Fallback verfügbar bleiben.`
    );
  });

  test(`${file}: applyPackaging übernimmt LDM und alle drei Maße aus dem priorisierten Stammdatensatz`, () => {
    const m = html.match(/function applyPackaging\(row,node\)\{([\s\S]*?)\}\s*function totals/);
    assert.ok(m, `${file}: applyPackaging fehlt`);
    assert.match(m[1],/\['ldm','l','w','h'\]\.forEach/, `${file}: applyPackaging muss LDM, Länge, Breite und Höhe übernehmen`);
  });
}
