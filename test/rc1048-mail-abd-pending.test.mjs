import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html','TESTVERSION.html']) {
  test(`${file}: fehlendes ABD darf die Mail nicht sperren`, () => {
    const html = fs.readFileSync(file,'utf8');
    const probes = ['Mail gesperrt: ABD noch nicht abgeschlossen.','Mail gesperrt','ABD noch nicht abgeschlossen'];
    for (const probe of probes) {
      const i = html.indexOf(probe);
      if (i >= 0) {
        const from = Math.max(0,i-900), to = Math.min(html.length,i+1200);
        console.error(`RC1049_MAIL_ABD_CONTEXT ${file} ${probe}:\n${html.slice(from,to)}`);
      }
    }
    assert.equal(html.indexOf('Mail gesperrt: ABD noch nicht abgeschlossen.'), -1, `${file}: alter ABD-Mailblock ist noch aktiv`);
  });
}
