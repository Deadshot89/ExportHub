import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
let built=false;

function build(){
  if(built)return;
  execFileSync(process.execPath,['.github/rc1018/build-three-env.mjs'],{cwd:ROOT,stdio:'pipe'});
  built=true;
}
function html(file){
  build();
  return fs.readFileSync(path.join(ROOT,'dist-rc1018',file),'utf8');
}
function navigation(source){
  const marker='id="index321-single-navigation-controller"';
  const start=source.indexOf(marker);
  assert.ok(start>=0,'Kanonischer Navigationscontroller fehlt.');
  const open=source.lastIndexOf('<script',start);
  const end=source.indexOf('</script>',start);
  assert.ok(open>=0&&end>start,'Navigationscontroller ist unvollständig.');
  return source.slice(open,end+'</script>'.length);
}

for(const file of ['index.html','TESTVERSION.html','demo.html']){
  test(`RC1034 ${file}: Hauptmenü Sendung erstellen startet den vorhandenen Fresh-Draft-Ablauf`,()=>{
    const nav=navigation(html(file));
    assert.match(
      nav,
      /view==='shipment'&&source==='menu'[\s\S]{0,500}ExportHUBShipment420[\s\S]{0,250}startNewShipment/,
      `${file}: Menüroute shipment muss vor Cache-/Normalrouting startNewShipment verwenden.`
    );
    assert.match(nav,/function route\(view,source\)/,'Kanonische Route darf nicht durch einen Parallelrouter ersetzt werden.');
  });
}

test('RC1034: bestehende Sendungen bleiben vom Fresh-Draft-Sonderweg getrennt',()=>{
  const nav=navigation(html('index.html'));
  assert.doesNotMatch(
    nav,
    /view==='shipment'&&source!=='menu'[\s\S]{0,300}startNewShipment/,
    'Nur der explizite Hauptmenü-Einstieg darf einen neuen Draft erzwingen.'
  );
  assert.match(nav,/restoreFastView\(view,previous\)/,'Normale Navigation und bestehende Sendungsansichten behalten den vorhandenen Cachepfad.');
});
