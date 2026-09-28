import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

function scriptById(source,id){
  const escaped=id.replace(/[.*+?^$()|[\\]\\\\]/g,'\\\\$&');
  const open=new RegExp('<script\\\\b[^>]*id=["\\\']'+escaped+'["\\\'][^>]*>','i').exec(source);
  assert.ok(open,id+': Scriptblock fehlt');
  const start=open.index,end=source.indexOf('</script>',start+open[0].length);
  assert.ok(end>start,id+': Scriptblock ist nicht geschlossen');
  return source.slice(start,end+'</script>'.length);
}

test('RC1319 Diagnose: finaler Save-Controller zeigt Status- und Buttonpfad',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  const html=fs.readFileSync('dist-rc1112/index.html','utf8');
  const runtime=scriptById(html,'rc565-end-to-end-function-core');
  const statusPos=runtime.indexOf("if(!q(saved.status))saved.status='Entwurf';");
  const buttonPos=html.indexOf('rc363SaveShipment');
  const eventPos=runtime.indexOf('exporthub:shipment-saved');
  const excerpt=[
    'STATUS='+runtime.slice(Math.max(0,statusPos-1800),statusPos+4500),
    'BUTTON='+html.slice(Math.max(0,buttonPos-1800),buttonPos+6500),
    'EVENT='+runtime.slice(Math.max(0,eventPos-1800),eventPos+4500)
  ].join('\\n---RC1319---\\n');
  assert.fail(excerpt);
});
