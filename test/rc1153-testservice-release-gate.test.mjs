import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1153: Task-Master-Save ist auf Aufgabenfelder begrenzt und zieht keine Sendungsarchive mit',()=>{
  const build=read('.github/rc1112/build-three-env.mjs');
  assert.match(build,/function patchTaskMasterSaveScope\(/,'RC1153 Save-Scope-Patch fehlt im finalen Builder');
  assert.match(build,/aufgaben-master rc874/,'Task-Master-Savegrund wird nicht erkannt');
  assert.match(build,/\['tasks','taskWeek','taskMasterRC848','taskMasterSourceVersion','taskMasterUpdatedAt'\]/,'Task-Scope ist nicht fachlich begrenzt');

  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=read('dist-rc1112/'+file);
    assert.match(
      html,
      /aufgaben-master rc874[\s\S]{0,240}new Set\(\['tasks','taskWeek','taskMasterRC848','taskMasterSourceVersion','taskMasterUpdatedAt'\]\)/i,
      file+': finaler Build begrenzt den Task-Master-Save nicht'
    );
  }
});

test('RC1153: Responsive Browsernavigation wartet auf das geöffnete Menü und scrollt im Nav-Container',()=>{
  const helper=read('e2e/helpers/exporthub-browser.mjs');
  assert.match(helper,/async function waitForMenuOpen\(/,'Menüstatus wird nach dem Öffnen nicht verifiziert');
  assert.match(helper,/async function scrollMenuItemIntoView\(/,'Menüeinträge werden nicht explizit im Nav-Container gescrollt');
  assert.match(helper,/nav\.scrollTo|nav\.scrollTop/,'Nav-Container wird nicht gescrollt');
});

test('RC1153: Abholdatum-E2E prüft exakt die manipulierte Sendung statt die erste beliebige Kachel',()=>{
  const spec=read('e2e/specs/navigation.spec.mjs');
  assert.match(spec,/return\{key:/,'RC1127 Seed gibt keine eindeutige Sendungskennung zurück');
  assert.match(spec,/filter\(\{hasText:seeded\.key\}\)/,'RC1127 bindet die Prüfung nicht an die manipulierte Sendung');
  assert.doesNotMatch(spec,/locator\('\[data-rc1127-customer-pickup\]'\)\.first\(\)/,'RC1127 darf nicht die erste beliebige Abholkachel prüfen');
});
