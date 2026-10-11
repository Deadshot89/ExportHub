import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const i18nFile='assets/i18n/rc1488-auto-update.js';
const runtimeFile='assets/rc1488-auto-update.js';
const finalizerFile='.github/rc1488/finalize-auto-update.mjs';

test('RC1488: Update-Sprachpaket liefert alle sechs freigegebenen Sprachen',()=>{
  const code=fs.readFileSync(i18nFile,'utf8');
  const root={navigator:{language:'en-GB'}};root.window=root;root.globalThis=root;
  vm.runInContext(code,vm.createContext(root),{filename:i18nFile});
  for(const lang of ['de','en','pl','es','fr','it']){
    assert.ok(root.ExportHUBAutoUpdateI18n.packs[lang],`Sprachpaket ${lang} fehlt`);
    assert.ok(root.ExportHUBAutoUpdateI18n.t('updateNow',lang),`Update-Button ${lang} fehlt`);
  }
  assert.equal(root.ExportHUBAutoUpdateI18n.t('updateNow','en'),'Update now');
});

test('RC1488: Runtime verwendet das Update-Sprachpaket statt fest verdrahteter deutscher UI-Texte',()=>{
  const runtime=fs.readFileSync(runtimeFile,'utf8');
  assert.match(runtime,/ExportHUBAutoUpdateI18n/,'Runtime bindet RC1488-i18n nicht ein');
  assert.match(runtime,/\.t\(['"]updateNow['"]/,'Update-Button wird nicht übersetzt');
  assert.match(runtime,/\.t\(['"]available['"]/,'Update-Hinweis wird nicht übersetzt');
  assert.match(runtime,/\.t\(['"]saveFirst['"]/,'Speichern-Hinweis wird nicht übersetzt');
  assert.match(runtime,/\.t\(['"]reloadLocked['"]/,'Reload-Lock-Hinweis wird nicht übersetzt');
});

test('RC1488: Finalizer deployt Sprachpaket vor der Update-Runtime',()=>{
  const finalizer=fs.readFileSync(finalizerFile,'utf8');
  assert.match(finalizer,/assets['"],['"]i18n['"],['"]rc1488-auto-update\.js/,'RC1488-i18n wird nicht ins Build kopiert');
  assert.match(finalizer,/exporthub-rc1488-auto-update-i18n/,'RC1488-i18n Script-Tag fehlt');
  const i18nAt=finalizer.indexOf('exporthub-rc1488-auto-update-i18n');
  const runtimeAt=finalizer.indexOf('exporthub-rc1488-auto-update');
  assert.ok(i18nAt>=0&&runtimeAt>=0&&i18nAt<=runtimeAt,'Sprachpaket muss vor der Update-Runtime geladen werden');
});
