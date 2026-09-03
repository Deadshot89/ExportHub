import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('TESTVERSION.html','utf8');
const style=html.match(/<style\s+id=["']rc990-design-system["'][^>]*>([\s\S]*?)<\/style>/i)?.[1]||'';

test('RC990 Design: kanonischer Design-Layer existiert genau einmal',()=>{
  assert.equal((html.match(/id=["']rc990-design-system["']/gi)||[]).length,1);
});

test('RC990 Design: kompakte gemeinsame Designvariablen sind definiert',()=>{
  for(const token of ['--rc990-card-gap','--rc990-card-pad','--rc990-action-h','--rc990-radius','--rc990-title-size','--rc990-muted-size']){
    assert.match(style,new RegExp(token.replaceAll('-','\\-')+'\\s*:'),`${token} fehlt`);
  }
});

test('RC990 Design: Karten orientieren sich an Inhalt statt künstlich gestreckt zu werden',()=>{
  assert.match(style,/align-self\s*:\s*start/i);
  assert.match(style,/height\s*:\s*auto/i);
  assert.doesNotMatch(style,/height\s*:\s*100%/i);
});

test('RC990 Design: Aktionen besitzen klare primäre sekundäre und destruktive Rollen',()=>{
  assert.match(style,/primary|data-action-role/i);
  assert.match(style,/secondary|ghost/i);
  assert.match(style,/destructive|danger/i);
  assert.match(style,/min-height\s*:\s*var\(--rc990-action-h\)/i);
});

test('RC990 Design: Druck CMR Signatur und Colli-Ausnahme werden nicht global überschrieben',()=>{
  assert.doesNotMatch(style,/\.cmr-|#cmr|\.print-|signature|pod-signature/i);
  assert.doesNotMatch(style,/#rc363BlockColli[^}]*font-size\s*:/i);
  assert.match(html,/#rc363BlockColli[\s\S]{0,3000}font-size\s*:\s*(?:var\(--rc977-colli-font\)|12px)/i);
  assert.match(html,/#rc363BlockColli[\s\S]{0,3000}(?:height|min-height)\s*:\s*var\(--rc971-control-h\)/i);
});

test('RC990 Design: responsive Anwendungskarten und Aktionen brechen kontrolliert um',()=>{
  assert.match(style,/@media\s*\([^)]*max-width|@container/i);
  assert.match(style,/flex-wrap\s*:\s*wrap|grid-template-columns/i);
  assert.doesNotMatch(style,/width\s*:\s*100vw/i);
});

test('RC990 Design: Aufgaben verwenden ein echtes 3-2-1 Kachelraster',()=>{
  assert.match(style,/RC990 task tile grid/i,'kanonischer Aufgabenraster-Marker fehlt');
  assert.match(style,/grid-template-columns\s*:\s*repeat\(3\s*,\s*minmax\(0\s*,\s*1fr\)\)/i,'Desktop muss drei Aufgabenkacheln je Reihe erlauben');
  assert.match(style,/@media\s*\(max-width:\s*(?:1100|1050|1000|900)px\)[\s\S]*?RC990 task tile grid[\s\S]*?grid-template-columns\s*:\s*repeat\(2\s*,\s*minmax\(0\s*,\s*1fr\)\)/i,'mittlere Breite muss auf zwei Kacheln wechseln');
  assert.match(style,/@media\s*\(max-width:\s*(?:760|700|680|640)px\)[\s\S]*?RC990 task tile grid[\s\S]*?grid-template-columns\s*:\s*minmax\(0\s*,\s*1fr\)/i,'Smartphone muss auf eine Kachel wechseln');
});

test('RC990 Design: aktuelle RC628 Aufgabenansicht wird vom Kachelraster wirklich getroffen',()=>{
  assert.match(style,/body\[data-exporthub-view=["']tasks["']\][\s\S]{0,500}\.rc229-task-grid/i,'aktuelle Aufgaben-Gridklasse fehlt im RC990-Layer');
  assert.match(style,/\.rc229-task-card\.rc628-unified-task/i,'aktuelle Aufgabenkartenklasse fehlt im RC990-Layer');
  assert.match(style,/\.rc229-task-grid\s*\{[\s\S]{0,300}grid-template-columns\s*:\s*repeat\(3\s*,\s*minmax\(0\s*,\s*1fr\)\)/i,'RC628-Aufgabenraster ist Desktop noch nicht dreispaltig');
});

test('RC990 Design: Aufgabenkacheln sind sichtbar als kompakte Karten gestaltet',()=>{
  for(const token of ['--rc990-card-border','--rc990-card-shadow','--rc990-task-accent']){
    assert.match(style,new RegExp(token.replaceAll('-','\\-')+'\\s*:'),`${token} fehlt`);
  }
  assert.match(style,/RC990 task card identity/i,'sichtbarer Aufgaben-Kartenstil fehlt');
  assert.match(style,/border-left\s*:\s*(?:4|5|6)px\s+solid\s+var\(--rc990-task-accent\)/i);
  assert.match(style,/box-shadow\s*:\s*var\(--rc990-card-shadow\)/i);
  assert.match(style,/background\s*:/i);
});

test('RC990 Design: Warncenter und Benachrichtigungscenter bleiben getrennt und unterschiedlich markiert',()=>{
  assert.match(html,/Warncenter/i);
  assert.match(html,/Benachrichtigungscenter/i);
  assert.match(style,/warncenter/i);
  assert.match(style,/notification|benachrichtigung/i);
  assert.doesNotMatch(html,/rc990[^\n]{0,300}(?:merge|combine)[^\n]{0,100}(?:Warn|Benach)/i);
});

test('RC990 Design: Dashboard Lager Aufgaben nutzen gemeinsame Dichte ohne Drag-Animationen',()=>{
  for(const marker of ['dashboard','lager','task','aufgabe'])assert.match(style,new RegExp(marker,'i'),`${marker}-Scope fehlt`);
  assert.doesNotMatch(style,/transition\s*:\s*all/i);
  assert.doesNotMatch(style,/animation\s*:[^;]*(?:drag|card)/i);
  assert.match(html,/RC946|rc946/i,'RC946 Drag-Schutzmarker fehlt');
});
