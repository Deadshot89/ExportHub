import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('api/avis-reminder-mail/index.js','utf8');
const ui=fs.readFileSync('assets/rc1166-avis-reminder-overview.js','utf8');

test('Issue #1328: HTML email preview must use real server template without sending or logging',()=>{
 assert.match(api,/previewOnly=action==='preview'/);
 assert.match(api,/if\(previewOnly\)\{/);
 assert.match(api,/context\.res=response\(200,\{ok:true,version:'RC1358',preview:true/);
 const start=api.indexOf('if(previewOnly){');
 const send=api.indexOf('const sent=await graphMail.sendHtmlMail');
 assert.ok(start>=0&&send>start,'preview must return before Graph mail');
 assert.match(api.slice(start,send),/\breturn\b/);
 assert.match(ui,/action:'preview'/);
 assert.match(ui,/data-html-preview/);
 assert.match(ui,/data-html-preview-panel hidden/);
 assert.match(ui,/data-preview-frame sandbox/);
 const iframe=ui.match(/<iframe data-preview-frame[^>]+>/)?.[0]||'';
 assert.match(iframe,/\bsandbox\b/);
 assert.doesNotMatch(iframe,/allow-same-origin|allow-scripts|allow-top-navigation/);
 assert.match(ui,/previewFrame\.setAttribute\('srcdoc',result\.html\)/);
 assert.match(ui,/previewPanel\.hidden=true/,'old previews must be cleared when language/recipient changes');
 assert.match(ui,/previewFrame\.removeAttribute\('srcdoc'\)/);
 assert.match(ui,/renderPickupClosureWarning\(row\.card,row\.shipment\)/);
 assert.match(ui,/data-rc1328-pickup-warning/);
 assert.match(ui,/current\.textContent=message/);
});
