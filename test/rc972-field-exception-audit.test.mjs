import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');
const avis = fs.readFileSync('customer-avis.html','utf8');
const pickup = fs.readFileSync('pickup.html','utf8');
const location = fs.readFileSync('location.html','utf8');

function buildVersion(){
  const m=html.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  return m ? {version:Number(m[1]),cache:Number(m[2])} : {version:0,cache:0};
}
function globalCss(){
  const m=html.match(/<style id="rc971-global-form-field-standard">([\s\S]*?)<\/style>/i);
  return m ? m[1] : '';
}

test('RC972: Topbar-, Such- und Toolbarfelder fallen nicht unter den globalen Feldstandard',()=>{
  const build=buildVersion();
  assert.ok(build.version>=972,'BUILD muss RC972 oder höher sein');
  assert.ok(build.cache>=972,'Cache muss RC972 oder höher sein');

  const css=globalCss();
  assert.ok(css,'globaler Formularstandard fehlt');
  assert.match(css,/--rc972-toolbar-h\s*:\s*40px/i,'RC972 Toolbar-Feldhöhe muss 40px sein');
  assert.match(css,/--rc972-toolbar-font\s*:\s*13px/i,'RC972 Toolbar-Schrift muss 13px sein');

  assert.match(css,/\.topbar[\s\S]*?#globalSearch[\s\S]*?min-height\s*:\s*var\(--rc972-toolbar-h\)/i,'globale Suche muss mindestens 40px hoch sein');
  assert.match(css,/#languageSelect[\s\S]*?min-height\s*:\s*var\(--rc972-toolbar-h\)/i,'Sprachauswahl muss mindestens 40px hoch sein');
  assert.match(css,/#ehThemeSelect[\s\S]*?min-height\s*:\s*var\(--rc972-toolbar-h\)/i,'Designauswahl muss mindestens 40px hoch sein');
  assert.match(css,/#ehThemeSwitch[\s\S]*?min-height\s*:\s*var\(--rc972-toolbar-h\)/i,'Designschalter muss mindestens 40px hoch sein');
  assert.match(css,/\.topbar[\s\S]*?:is\(button,\.ghost,\.btn\)[\s\S]*?min-height\s*:\s*var\(--rc972-toolbar-h\)/i,'Topbar-Aktionen müssen mindestens 40px hoch sein');
});

test('RC972: kompakte Sonderaktionen bleiben lesbar und bedienbar',()=>{
  const css=globalCss();
  assert.match(css,/\.rc210-upload-actions[\s\S]*?min-height\s*:\s*38px/i,'Dokument-Uploadaktionen dürfen nicht auf 26px schrumpfen');
  assert.match(css,/\.rc203-actions[\s\S]*?min-height\s*:\s*38px/i,'Kartenaktionen dürfen nicht auf 25px schrumpfen');
  assert.match(css,/\.rc504-shift-btn[\s\S]*?min-height\s*:\s*38px/i,'Sendungsaktionen dürfen nicht zu klein werden');
  assert.match(css,/\.rc682-packaging-option[\s\S]*?min-height\s*:\s*38px/i,'Verpackungsoptionen müssen ausreichend hoch bleiben');
  assert.match(css,/\.rc210-upload-actions[\s\S]*?font-size\s*:\s*12px/i,'Dokument-Uploadaktionen brauchen lesbare Schrift');
});

test('RC972: Testportal und Smartphone dürfen Felder nicht wieder verkleinern',()=>{
  const css=globalCss();
  assert.match(css,/html\[data-exporthub-testportal="1"\]\s+#content\s+:is\(input:not\(\[type="checkbox"\]\)[\s\S]*?select,textarea\)\{[^}]*min-height\s*:\s*42px/i,'Testportal muss den 42px-Feldstandard behalten');
  assert.match(css,/@media\s*\(max-width:\s*720px\)[\s\S]*?#globalSearch[\s\S]*?font-size\s*:\s*16px/i,'mobile globale Suche muss 16px Schrift erhalten');
  assert.match(css,/@media\s*\(max-width:\s*720px\)[\s\S]*?\.topbar[\s\S]*?:is\(select,button\)[\s\S]*?min-height\s*:\s*40px/i,'mobile Topbar-Controls dürfen nicht schrumpfen');
});

test('RC972: öffentliche Zusatzseiten haben bereits ausreichend große Formfelder',()=>{
  assert.match(avis,/input,textarea\{[^}]*min-height:40px[^}]*font-size:13px/i,'Kunden-Avis-Felder müssen mindestens 40px / 13px bleiben');
  assert.match(pickup,/#index209PickupForm input\{[^}]*min-height:52px[^}]*font-size:17px/i,'Abholseite muss ihre großen Eingabefelder behalten');
  assert.match(location,/\.pin input\{[^}]*font-size:24px/i,'Location-PIN-Feld muss groß und gut lesbar bleiben');
});
