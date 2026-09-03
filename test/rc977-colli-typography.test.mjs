import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');

function buildVersion(){
  const m=html.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  return m ? {version:Number(m[1]),cache:Number(m[2])} : {version:0,cache:0};
}

function rc977Css(){
  const m=html.match(/<style id="rc977-colli-typography">([\s\S]*?)<\/style>/i);
  return m ? m[1] : '';
}

test('RC977: Build ist auf RC977 oder höher angehoben',()=>{
  const build=buildVersion();
  assert.ok(build.version>=977,'BUILD muss RC977 oder höher sein');
  assert.ok(build.cache>=977,'Cache muss RC977 oder höher sein');
});

test('RC977: Colli-Typografie ist ausschließlich auf Colli & Lademeter begrenzt',()=>{
  const css=rc977Css();
  assert.ok(css,'RC977 Colli-Stylesheet fehlt');
  assert.match(css,/#rc363BlockColli\s+#rc573ColliCard/i,'RC977 muss auf den kanonischen Colli-Bereich begrenzt sein');
  assert.doesNotMatch(css,/#rc543MailArea|#index218Planner|#rc380StowPlan/i,'RC977 darf andere Funktionsbereiche nicht verändern');
});

test('RC977: Beschriftungen und Eingabefelder verwenden einheitlich 12px',()=>{
  const css=rc977Css();
  assert.match(css,/--rc977-colli-font\s*:\s*12px/i,'Einheitliche Colli-Schriftgröße muss 12px sein');
  assert.match(css,/\[data-rc363-field\][\s\S]*?font-size\s*:\s*var\(--rc977-colli-font\)\s*!important/i,'Feldbeschriftungen müssen 12px verwenden');
  assert.match(css,/:is\(input,select,button,\.rc682-packaging-toggle\)[\s\S]*?font-size\s*:\s*var\(--rc977-colli-font\)\s*!important/i,'Feldwerte und Aktionen müssen 12px verwenden');
});

test('RC977: Verpackungstext bleibt lesbar und die Feldhöhe unverändert',()=>{
  const css=rc977Css();
  assert.match(css,/\.rc682-packaging-toggle[\s\S]*?line-height\s*:\s*1\.15/i,'Verpackungstext braucht eine kompakte Zeilenhöhe');
  assert.match(css,/\.rc682-packaging-toggle[\s\S]*?overflow-wrap\s*:\s*anywhere/i,'Lange Verpackungsnamen müssen im Feld sauber umbrechen dürfen');
  assert.match(css,/:is\(input,select,button,\.rc682-packaging-toggle\)[\s\S]*?height\s*:\s*var\(--rc971-control-h\)\s*!important/i,'Die bestehende Colli-Feldhöhe von RC971 muss erhalten bleiben');
});

test('RC977: Summary und Hinweistexte werden kompakter ohne Fachwerte zu verändern',()=>{
  const css=rc977Css();
  assert.match(css,/\.rc344-summary\s+\.summaryBox\s+span[\s\S]*?font-size\s*:\s*10px/i,'Summary-Beschriftungen sollen kompakter sein');
  assert.match(css,/\.rc344-summary\s+\.summaryBox\s+strong[\s\S]*?font-size\s*:\s*14px/i,'Summary-Werte sollen kompakter bleiben, aber hervorgehoben sein');
  assert.doesNotMatch(css,/display\s*:\s*none/i,'RC977 darf keine Colli-Inhalte ausblenden');
});
