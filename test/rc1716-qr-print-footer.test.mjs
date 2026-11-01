import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('RC1716: Schnelldruck-Dokumente nutzen volle A4-Seiten ohne Browser-Fusszeile auf separatem Blatt',()=>{
  const runtime=source('assets/rc1305-loading-list-print.js');
  const build=source('.github/rc1112/build-three-env.mjs');
  assert.match(runtime,/@page rcDocument\{size:A4 portrait;margin:0\}/,'QR-Gesamtdruck darf nicht durch Browser-Raender einen Ueberlauf verursachen');
  assert.match(runtime,/\.rc390-page,\.rc352-page\{page:rcDocument!important\}/,'nur Dokumentseiten erhalten das randlose A4-Layout');
  assert.match(runtime,/\.rc390-page:last-child,\.rc352-page:last-child\{break-after:auto!important;page-break-after:auto!important\}/,'nach der letzten Seite darf kein Leerblatt entstehen');
  assert.match(build,/@page\{size:A4 portrait;margin:0\}html,body/,'auch das separate Ladelisten-Druckfenster muss ohne Browser-Fusszeilen gedruckt werden');
  assert.doesNotMatch(build,/@page\{size:A4 portrait;margin:8mm\}/,'8 mm zusaetzlicher Rand drueckte die Unterschriften-/Fusskacheln auf ein weiteres Blatt');
  assert.match(runtime,/\.rc1305-signature-image/,'Unterschriften bleiben erhalten');
});

test('RC1716: Packtisch-QR druckt eine kompakte A4-Seite ohne automatische Kopf-/Fusszeile',()=>{
  const admin=source('assets/pack-station-admin.js');
  const print=admin.slice(admin.indexOf('function printQr('),admin.indexOf('\n',admin.indexOf('function printQr(')));
  assert.match(print,/@page\{size:A4 portrait;margin:0\}/);
  assert.match(print,/body\{box-sizing:border-box;width:100%/);
  assert.match(print,/padding:15mm 12mm/);
  assert.doesNotMatch(print,/@page\{margin:15mm\}/);
  assert.match(print,/contentWindow\.print\(\)/,'der QR-Druck bleibt nutzbar');
});
