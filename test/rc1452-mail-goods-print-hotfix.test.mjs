import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');

test('RC1452: Lieferavis-Mail darf weder Ladeliste noch CMR Warenbeschreibung erreichen',()=>{
  const runtime=read('assets/rc1267-i18n.js');
  const builder=read('.github/rc1112/build-three-env.mjs');
  const hotfix=read('scripts/rc1452-mail-goods-print-hotfix.mjs');
  assert.match(hotfix,/patchInsideFunction/,'RC1452 muss die Reparatur eindeutig innerhalb der Zielfunktion patchen');
  assert.match(runtime,/var VERSION='RC1452'/,'RC1452 Runtime wurde vor dem Test nicht vorbereitet');
  assert.match(runtime,/\['shipments','savedShipments','salesSharedShipments','sharedShipments','shipmentArchive','archivedShipments','archive'\]/,'Reparatur scannt nicht alle Sendungssammlungen');
  assert.match(runtime,/rc1452DocumentActionRepair/,'Druck-/Dokumentaktion repariert Altbestände nicht synchron');
  assert.match(builder,/function rc1452PrintGoodsDescription\(sh\)/,'Druck-Sanitizer fehlt');
  assert.match(builder,/score>=2\?'':v/,'Druck-Sanitizer verwirft Mail-/Avistext nicht fail-closed');
  assert.match(builder,/rc1452PrintGoodsDescription\(sh\)/,'Ladeliste/CMR verwenden den Sanitizer nicht');
  assert.match(builder,/rc1267-i18n\.js\?v=1452/,'Browser-Cache wird für die Reparatur nicht invalidiert');
});
