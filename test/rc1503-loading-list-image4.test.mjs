import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const source=fs.readFileSync('assets/document-print-name.js','utf8');

test('RC1503: abgeholte Ladeliste behaelt die Bild-4-Felder und blendet nur den alten Ersatzblock aus',()=>{
  assert.match(source,/function restorePickupFields\(html,sh\)/);
  assert.match(source,/querySelectorAll\('\[data-rc1305-replaced-pickup-field\]'\)/);
  assert.match(source,/style\.removeProperty\('display'\)/);
  assert.match(source,/data-rc1503-legacy-summary-hidden/);
  assert.match(source,/summary\.style\.setProperty\('display','none','important'\)/);
  for(const marker of ['rc1305-signature-primary','rc1305-meta-driver','rc1305-meta-plate','rc1305-meta-loader','rc1503-pickup-date','rc1305-meta-pallet']) assert.match(source,new RegExp(marker));
  assert.match(source,/data-rc1503-image4-pickup-layout/);
});

test('RC1503: Fahrerunterschrift wird in das vorhandene Feld geschrieben und nicht als neue sichtbare Karte erzeugt',()=>{
  assert.match(source,/putSignature\(findCard\(root,/);
  assert.match(source,/rc1503-signature-value rc1305-pickup-signature/);
  assert.match(source,/className='rc1305-signature-image'/);
  assert.doesNotMatch(source,/createElement\('section'\)/);
});

test('RC1503: Druckruntime-Patch ist syntaktisch gueltig',()=>{
  execFileSync(process.execPath,['--check','assets/document-print-name.js'],{stdio:'pipe'});
});
