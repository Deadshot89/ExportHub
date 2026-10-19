import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('assets/rc1577-shipment-overview-compact.css','utf8');
const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function block(html,tag,id){
  const m=html.match(new RegExp(`<${tag} id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'));
  return m?m[1]:'';
}

for(const file of ['index.html','TESTVERSION.html']){
  const html=fs.readFileSync(file,'utf8');

  test(`RC1577 ${file}: Auto-Grow misst gebündelt und nur geänderte Textfelder`,()=>{
    const js=block(html,'script','exporthub-rc973-autogrow-long-text');
    const scan=js.slice(js.indexOf('function scan(root){'),js.indexOf('function runScheduled(){'));
    assert.ok(scan,'scan() fehlt');
    assert.match(scan,/__rc1577AutogrowKey/,'unveränderte Felder müssen übersprungen werden');
    assert.match(scan,/checkVisibility\(|rendered\)/,'nicht gerenderte Kacheln dürfen kein Layout erzwingen');
    assert.doesNotMatch(scan,/forEach\.call\([^)]*,resizeTextarea\)/,'kein Layout je Textarea mehr');
    const write=scan.indexOf("'height','auto'"),read=scan.indexOf('scrollHeight'),set=scan.lastIndexOf("+'px'");
    assert.ok(write>=0&&read>write&&set>read,'Reihenfolge muss Schreiben → Messen → Schreiben sein');
    assert.match(js,/contentvisibilityautostatechange/,'sichtbar werdende Kacheln müssen nachgemessen werden');
  });

  test(`RC1577 ${file}: Statusabgleich liest Kacheln einmal und schreibt nur Änderungen`,()=>{
    const start=html.indexOf('function patchVisible(){');
    const body=html.slice(start,html.indexOf('\n}\n',start));
    assert.match(body,/var nodes=Array\.prototype\.slice\.call\(document\.querySelectorAll\('#content \.rc524-shipment-card\[data-shipment\],#content tr'\)\)/);
    assert.doesNotMatch(body,/allShipments\(\)\.forEach\(function\(sh\)\{[^\n]*document\.querySelectorAll/,'keine DOM-Abfrage je Sendung');
    assert.match(body,/el\.textContent!==st\)el\.textContent=st/,'unveränderter Status darf keine Mutation auslösen');
  });
}

test('RC1577: kompakte Kacheln sind reines Bildschirm-CSS für die Sendungsübersicht',()=>{
  const body=css.replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(body,/@media print|display:none(?!!important\})/,'Funktionen dürfen nicht ausgeblendet werden');
  for(const rule of body.split('}').map(r=>r.trim()).filter(r=>r.includes('{')&&!r.startsWith('@')))
    assert.match(rule,/#content#content\.rc524-overview-view/,'jede Regel muss auf die Sendungsübersicht begrenzt sein: '+rule.slice(0,80));
  assert.match(body,/repeat\(auto-fill,minmax\(330px,1fr\)\)/,'einzelne Kacheln dürfen nicht die volle Breite füllen');
  assert.match(body,/\.rc524-dangerbar>\[hidden\]\{display:none!important\}/);
});

test('RC1577: Build bindet das Stylesheet nach RC1560 ein und kopiert es mit',()=>{
  assert.match(build,/const RC1577_OVERVIEW_COMPACT_STYLE_TAG='<link id="exporthub-rc1577-overview-compact" rel="stylesheet" href="\/assets\/rc1577-shipment-overview-compact\.css\?v=1577">'/);
  const a=build.indexOf('html=patchRc1560FullWidth(html,file);'),b=build.indexOf('html=patchRc1577OverviewCompact(html,file);');
  assert.ok(a>=0&&b>a,'RC1577 muss nach RC1560 gepatcht werden');
  assert.match(build,/'assets\/rc1577-shipment-overview-compact\.css'/);
});
