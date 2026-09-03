import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('TESTVERSION.html','utf8');

function buildVersion(){
  const m=html.match(/var BUILD=Object\.freeze\(\{version:'RC(\d+)',cache:'(\d+)'/);
  return m ? {version:Number(m[1]),cache:Number(m[2])} : {version:0,cache:0};
}
function block(tag,id){
  const rx=new RegExp(`<${tag} id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,'i');
  const m=html.match(rx);
  return m ? m[1] : '';
}

test('RC973: Langtextfelder besitzen einen isolierten Auto-Grow-Layer',()=>{
  const build=buildVersion();
  assert.ok(build.version>=973,'BUILD muss RC973 oder höher sein');
  assert.ok(build.cache>=973,'Cache muss RC973 oder höher sein');

  const css=block('style','rc973-autogrow-long-text');
  assert.ok(css,'RC973 Auto-Grow-Style fehlt');
  assert.match(css,/textarea\[data-rc973-autogrow=["']1["']\]/i,'Auto-Grow-CSS muss ausschließlich markierte Textareas adressieren');
  assert.match(css,/max-height\s*:\s*none\s*!important/i,'alte Maximalhöhen müssen für Langtext aufgehoben werden');
  assert.match(css,/overflow-y\s*:\s*hidden\s*!important/i,'interne vertikale Scrollbalken müssen vermieden werden');
  assert.match(css,/white-space\s*:\s*pre-wrap\s*!important/i,'Mehrzeilentext muss sauber umbrechen');
  assert.match(css,/overflow-wrap\s*:\s*anywhere\s*!important/i,'lange Inhalte müssen umbrechen können');
});

test('RC973: Höhe wächst und schrumpft aus scrollHeight und überschreibt alte !important-Fixhöhen',()=>{
  const js=block('script','exporthub-rc973-autogrow-long-text');
  assert.ok(js,'RC973 Auto-Grow-Script fehlt');
  assert.match(js,/tagName\s*!==?\s*['"]TEXTAREA['"]/i,'nur echte Textareas dürfen automatisch wachsen');
  assert.match(js,/scrollHeight/i,'Inhaltshöhe muss über scrollHeight ermittelt werden');
  assert.match(js,/style\.setProperty\(\s*['"]height['"]\s*,\s*['"]auto['"]\s*,\s*['"]important['"]\s*\)/i,'vor der Messung muss auch eine alte !important-Höhe neutralisiert werden');
  assert.match(js,/style\.setProperty\(\s*['"]height['"]\s*,[\s\S]*?['"]px['"][\s\S]*?['"]important['"]\s*\)/i,'gemessene Höhe muss mit !important gesetzt werden');
  assert.match(js,/addEventListener\(\s*['"]input['"]/i,'Tippen und Löschen müssen sofort nachmessen');
  assert.match(js,/MutationObserver/i,'dynamisch gerenderte bzw. gespeicherte Inhalte müssen nach dem Öffnen erfasst werden');
  assert.match(js,/exporthub:rendered/i,'nach ExportHUB-Rendern muss nachgemessen werden');
  assert.match(js,/window\.addEventListener\(\s*['"]resize['"]/i,'Breitenänderungen müssen die Textarea-Höhe neu berechnen');
});

test('RC973: Druck/CMR/Signatur bleiben ausgeschlossen und Fachwerte werden nicht verändert',()=>{
  const js=block('script','exporthub-rc973-autogrow-long-text');
  assert.match(js,/#loadListDoc/i,'Ladelisten-/Druckbereich muss ausgeschlossen bleiben');
  assert.match(js,/\.rc390-paper/i,'Papier-/CMR-Bereich muss ausgeschlossen bleiben');
  assert.match(js,/\.index209-signature-dialog/i,'Signaturdialog muss ausgeschlossen bleiben');
  assert.doesNotMatch(js,/\.value\s*=/i,'Auto-Grow darf keine Feldwerte schreiben');
});

test('RC973: kurze Felder und Colli-Geometrie bleiben kompakt',()=>{
  assert.match(html,/--rc971-control-h\s*:\s*42px/i,'globaler 42px-Standard für kurze Felder muss bestehen bleiben');
  assert.match(html,/#rc363BlockColli\s+#rc573ColliCard\s+\.rc363-colli-grid\s+:is\(input,select,button,\.rc682-packaging-toggle\)[^{]*\{[^}]*height\s*:\s*var\(--rc971-control-h\)\s*!important/i,'Colli-Kurzfelder müssen ihre feste kompakte Höhe behalten');
  const css=block('style','rc973-autogrow-long-text');
  assert.doesNotMatch(css,/(^|[,\s]):?is\([^)]*input|input\[data-rc973-autogrow/i,'RC973 darf keine einzeiligen Inputs in Auto-Grow aufnehmen');
});
