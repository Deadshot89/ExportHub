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

test('RC1488: Runtime verwendet ausschließlich das Update-Sprachpaket für sichtbare UI-Texte',()=>{
  const runtime=fs.readFileSync(runtimeFile,'utf8');
  assert.match(runtime,/ExportHUBAutoUpdateI18n/,'Runtime bindet RC1488-i18n nicht ein');
  assert.match(runtime,/tr\(['"]updateNow['"]\)/,'Update-Button wird nicht übersetzt');
  assert.match(runtime,/tr\(['"]available['"]\)/,'Update-Hinweis wird nicht übersetzt');
  assert.match(runtime,/tr\(['"]saveFirst['"]\)/,'Speichern-Hinweis wird nicht übersetzt');
  assert.match(runtime,/tr\(['"]reloadLocked['"]\)/,'Reload-Lock-Hinweis wird nicht übersetzt');
  assert.doesNotMatch(runtime,/Jetzt aktualisieren|Neue ExportHUB360-Version verfügbar|Bitte zuerst speichern|Automatisches Neuladen wurde/,'Runtime enthält weiterhin hart codierte deutsche Update-UI');
});

test('RC1488: Finalizer deployt Sprachpaket vor der Update-Runtime',()=>{
  const finalizer=fs.readFileSync(finalizerFile,'utf8');
  assert.match(finalizer,/path\.join\(root,['"]assets['"],['"]i18n['"],['"]rc1488-auto-update\.js['"]\)/,'RC1488-i18n wird nicht ins Build kopiert');
  assert.match(finalizer,/exporthub-rc1488-auto-update-i18n/,'RC1488-i18n Script-Tag fehlt');
  assert.match(finalizer,/i18nScriptTag\(\)\+'\\n'\+scriptTag/,'Sprachpaket muss direkt vor der Update-Runtime injiziert werden');
});
