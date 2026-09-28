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

test('RC1319 Diagnose: finaler Save-Controller zeigt Status- und Buttonpfad',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const runtime=saveRuntime(html);
  const statusPos=runtime.indexOf("if(!q(saved.status))saved.status='Entwurf';");
  const eventPos=runtime.indexOf('exporthub:shipment-saved');
  const buttonPos=html.indexOf('rc363SaveShipment');
  assert.ok(statusPos>=0,'RC565 Statusanker fehlt');
  assert.ok(buttonPos>=0,'Save-Button fehlt');
  const excerpt=[
    'STATUS='+runtime.slice(Math.max(0,statusPos-2200),statusPos+6200),
    'BUTTON='+html.slice(Math.max(0,buttonPos-1800),buttonPos+7500),
    'EVENT='+runtime.slice(Math.max(0,eventPos-2200),eventPos+5200)
  ].join('\n---RC1319---\n');
  assert.fail(excerpt);
});
