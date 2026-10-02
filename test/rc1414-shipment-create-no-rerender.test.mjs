import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const builder=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');

function freshBlock(html){
  const start=html.indexOf('function startFreshShipment(){');
  const end=html.indexOf('function enforceFreshDraft(){',start);
  assert.ok(start>=0&&end>start,'Fresh-Draft-Block fehlt im Build');
  return html.slice(start,end);
}

test('RC1414: Build enthält den lokalen Neue-Sendung-Reset nach RC1412',()=>{
  assert.match(builder,/function patchRc1414ShipmentCreateNoRerender\(html,file\)/);
  const rc1412=builder.indexOf('html=patchRc1412ShipmentCreateDomPreserve(html,file);');
  const rc1414=builder.indexOf('html=patchRc1414ShipmentCreateNoRerender(html,file);');
  assert.ok(rc1412>=0&&rc1414>rc1412,'RC1414 muss nach RC1412 angewendet werden');
});

test('RC1414: bestehende Sendungsmaske wird weder geleert noch über den Router neu aufgebaut',()=>{
  execFileSync(process.execPath,['.github/rc1112/build-three-env.mjs'],{stdio:'pipe'});
  for(const file of ['index.html','TESTVERSION.html']){
    const block=freshBlock(fs.readFileSync('dist-rc1112/'+file,'utf8'));
    assert.match(block,/preserveMountedShipment=!!\(r&&mountedLayout&&r\.contains\(mountedLayout\)\)/,file+': Mounted-Layout-Erkennung fehlt');
    assert.match(block,/if\(r&&!preserveMountedShipment\)\{[^}]*r\.replaceChildren\(\)/,file+': Root-Clear muss auf echten Ansichtsaufbau begrenzt bleiben');
    assert.match(block,/if\(!preserveMountedShipment\)\{try\{if\(window\.ExportHUBRC325/,file+': Router darf nur ohne bestehende Maske laufen');
    assert.doesNotMatch(block,/if\(preserveMountedShipment\)\{try\{patch\(\)/,file+': bestehende Maske darf keinen großen Shipment-Patch starten');
  }
});

test('RC1414: lokaler Reset setzt Colli-DOM gezielt zurück und behält den Layout-Knoten',()=>{
  const block=freshBlock(fs.readFileSync('dist-rc1112/index.html','utf8'));
  assert.match(block,/function resetMountedFreshDom\(\)/);
  assert.match(block,/rowNodes\(\)\.forEach\(function\(node\)\{node\.remove\(\)\}\)/);
  assert.match(block,/box\.appendChild\(ownedRow\(0,blankFreshRow\(\)\)\)/);
  assert.match(block,/safePatchDuringEdit\(\);return true/);
  assert.doesNotMatch(block,/if\(preserveMountedShipment\)[\s\S]{0,180}replaceChildren\(\)/,'lokaler Reset darf #content nicht ersetzen');
  assert.doesNotMatch(block,/if\(preserveMountedShipment\)[\s\S]{0,180}ExportHUBRC325\.route/,'lokaler Reset darf den Router nicht starten');
});

test('RC1414: zweiter 90-ms-Finalizer läuft nur beim erstmaligen Ansichtsaufbau',()=>{
  const block=freshBlock(fs.readFileSync('dist-rc1112/index.html','utf8'));
  assert.match(block,/finalize\(\);if\(!preserveMountedShipment\)\{var nt=[\s\S]*?nt\(finalize,90\)\}/);
  assert.doesNotMatch(block,/finalize\(\);var nt=[\s\S]*?nt\(finalize,90\)/);
});
