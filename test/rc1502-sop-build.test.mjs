import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const builder='.github/rc1502/build-three-env.mjs';

test('RC1502 besitzt additiven Drei-Umgebungen-Build für Visuals und Editor',()=>{
  assert.ok(fs.existsSync(builder),'RC1502 Build-Wrapper fehlt');
  const source=fs.readFileSync(builder,'utf8');
  assert.match(source,/rc1501\/build-three-env\.mjs/);
  assert.match(source,/rc1502-sop-visuals\.js/);
  assert.match(source,/rc1502-sop-screenshot-manifest\.js/);
  assert.match(source,/rc1502-sop-editor\.js/);
  assert.match(source,/rc1502-sop-target-picker-ui\.js/);
  assert.match(source,/rc1502-sop-persistence\.js/);
  assert.match(source,/rc1502-sop-editor\.css/);
});

test('RC1502 liefert Visual- Editor- Target-Picker- und Persistenz-Assets in Produktion TESTSERVICE und Demo genau einmal aus',()=>{
  execFileSync(process.execPath,[builder],{cwd:process.cwd(),stdio:'pipe'});
  const out=path.join(process.cwd(),'dist-rc1112');
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync(path.join(out,file),'utf8');
    for(const id of ['exporthub-rc1502-sop-editor-style','exporthub-rc1502-sop-visuals','exporthub-rc1502-sop-screenshot-manifest','exporthub-rc1502-sop-editor','exporthub-rc1502-sop-target-picker-ui','exporthub-rc1502-sop-persistence']){
      assert.equal(html.split(`id="${id}"`).length-1,1,`${file}: ${id} muss genau einmal vorkommen`);
    }
    const visuals=html.indexOf('id="exporthub-rc1502-sop-visuals"');
    const editor=html.indexOf('id="exporthub-rc1502-sop-editor"');
    const picker=html.indexOf('id="exporthub-rc1502-sop-target-picker-ui"');
    const persistence=html.indexOf('id="exporthub-rc1502-sop-persistence"');
    assert.ok(visuals>=0&&editor>visuals,`${file}: Visuals müssen vor dem Editor geladen werden`);
    assert.ok(picker>editor&&persistence>picker,`${file}: Persistenz muss nach Editor und Target Picker geladen werden`);
  }
  for(const rel of ['assets/sop/rc1502-sop-visuals.js','assets/sop/rc1502-sop-screenshot-manifest.js','assets/sop/rc1502-sop-editor.js','assets/sop/rc1502-sop-target-picker-ui.js','assets/sop/rc1502-sop-persistence.js','assets/sop/rc1502-sop-editor.css'])assert.ok(fs.existsSync(path.join(out,rel)),`Build-Asset fehlt: ${rel}`);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'rc1502-sop-editor-manifest.json'),'utf8'));
  assert.equal(manifest.version,'RC1502');
  assert.equal(manifest.baseBuilder,'.github/rc1501/build-three-env.mjs');
  assert.equal(manifest.editorPersistence,'confirmed-shared-state-flush');
});
