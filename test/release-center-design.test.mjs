import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Release-Center: verständliche Sperrmeldung bei gleicher Version und kompaktes Layout.

for(const file of ['index.html','TESTVERSION.html']){
  const html=fs.readFileSync(file,'utf8');
  const a=html.indexOf('<script id="rc562-release-center-controller">');
  const js=html.slice(a,html.indexOf('</script>',a));

  test(`Release-Center (${file}): gleiche Version mit unbestätigter Adresse meldet nicht "RC… statt RC…"`,()=>{
    const pick=name=>{const i=js.indexOf('function '+name+'(');assert.ok(i>=0,name+' fehlt');return js.slice(i,js.indexOf('\n',i))};
    const ctx={VERSION:'RC1112',testServiceVersion:'RC1112'};
    vm.runInNewContext("function q(v){return String(v==null?'':v).trim()}\n"+pick('mismatchText')+'\n'+pick('mismatchBadge'),ctx);
    assert.equal(ctx.mismatchText(),'Die Testservice-Adresse ist nicht bestätigt');
    assert.equal(ctx.mismatchBadge(),'⚠ ADRESSE UNBESTÄTIGT');
    ctx.testServiceVersion='RC1110';
    assert.equal(ctx.mismatchText(),'Online läuft RC1110 statt RC1112');
    assert.equal(ctx.mismatchBadge(),'⚠ ABWEICHUNG');
    assert.doesNotMatch(js,/STOPP: Online läuft/);
  });

  test(`Release-Center (${file}): vier Statuskacheln in einer Reihe, Karten zweispaltig`,()=>{
    const c=html.indexOf('<style id="rc562-release-center-style">');
    const css=html.slice(c,html.indexOf('</style>',c));
    assert.match(css,/#content \.rc562-release-grid\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
    assert.match(css,/body\[data-exporthub-view="release"\] #content\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    assert.match(css,/body\[data-exporthub-view="release"\] #content>\*\{grid-column:auto;/,'Dashboard-Regeln dürfen die Karten nicht auf volle Breite ziehen');
  });
}
