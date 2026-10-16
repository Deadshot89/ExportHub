import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8');
test('RC1546: No-Rerender-Fix ist direkt im Source-of-Truth statt im Pretest',()=>{
 const pretest=read('scripts/rc1462-pretest.mjs'),builder=read('.github/rc1112/build-three-env.mjs'),i18n=read('assets/rc1267-i18n.js');
 assert.doesNotMatch(pretest,/applyRc1505SaveConfirmationRenderGate|applyRc1507I18nSaveConfirmationGate/);
 assert.match(builder,/function patchRc1505SaveConfirmationRenderGate\(html,file\)/);
 assert.match(builder,/html=patchRc1505SaveConfirmationRenderGate\(html,file\);/);
 assert.match(i18n,/function isNoMergeSaveConfirmation\(event\)/);
});
test('RC1546: Off-View-Runtimes planen keine unnötige Sync-Arbeit',()=>{
 assert.match(read('assets/rc1063-abd-blob-viewer-compat.js'),/getElementById\('rc786ReferenceFilesPanel'\)\)return/);
 assert.match(read('assets/rc1092-customer-mail-contacts.js'),/function activate\(\)\{if\(!customerFolderVisible\(\)\)/);
 assert.match(read('assets/rc1126-customer-delete.js'),/function activate\(\)\{if\(!customerView\(\)\)/);
 assert.match(read('assets/rc1294-abd-self-service.js'),/function activate\(\)\{if\(syncObserver\(\)\)schedule\(\)\}/);
 assert.match(read('assets/rc1499-abd-export.js'),/if\(!observerHost\(\)\)\{disconnectObserver\(\);return false\}/);
 assert.match(read('assets/rc1499-exportexperte-handoff.js'),/if\(!observerHost\(\)\)\{disconnectObserver\(\);return false\}/);
});
test('RC1546: Produktionsloader cached nur versionierte Releases mit SHA',()=>{
 const loader=read('infra/production-loader.html');
 assert.match(loader,/function cacheableRelease\(meta\)/);
 assert.match(loader,/String\(meta\.sha\|\|''\)\.trim\(\)/);
 assert.match(loader,/getReleaseHtml\(m\)/);
});
