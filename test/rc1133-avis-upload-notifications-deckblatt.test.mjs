import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function build(){
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
}

test('RC1133: Deckblatt wird im finalen RC1112-Artefakt drucksicher deutlich hervorgehoben',()=>{
  build();
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  assert.match(html,/\.rc352-cover\{[^}]*border:10mm solid #08245d!important;[^}]*border-top-width:20mm!important;/);
  assert.match(html,/\.rc352-cover\{[^}]*outline:2.5mm solid #2563eb!important;/);
  assert.match(html,/\.rc352-cover-ref\{(?=[^}]*background:#08245d)(?=[^}]*border:4mm solid #facc15)[^}]*color:#fff!important/);
  assert.doesNotMatch(html,/\\\\n\.rc352-qr-slot\.empty/,'Deckblatt-CSS darf keinen literalen \\n-Text zwischen Regeln enthalten');
});

test('RC1133: AVIS-Upload-Benachrichtigungsruntime wird in alle internen Umgebungen gebaut',()=>{
  const src='assets/rc1133-avis-upload-notifications.js';
  assert.equal(fs.existsSync(src),true,'RC1133 Benachrichtigungsruntime fehlt');
  if(!fs.existsSync(src))return;
  const runtime=fs.readFileSync(src,'utf8');
  assert.match(runtime,/customer-avis-document/);
  assert.match(runtime,/Neues AVIS-Dokument/);
  assert.match(runtime,/PDF öffnen \/ drucken/);
  assert.match(runtime,/ExportHUBDocumentBlob1059/);
  assert.match(runtime,/data-index236-action="open-shipment"/);
  assert.match(runtime,/localStorage/);
  build();
  for(const file of ['index.html','TESTVERSION.html','demo.html']){
    const html=fs.readFileSync('dist-rc1112/'+file,'utf8');
    assert.match(html,/assets\/rc1133-avis-upload-notifications\.js\?v=1133/);
  }
  assert.equal(fs.existsSync('dist-rc1112/assets/rc1133-avis-upload-notifications.js'),true);
});
