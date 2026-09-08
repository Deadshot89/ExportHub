import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=['index.html','TESTVERSION.html'];

for(const file of files){
  test(`${file}: Lieferavis-Mail verwendet die vom Server ausgegebene URL`,()=>{
    const html=fs.readFileSync(file,'utf8');
    const linkStart=html.indexOf('function link(sh)');
    const linkEnd=html.indexOf('function patchCopies',linkStart);
    assert.ok(linkStart>0&&linkEnd>linkStart,`${file}: link(sh) fehlt`);
    const linkFn=html.slice(linkStart,linkEnd);
    assert.match(linkFn,/customerAvisPublicUrl|avisPublicUrl/,`${file}: Link muss die serverseitig ausgegebene URL verwenden`);
    assert.match(linkFn,/customer-avis\.html/,`${file}: kanonische öffentliche Avis-Seite fehlt`);
    assert.match(linkFn,/environment=/,`${file}: Umgebung muss Bestandteil des Links sein`);

    const toggleStart=html.indexOf('async function toggle(on)',linkEnd);
    const toggleEnd=html.indexOf('async function autoDisableIfDue()',toggleStart);
    assert.ok(toggleStart>0&&toggleEnd>toggleStart,`${file}: Avis-toggle fehlt`);
    const toggleFn=html.slice(toggleStart,toggleEnd);
    assert.match(toggleFn,/customerAvisPublicUrl:q\(data\.url\)/,`${file}: API-URL wird nach dem Ausstellen nicht übernommen`);
  });
}

test('öffentliche Avis-URL wird niemals in den Sendungszustand persistiert',()=>{
  const merge=fs.readFileSync('api/shared/merge.js','utf8');
  assert.match(merge,/customerAvisPublicUrl/);
  assert.match(merge,/avisPublicUrl/);
});
