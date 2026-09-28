import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function saveRuntime(source){
  const open=/<script\b[^>]*id=["']rc565-end-to-end-function-core["'][^>]*>/i.exec(source);
  assert.ok(open,'rc565-end-to-end-function-core: Scriptblock fehlt');
  const start=open.index,end=source.indexOf('</script>',start+open[0].length);
  assert.ok(end>start,'rc565-end-to-end-function-core: Scriptblock ist nicht geschlossen');
  return source.slice(start,end+'</script>'.length);
}

test('RC1319 Diagnose: finaler Save-Controller zeigt Status, Recalc und QR-Pfad',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const runtime=saveRuntime(html);
  const statusPos=runtime.indexOf("if(!q(saved.status))saved.status='Entwurf';");
  const recalcPos=runtime.indexOf('function recalc');
  const eventPos=runtime.indexOf('exporthub:shipment-saved');
  const warehousePos=html.indexOf('ExportHUBWarehouse');
  const qrRegisterPos=html.indexOf('pickupQrRegistered:true');
  assert.ok(statusPos>=0,'RC565 Statusanker fehlt');
  assert.ok(recalcPos>=0,'RC565 recalc fehlt');
  const excerpt=[
    'STATUS='+runtime.slice(Math.max(0,statusPos-1800),statusPos+5600),
    'RECALC='+runtime.slice(recalcPos,recalcPos+7600),
    'EVENT='+runtime.slice(Math.max(0,eventPos-1800),eventPos+3800),
    'WAREHOUSE='+html.slice(Math.max(0,warehousePos-2600),warehousePos+7800),
    'QRREGISTER='+html.slice(Math.max(0,qrRegisterPos-2600),qrRegisterPos+7800)
  ].join('\n---RC1319---\n');
  assert.fail(excerpt);
});
