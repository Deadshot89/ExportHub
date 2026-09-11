import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html','TESTVERSION.html']) {
  test(`${file}: fehlendes ABD darf die Mail nicht sperren`, () => {
    const html = fs.readFileSync(file,'utf8');
    const phrase='Mail gesperrt: ABD noch nicht abgeschlossen.';
    const i=html.indexOf(phrase);
    if(i>=0){
      const fnStart=Math.max(html.lastIndexOf('function rc543',i),html.lastIndexOf('function mail',i),i-5000);
      const from=Math.max(0,fnStart>=0?fnStart:i-5000),to=Math.min(html.length,i+2200);
      console.error(`RC1049_MAIL_ABD_FULL_CONTEXT ${file}:\n${html.slice(from,to)}`);
    }
    assert.equal(i,-1,`${file}: alter ABD-Mailblock ist noch aktiv`);
  });
}
